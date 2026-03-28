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
  const [stage, setStage] = useState<AppStage>("simulation");
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

  // Auto-generate AI annotations when simulation loads
  useEffect(() => {
    if (stage !== "simulation") return;
    let cancelled = false;

    const generateAnnotations = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/poi/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const data = await res.json();
        if (cancelled || !data.annotations?.length) return;

        // Convert annotations to timed modifications
        const mods: Modification[] = data.annotations.map((ann: any, i: number) => ({
          type: ann.type === "danger" ? "zone" as const : ann.type === "action" ? "highlight" as const : "label" as const,
          coordinates: [ann.position || [0, -100, 1000]],
          color: ann.type === "danger" ? "#f87171" : ann.type === "action" ? "#2dd4bf" : "#818cf8",
          label: ann.label || "",
          delay_ms: i * 1500,
          duration_ms: 800,
          animation: "pulse" as const,
        }));

        playAnnotations(mods);
        // Store for voice agent context
        currentAnnotationsRef.current = data.annotations;
      } catch (e) {
        console.error("Failed to generate annotations:", e);
      }
    };

    // Start immediately — annotations appear as soon as the model loads
    const timer = setTimeout(generateAnnotations, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [stage, sessionId, playAnnotations]);

  // Poll for skeleton data from mobile phone (updates organ positions)
  useEffect(() => {
    if (stage !== "simulation") return;
    const controller = new AbortController();

    const poll = async () => {
      while (!controller.signal.aborted) {
        try {
          const res = await fetch(`http://localhost:8000/api/skeleton/latest/${sessionId}`, { signal: controller.signal });
          const data = await res.json();
          if (data.skeleton_detected) {
            console.log("[skeleton] Received organ positions:", Object.keys(data.organ_positions).length);
          }
        } catch (e) {
          if (controller.signal.aborted) return;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    };

    const timer = setTimeout(poll, 3000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [stage, sessionId]);

  // Reconstruction polling
  useEffect(() => {
    if (stage !== "reconstructing" || !sessionId) return;
    const controller = new AbortController();

    const poll = async () => {
      while (!controller.signal.aborted) {
        try {
          const res = await fetch(`http://localhost:8000/api/reconstruct/${sessionId}`, { signal: controller.signal });
          const data = await res.json();
          setReconstructProgress(data.progress);
          setReconstructMessage(data.message);

          if (data.status === "complete" && data.splat_path) {
            setSplatPath(data.splat_path);
            setViewerMode("splat");
            setStage("simulation");
            break;
          }
        } catch (e) {
          if (controller.signal.aborted) return;
        }
        await new Promise((r) => setTimeout(r, 800));
      }
    };
    poll();
    return () => { controller.abort(); };
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

  // Accumulated action context — incisions, selections, etc. (silent, no AI call)
  const actionContextRef = useRef<string[]>([]);
  const currentAnnotationsRef = useRef<any[]>([]);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Setup speech recognition once
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
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

  // Voice input handler — sends user's speech + accumulated context to the AI guide
  const handleVoiceInput = useCallback(async (transcript: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          selected_structure: selectedOrgan,
          existing_annotations: currentAnnotationsRef.current.slice(-5),
          camera_region: `User said: "${transcript}". Recent actions: ${actionContextRef.current.slice(-5).join("; ")}`,
        }),
      });
      const guide = await res.json();

      if (guide.narration) setNarrationText(guide.narration);

      if (guide.new_annotations?.length) {
        const mods: Modification[] = guide.new_annotations.map((ann: any, i: number) => ({
          type: ann.type === "danger" ? "zone" as const : ann.type === "action" ? "highlight" as const : "label" as const,
          coordinates: [ann.position || [0, -100, 1000]],
          color: ann.type === "danger" ? "#f87171" : ann.type === "action" ? "#2dd4bf" : "#818cf8",
          label: ann.label || "",
          delay_ms: i * 1000,
          duration_ms: 600,
          animation: "pulse" as const,
        }));
        setHistoricMods((prev) => [...prev, ...visibleMods]);
        playAnnotations(mods);
        currentAnnotationsRef.current = [...currentAnnotationsRef.current, ...guide.new_annotations];
      }

      // Clear action context after the agent has used it
      actionContextRef.current = [];
    } catch {
      setNarrationText("Couldn't reach the AI guide. Try again.");
    }
    setIsLoading(false);
  }, [sessionId, selectedOrgan, playAnnotations, visibleMods]);

  const handleOrganClick = useCallback(
    async (organName: string, point: number[], _normal: number[]) => {
      setSelectedOrgan(organName);

      // Silent — just accumulate context, no AI call
      actionContextRef.current.push(`Selected ${organName.replace(/_/g, " ")} at [${point.map((p) => p.toFixed(0)).join(",")}]`);

      // PINCH shows the mic button — user taps it to speak (browser requires user gesture)
      setIsVoiceListening(true);
    },
    []
  );

  const handleIncisionTrace = useCallback(
    async (organName: string, points: number[][]) => {
      setSelectedOrgan(organName);
      // Silent — just accumulate context for when the user speaks
      actionContextRef.current.push(`Traced incision on ${organName.replace(/_/g, " ")} (${points.length} points)`);
      // Still render the incision line visually
      const mods: Modification[] = [{
        type: "incision",
        coordinates: points,
        color: "#f87171",
        label: "Incision",
        delay_ms: 0,
        duration_ms: 300,
        animation: "draw",
      }];
      setHistoricMods((prev) => [...prev, ...visibleMods]);
      playAnnotations(mods);
    },
    [playAnnotations, visibleMods]
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
    <header style={{ padding: "10px 24px", borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)", display: "flex", alignItems: "center", gap: 10 }}>
      <img src="/logo.png" alt="Praxis" style={{ height: 22, filter: "brightness(0) invert(1)" }} />
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
          <img src="/logo.png" alt="Praxis" style={{ height: 22, filter: "brightness(0) invert(1)" }} />
          <span style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "0.04em" }}>/ Simulation</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setHandTrackingEnabled((e) => !e)} style={{
            padding: "5px 14px", borderRadius: "var(--radius-sm)",
            border: `1px solid ${handTrackingEnabled ? "var(--accent)" : "var(--border)"}`,
            backgroundColor: handTrackingEnabled ? "var(--accent-dim)" : "transparent",
            color: handTrackingEnabled ? "var(--accent)" : "var(--text-muted)",
            fontSize: "0.65rem", fontWeight: 500,
          }}>
            {handTrackingEnabled ? "Tracking" : "Hands"}
          </button>

          <NarrationPlayer text={narrationText} autoPlay={true} onAgentMessage={() => {}} />

          <button onClick={() => setShowSummary(true)} style={{
            padding: "5px 14px", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--accent)",
            backgroundColor: "var(--accent-dim)",
            color: "var(--accent)", fontSize: "0.65rem", fontWeight: 500,
          }}>
            Generate Report
          </button>
        </div>
      </header>

      {/* Full-screen 3D Viewer */}
      <main style={{ position: "relative", overflow: "hidden" }}>
        <LayeredAnatomyViewer
            ref={viewerRef}
            onOrganClick={handleOrganClick}
            onIncisionTrace={handleIncisionTrace}
            modifications={allVisibleMods}
            animationProgress={animationProgress}
            selectedOrgan={selectedOrgan}
            cursorPosition={cursorPosition}
          />}


        {/* Voice indicator — right side, clickable to start/retry mic */}
        {isVoiceListening && (
          <button
            onClick={() => {
              try {
                recognitionRef.current?.start();
              } catch {
                // Already started or not available
              }
            }}
            style={{
              position: "absolute", top: 16, right: 16,
              padding: "12px 20px", borderRadius: "var(--radius-md)",
              border: "1px solid var(--accent)", backgroundColor: "rgba(10, 10, 12, 0.9)",
              zIndex: 20, display: "flex", alignItems: "center", gap: 10,
              cursor: "pointer",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            <span style={{ fontSize: "0.72rem", color: "var(--accent)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Tap to speak
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setIsVoiceListening(false); }}
              style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "0.8rem", cursor: "pointer", padding: "0 0 0 4px" }}
            >
              ×
            </button>
          </button>
        )}

        {/* Agent narration — minimal bottom bar */}
        {narrationText && !isVoiceListening && (
          <div style={{
            position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
            maxWidth: 560, width: "80%", padding: "8px 14px",
            borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
            backgroundColor: "rgba(10, 10, 12, 0.75)",
            zIndex: 15, pointerEvents: "none",
          }}>
            <p style={{ fontSize: "0.72rem", lineHeight: 1.5, color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}>
              {narrationText}
            </p>
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
