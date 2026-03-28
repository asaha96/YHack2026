import { useState, useEffect, useCallback, useRef } from "react";

interface POI {
  id: string;
  position: number[];
  camera_position: number[];
  camera_target: number[];
  label: string;
  narration: string;
  type: "info" | "danger" | "action";
  tags: string[];
}

interface Props {
  active: boolean;
  onMoveTo: (cameraPos: number[], target: number[]) => void;
  onNarrate: (text: string) => void;
  onPOIChange: (poi: POI | null) => void;
  onCommand: (cmd: string) => void;
}

export default function AgentTour({ active, onMoveTo, onNarrate, onPOIChange, onCommand }: Props) {
  const [pois, setPois] = useState<POI[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const recognitionRef = useRef<any>(null);

  // Load POIs
  useEffect(() => {
    fetch("http://localhost:8000/api/poi")
      .then((r) => r.json())
      .then((data) => setPois(data.points_of_interest || []))
      .catch(() => {});
  }, []);

  // Navigate to a POI
  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= pois.length) return;
    const poi = pois[index];
    setCurrentIndex(index);
    onPOIChange(poi);
    onMoveTo(poi.camera_position, poi.camera_target);

    // Narrate after a short delay for camera movement
    setTimeout(() => {
      onNarrate(poi.narration);
    }, 800);
  }, [pois, onMoveTo, onNarrate, onPOIChange]);

  // Auto-tour
  useEffect(() => {
    if (!active || !isAutoPlaying || pois.length === 0) return;

    // Start tour
    if (currentIndex === -1) {
      goTo(0);
      return;
    }

    // Schedule next POI
    timerRef.current = setTimeout(() => {
      const next = (currentIndex + 1) % pois.length;
      goTo(next);
    }, 8000); // 8 seconds per POI

    return () => clearTimeout(timerRef.current);
  }, [active, isAutoPlaying, currentIndex, pois.length, goTo]);

  // Voice command setup
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (e: any) => {
      const transcript = e.results[e.results.length - 1][0].transcript.toLowerCase().trim();
      handleVoiceCommand(transcript);
    };
    recognition.onerror = () => {};
    recognition.onend = () => {
      // Restart if still active
      if (isListening) try { recognition.start(); } catch {}
    };

    recognitionRef.current = recognition;

    return () => { try { recognition.stop(); } catch {} };
  }, []);

  // Start/stop listening
  useEffect(() => {
    if (!active || !recognitionRef.current) return;
    try { recognitionRef.current.start(); setIsListening(true); } catch {}
    return () => { try { recognitionRef.current.stop(); setIsListening(false); } catch {} };
  }, [active]);

  const handleVoiceCommand = useCallback((text: string) => {
    if (text.includes("next") || text.includes("continue")) {
      const next = Math.min(currentIndex + 1, pois.length - 1);
      goTo(next);
    } else if (text.includes("back") || text.includes("previous")) {
      const prev = Math.max(currentIndex - 1, 0);
      goTo(prev);
    } else if (text.includes("stop") || text.includes("explore") || text.includes("free")) {
      setIsAutoPlaying(false);
      onCommand("free_explore");
    } else if (text.includes("tour") || text.includes("guide")) {
      setIsAutoPlaying(true);
    } else if (text.includes("show me") || text.includes("where is") || text.includes("go to")) {
      // Find matching POI by tag or label
      const match = pois.findIndex((p) =>
        p.tags.some((t) => text.includes(t)) ||
        p.label.toLowerCase().split(" ").some((w) => text.includes(w))
      );
      if (match >= 0) goTo(match);
      else onCommand(text); // Pass to chat agent
    } else if (text.includes("what if") || text.includes("cut") || text.includes("incision")) {
      onCommand(text); // Pass to chat agent for AI response
    }
  }, [currentIndex, pois, goTo, onCommand]);

  if (!active || pois.length === 0) return null;

  const currentPoi = currentIndex >= 0 ? pois[currentIndex] : null;
  const typeColor = (t: string) => t === "danger" ? "var(--risk-high)" : t === "action" ? "var(--accent)" : "var(--text-secondary)";

  return (
    <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {/* Current POI info */}
      {currentPoi && (
        <div style={{
          padding: "10px 18px",
          borderRadius: "var(--radius-md)",
          border: `1px solid ${typeColor(currentPoi.type)}`,
          backgroundColor: "rgba(10, 10, 12, 0.85)",
          backdropFilter: "blur(8px)",
          maxWidth: 480,
          textAlign: "center",
        }}>
          <div style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono)", color: typeColor(currentPoi.type), letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
            {currentPoi.type === "danger" ? "Caution" : currentPoi.type === "action" ? "Recommendation" : "Structure"}
          </div>
          <div style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text-primary)" }}>
            {currentPoi.label}
          </div>
        </div>
      )}

      {/* Tour controls */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "6px 10px",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border)",
        backgroundColor: "rgba(10, 10, 12, 0.85)",
        backdropFilter: "blur(8px)",
      }}>
        <button onClick={() => goTo(Math.max(0, currentIndex - 1))} style={{ padding: "4px 8px", border: "none", background: "transparent", color: "var(--text-muted)", fontSize: "0.7rem", cursor: "pointer" }}>
          Prev
        </button>

        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
          {currentIndex + 1} / {pois.length}
        </span>

        <button onClick={() => goTo(Math.min(pois.length - 1, currentIndex + 1))} style={{ padding: "4px 8px", border: "none", background: "transparent", color: "var(--text-muted)", fontSize: "0.7rem", cursor: "pointer" }}>
          Next
        </button>

        <div style={{ width: 1, height: 14, backgroundColor: "var(--border)" }} />

        <button
          onClick={() => setIsAutoPlaying((a) => !a)}
          style={{
            padding: "4px 10px", border: `1px solid ${isAutoPlaying ? "var(--accent)" : "var(--border)"}`,
            borderRadius: "var(--radius-sm)", background: isAutoPlaying ? "var(--accent-dim)" : "transparent",
            color: isAutoPlaying ? "var(--accent)" : "var(--text-muted)", fontSize: "0.65rem", fontWeight: 500,
          }}
        >
          {isAutoPlaying ? "Auto" : "Manual"}
        </button>

        <button
          onClick={() => onCommand("free_explore")}
          style={{ padding: "4px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "transparent", color: "var(--text-muted)", fontSize: "0.65rem" }}
        >
          Free Explore
        </button>
      </div>

      {/* Voice status */}
      {isListening && (
        <div style={{ fontSize: "0.58rem", fontFamily: "var(--font-mono)", color: "var(--accent)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Listening for commands...
        </div>
      )}
    </div>
  );
}

export type { POI };
