"""
Skeleton detection → organ position mapping.

Takes body pose keypoints (from SnapLens or MediaPipe Pose) and maps them
to 3D organ positions using anatomical rules.

Reference skeleton: BodyParts3D coordinate system (mm).
"""

import numpy as np

# MediaPipe Pose landmark indices
LANDMARKS = {
    "nose": 0,
    "left_eye_inner": 1, "left_eye": 2, "left_eye_outer": 3,
    "right_eye_inner": 4, "right_eye": 5, "right_eye_outer": 6,
    "left_ear": 7, "right_ear": 8,
    "mouth_left": 9, "mouth_right": 10,
    "left_shoulder": 11, "right_shoulder": 12,
    "left_elbow": 13, "right_elbow": 14,
    "left_wrist": 15, "right_wrist": 16,
    "left_pinky": 17, "right_pinky": 18,
    "left_index": 19, "right_index": 20,
    "left_thumb": 21, "right_thumb": 22,
    "left_hip": 23, "right_hip": 24,
    "left_knee": 25, "right_knee": 26,
    "left_ankle": 27, "right_ankle": 28,
    "left_heel": 29, "right_heel": 30,
    "left_foot_index": 31, "right_foot_index": 32,
}

# Reference skeleton dimensions (average adult, in our coordinate system)
REF_SHOULDER_WIDTH = 360  # mm
REF_TORSO_HEIGHT = 500    # mm (shoulder to hip)
REF_SPINE_CENTER_Y = -120  # mm
REF_SPINE_CENTER_Z = 1050  # mm (vertical midpoint of torso)

# ---------------------------------------------------------------------------
# ALL organ/structure positions relative to spine center
# Format: (x_frac, y_frac, z_frac)
#   x_frac: lateral offset as fraction of shoulder_width (+ = patient left)
#   y_frac: depth (unused for 2D projection)
#   z_frac: vertical offset as fraction of torso_height (+ = superior/up)
# ---------------------------------------------------------------------------

ORGAN_RELATIVE_POSITIONS = {
    # === Organs ===
    "liver":              (-0.12, -0.35,  0.12),
    "stomach":            ( 0.08, -0.40,  0.20),
    "spleen":             ( 0.28, -0.20,  0.10),
    "right_kidney":       (-0.22, -0.30, -0.15),
    "left_kidney":        ( 0.22, -0.30, -0.15),
    "heart":              ( 0.02, -0.45,  0.35),
    "right_lung_upper":   (-0.18, -0.35,  0.45),
    "right_lung_lower":   (-0.18, -0.35,  0.20),
    "right_lung_middle":  (-0.18, -0.35,  0.32),
    "left_lung_upper":    ( 0.18, -0.35,  0.45),
    "left_lung_lower":    ( 0.18, -0.35,  0.20),
    "gallbladder":        (-0.10, -0.40,  0.05),
    "urinary_bladder":    ( 0.00, -0.38, -0.40),
    "appendix":           (-0.15, -0.32, -0.30),
    "diaphragm":          ( 0.00, -0.40,  0.30),
    "trachea":            ( 0.00, -0.42,  0.55),
    "bronchus":           ( 0.00, -0.40,  0.48),
    "esophagus":          ( 0.00, -0.25,  0.40),
    "thyroid_cartilage":  ( 0.00, -0.42,  0.60),
    "rectum":             ( 0.00, -0.30, -0.42),
    "right_adrenal":      (-0.18, -0.32, -0.05),
    "left_adrenal":       ( 0.18, -0.32, -0.05),

    # === Vascular (organs layer in model) ===
    "ascending_aorta":    ( 0.02, -0.30,  0.35),
    "aortic_arch":        ( 0.02, -0.32,  0.42),
    "descending_aorta":   ( 0.00, -0.20,  0.00),
}

