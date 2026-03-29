import * as THREE from "three";
import type { TorsoFrame } from "./torsoFrame";

export function smoothScalar(current: number, target: number, alpha: number): number {
  return current + (target - current) * alpha;
}

export function smoothVectorMap(
  previous: Map<string, THREE.Vector3>,
  target: Map<string, THREE.Vector3>,
  alpha: number
): Map<string, THREE.Vector3> {
  const next = new Map<string, THREE.Vector3>();

  for (const [key, value] of target) {
    const smoothed = previous.get(key)?.clone() ?? value.clone();
    smoothed.lerp(value, alpha);
    next.set(key, smoothed);
  }

  return next;
}

export function cloneTorsoFrame(frame: TorsoFrame): TorsoFrame {
  return {
    origin: frame.origin.clone(),
    hipCenter: frame.hipCenter.clone(),
    shoulderCenter: frame.shoulderCenter.clone(),
    torsoCenter: frame.torsoCenter.clone(),
    xAxis: frame.xAxis.clone(),
    yAxis: frame.yAxis.clone(),
    zAxis: frame.zAxis.clone(),
    width: frame.width,
    height: frame.height,
    depth: frame.depth,
  };
}

export function smoothTorsoFrame(
  current: TorsoFrame | null,
  target: TorsoFrame,
  alpha: number
): TorsoFrame {
  if (!current) return cloneTorsoFrame(target);

  const xAxis = current.xAxis.clone().lerp(target.xAxis, alpha);
  const yAxis = current.yAxis.clone().lerp(target.yAxis, alpha);
  let zAxis = current.zAxis.clone().lerp(target.zAxis, alpha);

  if (xAxis.lengthSq() < 1e-8) xAxis.copy(target.xAxis);
  if (yAxis.lengthSq() < 1e-8) yAxis.copy(target.yAxis);
  if (zAxis.lengthSq() < 1e-8) zAxis.copy(target.zAxis);

  xAxis.normalize();
  yAxis.normalize();
  zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis);
  if (zAxis.lengthSq() < 1e-8) {
    zAxis.copy(target.zAxis);
  } else {
    zAxis.normalize();
  }

  const orthoXAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
  const orthoYAxis = new THREE.Vector3().crossVectors(zAxis, orthoXAxis).normalize();

  return {
    origin: current.origin.clone().lerp(target.origin, alpha),
    hipCenter: current.hipCenter.clone().lerp(target.hipCenter, alpha),
    shoulderCenter: current.shoulderCenter.clone().lerp(target.shoulderCenter, alpha),
    torsoCenter: current.torsoCenter.clone().lerp(target.torsoCenter, alpha),
    xAxis: orthoXAxis,
    yAxis: orthoYAxis,
    zAxis,
    width: smoothScalar(current.width, target.width, alpha),
    height: smoothScalar(current.height, target.height, alpha),
    depth: smoothScalar(current.depth, target.depth, alpha),
  };
}
