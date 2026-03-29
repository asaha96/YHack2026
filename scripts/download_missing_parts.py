#!/usr/bin/env python3
"""
Download missing skull and muscle parts from BodyParts3D.
Uses the same coordinate system as existing models.
BodyParts3D OBJ files are available at:
  https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/obj/
Format: FMA{id}.obj
"""

import os
import sys
import json
import urllib.request
import ssl

BASE_URL = "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/obj/"
ANATOMY_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "models", "anatomy")

# Missing skull bones
MISSING_SKELETON = {
    "frontal_bone": {"fma_id": "FMA52734", "label": "Frontal Bone"},
    "right_parietal_bone": {"fma_id": "FMA52735", "label": "Right Parietal Bone"},
    "left_parietal_bone": {"fma_id": "FMA52736", "label": "Left Parietal Bone"},
    "occipital_bone": {"fma_id": "FMA52737", "label": "Occipital Bone"},
    "right_temporal_bone": {"fma_id": "FMA52739", "label": "Right Temporal Bone"},
    "left_temporal_bone": {"fma_id": "FMA52740", "label": "Left Temporal Bone"},
    "sphenoid_bone": {"fma_id": "FMA52741", "label": "Sphenoid Bone"},
    "ethmoid_bone": {"fma_id": "FMA52742", "label": "Ethmoid Bone"},
    "right_zygomatic_bone": {"fma_id": "FMA52747", "label": "Right Zygomatic Bone"},
    "left_zygomatic_bone": {"fma_id": "FMA52750", "label": "Left Zygomatic Bone"},
    "right_nasal_bone": {"fma_id": "FMA52745", "label": "Right Nasal Bone"},
    "left_nasal_bone": {"fma_id": "FMA52746", "label": "Left Nasal Bone"},
    "atlas_c1": {"fma_id": "FMA12519", "label": "Atlas (C1)"},
    "axis_c2": {"fma_id": "FMA12520", "label": "Axis (C2)"},
    "right_hip_bone": {"fma_id": "FMA16580", "label": "Right Hip Bone"},
    "left_hip_bone": {"fma_id": "FMA16581", "label": "Left Hip Bone"},
}

# Missing muscles (head/neck/torso)
MISSING_MUSCLES = {
    "right_sternocleidomastoid": {"fma_id": "FMA13407", "label": "Right Sternocleidomastoid"},
    "left_sternocleidomastoid": {"fma_id": "FMA13408", "label": "Left Sternocleidomastoid"},
    "right_masseter": {"fma_id": "FMA49012", "label": "Right Masseter"},
    "left_masseter": {"fma_id": "FMA49013", "label": "Left Masseter"},
    "right_temporalis": {"fma_id": "FMA49006", "label": "Right Temporalis"},
    "left_temporalis": {"fma_id": "FMA49007", "label": "Left Temporalis"},
    "right_biceps_brachii": {"fma_id": "FMA37670", "label": "Right Biceps Brachii"},
    "left_biceps_brachii": {"fma_id": "FMA37671", "label": "Left Biceps Brachii"},
    "right_triceps_brachii": {"fma_id": "FMA37688", "label": "Right Triceps Brachii"},
    "left_triceps_brachii": {"fma_id": "FMA37689", "label": "Left Triceps Brachii"},
    "right_internal_oblique": {"fma_id": "FMA13362", "label": "Right Internal Oblique"},
    "left_internal_oblique": {"fma_id": "FMA13363", "label": "Left Internal Oblique"},
    "right_transversus_abdominis": {"fma_id": "FMA15570", "label": "Right Transversus Abdominis"},
    "left_transversus_abdominis": {"fma_id": "FMA15571", "label": "Left Transversus Abdominis"},
}


def download_obj(fma_id: str, dest_path: str) -> bool:
    """Download a single OBJ from BodyParts3D."""
    url = f"{BASE_URL}{fma_id}.obj"
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
            data = resp.read()
            if len(data) < 100:
                return False
            with open(dest_path, "wb") as f:
                f.write(data)
            return True
    except Exception as e:
        print(f"  FAILED: {e}")
        return False


def main():
    layers_path = os.path.join(ANATOMY_DIR, "layers.json")
    with open(layers_path) as f:
        layers = json.load(f)

    skeleton_dir = os.path.join(ANATOMY_DIR, "skeleton")
    muscles_dir = os.path.join(ANATOMY_DIR, "muscles")

    added_skeleton = []
    added_muscles = []

    print("=== Downloading missing skeleton parts ===")
    for name, info in MISSING_SKELETON.items():
        dest = os.path.join(skeleton_dir, f"{name}.obj")
        if os.path.exists(dest):
            print(f"  {name}: already exists, skipping")
            added_skeleton.append({"name": name, **info, "file": f"anatomy/skeleton/{name}.obj"})
            continue
        print(f"  Downloading {name} ({info['fma_id']})...")
        if download_obj(info["fma_id"], dest):
            print(f"  OK: {name}.obj")
            added_skeleton.append({"name": name, **info, "file": f"anatomy/skeleton/{name}.obj"})
        else:
            print(f"  SKIPPED: {name} not available")

    print("\n=== Downloading missing muscle parts ===")
    for name, info in MISSING_MUSCLES.items():
        dest = os.path.join(muscles_dir, f"{name}.obj")
        if os.path.exists(dest):
            print(f"  {name}: already exists, skipping")
            added_muscles.append({"name": name, **info, "file": f"anatomy/muscles/{name}.obj"})
            continue
        print(f"  Downloading {name} ({info['fma_id']})...")
        if download_obj(info["fma_id"], dest):
            print(f"  OK: {name}.obj")
            added_muscles.append({"name": name, **info, "file": f"anatomy/muscles/{name}.obj"})
        else:
            print(f"  SKIPPED: {name} not available")

    # Update layers.json with new parts
    existing_skeleton_names = {p["name"] for p in layers["layers"]["skeleton"]["parts"]}
    existing_muscle_names = {p["name"] for p in layers["layers"]["muscles"]["parts"]}

    for part in added_skeleton:
        if part["name"] not in existing_skeleton_names:
            layers["layers"]["skeleton"]["parts"].append({
                "name": part["name"],
                "file": part["file"],
                "fma_id": part["fma_id"],
                "label": part["label"],
            })

    for part in added_muscles:
        if part["name"] not in existing_muscle_names:
            layers["layers"]["muscles"]["parts"].append({
                "name": part["name"],
                "file": part["file"],
                "fma_id": part["fma_id"],
                "label": part["label"],
            })

    with open(layers_path, "w") as f:
        json.dump(layers, f, indent=2)

    print(f"\nDone! Added {len(added_skeleton)} skeleton + {len(added_muscles)} muscle parts")
    print(f"Updated {layers_path}")


if __name__ == "__main__":
    main()