# Vascular layer structures (separate from organs — own layer in layers.json)
VASCULAR_RELATIVE_POSITIONS = {
    "inferior_vena_cava":   ( 0.03, -0.25, -0.05),
    "superior_vena_cava":   ( 0.03, -0.28,  0.40),
    "pulmonary_artery":     ( 0.00, -0.38,  0.38),
    "pulmonary_vein":       ( 0.04, -0.36,  0.36),
    "celiac_artery":        ( 0.00, -0.30,  0.10),
    "superior_mesenteric":  ( 0.00, -0.28,  0.02),
    "inferior_mesenteric":  (-0.04, -0.26, -0.18),
    "left_coronary":        ( 0.04, -0.44,  0.36),
    "right_coronary":       (-0.02, -0.44,  0.34),
    "left_renal_artery":    ( 0.15, -0.28, -0.12),
    "right_renal_artery":   (-0.15, -0.28, -0.12),
}

# Bone-to-landmark mapping: maps skeleton OBJ part names to pairs of landmarks
# Each bone spans between two body landmarks
BONE_LANDMARK_MAPPING = {
    # Upper limbs
    "right_humerus": ("right_shoulder", "right_elbow"),
    "left_humerus": ("left_shoulder", "left_elbow"),
    "right_radius": ("right_elbow", "right_wrist"),
    "left_radius": ("left_elbow", "left_wrist"),
    "right_ulna": ("right_elbow", "right_wrist"),
    "left_ulna": ("left_elbow", "left_wrist"),
    # Lower limbs
    "right_femur": ("right_hip", "right_knee"),
    "left_femur": ("left_hip", "left_knee"),
    "right_tibia": ("right_knee", "right_ankle"),
    "left_tibia": ("left_knee", "left_ankle"),
    "right_fibula": ("right_knee", "right_ankle"),
    "left_fibula": ("left_knee", "left_ankle"),
    "right_patella": ("right_knee", "right_knee"),  # single point
    "left_patella": ("left_knee", "left_knee"),
    # Shoulder girdle
    "right_clavicle": ("right_shoulder", "nose"),  # approx: shoulder to midline
    "left_clavicle": ("left_shoulder", "nose"),
    "right_scapula": ("right_shoulder", "right_shoulder"),
    "left_scapula": ("left_shoulder", "left_shoulder"),
    "sternum": ("left_shoulder", "right_shoulder"),  # midline chest
}

# Muscle-to-landmark mapping: muscles attach between two body regions
# Tuple: (landmark1, landmark2) where the muscle spans between them
MUSCLE_LANDMARK_MAPPING = {
    # Shoulder muscles
    "right_deltoid_acr": ("right_shoulder", "right_elbow"),
    "left_deltoid_acr": ("left_shoulder", "left_elbow"),
    "right_deltoid_acr2": ("right_shoulder", "right_elbow"),
    "left_deltoid_acr2": ("left_shoulder", "left_elbow"),
    "right_trapezius_desc": ("right_shoulder", "right_ear"),
    "left_trapezius_desc": ("left_shoulder", "left_ear"),
    # Chest muscles
    "right_pectoralis_major_clav": ("right_shoulder", "right_hip"),
    "left_pectoralis_major_clav": ("left_shoulder", "left_hip"),
    "right_pectoralis_major_stern": ("right_shoulder", "right_hip"),
    "left_pectoralis_major_stern": ("left_shoulder", "left_hip"),
    # Back muscles
    "right_latissimus_dorsi": ("right_shoulder", "right_hip"),
    "left_latissimus_dorsi": ("left_shoulder", "left_hip"),
    # Abdominals
    "right_rectus_abdominis": ("right_shoulder", "right_hip"),
    "left_rectus_abdominis": ("left_shoulder", "left_hip"),
    "right_external_oblique": ("right_shoulder", "right_hip"),
    "left_external_oblique": ("left_shoulder", "left_hip"),
    # Intercostals (torso)
    "external_intercostal": ("left_shoulder", "right_shoulder"),
    "internal_intercostal": ("left_shoulder", "right_shoulder"),
    # Hip/leg muscles
    "right_gluteus_maximus": ("right_hip", "right_knee"),
    "left_gluteus_maximus": ("left_hip", "left_knee"),
    "right_rectus_femoris": ("right_hip", "right_knee"),
    "left_rectus_femoris": ("left_hip", "left_knee"),
}

