import { useCallback, useRef, useState } from "react";

export type GestureType = "point" | "incision" | "pinch" | "fist" | "spread" | "none";

interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface GestureState {
  type: GestureType;
  screenPosition: { x: number; y: number } | null;
  tracePath: { x: number; y: number }[];
  isActive: boolean;
}

function distance(a: HandLandmark, b: HandLandmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

function isFingerExtended(
  tip: HandLandmark,
  dip: HandLandmark,
  mcp: HandLandmark
): boolean {
  return distance(tip, mcp) > distance(dip, mcp) * 1.1;
}

export function useGestures(_videoWidth: number, viewerWidth: number) {
  const [gesture, setGesture] = useState<GestureState>({
    type: "none",
    screenPosition: null,
    tracePath: [],
    isActive: false,
  });
  const tracePathRef = useRef<{ x: number; y: number }[]>([]);
  const lastGestureRef = useRef<GestureType>("none");

  const processLandmarks = useCallback(
    (landmarks: HandLandmark[]) => {
      if (!landmarks || landmarks.length < 21) return;

      // Key landmarks
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const indexDip = landmarks[7];
      const indexMcp = landmarks[5];
      const middleTip = landmarks[12];
      const middleDip = landmarks[11];
      const middleMcp = landmarks[9];
      const ringTip = landmarks[16];
      const ringDip = landmarks[15];
      const ringMcp = landmarks[13];

      const indexExtended = isFingerExtended(indexTip, indexDip, indexMcp);
      const middleExtended = isFingerExtended(middleTip, middleDip, middleMcp);
      const ringExtended = isFingerExtended(ringTip, ringDip, ringMcp);

      // Pinch: thumb and index close together
      const pinchDist = distance(thumbTip, indexTip);
      const isPinch = pinchDist < 0.05;

      // Map hand position to viewer coordinates
      // Mirror X since webcam is mirrored
      const screenX = (1 - indexTip.x) * viewerWidth;
      const screenY = indexTip.y * (viewerWidth * 0.75); // approximate aspect ratio

      let type: GestureType = "none";

      if (isPinch) {
        type = "pinch";
        tracePathRef.current = [];
      } else if (indexExtended && !middleExtended && !ringExtended) {
        // Only index finger extended = point
        if (lastGestureRef.current === "point" || lastGestureRef.current === "incision") {
          // If we were already pointing and moving, it's an incision trace
          tracePathRef.current.push({ x: screenX, y: screenY });
          if (tracePathRef.current.length > 3) {
            type = "incision";
          } else {
            type = "point";
          }
        } else {
          type = "point";
          tracePathRef.current = [{ x: screenX, y: screenY }];
        }
      } else {
        tracePathRef.current = [];
      }

      lastGestureRef.current = type;

      setGesture({
        type,
        screenPosition: type !== "none" ? { x: screenX, y: screenY } : null,
        tracePath: [...tracePathRef.current],
        isActive: type !== "none",
      });
    },
    [viewerWidth]
  );

  const resetGesture = useCallback(() => {
    tracePathRef.current = [];
    lastGestureRef.current = "none";
    setGesture({ type: "none", screenPosition: null, tracePath: [], isActive: false });
  }, []);

  return { gesture, processLandmarks, resetGesture };
}
