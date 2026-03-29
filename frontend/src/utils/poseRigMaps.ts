/** Mirrors backend/services/skeleton.py — bone & muscle landmark pairs for rigid rigging. */

export const BONE_LANDMARK_MAPPING: Record<string, [string, string]> = {
  right_humerus: ["right_shoulder", "right_elbow"],
  left_humerus: ["left_shoulder", "left_elbow"],
  right_radius: ["right_elbow", "right_wrist"],
  left_radius: ["left_elbow", "left_wrist"],
  right_ulna: ["right_elbow", "right_wrist"],
  left_ulna: ["left_elbow", "left_wrist"],
  right_femur: ["right_hip", "right_knee"],
  left_femur: ["left_hip", "left_knee"],
  right_tibia: ["right_knee", "right_ankle"],
  left_tibia: ["left_knee", "left_ankle"],
  right_fibula: ["right_knee", "right_ankle"],
  left_fibula: ["left_knee", "left_ankle"],
  right_patella: ["right_knee", "right_knee"],
  left_patella: ["left_knee", "left_knee"],
  right_clavicle: ["right_shoulder", "nose"],
  left_clavicle: ["left_shoulder", "nose"],
  right_scapula: ["right_shoulder", "right_shoulder"],
  left_scapula: ["left_shoulder", "left_shoulder"],
  sternum: ["left_shoulder", "right_shoulder"],
};

export const MUSCLE_LANDMARK_MAPPING: Record<string, [string, string]> = {
  right_deltoid_acr: ["right_shoulder", "right_elbow"],
  left_deltoid_acr: ["left_shoulder", "left_elbow"],
  right_deltoid_acr2: ["right_shoulder", "right_elbow"],
  left_deltoid_acr2: ["left_shoulder", "left_elbow"],
  right_trapezius_desc: ["right_shoulder", "right_ear"],
  left_trapezius_desc: ["left_shoulder", "left_ear"],
  right_pectoralis_major_clav: ["right_shoulder", "right_hip"],
  left_pectoralis_major_clav: ["left_shoulder", "left_hip"],
  right_pectoralis_major_stern: ["right_shoulder", "right_hip"],
  left_pectoralis_major_stern: ["left_shoulder", "left_hip"],
  right_latissimus_dorsi: ["right_shoulder", "right_hip"],
  left_latissimus_dorsi: ["left_shoulder", "left_hip"],
  right_rectus_abdominis: ["right_shoulder", "right_hip"],
  left_rectus_abdominis: ["left_shoulder", "left_hip"],
  right_external_oblique: ["right_shoulder", "right_hip"],
  left_external_oblique: ["left_shoulder", "left_hip"],
  external_intercostal: ["left_shoulder", "right_shoulder"],
  internal_intercostal: ["left_shoulder", "right_shoulder"],
  right_gluteus_maximus: ["right_hip", "right_knee"],
  left_gluteus_maximus: ["left_hip", "left_knee"],
  right_rectus_femoris: ["right_hip", "right_knee"],
  left_rectus_femoris: ["left_hip", "left_knee"],
};

/** Fraction along spine from mid-shoulder (0) to mid-hip (1); negative = toward head. */
export const SPINE_POSITIONS: Record<string, number> = {
  cervical_3: -0.25,
  cervical_4: -0.2,
  cervical_5: -0.15,
  cervical_6: -0.1,
  cervical_7: -0.05,
  thoracic_1: 0,
  thoracic_2: 0.05,
  thoracic_3: 0.1,
  thoracic_4: 0.15,
  thoracic_5: 0.2,
  thoracic_6: 0.25,
  thoracic_7: 0.3,
  thoracic_8: 0.35,
  thoracic_9: 0.4,
  thoracic_10: 0.45,
  thoracic_11: 0.5,
  thoracic_12: 0.55,
  lumbar_1: 0.6,
  lumbar_2: 0.65,
  lumbar_3: 0.7,
  lumbar_4: 0.8,
  lumbar_5: 0.9,
  sacrum: 1,
};

export function getRigPairForPart(partName: string): [string, string] | undefined {
  return (
    BONE_LANDMARK_MAPPING[partName] ??
    MUSCLE_LANDMARK_MAPPING[partName] ??
    undefined
  );
}

export function getSpineFraction(partName: string): number | undefined {
  return SPINE_POSITIONS[partName];
}