# Spine vertebrae: positioned along the line from mid-shoulder to mid-hip
# Each vertebra gets a fractional position (0 = mid-shoulder, 1 = mid-hip)
SPINE_POSITIONS = {
    "cervical_3": -0.25,
    "cervical_4": -0.20,
    "cervical_5": -0.15,
    "cervical_6": -0.10,
    "cervical_7": -0.05,
    "thoracic_1": 0.00,
    "thoracic_2": 0.05,
    "thoracic_3": 0.10,
    "thoracic_4": 0.15,
    "thoracic_5": 0.20,
    "thoracic_6": 0.25,
    "thoracic_7": 0.30,
    "thoracic_8": 0.35,
    "thoracic_9": 0.40,
    "thoracic_10": 0.45,
    "thoracic_11": 0.50,
    "thoracic_12": 0.55,
    "lumbar_1": 0.60,
    "lumbar_2": 0.65,
    "lumbar_3": 0.70,
    "lumbar_4": 0.80,
    "lumbar_5": 0.90,
    "sacrum": 1.00,
}

# Rib positions: ribs attach at specific vertebral levels
# Each rib maps to a spine fraction and a lateral offset (left/right)
RIB_SPINE_FRACTION = {
    "first_rib": 0.00,
    "second_rib": 0.05,
    "third_rib": 0.10,
    "fourth_rib": 0.15,
    "fifth_rib": 0.20,
    "sixth_rib": 0.25,
    "seventh_rib": 0.30,
    "eighth_rib": 0.35,
    "ninth_rib": 0.40,
    "tenth_rib": 0.45,
    "eleventh_rib": 0.50,
    "twelfth_rib": 0.55,
}

# ---------------------------------------------------------------------------
# Human-readable labels for every body part in the 3D model (layers.json)
# ---------------------------------------------------------------------------

