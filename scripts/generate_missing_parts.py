#!/usr/bin/env python3
"""
Generate missing skull bones and muscles as OBJ meshes.
Coordinate system reference (from existing skeleton):
  - Mandible center: (1.4, -140.8, 1471.9), Z 1436-1516
  - Maxilla center: (16.5, -161.0, 1496.0), Z 1475-1541
  - Cervical 3 center: (0.3, -79.8, 1447.6)
  - Left tibia: center (74, -67, 274), Z 60-406, X 38-114
  - Right tibia: center (-78, -68, 281), Z 60-406, X -115 to -39
  - Left femur: center (89, -80, 627), Z 403-843
  - Left fibula: center (107, -54, 216), Z 40-391
  - Y axis: negative = anterior (front), positive = posterior (back)
  - X axis: positive = left, negative = right
  - Z axis: up (feet ~40, head ~1540)
"""

import math
import os
import json

ANATOMY_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "models", "anatomy")

# Skull dome center estimate: midpoint above mandible/maxilla
# Face front is at Y ~ -180, back of head at Y ~ -60
# Top of head should be at Z ~ 1580+
SKULL_CX, SKULL_CY, SKULL_CZ = 0, -120, 1510
SKULL_RX, SKULL_RY, SKULL_RZ = 72, 80, 72  # ellipsoid radii for cranium


def make_dome_section(cx, cy, cz, rx, ry, rz, phi_start, phi_end, theta_start, theta_end, u_segs=24, v_segs=16):
    """Generate a section of an ellipsoid dome as OBJ geometry.
    phi: 0=top, pi=bottom (polar angle)
    theta: 0 to 2pi (azimuthal angle)
    """
    verts = []
    faces = []
    for j in range(v_segs + 1):
        phi = phi_start + (phi_end - phi_start) * j / v_segs
        for i in range(u_segs + 1):
            theta = theta_start + (theta_end - theta_start) * i / u_segs
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


def make_sphere(cx, cy, cz, rx, ry, rz, u_segs=20, v_segs=12):
    """Generate full ellipsoid."""
    return make_dome_section(cx, cy, cz, rx, ry, rz, 0, math.pi, 0, 2 * math.pi, u_segs, v_segs)


def make_tapered_cylinder(cx, cy, cz, r_top, r_bot, length, axis='z', segs=14, length_segs=8):
    """Generate tapered cylinder (muscle shape) along given axis."""
    verts = []
    faces = []
    for j in range(length_segs + 1):
        t = j / length_segs
        r = r_top + (r_bot - r_top) * t
        pos_along = (t - 0.5) * length
        # Add slight belly in the middle
        belly = 1.0 + 0.15 * math.sin(t * math.pi)
        r *= belly
        for i in range(segs + 1):
            theta = 2 * math.pi * i / segs
            if axis == 'z':
                x = cx + r * math.cos(theta)
                y = cy + r * math.sin(theta)
                z = cz + pos_along
            elif axis == 'y':
                x = cx + r * math.cos(theta)
                z = cz + r * math.sin(theta)
                y = cy + pos_along
            else:
                y = cy + r * math.cos(theta)
                z = cz + r * math.sin(theta)
                x = cx + pos_along
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


# ── Skull bones as dome sections ─────────────────────────────────────────
# The cranium is an ellipsoid centered at (0, -120, 1510) with radii (72, 80, 72)
# phi: 0 = top of head, pi/2 = equator (ear level)
# theta: -pi/2 = front (face), pi/2 = back, 0 = right, pi = left

