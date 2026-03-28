import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

const STEPS = [
  { num: "01", label: "Upload", detail: "CT / MRI scan" },
  { num: "02", label: "Reconstruct", detail: "3D Gaussian splat" },
  { num: "03", label: "Annotate", detail: "AI-labeled anatomy" },
  { num: "04", label: "Simulate", detail: "Hand-tracked surgery" },
  { num: "05", label: "Report", detail: "Surgical plan PDF" },
];

export default function Landing() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      width: "100vw", height: "100vh", overflow: "auto",
      backgroundColor: "var(--bg-primary)",
      position: "relative",
    }}>
      {/* Subtle grid background */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(rgba(45, 212, 191, 0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(45, 212, 191, 0.02) 1px, transparent 1px)
        `,
        backgroundSize: "80px 80px",
      }} />

      {/* Nav */}
      <nav style={{
        position: "relative",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "18px 40px",
        opacity: mounted ? 1 : 0,
        transition: "opacity 0.6s ease 0.1s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            backgroundColor: "var(--accent)",
            boxShadow: "0 0 6px var(--accent-muted)",
          }} />
          <span style={{
            fontSize: "0.82rem", fontWeight: 600,
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}>
            SurgiVision
          </span>
        </div>
        <button
          onClick={() => navigate("/app")}
          style={{
            padding: "8px 20px", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            backgroundColor: "transparent",
            color: "var(--text-secondary)",
            fontSize: "0.75rem", fontWeight: 500,
            letterSpacing: "0.02em",
          }}
        >
          Open Platform
        </button>
      </nav>

      {/* Hero */}
      <section style={{
        maxWidth: 720, margin: "0 auto",
        padding: "100px 40px 60px",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(8px)",
        transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s",
      }}>
        <div style={{
          display: "inline-block",
          padding: "4px 12px", marginBottom: 24,
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          fontSize: "0.65rem", fontWeight: 500,
          color: "var(--accent)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}>
          Surgical Simulation
        </div>

        <h1 style={{
          fontSize: "clamp(2rem, 5vw, 3.2rem)",
          fontWeight: 300,
          lineHeight: 1.15,
          letterSpacing: "-0.04em",
          color: "var(--text-primary)",
          marginBottom: 20,
        }}>
          Practice on your
          <br />
          <span style={{ fontWeight: 600 }}>patient's exact anatomy</span>
        </h1>

        <p style={{
          fontSize: "0.92rem", lineHeight: 1.7,
          color: "var(--text-secondary)",
          maxWidth: 480, marginBottom: 40,
        }}>
          CT and MRI scans reconstructed into navigable 3D models.
          Simulate procedures with hand tracking. AI-guided risk assessment.
        </p>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={() => navigate("/app")}
            style={{
              padding: "11px 28px", borderRadius: "var(--radius-sm)",
              border: "1px solid var(--accent)",
              backgroundColor: "var(--accent-dim)",
              color: "var(--accent)",
              fontSize: "0.82rem", fontWeight: 500,
              letterSpacing: "0.01em",
            }}
          >
            Start Simulation
          </button>
          <span style={{
            width: 1, height: 16,
            backgroundColor: "var(--border)",
          }} />
          <button
            onClick={() => document.getElementById("pipeline")?.scrollIntoView({ behavior: "smooth" })}
            style={{
              padding: "11px 20px", borderRadius: "var(--radius-sm)",
              border: "none", backgroundColor: "transparent",
              color: "var(--text-muted)",
              fontSize: "0.82rem", fontWeight: 400,
            }}
          >
            How it works
          </button>
        </div>
      </section>

      {/* Pipeline */}
      <section id="pipeline" style={{
        maxWidth: 720, margin: "0 auto",
        padding: "0 40px 80px",
        opacity: mounted ? 1 : 0,
        transition: "opacity 0.8s ease 0.6s",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 0,
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
        }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{
              padding: "20px 16px",
              borderRight: i < 4 ? "1px solid var(--border)" : "none",
              backgroundColor: "var(--bg-surface)",
            }}>
              <div style={{
                fontSize: "0.6rem",
                fontFamily: "var(--font-mono)",
                color: "var(--accent)",
                marginBottom: 8,
                letterSpacing: "0.04em",
              }}>
                {s.num}
              </div>
              <div style={{
                fontSize: "0.78rem", fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 4,
              }}>
                {s.label}
              </div>
              <div style={{
                fontSize: "0.68rem",
                color: "var(--text-muted)",
              }}>
                {s.detail}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features — editorial layout */}
      <section style={{
        maxWidth: 720, margin: "0 auto",
        padding: "0 40px 80px",
        opacity: mounted ? 1 : 0,
        transition: "opacity 0.8s ease 0.8s",
      }}>
        {[
          {
            label: "Reconstruction",
            title: "Patient-specific 3D models from CT and MRI",
            body: "Isosurface extraction at multiple HU thresholds produces bone, tissue, and organ meshes. Exported as Gaussian splats for real-time navigation with full depth and transparency.",
          },
          {
            label: "Hand Tracking",
            title: "Simulate surgery with five gesture types",
            body: "MediaPipe tracks your hands through a standard webcam. Point to inspect, pinch to select, two fingers to incise, fist to retract, spread to zoom. No special hardware required.",
          },
          {
            label: "AI Assistant",
            title: "Real-time surgical guidance and risk assessment",
            body: "Llama 4 Scout analyzes each action against the patient's anatomy. Identifies vessels, nerves, and ducts in the path. Labels danger zones. Narrates risks. Generates a post-session surgical plan.",
          },
        ].map((f, i) => (
          <div key={i} style={{
            display: "grid",
            gridTemplateColumns: "120px 1fr",
            gap: 24,
            padding: "28px 0",
            borderTop: "1px solid var(--border)",
          }}>
            <div style={{
              fontSize: "0.62rem",
              fontFamily: "var(--font-mono)",
              color: "var(--accent)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              paddingTop: 3,
            }}>
              {f.label}
            </div>
            <div>
              <h3 style={{
                fontSize: "0.92rem", fontWeight: 500,
                color: "var(--text-primary)",
                marginBottom: 8, lineHeight: 1.4,
              }}>
                {f.title}
              </h3>
              <p style={{
                fontSize: "0.8rem", lineHeight: 1.7,
                color: "var(--text-secondary)",
              }}>
                {f.body}
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer style={{
        padding: "20px 40px",
        borderTop: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: "0.62rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          SurgiVision
        </span>
        <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>
          Gaussian Splatting / Groq / MediaPipe / Three.js
        </span>
      </footer>
    </div>
  );
}
