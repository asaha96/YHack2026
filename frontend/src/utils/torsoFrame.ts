import * as THREE from "three";

export interface PoseLandmark {
  name: string;
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface TorsoFrame {
  origin: THREE.Vector3;
  hipCenter: THREE.Vector3;
  shoulderCenter: THREE.Vector3;
  torsoCenter: THREE.Vector3;
  xAxis: THREE.Vector3;
  yAxis: THREE.Vector3;
  zAxis: THREE.Vector3;
  width: number;
  height: number;
  depth: number;
}

export function landmarkToTrackingPlane(
  lm: Pick<PoseLandmark, "x" | "y">,
  aspect: number
): THREE.Vector3 {
  return new THREE.Vector3((lm.x - 0.5) * 2 * aspect, -(lm.y - 0.5) * 2, 0);
}

export function getVisibleLandmark(
  landmarks: PoseLandmark[] | null,
  name: string,
  minVisibility = 0.45
): PoseLandmark | undefined {
  return landmarks?.find((lm) => lm.name === name && lm.visibility > minVisibility);
}

export function buildPosePointMap(
  landmarks: PoseLandmark[] | null,
  aspect: number,
  minVisibility = 0.45
): Map<string, THREE.Vector3> {
  const map = new Map<string, THREE.Vector3>();
  if (!landmarks) return map;

  for (const lm of landmarks) {
    if (lm.visibility <= minVisibility) continue;
    map.set(lm.name, landmarkToTrackingPlane(lm, aspect));
  }

  return map;
}

export function buildTorsoFrame(
  points: Map<string, THREE.Vector3>
): TorsoFrame | null {
  const leftShoulder = points.get("left_shoulder");
  const rightShoulder = points.get("right_shoulder");
  const leftHip = points.get("left_hip");
  const rightHip = points.get("right_hip");

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
    return null;
  }

  const hipCenter = leftHip.clone().add(rightHip).multiplyScalar(0.5);
  const shoulderCenter = leftShoulder.clone().add(rightShoulder).multiplyScalar(0.5);

  const xAxis = rightShoulder.clone().sub(leftShoulder).normalize();
  const yAxis = shoulderCenter.clone().sub(hipCenter).normalize();

  let zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis);
  if (zAxis.lengthSq() < 1e-8) {
    zAxis.set(0, 0, 1);
  } else {
    zAxis.normalize();
  }

  // Re-orthogonalize for a stable torso basis.
  const orthoXAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
  const orthoYAxis = new THREE.Vector3().crossVectors(zAxis, orthoXAxis).normalize();

  const width = Math.max(leftShoulder.distanceTo(rightShoulder), 1e-4);
  const height = Math.max(hipCenter.distanceTo(shoulderCenter), 1e-4);
  const depth = Math.max(width * 0.6, 1e-4);
  const torsoCenter = hipCenter.clone().add(shoulderCenter).multiplyScalar(0.5);

  return {
    origin: hipCenter.clone(),
    hipCenter,
    shoulderCenter,
    torsoCenter,
    xAxis: orthoXAxis,
    yAxis: orthoYAxis,
    zAxis,
    width,
    height,
    depth,
  };
}

export function torsoQuaternion(frame: TorsoFrame): THREE.Quaternion {
  const basis = new THREE.Matrix4().makeBasis(
    frame.xAxis,
    frame.yAxis,
    frame.zAxis
  );
  return new THREE.Quaternion().setFromRotationMatrix(basis);
}

export function torsoPoint(
  frame: TorsoFrame,
  local: { x: number; y: number; z: number }
): THREE.Vector3 {
  return frame.origin
    .clone()
    .add(frame.xAxis.clone().multiplyScalar(local.x * frame.width))
    .add(frame.yAxis.clone().multiplyScalar(local.y * frame.height))
    .add(frame.zAxis.clone().multiplyScalar(local.z * frame.depth));
}