SKULL_BONES = {
    # Top of skull - the "cap" (frontal to mid-parietal)
    "frontal_bone": {
        "label": "Frontal Bone", "fma_id": "FMA52734",
        # Front upper dome: top to ~40deg, front half
        "gen": lambda: make_dome_section(SKULL_CX, SKULL_CY, SKULL_CZ, SKULL_RX, SKULL_RY, SKULL_RZ,
                                          0.05, 0.65, -2.4, -0.7, 28, 16),
    },
    "right_parietal_bone": {
        "label": "Right Parietal Bone", "fma_id": "FMA52735",
        # Right side dome
        "gen": lambda: make_dome_section(SKULL_CX, SKULL_CY, SKULL_CZ, SKULL_RX, SKULL_RY, SKULL_RZ,
                                          0.05, 0.75, -0.7, 0.7, 20, 14),
    },
    "left_parietal_bone": {
        "label": "Left Parietal Bone", "fma_id": "FMA52736",
        # Left side dome (mirror of right)
        "gen": lambda: make_dome_section(SKULL_CX, SKULL_CY, SKULL_CZ, SKULL_RX, SKULL_RY, SKULL_RZ,
                                          0.05, 0.75, 2.4, 3.85, 20, 14),
    },
    "occipital_bone": {
        "label": "Occipital Bone", "fma_id": "FMA52737",
        # Back of skull
        "gen": lambda: make_dome_section(SKULL_CX, SKULL_CY, SKULL_CZ, SKULL_RX, SKULL_RY, SKULL_RZ,
                                          0.1, 0.85, 0.7, 2.4, 22, 14),
    },
    "right_temporal_bone": {
        "label": "Right Temporal Bone", "fma_id": "FMA52739",
        # Right lower side (ear area)
        "gen": lambda: make_dome_section(SKULL_CX, SKULL_CY, SKULL_CZ, SKULL_RX, SKULL_RY, SKULL_RZ,
                                          0.65, 1.1, -0.5, 0.5, 14, 10),
    },
    "left_temporal_bone": {
        "label": "Left Temporal Bone", "fma_id": "FMA52740",
        # Left lower side (ear area)
        "gen": lambda: make_dome_section(SKULL_CX, SKULL_CY, SKULL_CZ, SKULL_RX, SKULL_RY, SKULL_RZ,
                                          0.65, 1.1, 2.6, 3.65, 14, 10),
    },
    "sphenoid_bone": {
        "label": "Sphenoid Bone", "fma_id": "FMA52741",
        # Behind eye sockets, spans both sides
        "gen": lambda: make_dome_section(SKULL_CX, SKULL_CY, SKULL_CZ,
                                          SKULL_RX * 0.85, SKULL_RY * 0.85, SKULL_RZ * 0.85,
                                          0.7, 1.05, -1.8, -0.5, 16, 8),
    },
    "ethmoid_bone": {
        "label": "Ethmoid Bone", "fma_id": "FMA52742",
        # Small bone between eyes/nose
        "gen": lambda: make_sphere(0, -165, 1510, 10, 8, 10, 12, 8),
    },
    "right_zygomatic_bone": {
        "label": "Right Zygomatic Bone", "fma_id": "FMA52747",
        # Cheekbone right
        "gen": lambda: make_sphere(-48, -160, 1488, 14, 8, 10, 12, 8),
    },
    "left_zygomatic_bone": {
        "label": "Left Zygomatic Bone", "fma_id": "FMA52750",
        # Cheekbone left
        "gen": lambda: make_sphere(48, -160, 1488, 14, 8, 10, 12, 8),
    },
    "right_nasal_bone": {
        "label": "Right Nasal Bone", "fma_id": "FMA52745",
        "gen": lambda: make_sphere(-7, -178, 1508, 7, 5, 12, 10, 8),
    },
    "left_nasal_bone": {
        "label": "Left Nasal Bone", "fma_id": "FMA52746",
        "gen": lambda: make_sphere(7, -178, 1508, 7, 5, 12, 10, 8),
    },
    "atlas_c1": {
        "label": "Atlas (C1)", "fma_id": "FMA12519",
        "gen": lambda: make_sphere(0, -80, 1470, 22, 18, 8, 16, 10),
    },
    "axis_c2": {
        "label": "Axis (C2)", "fma_id": "FMA12520",
        "gen": lambda: make_sphere(0, -80, 1458, 20, 18, 10, 16, 10),
    },
    "right_hip_bone": {
        "label": "Right Hip Bone", "fma_id": "FMA16580",
        "gen": lambda: make_dome_section(-85, -80, 755, 55, 40, 65, 0.3, 1.5, -1.5, 1.5, 20, 14),
    },
    "left_hip_bone": {
        "label": "Left Hip Bone", "fma_id": "FMA16581",
        "gen": lambda: make_dome_section(85, -80, 755, 55, 40, 65, 0.3, 1.5, -1.5, 1.5, 20, 14),
    },
}

