import { useState } from "react";
import { getSummary } from "../utils/api";
import type { SummaryResponse } from "../utils/api";
import { jsPDF } from "jspdf";

interface Props {
  sessionId: string;
  visible: boolean;
  onClose: () => void;
}

export default function SummaryView({ sessionId, visible, onClose }: Props) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSummary(sessionId);
      setSummary(data);
    } catch (e: any) {
      setError(e.message || "Failed to generate summary");
    }
    setIsLoading(false);
  };

  const exportPDF = () => {
    if (!summary) return;
    const doc = new jsPDF();
    const margin = 20;
    let y = margin;

    doc.setFontSize(18);
    doc.setTextColor(6, 182, 212);
    doc.text("Surgical Planning Report", margin, y);
    y += 12;

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    doc.text(`Session: ${sessionId}`, margin, y + 5);
    y += 16;

    doc.setFontSize(13);
    doc.setTextColor(6, 182, 212);
    doc.text("Recommended Approach", margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    const approachLines = doc.splitTextToSize(summary.approach, 170);
    doc.text(approachLines, margin, y);
    y += approachLines.length * 5 + 8;

    if (summary.risk_inventory.length > 0) {
      doc.setFontSize(13);
      doc.setTextColor(239, 68, 68);
      doc.text("Risk Inventory", margin, y);
      y += 8;
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      for (const risk of summary.risk_inventory) {
        const line = `[${risk.severity.toUpperCase()}] ${risk.structure}: ${risk.mitigation}`;
        const lines = doc.splitTextToSize(line, 170);
        doc.text(lines, margin, y);
        y += lines.length * 5 + 3;
      }
      y += 5;
    }

    if (summary.scenarios_explored.length > 0) {
      doc.setFontSize(13);
      doc.setTextColor(245, 158, 11);
      doc.text("Scenarios Explored", margin, y);
      y += 8;
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      for (const scenario of summary.scenarios_explored) {
        const text = `${scenario.description}\n  -> ${scenario.outcome}`;
        const lines = doc.splitTextToSize(text, 170);
        doc.text(lines, margin, y);
        y += lines.length * 5 + 3;
      }
      y += 5;
    }

    if (summary.contingencies.length > 0) {
      doc.setFontSize(13);
      doc.setTextColor(16, 185, 129);
      doc.text("Contingencies", margin, y);
      y += 8;
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      for (const c of summary.contingencies) {
        const lines = doc.splitTextToSize(`- ${c}`, 170);
        doc.text(lines, margin, y);
        y += lines.length * 5 + 2;
      }
    }

    doc.save(`surgical-plan-${sessionId}.pdf`);
  };

  if (!visible) return null;

  const severityColor = (s: string) =>
    s === "high" ? "var(--risk-high)" : s === "medium" ? "var(--risk-medium)" : "var(--risk-low)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        animation: "fadeIn 0.25s ease",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          maxWidth: 800,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          padding: 36,
          boxShadow: "0 24px 48px rgba(0, 0, 0, 0.5)",
          animation: "fadeInScale 0.3s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 28,
          }}
        >
          <h2 style={{ color: "var(--text-primary)", margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>
            Surgical Planning Summary
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 8,
              width: 32,
              height: 32,
              color: "var(--text-secondary)",
              fontSize: "1.1rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
            }}
          >
            x
          </button>
        </div>

        {!summary && !isLoading && !error && (
          <div style={{ textAlign: "center", padding: 48 }}>
            <div style={{ marginBottom: 16 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
              </svg>
            </div>
            <button
              onClick={loadSummary}
              style={{
                padding: "12px 28px",
                borderRadius: 12,
                border: "none",
                backgroundColor: "var(--accent)",
                color: "#fff",
                fontSize: "0.95rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "none",
                transition: "all 0.2s ease",
              }}
            >
              Generate Summary
            </button>
          </div>
        )}

        {isLoading && (
          <div style={{ textAlign: "center", padding: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 28, height: 28, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
              Generating surgical plan...
            </span>
          </div>
        )}

        {error && (
          <div style={{ textAlign: "center", padding: 20, color: "var(--risk-high)", fontSize: "0.88rem" }}>
            {error}
          </div>
        )}

        {summary && (
          <>
            <section style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: "0.95rem", marginBottom: 10, fontWeight: 600 }}>
                Recommended Approach
              </h3>
              <p style={{ color: "var(--text-primary)", fontSize: "0.88rem", lineHeight: 1.7 }}>
                {summary.approach}
              </p>
            </section>

            {summary.risk_inventory.length > 0 && (
              <section style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: "0.95rem", marginBottom: 10, fontWeight: 600 }}>
                  Risk Inventory
                </h3>
                {summary.risk_inventory.map((risk, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "12px 16px",
                      marginBottom: 8,
                      backgroundColor: "var(--bg-surface)",
                      borderRadius: 10,
                      borderLeft: `3px solid ${severityColor(risk.severity)}`,
                      transition: "transform 0.15s ease",
                    }}
                  >
                    <div style={{ color: "var(--text-primary)", fontSize: "0.83rem", fontWeight: 600 }}>
                      [{risk.severity.toUpperCase()}] {risk.structure}
                    </div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.78rem", marginTop: 4 }}>
                      {risk.mitigation}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {summary.scenarios_explored.length > 0 && (
              <section style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: "0.95rem", marginBottom: 10, fontWeight: 600 }}>
                  Scenarios Explored
                </h3>
                {summary.scenarios_explored.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "12px 16px",
                      marginBottom: 8,
                      backgroundColor: "var(--bg-surface)",
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ color: "var(--text-primary)", fontSize: "0.83rem" }}>{s.description}</div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.78rem", marginTop: 4 }}>
                      - {s.outcome}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {summary.contingencies.length > 0 && (
              <section style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: "0.95rem", marginBottom: 10, fontWeight: 600 }}>
                  Contingencies
                </h3>
                {summary.contingencies.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      color: "var(--text-primary)",
                      fontSize: "0.83rem",
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                      lineHeight: 1.6,
                    }}
                  >
                    <span style={{ color: "var(--accent)", marginRight: 8 }}>-</span>{c}
                  </div>
                ))}
              </section>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <button
                onClick={exportPDF}
                style={{
                  padding: "10px 22px",
                  borderRadius: 10,
                  border: "none",
                  backgroundColor: "var(--accent)",
                  color: "#fff",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 2px 8px rgba(124, 92, 252, 0.3)",
                  transition: "all 0.2s ease",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7,10 12,15 17,10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export PDF
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: "10px 22px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  backgroundColor: "transparent",
                  color: "var(--text-secondary)",
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
