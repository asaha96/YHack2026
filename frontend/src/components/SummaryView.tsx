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
    doc.setTextColor(47, 39, 31);
    doc.text("Surgical Planning Report", margin, y);
    y += 10;

    doc.setFontSize(8);
    doc.setTextColor(140, 130, 120);
    doc.text(`Generated ${new Date().toLocaleString()}  |  Session ${sessionId}`, margin, y);
    y += 14;

    doc.setFontSize(11);
    doc.setTextColor(47, 39, 31);
    doc.text("RECOMMENDED APPROACH", margin, y);
    y += 7;
    doc.setFontSize(9.5);
    doc.setTextColor(80, 70, 60);
    const approachLines = doc.splitTextToSize(summary.approach, 170);
    doc.text(approachLines, margin, y);
    y += approachLines.length * 5 + 10;

    if (summary.risk_inventory.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(47, 39, 31);
      doc.text("RISK INVENTORY", margin, y);
      y += 7;
      doc.setFontSize(9.5);
      doc.setTextColor(80, 70, 60);
      for (const risk of summary.risk_inventory) {
        const line = `[${risk.severity.toUpperCase()}] ${risk.structure} — ${risk.mitigation}`;
        const lines = doc.splitTextToSize(line, 170);
        doc.text(lines, margin, y);
        y += lines.length * 5 + 3;
      }
      y += 8;
    }

    if (summary.scenarios_explored.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(47, 39, 31);
      doc.text("SCENARIOS EXPLORED", margin, y);
      y += 7;
      doc.setFontSize(9.5);
      doc.setTextColor(80, 70, 60);
      for (const scenario of summary.scenarios_explored) {
        const text = `${scenario.description}\n  Outcome: ${scenario.outcome}`;
        const lines = doc.splitTextToSize(text, 170);
        doc.text(lines, margin, y);
        y += lines.length * 5 + 3;
      }
      y += 8;
    }

    if (summary.contingencies.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(47, 39, 31);
      doc.text("CONTINGENCIES", margin, y);
      y += 7;
      doc.setFontSize(9.5);
      doc.setTextColor(80, 70, 60);
      for (const c of summary.contingencies) {
        const lines = doc.splitTextToSize(`• ${c}`, 170);
        doc.text(lines, margin, y);
        y += lines.length * 5 + 2;
      }
    }

    doc.save(`surgical-plan-${sessionId}.pdf`);
  };

  if (!visible) return null;

  const severityColor = (s: string) =>
    s === "high" ? "#ef4444" : s === "medium" ? "#f59e0b" : "#34d399";

  const severityBg = (s: string) =>
    s === "high" ? "rgba(239,68,68,0.06)" : s === "medium" ? "rgba(245,158,11,0.06)" : "rgba(52,211,153,0.06)";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          maxWidth: 720,
          width: "100%",
          maxHeight: "85vh",
          overflow: "auto",
          padding: 0,
          boxShadow: "0 32px 64px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03) inset",
          animation: "fadeInScale 0.3s ease",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "28px 36px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        }}>
          <div>
            <p style={{
              fontSize: "0.6rem", fontFamily: "var(--font-mono)",
              color: "var(--accent)", letterSpacing: "0.1em",
              textTransform: "uppercase", marginBottom: 6,
            }}>
              Surgical Report
            </p>
            <h2 style={{
              color: "var(--text-primary)", margin: 0,
              fontSize: "1.4rem", fontWeight: 600,
              fontFamily: "var(--font-serif)",
              letterSpacing: "-0.03em",
            }}>
              Pre-Operative Planning Summary
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none",
              color: "var(--text-muted)", fontSize: "1.4rem",
              cursor: "pointer", padding: "4px 8px",
              lineHeight: 1, marginTop: -4,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: "24px 36px 32px" }}>
          {/* Initial state — generate button */}
          {!summary && !isLoading && !error && (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{
                width: 56, height: 56, margin: "0 auto 20px",
                borderRadius: 16,
                backgroundColor: "var(--accent-dim)",
                border: "1px solid var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <p style={{
                color: "var(--text-secondary)", fontSize: "0.85rem",
                marginBottom: 20, lineHeight: 1.6,
              }}>
                Generate a comprehensive surgical planning report<br />
                based on your simulation session.
              </p>
              <button
                onClick={loadSummary}
                style={{
                  padding: "12px 32px", borderRadius: 999,
                  border: "1px solid var(--accent)",
                  backgroundColor: "var(--accent-dim)",
                  color: "var(--accent-light)",
                  fontSize: "0.82rem", fontWeight: 600,
                  fontFamily: "var(--font-sans)",
                  backdropFilter: "blur(10px)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                Generate Report
              </button>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div style={{ textAlign: "center", padding: "56px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 28, height: 28,
                border: "2px solid var(--border)", borderTopColor: "var(--accent)",
                borderRadius: "50%", animation: "spin 0.8s linear infinite",
              }} />
              <div>
                <p style={{
                  color: "var(--text-primary)", fontSize: "0.9rem",
                  fontWeight: 500, marginBottom: 4,
                }}>
                  Analyzing simulation data
                </p>
                <p style={{
                  color: "var(--text-muted)", fontSize: "0.72rem",
                  fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
                }}>
                  Generating risk inventory and recommendations...
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <p style={{ color: "#ef4444", fontSize: "0.85rem", marginBottom: 16 }}>{error}</p>
              <button
                onClick={loadSummary}
                style={{
                  padding: "10px 24px", borderRadius: 999,
                  border: "1px solid var(--border)",
                  backgroundColor: "transparent",
                  color: "var(--text-secondary)",
                  fontSize: "0.78rem", cursor: "pointer",
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Report content */}
          {summary && (
            <>
              {/* Approach */}
              <section style={{ marginBottom: 28 }}>
                <h3 style={{
                  fontSize: "0.6rem", fontFamily: "var(--font-mono)",
                  color: "var(--accent)", letterSpacing: "0.1em",
                  textTransform: "uppercase", marginBottom: 10,
                }}>
                  Recommended Approach
                </h3>
                <p style={{
                  color: "var(--text-primary)", fontSize: "0.88rem",
                  lineHeight: 1.75, fontFamily: "var(--font-sans)",
                }}>
                  {summary.approach}
                </p>
              </section>

              {/* Risks */}
              {summary.risk_inventory.length > 0 && (
                <section style={{ marginBottom: 28 }}>
                  <h3 style={{
                    fontSize: "0.6rem", fontFamily: "var(--font-mono)",
                    color: "var(--accent)", letterSpacing: "0.1em",
                    textTransform: "uppercase", marginBottom: 12,
                  }}>
                    Risk Inventory
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {summary.risk_inventory.map((risk, i) => (
                      <div key={i} style={{
                        padding: "14px 18px",
                        backgroundColor: severityBg(risk.severity),
                        borderRadius: 12,
                        borderLeft: `3px solid ${severityColor(risk.severity)}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{
                            fontSize: "0.58rem", fontFamily: "var(--font-mono)",
                            color: severityColor(risk.severity),
                            letterSpacing: "0.08em", textTransform: "uppercase",
                            fontWeight: 700,
                          }}>
                            {risk.severity}
                          </span>
                          <span style={{
                            color: "var(--text-primary)", fontSize: "0.82rem", fontWeight: 600,
                          }}>
                            {risk.structure}
                          </span>
                        </div>
                        <p style={{
                          color: "var(--text-secondary)", fontSize: "0.78rem",
                          lineHeight: 1.6, margin: 0,
                        }}>
                          {risk.mitigation}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Scenarios */}
              {summary.scenarios_explored.length > 0 && (
                <section style={{ marginBottom: 28 }}>
                  <h3 style={{
                    fontSize: "0.6rem", fontFamily: "var(--font-mono)",
                    color: "var(--accent)", letterSpacing: "0.1em",
                    textTransform: "uppercase", marginBottom: 12,
                  }}>
                    Scenarios Explored
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {summary.scenarios_explored.map((s, i) => (
                      <div key={i} style={{
                        padding: "14px 18px",
                        backgroundColor: "var(--bg-surface)",
                        borderRadius: 12,
                      }}>
                        <p style={{
                          color: "var(--text-primary)", fontSize: "0.82rem",
                          fontWeight: 500, marginBottom: 4,
                        }}>
                          {s.description}
                        </p>
                        <p style={{
                          color: "var(--text-secondary)", fontSize: "0.78rem",
                          lineHeight: 1.6, margin: 0,
                        }}>
                          {s.outcome}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Contingencies */}
              {summary.contingencies.length > 0 && (
                <section style={{ marginBottom: 28 }}>
                  <h3 style={{
                    fontSize: "0.6rem", fontFamily: "var(--font-mono)",
                    color: "var(--accent)", letterSpacing: "0.1em",
                    textTransform: "uppercase", marginBottom: 12,
                  }}>
                    Contingencies
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {summary.contingencies.map((c, i) => (
                      <div key={i} style={{
                        color: "var(--text-primary)", fontSize: "0.82rem",
                        padding: "10px 0",
                        borderBottom: i < summary.contingencies.length - 1 ? "1px solid var(--border)" : "none",
                        lineHeight: 1.65,
                      }}>
                        <span style={{ color: "var(--accent)", marginRight: 10, fontWeight: 600 }}>{i + 1}.</span>
                        {c}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Actions */}
              <div style={{
                display: "flex", gap: 10, marginTop: 32, paddingTop: 24,
                borderTop: "1px solid var(--border)",
              }}>
                <button
                  onClick={exportPDF}
                  style={{
                    padding: "12px 26px", borderRadius: 999,
                    border: "1px solid var(--accent)",
                    backgroundColor: "var(--accent-dim)",
                    color: "var(--accent-light)",
                    fontSize: "0.82rem", fontWeight: 600,
                    fontFamily: "var(--font-sans)",
                    backdropFilter: "blur(10px)",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8,
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
                    padding: "12px 26px", borderRadius: 999,
                    border: "1px solid var(--border)",
                    backgroundColor: "transparent",
                    color: "var(--text-secondary)",
                    fontSize: "0.82rem", fontFamily: "var(--font-sans)",
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
    </div>
  );
}
