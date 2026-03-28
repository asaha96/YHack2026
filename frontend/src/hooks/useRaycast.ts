import { useCallback } from "react";
import * as THREE from "three";

export interface RaycastResult {
  point: THREE.Vector3;
  organName: string;
  normal: THREE.Vector3;
}

export function useRaycast(
  camera: THREE.Camera | null,
  scene: THREE.Scene | null
) {
  const raycast = useCallback(
    (screenX: number, screenY: number, canvasRect: DOMRect): RaycastResult | null => {
      if (!camera || !scene) return null;

      const mouse = new THREE.Vector2(
        ((screenX - canvasRect.left) / canvasRect.width) * 2 - 1,
        -((screenY - canvasRect.top) / canvasRect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(scene.children, true);
      if (intersects.length === 0) return null;

      const hit = intersects[0];
      const organName = hit.object.userData?.organName || hit.object.name || "unknown";

      return {
        point: hit.point,
        organName,
        normal: hit.face?.normal || new THREE.Vector3(0, 1, 0),
      };
    },
    [camera, scene]
  );

  return { raycast };
}
