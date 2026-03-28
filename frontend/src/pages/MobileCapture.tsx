import { useEffect, useRef, useState } from "react";

/**
 * Mobile camera page — accessed from phone browser.
 * Streams video frames to the backend for skeleton detection.
 * URL: /mobile
 */
export default function MobileCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState("Initializing camera...");
  const [sessionId] = useState(`mobile-${Date.now().toString(36)}`);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    let stream: MediaStream | null = null;

    const init = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: 640, height: 480 },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsStreaming(true);
          setStatus("Streaming to server...");
          startStreaming();
        }
      } catch (e: any) {
        setStatus(`Camera error: ${e.message}`);
      }
    };

    const startStreaming = () => {
      // Send frames at 5fps to backend
      intervalRef.current = setInterval(() => {
        captureAndSend();
      }, 200);
    };

    init();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const captureAndSend = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, 320, 240);
    const base64 = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];

    try {
      const API = window.location.hostname === "localhost"
        ? "http://localhost:8000"
        : `http://${window.location.hostname}:8000`;

      await fetch(`${API}/api/skeleton/frame`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, frame_base64: base64 }),
      });
    } catch {
      // Network error — continue
    }
  };

  return (
    <div style={{
      width: "100vw", height: "100vh",
      backgroundColor: "#0a0a0c",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <video
        ref={videoRef}
        style={{
          width: "100%", maxWidth: 480,
          borderRadius: 12,
          border: isStreaming ? "2px solid #2dd4bf" : "2px solid #1f1f24",
        }}
        playsInline
        muted
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div style={{ marginTop: 16, textAlign: "center" }}>
        <p style={{ color: isStreaming ? "#2dd4bf" : "#85858f", fontSize: "0.82rem", fontWeight: 500 }}>
          {status}
        </p>
        <p style={{ color: "#4a4a55", fontSize: "0.68rem", marginTop: 6 }}>
          Session: {sessionId}
        </p>
        {isStreaming && (
          <div style={{
            marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#2dd4bf", animation: "pulse 1s infinite" }} />
            <span style={{ color: "#2dd4bf", fontSize: "0.72rem", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Live
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
