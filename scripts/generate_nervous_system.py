#!/usr/bin/env python3
"""
Generate nervous system OBJ meshes and add as a new layer.
Coordinate reference (from existing skeleton):
  Skull center: (0, -120, 1510)
  Cervical 3: (0.3, -79.8, 1447.6)
  Thoracic 1: (-2.6, -61.6, 1379.0)
  Thoracic 6: (-2.1, -27.4, 1267.5)
  Thoracic 12: (-0.9, -58.1, 1093.4)
  Lumbar 1: (-1.0, -65.6, 1060.0)
  Lumbar 5: (1.2, -67.3, 941.6)
  Sacrum: (2.1, -43.4, 880.0)
  Left femur center: (89, -80, 627), Z 403-843
  Left tibia center: (74, -67, 274), Z 60-406
  Left humerus approx: (-168, -85, 1050), Z ~970-1130
"""

import math
import os
import json

ANATOMY_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "models", "anatomy")
NERVOUS_DIR = os.path.join(ANATOMY_DIR, "nervous")


def write_obj(path, verts, faces):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write("# https://github.com/mikedh/trimesh\n")
        for v in verts:
            f.write(f"v {v[0]:.8f} {v[1]:.8f} {v[2]:.8f}\n")
        for face in faces:
            f.write(f"f {face[0]} {face[1]} {face[2]}\n")


def make_sphere(cx, cy, cz, rx, ry, rz, u_segs=16, v_segs=10):
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


def make_tube_along_path(path_pts, radius, segs=8):
    """Generate a tube mesh following a 3D path (list of (x,y,z) tuples)."""
    verts = []
    faces = []
    n = len(path_pts)

    for pi in range(n):
        p = path_pts[pi]
        # Compute tangent
        if pi == 0:
            tangent = (path_pts[1][0] - p[0], path_pts[1][1] - p[1], path_pts[1][2] - p[2])
        elif pi == n - 1:
            tangent = (p[0] - path_pts[pi-1][0], p[1] - path_pts[pi-1][1], p[2] - path_pts[pi-1][2])
        else:
            tangent = (path_pts[pi+1][0] - path_pts[pi-1][0],
                       path_pts[pi+1][1] - path_pts[pi-1][1],
                       path_pts[pi+1][2] - path_pts[pi-1][2])

        # Normalize tangent
        tlen = math.sqrt(tangent[0]**2 + tangent[1]**2 + tangent[2]**2)
        if tlen < 1e-8:
            tangent = (0, 0, 1)
            tlen = 1
        t = (tangent[0]/tlen, tangent[1]/tlen, tangent[2]/tlen)

        # Find perpendicular vectors
        if abs(t[2]) < 0.9:
            up = (0, 0, 1)
        else:
            up = (1, 0, 0)
        # Cross product: normal = t x up
        nx = t[1]*up[2] - t[2]*up[1]
        ny = t[2]*up[0] - t[0]*up[2]
        nz = t[0]*up[1] - t[1]*up[0]
        nlen = math.sqrt(nx*nx + ny*ny + nz*nz)
        if nlen < 1e-8:
            nx, ny, nz = 1, 0, 0
            nlen = 1
        nx /= nlen; ny /= nlen; nz /= nlen

        # Binormal = t x n
        bx = t[1]*nz - t[2]*ny
        by = t[2]*nx - t[0]*nz
        bz = t[0]*ny - t[1]*nx

        # Taper radius slightly at ends
        taper = 1.0
        if pi < 3:
            taper = 0.5 + 0.5 * (pi / 3)
        elif pi > n - 4:
            taper = 0.5 + 0.5 * ((n - 1 - pi) / 3)
        r = radius * taper

        for i in range(segs + 1):
            theta = 2 * math.pi * i / segs
            ct = math.cos(theta)
            st = math.sin(theta)
            vx = p[0] + r * (ct * nx + st * bx)
            vy = p[1] + r * (ct * ny + st * by)
            vz = p[2] + r * (ct * nz + st * bz)
            verts.append((vx, vy, vz))

    for j in range(n - 1):
        for i in range(segs):
            a = j * (segs + 1) + i + 1
            b = a + 1
            c = a + (segs + 1)
            d = c + 1
            faces.append((a, c, d))
            faces.append((a, d, b))

    return verts, faces


