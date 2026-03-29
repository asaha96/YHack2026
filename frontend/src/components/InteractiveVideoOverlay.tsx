import { useRef, useEffect, useCallback } from "react";
import type { GestureType } from "../hooks/useGestures";
import type { Modification } from "../utils/api";

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
  radius?: number;
  layer?: string;
  // For bones/muscles/ribs: start and end points for line rendering
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

export interface AgentLabel {
  organ: string;
  text: string;
  detail: string;
}

export type AnatomyLayer = "skeleton" | "organs" | "muscles" | "vascular" | "skin";

interface Props {
  videoElement: HTMLVideoElement | null;
  landmarks: Landmark[] | null;
  connections: number[][] | null;
  organPositions: Record<string, OrganOverlay> | null;
  agentLabels: AgentLabel[];
  width: number;
  height: number;
  selectedOrgan: string | null;
  cursorPosition: { x: number; y: number } | null;
  currentGesture: GestureType;
  modifications: Modification[];
  animationProgress: Map<number, number>;
  incisionTrace: { x: number; y: number }[];
  visibleLayers: Set<AnatomyLayer>;
  showLabels: boolean;
}

// Layer rendering colors — precomputed to avoid string ops in render loop
const LAYER_COLORS: Record<AnatomyLayer, {
  fill: string; selectedFill: string; stroke: string;
  dot: string; text: string; labelBorder: string;
}> = {
  skeleton: {
    fill: "rgba(245, 240, 232, 0.06)",
    selectedFill: "rgba(245, 240, 232, 0.22)",
    stroke: "rgba(245, 240, 232, 0.5)",
    dot: "#f5f0e8",
    text: "rgba(245, 240, 232, 0.9)",
    labelBorder: "rgba(245, 240, 232, 0.2)",
  },
  organs: {
    fill: "rgba(204, 119, 102, 0.10)",
    selectedFill: "rgba(204, 119, 102, 0.22)",
    stroke: "rgba(204, 119, 102, 0.6)",
    dot: "#cc7766",
    text: "rgba(204, 119, 102, 0.95)",
    labelBorder: "rgba(204, 119, 102, 0.2)",
  },
  muscles: {
    fill: "rgba(201, 64, 64, 0.08)",
    selectedFill: "rgba(201, 64, 64, 0.22)",
    stroke: "rgba(201, 64, 64, 0.5)",
    dot: "#c94040",
    text: "rgba(201, 64, 64, 0.9)",
    labelBorder: "rgba(201, 64, 64, 0.2)",
  },
  vascular: {
    fill: "rgba(68, 102, 204, 0.10)",
    selectedFill: "rgba(68, 102, 204, 0.22)",
    stroke: "rgba(68, 102, 204, 0.6)",
    dot: "#4466cc",
    text: "rgba(68, 102, 204, 0.95)",
    labelBorder: "rgba(68, 102, 204, 0.2)",
  },
  skin: {
    fill: "rgba(232, 190, 170, 0.04)",
    selectedFill: "rgba(232, 190, 170, 0.12)",
    stroke: "rgba(232, 190, 170, 0.3)",
    dot: "#e8beaa",
    text: "rgba(232, 190, 170, 0.8)",
    labelBorder: "rgba(232, 190, 170, 0.2)",
  },
};

const GESTURE_CURSOR_COLORS: Record<GestureType, string> = {
  point: "#94a3b8",
  pinch: "#2dd4bf",
  incision: "#ef4444",
  fist: "#f59e0b",
  spread: "#818cf8",
  rotate: "#a78bfa",
  zoom_in: "#34d399",
  zoom_out: "#f97316",
  pan: "#60a5fa",
  none: "transparent",
};

function getConnectionColor(a: number, b: number): string {
  if ([11, 12, 23, 24].includes(a) && [11, 12, 23, 24].includes(b))
    return "#22c55e";
  if (
    [11, 13, 15, 12, 14, 16].includes(a) &&
    [11, 13, 15, 12, 14, 16].includes(b)
  )
    return "#3b82f6";
  if (
    [23, 25, 27, 24, 26, 28].includes(a) &&
    [23, 25, 27, 24, 26, 28].includes(b)
  )
    return "#eab308";
  return "#a855f7";
}

