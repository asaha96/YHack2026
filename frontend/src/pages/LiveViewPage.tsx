import { useState, useEffect, useCallback, useRef } from "react";
import { useLiveKit } from "../hooks/useLiveKit";
import type { AgentLabel } from "../hooks/useLiveKit";
import VideoOverlay from "../components/VideoOverlay";
import RoomSetup from "../components/RoomSetup";
import HandTracker from "../components/HandTracker";
import type { GestureType } from "../hooks/useGestures";

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
  const [showOrganLabels, setShowOrganLabels] = useState(true);

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
    w: lastPoseUpdate?.frame_width ?? 640,
    h: lastPoseUpdate?.frame_height ?? 480,
  };
  const agentLabels: AgentLabel[] = lastAgentLabels?.labels ?? [];
  const narration = lastAgentLabels?.narration ?? "";

  const streaming = phoneConnected && remoteVideoElement !== null;

  // Speech recognition
  const recognitionRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [speechUnsupported, setSpeechUnsupported] = useState(false);

  // Container sizing
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewSize, setViewSize] = useState({ width: 960, height: 720 });

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

  // Speech recognition
  const toggleSpeech = useCallback(() => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechUnsupported(true);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const last = event.results[event.results.length - 1];
      if (last.isFinal) {
        const text = last[0].transcript.trim();
        if (text) {
          sendData({ text }, "speech");
        }
      }
    };

    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }, [listening, sendData]);

  // Hand gesture handler
  const handleGesture = useCallback(
    (
      type: GestureType,
      screenPos: { x: number; y: number } | null,
      _tracePath: { x: number; y: number }[]
    ) => {
      if (type !== "none" && screenPos) {
        console.debug(`Gesture: ${type}`, screenPos);
      }
    },
    []
  );

  // Request agent analysis
  const requestAgent = useCallback(() => {
    sendData({}, "request_agent");
  }, [sendData]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg-primary, #0a0e17)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'DM Sans', sans-serif",
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
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#2dd4bf",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            SurgiVision
          </span>
          <span
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.3)",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            LIVE
          </span>
          <span
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.4)",
              fontFamily: "'JetBrains Mono', monospace",
              background: "rgba(255,255,255,0.05)",
              padding: "4px 10px",
              borderRadius: 6,
            }}
          >
            Room: {roomName}
          </span>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background:
                connectionState === "connected" ? "#22c55e" : "#eab308",
              boxShadow:
                connectionState === "connected"
                  ? "0 0 8px #22c55e"
                  : "0 0 8px #eab308",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowOrganLabels((p) => !p)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: showOrganLabels
                ? "rgba(45, 212, 191, 0.15)"
                : "transparent",
              color: showOrganLabels ? "#2dd4bf" : "rgba(255,255,255,0.5)",
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              cursor: "pointer",
            }}
          >
            Organs
          </button>

          <button
            onClick={() => setHandTrackingEnabled((p) => !p)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: handTrackingEnabled
                ? "rgba(45, 212, 191, 0.15)"
                : "transparent",
              color: handTrackingEnabled
                ? "#2dd4bf"
                : "rgba(255,255,255,0.5)",
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              cursor: "pointer",
            }}
          >
            Hands
          </button>

          <button
            onClick={toggleSpeech}
            title={speechUnsupported ? "Speech recognition not supported in this browser" : ""}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: listening
                ? "rgba(239, 68, 68, 0.15)"
                : speechUnsupported
                  ? "rgba(255,255,255,0.03)"
                  : "transparent",
              color: listening
                ? "#ef4444"
                : speechUnsupported
                  ? "rgba(255,255,255,0.2)"
                  : "rgba(255,255,255,0.5)",
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              cursor: speechUnsupported ? "not-allowed" : "pointer",
              textDecoration: speechUnsupported ? "line-through" : "none",
            }}
          >
            {listening ? "Listening..." : speechUnsupported ? "Mic N/A" : "Mic"}
          </button>

          <button
            onClick={requestAgent}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent",
              color: "rgba(255,255,255,0.5)",
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              cursor: "pointer",
            }}
          >
            Analyze
          </button>
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
            <VideoOverlay
              videoElement={remoteVideoElement}
              landmarks={landmarks}
              connections={connections}
              organPositions={showOrganLabels ? organPositions : null}
              agentLabels={agentLabels}
              width={viewSize.width}
              height={viewSize.height}
            />

            {/* Hand tracker PIP */}
            {handTrackingEnabled && (
              <div
                style={{
                  position: "absolute",
                  bottom: 12,
                  left: 12,
                  width: 200,
                  height: 150,
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid rgba(45, 212, 191, 0.3)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
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
      {narration && streaming && (
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.5,
              fontFamily: "'DM Sans', sans-serif",
              maxWidth: 800,
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            {narration}
          </div>
        </div>
      )}
    </div>
  );
}
