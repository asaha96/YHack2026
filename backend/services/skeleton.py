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
    "left_shoulder": 11, "right_shoulder": 12,
    "left_elbow": 13, "right_elbow": 14,
    "left_wrist": 15, "right_wrist": 16,
    "left_hip": 23, "right_hip": 24,
    "left_knee": 25, "right_knee": 26,
    "left_ankle": 27, "right_ankle": 28,
}

# Reference skeleton dimensions (average adult, in our coordinate system)
REF_SHOULDER_WIDTH = 360  # mm
REF_TORSO_HEIGHT = 500    # mm (shoulder to hip)
REF_SPINE_CENTER_Y = -120  # mm
REF_SPINE_CENTER_Z = 1050  # mm (vertical midpoint of torso)

# Organ positions relative to spine center, as fractions of torso dimensions
# Format: (x_frac, y_frac, z_frac) where fracs are relative to shoulder_width, torso_depth, torso_height
ORGAN_RELATIVE_POSITIONS = {
    # Organs
    "liver":              (-0.12, -0.35, 0.12),
    "stomach":            ( 0.08, -0.40, 0.20),
    "spleen":             ( 0.28, -0.20, 0.10),
    "right_kidney":       (-0.22, -0.30, -0.15),
    "left_kidney":        ( 0.22, -0.30, -0.15),
    "heart":              ( 0.02, -0.45, 0.35),
    "right_lung_upper":   (-0.18, -0.35, 0.45),
    "right_lung_lower":   (-0.18, -0.35, 0.20),
    "right_lung_middle":  (-0.18, -0.35, 0.32),
    "left_lung_upper":    ( 0.18, -0.35, 0.45),
    "left_lung_lower":    ( 0.18, -0.35, 0.20),
    "gallbladder":        (-0.10, -0.40, 0.05),
    "urinary_bladder":    ( 0.00, -0.38, -0.40),
    "appendix":           (-0.15, -0.32, -0.30),
    "diaphragm":          ( 0.00, -0.40, 0.30),
    "trachea":            ( 0.00, -0.42, 0.55),
    "bronchus":           ( 0.00, -0.40, 0.48),
    "esophagus":          ( 0.00, -0.25, 0.40),
    "thyroid_cartilage":  ( 0.00, -0.42, 0.60),

    # Vascular
    "ascending_aorta":    ( 0.02, -0.30, 0.35),
    "aortic_arch":        ( 0.02, -0.32, 0.42),
    "descending_aorta":   ( 0.00, -0.20, 0.00),
    "inferior_vena_cava": ( 0.03, -0.25, -0.05),
    "superior_vena_cava": ( 0.03, -0.28, 0.40),
    "pulmonary_artery":   ( 0.00, -0.38, 0.38),
    "celiac_artery":      ( 0.00, -0.30, 0.10),
}


def compute_organ_positions(keypoints: list[dict]) -> dict[str, list[float]]:
    """
    Given pose keypoints, compute 3D positions for each organ.

    keypoints: list of {x, y, z} normalized (0-1) or pixel coords.
               Must have at least shoulders and hips.

    Returns: dict of organ_name → [x, y, z] in the viewer's coordinate system.
    """
    # Extract key body points
    def get_kp(name: str) -> np.ndarray:
        idx = LANDMARKS.get(name, 0)
        if idx < len(keypoints):
            kp = keypoints[idx]
            return np.array([kp.get("x", 0), kp.get("y", 0), kp.get("z", 0)])
        return np.array([0.0, 0.0, 0.0])

    l_shoulder = get_kp("left_shoulder")
    r_shoulder = get_kp("right_shoulder")
    l_hip = get_kp("left_hip")
    r_hip = get_kp("right_hip")

    # Compute body metrics
    mid_shoulder = (l_shoulder + r_shoulder) / 2
    mid_hip = (l_hip + r_hip) / 2
    spine_center = (mid_shoulder + mid_hip) / 2

    shoulder_width = np.linalg.norm(l_shoulder - r_shoulder)
    torso_height = np.linalg.norm(mid_shoulder - mid_hip)

    if shoulder_width < 0.01 or torso_height < 0.01:
        # Invalid skeleton — return reference positions
        return _reference_positions()

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


def _reference_positions() -> dict[str, list[float]]:
    """Fallback: return default organ positions (no skeleton detected)."""
    positions = {}
    for organ, (fx, fy, fz) in ORGAN_RELATIVE_POSITIONS.items():
        positions[organ] = [
            round(fx * REF_SHOULDER_WIDTH, 1),
            round(REF_SPINE_CENTER_Y + fy * REF_TORSO_HEIGHT, 1),
            round(REF_SPINE_CENTER_Z + fz * REF_TORSO_HEIGHT, 1),
        ]
    return positions
