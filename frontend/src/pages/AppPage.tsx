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
  const [sceneReady, setSceneReady] = useState(false);
  const [appRevealed, setAppRevealed] = useState(false);
  const [loadStep, setLoadStep] = useState("Initializing...");
  const [displayProgress, setDisplayProgress] = useState(0);
  const targetProgressRef = useRef(0);
  const LOAD_BLOCKS = 8;

  // Animated progress — smoothly lerps toward target, never overshoots
  useEffect(() => {
    if (appRevealed) return;
    let raf: number;
    const tick = () => {
      setDisplayProgress((prev) => {
        const target = targetProgressRef.current;
        if (prev >= 1) return 1;
        const diff = target - prev;
        if (Math.abs(diff) < 0.001) return target;
        // Smooth lerp — faster when far, slower when close
        return prev + diff * 0.04;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [appRevealed]);

  // When scene finishes loading, fade in
  useEffect(() => {
    if (sceneReady) {
      const t = setTimeout(() => setAppRevealed(true), 600);
      return () => clearTimeout(t);
    }
  }, [sceneReady]);

  const lastLoadStepRef = useRef("");
  const handleLoadProgress = useCallback((step: string, progress: number) => {
    targetProgressRef.current = progress;
    if (step !== lastLoadStepRef.current) {
      lastLoadStepRef.current = step;
      setLoadStep(step);
    }
  }, []);

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
  const [viewerScreenshot, setViewerScreenshot] = useState<string | null>(null);
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
    (_organName: string, _point: number[], _normal: number[]) => {
      // No-op in demo mode — simulation is driven by the hardcoded sequence only
    },
    []
  );

  const handleIncisionTrace = useCallback(
    (_organName: string, _points: number[][]) => {
      // No-op in demo mode
    },
    []
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
  const pinchStartTimeRef = useRef(0);
  const lastPinchScreenRef = useRef<{ x: number; y: number } | null>(null);
  const MIN_PINCH_HOLD_MS = 500; // must hold pinch for 500ms before it counts
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

      // Track pinch — record start time on first frame
      if (type === "pinch" && screenPos) {
        if (!wasPinchingRef.current) {
          pinchStartTimeRef.current = now;
        }
        wasPinchingRef.current = true;
        lastPinchScreenRef.current = { x: screenPos.x, y: screenPos.y };
        return;
      }

      // Pinch just released — only the first valid pinch triggers the simulation
      if (wasPinchingRef.current && type !== "pinch") {
        wasPinchingRef.current = false;
        const heldMs = now - pinchStartTimeRef.current;
        if (heldMs < MIN_PINCH_HOLD_MS) return; // too short, ignore

        if (!simulationTriggeredRef.current) {
          simulationTriggeredRef.current = true;
          setSimulationTriggered(true);
        }
        return;
      }
    },
    [selectedOrgan, handleOrganClick, handleIncisionTrace, gestureRaycast, sessionId, playAnnotations, visibleMods]
  );

  const navBar = (label?: string) => (
    <header style={{
      position: "absolute", top: 0, left: 0, right: 0,
      padding: "20px 32px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      zIndex: 20,
      pointerEvents: "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, pointerEvents: "auto" }}>
        <img src="/logo.png" alt="Praxis" onClick={() => nav("/")} style={{ height: 44, filter: "var(--logo-filter)", cursor: "pointer" }} />
        {label && <span style={{ fontSize: "0.62rem", fontFamily: "var(--font-mono)", color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>}
      </div>
    </header>
  );

  // ──── UPLOAD STAGE ────
  if (stage === "upload") {
    return (
      <div style={{ width: "100vw", height: "100vh", backgroundColor: "var(--bg-primary)", position: "relative" }}>
        {navBar()}
        <div style={{ height: "100vh" }}>
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
      display: "grid", gridTemplateRows: "1fr", overflow: "hidden",
      position: "relative",
    }}>
      {/* Loading overlay — matches Landing processing UI */}
      {!appRevealed && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 100,
          background: "var(--bg-primary)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28,
          transition: "opacity 0.8s ease",
          opacity: sceneReady ? 0 : 1,
          pointerEvents: sceneReady ? "none" : "auto",
        }}>
          <div style={{ textAlign: "center" }}>
            <p style={{
              fontSize: "0.65rem", fontFamily: "var(--font-mono)",
              color: "var(--accent)", letterSpacing: "0.08em",
              textTransform: "uppercase", marginBottom: 12,
            }}>
              Building World Model
            </p>
            <p
              key={loadStep}
              style={{
                fontSize: "1.6rem", fontWeight: 600,
                fontFamily: "var(--font-serif)",
                color: "var(--text-primary)",
                letterSpacing: "-0.03em",
                animation: "fadeIn 0.5s ease forwards",
              }}
            >
              {loadStep}
            </p>
          </div>

          {/* Segmented progress bar */}
          <div style={{ display: "flex", gap: 4, width: 320 }}>
            {Array.from({ length: LOAD_BLOCKS }).map((_, i) => {
              const blockStart = i / LOAD_BLOCKS;
              const blockEnd = (i + 1) / LOAD_BLOCKS;
              const isFilled = displayProgress >= blockEnd;
              const isActive = displayProgress > blockStart && displayProgress < blockEnd;
              const fillFraction = isActive
                ? (displayProgress - blockStart) / (blockEnd - blockStart)
                : 0;

              return (
                <div key={i} style={{
                  flex: 1, height: 6, borderRadius: 3,
                  position: "relative",
                  backgroundColor: "var(--border)",
                  opacity: isFilled ? 1 : isActive ? 0.8 : 0.3,
                  overflow: "hidden",
                }}>
                  {/* Fill bar inside each block */}
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: 3,
                    backgroundColor: "var(--accent)",
                    width: isFilled ? "100%" : isActive ? `${fillFraction * 100}%` : "0%",
                    transition: isFilled ? "width 0.3s ease" : "none",
                  }} />
                </div>
              );
            })}
          </div>

          <p style={{
            fontSize: "0.68rem", fontFamily: "var(--font-mono)",
            color: "var(--text-muted)", letterSpacing: "0.04em",
          }}>
            {Math.round(displayProgress * 100)}%
          </p>
        </div>
      )}
      {/* Floating header — overlays the 3D scene */}
      <header style={{
        position: "absolute", top: 0, left: 0, right: 0,
        padding: "20px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        zIndex: 20,
        pointerEvents: "none",
      }}>
        <div />
        <div style={{ display: "flex", alignItems: "center", gap: 10, pointerEvents: "auto" }}>
          <button onClick={() => {
            const shot = viewerRef.current?.captureCanvas() || null;
            setViewerScreenshot(shot);
            setShowSummary(true);
          }} style={{
            padding: "0 24px", height: 44, borderRadius: 999,
            border: "none",
            backgroundColor: "#fff",
            color: "#1a1a1a",
            fontSize: "0.78rem", fontWeight: 600, fontFamily: "var(--font-sans)",
            cursor: "pointer",
            letterSpacing: "0.01em",
            boxShadow: "0 2px 12px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04)"; }}
          >
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
          onReady={() => setSceneReady(true)}
          onLoadProgress={handleLoadProgress}
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


        {/* Agent narration */}
        <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 15 }}>
          <NarrationPlayer text={narrationText} autoPlay={true} onAgentMessage={() => {}} />
        </div>

        {/* Hand tracker — bottom left */}
        {handTrackingEnabled && (
          <div style={{ position: "absolute", bottom: 16, left: 16, width: 240, height: 180, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)", zIndex: 15 }}>
            <HandTracker onGesture={handleGesture} enabled={handTrackingEnabled} />
          </div>
        )}
      </main>

      <SummaryView sessionId={sessionId} visible={showSummary} screenshot={viewerScreenshot} onClose={() => setShowSummary(false)} />
    </div>
  );
}

export default AppPage;
