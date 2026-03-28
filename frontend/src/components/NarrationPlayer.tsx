import { useEffect, useRef, useState } from "react";

interface Props {
  text: string | null;
  autoPlay: boolean;
  onAgentMessage?: (message: string) => void;
}

/**
 * Voice narration using browser-native Speech Synthesis.
 * No API key needed. Speaks narration text automatically.
 */
export default function NarrationPlayer({ text, autoPlay }: Props) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const lastTextRef = useRef<string | null>(null);

  useEffect(() => {
    if (!text || text === lastTextRef.current || !autoPlay || isMuted) return;
    if (!window.speechSynthesis) return;
    lastTextRef.current = text;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 0.9;
    utterance.volume = 1;

    // Try to pick a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((v) =>
      v.name.includes("Samantha") || v.name.includes("Daniel") ||
      v.name.includes("Google") || v.name.includes("English")
    );
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [text, autoPlay, isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); };
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
            if (!m) window.speechSynthesis?.cancel();
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