PART_LABELS = {
    # Organs
    "liver": "Liver",
    "stomach": "Stomach",
    "spleen": "Spleen",
    "right_kidney": "R. Kidney",
    "left_kidney": "L. Kidney",
    "heart": "Heart",
    "right_lung_upper": "R. Lung Upper",
    "right_lung_lower": "R. Lung Lower",
    "right_lung_middle": "R. Lung Middle",
    "left_lung_upper": "L. Lung Upper",
    "left_lung_lower": "L. Lung Lower",
    "gallbladder": "Gallbladder",
    "urinary_bladder": "Bladder",
    "appendix": "Appendix",
    "diaphragm": "Diaphragm",
    "trachea": "Trachea",
    "bronchus": "Bronchus",
    "esophagus": "Esophagus",
    "thyroid_cartilage": "Thyroid",
    "rectum": "Rectum",
    "right_adrenal": "R. Adrenal",
    "left_adrenal": "L. Adrenal",
    "ascending_aorta": "Asc. Aorta",
    "aortic_arch": "Aortic Arch",
    "descending_aorta": "Desc. Aorta",

    # Vascular
    "inferior_vena_cava": "IVC",
    "superior_vena_cava": "SVC",
    "pulmonary_artery": "Pulm. Artery",
    "pulmonary_vein": "Pulm. Vein",
    "celiac_artery": "Celiac A.",
    "superior_mesenteric": "Sup. Mesenteric",
    "inferior_mesenteric": "Inf. Mesenteric",
    "left_coronary": "L. Coronary",
    "right_coronary": "R. Coronary",
    "left_renal_artery": "L. Renal A.",
    "right_renal_artery": "R. Renal A.",

    # Skeleton — ribs
    "right_first_rib": "R. 1st Rib",
    "right_second_rib": "R. 2nd Rib",
    "right_third_rib": "R. 3rd Rib",
    "right_fourth_rib": "R. 4th Rib",
    "right_fifth_rib": "R. 5th Rib",
    "right_sixth_rib": "R. 6th Rib",
    "right_seventh_rib": "R. 7th Rib",
    "right_eighth_rib": "R. 8th Rib",
    "right_ninth_rib": "R. 9th Rib",
    "right_tenth_rib": "R. 10th Rib",
    "right_eleventh_rib": "R. 11th Rib",
    "right_twelfth_rib": "R. 12th Rib",
    "left_first_rib": "L. 1st Rib",
    "left_second_rib": "L. 2nd Rib",
    "left_third_rib": "L. 3rd Rib",
    "left_fourth_rib": "L. 4th Rib",
    "left_fifth_rib": "L. 5th Rib",
    "left_sixth_rib": "L. 6th Rib",
    "left_seventh_rib": "L. 7th Rib",
    "left_eighth_rib": "L. 8th Rib",
    "left_ninth_rib": "L. 9th Rib",
    "left_tenth_rib": "L. 10th Rib",
    "left_eleventh_rib": "L. 11th Rib",
    "left_twelfth_rib": "L. 12th Rib",

    # Skeleton — spine
    "cervical_3": "C3",
    "cervical_4": "C4",
    "cervical_5": "C5",
    "cervical_6": "C6",
    "cervical_7": "C7",
    "thoracic_1": "T1",
    "thoracic_2": "T2",
    "thoracic_3": "T3",
    "thoracic_4": "T4",
    "thoracic_5": "T5",
    "thoracic_6": "T6",
    "thoracic_7": "T7",
    "thoracic_8": "T8",
    "thoracic_9": "T9",
    "thoracic_10": "T10",
    "thoracic_11": "T11",
    "thoracic_12": "T12",
    "lumbar_1": "L1",
    "lumbar_2": "L2",
    "lumbar_3": "L3",
    "lumbar_4": "L4",
    "lumbar_5": "L5",
    "sacrum": "Sacrum",

    # Skeleton — limb bones
    "right_femur": "R. Femur",
    "left_femur": "L. Femur",
    "right_tibia": "R. Tibia",
    "left_tibia": "L. Tibia",
    "right_fibula": "R. Fibula",
    "left_fibula": "L. Fibula",
    "right_humerus": "R. Humerus",
    "left_humerus": "L. Humerus",
    "right_radius": "R. Radius",
    "left_radius": "L. Radius",
    "right_ulna": "R. Ulna",
    "left_ulna": "L. Ulna",
    "right_patella": "R. Patella",
    "left_patella": "L. Patella",

    # Skeleton — girdle / skull
    "sternum": "Sternum",
    "right_scapula": "R. Scapula",
    "left_scapula": "L. Scapula",
    "right_clavicle": "R. Clavicle",
    "left_clavicle": "L. Clavicle",
    "mandible": "Mandible",
    "right_maxilla": "R. Maxilla",
    "left_maxilla": "L. Maxilla",

    # Muscles
    "external_intercostal": "Ext. Intercostal",
    "internal_intercostal": "Int. Intercostal",
    "right_external_oblique": "R. Ext. Oblique",
    "left_external_oblique": "L. Ext. Oblique",
    "right_rectus_abdominis": "R. Rectus Abd.",
    "left_rectus_abdominis": "L. Rectus Abd.",
    "right_latissimus_dorsi": "R. Lat. Dorsi",
    "left_latissimus_dorsi": "L. Lat. Dorsi",
    "right_gluteus_maximus": "R. Glut. Max.",
    "left_gluteus_maximus": "L. Glut. Max.",
    "right_rectus_femoris": "R. Rect. Fem.",
    "left_rectus_femoris": "L. Rect. Fem.",
    "right_pectoralis_major_clav": "R. Pec. Major (Clav)",
    "left_pectoralis_major_clav": "L. Pec. Major (Clav)",
    "right_pectoralis_major_stern": "R. Pec. Major (Stern)",
    "left_pectoralis_major_stern": "L. Pec. Major (Stern)",
    "right_deltoid_acr": "R. Deltoid",
    "left_deltoid_acr": "L. Deltoid",
    "right_deltoid_acr2": "R. Deltoid 2",
    "left_deltoid_acr2": "L. Deltoid 2",
    "right_trapezius_desc": "R. Trapezius",
    "left_trapezius_desc": "L. Trapezius",

    # Skin
    "skin": "Skin",
}