# ── Muscles ──────────────────────────────────────────────────────────────
# Lower leg reference:
#   Left tibia: center (74, -67, 274), Z 60-406
#   Right tibia: center (-78, -68, 281), Z 60-406
#   Left fibula: center (107, -54, 216), Z 40-391
#   Right fibula: center (-108, -54, 218), Z 40-391
# Upper leg reference:
#   Left femur: center (89, -80, 627), Z 403-843
#   Left rectus femoris: center (99, -121, 618), Z 346-874

MUSCLES = {
    # ── Head/neck ──
    "right_sternocleidomastoid": {
        "label": "Right Sternocleidomastoid", "fma_id": "FMA13407",
        "gen": lambda: make_tapered_cylinder(-30, -135, 1380, 7, 9, 110, 'z'),
    },
    "left_sternocleidomastoid": {
        "label": "Left Sternocleidomastoid", "fma_id": "FMA13408",
        "gen": lambda: make_tapered_cylinder(30, -135, 1380, 7, 9, 110, 'z'),
    },
    "right_masseter": {
        "label": "Right Masseter", "fma_id": "FMA49012",
        "gen": lambda: make_sphere(-50, -148, 1478, 11, 7, 15),
    },
    "left_masseter": {
        "label": "Left Masseter", "fma_id": "FMA49013",
        "gen": lambda: make_sphere(50, -148, 1478, 11, 7, 15),
    },
    "right_temporalis": {
        "label": "Right Temporalis", "fma_id": "FMA49006",
        "gen": lambda: make_dome_section(-55, -130, 1515, 22, 15, 28, 0.2, 1.0, -1.0, 0.8, 14, 10),
    },
    "left_temporalis": {
        "label": "Left Temporalis", "fma_id": "FMA49007",
        "gen": lambda: make_dome_section(55, -130, 1515, 22, 15, 28, 0.2, 1.0, -1.0, 0.8, 14, 10),
    },
    # ── Arms ──
    "right_biceps_brachii": {
        "label": "Right Biceps Brachii", "fma_id": "FMA37670",
        "gen": lambda: make_tapered_cylinder(-168, -105, 1050, 12, 10, 155, 'z'),
    },
    "left_biceps_brachii": {
        "label": "Left Biceps Brachii", "fma_id": "FMA37671",
        "gen": lambda: make_tapered_cylinder(168, -105, 1050, 12, 10, 155, 'z'),
    },
    "right_triceps_brachii": {
        "label": "Right Triceps Brachii", "fma_id": "FMA37688",
        "gen": lambda: make_tapered_cylinder(-168, -65, 1060, 14, 11, 145, 'z'),
    },
    "left_triceps_brachii": {
        "label": "Left Triceps Brachii", "fma_id": "FMA37689",
        "gen": lambda: make_tapered_cylinder(168, -65, 1060, 14, 11, 145, 'z'),
    },
    # ── Torso ──
    "right_internal_oblique": {
        "label": "Right Internal Oblique", "fma_id": "FMA13362",
        "gen": lambda: make_dome_section(-65, -130, 920, 35, 20, 55, 0.3, 1.2, -1.5, 1.5, 16, 10),
    },
    "left_internal_oblique": {
        "label": "Left Internal Oblique", "fma_id": "FMA13363",
        "gen": lambda: make_dome_section(65, -130, 920, 35, 20, 55, 0.3, 1.2, -1.5, 1.5, 16, 10),
    },
    "right_transversus_abdominis": {
        "label": "Right Transversus Abdominis", "fma_id": "FMA15570",
        "gen": lambda: make_dome_section(-60, -120, 920, 30, 18, 50, 0.35, 1.15, -1.4, 1.4, 14, 10),
    },
    "left_transversus_abdominis": {
        "label": "Left Transversus Abdominis", "fma_id": "FMA15571",
        "gen": lambda: make_dome_section(60, -120, 920, 30, 18, 50, 0.35, 1.15, -1.4, 1.4, 14, 10),
    },

    # ── Upper leg / Hamstrings ──
    "right_biceps_femoris": {
        "label": "Right Biceps Femoris", "fma_id": "FMA22356",
        # Posterior thigh, lateral side
        "gen": lambda: make_tapered_cylinder(-100, -50, 620, 16, 12, 200, 'z'),
    },
    "left_biceps_femoris": {
        "label": "Left Biceps Femoris", "fma_id": "FMA22357",
        "gen": lambda: make_tapered_cylinder(100, -50, 620, 16, 12, 200, 'z'),
    },
    "right_semitendinosus": {
        "label": "Right Semitendinosus", "fma_id": "FMA22438",
        # Posterior thigh, medial
        "gen": lambda: make_tapered_cylinder(-75, -45, 610, 12, 9, 210, 'z'),
    },
    "left_semitendinosus": {
        "label": "Left Semitendinosus", "fma_id": "FMA22439",
        "gen": lambda: make_tapered_cylinder(75, -45, 610, 12, 9, 210, 'z'),
    },
    "right_semimembranosus": {
        "label": "Right Semimembranosus", "fma_id": "FMA22357",
        # Deep posterior thigh
        "gen": lambda: make_tapered_cylinder(-82, -42, 615, 14, 10, 200, 'z'),
    },
    "left_semimembranosus": {
        "label": "Left Semimembranosus", "fma_id": "FMA22358",
        "gen": lambda: make_tapered_cylinder(82, -42, 615, 14, 10, 200, 'z'),
    },
    "right_vastus_lateralis": {
        "label": "Right Vastus Lateralis", "fma_id": "FMA22431",
        # Lateral thigh (outer quad)
        "gen": lambda: make_tapered_cylinder(-110, -110, 615, 18, 14, 210, 'z'),
    },
    "left_vastus_lateralis": {
        "label": "Left Vastus Lateralis", "fma_id": "FMA22432",
        "gen": lambda: make_tapered_cylinder(110, -110, 615, 18, 14, 210, 'z'),
    },
    "right_vastus_medialis": {
        "label": "Right Vastus Medialis", "fma_id": "FMA22433",
        # Medial thigh (inner quad, teardrop)
        "gen": lambda: make_tapered_cylinder(-68, -115, 580, 15, 12, 180, 'z'),
    },
    "left_vastus_medialis": {
        "label": "Left Vastus Medialis", "fma_id": "FMA22434",
        "gen": lambda: make_tapered_cylinder(68, -115, 580, 15, 12, 180, 'z'),
    },
    "right_sartorius": {
        "label": "Right Sartorius", "fma_id": "FMA22353",
        # Longest muscle, diagonal across thigh
        "gen": lambda: make_tapered_cylinder(-80, -130, 620, 8, 6, 230, 'z'),
    },
    "left_sartorius": {
        "label": "Left Sartorius", "fma_id": "FMA22354",
        "gen": lambda: make_tapered_cylinder(80, -130, 620, 8, 6, 230, 'z'),
    },
    "right_adductor_magnus": {
        "label": "Right Adductor Magnus", "fma_id": "FMA22441",
        # Inner thigh, large
        "gen": lambda: make_tapered_cylinder(-65, -85, 630, 20, 14, 190, 'z'),
    },
    "left_adductor_magnus": {
        "label": "Left Adductor Magnus", "fma_id": "FMA22442",
        "gen": lambda: make_tapered_cylinder(65, -85, 630, 20, 14, 190, 'z'),
    },

    # ── Lower leg / Calf ──
    "right_gastrocnemius": {
        "label": "Right Gastrocnemius", "fma_id": "FMA22541",
        # Main calf muscle, posterior, Z 180-400 (upper 2/3 of tibia range)
        "gen": lambda: make_tapered_cylinder(-80, -45, 310, 18, 10, 180, 'z'),
    },
    "left_gastrocnemius": {
        "label": "Left Gastrocnemius", "fma_id": "FMA22542",
        "gen": lambda: make_tapered_cylinder(80, -45, 310, 18, 10, 180, 'z'),
    },
    "right_soleus": {
        "label": "Right Soleus", "fma_id": "FMA22543",
        # Deep calf, under gastrocnemius
        "gen": lambda: make_tapered_cylinder(-80, -52, 270, 16, 8, 170, 'z'),
    },
    "left_soleus": {
        "label": "Left Soleus", "fma_id": "FMA22544",
        "gen": lambda: make_tapered_cylinder(80, -52, 270, 16, 8, 170, 'z'),
    },
    "right_tibialis_anterior": {
        "label": "Right Tibialis Anterior", "fma_id": "FMA22532",
        # Front of shin, lateral to tibia
        "gen": lambda: make_tapered_cylinder(-90, -90, 280, 12, 7, 180, 'z'),
    },
    "left_tibialis_anterior": {
        "label": "Left Tibialis Anterior", "fma_id": "FMA22533",
        "gen": lambda: make_tapered_cylinder(90, -90, 280, 12, 7, 180, 'z'),
    },
    "right_peroneus_longus": {
        "label": "Right Peroneus Longus", "fma_id": "FMA22539",
        # Lateral lower leg (along fibula)
        "gen": lambda: make_tapered_cylinder(-108, -65, 270, 10, 6, 170, 'z'),
    },
    "left_peroneus_longus": {
        "label": "Left Peroneus Longus", "fma_id": "FMA22540",
        "gen": lambda: make_tapered_cylinder(108, -65, 270, 10, 6, 170, 'z'),
    },
    "right_tibialis_posterior": {
        "label": "Right Tibialis Posterior", "fma_id": "FMA22599",
        # Deep posterior lower leg
        "gen": lambda: make_tapered_cylinder(-82, -55, 260, 10, 6, 160, 'z'),
    },
    "left_tibialis_posterior": {
        "label": "Left Tibialis Posterior", "fma_id": "FMA22600",
        "gen": lambda: make_tapered_cylinder(82, -55, 260, 10, 6, 160, 'z'),
    },

    # ── Forearms ──
    "right_brachioradialis": {
        "label": "Right Brachioradialis", "fma_id": "FMA38485",
        # Lateral forearm
        "gen": lambda: make_tapered_cylinder(-175, -95, 930, 10, 6, 130, 'z'),
    },
    "left_brachioradialis": {
        "label": "Left Brachioradialis", "fma_id": "FMA38486",
        "gen": lambda: make_tapered_cylinder(175, -95, 930, 10, 6, 130, 'z'),
    },
    "right_flexor_carpi": {
        "label": "Right Flexor Carpi", "fma_id": "FMA38459",
        # Medial forearm
        "gen": lambda: make_tapered_cylinder(-170, -110, 925, 9, 5, 125, 'z'),
    },
    "left_flexor_carpi": {
        "label": "Left Flexor Carpi", "fma_id": "FMA38460",
        "gen": lambda: make_tapered_cylinder(170, -110, 925, 9, 5, 125, 'z'),
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

    print("=== Generating skull bones ===")
    for name, info in SKULL_BONES.items():
        dest = os.path.join(skeleton_dir, f"{name}.obj")
        # Always regenerate to get improved geometry
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

    print("\n=== Generating muscles ===")
    for name, info in MUSCLES.items():
        dest = os.path.join(muscles_dir, f"{name}.obj")
        # Always regenerate
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

    print(f"\nDone! Added {added_skel} new skeleton + {added_musc} new muscle parts to layers.json")


if __name__ == "__main__":
    main()
