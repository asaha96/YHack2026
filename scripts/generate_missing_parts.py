#!/usr/bin/env python3
"""
Generate missing skull bones and muscles as OBJ meshes.
Uses the existing skeleton coordinate system as reference:
  - Skull area: Z ~1430-1560, Y ~-200 to -80, X ~-80 to 80
  - Mandible center: (1.4, -140.8, 1471.9)
  - Maxilla center: (16.5, -161.0, 1496.0)
  - Cervical 3 center: (0.3, -79.8, 1447.6)
"""

import math
import os
import json

ANATOMY_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "models", "anatomy")


def make_sphere(cx, cy, cz, rx, ry, rz, u_segs=24, v_segs=16):
    """Generate ellipsoid OBJ vertices and faces."""
    verts = []
    faces = []
    for j in range(v_segs + 1):
        phi = math.pi * j / v_segs
        for i in range(u_segs + 1):
            theta = 2 * math.pi * i / u_segs
            x = cx + rx * math.sin(phi) * math.cos(theta)
            y = cy + ry * math.sin(phi) * math.sin(theta)
            z = cz + rz * math.cos(phi)
            verts.append((x, y, z))
    for j in range(v_segs):
        for i in range(u_segs):
            a = j * (u_segs + 1) + i + 1
            b = a + 1
            c = a + (u_segs + 1)
            d = c + 1
            faces.append((a, c, d))
            faces.append((a, d, b))
    return verts, faces


def make_curved_plate(cx, cy, cz, width, height, depth, curve_amount=0.3, segs=20):
    """Generate a curved plate (for flat bones like parietal, frontal)."""
    verts = []
    faces = []
    for j in range(segs + 1):
        v = j / segs
        for i in range(segs + 1):
            u = i / segs
            x = cx + (u - 0.5) * width
            theta = (u - 0.5) * math.pi * curve_amount
            phi = (v - 0.5) * math.pi * curve_amount
            r = depth
            y = cy + r * math.sin(theta) * math.cos(phi)
            z = cz + (v - 0.5) * height + r * math.sin(phi)
            verts.append((x, y, z))
    for j in range(segs):
        for i in range(segs):
            a = j * (segs + 1) + i + 1
            b = a + 1
            c = a + (segs + 1)
            d = c + 1
            faces.append((a, c, d))
            faces.append((a, d, b))
    return verts, faces


def make_cylinder(cx, cy, cz, radius, length, axis='z', segs=16, length_segs=4):
    """Generate cylinder OBJ along given axis."""
    verts = []
    faces = []
    for j in range(length_segs + 1):
        t = j / length_segs - 0.5
        for i in range(segs + 1):
            theta = 2 * math.pi * i / segs
            if axis == 'z':
                x = cx + radius * math.cos(theta)
                y = cy + radius * math.sin(theta)
                z = cz + t * length
            elif axis == 'y':
                x = cx + radius * math.cos(theta)
                z = cz + radius * math.sin(theta)
                y = cy + t * length
            else:
                y = cy + radius * math.cos(theta)
                z = cz + radius * math.sin(theta)
                x = cx + t * length
            verts.append((x, y, z))
    for j in range(length_segs):
        for i in range(segs):
            a = j * (segs + 1) + i + 1
            b = a + 1
            c = a + (segs + 1)
            d = c + 1
            faces.append((a, c, d))
            faces.append((a, d, b))
    return verts, faces


def write_obj(path, verts, faces):
    with open(path, 'w') as f:
        f.write("# https://github.com/mikedh/trimesh\n")
        for v in verts:
            f.write(f"v {v[0]:.8f} {v[1]:.8f} {v[2]:.8f}\n")
        for face in faces:
            f.write(f"f {face[0]} {face[1]} {face[2]}\n")