def _get_kp(keypoints: list[dict], name: str) -> np.ndarray:
    """Extract a keypoint by name from the landmarks list."""
    idx = LANDMARKS.get(name, 0)
    if idx < len(keypoints):
        kp = keypoints[idx]
        return np.array([kp.get("x", 0), kp.get("y", 0), kp.get("z", 0)])
    return np.array([0.0, 0.0, 0.0])


def _get_body_metrics(keypoints: list[dict]) -> dict | None:
    """Compute core body measurements from keypoints."""
    l_shoulder = _get_kp(keypoints, "left_shoulder")
    r_shoulder = _get_kp(keypoints, "right_shoulder")
    l_hip = _get_kp(keypoints, "left_hip")
    r_hip = _get_kp(keypoints, "right_hip")

    mid_shoulder = (l_shoulder + r_shoulder) / 2
    mid_hip = (l_hip + r_hip) / 2
    spine_center = (mid_shoulder + mid_hip) / 2

    shoulder_width = float(np.linalg.norm(l_shoulder - r_shoulder))
    torso_height = float(np.linalg.norm(mid_shoulder - mid_hip))

    if shoulder_width < 0.01 or torso_height < 0.01:
        return None

    return {
        "l_shoulder": l_shoulder,
        "r_shoulder": r_shoulder,
        "l_hip": l_hip,
        "r_hip": r_hip,
        "mid_shoulder": mid_shoulder,
        "mid_hip": mid_hip,
        "spine_center": spine_center,
        "shoulder_width": shoulder_width,
        "torso_height": torso_height,
    }


def compute_organ_positions(keypoints: list[dict]) -> dict[str, list[float]]:
    """
    Given pose keypoints, compute 3D positions for each organ.

    keypoints: list of {x, y, z} normalized (0-1) or pixel coords.
               Must have at least shoulders and hips.

    Returns: dict of organ_name → [x, y, z] in the viewer's coordinate system.
    """
    metrics = _get_body_metrics(keypoints)
    if metrics is None:
        return _reference_positions()

    spine_center = metrics["spine_center"]
    shoulder_width = metrics["shoulder_width"]
    torso_height = metrics["torso_height"]

    # Scale factors relative to reference skeleton
    scale_x = shoulder_width / REF_SHOULDER_WIDTH * 1000  # to mm
    scale_y = torso_height / REF_TORSO_HEIGHT * 1000
    scale_z = torso_height / REF_TORSO_HEIGHT * 1000  # assume similar depth

    # If keypoints are normalized (0-1), scale to our coordinate system
    if shoulder_width < 1:
        # Normalized coordinates — map to viewer space
        scale_x = shoulder_width * 800
        scale_y = torso_height * 800
        scale_z = torso_height * 600

    # Map spine center to viewer coordinates
    center_x = spine_center[0] if abs(spine_center[0]) > 1 else 0
    center_y = REF_SPINE_CENTER_Y
    center_z = REF_SPINE_CENTER_Z

    positions = {}
    for organ, (fx, fy, fz) in ORGAN_RELATIVE_POSITIONS.items():
        positions[organ] = [
            round(center_x + fx * scale_x, 1),
            round(center_y + fy * scale_y, 1),
            round(center_z + fz * scale_z, 1),
        ]

    return positions


