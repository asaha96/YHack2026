import { useEffect, useState } from "react";
import { getSummary } from "../utils/api";
import type { SummaryResponse } from "../utils/api";
import { jsPDF } from "jspdf";

interface Props {
  sessionId: string;
  visible: boolean;
  onClose: () => void;
}

// Movie palette
const C = {
  bg: "linear-gradient(160deg, #fcfaf4 0%, #f8f4ec 60%)",
  ink: "#171311",
  inkSoft: "#635b54",
  inkMuted: "#8b8178",
  line: "rgba(47, 39, 31, 0.09)",
  sage: "#82907d",
  ember: "#b26e57",
  panel: "rgba(255,255,255,0.65)",
  panelBorder: "rgba(47,39,31,0.09)",
};

const serif = "'Iowan Old Style', 'Baskerville', Georgia, serif";
const sans = "'Helvetica Neue', Arial, sans-serif";
const mono = "'SFMono-Regular', 'Menlo', monospace";

const severityColor = (s: string) =>
  s === "high" ? "#c0402a" : s === "medium" ? "#b26e57" : C.sage;

export default function SummaryView({ sessionId, visible, onClose }: Props) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfReady, setPdfReady] = useState(false);

  // Auto-load when modal opens
  useEffect(() => {
    if (visible && !summary && !isLoading) {
      loadSummary();
    }
    if (!visible) {
      setPdfProgress(0);
      setPdfReady(false);
    }
  }, [visible]);

  const loadSummary = async () => {
    setIsLoading(true);
    setError(null);
    setSummary(null);
    setPdfProgress(0);
    setPdfReady(false);
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
    setPdfProgress(0);
    setPdfReady(false);

    // Animate progress bar
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 22 + 8;
      setPdfProgress(Math.min(p, 95));
      if (p >= 95) clearInterval(interval);
    }, 80);

    const doc = new jsPDF();
    const margin = 20;
    let y = margin;

    doc.setFontSize(20);
    doc.setTextColor(23, 19, 17);
    doc.text("Surgical Plan", margin, y);
    y += 8;

    doc.setFontSize(8);
    doc.setTextColor(139, 129, 120);
    doc.text(
      `Generated ${new Date().toLocaleString()}  ·  Session ${sessionId}`,
      margin,
      y
    );
    y += 14;

    const section = (title: string) => {
      doc.setFontSize(7);
      doc.setTextColor(130, 144, 125);
      doc.text(title.toUpperCase(), margin, y);
      y += 6;
    };

    section("Recommended Approach");
    doc.setFontSize(10);
    doc.setTextColor(99, 91, 84);
    const approachLines = doc.splitTextToSize(summary.approach, 170);
    doc.text(approachLines, margin, y);
    y += approachLines.length * 5 + 10;

    if (summary.risk_inventory.length > 0) {
      section("Risk Inventory");
      doc.setFontSize(10);
      for (const risk of summary.risk_inventory) {
        const sev = risk.severity.toUpperCase();
        const line = `[${sev}] ${risk.structure} — ${risk.mitigation}`;
        doc.setTextColor(99, 91, 84);
        const lines = doc.splitTextToSize(line, 170);
        doc.text(lines, margin, y);
        y += lines.length * 5 + 3;
      }
      y += 6;
    }

    if (summary.scenarios_explored.length > 0) {
      section("Scenarios Explored");
      doc.setFontSize(10);
      for (const s of summary.scenarios_explored) {
        const lines = doc.splitTextToSize(
          `${s.description} — ${s.outcome}`,
          170
        );
        doc.setTextColor(99, 91, 84);
        doc.text(lines, margin, y);
        y += lines.length * 5 + 3;
      }
      y += 6;
    }

    if (summary.contingencies.length > 0) {
      section("Contingencies");
      doc.setFontSize(10);
      for (const c of summary.contingencies) {
        const lines = doc.splitTextToSize(`• ${c}`, 170);
        doc.setTextColor(99, 91, 84);
        doc.text(lines, margin, y);
        y += lines.length * 5 + 2;
      }
    }

    clearInterval(interval);
    setPdfProgress(100);
    setTimeout(() => {
      setPdfReady(true);
      doc.save(`surgical-plan-${sessionId}.pdf`);
    }, 200);
  };

  if (!visible) return null;

  // Build step items from summary data
  const buildSteps = (s: SummaryResponse) => {
    const steps: { label: string; detail: string; done: boolean; severity?: string }[] = [];

    steps.push({ label: "Approach", detail: s.approach, done: true });

    for (const risk of s.risk_inventory.slice(0, 3)) {
      steps.push({
        label: risk.structure,
        detail: risk.mitigation,
        done: risk.severity !== "high",
        severity: risk.severity,
      });
    }

    for (const c of s.contingencies.slice(0, 2)) {
      steps.push({ label: "Contingency", detail: c, done: false });
    }

    return steps;
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15,10,8,0.7)",
        backdropFilter: "blur(10px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.bg,
          borderRadius: 24,
          maxWidth: 860,
          width: "100%",
          maxHeight: "88vh",
          overflow: "auto",
          boxShadow:
            "0 40px 80px rgba(20,12,8,0.45), 0 0 0 1px rgba(47,39,31,0.12)",
          animation: "fadeInScale 0.28s ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "28px 36px 20px",
            borderBottom: `1px solid ${C.line}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: mono,
                fontSize: "0.58rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: C.sage,
                marginBottom: 6,
              }}
            >
              Step 05 · Export
            </div>
            <h2
              style={{
                fontFamily: serif,
                fontSize: "1.55rem",
                color: C.ink,
                margin: 0,
                letterSpacing: "-0.04em",
                fontWeight: 400,
              }}
            >
              Surgical Plan
            </h2>
            <div
              style={{
                fontFamily: mono,
                fontSize: "0.6rem",
                letterSpacing: "0.1em",
                color: C.inkMuted,
                marginTop: 4,
              }}
            >
              Generated · Session {sessionId.slice(-8)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: C.inkMuted,
              fontSize: "1.3rem",
              cursor: "pointer",
              padding: "4px 8px",
              lineHeight: 1,
              marginTop: -4,
              fontFamily: sans,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: "28px 36px 36px" }}>
          {/* Loading */}
          {isLoading && (
            <div
              style={{
                textAlign: "center",
                padding: "56px 0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 18,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  border: `2px solid ${C.line}`,
                  borderTopColor: C.sage,
                  borderRadius: "50%",
                  animation: "spin 0.9s linear infinite",
                }}
              />
              <div>
                <p
                  style={{
                    fontFamily: serif,
                    color: C.ink,
                    fontSize: "1rem",
                    marginBottom: 4,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Compiling surgical plan
                </p>
                <p
                  style={{
                    fontFamily: mono,
                    color: C.inkMuted,
                    fontSize: "0.62rem",
                    letterSpacing: "0.08em",
                  }}
                >
                  Analyzing simulation data…
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && !isLoading && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <p
                style={{
                  fontFamily: sans,
                  color: "#c0402a",
                  fontSize: "0.85rem",
                  marginBottom: 20,
                }}
              >
                {error}
              </p>
              <button
                onClick={loadSummary}
                style={{
                  padding: "10px 28px",
                  borderRadius: 999,
                  border: `1px solid ${C.line}`,
                  background: C.panel,
                  color: C.inkSoft,
                  fontSize: "0.78rem",
                  fontFamily: sans,
                  cursor: "pointer",
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Report */}
          {summary && !isLoading && (
            <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
              {/* Left — plan steps */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {buildSteps(summary).map((step, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 14,
                      padding: "14px 18px",
                      borderRadius: 16,
                      background: C.panel,
                      border: `1px solid ${C.panelBorder}`,
                    }}
                  >
                    {/* Circle indicator */}
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        background: step.done
                          ? "rgba(130,144,125,0.13)"
                          : step.severity === "high"
                          ? "rgba(192,64,42,0.08)"
                          : "rgba(47,39,31,0.04)",
                        border: `1px solid ${
                          step.done
                            ? "rgba(130,144,125,0.35)"
                            : step.severity === "high"
                            ? "rgba(192,64,42,0.25)"
                            : "rgba(47,39,31,0.12)"
                        }`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: mono,
                        fontSize: 10,
                        color: step.done
                          ? C.sage
                          : step.severity
                          ? severityColor(step.severity)
                          : C.inkMuted,
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {step.done ? "✓" : `0${i + 1}`}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 3,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: serif,
                            fontSize: "0.92rem",
                            color: C.ink,
                            letterSpacing: "-0.02em",
                          }}
                        >
                          {step.label}
                        </span>
                        {step.severity && (
                          <span
                            style={{
                              fontFamily: mono,
                              fontSize: "0.52rem",
                              letterSpacing: "0.1em",
                              textTransform: "uppercase",
                              color: severityColor(step.severity),
                              border: `1px solid ${severityColor(step.severity)}40`,
                              borderRadius: 4,
                              padding: "1px 5px",
                            }}
                          >
                            {step.severity}
                          </span>
                        )}
                      </div>
                      <p
                        style={{
                          fontFamily: sans,
                          fontSize: "0.78rem",
                          color: C.inkSoft,
                          lineHeight: 1.55,
                          margin: 0,
                        }}
                      >
                        {step.detail}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Scenarios if any */}
                {summary.scenarios_explored.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div
                      style={{
                        fontFamily: mono,
                        fontSize: "0.55rem",
                        letterSpacing: "0.13em",
                        textTransform: "uppercase",
                        color: C.inkMuted,
                        marginBottom: 8,
                        paddingLeft: 4,
                      }}
                    >
                      Scenarios Explored
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {summary.scenarios_explored.map((s, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "12px 16px",
                            borderRadius: 12,
                            background: C.panel,
                            border: `1px solid ${C.panelBorder}`,
                          }}
                        >
                          <p
                            style={{
                              fontFamily: serif,
                              fontSize: "0.85rem",
                              color: C.ink,
                              margin: "0 0 3px",
                              letterSpacing: "-0.02em",
                            }}
                          >
                            {s.description}
                          </p>
                          <p
                            style={{
                              fontFamily: sans,
                              fontSize: "0.75rem",
                              color: C.inkSoft,
                              lineHeight: 1.5,
                              margin: 0,
                            }}
                          >
                            {s.outcome}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right — PDF export panel */}
              <div
                style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div
                  style={{
                    padding: "24px 20px",
                    borderRadius: 20,
                    background: C.panel,
                    border: `1px solid ${C.panelBorder}`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 32 }}>📄</div>
                  <div
                    style={{
                      fontFamily: serif,
                      fontSize: "1rem",
                      color: C.ink,
                      letterSpacing: "-0.03em",
                      textAlign: "center",
                    }}
                  >
                    Export to PDF
                  </div>

                  {/* Progress bar */}
                  {pdfProgress > 0 && (
                    <div
                      style={{
                        width: "100%",
                        height: 4,
                        borderRadius: 999,
                        background: "rgba(47,39,31,0.08)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${pdfProgress}%`,
                          height: "100%",
                          background: `linear-gradient(90deg, ${C.ember}, ${C.sage})`,
                          borderRadius: 999,
                          transition: "width 0.1s ease",
                        }}
                      />
                    </div>
                  )}

                  {pdfReady && (
                    <div
                      style={{
                        fontFamily: mono,
                        fontSize: "0.6rem",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: C.sage,
                        textAlign: "center",
                      }}
                    >
                      Ready · 2 pages
                    </div>
                  )}

                  <button
                    onClick={exportPDF}
                    style={{
                      width: "100%",
                      padding: "10px 0",
                      borderRadius: 10,
                      border: `1px solid rgba(130,144,125,0.4)`,
                      background: "rgba(130,144,125,0.1)",
                      color: C.sage,
                      fontSize: "0.78rem",
                      fontFamily: sans,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7,10 12,15 17,10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download
                  </button>
                </div>

                {/* Regenerate / Close */}
                <button
                  onClick={loadSummary}
                  style={{
                    width: "100%",
                    padding: "9px 0",
                    borderRadius: 10,
                    border: `1px solid ${C.panelBorder}`,
                    background: C.panel,
                    color: C.inkMuted,
                    fontSize: "0.72rem",
                    fontFamily: sans,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="1,4 1,10 7,10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                  Regenerate
                </button>

                <button
                  onClick={onClose}
                  style={{
                    width: "100%",
                    padding: "9px 0",
                    borderRadius: 10,
                    border: `1px solid ${C.panelBorder}`,
                    background: "transparent",
                    color: C.inkMuted,
                    fontSize: "0.72rem",
                    fontFamily: sans,
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
