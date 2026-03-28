import { useState, useRef, useEffect } from "react";

interface Props {
  sessionId: string;
  onComplete: (assessment: any) => void;
}

export default function PatientAssess({ sessionId, onComplete }: Props) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [assessment, setAssessment] = useState<any>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (e: any) => {
        let text = "";
        for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        setTranscript(text);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) { recognitionRef.current.stop(); setIsListening(false); }
    else { setTranscript(""); recognitionRef.current.start(); setIsListening(true); }
  };

  const handleParse = async () => {
    if (!transcript.trim()) return;
    setIsParsing(true);
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); }
    try {
      const res = await fetch("http://localhost:8000/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, transcript: transcript.trim() }),
      });
      const data = await res.json();
      setAssessment(data);
    } catch (e) {
      console.error("Assessment failed:", e);
    }
    setIsParsing(false);
  };

  const severityColor = (s: string) => s === "critical" ? "var(--risk-high)" : s === "moderate" ? "var(--risk-medium)" : "var(--risk-low)";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%", overflow: "auto", padding: "32px 24px", gap: 24, maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--accent)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Step 2</p>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 300, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Describe patient injuries</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.78rem", marginTop: 6 }}>Speak freely — the AI will parse your assessment.</p>
      </div>

      {/* Mic button */}
      <button
        onClick={toggleListening}
        style={{
          width: 72, height: 72, borderRadius: "50%",
          border: `2px solid ${isListening ? "var(--risk-high)" : "var(--accent)"}`,
          backgroundColor: isListening ? "rgba(248, 113, 113, 0.1)" : "var(--accent-dim)",
          color: isListening ? "var(--risk-high)" : "var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
        </svg>
      </button>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: isListening ? "var(--risk-high)" : "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginTop: -12 }}>
        {isListening ? "Recording..." : "Tap to speak"}
      </span>

      {/* Transcript */}
      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder="Or type the assessment here..."
        style={{
          width: "100%", minHeight: 100, padding: 12,
          borderRadius: "var(--radius-md)", border: "1px solid var(--border)",
          backgroundColor: "var(--bg-surface)", color: "var(--text-primary)",
          fontSize: "0.82rem", lineHeight: 1.6, resize: "vertical", outline: "none",
          fontFamily: "var(--font-sans)",
        }}
      />

      {!assessment && (
        <button onClick={handleParse} disabled={!transcript.trim() || isParsing} style={{
          width: "100%", padding: "11px", borderRadius: "var(--radius-sm)",
          border: "1px solid var(--accent)", backgroundColor: "var(--accent-dim)",
          color: "var(--accent)", fontSize: "0.82rem", fontWeight: 500,
          opacity: !transcript.trim() || isParsing ? 0.4 : 1,
        }}>
          {isParsing ? "Parsing injuries..." : "Analyze assessment"}
        </button>
      )}

      {/* Parsed result */}
      {assessment && (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, animation: "fadeIn 0.3s ease" }}>
          <div style={{ padding: 14, borderRadius: "var(--radius-md)", border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>Patient Summary</p>
            <p style={{ fontSize: "0.82rem", color: "var(--text-primary)", lineHeight: 1.5 }}>{assessment.summary}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <span style={{ padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontSize: "0.65rem", color: "var(--text-secondary)" }}>
                {assessment.consciousness}
              </span>
              {assessment.age_estimate !== "unknown" && (
                <span style={{ padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontSize: "0.65rem", color: "var(--text-secondary)" }}>
                  ~{assessment.age_estimate}
                </span>
              )}
              <span style={{ padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontSize: "0.65rem", color: "var(--text-secondary)" }}>
                {assessment.mechanism}
              </span>
            </div>
          </div>

          {assessment.injuries?.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {assessment.injuries.map((inj: any, i: number) => (
                <div key={i} style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-primary)" }}>{inj.location} — {inj.type}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: severityColor(inj.severity), textTransform: "uppercase", letterSpacing: "0.04em" }}>{inj.severity}</span>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => onComplete(assessment)} style={{
            width: "100%", padding: "11px", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--accent)", backgroundColor: "var(--accent-dim)",
            color: "var(--accent)", fontSize: "0.82rem", fontWeight: 500,
          }}>
            Confirm & simulate scenarios
          </button>
        </div>
      )}
    </div>
  );
}
