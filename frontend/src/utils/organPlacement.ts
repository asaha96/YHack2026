import * as THREE from "three";
import type { TorsoFrame } from "./torsoFrame";

export interface LocalPlacement {
  x: number;
  y: number;
  z: number;
  scale: number;
}

export interface WorldPlacement {
  position: THREE.Vector3;
  scale: number;
  depth01: number;
}

const ORGAN_COORDS: Record<string, LocalPlacement> = {
  heart: { x: -0.1, y: 0.7, z: 0.22, scale: 0.2 },
  left_lung_upper: { x: -0.22, y: 0.86, z: 0.14, scale: 0.24 },
  left_lung_lower: { x: -0.2, y: 0.68, z: 0.16, scale: 0.22 },
  right_lung_upper: { x: 0.22, y: 0.86, z: 0.15, scale: 0.27 },
  right_lung_middle: { x: 0.26, y: 0.73, z: 0.18, scale: 0.2 },
  right_lung_lower: { x: 0.22, y: 0.63, z: 0.16, scale: 0.24 },
  trachea: { x: 0, y: 1.02, z: 0.18, scale: 0.12 },
  bronchus: { x: 0, y: 0.88, z: 0.17, scale: 0.13 },
  thyroid_cartilage: { x: 0, y: 1.08, z: 0.2, scale: 0.08 },
  stomach: { x: -0.16, y: 0.52, z: 0.22, scale: 0.17 },
  spleen: { x: -0.27, y: 0.55, z: 0.16, scale: 0.1 },
  liver: { x: 0.14, y: 0.52, z: 0.2, scale: 0.28 },
  gallbladder: { x: 0.17, y: 0.46, z: 0.25, scale: 0.08 },
  diaphragm: { x: 0, y: 0.58, z: 0.16, scale: 0.31 },
  esophagus: { x: -0.03, y: 0.72, z: 0.09, scale: 0.08 },
  ascending_aorta: { x: 0.02, y: 0.72, z: 0.16, scale: 0.09 },
  aortic_arch: { x: 0.01, y: 0.84, z: 0.18, scale: 0.1 },
  descending_aorta: { x: -0.03, y: 0.59, z: 0.07, scale: 0.1 },
  right_kidney: { x: 0.16, y: 0.4, z: 0.1, scale: 0.11 },
  left_kidney: { x: -0.16, y: 0.41, z: 0.1, scale: 0.11 },
  right_adrenal: { x: 0.15, y: 0.5, z: 0.09, scale: 0.05 },
  left_adrenal: { x: -0.15, y: 0.5, z: 0.09, scale: 0.05 },
  inferior_vena_cava: { x: 0.07, y: 0.34, z: 0.11, scale: 0.09 },
  superior_vena_cava: { x: 0.06, y: 0.8, z: 0.14, scale: 0.08 },
  pulmonary_artery: { x: 0.04, y: 0.78, z: 0.2, scale: 0.1 },
  pulmonary_vein: { x: -0.01, y: 0.74, z: 0.2, scale: 0.1 },
  celiac_artery: { x: 0.02, y: 0.44, z: 0.16, scale: 0.07 },
  superior_mesenteric: { x: 0.01, y: 0.33, z: 0.18, scale: 0.09 },
  inferior_mesenteric: { x: 0.01, y: 0.22, z: 0.16, scale: 0.08 },
  left_coronary: { x: -0.07, y: 0.73, z: 0.24, scale: 0.04 },
  right_coronary: { x: 0.08, y: 0.72, z: 0.24, scale: 0.04 },
  left_renal_artery: { x: -0.1, y: 0.42, z: 0.14, scale: 0.05 },
  right_renal_artery: { x: 0.1, y: 0.42, z: 0.14, scale: 0.05 },
  appendix: { x: 0.16, y: 0.16, z: 0.28, scale: 0.06 },
  rectum: { x: 0, y: 0.08, z: 0.12, scale: 0.07 },
  urinary_bladder: { x: 0, y: 0.06, z: 0.2, scale: 0.09 },
  sacrum: { x: 0, y: 0.02, z: 0.04, scale: 0.15 },
  sternum: { x: 0, y: 0.83, z: 0.3, scale: 0.2 },
  right_clavicle: { x: 0.16, y: 0.92, z: 0.24, scale: 0.12 },
  left_clavicle: { x: -0.16, y: 0.92, z: 0.24, scale: 0.12 },
  right_scapula: { x: 0.2, y: 0.8, z: 0.04, scale: 0.15 },
  left_scapula: { x: -0.2, y: 0.8, z: 0.04, scale: 0.15 },
  mandible: { x: 0, y: 1.14, z: 0.28, scale: 0.08 },
  right_maxilla: { x: 0.05, y: 1.2, z: 0.3, scale: 0.06 },
  left_maxilla: { x: -0.05, y: 1.2, z: 0.3, scale: 0.06 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function resolveLocalPlacement(
  name: string,
  fallback: LocalPlacement
): LocalPlacement {
  const placement = { ...(ORGAN_COORDS[name] ?? fallback) };

  if (name === "heart") {
    placement.x = Math.min(placement.x, -0.08);
    placement.z = Math.max(placement.z, 0.18);
  }

  if (name.includes("lung")) {
    placement.y = clamp(placement.y, 0.65, 0.95);
    if (name.startsWith("left_")) {
      placement.scale *= 0.9;
      placement.x = Math.min(placement.x, -0.14);
    } else if (name.startsWith("right_")) {
      placement.x = Math.max(placement.x, 0.14);
    }
  }

  if (name === "stomach") {
    placement.x = Math.min(placement.x, -0.1);
    placement.y = clamp(placement.y, 0.45, 0.7);
  }

  if (name === "appendix") {
    placement.x = Math.max(placement.x, 0.12);
    placement.y = Math.min(placement.y, 0.32);
  }

  if (
    name === "rectum" ||
    name === "urinary_bladder" ||
    name.includes("mesenteric")
  ) {
    placement.y = Math.min(placement.y, 0.55);
  }

  if (name.includes("kidney") || name.includes("adrenal")) {
    placement.z = clamp(placement.z, 0.06, 0.14);
  }

  return placement;
}

export function projectPlacementToWorld(
  frame: TorsoFrame,
  placement: LocalPlacement,
  globalScale = 1
): WorldPlacement {
  const position = frame.origin
    .clone()
    .add(frame.xAxis.clone().multiplyScalar(placement.x * frame.width))
    .add(frame.yAxis.clone().multiplyScalar(placement.y * frame.height))
    .add(frame.zAxis.clone().multiplyScalar((placement.z - 0.5) * frame.depth));

  return {
    position,
    scale: placement.scale * frame.height * globalScale,
    depth01: clamp(placement.z, 0, 1),
  };
}

export function spineDepth01(frac: number): number {
  const curve = Math.sin((frac - 0.5) * Math.PI) * 0.18;
  return clamp(0.32 + curve, 0.08, 0.72);
}

export function opacityForDepth(baseOpacity: number, depth01: number): number {
  return baseOpacity * (0.45 + depth01 * 0.55);
}
