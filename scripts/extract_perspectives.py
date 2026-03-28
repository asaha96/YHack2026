#!/usr/bin/env python3
"""
Extract multi-perspective renders from a CT/MRI NIfTI volume.
Orbits around the anatomy and saves ~50 perspective images.
These can be augmented with image-gen (Gemini/SDXL) for the Gaussian splat pipeline.
"""

import os
import json
import numpy as np
import sys

def extract_perspectives(nifti_path: str, output_dir: str, n_views: int = 50):
    import nibabel as nib
    from skimage.measure import marching_cubes
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection

    print(f"Loading volume: {nifti_path}")
    img = nib.load(nifti_path)
    vol = np.array(img.dataobj, dtype=np.float32)
    spacing = np.abs(np.diag(img.affine)[:3])

    print(f"Volume shape: {vol.shape}, spacing: {spacing}")

    # Extract isosurface
    print("Running marching cubes...")
    verts, faces, _, _ = marching_cubes(vol, level=0, spacing=tuple(spacing), step_size=2)
    center = verts.mean(axis=0)
    verts -= center

    os.makedirs(output_dir, exist_ok=True)
    metadata = []

    print(f"Rendering {n_views} perspectives...")
    for i in range(n_views):
        angle_h = (i / n_views) * 360
        angle_v = 20 + 15 * np.sin(i / n_views * 2 * np.pi)  # slight vertical oscillation

        fig = plt.figure(figsize=(8, 8), facecolor="black")
        ax = fig.add_subplot(111, projection="3d", facecolor="black")

        # Subsample faces for speed
        face_subset = faces[::max(1, len(faces) // 5000)]
        mesh = Poly3DCollection(verts[face_subset], alpha=0.7, edgecolor="none")
        mesh.set_facecolor((0.18, 0.83, 0.75, 0.6))  # teal
        ax.add_collection3d(mesh)

        # Set view angle
        ax.view_init(elev=angle_v, azim=angle_h)

        # Auto-scale
        max_range = np.max(verts.max(axis=0) - verts.min(axis=0)) / 2
        mid = np.zeros(3)
        ax.set_xlim(mid[0] - max_range, mid[0] + max_range)
        ax.set_ylim(mid[1] - max_range, mid[1] + max_range)
        ax.set_zlim(mid[2] - max_range, mid[2] + max_range)
        ax.set_axis_off()

        filename = f"view_{i:03d}.png"
        filepath = os.path.join(output_dir, filename)
        plt.savefig(filepath, dpi=150, bbox_inches="tight", pad_inches=0, facecolor="black")
        plt.close()

        metadata.append({
            "index": i,
            "file": filename,
            "azimuth": angle_h,
            "elevation": angle_v,
        })

        if (i + 1) % 10 == 0:
            print(f"  Rendered {i + 1}/{n_views}")

    # Save metadata
    meta_path = os.path.join(output_dir, "metadata.json")
    with open(meta_path, "w") as f:
        json.dump({"views": metadata, "total": n_views, "source": nifti_path}, f, indent=2)

    print(f"\nDone! {n_views} perspectives saved to {output_dir}")
    print(f"Metadata: {meta_path}")


if __name__ == "__main__":
    nifti = sys.argv[1] if len(sys.argv) > 1 else "data/sample_ct/sample_ct.nii.gz"
    outdir = sys.argv[2] if len(sys.argv) > 2 else "data/perspectives"
    views = int(sys.argv[3]) if len(sys.argv) > 3 else 50
    extract_perspectives(nifti, outdir, views)
