import { useCallback, useRef } from "react";

interface OrganOverlay {
  x: number;
  y: number;
  label: string;
  radius?: number;
}

interface HitResult {
  organName: string;
  position: { x: number; y: number };
  label: string;
}

const DEFAULT_HIT_RADIUS_FACTOR = 0.06;

/**
 * 2D organ hit-testing hook.
 * Replaces Three.js raycasting for the live video overlay.
 * Maps hand gesture screen positions to the nearest organ
 * using the 2D overlay positions from pose detection.
 */
export function useOrganHitTest() {
  const organPositionsRef = useRef<Record<string, OrganOverlay> | null>(null);
  const viewSizeRef = useRef({ width: 1280, height: 720 });

  const updatePositions = useCallback(
    (positions: Record<string, OrganOverlay> | null, viewWidth: number, viewHeight: number) => {
      organPositionsRef.current = positions;
      viewSizeRef.current = { width: viewWidth, height: viewHeight };
    },
    []
  );

  /**
   * Hit-test a screen position against organ overlay positions.
   * @param screenX - X position in HandTracker coordinates (0-640)
   * @param screenY - Y position in HandTracker coordinates (0-480)
   * @returns The closest organ within hit radius, or null
   */
  const hitTest = useCallback(
    (screenX: number, screenY: number): HitResult | null => {
      const positions = organPositionsRef.current;
      if (!positions) return null;

      const { width: viewW, height: viewH } = viewSizeRef.current;

      // Scale hand tracker coords (640x480) to view coords
      const scaledX = (screenX / 640) * viewW;
      const scaledY = (screenY / 480) * viewH;

      let closest: HitResult | null = null;
      let closestDistSq = Infinity;

      const defaultRadius = viewW * DEFAULT_HIT_RADIUS_FACTOR;

      for (const [organ, pos] of Object.entries(positions)) {
        const hitRadius = pos.radius ?? defaultRadius;
        const hitRadiusSq = hitRadius * hitRadius;
        const dx = scaledX - pos.x;
        const dy = scaledY - pos.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < hitRadiusSq && distSq < closestDistSq) {
          closestDistSq = distSq;
          closest = {
            organName: organ,
            position: { x: pos.x, y: pos.y },
            label: pos.label,
          };
        }
      }

      return closest;
    },
    []
  );

  return { hitTest, updatePositions };
}
