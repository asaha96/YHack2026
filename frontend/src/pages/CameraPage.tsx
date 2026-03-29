import { useRef, useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  Room,
  RoomEvent,
  createLocalTracks,
  Track,
  LocalVideoTrack,
} from "livekit-client";

// Use same origin — Vite proxies /api to the backend
const API_BASE = import.meta.env.VITE_API_URL || "";

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 2000;

type Status = "initializing" | "requesting_camera" | "connecting" | "streaming" | "error";

export default function CameraPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const reconnectAttempts = useRef(0);
  const [status, setStatus] = useState<Status>("initializing");
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  const [error, setError] = useState<string | null>(null);

  const connectAndPublish = useCallback(async () => {
    if (!roomCode) return;

    try {
      // Step 1: Request camera FIRST so the user sees the permission prompt immediately
      setStatus("requesting_camera");
      let tracks;
      try {
        tracks = await createLocalTracks({
          audio: false,
          video: {
            facingMode,
            resolution: { width: 1280, height: 720, frameRate: 30 },
          },
        });
      } catch (camErr: any) {
        setError("Camera access denied. Please allow camera permissions and refresh.");
        setStatus("error");
        return;
      }

      // Attach preview immediately so user sees their camera
      for (const track of tracks) {
        if (track.kind === Track.Kind.Video && videoRef.current) {
          (track as LocalVideoTrack).attach(videoRef.current);
        }
      }

      // Step 2: Fetch token
      setStatus("connecting");
      const res = await fetch(`${API_BASE}/api/livekit/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_name: roomCode,
          participant_name: `cam-${Date.now().toString(36)}`,
          participant_type: "phone",
        }),
      });

      if (!res.ok) throw new Error("Failed to get token from server");
      const { token, livekit_url } = await res.json();

      // Step 3: Connect to LiveKit room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      roomRef.current = room;

      room.on(RoomEvent.Disconnected, () => {
        setStatus("connecting");
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current++;
          setTimeout(() => connectAndPublish(), RECONNECT_DELAY_MS);
        } else {
          setError("Connection lost. Please refresh the page.");
          setStatus("error");
        }
      });

      await room.connect(livekit_url, token);
      reconnectAttempts.current = 0;

      // Step 4: Publish the tracks we already created
      for (const track of tracks) {
        await room.localParticipant.publishTrack(track, {
          source: Track.Source.Camera,
        });
      }

      setStatus("streaming");
      setError(null);
    } catch (err: any) {
      setError(err.message || "Connection failed");
      setStatus("error");
      console.error("LiveKit connection error:", err);
    }
  }, [roomCode, facingMode]);

  useEffect(() => {
    connectAndPublish();

    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect(true);
        roomRef.current = null;
      }
    };
  }, [connectAndPublish]);

  const flipCamera = () => {
    const newMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newMode);
    if (roomRef.current) {
      roomRef.current.disconnect(true);
      roomRef.current = null;
    }
  };

  const statusText = {
    initializing: "Starting...",
    requesting_camera: "Allow camera access...",
    connecting: "Connecting to room...",
    streaming: "Streaming",
    error: "Error",
  }[status];

  const statusColor =
    status === "streaming" ? "#22c55e" :
    status === "error" ? "#ef4444" :
    "#eab308";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Video preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      {/* Status overlay */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          right: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(0,0,0,0.6)",
            padding: "8px 16px",
            borderRadius: 20,
            color: "#fff",
            fontSize: 14,
            fontFamily: "monospace",
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: statusColor,
              boxShadow: `0 0 8px ${statusColor}`,
            }}
          />
          {statusText}
        </div>

        <div
          style={{
            background: "rgba(0,0,0,0.6)",
            padding: "8px 16px",
            borderRadius: 20,
            color: "#fff",
            fontSize: 14,
            fontFamily: "monospace",
            letterSpacing: 2,
          }}
        >
          {roomCode}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            position: "absolute",
            bottom: 100,
            left: 16,
            right: 16,
            background: "rgba(239,68,68,0.9)",
            color: "#fff",
            padding: "12px 16px",
            borderRadius: 12,
            fontSize: 14,
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}

      {/* Flip camera button */}
      <button
        onClick={flipCamera}
        style={{
          position: "absolute",
          bottom: 32,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.2)",
          border: "2px solid rgba(255,255,255,0.5)",
          color: "#fff",
          fontSize: 24,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(8px)",
        }}
        aria-label="Flip camera"
      >
        &#x21BB;
      </button>
    </div>
  );
}
