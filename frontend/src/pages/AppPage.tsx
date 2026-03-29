import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as THREE from "three";
import SplatAnatomyComposite from "../components/SplatAnatomyComposite";
import type { LayeredViewerHandle } from "../components/SplatAnatomyComposite";
import SplatViewer from "../components/SplatViewer";
import HandTracker from "../components/HandTracker";
import ChatPanel from "../components/ChatPanel";
import NarrationPlayer from "../components/NarrationPlayer";
import SummaryView from "../components/SummaryView";
import UploadPanel from "../components/UploadPanel";
import AgentTour from "../components/AgentTour";
import SurgicalSimulation from "../components/SurgicalSimulation";
import { useAnnotationSync } from "../hooks/useAnnotationSync";
import { API_BASE, sendAction, sendChat, sendSemanticQuery } from "../utils/api";
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
  const location = useLocation();
  const nav = useNavigate();
  const enteredFromLanding = !!(location.state as any)?.entered;
  const [appRevealed, setAppRevealed] = useState(!enteredFromLanding);

  useEffect(() => {
    if (enteredFromLanding) {
      const t = setTimeout(() => setAppRevealed(true), 100);
      return () => clearTimeout(t);
    }
  }, [enteredFromLanding]);

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
  const handTrackingEnabled = true;
  const [showSummary, setShowSummary] = useState(false);
  const [simulationTriggered, setSimulationTriggered] = useState(false);
  const simulationTriggeredRef = useRef(false);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);

  const viewerRef = useRef<LayeredViewerHandle>(null);
  const { visibleMods, animationProgress, playAnnotations } = useAnnotationSync();
  const [historicMods, setHistoricMods] = useState<Modification[]>([]);
  const [activeScenarios, setActiveScenarios] = useState<Set<string>>(new Set(["primary_plan"]));

  // Collect all unique scenarios from modifications and auto-activate new ones
  const allMods = [...historicMods, ...visibleMods];
  const scenarioSet = new Set<string>();
  allMods.forEach(m => { if (m.scenario) scenarioSet.add(m.scenario); });
  const scenarios = Array.from(scenarioSet);
  useEffect(() => {
    scenarios.forEach(s => { if (!activeScenarios.has(s)) setActiveScenarios(prev => new Set(prev).add(s)); });
  }, [scenarios.join(",")]);

  // Filter mods by active scenarios (mods without scenario always show)
  const filteredMods = allMods.filter(m => !m.scenario || activeScenarios.has(m.scenario));

  // Build combined animation progress: historic mods = 1 (fully visible), animating mods = real progress
  const combinedProgress = useMemo(() => {
    const map = new Map<number, number>();
    const historicCount = historicMods.filter(m => !m.scenario || activeScenarios.has(m.scenario)).length;
    for (let i = 0; i < historicCount; i++) {
      map.set(i, 1);
    }
    if (animationProgress) {
      animationProgress.forEach((value, key) => {
        map.set(historicCount + key, value);
      });
    }
    return map;
  }, [historicMods, activeScenarios, animationProgress]);

  const allVisibleMods = filteredMods;

  // No auto-annotation on load — annotations are triggered by user gestures only

  // Poll for skeleton data from mobile phone (updates organ positions)
  useEffect(() => {
    if (stage !== "simulation") return;
    const controller = new AbortController();

    const poll = async () => {
      while (!controller.signal.aborted) {
        try {
          const res = await fetch(`${API_BASE}/skeleton/latest/${sessionId}`, { signal: controller.signal });
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
          const res = await fetch(`${API_BASE}/reconstruct/${sessionId}`, { signal: controller.signal });
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
    fetch(`${API_BASE}/reconstruct`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sid }),
    });
    setStage("reconstructing");
  }, []);

  const handleUseSample = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/upload/sample`, { method: "POST" });
      const data = await res.json();
      setSessionId(data.session_id);
      // Trigger reconstruction
      fetch(`${API_BASE}/reconstruct`, {
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
    setHistoricMods((prev) => [...prev, ...visibleMods].slice(-60));
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
      const res = await fetch(`${API_BASE}/guide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          selected_structure: selectedOrgan,
          existing_annotations: currentAnnotationsRef.current.slice(-5),
          camera_region: `User said: "${transcript}". Currently viewing: ${selectedOrgan?.replace(/_/g, " ") || "general anatomy"}. Recent actions: ${actionContextRef.current.slice(-8).join("; ")}`,
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
        setHistoricMods((prev) => [...prev, ...visibleMods].slice(-60));
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
    (organName: string, point: number[], _normal: number[]) => {
      setSelectedOrgan(organName);
      actionContextRef.current.push(`Pinched/selected ${organName.replace(/_/g, " ")} at [${point.map((p) => p.toFixed(0)).join(",")}]`);

      // Start voice immediately — don't wait for annotation API
      setIsVoiceListening(true);
      try { recognitionRef.current?.start(); } catch { /* already started */ }

      // Fire annotation call in background (non-blocking)
      fetch("http://localhost:8000/api/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          selected_structure: organName,
          existing_annotations: currentAnnotationsRef.current.slice(-5),
          camera_region: `User pinched and selected ${organName.replace(/_/g, " ")}. Recent actions: ${actionContextRef.current.slice(-5).join("; ")}. Provide a focused annotation for this structure — key anatomy, risks, and surgical relevance.`,
        }),
      }).then(r => r.json()).then(guide => {
        if (guide.narration) setNarrationText(guide.narration);
        if (guide.new_annotations?.length) {
          const mods: Modification[] = guide.new_annotations.map((ann: any, i: number) => ({
            type: ann.type === "danger" ? "zone" as const : ann.type === "action" ? "highlight" as const : "label" as const,
            coordinates: [ann.position || point],
            color: ann.type === "danger" ? "#f87171" : ann.type === "action" ? "#2dd4bf" : "#818cf8",
            label: ann.label || "",
            delay_ms: i * 800,
            duration_ms: 600,
            animation: "pulse" as const,
          }));
          setHistoricMods((prev) => [...prev, ...visibleMods].slice(-60));
          playAnnotations(mods);
          currentAnnotationsRef.current = [...currentAnnotationsRef.current, ...guide.new_annotations];
        }
      }).catch(() => { /* guide call failed */ });
    },
    [sessionId, playAnnotations, visibleMods]
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
      setHistoricMods((prev) => [...prev, ...visibleMods].slice(-60));
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
        setHistoricMods((prev) => [...prev, ...visibleMods].slice(-60));
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
  const wasPinchingRef = useRef(false);
  const lastHoverAnnotationRef = useRef<string>("");
  const hoverAnnotationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      // Update cursor for gestures that have a screen position
      if (screenPos && rect) {
        setCursorPosition({ x: normX * rect.width, y: normY * rect.height });
      } else if (type === "none") {
        setCursorPosition(null);
      }

      // ── Organ interaction gestures ──────────────────────────────────

      // Track pinch → release for first-pinch simulation trigger
      if (type === "pinch" && screenPos) {
        wasPinchingRef.current = true;
        return; // don't do anything while actively pinching
      }

      // Pinch just released
      if (wasPinchingRef.current && type !== "pinch") {
        wasPinchingRef.current = false;
        if (!simulationTriggeredRef.current) {
          // First pinch release → trigger simulation
          simulationTriggeredRef.current = true;
          setSimulationTriggered(true);
          lastGestureActionRef.current = now;
        }
        // Don't do anything else on this frame — just acknowledge the release
        return;
      }

      // POINT: hover/inspect — highlight and auto-annotate after dwelling
      if (type === "point" && screenPos) {
        const hit = gestureRaycast(normX, normY);
        if (hit) {
          if (hit.organName !== selectedOrgan) {
            setSelectedOrgan(hit.organName);
          }
          if (hit.organName !== lastHoverAnnotationRef.current) {
            if (hoverAnnotationTimerRef.current) clearTimeout(hoverAnnotationTimerRef.current);
            hoverAnnotationTimerRef.current = setTimeout(async () => {
              if (lastHoverAnnotationRef.current === hit.organName) return;
              lastHoverAnnotationRef.current = hit.organName;
              actionContextRef.current.push(`Hovering over ${hit.organName.replace(/_/g, " ")}`);
              try {
                const res = await sendAction(sessionId, "hover", [hit.point], hit.organName, `User is pointing at ${hit.organName.replace(/_/g, " ")}. Provide a brief label annotation identifying this structure.`);
                if (res.modifications?.length) {
                  setHistoricMods((prev) => [...prev, ...visibleMods].slice(-60));
                  playAnnotations(res.modifications);
                }
                if (res.narration) setNarrationText(res.narration);
                currentAnnotationsRef.current = [...currentAnnotationsRef.current, ...(res.modifications || [])];
              } catch { /* hover annotation failed silently */ }
            }, 1500);
          }
        }
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
    [selectedOrgan, handleOrganClick, handleIncisionTrace, gestureRaycast, sessionId, playAnnotations, visibleMods]
  );

  const navBar = (label?: string) => (
    <header style={{ padding: "10px 24px", borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)", display: "flex", alignItems: "center", gap: 10 }}>
      <img src="/logo.png" alt="Praxis" onClick={() => nav("/")} style={{ height: 36, filter: "brightness(1.3)", cursor: "pointer" }} />
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
      <div style={{ width: "100vw", height: "100vh", background: "var(--page-gradient)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 24, height: 24, border: "1.5px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--accent)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Reconstructing</p>
            <p style={{ color: "var(--text-primary)", fontSize: "2rem", fontWeight: 600, fontFamily: "var(--font-serif)", letterSpacing: "-0.04em", marginBottom: 8 }}>Building the rehearsal model</p>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", fontWeight: 400 }}>{reconstructMessage || "Processing volume data..."}</p>
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
    <div style={{
      width: "100vw", height: "100vh", backgroundColor: "var(--bg-primary)",
      display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden",
      opacity: appRevealed ? 1 : 0,
      transition: "opacity 0.8s ease",
    }}>
      {/* Header — minimal */}
      <header style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "var(--bg-secondary)", zIndex: 20, boxShadow: "var(--shadow-sm)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="Praxis" onClick={() => nav("/")} style={{ height: 36, filter: "brightness(1.3)", cursor: "pointer" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setShowSummary(true)} style={{
            padding: "5px 14px", borderRadius: "999px",
            border: "1px solid var(--accent)",
            backgroundColor: "var(--accent-dim)",
            color: "var(--accent-light)", fontSize: "0.65rem", fontWeight: 600,
          }}>
            Generate Report
          </button>
        </div>
      </header>

      {/* Full-screen 3D Viewer */}
      <main style={{ position: "relative", overflow: "hidden" }}>
        <SplatAnatomyComposite
          ref={viewerRef}
          worldId={import.meta.env.VITE_WORLD_LABS_WORLD_ID}
          onOrganClick={handleOrganClick}
          onIncisionTrace={handleIncisionTrace}
          modifications={allVisibleMods}
          animationProgress={combinedProgress}
          selectedOrgan={selectedOrgan}
          cursorPosition={cursorPosition}
        />

        <SurgicalSimulation
          triggered={simulationTriggered}
          viewerRef={viewerRef}
          playAnnotations={playAnnotations}
          onNarrate={setNarrationText}
        />

        {/* Scenario toggle chips */}
        {scenarios.length > 1 && (
          <div style={{
            position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
            display: "flex", gap: 6, zIndex: 20,
            padding: "4px 6px", borderRadius: 999,
            backgroundColor: "var(--panel-glass)", backdropFilter: "blur(12px)",
            border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)",
          }}>
            {scenarios.map(s => {
              const isActive = activeScenarios.has(s);
              const label = allMods.find(m => m.scenario === s)?.scenario_label || s.replace(/_/g, " ");
              return (
                <button key={s} onClick={() => {
                  setActiveScenarios(prev => {
                    const next = new Set(prev);
                    if (next.has(s)) next.delete(s); else next.add(s);
                    return next;
                  });
                }} style={{
                  padding: "4px 12px", borderRadius: 999, border: "1px solid",
                  borderColor: isActive ? "var(--accent)" : "var(--border)",
                  backgroundColor: isActive ? "var(--accent-dim)" : "transparent",
                  color: isActive ? "var(--accent-light)" : "var(--text-muted)",
                  fontSize: "0.62rem", fontWeight: 600, fontFamily: "var(--font-mono)",
                  letterSpacing: "0.04em", textTransform: "capitalize",
                  transition: "all 0.15s ease",
                }}>
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Voice listening indicator — auto-started on pinch, no tap needed */}
        {isVoiceListening && (
          <div
            style={{
              position: "absolute", top: 16, right: 16,
              padding: "12px 20px", borderRadius: "999px",
              border: "1px solid var(--accent)", backgroundColor: "var(--panel-glass)",
              zIndex: 20, display: "flex", alignItems: "center", gap: 10,
              animation: "glowPulse 2s ease-in-out infinite",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            <span style={{ fontSize: "0.72rem", color: "var(--accent-light)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Listening...
            </span>
          </div>
        )}

        {/* Agent narration hidden — logged to session for report */}

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
