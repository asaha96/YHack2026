#!/usr/bin/env python3
"""
Download a sample TotalSegmentator CT scan dataset.
For hackathon purposes, we generate synthetic organ meshes
since downloading real CT data requires significant time and storage.
"""

import json
import os
import numpy as np

# We'll generate procedural organ meshes for the demo
# In production, you'd use TotalSegmentator's pre-segmented data

ORGANS = {
    "liver": {"color": "#8B4513", "position": [0, 0.5, 0.2], "scale": [1.2, 0.8, 0.7]},
    "left_kidney": {"color": "#CD5C5C", "position": [-0.8, -0.2, -0.3], "scale": [0.3, 0.5, 0.25]},
    "right_kidney": {"color": "#CD5C5C", "position": [0.8, -0.2, -0.3], "scale": [0.3, 0.5, 0.25]},
    "spleen": {"color": "#800020", "position": [-1.0, 0.3, 0.1], "scale": [0.4, 0.6, 0.3]},
    "stomach": {"color": "#DEB887", "position": [-0.3, 0.8, 0.5], "scale": [0.6, 0.5, 0.4]},
    "pancreas": {"color": "#F5DEB3", "position": [0.0, -0.1, -0.1], "scale": [0.8, 0.15, 0.2]},
    "aorta": {"color": "#FF0000", "position": [0.0, 0.0, -0.5], "scale": [0.12, 2.0, 0.12]},
    "portal_vein": {"color": "#4169E1", "position": [0.15, 0.3, 0.0], "scale": [0.08, 0.8, 0.08]},
    "spine": {"color": "#FFFFF0", "position": [0.0, 0.0, -0.7], "scale": [0.2, 2.5, 0.2]},
}


def generate_ellipsoid_obj(name: str, position: list, scale: list, segments: int = 24) -> str:
    """Generate an OBJ file string for an ellipsoid organ."""
    vertices = []
    faces = []

    for i in range(segments + 1):
        lat = np.pi * (-0.5 + i / segments)
        for j in range(segments + 1):
            lon = 2 * np.pi * j / segments
            x = position[0] + scale[0] * np.cos(lat) * np.cos(lon)
            y = position[1] + scale[1] * np.sin(lat)
            z = position[2] + scale[2] * np.cos(lat) * np.sin(lon)
            nx = np.cos(lat) * np.cos(lon)
            ny = np.sin(lat)
            nz = np.cos(lat) * np.sin(lon)
            vertices.append(f"v {x:.4f} {y:.4f} {z:.4f}")
            vertices.append(f"vn {nx:.4f} {ny:.4f} {nz:.4f}")

    for i in range(segments):
        for j in range(segments):
            a = i * (segments + 1) + j + 1
            b = a + segments + 1
            faces.append(f"f {a}//{a} {b}//{b} {a+1}//{a+1}")
            faces.append(f"f {b}//{b} {b+1}//{b+1} {a+1}//{a+1}")

    return f"# {name}\n" + "\n".join(vertices) + "\n" + "\n".join(faces) + "\n"


def main():
    output_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "models")
    os.makedirs(output_dir, exist_ok=True)

    metadata = {}
    for name, props in ORGANS.items():
        obj_content = generate_ellipsoid_obj(name, props["position"], props["scale"])
        filepath = os.path.join(output_dir, f"{name}.obj")
        with open(filepath, "w") as f:
            f.write(obj_content)
        metadata[name] = {
            "file": f"{name}.obj",
            "color": props["color"],
            "position": props["position"],
            "label": name.replace("_", " ").title(),
        }
        print(f"Generated {name}.obj")

    meta_path = os.path.join(output_dir, "metadata.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"\nMetadata written to {meta_path}")
    print(f"Generated {len(ORGANS)} organ meshes")


if __name__ == "__main__":
    main()
