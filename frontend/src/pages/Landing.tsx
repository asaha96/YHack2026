import { useEffect, useState } from "react";
import { HeroSection } from "../components/ui/hero-section-5";

const STEPS = [
  { num: "01", label: "Upload", detail: "CT / MRI scan" },
  { num: "02", label: "Reconstruct", detail: "3D Gaussian splat" },
  { num: "03", label: "Annotate", detail: "AI-labeled anatomy" },
  { num: "04", label: "Simulate", detail: "Hand-tracked surgery" },
  { num: "05", label: "Report", detail: "Surgical plan PDF" },
];

export default function Landing() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "auto", background: "var(--page-gradient)", fontFamily: "var(--font-sans)" }}>
      {/* Hero with 3D background */}
      <HeroSection />

      {/* Workflow */}
      <section id="pipeline" style={{
        maxWidth: 900, margin: "0 auto",
        padding: "80px 40px 64px",
        opacity: mounted ? 1 : 0,
        transition: "opacity 0.8s ease 0.3s",
      }}>
        <p style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
          Workflow
        </p>
        <h2 style={{ fontSize: "clamp(2.4rem, 4.2vw, 3.6rem)", fontWeight: 600, lineHeight: 0.98, letterSpacing: "-0.05em", color: "var(--text-primary)", marginBottom: 32, maxWidth: 620, fontFamily: "var(--font-serif)" }}>
          Five steps from imaging to rehearsal.
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1, borderRadius: 28, overflow: "hidden", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)", background: "rgba(255,255,255,0.32)" }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ padding: "24px 18px", backgroundColor: "var(--bg-surface)" }}>
              <div style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono)", color: "var(--accent)", marginBottom: 10, letterSpacing: "0.06em" }}>
                {s.num}
              </div>
              <div style={{ fontSize: "1.15rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 6, fontFamily: "var(--font-serif)", letterSpacing: "-0.03em" }}>
                {s.label}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.5, fontFamily: "var(--font-sans)" }}>
                {s.detail}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{
        maxWidth: 900, margin: "0 auto",
        padding: "0 40px 80px",
        opacity: mounted ? 1 : 0,
        transition: "opacity 0.8s ease 0.5s",
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
            display: "grid", gridTemplateColumns: "140px 1fr", gap: 24,
            padding: "28px 0",
            borderTop: "1px solid var(--border)",
          }}>
            <div style={{ fontSize: "0.62rem", fontFamily: "var(--font-mono)", color: "var(--accent)", letterSpacing: "0.06em", textTransform: "uppercase", paddingTop: 3 }}>
              {f.label}
            </div>
            <div>
              <h3 style={{ fontSize: "1.9rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 10, lineHeight: 1.08, fontFamily: "var(--font-serif)", letterSpacing: "-0.04em" }}>
                {f.title}
              </h3>
              <p style={{ fontSize: "0.92rem", lineHeight: 1.85, color: "var(--text-secondary)", fontFamily: "var(--font-sans)", maxWidth: 620 }}>
                {f.body}
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer style={{ padding: "20px 40px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <img src="/logo.png" alt="Praxis" style={{ height: 18, filter: "var(--logo-filter)", opacity: 0.78 }} />
        <span style={{ fontSize: "0.62rem", color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>Three.js / Gaussian Splatting / Groq / MediaPipe</span>
      </footer>
    </div>
  );
}
