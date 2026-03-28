import { useRef, useEffect, useCallback } from "react";

interface Landmark {
  index: number;
  name: string;
  x: number;
  y: number;
  z: number;
  visibility: number;
}

interface OrganOverlay {
  x: number;
  y: number;
  label: string;
}

export interface AgentLabel {
  organ: string;
  text: string;
  detail: string;
}

interface Props {
  /** LiveKit remote video element from track.attach() */
  videoElement: HTMLVideoElement | null;
  landmarks: Landmark[] | null;
  connections: number[][] | null;
  organPositions: Record<string, OrganOverlay> | null;
  agentLabels: AgentLabel[];
  width: number;
  height: number;
}

// Skeleton drawing colors by body region
function getConnectionColor(a: number, b: number): string {
  if ([11, 12, 23, 24].includes(a) && [11, 12, 23, 24].includes(b))
    return "#22c55e"; // torso green
  if (
    [11, 13, 15, 12, 14, 16].includes(a) &&
    [11, 13, 15, 12, 14, 16].includes(b)
  )
    return "#3b82f6"; // arms blue
  if (
    [23, 25, 27, 24, 26, 28].includes(a) &&
    [23, 25, 27, 24, 26, 28].includes(b)
  )
    return "#eab308"; // legs yellow
  return "#a855f7"; // head purple
}

export default function VideoOverlay({
  videoElement,
  landmarks,
  connections,
  organPositions,
  agentLabels,
  width,
  height,
}: Props) {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Mount/unmount the LiveKit video element into our container
  useEffect(() => {
    const container = videoContainerRef.current;
    if (!container) return;

    // Clear previous children
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    if (videoElement) {
      videoElement.style.width = "100%";
      videoElement.style.height = "100%";
      videoElement.style.objectFit = "contain";
      videoElement.style.borderRadius = "0";
      container.appendChild(videoElement);
    }

    return () => {
      if (videoElement && container.contains(videoElement)) {
        container.removeChild(videoElement);
      }
    };
  }, [videoElement]);

  // Draw skeleton overlay
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    if (!landmarks) return;

    const scaleX = width;
    const scaleY = height;

    // Draw connections (skeleton lines)
    if (connections) {
      ctx.lineWidth = 3;
      for (const [a, b] of connections) {
        const lmA = landmarks[a];
        const lmB = landmarks[b];
        if (!lmA || !lmB) continue;
        if (lmA.visibility < 0.5 || lmB.visibility < 0.5) continue;

        ctx.strokeStyle = getConnectionColor(a, b);
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(lmA.x * scaleX, lmA.y * scaleY);
        ctx.lineTo(lmB.x * scaleX, lmB.y * scaleY);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    // Draw landmark dots
    for (const lm of landmarks) {
      if (lm.visibility < 0.5) continue;
      const x = lm.x * scaleX;
      const y = lm.y * scaleY;

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [landmarks, connections, width, height]);

  // Find matching organ overlay position for agent labels
  const getAgentLabelPosition = useCallback(
    (label: AgentLabel): { x: number; y: number } | null => {
      if (!organPositions) return null;
      const overlay = organPositions[label.organ];
      if (overlay) return { x: overlay.x, y: overlay.y };
      return null;
    },
    [organPositions]
  );

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        background: "#000",
        borderRadius: 8,
      }}
    >
      {/* Video layer — LiveKit video element mounted here */}
      <div
        ref={videoContainerRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      />

      {/* Skeleton overlay canvas */}
      <canvas
        ref={overlayCanvasRef}
        width={width}
        height={height}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />

      {/* Organ label overlays */}
      {organPositions &&
        Object.entries(organPositions).map(([organ, pos]) => (
          <div
            key={organ}
            style={{
              position: "absolute",
              left: `${(pos.x / width) * 100}%`,
              top: `${(pos.y / height) * 100}%`,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "rgba(45, 212, 191, 0.8)",
                boxShadow: "0 0 12px rgba(45, 212, 191, 0.6)",
                animation: "dotPulse 2s ease-in-out infinite",
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                color: "rgba(255,255,255,0.85)",
                background: "rgba(0,0,0,0.5)",
                padding: "1px 6px",
                borderRadius: 4,
                whiteSpace: "nowrap",
                textShadow: "0 1px 2px rgba(0,0,0,0.8)",
              }}
            >
              {pos.label}
            </span>
          </div>
        ))}

      {/* Agent labels */}
      {agentLabels.map((label, i) => {
        const pos = getAgentLabelPosition(label);
        if (!pos) return null;

        return (
          <div
            key={`agent-${i}`}
            style={{
              position: "absolute",
              left: `${(pos.x / width) * 100}%`,
              top: `${(pos.y / height) * 100}%`,
              transform: "translate(-50%, -120%)",
              pointerEvents: "none",
              maxWidth: 200,
            }}
          >
            <div
              style={{
                background: "rgba(45, 212, 191, 0.15)",
                border: "1px solid rgba(45, 212, 191, 0.4)",
                borderRadius: 8,
                padding: "6px 10px",
                backdropFilter: "blur(8px)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#2dd4bf",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {label.text}
              </div>
              {label.detail && (
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.7)",
                    marginTop: 2,
                    lineHeight: 1.3,
                  }}
                >
                  {label.detail}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* No detection indicator */}
      {landmarks === null && videoElement && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.6)",
            color: "rgba(255,255,255,0.6)",
            padding: "6px 16px",
            borderRadius: 20,
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          No person detected
        </div>
      )}
    </div>
  );
}
