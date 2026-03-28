import { useState, useCallback, useRef, useEffect } from "react";
import * as THREE from "three";
import LayeredAnatomyViewer from "../components/LayeredAnatomyViewer";
import type { LayeredViewerHandle } from "../components/LayeredAnatomyViewer";
import SplatViewer from "../components/SplatViewer";
import HandTracker from "../components/HandTracker";
import ChatPanel from "../components/ChatPanel";
import NarrationPlayer from "../components/NarrationPlayer";
import SummaryView from "../components/SummaryView";
import UploadPanel from "../components/UploadPanel";
import AgentTour from "../components/AgentTour";
import { useAnnotationSync } from "../hooks/useAnnotationSync";
import { sendAction, sendChat, sendSemanticQuery } from "../utils/api";
import type { AgentResponse, Modification } from "../utils/api";
import type { GestureType } from "../hooks/useGestures";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  risks?: AgentResponse["risks"];
  recommendations?: string[];
}

type AppStage = "upload" | "reconstructing" | "simulation";

function AppPage() {
  const [stage, setStage] = useState<AppStage>("upload");
  const [sessionId, setSessionId] = useState(`session-${Date.now()}`);
  const [splatPath, setSplatPath] = useState<string | null>(null);
  const [reconstructProgress, setReconstructProgress] = useState(0);
  const [reconstructMessage, setReconstructMessage] = useState("");
  const [viewerMode, setViewerMode] = useState<"anatomy" | "splat">("anatomy");

  const [tourActive, setTourActive] = useState(true);
  const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [narrationText, setNarrationText] = useState<string | null>(null);
  const [handTrackingEnabled, setHandTrackingEnabled] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);

  const viewerRef = useRef<LayeredViewerHandle>(null);
  const { visibleMods, animationProgress, playAnnotations } = useAnnotationSync();
  const [historicMods, setHistoricMods] = useState<Modification[]>([]);
  const allVisibleMods = [...historicMods, ...visibleMods];

  // Reconstruction polling
  useEffect(() => {
    if (stage !== "reconstructing" || !sessionId) return;
    let cancelled = false;

    const poll = async () => {
      while (!cancelled) {
        try {
          const res = await fetch(`http://localhost:8000/api/reconstruct/${sessionId}`);
          const data = await res.json();
          setReconstructProgress(data.progress);
          setReconstructMessage(data.message);

          if (data.status === "complete" && data.splat_path) {
            setSplatPath(data.splat_path);
            setViewerMode("splat");
            setStage("simulation");

            // Auto-trigger initial AI analysis
            setMessages([{
              role: "assistant",
              content: "3D reconstruction complete. I'm analyzing the patient's anatomy — scanning for key structures, vessels, and potential risk zones...",
            }]);
            break;
          }
        } catch { /* polling error, retry */ }
        await new Promise((r) => setTimeout(r, 800));
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [stage, sessionId]);

  // Upload handlers
  const handleUploadComplete = useCallback((sid: string, _path: string) => {
    setSessionId(sid);
    // Trigger reconstruction
    fetch("http://localhost:8000/api/reconstruct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sid }),
    });
    setStage("reconstructing");
  }, []);

  const handleUseSample = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:8000/api/upload/sample", { method: "POST" });
      const data = await res.json();
      setSessionId(data.session_id);
      // Trigger reconstruction
      fetch("http://localhost:8000/api/reconstruct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: data.session_id }),
      });
      setStage("reconstructing");
    } catch (e: any) {
      console.error("Sample load failed:", e);
    }
  }, []);

  // AI response handler
  const handleResponse = useCallback((response: AgentResponse, userMsg: string) => {
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMsg },
      {
        role: "assistant",
        content: response.narration,
        risks: response.risks,
        recommendations: response.recommendations,
      },
    ]);
    setHistoricMods((prev) => [...prev, ...visibleMods]);
    playAnnotations(response.modifications);
    setNarrationText(response.narration);
    setIsLoading(false);
  }, [playAnnotations, visibleMods]);

  const handleOrganClick = useCallback(
    async (organName: string, point: number[], _normal: number[]) => {
      setSelectedOrgan(organName);
      setIsLoading(true);
      const userMsg = `Selected ${organName.replace(/_/g, " ")} at [${point.map((p) => p.toFixed(0)).join(", ")}]`;
      try {
        const response = await sendAction(sessionId, "point", [point], organName);
        handleResponse(response, userMsg);
      } catch (e: any) {
        setMessages((prev) => [...prev, { role: "user", content: userMsg }, { role: "assistant", content: `Error: ${e.message}` }]);
        setIsLoading(false);
      }
    },
    [sessionId, handleResponse]
  );

  const handleIncisionTrace = useCallback(
    async (organName: string, points: number[][]) => {
      setSelectedOrgan(organName);
      setIsLoading(true);
      const userMsg = `Traced incision on ${organName.replace(/_/g, " ")} (${points.length} points)`;
      try {
        const response = await sendAction(sessionId, "incision", points, organName);
        handleResponse(response, userMsg);
      } catch (e: any) {
        setMessages((prev) => [...prev, { role: "user", content: userMsg }, { role: "assistant", content: `Error: ${e.message}` }]);
        setIsLoading(false);
      }
    },
    [sessionId, handleResponse]
  );

  const handleChatMessage = useCallback(
    async (message: string) => {
      setIsLoading(true);
      try {
        const response = await sendChat(sessionId, message);
        handleResponse(response, message);
      } catch (e: any) {
        setMessages((prev) => [...prev, { role: "user", content: message }, { role: "assistant", content: `Error: ${e.message}` }]);
        setIsLoading(false);
      }
    },
    [sessionId, handleResponse]
  );

  const handleSemanticQuery = useCallback(
    async (message: string) => {
      setIsLoading(true);
      try {
        const imageBase64 = viewerRef.current?.captureCanvas() || undefined;
        const response = await sendSemanticQuery(sessionId, message, imageBase64);
        const heatmapMods: Modification[] = response.regions.map((r) => ({
          type: "heatmap" as const,
          coordinates: [r.center],
          color: "",
          label: r.label,
          score: r.score,
          radius: r.radius,
          animation: "pulse" as const,
          delay_ms: 0,
          duration_ms: 800,
        }));
        setMessages((prev) => [
          ...prev,
          { role: "user", content: `🔍 ${message}` },
          {
            role: "assistant",
            content: response.explanation,
            recommendations: response.regions.map((r) => `${r.label}: ${Math.round(r.score * 100)}% relevance`),
          },
        ]);
        setHistoricMods((prev) => [...prev, ...visibleMods]);
        playAnnotations(heatmapMods);
        setIsLoading(false);
      } catch (e: any) {
        setMessages((prev) => [...prev, { role: "user", content: `🔍 ${message}` }, { role: "assistant", content: `Error: ${e.message}` }]);
        setIsLoading(false);
      }
    },
    [sessionId, playAnnotations, visibleMods]
  );

  // Gesture handling
  const lastGestureActionRef = useRef<number>(0);

  const gestureRaycast = useCallback(
    (normX: number, normY: number): { organName: string; point: number[]; normal: number[] } | null => {
      const viewer = viewerRef.current;
      if (!viewer) return null;
      const camera = viewer.getCamera();
      const scene = viewer.getScene();
      if (!camera || !scene || scene.children.length < 3) return null;
      const mouse = new THREE.Vector2(normX * 2 - 1, -(normY * 2 - 1));
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(scene.children, true).filter((h) => {
        const n = h.object.userData?.organName;
        return n && n !== "modifications" && n !== "labels";
      });
      if (hits.length === 0) return null;
      const hit = hits[0];
      return {
        organName: hit.object.userData.organName,
        point: [hit.point.x, hit.point.y, hit.point.z],
        normal: hit.face ? [hit.face.normal.x, hit.face.normal.y, hit.face.normal.z] : [0, 1, 0],
      };
    },
    []
  );

  const handleGesture = useCallback(
    (type: GestureType, screenPos: { x: number; y: number } | null, tracePath: { x: number; y: number }[]) => {
      const now = Date.now();
      const normX = screenPos ? screenPos.x / 640 : 0;
      const normY = screenPos ? screenPos.y / 480 : 0;
      const rect = viewerRef.current?.getCanvasRect();

      // Update cursor for all gestures that have a screen position
      if (screenPos && rect) {
        setCursorPosition({ x: normX * rect.width, y: normY * rect.height });
      } else if (type === "none") {
        setCursorPosition(null);
      }

      // POINT: hover/inspect only — highlight what you're looking at but don't select
      if (type === "point" && screenPos) {
        const hit = gestureRaycast(normX, normY);
        if (hit && hit.organName !== selectedOrgan) {
          setSelectedOrgan(hit.organName); // visual highlight only, no API call
        }
      }

      // PINCH: SELECT — confirm selection and trigger AI analysis
      else if (type === "pinch" && screenPos) {
        if (now - lastGestureActionRef.current > 2000) {
          let hit = gestureRaycast(normX, normY);
          if (!hit) hit = gestureRaycast(0.5, 0.5);
          if (hit) {
            lastGestureActionRef.current = now;
            handleOrganClick(hit.organName, hit.point, hit.normal);
          }
        }
      }

      // FIST: retract tissue — ask AI about what's beneath
      else if (type === "fist" && screenPos) {
        if (now - lastGestureActionRef.current > 3000) {
          const target = selectedOrgan || gestureRaycast(normX, normY)?.organName;
          if (target) {
            lastGestureActionRef.current = now;
            handleChatMessage(`I'm retracting tissue near the ${target.replace(/_/g, " ")}. What structures would be exposed beneath and what are the risks?`);
          }
        }
      }

      // SPREAD: zoom into the area — tell AI to focus on details
      else if (type === "spread" && screenPos) {
        if (now - lastGestureActionRef.current > 3000) {
          const target = selectedOrgan || gestureRaycast(normX, normY)?.organName;
          if (target) {
            lastGestureActionRef.current = now;
            handleChatMessage(`Zoom in on the ${target.replace(/_/g, " ")} — give me a detailed view of the vasculature and any anomalies in this area.`);
          }
        }
      }

      // INCISION (two fingers tracing): show cursor while tracing
      else if (type === "incision" && screenPos && tracePath.length > 3) {
        // Visual feedback only while tracing — action fires on completion below
      }

      // INCISION COMPLETE: two fingers lifted after tracing
      if (type === "incision" && tracePath.length > 8 && !screenPos) {
        const worldPoints: number[][] = [];
        let traceOrgan = selectedOrgan || "anatomy";
        for (let i = 0; i < tracePath.length; i += 3) {
          const p = tracePath[i];
          const hit = gestureRaycast(p.x / 640, p.y / 480);
          if (hit) { worldPoints.push(hit.point); traceOrgan = hit.organName; }
        }
        if (worldPoints.length >= 2) handleIncisionTrace(traceOrgan, worldPoints);
      }
    },
    [selectedOrgan, handleOrganClick, handleIncisionTrace, handleChatMessage, gestureRaycast]
  );

  const navBar = (label?: string) => (
    <header style={{ padding: "12px 24px", borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--accent)" }} />
      <span style={{ fontSize: "0.76rem", fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-primary)", letterSpacing: "0.04em", textTransform: "uppercase" }}>SurgiVision</span>
      {label && <span style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "0.04em", marginLeft: 4 }}>{label}</span>}
    </header>
  );

  // ──── UPLOAD STAGE ────
  if (stage === "upload") {
    return (
      <div style={{ width: "100vw", height: "100vh", backgroundColor: "var(--bg-primary)" }}>
        {navBar()}
        <div style={{ height: "calc(100vh - 45px)" }}>
          <UploadPanel onUploadComplete={handleUploadComplete} onUseSample={handleUseSample} />
        </div>
      </div>
    );
  }

  // ──── RECONSTRUCTING STAGE ────
  if (stage === "reconstructing") {
    return (
      <div style={{ width: "100vw", height: "100vh", backgroundColor: "var(--bg-primary)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 24, height: 24, border: "1.5px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--accent)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Reconstructing</p>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", fontWeight: 400 }}>{reconstructMessage || "Processing volume data..."}</p>
          </div>
        </div>
        <div style={{ width: 240, height: 2, backgroundColor: "var(--border)", overflow: "hidden", borderRadius: 1 }}>
          <div style={{ height: "100%", width: `${reconstructProgress}%`, backgroundColor: "var(--accent)", transition: "width 0.4s ease" }} />
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--text-muted)", letterSpacing: "0.04em" }}>{reconstructProgress}%</span>
      </div>
    );
  }

  // ──── SIMULATION STAGE ────
  return (
    <div style={{ width: "100vw", height: "100vh", backgroundColor: "var(--bg-primary)", display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden" }}>
      {/* Header — minimal */}
      <header style={{ padding: "8px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "var(--bg-secondary)", zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--accent)" }} />
          <span style={{ fontSize: "0.72rem", fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-primary)", letterSpacing: "0.04em", textTransform: "uppercase" }}>SurgiVision</span>
          <span style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "0.04em" }}>/ Simulation</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", overflow: "hidden" }}>
            {(["anatomy", "splat"] as const).map((mode) => (
              <button key={mode} onClick={() => setViewerMode(mode)} style={{
                padding: "5px 12px", border: "none",
                backgroundColor: viewerMode === mode ? "var(--accent-dim)" : "transparent",
                color: viewerMode === mode ? "var(--accent)" : "var(--text-muted)",
                fontSize: "0.65rem", fontWeight: 500, fontFamily: "var(--font-mono)", textTransform: "uppercase",
              }}>
                {mode === "anatomy" ? "Mesh" : "Splat"}
              </button>
            ))}
          </div>

          <button onClick={() => setHandTrackingEnabled((e) => !e)} style={{
            padding: "5px 14px", borderRadius: "var(--radius-sm)",
            border: `1px solid ${handTrackingEnabled ? "var(--accent)" : "var(--border)"}`,
            backgroundColor: handTrackingEnabled ? "var(--accent-dim)" : "transparent",
            color: handTrackingEnabled ? "var(--accent)" : "var(--text-muted)",
            fontSize: "0.65rem", fontWeight: 500,
          }}>
            {handTrackingEnabled ? "Tracking" : "Hands"}
          </button>

          <button onClick={() => setTourActive((t) => !t)} style={{
            padding: "5px 14px", borderRadius: "var(--radius-sm)",
            border: `1px solid ${tourActive ? "var(--accent)" : "var(--border)"}`,
            backgroundColor: tourActive ? "var(--accent-dim)" : "transparent",
            color: tourActive ? "var(--accent)" : "var(--text-muted)",
            fontSize: "0.65rem", fontWeight: 500,
          }}>
            {tourActive ? "Touring" : "Tour"}
          </button>

          <button onClick={() => setShowSummary(true)} style={{
            padding: "5px 14px", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)", backgroundColor: "transparent",
            color: "var(--text-muted)", fontSize: "0.65rem", fontWeight: 500,
          }}>
            Report
          </button>
        </div>
      </header>

      {/* Full-screen 3D Viewer */}
      <main style={{ position: "relative", overflow: "hidden" }}>
        {viewerMode === "anatomy" ? (
          <LayeredAnatomyViewer
            ref={viewerRef}
            onOrganClick={handleOrganClick}
            onIncisionTrace={handleIncisionTrace}
            modifications={allVisibleMods}
            animationProgress={animationProgress}
            selectedOrgan={selectedOrgan}
            cursorPosition={cursorPosition}
          />
        ) : (
          <SplatViewer
            splatPath={splatPath || "/splats/sample.splat"}
            onPointClick={(point) => handleOrganClick("anatomy", point, [0, 1, 0])}
            modifications={allVisibleMods}
          />
        )}

        {/* Agent Tour */}
        <AgentTour
          active={tourActive}
          onMoveTo={(camPos, target) => { console.log("[tour] Move to:", camPos, "→", target); }}
          onNarrate={(text) => { setNarrationText(text); }}
          onPOIChange={(poi) => { if (poi) setSelectedOrgan(poi.id); }}
          onCommand={(cmd) => {
            if (cmd === "free_explore") setTourActive(false);
            else handleChatMessage(cmd);
          }}
        />

        {/* Narration bar — bottom center overlay */}
        {narrationText && (
          <div style={{
            position: "absolute", bottom: 60, left: "50%", transform: "translateX(-50%)",
            maxWidth: 600, width: "90%", padding: "12px 18px",
            borderRadius: "var(--radius-md)", border: "1px solid var(--border)",
            backgroundColor: "rgba(10, 10, 12, 0.88)", backdropFilter: "blur(8px)",
            zIndex: 15,
          }}>
            <p style={{ fontSize: "0.8rem", lineHeight: 1.6, color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>
              {narrationText}
            </p>
          </div>
        )}

        {/* Action log — top right toasts */}
        {messages.length > 0 && (
          <div style={{
            position: "absolute", top: 12, right: 12, zIndex: 15,
            display: "flex", flexDirection: "column", gap: 6, maxWidth: 320,
          }}>
            {messages.slice(-3).map((msg, i) => (
              msg.role === "user" && (
                <div key={i} style={{
                  padding: "6px 12px", borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  backgroundColor: "rgba(10, 10, 12, 0.85)",
                  fontSize: "0.7rem", color: "var(--text-secondary)",
                  fontFamily: "var(--font-mono)", letterSpacing: "0.02em",
                  animation: "fadeIn 0.3s ease",
                }}>
                  {msg.content}
                </div>
              )
            ))}
          </div>
        )}

        {/* Hand tracker — bottom left */}
        {handTrackingEnabled && (
          <div style={{ position: "absolute", bottom: 16, left: 16, width: 240, height: 180, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)", zIndex: 15 }}>
            <HandTracker onGesture={handleGesture} enabled={handTrackingEnabled} />
          </div>
        )}
      </main>

      <SummaryView sessionId={sessionId} visible={showSummary} onClose={() => setShowSummary(false)} />
    </div>
  );
}

export default AppPage;
