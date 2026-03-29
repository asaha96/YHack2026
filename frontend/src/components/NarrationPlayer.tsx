import { useEffect, useRef, useState } from "react";

interface Props {
  text: string | null;
  autoPlay: boolean;
  onAgentMessage?: (message: string) => void;
}

/**
 * Voice narration using ElevenLabs TTS via backend /api/narrate endpoint.
 */
export default function NarrationPlayer({ text, autoPlay }: Props) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const lastTextRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const speakText = async (t: string) => {
    // Stop any ongoing playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setIsSpeaking(true);
      const res = await fetch("http://localhost:8000/api/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`TTS failed: ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      await audio.play();
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.warn("ElevenLabs TTS failed, falling back to browser speech:", e);
        // Fallback to browser speech synthesis
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(t);
          utterance.rate = 0.95;
          utterance.pitch = 0.9;
          utterance.onend = () => setIsSpeaking(false);
          utterance.onerror = () => setIsSpeaking(false);
          window.speechSynthesis.speak(utterance);
        } else {
          setIsSpeaking(false);
        }
      } else {
        setIsSpeaking(false);
      }
    }
  };

  useEffect(() => {
    if (!text || text === lastTextRef.current || !autoPlay || isMuted) return;
    lastTextRef.current = text;
    speakText(text);
  }, [text, autoPlay, isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (abortRef.current) abortRef.current.abort();
      window.speechSynthesis?.cancel();
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
              if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
              if (abortRef.current) abortRef.current.abort();
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