def compute_full_body_mapping(keypoints: list[dict]) -> dict:
    """
    Compute complete body mapping: organs, bones, muscles, and raw landmarks.

    Returns dict with:
      - organ_positions: organ_name → [x, y, z]
      - bone_positions: bone_name → {start: [x,y,z], end: [x,y,z], midpoint: [x,y,z]}
      - muscle_positions: muscle_name → {origin: [x,y,z], insertion: [x,y,z], midpoint: [x,y,z]}
      - skeleton_landmarks: raw 33 landmarks list
    """
    organ_positions = compute_organ_positions(keypoints)
    metrics = _get_body_metrics(keypoints)

    bone_positions = {}
    muscle_positions = {}

    if metrics:
        mid_shoulder = metrics["mid_shoulder"]
        mid_hip = metrics["mid_hip"]

        # Compute bone positions from landmark pairs
        for bone_name, (lm1_name, lm2_name) in BONE_LANDMARK_MAPPING.items():
            start = _get_kp(keypoints, lm1_name)
            end = _get_kp(keypoints, lm2_name)
            midpoint = (start + end) / 2
            bone_positions[bone_name] = {
                "start": start.tolist(),
                "end": end.tolist(),
                "midpoint": midpoint.tolist(),
            }

        # Compute spine vertebrae positions along shoulder-to-hip line
        spine_vec = mid_hip - mid_shoulder
        for vert_name, frac in SPINE_POSITIONS.items():
            pos = mid_shoulder + spine_vec * frac
            bone_positions[vert_name] = {
                "start": pos.tolist(),
                "end": pos.tolist(),
                "midpoint": pos.tolist(),
            }

        # Compute rib positions
        for rib_base, frac in RIB_SPINE_FRACTION.items():
            spine_pos = mid_shoulder + spine_vec * frac
            # Ribs extend laterally from spine
            shoulder_width = metrics["shoulder_width"]
            for side in ("right", "left"):
                rib_name = f"{side}_{rib_base}"
                lateral_sign = -1.0 if side == "right" else 1.0
                lateral_offset = np.array([
                    lateral_sign * shoulder_width * 0.4, 0, 0
                ])
                rib_end = spine_pos + lateral_offset
                bone_positions[rib_name] = {
                    "start": spine_pos.tolist(),
                    "end": rib_end.tolist(),
                    "midpoint": ((spine_pos + rib_end) / 2).tolist(),
                }

        # Skull bones at head position
        nose = _get_kp(keypoints, "nose")
        for skull_bone in ("mandible", "right_maxilla", "left_maxilla"):
            bone_positions[skull_bone] = {
                "start": nose.tolist(),
                "end": nose.tolist(),
                "midpoint": nose.tolist(),
            }

        # Compute muscle positions from landmark pairs
        for muscle_name, (lm1_name, lm2_name) in MUSCLE_LANDMARK_MAPPING.items():
            origin = _get_kp(keypoints, lm1_name)
            insertion = _get_kp(keypoints, lm2_name)
            midpoint = (origin + insertion) / 2
            muscle_positions[muscle_name] = {
                "origin": origin.tolist(),
                "insertion": insertion.tolist(),
                "midpoint": midpoint.tolist(),
            }

    return {
        "organ_positions": organ_positions,
        "bone_positions": bone_positions,
        "muscle_positions": muscle_positions,
        "skeleton_landmarks": keypoints,
    }


def _project_relative_to_2d(
    fx: float, fz: float,
    spine_center: np.ndarray,
    shoulder_width: float,
    torso_height: float,
    frame_w: int, frame_h: int,
) -> tuple[int, int]:
    """Project a relative anatomical position to 2D pixel coords, clamped to frame bounds."""
    px = spine_center[0] + fx * shoulder_width
    py = spine_center[1] - fz * torso_height
    return (
        max(0, min(frame_w, round(px * frame_w))),
        max(0, min(frame_h, round(py * frame_h))),
    )


