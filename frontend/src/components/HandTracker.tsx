import { useEffect, useRef, useState } from "react";
import type { GestureType } from "../hooks/useGestures";

interface Props {
  onGesture: (
    type: GestureType,
    screenPos: { x: number; y: number } | null,
    tracePath: { x: number; y: number }[]
  ) => void;
  enabled: boolean;
}

const GESTURE_LABELS: Record<GestureType, string> = {
  point: "Inspect", pinch: "Select", incision: "Incision",
  fist: "Retract", spread: "Zoom", none: "",
};

const GESTURE_COLORS: Record<GestureType, string> = {
  point: "var(--text-secondary)", pinch: "var(--accent)", incision: "var(--risk-high)",
  fist: "var(--risk-medium)", spread: "var(--accent-secondary)", none: "",
};

export default function HandTracker({ onGesture, enabled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentGesture, setCurrentGesture] = useState<GestureType>("none");
  const handsRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const lastGestureRef = useRef<GestureType>("none");
  const tracePathRef = useRef<{ x: number; y: number }[]>([]);
  const smoothBufferRef = useRef<{ x: number; y: number }[]>([]);
  // Stability: require N consecutive frames of same gesture before switching
  const gestureCountRef = useRef<{ type: GestureType; count: number }>({ type: "none", count: 0 });
  const SMOOTH_FRAMES = 5;
  const STABILITY_FRAMES = 3; // need 3 consecutive frames to confirm a new gesture

  useEffect(() => {
    if (!enabled) return;
    let stream: MediaStream | null = null;
    let cancelled = false;

    const init = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try { await videoRef.current.play(); } catch (e: any) { if (e.name === "AbortError") return; throw e; }
          if (cancelled) return;
          setIsActive(true);
        }

        await new Promise<void>((resolve, reject) => {
          if ((window as any).Hands) { resolve(); return; }
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
          script.crossOrigin = "anonymous";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load MediaPipe Hands"));
          document.head.appendChild(script);
        });

        const HandsClass = (window as any).Hands;
        if (!HandsClass) throw new Error("MediaPipe Hands not available");
        const hands = new HandsClass({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
        hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.65, minTrackingConfidence: 0.55 });
        hands.onResults((results: any) => { drawHand(results); processGesture(results); });
        handsRef.current = hands;

        const processFrame = async () => {
          if (videoRef.current && handsRef.current && videoRef.current.readyState >= 2) {
            await handsRef.current.send({ image: videoRef.current });
          }
          animFrameRef.current = requestAnimationFrame(processFrame);
        };
        processFrame();
      } catch (e: any) { setError(e.message || "Failed to access camera"); }
    };
    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (videoRef.current) { videoRef.current.pause(); videoRef.current.srcObject = null; }
      handsRef.current?.close();
    };
  }, [enabled]);

  const drawHand = (results: any) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    if (results.multiHandLandmarks) {
      for (const landmarks of results.multiHandLandmarks) {
        const connections = [
          [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
          [0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],
          [0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17],
        ];
        ctx.strokeStyle = GESTURE_COLORS[currentGesture] || "#2dd4bf";
        ctx.lineWidth = 2;
        for (const [i, j] of connections) {
          const a = landmarks[i]; const b = landmarks[j];
          ctx.beginPath();
          ctx.moveTo((1 - a.x) * canvas.width, a.y * canvas.height);
          ctx.lineTo((1 - b.x) * canvas.width, b.y * canvas.height);
          ctx.stroke();
        }
        for (const lm of landmarks) {
          ctx.fillStyle = GESTURE_COLORS[currentGesture] || "#2dd4bf";
          ctx.beginPath();
          ctx.arc((1 - lm.x) * canvas.width, lm.y * canvas.height, 3, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
  };

  const processGesture = (results: any) => {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      if (lastGestureRef.current !== "none") {
        if (lastGestureRef.current === "incision" && tracePathRef.current.length > 5) {
          onGesture("incision", null, [...tracePathRef.current]);
        }
        tracePathRef.current = [];
        lastGestureRef.current = "none";
        gestureCountRef.current = { type: "none", count: 0 };
        setCurrentGesture("none");
        onGesture("none", null, []);
      }
      return;
    }

    const lm = results.multiHandLandmarks[0];
    const wrist = lm[0];
    const thumbTip = lm[4]; const thumbIp = lm[3];
    const indexTip = lm[8]; const indexPip = lm[6]; const indexMcp = lm[5];
    const middleTip = lm[12]; const middlePip = lm[10]; const middleMcp = lm[9];
    const ringTip = lm[16]; const ringPip = lm[14]; const ringMcp = lm[13];
    const pinkyTip = lm[20]; const pinkyPip = lm[18]; const pinkyMcp = lm[17];

    // Distance helper (2D — z is noisy from mediapipe)
    const dist2d = (a: any, b: any) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

    // Finger extended: tip is further from wrist than PIP joint
    // Using PIP (not DIP) for more reliable detection — larger difference
    const isUp = (tip: any, pip: any) => {
      const tipDist = dist2d(tip, wrist);
      const pipDist = dist2d(pip, wrist);
      return tipDist > pipDist * 1.05; // very forgiving threshold
    };

    const indexUp = isUp(indexTip, indexPip);
    const middleUp = isUp(middleTip, middlePip);
    const ringUp = isUp(ringTip, ringPip);
    const pinkyUp = isUp(pinkyTip, pinkyPip);
    const thumbOut = dist2d(thumbTip, wrist) > dist2d(thumbIp, wrist) * 1.05;

    const pinchDist = dist2d(thumbTip, indexTip);
    const fingersUp = [indexUp, middleUp, ringUp, pinkyUp].filter(Boolean).length;

    // Smoothed screen position
    const rawX = (1 - indexTip.x) * 640;
    const rawY = indexTip.y * 480;
    smoothBufferRef.current.push({ x: rawX, y: rawY });
    if (smoothBufferRef.current.length > SMOOTH_FRAMES) smoothBufferRef.current.shift();
    const pos = smoothBufferRef.current.reduce(
      (acc, p) => ({ x: acc.x + p.x / smoothBufferRef.current.length, y: acc.y + p.y / smoothBufferRef.current.length }),
      { x: 0, y: 0 }
    );

    // Detect raw gesture for this frame
    let rawGesture: GestureType = "none";

    if (pinchDist < 0.07) {
      // Thumb and index close = PINCH (select)
      rawGesture = "pinch";
    } else if (fingersUp === 0 && !thumbOut) {
      // All curled = FIST (retract)
      rawGesture = "fist";
    } else if (indexUp && middleUp && !ringUp && !pinkyUp) {
      // Peace sign = INCISION
      rawGesture = "incision";
    } else if (indexUp && !middleUp && !ringUp && !pinkyUp) {
      // Index only = POINT (inspect)
      rawGesture = "point";
    } else if (fingersUp >= 3 && thumbOut) {
      // Open hand = no gesture (navigate)
      rawGesture = "none";
    }

    // Stability check: only switch gesture after N consecutive same frames
    if (rawGesture === gestureCountRef.current.type) {
      gestureCountRef.current.count++;
    } else {
      gestureCountRef.current = { type: rawGesture, count: 1 };
    }

    // Don't switch until stable (except for incision traces which need responsiveness)
    const isStable = gestureCountRef.current.count >= STABILITY_FRAMES;
    const confirmedGesture = isStable ? rawGesture : lastGestureRef.current;

    // Handle incision tracing (needs to be responsive, skip stability for trace updates)
    if (rawGesture === "incision" && lastGestureRef.current === "incision") {
      tracePathRef.current.push(pos);
      onGesture("incision", pos, [...tracePathRef.current]);
      return; // don't go through the rest, just keep tracing
    }

    if (!isStable) return; // wait for stability

    // End previous incision if switching away
    if (lastGestureRef.current === "incision" && confirmedGesture !== "incision") {
      if (tracePathRef.current.length > 5) {
        onGesture("incision", null, [...tracePathRef.current]);
      }
      tracePathRef.current = [];
    }

    // Apply confirmed gesture
    if (confirmedGesture !== lastGestureRef.current || confirmedGesture === "point" || confirmedGesture === "pinch") {
      lastGestureRef.current = confirmedGesture;
      setCurrentGesture(confirmedGesture);

      if (confirmedGesture === "incision") {
        tracePathRef.current = [pos];
        onGesture("incision", pos, [pos]);
      } else if (confirmedGesture === "none") {
        smoothBufferRef.current = [];
        onGesture("none", null, []);
      } else {
        onGesture(confirmedGesture, pos, []);
      }
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <video ref={videoRef} style={{ display: "none" }} playsInline muted />
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", borderRadius: 8, objectFit: "cover" }} />
      {!isActive && !error && enabled && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "var(--text-muted)", fontSize: "0.8rem" }}>
          Initializing camera...
        </div>
      )}
      {error && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "var(--risk-high)", fontSize: "0.8rem", textAlign: "center", padding: "0 1rem" }}>
          {error}<br /><small style={{ color: "var(--text-muted)" }}>Use mouse controls instead</small>
        </div>
      )}
      {isActive && (
        <>
          <div style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: "50%", backgroundColor: currentGesture !== "none" ? GESTURE_COLORS[currentGesture] : "#34d399" }} />
          {currentGesture !== "none" && (
            <div style={{
              position: "absolute", bottom: 5, left: 5, padding: "2px 7px", borderRadius: 5,
              backgroundColor: "rgba(10, 10, 12, 0.85)",
              border: `1px solid ${GESTURE_COLORS[currentGesture]}`,
              fontSize: "0.58rem", fontWeight: 600, color: GESTURE_COLORS[currentGesture],
              textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              {GESTURE_LABELS[currentGesture]}
            </div>
          )}
        </>
      )}
    </div>
  );
}