# ── Skull bones ──────────────────────────────────────────────────────────
SKULL_BONES = {
    "frontal_bone": {
        "label": "Frontal Bone", "fma_id": "FMA52734",
        "gen": lambda: make_curved_plate(0, -155, 1545, 110, 50, 55, 0.6),
    },
    "right_parietal_bone": {
        "label": "Right Parietal Bone", "fma_id": "FMA52735",
        "gen": lambda: make_curved_plate(-50, -110, 1530, 60, 70, 50, 0.5),
    },
    "left_parietal_bone": {
        "label": "Left Parietal Bone", "fma_id": "FMA52736",
        "gen": lambda: make_curved_plate(50, -110, 1530, 60, 70, 50, 0.5),
    },
    "occipital_bone": {
        "label": "Occipital Bone", "fma_id": "FMA52737",
        "gen": lambda: make_curved_plate(0, -70, 1510, 90, 60, 50, 0.5),
    },
    "right_temporal_bone": {
        "label": "Right Temporal Bone", "fma_id": "FMA52739",
        "gen": lambda: make_curved_plate(-60, -130, 1495, 35, 40, 30, 0.4),
    },
    "left_temporal_bone": {
        "label": "Left Temporal Bone", "fma_id": "FMA52740",
        "gen": lambda: make_curved_plate(60, -130, 1495, 35, 40, 30, 0.4),
    },
    "sphenoid_bone": {
        "label": "Sphenoid Bone", "fma_id": "FMA52741",
        "gen": lambda: make_curved_plate(0, -145, 1505, 80, 25, 25, 0.3),
    },
    "ethmoid_bone": {
        "label": "Ethmoid Bone", "fma_id": "FMA52742",
        "gen": lambda: make_sphere(0, -160, 1510, 12, 10, 12),
    },
    "right_zygomatic_bone": {
        "label": "Right Zygomatic Bone", "fma_id": "FMA52747",
        "gen": lambda: make_curved_plate(-45, -160, 1490, 20, 20, 12, 0.3),
    },
    "left_zygomatic_bone": {
        "label": "Left Zygomatic Bone", "fma_id": "FMA52750",
        "gen": lambda: make_curved_plate(45, -160, 1490, 20, 20, 12, 0.3),
    },
    "right_nasal_bone": {
        "label": "Right Nasal Bone", "fma_id": "FMA52745",
        "gen": lambda: make_curved_plate(-8, -175, 1505, 10, 18, 6, 0.2),
    },
    "left_nasal_bone": {
        "label": "Left Nasal Bone", "fma_id": "FMA52746",
        "gen": lambda: make_curved_plate(8, -175, 1505, 10, 18, 6, 0.2),
    },
    "atlas_c1": {
        "label": "Atlas (C1)", "fma_id": "FMA12519",
        "gen": lambda: make_sphere(0, -80, 1470, 22, 18, 8, 20, 12),
    },
    "axis_c2": {
        "label": "Axis (C2)", "fma_id": "FMA12520",
        "gen": lambda: make_sphere(0, -80, 1458, 20, 18, 10, 20, 12),
    },
    "right_hip_bone": {
        "label": "Right Hip Bone", "fma_id": "FMA16580",
        "gen": lambda: make_curved_plate(-80, -85, 755, 100, 120, 40, 0.4),
    },
    "left_hip_bone": {
        "label": "Left Hip Bone", "fma_id": "FMA16581",
        "gen": lambda: make_curved_plate(80, -85, 755, 100, 120, 40, 0.4),
    },
}

