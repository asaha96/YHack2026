import { useState } from "react";

interface Step {
  order: number;
  action: string;
  duration_sec: number;
  critical: boolean;
  warning: string;
}

interface Scenario {
  name: string;
  survival_probability: number;
  time_estimate_min: number;
  steps: Step[];
  equipment_needed: string[];
  risks: string[];
  rationale: string;
}

interface Props {
  scenarios: Scenario[];
  onSelectPlan: (scenario: Scenario) => void;
  onOpenGuide: () => void;
}

export default function ScenarioView({ scenarios, onSelectPlan, onOpenGuide }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const probColor = (p: number) => p >= 80 ? "var(--risk-low)" : p >= 50 ? "var(--risk-medium)" : "var(--risk-high)";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "auto", padding: "32px 24px", gap: 24, maxWidth: 720, margin: "0 auto", width: "100%" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--accent)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Simulation Complete</p>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 300, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          {scenarios.length} intervention plans generated
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.78rem", marginTop: 6 }}>Ranked by estimated survival probability. Select a plan to begin.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {scenarios.map((s, i) => (
          <div key={i} style={{
            borderRadius: "var(--radius-md)",
            border: `1px solid ${expanded === i ? "var(--accent)" : "var(--border)"}`,
            backgroundColor: expanded === i ? "var(--bg-surface-hover)" : "var(--bg-surface)",
            overflow: "hidden",
            transition: "all 0.15s ease",
          }}>
            {/* Header */}
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              style={{
                width: "100%", padding: "16px 18px",
                border: "none", backgroundColor: "transparent",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "var(--radius-sm)",
                  border: `1px solid ${probColor(s.survival_probability)}`,
                  backgroundColor: `color-mix(in srgb, ${probColor(s.survival_probability)} 10%, transparent)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-mono)", fontSize: "0.62rem", fontWeight: 600,
                  color: probColor(s.survival_probability),
                }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-primary)" }}>{s.name}</div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 2 }}>{s.rationale}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", fontWeight: 600, color: probColor(s.survival_probability) }}>
                    {s.survival_probability}%
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
                    {s.time_estimate_min} min
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ transform: expanded === i ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}>
                  <polyline points="6,9 12,15 18,9" />
                </svg>
              </div>
            </button>

            {/* Expanded detail */}
            {expanded === i && (
              <div style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.2s ease" }}>
                {/* Steps */}
                <div>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>Protocol</p>
                  {s.steps.map((st, j) => (
                    <div key={j} style={{
                      display: "flex", gap: 10, padding: "8px 0",
                      borderTop: j > 0 ? "1px solid var(--border)" : "none",
                    }}>
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: "0.58rem",
                        color: st.critical ? "var(--risk-high)" : "var(--text-muted)",
                        minWidth: 18, paddingTop: 2,
                      }}>
                        {String(st.order).padStart(2, "0")}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: "0.78rem", color: "var(--text-primary)", lineHeight: 1.5 }}>
                          {st.action}
                        </p>
                        {st.warning && (
                          <p style={{ fontSize: "0.68rem", color: "var(--risk-medium)", marginTop: 3 }}>
                            Warning: {st.warning}
                          </p>
                        )}
                      </div>
                      {st.duration_sec > 0 && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", color: "var(--text-muted)", flexShrink: 0, paddingTop: 2 }}>
                          {st.duration_sec >= 60 ? `${Math.floor(st.duration_sec / 60)}m` : `${st.duration_sec}s`}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Risks */}
                {s.risks.length > 0 && (
                  <div>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", color: "var(--risk-high)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>Risks</p>
                    {s.risks.map((r, j) => (
                      <p key={j} style={{ fontSize: "0.72rem", color: "var(--text-secondary)", lineHeight: 1.5, paddingLeft: 8, borderLeft: "2px solid var(--border)", marginBottom: 4 }}>{r}</p>
                    ))}
                  </div>
                )}

                {/* Equipment */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {s.equipment_needed.map((e, j) => (
                    <span key={j} style={{ padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontSize: "0.62rem", color: "var(--text-muted)" }}>{e}</span>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
                  <button onClick={() => onSelectPlan(s)} style={{
                    flex: 1, padding: "10px", borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--accent)", backgroundColor: "var(--accent-dim)",
                    color: "var(--accent)", fontSize: "0.78rem", fontWeight: 500,
                  }}>
                    Execute this plan
                  </button>
                  <button onClick={onOpenGuide} style={{
                    padding: "10px 16px", borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)", backgroundColor: "transparent",
                    color: "var(--text-muted)", fontSize: "0.78rem", fontWeight: 500,
                  }}>
                    3D Guide
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
