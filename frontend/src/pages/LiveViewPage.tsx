import { useState, useEffect, useCallback, useRef } from "react";
import { useLiveKit } from "../hooks/useLiveKit";
import type { AgentLabel } from "../hooks/useLiveKit";
import InteractiveVideoOverlay from "../components/InteractiveVideoOverlay";
import type { AnatomyLayer } from "../components/InteractiveVideoOverlay";
import RoomSetup from "../components/RoomSetup";
import HandTracker from "../components/HandTracker";
import NarrationPlayer from "../components/NarrationPlayer";
import { useAnnotationSync } from "../hooks/useAnnotationSync";
import { useOrganHitTest } from "../hooks/useOrganHitTest";
import { API_BASE, sendChat } from "../utils/api";
import type { Modification } from "../utils/api";
import type { GestureType } from "../hooks/useGestures";

// Named constants
const PINCH_DEBOUNCE_MS = 2000;
const GESTURE_DEBOUNCE_MS = 3000;
const HAND_TRACKER_WIDTH = 640;
const HAND_TRACKER_HEIGHT = 480;

function generateRoomName(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function LiveViewPage() {
  const [roomName] = useState(() => generateRoomName());
  const [handTrackingEnabled, setHandTrackingEnabled] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [visibleLayers, setVisibleLayers] = useState<Set<AnatomyLayer>>(
    () => new Set(["organs", "skeleton", "vascular"])
  );

  const toggleLayer = useCallback((layer: AnatomyLayer) => {
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) {
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return next;
    });
  }, []);

  // LiveKit connection
  const {
    connectionState,
    connect,
    remoteVideoElement,
    phoneConnected,
    lastPoseUpdate,
    lastAgentLabels,
    sendData,
  } = useLiveKit();

  // Derived pose state
  const landmarks = lastPoseUpdate?.landmarks ?? null;
  const connections = lastPoseUpdate?.connections ?? null;
  const organPositions = lastPoseUpdate?.overlay_2d ?? null;
  const frameSize = {
    w: lastPoseUpdate?.frame_width ?? 1280,
    h: lastPoseUpdate?.frame_height ?? 720,
  };
  const agentLabels: AgentLabel[] = lastAgentLabels?.labels ?? [];

  const streaming = phoneConnected && remoteVideoElement !== null;

  // Annotation sync
  const { visibleMods, animationProgress, playAnnotations } = useAnnotationSync();
  const [historicMods, setHistoricMods] = useState<Modification[]>([]);
  const allVisibleMods = [...historicMods, ...visibleMods];

  // Organ hit-testing (replaces Three.js raycasting)
  const { hitTest, updatePositions } = useOrganHitTest();

  // Container sizing
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewSize, setViewSize] = useState({ width: 1280, height: 720 });

  useEffect(() => {
    updatePositions(organPositions, viewSize.width, viewSize.height);
  }, [organPositions, viewSize, updatePositions]);

  // Surgical interaction state
  const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [currentGesture, setCurrentGesture] = useState<GestureType>("none");
  const [incisionTrace, setIncisionTrace] = useState<{ x: number; y: number }[]>([]);
  const [narrationText, setNarrationText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(`session-${Date.now()}`);

  // ── Refs for callback stabilization ──
  // These allow callbacks to read latest values without re-creating
  const selectedOrganRef = useRef(selectedOrgan);
  const organPositionsRef = useRef(organPositions);
  const visibleModsRef = useRef(visibleMods);
  const viewSizeRef = useRef(viewSize);

  useEffect(() => { selectedOrganRef.current = selectedOrgan; }, [selectedOrgan]);
  useEffect(() => { organPositionsRef.current = organPositions; }, [organPositions]);
  useEffect(() => { visibleModsRef.current = visibleMods; }, [visibleMods]);
  useEffect(() => { viewSizeRef.current = viewSize; }, [viewSize]);

  // Action context accumulation
  const actionContextRef = useRef<string[]>([]);
  const lastGestureActionRef = useRef<number>(0);

  // Speech recognition
  const recognitionRef = useRef<any>(null);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [speechUnsupported, setSpeechUnsupported] = useState(false);

  // Connect to LiveKit room on mount
  useEffect(() => {
    connect(roomName, `laptop-${Date.now().toString(36)}`, "laptop").catch(
      (err) => console.error("LiveKit connect error:", err)
    );
  }, [roomName, connect]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const aspect = frameSize.w / frameSize.h;
        const maxW = width - 32;
        const maxH = height - 120;
        if (maxW / aspect <= maxH) {
          setViewSize({ width: maxW, height: Math.round(maxW / aspect) });
        } else {
          setViewSize({ width: Math.round(maxH * aspect), height: maxH });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [frameSize.w, frameSize.h]);

  // Setup speech recognition once
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSpeechUnsupported(true);
      return;
    }
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setIsVoiceListening(false);
      handleVoiceInput(transcript);
    };
    recognition.onerror = () => setIsVoiceListening(false);
    recognition.onend = () => setIsVoiceListening(false);
    recognitionRef.current = recognition;
  }, []);

  // Voice input handler — reads refs to avoid stale closures
  const handleVoiceInput = useCallback(async (transcript: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/guide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          selected_structure: selectedOrganRef.current,
          existing_annotations: [],
          camera_region: `User said: "${transcript}". Recent actions: ${actionContextRef.current.slice(-5).join("; ")}`,
        }),
      });
      const guide = await res.json();

      if (guide.narration) setNarrationText(guide.narration);

      if (guide.new_annotations?.length) {
        const positions = organPositionsRef.current;
        const size = viewSizeRef.current;
        const mods: Modification[] = guide.new_annotations.map((ann: any, i: number) => {
          const organPos = positions?.[ann.organ || selectedOrganRef.current || ""];
          const coords = organPos
            ? [[organPos.x, organPos.y]]
            : [[size.width / 2, size.height / 2]];

          return {
            type: ann.type === "danger" ? "zone" as const : ann.type === "action" ? "highlight" as const : "label" as const,
            coordinates: coords,
            color: ann.type === "danger" ? "#f87171" : ann.type === "action" ? "#2dd4bf" : "#818cf8",
            label: ann.label || "",
            delay_ms: i * 1000,
            duration_ms: 600,
            animation: "pulse" as const,
          };
        });
        setHistoricMods((prev) => [...prev, ...visibleModsRef.current]);
        playAnnotations(mods);
      }

      sendData({ text: transcript }, "speech");
      actionContextRef.current = [];
    } catch {
      setNarrationText("Couldn't reach the AI guide. Try again.");
    }
    setIsLoading(false);
  }, [sessionId, playAnnotations, sendData]);

  // Handle chat messages (for fist/spread gestures) — reads refs
  const handleChatMessage = useCallback(async (message: string) => {
    setIsLoading(true);
    try {
      const response = await sendChat(sessionId, message);
      setNarrationText(response.narration);

      if (response.modifications?.length) {
        const positions = organPositionsRef.current;
        const mods2d: Modification[] = response.modifications.map((mod) => {
          const organPos = positions?.[selectedOrganRef.current || ""];
          const coords = organPos
            ? [[organPos.x, organPos.y]]
            : mod.coordinates;
          return { ...mod, coordinates: coords };
        });
        setHistoricMods((prev) => [...prev, ...visibleModsRef.current]);
        playAnnotations(mods2d);
      }
    } catch {
      setNarrationText("Couldn't reach the AI. Try again.");
    }
    setIsLoading(false);
  }, [sessionId, playAnnotations]);

  // Handle organ selection (pinch)
  const handleOrganSelect = useCallback((organName: string) => {
    setSelectedOrgan(organName);
    actionContextRef.current.push(`Selected ${organName.replace(/_/g, " ")}`);

    sendData({ type: "select", organ: organName }, "gesture_action");

    setIsVoiceListening(true);
    try {
      recognitionRef.current?.start();
    } catch {
      // Browser may block non-user-gesture start
    }
  }, [sendData]);

  // Handle incision completion — reads ref for visibleMods
  const handleIncisionComplete = useCallback((organName: string, tracePoints: { x: number; y: number }[]) => {
    setSelectedOrgan(organName);
    actionContextRef.current.push(`Traced incision on ${organName.replace(/_/g, " ")} (${tracePoints.length} points)`);

    sendData({ type: "incision", organ: organName, pointCount: tracePoints.length }, "gesture_action");

    const coords = tracePoints.map((p) => [p.x, p.y]);
    const mods: Modification[] = [{
      type: "incision",
      coordinates: coords,
      color: "#f87171",
      label: "Incision",
      delay_ms: 0,
      duration_ms: 300,
      animation: "draw",
    }];
    setHistoricMods((prev) => [...prev, ...visibleModsRef.current]);
    playAnnotations(mods);
    setIncisionTrace([]);
  }, [playAnnotations, sendData]);

  // Request agent analysis
  const requestAgent = useCallback(() => {
    sendData({}, "request_agent");
  }, [sendData]);

  // Toggle speech manually
  const toggleSpeech = useCallback(() => {
    if (isVoiceListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsVoiceListening(false);
      return;
    }
    if (speechUnsupported) return;

    setIsVoiceListening(true);
    try {
      recognitionRef.current?.start();
    } catch {
      setIsVoiceListening(false);
    }
  }, [isVoiceListening, speechUnsupported]);

  // Gesture handler — reads refs for selectedOrgan and viewSize
  const handleGesture = useCallback(
    (type: GestureType, screenPos: { x: number; y: number } | null, tracePath: { x: number; y: number }[]) => {
      const now = Date.now();
      const size = viewSizeRef.current;

      // Scale hand tracker coords to view coords for cursor display
      const scaledPos = screenPos
        ? { x: (screenPos.x / HAND_TRACKER_WIDTH) * size.width, y: (screenPos.y / HAND_TRACKER_HEIGHT) * size.height }
        : null;

      // Update cursor and gesture state
      if (scaledPos && type !== "none") {
        setCursorPosition(scaledPos);
        setCurrentGesture(type);
      } else if (type === "none") {
        setCursorPosition(null);
        setCurrentGesture("none");
      }

      // POINT: hover/inspect — highlight nearest organ
      if (type === "point" && screenPos) {
        const hit = hitTest(screenPos.x, screenPos.y);
        if (hit && hit.organName !== selectedOrganRef.current) {
          setSelectedOrgan(hit.organName);
        }
      }

      // PINCH: select organ and trigger voice listening
      else if (type === "pinch" && screenPos) {
        if (now - lastGestureActionRef.current > PINCH_DEBOUNCE_MS) {
          const hit = hitTest(screenPos.x, screenPos.y);
          if (hit) {
            lastGestureActionRef.current = now;
            handleOrganSelect(hit.organName);
          }
        }
      }

      // FIST: retract tissue — ask AI about what's beneath
      else if (type === "fist" && screenPos) {
        if (now - lastGestureActionRef.current > GESTURE_DEBOUNCE_MS) {
          const hit = hitTest(screenPos.x, screenPos.y);
          const target = selectedOrganRef.current || hit?.organName;
          if (target) {
            lastGestureActionRef.current = now;
            handleChatMessage(
              `I'm retracting tissue near the ${target.replace(/_/g, " ")}. What structures would be exposed beneath and what are the risks?`
            );
          }
        }
      }

      // SPREAD: zoom into area — ask AI for detail
      else if (type === "spread" && screenPos) {
        if (now - lastGestureActionRef.current > GESTURE_DEBOUNCE_MS) {
          const hit = hitTest(screenPos.x, screenPos.y);
          const target = selectedOrganRef.current || hit?.organName;
          if (target) {
            lastGestureActionRef.current = now;
            handleChatMessage(
              `Zoom in on the ${target.replace(/_/g, " ")} — give me a detailed view of the vasculature and any anomalies in this area.`
            );
          }
        }
      }

      // INCISION: trace line on video (visual feedback while tracing)
      else if (type === "incision" && screenPos && tracePath.length > 1) {
        const scaledTrace = tracePath.map((p) => ({
          x: (p.x / HAND_TRACKER_WIDTH) * size.width,
          y: (p.y / HAND_TRACKER_HEIGHT) * size.height,
        }));
        setIncisionTrace(scaledTrace);
      }

      // INCISION COMPLETE: fingers lifted after tracing
      if (type === "incision" && tracePath.length > 5 && !screenPos) {
        const scaledTrace = tracePath.map((p) => ({
          x: (p.x / HAND_TRACKER_WIDTH) * size.width,
          y: (p.y / HAND_TRACKER_HEIGHT) * size.height,
        }));

        const midPoint = tracePath[Math.floor(tracePath.length / 2)];
        const hit = hitTest(midPoint.x, midPoint.y);
        const traceOrgan = hit?.organName || selectedOrganRef.current || "anatomy";

        handleIncisionComplete(traceOrgan, scaledTrace);
      }
    },
    [hitTest, handleOrganSelect, handleChatMessage, handleIncisionComplete]
  );

  // Use narration from agent labels (LiveKit data channel)
  const agentNarration = lastAgentLabels?.narration ?? "";
  const displayNarration = narrationText || agentNarration;

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--page-gradient)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-sans)",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          borderBottom: "1px solid var(--border)",
          background: "rgba(255,252,247,0.72)",
          backdropFilter: "blur(12px)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: "var(--text-primary)",
              fontFamily: "var(--font-serif)",
              letterSpacing: "-0.04em",
            }}
          >
            Praxis
          </span>
          <span
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            LIVE
          </span>
          <span
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
              background: "rgba(255,255,255,0.46)",
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid var(--border)",
            }}
          >
            Room: {roomName}
          </span>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: connectionState === "connected" ? "var(--risk-low)" : "var(--risk-medium)",
              boxShadow: connectionState === "connected"
                ? "0 0 8px var(--risk-low)"
                : "0 0 8px var(--risk-medium)",
            }}
          />
          {selectedOrgan && (
            <span
              style={{
                fontSize: 11,
                color: "var(--accent-light)",
                fontFamily: "var(--font-mono)",
                background: "var(--accent-dim)",
                padding: "3px 10px",
                borderRadius: 999,
                border: "1px solid var(--border)",
              }}
            >
              {selectedOrgan.replace(/_/g, " ")}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {/* Layer toggles */}
          {([
            ["skeleton", "Skeleton", "#f5f0e8"],
            ["organs", "Organs", "#cc7766"],
            ["muscles", "Muscles", "#c94040"],
            ["vascular", "Vascular", "#4466cc"],
            ["skin", "Skin", "#e8beaa"],
          ] as [AnatomyLayer, string, string][]).map(([layer, label, color]) => (
            <button
              key={layer}
              onClick={() => toggleLayer(layer)}
              style={{
                padding: "5px 10px",
                borderRadius: 999,
                border: `1px solid ${visibleLayers.has(layer) ? color + "60" : "var(--border)"}`,
                background: visibleLayers.has(layer)
                  ? color + "18"
                  : "rgba(255,255,255,0.42)",
                color: visibleLayers.has(layer) ? color : "var(--text-secondary)",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {label}
            </button>
          ))}

          <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 2px" }} />

          <button
            onClick={() => setShowLabels((p) => !p)}
            style={{
              padding: "5px 10px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: showLabels
                ? "var(--accent-dim)"
                : "rgba(255,255,255,0.42)",
              color: showLabels ? "var(--accent-light)" : "var(--text-secondary)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
            }}
          >
            Labels
          </button>

          <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 2px" }} />

          <button
            onClick={() => setHandTrackingEnabled((p) => !p)}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: handTrackingEnabled
                ? "var(--accent-dim)"
                : "rgba(255,255,255,0.42)",
              color: handTrackingEnabled
                ? "var(--accent-light)"
                : "var(--text-secondary)",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
            }}
          >
            {handTrackingEnabled ? "Tracking" : "Hands"}
          </button>

          <button
            onClick={toggleSpeech}
            title={speechUnsupported ? "Speech recognition not supported in this browser" : ""}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: isVoiceListening
                ? "color-mix(in srgb, var(--risk-high) 18%, white)"
                : speechUnsupported
                  ? "rgba(255,255,255,0.3)"
                  : "rgba(255,255,255,0.42)",
              color: isVoiceListening
                ? "var(--risk-high)"
                : speechUnsupported
                  ? "var(--text-muted)"
                  : "var(--text-secondary)",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              cursor: speechUnsupported ? "not-allowed" : "pointer",
              textDecoration: speechUnsupported ? "line-through" : "none",
            }}
          >
            {isVoiceListening ? "Listening..." : speechUnsupported ? "Mic N/A" : "Mic"}
          </button>

          <button
            onClick={requestAgent}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,0.42)",
              color: "var(--text-secondary)",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
            }}
          >
            Analyze
          </button>

          <NarrationPlayer text={narrationText} autoPlay={true} onAgentMessage={() => {}} />
        </div>
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {!streaming ? (
          <RoomSetup
            roomCode={roomName}
            phoneConnected={phoneConnected}
            streaming={streaming}
          />
        ) : (
          <div style={{ position: "relative" }}>
            <InteractiveVideoOverlay
              videoElement={remoteVideoElement}
              landmarks={landmarks}
              connections={connections}
              organPositions={organPositions}
              agentLabels={agentLabels}
              width={viewSize.width}
              height={viewSize.height}
              selectedOrgan={selectedOrgan}
              cursorPosition={cursorPosition}
              currentGesture={currentGesture}
              modifications={allVisibleMods}
              animationProgress={animationProgress}
              incisionTrace={incisionTrace}
              visibleLayers={visibleLayers}
              showLabels={showLabels}
            />

            {/* Voice indicator overlay */}
            {isVoiceListening && (
              <button
                onClick={() => {
                  try { recognitionRef.current?.start(); } catch {}
                }}
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: "1px solid var(--risk-high)",
                  backgroundColor: "color-mix(in srgb, var(--risk-high) 14%, white)",
                  zIndex: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: "var(--risk-high)",
                    animation: "dotPulse 1s infinite",
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--risk-high)",
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Voice Active
                </span>
              </button>
            )}

            {/* Loading indicator */}
            {isLoading && (
              <div
                style={{
                  position: "absolute",
                  top: 16,
                  left: "50%",
                  transform: "translateX(-50%)",
                  padding: "6px 16px",
                  borderRadius: 999,
                  background: "var(--panel-glass)",
                  border: "1px solid var(--border)",
                  zIndex: 20,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--accent-light)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  Analyzing...
                </span>
              </div>
            )}

            {/* Hand tracker PIP */}
            {handTrackingEnabled && (
              <div
                style={{
                  position: "absolute",
                  bottom: 12,
                  left: 12,
                  width: 240,
                  height: 180,
                  borderRadius: 20,
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                <HandTracker
                  onGesture={handleGesture}
                  enabled={handTrackingEnabled}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar - narration */}
      {displayNarration && streaming && (
        <div
          style={{
            padding: "10px 20px",
            borderTop: "1px solid var(--border)",
            background: "rgba(255,252,247,0.72)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.5,
              fontFamily: "var(--font-sans)",
              maxWidth: 900,
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            {displayNarration}
          </div>
        </div>
      )}
    </div>
  );
}