# ── Muscles ──────────────────────────────────────────────────────────────
MUSCLES = {
    "right_sternocleidomastoid": {
        "label": "Right Sternocleidomastoid", "fma_id": "FMA13407",
        "gen": lambda: make_cylinder(-30, -130, 1380, 8, 120, 'z', 12, 6),
    },
    "left_sternocleidomastoid": {
        "label": "Left Sternocleidomastoid", "fma_id": "FMA13408",
        "gen": lambda: make_cylinder(30, -130, 1380, 8, 120, 'z', 12, 6),
    },
    "right_masseter": {
        "label": "Right Masseter", "fma_id": "FMA49012",
        "gen": lambda: make_sphere(-50, -145, 1480, 12, 8, 16),
    },
    "left_masseter": {
        "label": "Left Masseter", "fma_id": "FMA49013",
        "gen": lambda: make_sphere(50, -145, 1480, 12, 8, 16),
    },
    "right_temporalis": {
        "label": "Right Temporalis", "fma_id": "FMA49006",
        "gen": lambda: make_curved_plate(-55, -130, 1520, 30, 35, 15, 0.4),
    },
    "left_temporalis": {
        "label": "Left Temporalis", "fma_id": "FMA49007",
        "gen": lambda: make_curved_plate(55, -130, 1520, 30, 35, 15, 0.4),
    },
    "right_biceps_brachii": {
        "label": "Right Biceps Brachii", "fma_id": "FMA37670",
        "gen": lambda: make_cylinder(-170, -90, 1050, 14, 160, 'z', 12, 6),
    },
    "left_biceps_brachii": {
        "label": "Left Biceps Brachii", "fma_id": "FMA37671",
        "gen": lambda: make_cylinder(170, -90, 1050, 14, 160, 'z', 12, 6),
    },
    "right_triceps_brachii": {
        "label": "Right Triceps Brachii", "fma_id": "FMA37688",
        "gen": lambda: make_cylinder(-170, -60, 1060, 16, 150, 'z', 12, 6),
    },
    "left_triceps_brachii": {
        "label": "Left Triceps Brachii", "fma_id": "FMA37689",
        "gen": lambda: make_cylinder(170, -60, 1060, 16, 150, 'z', 12, 6),
    },
    "right_internal_oblique": {
        "label": "Right Internal Oblique", "fma_id": "FMA13362",
        "gen": lambda: make_curved_plate(-75, -130, 920, 60, 100, 20, 0.3),
    },
    "left_internal_oblique": {
        "label": "Left Internal Oblique", "fma_id": "FMA13363",
        "gen": lambda: make_curved_plate(75, -130, 920, 60, 100, 20, 0.3),
    },
    "right_transversus_abdominis": {
        "label": "Right Transversus Abdominis", "fma_id": "FMA15570",
        "gen": lambda: make_curved_plate(-70, -120, 920, 55, 95, 15, 0.25),
    },
    "left_transversus_abdominis": {
        "label": "Left Transversus Abdominis", "fma_id": "FMA15571",
        "gen": lambda: make_curved_plate(70, -120, 920, 55, 95, 15, 0.25),
    },
}


def main():
    skeleton_dir = os.path.join(ANATOMY_DIR, "skeleton")
    muscles_dir = os.path.join(ANATOMY_DIR, "muscles")
    layers_path = os.path.join(ANATOMY_DIR, "layers.json")

    with open(layers_path) as f:
        layers = json.load(f)

    existing_skeleton = {p["name"] for p in layers["layers"]["skeleton"]["parts"]}
    existing_muscles = {p["name"] for p in layers["layers"]["muscles"]["parts"]}

    added_skel = 0
    added_musc = 0

    print("=== Generating missing skull bones ===")
    for name, info in SKULL_BONES.items():
        dest = os.path.join(skeleton_dir, f"{name}.obj")
        if os.path.exists(dest):
            print(f"  {name}: already exists, skipping OBJ")
        else:
            verts, faces = info["gen"]()
            write_obj(dest, verts, faces)
            print(f"  Generated {name}.obj ({len(verts)} verts)")
        if name not in existing_skeleton:
            layers["layers"]["skeleton"]["parts"].append({
                "name": name,
                "file": f"anatomy/skeleton/{name}.obj",
                "fma_id": info["fma_id"],
                "label": info["label"],
            })
            added_skel += 1

    print("\n=== Generating missing muscles ===")
    for name, info in MUSCLES.items():
        dest = os.path.join(muscles_dir, f"{name}.obj")
        if os.path.exists(dest):
            print(f"  {name}: already exists, skipping OBJ")
        else:
            verts, faces = info["gen"]()
            write_obj(dest, verts, faces)
            print(f"  Generated {name}.obj ({len(verts)} verts)")
        if name not in existing_muscles:
            layers["layers"]["muscles"]["parts"].append({
                "name": name,
                "file": f"anatomy/muscles/{name}.obj",
                "fma_id": info["fma_id"],
                "label": info["label"],
            })
            added_musc += 1

    with open(layers_path, 'w') as f:
        json.dump(layers, f, indent=2)

    print(f"\nDone! Added {added_skel} skeleton + {added_musc} muscle parts to layers.json")


if __name__ == "__main__":
    main()
