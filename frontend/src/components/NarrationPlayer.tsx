import { useEffect, useRef, useState } from "react";

interface Props {
  text: string | null;
  autoPlay: boolean;
  onAgentMessage?: (message: string) => void;
}

/**
 * Voice narration using ElevenLabs TTS via backend /api/narrate endpoint.
 * Queues narrations so each one finishes before the next starts.
 */
export default function NarrationPlayer({ text, autoPlay }: Props) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const lastTextRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  const playNext = async () => {
    if (isPlayingRef.current || queueRef.current.length === 0) return;
    isPlayingRef.current = true;
    const t = queueRef.current.shift()!;

    try {
      setIsSpeaking(true);
      const res = await fetch("http://localhost:8000/api/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      if (!res.ok) throw new Error(`TTS failed: ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      await new Promise<void>((resolve) => {
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        audio.play().catch(() => resolve());
      });
    } catch {
      // TTS failed — skip and continue queue
    }

    audioRef.current = null;
    isPlayingRef.current = false;
    setIsSpeaking(queueRef.current.length > 0);
    playNext();
  };

  useEffect(() => {
    if (!text || text === lastTextRef.current || !autoPlay || isMuted) return;
    lastTextRef.current = text;
    queueRef.current.push(text);
    playNext();
  }, [text, autoPlay, isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      queueRef.current = [];
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "4px 12px", borderRadius: "var(--radius-sm)",
      border: `1px solid ${isSpeaking ? "var(--accent)" : "var(--border)"}`,
      backgroundColor: isSpeaking ? "var(--accent-dim)" : "transparent",
    }}>
      <button
        onClick={() => {
          setIsMuted((m) => {
            if (!m) {
              queueRef.current = [];
              if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
              isPlayingRef.current = false;
              setIsSpeaking(false);
            }
            return !m;
          });
        }}
        style={{
          background: "none", border: "none", padding: 0, cursor: "pointer",
          color: isMuted ? "var(--text-muted)" : isSpeaking ? "var(--accent)" : "var(--text-secondary)",
          display: "flex", alignItems: "center",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {isMuted ? (
            <>
              <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </>
          ) : (
            <>
              <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </>
          )}
        </svg>
      </button>
      <span style={{
        fontSize: "0.62rem", fontWeight: 500,
        color: isSpeaking ? "var(--accent)" : "var(--text-muted)",
      }}>
        {isMuted ? "Muted" : isSpeaking ? "Speaking" : "Voice"}
      </span>
    </div>
  );
}
