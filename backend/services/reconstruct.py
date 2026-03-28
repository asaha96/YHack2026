"""
CT/MRI → 3D Mesh + Splat reconstruction pipeline.

Pipeline:
1. Load NIfTI/DICOM volume
2. Extract isosurfaces at multiple HU thresholds (organs, bone, tissue)
3. Generate colored mesh per structure
4. Export as OBJ (mesh fallback) and .splat (gaussian splat format)
"""

import os
import struct as struct_mod
import numpy as np
from pathlib import Path


def load_volume(filepath: str) -> tuple[np.ndarray, np.ndarray]:
    """Load a NIfTI or DICOM volume. Returns (volume_array, affine_matrix)."""
    ext = filepath.lower()

    if ext.endswith(".nii") or ext.endswith(".nii.gz"):
        import nibabel as nib
        img = nib.load(filepath)
        return np.array(img.dataobj, dtype=np.float32), img.affine

    elif ext.endswith(".dcm"):
        import pydicom
        ds = pydicom.dcmread(filepath)
        arr = ds.pixel_array.astype(np.float32)
        if hasattr(ds, "RescaleSlope"):
            arr = arr * ds.RescaleSlope + ds.RescaleIntercept
        # Single slice → fake 3D
        if arr.ndim == 2:
            arr = np.stack([arr] * 64, axis=-1)
        affine = np.diag([1.0, 1.0, 1.0, 1.0])
        return arr, affine

    else:
        raise ValueError(f"Unsupported format: {filepath}")


def extract_structures(volume: np.ndarray, affine: np.ndarray) -> list[dict]:
    """Extract isosurfaces for key anatomical structures using marching cubes."""
    from skimage.measure import marching_cubes

    # HU thresholds for different tissue types
    structures = [
        {"name": "bone", "threshold": 400, "color": [245, 240, 232], "alpha": 230},
        {"name": "contrast_tissue", "threshold": 120, "color": [200, 100, 100], "alpha": 200},
        {"name": "soft_tissue", "threshold": 0, "color": [204, 119, 102], "alpha": 150},
    ]

    results = []
    voxel_spacing = np.abs(np.diag(affine)[:3])

    for struct in structures:
        try:
            verts, faces, normals, _ = marching_cubes(
                volume,
                level=struct["threshold"],
                spacing=tuple(voxel_spacing),
                step_size=2,  # Downsample for speed
            )

            if len(verts) < 100:
                continue

            # Center the mesh
            center = verts.mean(axis=0)
            verts = verts - center

            results.append({
                "name": struct["name"],
                "vertices": verts,
                "faces": faces,
                "normals": normals,
                "color": struct["color"],
                "alpha": struct["alpha"],
                "vertex_count": len(verts),
                "face_count": len(faces),
            })
            print(f"  {struct['name']}: {len(verts)} verts, {len(faces)} faces")
        except Exception as e:
            print(f"  {struct['name']}: failed ({e})")

    return results


def export_obj(structures: list[dict], output_dir: str) -> list[str]:
    """Export structures as OBJ files (mesh fallback)."""
    os.makedirs(output_dir, exist_ok=True)
    paths = []

    for struct in structures:
        path = os.path.join(output_dir, f"{struct['name']}.obj")
        verts = struct["vertices"]
        faces = struct["faces"]

        with open(path, "w") as f:
            f.write(f"# {struct['name']}\n")
            for v in verts:
                f.write(f"v {v[0]:.4f} {v[1]:.4f} {v[2]:.4f}\n")
            for face in faces:
                f.write(f"f {face[0]+1} {face[1]+1} {face[2]+1}\n")

        paths.append(path)
        print(f"  Exported {struct['name']}.obj ({os.path.getsize(path)/1024:.0f} KB)")

    return paths


def export_splat(structures: list[dict], output_path: str) -> str:
    """
    Export structures as .splat file (gaussian splat format).

    .splat format: binary, per-point:
      position (3x float32) + scale (3x float32) + color (4x uint8) + rotation (4x uint8)
    Total: 32 bytes per point
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    all_points = []

    for struct in structures:
        verts = struct["vertices"]
        color = struct["color"]
        alpha = struct["alpha"]

        # Sample points from mesh surface (subsample for performance)
        max_points = 50000
        if len(verts) > max_points:
            indices = np.random.choice(len(verts), max_points, replace=False)
            verts = verts[indices]

        for v in verts:
            # Position
            x, y, z = float(v[0]), float(v[1]), float(v[2])
            # Scale (small gaussians)
            sx, sy, sz = 1.0, 1.0, 1.0
            # Color RGBA
            r, g, b, a = color[0], color[1], color[2], alpha
            # Rotation quaternion (identity)
            qw, qx, qy, qz = 128, 128, 128, 0

            all_points.append(struct_mod.pack(
                "<fff fff BBBB BBBB",
                x, y, z,
                sx, sy, sz,
                r, g, b, a,
                qw, qx, qy, qz,
            ))

    with open(output_path, "wb") as f:
        for point in all_points:
            f.write(point)

    size_mb = os.path.getsize(output_path) / 1024 / 1024
    total_points = len(all_points)
    print(f"  Exported {output_path}: {total_points} points, {size_mb:.1f} MB")
    return output_path


def reconstruct_from_scan(
    scan_path: str,
    output_dir: str,
    splat_output: str,
) -> dict:
    """Full pipeline: scan → structures → mesh + splat."""
    print(f"Loading volume: {scan_path}")
    volume, affine = load_volume(scan_path)
    print(f"Volume shape: {volume.shape}, range: [{volume.min():.0f}, {volume.max():.0f}]")

    print("Extracting structures...")
    structures = extract_structures(volume, affine)

    if not structures:
        raise RuntimeError("No structures extracted from scan")

    print("Exporting OBJ meshes...")
    mesh_paths = export_obj(structures, output_dir)

    print("Generating splat...")
    try:
        splat_path = export_splat(structures, splat_output)
    except Exception as e:
        print(f"Splat export failed: {e}, using mesh fallback")
        splat_path = None

    return {
        "structures": [{"name": s["name"], "vertices": s["vertex_count"], "faces": s["face_count"]} for s in structures],
        "mesh_paths": mesh_paths,
        "splat_path": splat_path,
    }