export default function InteractiveVideoOverlay({
  videoElement,
  landmarks,
  connections,
  organPositions,
  agentLabels,
  width,
  height,
  selectedOrgan,
  cursorPosition,
  currentGesture,
  modifications,
  animationProgress,
  incisionTrace,
  visibleLayers,
  showLabels,
}: Props) {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const skeletonCanvasRef = useRef<HTMLCanvasElement>(null);
  const anatomyCanvasRef = useRef<HTMLCanvasElement>(null);
  const interactiveCanvasRef = useRef<HTMLCanvasElement>(null);

  // Mount/unmount the LiveKit video element
  useEffect(() => {
    const container = videoContainerRef.current;
    if (!container) return;

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

  // Draw pose skeleton overlay (MediaPipe connections)
  useEffect(() => {
    const canvas = skeletonCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    if (!landmarks) return;

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
        ctx.moveTo(lmA.x * width, lmA.y * height);
        ctx.lineTo(lmB.x * width, lmB.y * height);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    for (const lm of landmarks) {
      if (lm.visibility < 0.5) continue;
      ctx.beginPath();
      ctx.arc(lm.x * width, lm.y * height, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [landmarks, connections, width, height]);

  // Draw all anatomy layers on canvas
  useEffect(() => {
    const canvas = anatomyCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    if (!organPositions) return;

    // Group parts by layer
    const layerParts: Record<string, [string, OrganOverlay][]> = {};
    for (const [name, pos] of Object.entries(organPositions)) {
      const layer = pos.layer || "organs";
      if (!visibleLayers.has(layer as AnatomyLayer)) continue;
      if (!layerParts[layer]) layerParts[layer] = [];
      layerParts[layer].push([name, pos]);
    }

    // Render order: skin (back) → skeleton → muscles → vascular → organs (front)
    const renderOrder: AnatomyLayer[] = ["skin", "skeleton", "muscles", "vascular", "organs"];

    // Ensure no shadows leak from previous frames
    ctx.shadowBlur = 0;

    for (const layer of renderOrder) {
      const parts = layerParts[layer];
      if (!parts) continue;
      const colors = LAYER_COLORS[layer];

      for (const [name, pos] of parts) {
        // Off-screen culling — skip elements outside canvas bounds
        if (pos.x < -50 || pos.x > width + 50 || pos.y < -50 || pos.y > height + 50) continue;

        const isSelected = name === selectedOrgan;
        const radius = pos.radius ?? 10;

        // --- Skin: draw body outline ---
        if (layer === "skin" && pos.x1 != null && pos.y1 != null && pos.x2 != null && pos.y2 != null) {
          const padding = 10;
          ctx.beginPath();
          ctx.roundRect(
            Math.min(pos.x1, pos.x2) - padding,
            pos.y1 - padding,
            Math.abs(pos.x2 - pos.x1) + padding * 2,
            pos.y2 - pos.y1 + padding * 2,
            12,
          );
          ctx.fillStyle = colors.fill;
          ctx.fill();
          ctx.strokeStyle = colors.stroke;
          ctx.lineWidth = 1;
          ctx.stroke();
          continue;
        }

        // --- Bones/muscles with line segments ---
        if ((layer === "skeleton" || layer === "muscles") && pos.x1 != null && pos.y1 != null && pos.x2 != null && pos.y2 != null) {
          ctx.beginPath();
          ctx.moveTo(pos.x1, pos.y1);
          ctx.lineTo(pos.x2, pos.y2);
          ctx.strokeStyle = isSelected ? colors.dot : colors.stroke;
          ctx.lineWidth = isSelected ? 3 : layer === "skeleton" ? 2 : 1.5;
          ctx.stroke();

          // Midpoint dot
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, isSelected ? 5 : 3, 0, Math.PI * 2);
          ctx.fillStyle = colors.dot;
          ctx.fill();

          // Glow only for selected element
          if (isSelected) {
            ctx.shadowColor = colors.dot;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
          continue;
        }

        // --- Spine vertebrae (dots along spine) ---
        if (layer === "skeleton" && !pos.x1) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, isSelected ? 5 : 3, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? colors.dot : colors.stroke;
          ctx.fill();
          continue;
        }

        // --- Organs and vascular: ellipse zones ---
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, radius * 1.2, radius, 0, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? colors.selectedFill : colors.fill;
        ctx.fill();

        // Dot at center — no shadow for non-selected
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, isSelected ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = colors.dot;
        ctx.fill();

        // Glow + ring only for selected element
        if (isSelected) {
          ctx.shadowColor = "#2dd4bf";
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.ellipse(pos.x, pos.y, radius * 1.5, radius * 1.1, 0, 0, Math.PI * 2);
          ctx.strokeStyle = "#2dd4bf";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
    }
  }, [organPositions, selectedOrgan, visibleLayers, width, height]);

  // Draw interactive elements: cursor, incision trace, modifications
  useEffect(() => {
    const canvas = interactiveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    // Draw incision trace (live tracing)
    if (incisionTrace.length > 1) {
      ctx.beginPath();
      ctx.moveTo(incisionTrace[0].x, incisionTrace[0].y);
      for (let i = 1; i < incisionTrace.length; i++) {
        ctx.lineTo(incisionTrace[i].x, incisionTrace[i].y);
      }
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw modifications (from AI annotations)
    for (let i = 0; i < modifications.length; i++) {
      const mod = modifications[i];
      const progress = animationProgress.get(i) ?? 1;

      if (mod.type === "incision" && mod.coordinates.length >= 2) {
        const pts = mod.coordinates;
        const drawCount = Math.max(2, Math.floor(pts.length * progress));
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let j = 1; j < drawCount; j++) {
          ctx.lineTo(pts[j][0], pts[j][1]);
        }
        ctx.strokeStyle = mod.color || "#ef4444";
        ctx.lineWidth = 3;
        ctx.shadowColor = mod.color || "#ef4444";
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (mod.type === "zone" && mod.coordinates.length > 0) {
        const [cx, cy] = mod.coordinates[0];
        const r = (mod.radius ?? 20) * progress;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = (mod.color || "#f87171") + "30";
        ctx.fill();
        ctx.strokeStyle = mod.color || "#f87171";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (mod.type === "highlight" && mod.coordinates.length > 0) {
        const [cx, cy] = mod.coordinates[0];
        ctx.globalAlpha = progress;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fillStyle = mod.color || "#2dd4bf";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.strokeStyle = mod.color || "#2dd4bf";
        ctx.lineWidth = 1.5;
        ctx.shadowColor = mod.color || "#2dd4bf";
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    }

    // Draw gesture cursor
    if (cursorPosition && currentGesture !== "none") {
      const color = GESTURE_CURSOR_COLORS[currentGesture];
      const cursorSize = currentGesture === "incision" ? 6 : 10;

      ctx.beginPath();
      ctx.arc(cursorPosition.x, cursorPosition.y, cursorSize, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.arc(cursorPosition.x, cursorPosition.y, cursorSize + 6, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [
    cursorPosition, currentGesture,
    modifications, animationProgress, incisionTrace, width, height,
  ]);

  const getAgentLabelPosition = useCallback(
    (label: AgentLabel): { x: number; y: number } | null => {
      if (!organPositions) return null;
      const overlay = organPositions[label.organ];
      if (overlay) return { x: overlay.x, y: overlay.y };
      return null;
    },
    [organPositions]
  );

  // Collect visible label entries for HTML rendering
  const labelEntries: [string, OrganOverlay][] = [];
  if (organPositions && showLabels) {
    for (const [name, pos] of Object.entries(organPositions)) {
      const layer = (pos.layer || "organs") as AnatomyLayer;
      if (!visibleLayers.has(layer)) continue;
      // Skip skin — no point label
      if (layer === "skin") continue;
      labelEntries.push([name, pos]);
    }
  }

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
      {/* Video layer */}
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

      {/* Pose skeleton canvas */}
      <canvas
        ref={skeletonCanvasRef}
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

      {/* Anatomy layers canvas (bones, organs, muscles, vascular, skin) */}
      <canvas
        ref={anatomyCanvasRef}
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

      {/* Interactive canvas (cursor, incisions, modifications) */}
      <canvas
        ref={interactiveCanvasRef}
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

      {/* HTML labels for all visible body parts */}
      {labelEntries.map(([name, pos]) => {
        const layer = (pos.layer || "organs") as AnatomyLayer;
        const colors = LAYER_COLORS[layer];
        const isSelected = name === selectedOrgan;

        return (
          <div
            key={name}
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
            <span
              style={{
                fontSize: isSelected ? 11 : 9,
                fontFamily: "'JetBrains Mono', monospace",
                color: isSelected ? "#2dd4bf" : colors.text,
                background: isSelected
                  ? "rgba(0,0,0,0.75)"
                  : "rgba(0,0,0,0.5)",
                padding: isSelected ? "2px 7px" : "1px 5px",
                borderRadius: 3,
                whiteSpace: "nowrap",
                textShadow: "0 1px 2px rgba(0,0,0,0.9)",
                fontWeight: isSelected ? 600 : 400,
                border: isSelected
                  ? "1px solid rgba(45, 212, 191, 0.4)"
                  : `1px solid ${colors.labelBorder}`,
                transition: "all 0.15s ease",
                letterSpacing: "0.02em",
              }}
            >
              {pos.label}
            </span>
          </div>
        );
      })}

      {/* Modification labels (HTML) */}
      {modifications.map((mod, i) => {
        if (mod.type !== "label" && mod.type !== "zone") return null;
        if (!mod.label || mod.coordinates.length === 0) return null;
        const progress = animationProgress.get(i) ?? 1;
        if (progress < 0.1) return null;
        const [cx, cy] = mod.coordinates[0];
        return (
          <div
            key={`mod-label-${i}`}
            style={{
              position: "absolute",
              left: `${(cx / width) * 100}%`,
              top: `${(cy / height) * 100}%`,
              transform: "translate(-50%, -130%)",
              pointerEvents: "none",
              opacity: progress,
            }}
          >
            <div
              style={{
                background: "rgba(10, 10, 12, 0.8)",
                border: `1px solid ${mod.color || "rgba(45, 212, 191, 0.4)"}`,
                borderRadius: 6,
                padding: "4px 8px",
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                color: mod.color || "#2dd4bf",
                whiteSpace: "nowrap",
              }}
            >
              {mod.label}
            </div>
          </div>
        );
      })}

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
