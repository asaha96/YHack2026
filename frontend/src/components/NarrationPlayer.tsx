import { useEffect, useRef } from "react";
import {
  useConversationControls,
  useConversationStatus,
  useConversationMode,
} from "@elevenlabs/react";

const AGENT_ID = "agent_9501kms9kx0hfc8rrq20d23z4ech";

interface Props {
  text: string | null;
  autoPlay: boolean;
  onAgentMessage?: (message: string) => void;
}

export default function NarrationPlayer({ text, autoPlay }: Props) {
  const { startSession, endSession, sendContextualUpdate } = useConversationControls();
  const { status } = useConversationStatus();
  const { isSpeaking } = useConversationMode();
  const lastTextRef = useRef<string | null>(null);

  const isConnected = status === "connected";

  const handleStart = () => {
    startSession({ agentId: AGENT_ID });
  };

  const handleStop = () => {
    endSession();
  };

  useEffect(() => {
    if (!text || text === lastTextRef.current || !isConnected || !autoPlay) return;
    lastTextRef.current = text;
    try { sendContextualUpdate(text); } catch { /* session may not be ready */ }
  }, [text, isConnected, autoPlay, sendContextualUpdate]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        backgroundColor: isConnected ? "var(--accent-glow)" : "var(--bg-surface)",
        borderRadius: 20,
        border: `1px solid ${isConnected ? "rgba(6, 182, 212, 0.25)" : "var(--border)"}`,
        transition: "all 0.3s ease",
        animation: isSpeaking ? "glowPulse 2s ease-in-out infinite" : undefined,
      }}
    >
      <button
        onClick={isConnected ? handleStop : handleStart}
        style={{
          background: "none",
          border: "none",
          color: isConnected ? "var(--accent-light)" : "var(--text-muted)",
          cursor: "pointer",
          padding: 0,
          display: "flex",
          alignItems: "center",
          transition: "color 0.2s ease",
        }}
        title={isConnected ? "Disconnect voice agent" : "Connect voice agent"}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {isConnected ? (
            isSpeaking ? (
              <>
                <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </>
            ) : (
              <>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              </>
            )
          ) : (
            <>
              <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </>
          )}
        </svg>
      </button>
      <span
        style={{
          fontSize: "0.72rem",
          fontWeight: 500,
          color: isSpeaking ? "var(--accent-light)" : isConnected ? "var(--accent)" : "var(--text-muted)",
          transition: "color 0.2s ease",
        }}
      >
        {status === "connecting"
          ? "Connecting..."
          : isSpeaking
          ? "Speaking..."
          : isConnected
          ? "Listening"
          : "Voice Off"}
      </span>
    </div>
  );
}