def compute_2d_overlay_positions(
    keypoints: list[dict],
    frame_w: int,
    frame_h: int,
) -> dict[str, dict]:
    """
    Project ALL body parts to 2D pixel coordinates on the video frame.

    Uses the detected body landmarks to position every organ, bone, muscle,
    and vascular structure relative to the person's body in the video frame.

    Returns: {part_name: {x, y, label, layer, radius}}
    where layer is one of: "organs", "skeleton", "muscles", "vascular", "skin"
    """
    metrics = _get_body_metrics(keypoints)
    if metrics is None:
        return {}

    mid_shoulder = metrics["mid_shoulder"]
    mid_hip = metrics["mid_hip"]
    spine_center = metrics["spine_center"]
    shoulder_width = metrics["shoulder_width"]
    torso_height = metrics["torso_height"]

    overlay: dict[str, dict] = {}

    base_radius = round(shoulder_width * frame_w * 0.04)
    small_radius = round(shoulder_width * frame_w * 0.025)
    tiny_radius = round(shoulder_width * frame_w * 0.015)

    # Cache landmark lookups to avoid repeated _get_kp() calls
    _kp_cache: dict[str, np.ndarray] = {}

    def _cached_kp(name: str) -> np.ndarray:
        if name not in _kp_cache:
            _kp_cache[name] = _get_kp(keypoints, name)
        return _kp_cache[name]

    # ----- ORGANS (all 25) -----
    for organ, (fx, _fy, fz) in ORGAN_RELATIVE_POSITIONS.items():
        x, y = _project_relative_to_2d(
            fx, fz, spine_center, shoulder_width, torso_height, frame_w, frame_h
        )
        overlay[organ] = {
            "x": x,
            "y": y,
            "label": PART_LABELS.get(organ, organ),
            "layer": "organs",
            "radius": base_radius,
        }

    # ----- VASCULAR (all 11) -----
    for vessel, (fx, _fy, fz) in VASCULAR_RELATIVE_POSITIONS.items():
        x, y = _project_relative_to_2d(
            fx, fz, spine_center, shoulder_width, torso_height, frame_w, frame_h
        )
        overlay[vessel] = {
            "x": x,
            "y": y,
            "label": PART_LABELS.get(vessel, vessel),
            "layer": "vascular",
            "radius": small_radius,
        }

    # ----- SKELETON — Limb bones (from landmark pairs) -----
    for bone_name, (lm1_name, lm2_name) in BONE_LANDMARK_MAPPING.items():
        start = _cached_kp(lm1_name)
        end = _cached_kp(lm2_name)
        mid = (start + end) / 2
        overlay[bone_name] = {
            "x": round(mid[0] * frame_w),
            "y": round(mid[1] * frame_h),
            "label": PART_LABELS.get(bone_name, bone_name),
            "layer": "skeleton",
            "radius": small_radius,
            # Include start/end for line rendering
            "x1": round(start[0] * frame_w),
            "y1": round(start[1] * frame_h),
            "x2": round(end[0] * frame_w),
            "y2": round(end[1] * frame_h),
        }

    # ----- SKELETON — Spine vertebrae -----
    spine_vec = mid_hip - mid_shoulder
    for vert_name, frac in SPINE_POSITIONS.items():
        pos = mid_shoulder + spine_vec * frac
        overlay[vert_name] = {
            "x": round(pos[0] * frame_w),
            "y": round(pos[1] * frame_h),
            "label": PART_LABELS.get(vert_name, vert_name),
            "layer": "skeleton",
            "radius": tiny_radius,
        }

    # ----- SKELETON — Ribs (all 24) -----
    for rib_base, frac in RIB_SPINE_FRACTION.items():
        spine_pos = mid_shoulder + spine_vec * frac
        for side in ("right", "left"):
            rib_name = f"{side}_{rib_base}"
            lateral_sign = -1.0 if side == "right" else 1.0
            lateral_offset = np.array([
                lateral_sign * shoulder_width * 0.4, 0, 0
            ])
            rib_end = spine_pos + lateral_offset
            rib_mid = (spine_pos + rib_end) / 2
            overlay[rib_name] = {
                "x": round(rib_mid[0] * frame_w),
                "y": round(rib_mid[1] * frame_h),
                "label": PART_LABELS.get(rib_name, rib_name),
                "layer": "skeleton",
                "radius": tiny_radius,
                "x1": round(spine_pos[0] * frame_w),
                "y1": round(spine_pos[1] * frame_h),
                "x2": round(rib_end[0] * frame_w),
                "y2": round(rib_end[1] * frame_h),
            }

    # ----- SKELETON — Skull bones -----
    nose = _cached_kp("nose")
    l_ear = _cached_kp("left_ear")
    r_ear = _cached_kp("right_ear")
    mouth_l = _cached_kp("mouth_left")
    mouth_r = _cached_kp("mouth_right")
    jaw_center = (mouth_l + mouth_r) / 2
    # Mandible centered below nose
    overlay["mandible"] = {
        "x": round(jaw_center[0] * frame_w),
        "y": round(jaw_center[1] * frame_h),
        "label": PART_LABELS["mandible"],
        "layer": "skeleton",
        "radius": small_radius,
    }
    # Maxillae on each side
    r_maxilla_pos = (nose + r_ear) / 2
    l_maxilla_pos = (nose + l_ear) / 2
    overlay["right_maxilla"] = {
        "x": round(r_maxilla_pos[0] * frame_w),
        "y": round(r_maxilla_pos[1] * frame_h),
        "label": PART_LABELS["right_maxilla"],
        "layer": "skeleton",
        "radius": small_radius,
    }
    overlay["left_maxilla"] = {
        "x": round(l_maxilla_pos[0] * frame_w),
        "y": round(l_maxilla_pos[1] * frame_h),
        "label": PART_LABELS["left_maxilla"],
        "layer": "skeleton",
        "radius": small_radius,
    }

    # ----- MUSCLES (all 22) -----
    for muscle_name, (lm1_name, lm2_name) in MUSCLE_LANDMARK_MAPPING.items():
        origin = _cached_kp(lm1_name)
        insertion = _cached_kp(lm2_name)
        mid = (origin + insertion) / 2
        overlay[muscle_name] = {
            "x": round(mid[0] * frame_w),
            "y": round(mid[1] * frame_h),
            "label": PART_LABELS.get(muscle_name, muscle_name),
            "layer": "muscles",
            "radius": small_radius,
            # Include origin/insertion for line rendering
            "x1": round(origin[0] * frame_w),
            "y1": round(origin[1] * frame_h),
            "x2": round(insertion[0] * frame_w),
            "y2": round(insertion[1] * frame_h),
        }

    # ----- SKIN (body outline) -----
    # Approximate as bounding region from shoulders to hips
    overlay["skin"] = {
        "x": round(spine_center[0] * frame_w),
        "y": round(spine_center[1] * frame_h),
        "label": PART_LABELS["skin"],
        "layer": "skin",
        "radius": round(shoulder_width * frame_w * 0.5),
        # Bounding box for outline rendering
        "x1": round(metrics["r_shoulder"][0] * frame_w),
        "y1": round(mid_shoulder[1] * frame_h),
        "x2": round(metrics["l_shoulder"][0] * frame_w),
        "y2": round(mid_hip[1] * frame_h),
    }

    return overlay


def _compute_reference_positions() -> dict[str, list[float]]:
    """Compute default organ positions once (no skeleton detected)."""
    positions = {}
    for organ, (fx, fy, fz) in ORGAN_RELATIVE_POSITIONS.items():
        positions[organ] = [
            round(fx * REF_SHOULDER_WIDTH, 1),
            round(REF_SPINE_CENTER_Y + fy * REF_TORSO_HEIGHT, 1),
            round(REF_SPINE_CENTER_Z + fz * REF_TORSO_HEIGHT, 1),
        ]
    return positions


# Cached at module load — avoids recomputing on every fallback call
_CACHED_REFERENCE_POSITIONS = _compute_reference_positions()


def _reference_positions() -> dict[str, list[float]]:
    """Fallback: return default organ positions (no skeleton detected)."""
    return _CACHED_REFERENCE_POSITIONS