def lerp_path(points, num_segments=20):
    """Interpolate between keypoints with smooth curves."""
    if len(points) <= 1:
        return points
    result = []
    for i in range(len(points) - 1):
        p0 = points[i]
        p1 = points[i + 1]
        steps = max(2, num_segments // (len(points) - 1))
        for s in range(steps):
            t = s / steps
            # Smooth step
            t = t * t * (3 - 2 * t)
            result.append((
                p0[0] + (p1[0] - p0[0]) * t,
                p0[1] + (p1[1] - p0[1]) * t,
                p0[2] + (p1[2] - p0[2]) * t,
            ))
    result.append(points[-1])
    return result


# ── Nerve definitions ────────────────────────────────────────────────────

# Spine path (posterior midline, slightly behind vertebral centers)
SPINE_PATH = [
    (0, -75, 1470),   # top of C-spine (base of skull)
    (0, -75, 1448),   # C3
    (0, -65, 1420),   # C5
    (-1, -58, 1379),  # T1
    (-2, -35, 1320),  # T3
    (-2, -27, 1268),  # T6
    (-1, -40, 1180),  # T9
    (-1, -58, 1093),  # T12
    (-1, -66, 1060),  # L1
    (0, -67, 1000),   # L3
    (1, -67, 942),    # L5
    (2, -50, 890),    # S1
    (2, -43, 860),    # S3
]


def gen_brain():
    """Brain: cerebrum (two hemispheres) + cerebellum + brainstem."""
    all_verts = []
    all_faces = []
    offset = 0

    # Left cerebral hemisphere
    v, f = make_sphere(-18, -115, 1530, 50, 55, 45, 20, 14)
    all_verts.extend(v)
    all_faces.extend(f)
    offset += len(v)

    # Right cerebral hemisphere
    v, f = make_sphere(18, -115, 1530, 50, 55, 45, 20, 14)
    all_verts.extend(v)
    all_faces.extend([(a+offset, b+offset, c+offset) for a, b, c in f])
    offset += len(v)

    # Cerebellum (posterior, lower)
    v, f = make_sphere(0, -80, 1490, 35, 30, 22, 16, 10)
    all_verts.extend(v)
    all_faces.extend([(a+offset, b+offset, c+offset) for a, b, c in f])
    offset += len(v)

    # Brainstem
    v, f = make_tube_along_path(
        lerp_path([(0, -85, 1500), (0, -80, 1485), (0, -78, 1470)], 10),
        6, 8
    )
    all_verts.extend(v)
    all_faces.extend([(a+offset, b+offset, c+offset) for a, b, c in f])

    return all_verts, all_faces


def gen_spinal_cord():
    """Spinal cord running through vertebral column."""
    path = lerp_path(SPINE_PATH, 60)
    return make_tube_along_path(path, 4.5, 8)


def gen_nerve_pair(name, keypoints_left, radius=2.0):
    """Generate a left and right nerve from keypoints (left side given, right mirrored)."""
    left_path = lerp_path(keypoints_left, 16)
    right_path = [(- x, y, z) for x, y, z in left_path]
    left_v, left_f = make_tube_along_path(left_path, radius, 6)
    right_v, right_f = make_tube_along_path(right_path, radius, 6)
    return (left_v, left_f), (right_v, right_f)


# Major nerve definitions (left side keypoints — right side is mirrored)
NERVE_PAIRS = {
    # ── Cervical / Brachial Plexus → Arm Nerves ──
    "median_nerve": {
        "label": "Median Nerve", "fma_id": "FMA14385",
        "path": [(8, -60, 1400), (25, -65, 1350), (60, -75, 1280),
                 (120, -85, 1180), (155, -90, 1100), (168, -100, 1000),
                 (172, -105, 920), (175, -110, 860)],
        "radius": 2.0,
    },
    "ulnar_nerve": {
        "label": "Ulnar Nerve", "fma_id": "FMA14386",
        "path": [(8, -55, 1395), (22, -55, 1340), (55, -60, 1270),
                 (115, -65, 1180), (150, -68, 1100), (165, -72, 1000),
                 (170, -80, 920), (173, -85, 860)],
        "radius": 1.8,
    },
    "radial_nerve": {
        "label": "Radial Nerve", "fma_id": "FMA14387",
        "path": [(8, -58, 1398), (28, -50, 1340), (65, -50, 1270),
                 (125, -55, 1180), (158, -60, 1100), (170, -65, 1000),
                 (175, -75, 920), (178, -80, 860)],
        "radius": 1.8,
    },
    "musculocutaneous_nerve": {
        "label": "Musculocutaneous Nerve", "fma_id": "FMA14136",
        "path": [(8, -63, 1390), (30, -70, 1330), (65, -85, 1260),
                 (120, -95, 1180), (155, -100, 1100), (165, -105, 1020)],
        "radius": 1.5,
    },
    # ── Thoracic Intercostal Nerves ──
    "intercostal_nerve_t6": {
        "label": "Intercostal Nerve T6", "fma_id": "FMA14250",
        "path": [(3, -30, 1268), (20, -50, 1265), (50, -80, 1260),
                 (80, -120, 1255), (100, -145, 1250)],
        "radius": 1.2,
    },
    "intercostal_nerve_t10": {
        "label": "Intercostal Nerve T10", "fma_id": "FMA14254",
        "path": [(2, -45, 1150), (20, -65, 1148), (50, -95, 1145),
                 (80, -130, 1140), (100, -155, 1135)],
        "radius": 1.2,
    },
    # ── Lumbar Plexus ──
    "femoral_nerve": {
        "label": "Femoral Nerve", "fma_id": "FMA16263",
        "path": [(3, -67, 1000), (15, -75, 950), (30, -85, 900),
                 (50, -95, 850), (70, -105, 780), (85, -115, 700),
                 (90, -120, 620), (92, -125, 540), (90, -120, 460)],
        "radius": 2.5,
    },
    "obturator_nerve": {
        "label": "Obturator Nerve", "fma_id": "FMA16264",
        "path": [(3, -65, 990), (12, -72, 940), (25, -78, 890),
                 (40, -82, 840), (55, -85, 780), (65, -88, 720)],
        "radius": 1.5,
    },
    # ── Sacral Plexus ──
    "sciatic_nerve": {
        "label": "Sciatic Nerve", "fma_id": "FMA19034",
        "path": [(3, -50, 880), (15, -50, 840), (35, -48, 800),
                 (60, -50, 750), (80, -55, 680), (88, -58, 600),
                 (85, -60, 520), (82, -62, 450), (80, -63, 410)],
        "radius": 3.5,
    },
    "tibial_nerve": {
        "label": "Tibial Nerve", "fma_id": "FMA19035",
        # Continues from sciatic, posterior leg
        "path": [(80, -58, 410), (78, -55, 360), (76, -50, 300),
                 (75, -48, 240), (74, -50, 180), (73, -55, 120),
                 (72, -58, 70)],
        "radius": 2.2,
    },
    "common_peroneal_nerve": {
        "label": "Common Peroneal Nerve", "fma_id": "FMA19036",
        # Branches from sciatic, wraps around fibula head
        "path": [(80, -58, 410), (85, -60, 380), (95, -65, 350),
                 (105, -68, 310), (100, -75, 270), (92, -82, 220),
                 (88, -85, 170)],
        "radius": 1.8,
    },
    # ── Head Nerves ──
    "trigeminal_nerve": {
        "label": "Trigeminal Nerve (V)", "fma_id": "FMA50866",
        "path": [(5, -100, 1495), (15, -120, 1500), (30, -145, 1505),
                 (45, -165, 1498), (55, -175, 1485)],
        "radius": 1.5,
    },
    "facial_nerve": {
        "label": "Facial Nerve (VII)", "fma_id": "FMA50867",
        "path": [(5, -95, 1490), (12, -110, 1488), (25, -130, 1485),
                 (40, -150, 1480), (50, -160, 1472)],
        "radius": 1.2,
    },
    "vagus_nerve": {
        "label": "Vagus Nerve (X)", "fma_id": "FMA50870",
        # Longest cranial nerve — runs from brainstem down through neck/thorax/abdomen
        "path": [(5, -82, 1480), (8, -85, 1440), (10, -90, 1380),
                 (10, -95, 1300), (8, -100, 1200), (6, -105, 1100),
                 (5, -110, 1000), (4, -115, 920)],
        "radius": 1.5,
    },
}

# Single-part nerves (not paired)
SINGLE_NERVES = {
    "cauda_equina": {
        "label": "Cauda Equina", "fma_id": "FMA72486",
        "gen": lambda: make_tube_along_path(
            lerp_path([(1, -67, 942), (2, -60, 910), (2, -50, 880), (3, -45, 850), (5, -42, 820)], 16),
            5.0, 8
        ),
    },
}


def main():
    layers_path = os.path.join(ANATOMY_DIR, "layers.json")
    with open(layers_path) as f:
        layers = json.load(f)

    # Add nervous system layer if it doesn't exist
    if "nervous" not in layers["layers"]:
        layers["layers"]["nervous"] = {
            "label": "Nervous System",
            "color": "#f0d060",
            "visible": True,
            "parts": [],
        }

    existing = {p["name"] for p in layers["layers"]["nervous"]["parts"]}
    added = 0

    print("=== Generating brain ===")
    dest = os.path.join(NERVOUS_DIR, "brain.obj")
    v, f = gen_brain()
    write_obj(dest, v, f)
    print(f"  brain.obj ({len(v)} verts)")
    if "brain" not in existing:
        layers["layers"]["nervous"]["parts"].append({
            "name": "brain", "file": "anatomy/nervous/brain.obj",
            "fma_id": "FMA50801", "label": "Brain",
        })
        added += 1

    print("\n=== Generating spinal cord ===")
    dest = os.path.join(NERVOUS_DIR, "spinal_cord.obj")
    v, f = gen_spinal_cord()
    write_obj(dest, v, f)
    print(f"  spinal_cord.obj ({len(v)} verts)")
    if "spinal_cord" not in existing:
        layers["layers"]["nervous"]["parts"].append({
            "name": "spinal_cord", "file": "anatomy/nervous/spinal_cord.obj",
            "fma_id": "FMA7647", "label": "Spinal Cord",
        })
        added += 1

    print("\n=== Generating paired nerves ===")
    for name, info in NERVE_PAIRS.items():
        (lv, lf), (rv, rf) = gen_nerve_pair(name, info["path"], info["radius"])

        lname = f"left_{name}"
        rname = f"right_{name}"

        write_obj(os.path.join(NERVOUS_DIR, f"{lname}.obj"), lv, lf)
        write_obj(os.path.join(NERVOUS_DIR, f"{rname}.obj"), rv, rf)
        print(f"  {lname}.obj ({len(lv)} verts), {rname}.obj ({len(rv)} verts)")

        if lname not in existing:
            layers["layers"]["nervous"]["parts"].append({
                "name": lname, "file": f"anatomy/nervous/{lname}.obj",
                "fma_id": info["fma_id"], "label": f"Left {info['label']}",
            })
            added += 1
        if rname not in existing:
            layers["layers"]["nervous"]["parts"].append({
                "name": rname, "file": f"anatomy/nervous/{rname}.obj",
                "fma_id": info["fma_id"], "label": f"Right {info['label']}",
            })
            added += 1

    print("\n=== Generating single nerves ===")
    for name, info in SINGLE_NERVES.items():
        dest = os.path.join(NERVOUS_DIR, f"{name}.obj")
        v, f = info["gen"]()
        write_obj(dest, v, f)
        print(f"  {name}.obj ({len(v)} verts)")
        if name not in existing:
            layers["layers"]["nervous"]["parts"].append({
                "name": name, "file": f"anatomy/nervous/{name}.obj",
                "fma_id": info["fma_id"], "label": info["label"],
            })
            added += 1

    with open(layers_path, 'w') as f:
        json.dump(layers, f, indent=2)

    print(f"\nDone! Added {added} nervous system parts to layers.json")


if __name__ == "__main__":
    main()
