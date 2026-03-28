import { useState, useRef, useEffect } from "react";
import type { AgentResponse } from "../utils/api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  risks?: AgentResponse["risks"];
  recommendations?: string[];
}

interface Props {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onSemanticQuery?: (message: string) => void;
  isLoading: boolean;
  selectedOrgan: string | null;
}

const SEARCH_PREFIXES = ["find", "locate", "where", "show me", "search", "identify"];

export default function ChatPanel({ messages, onSendMessage, onSemanticQuery, isLoading, selectedOrgan }: Props) {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results).map((result: any) => result[0].transcript).join("");
        if (event.results[0].isFinal) { setInput(transcript); setIsListening(false); }
        else setInput(transcript);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) { recognitionRef.current.stop(); setIsListening(false); }
    else { recognitionRef.current.start(); setIsListening(true); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    const isSearch = searchMode || SEARCH_PREFIXES.some((p) => text.toLowerCase().startsWith(p));
    if (isSearch && onSemanticQuery) {
      onSemanticQuery(text);
    } else {
      onSendMessage(text);
    }
    setInput("");
    setSearchMode(false);
  };

  const severityColor = (s: string) =>
    s === "high" ? "var(--risk-high)" : s === "medium" ? "var(--risk-medium)" : "var(--risk-low)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "var(--bg-primary)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span style={{ color: "var(--text-primary)", fontSize: "0.85rem", fontWeight: 600 }}>
            Assistant
          </span>
        </div>
        {selectedOrgan && (
          <span
            style={{
              color: "var(--accent)",
              fontSize: "0.72rem",
              fontWeight: 500,
              padding: "3px 10px",
              borderRadius: 12,
              backgroundColor: "var(--accent-glow)",
              border: "1px solid rgba(124, 92, 252, 0.2)",
            }}
          >
            {selectedOrgan.replace("_", " ")}
          </span>
        )}
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              color: "var(--text-muted)",
              fontSize: "0.82rem",
              textAlign: "center",
              marginTop: "3rem",
              lineHeight: 1.7,
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12, display: "block", margin: "0 auto 12px" }}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            Select an organ or ask a question
            <br />
            to begin surgical planning
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              animation: "fadeIn 0.3s ease",
            }}
          >
            <div
              style={{
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "92%",
                padding: "11px 15px",
                borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                backgroundColor: msg.role === "user" ? "rgba(124, 92, 252, 0.12)" : "var(--bg-surface)",
                color: msg.role === "user" ? "var(--accent-light)" : "var(--text-primary)",
                fontSize: "0.83rem",
                lineHeight: 1.6,
                border: `1px solid ${msg.role === "user" ? "rgba(124, 92, 252, 0.15)" : "var(--border)"}`,
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {msg.content}
            </div>

            {msg.risks && msg.risks.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 4 }}>
                {msg.risks.map((risk, j) => (
                  <span
                    key={j}
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 500,
                      padding: "3px 9px",
                      borderRadius: 10,
                      backgroundColor: `color-mix(in srgb, ${severityColor(risk.severity)} 12%, transparent)`,
                      color: severityColor(risk.severity),
                      border: `1px solid color-mix(in srgb, ${severityColor(risk.severity)} 25%, transparent)`,
                    }}
                  >
                    {risk.severity.toUpperCase()}: {risk.structure}
                    {risk.distance_mm ? ` (${risk.distance_mm}mm)` : ""}
                  </span>
                ))}
              </div>
            )}

            {msg.recommendations && msg.recommendations.length > 0 && (
              <div style={{ paddingLeft: 4, fontSize: "0.73rem", color: "var(--text-secondary)" }}>
                {msg.recommendations.map((rec, j) => (
                  <div key={j} style={{ marginBottom: 4, display: "flex", gap: 6 }}>
                    <span style={{ color: "var(--accent)", flexShrink: 0 }}>-</span>
                    {rec}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", animation: "fadeIn 0.2s ease" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: "var(--accent)",
                    animation: `dotPulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
            <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
              Analyzing...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        style={{
          padding: "14px 20px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={toggleListening}
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: `1px solid ${isListening ? "var(--risk-high)" : "var(--border)"}`,
            backgroundColor: isListening ? "rgba(239, 68, 68, 0.1)" : "transparent",
            color: isListening ? "var(--risk-high)" : "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.2s ease",
            opacity: isListening ? 1 : 0.7,
          }}
          title="Voice input"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isListening ? "Listening..." : "Ask about the anatomy..."}
          style={{
            flex: 1,
            padding: "9px 14px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            backgroundColor: "var(--bg-surface)",
            color: "var(--text-primary)",
            fontSize: "0.83rem",
            outline: "none",
            transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "var(--accent)";
            e.target.style.boxShadow = "0 0 0 3px rgba(124, 92, 252, 0.1)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "var(--border)";
            e.target.style.boxShadow = "none";
          }}
          disabled={isLoading}
        />
        {onSemanticQuery && (
          <button
            type="button"
            onClick={() => setSearchMode((s) => !s)}
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              border: `1px solid ${searchMode ? "var(--accent-secondary)" : "var(--border)"}`,
              backgroundColor: searchMode ? "var(--accent-secondary-glow)" : "transparent",
              color: searchMode ? "var(--accent-secondary)" : "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.2s ease",
            }}
            title={searchMode ? "Search mode (BiomedCLIP)" : "Switch to search mode"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          style={{
            padding: "9px 18px",
            borderRadius: 12,
            border: "none",
            background: searchMode
              ? "var(--accent-secondary)"
              : "var(--accent)",
            color: "#fff",
            fontSize: "0.83rem",
            fontWeight: 600,
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading || !input.trim() ? 0.4 : 1,
            flexShrink: 0,
            transition: "all 0.2s ease",
            boxShadow: isLoading || !input.trim() ? "none" : searchMode
              ? "none"
              : "none",
          }}
        >
          {searchMode ? "Search" : "Send"}
        </button>
      </form>
    </div>
  );
}
