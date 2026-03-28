import { useEffect, useState } from "react";
import { HeroSection } from "../components/ui/hero-section-5";

const STEPS = [
  { num: "01", label: "Scene", detail: "Capture environment" },
  { num: "02", label: "Assess", detail: "Voice triage" },
  { num: "03", label: "Simulate", detail: "3 ranked plans" },
  { num: "04", label: "Act", detail: "Guided protocol" },
  { num: "05", label: "Report", detail: "Session export" },
];

export default function Landing() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "auto", backgroundColor: "var(--bg-primary)", fontFamily: "var(--font-sans)" }}>
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
        <h2 style={{ fontSize: "1.8rem", fontWeight: 500, lineHeight: 1.15, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 32, maxWidth: 560 }}>
          Five steps from scene to intervention.
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ padding: "20px 16px", backgroundColor: "var(--bg-surface)" }}>
              <div style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono)", color: "var(--accent)", marginBottom: 10, letterSpacing: "0.06em" }}>{s.num}</div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4, fontFamily: "var(--font-sans)" }}>{s.label}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.5, fontFamily: "var(--font-sans)" }}>{s.detail}</div>
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
          { label: "The Problem", title: "Field trauma has zero margin for error", body: "No OR, no second chances. Paramedics must assess, decide, and act — often without knowing the optimal intervention for the specific injuries and environment." },
          { label: "Scene Intel", title: "Camera + AI analyze your environment in seconds", body: "Snap a photo of the scene. The AI identifies terrain, hazards, available equipment, and responder count. Scene context constrains the simulation to what's actually possible." },
          { label: "Voice Triage", title: "Describe injuries naturally, AI structures them", body: "Speak freely — the AI parses location, type, severity, consciousness, and mechanism. Hands stay free for the patient." },
          { label: "Simulation", title: "3 intervention plans ranked by survival probability", body: "The AI generates complete protocols — each with step-by-step actions, timing, equipment needed, and risks. Ranked by estimated survival rate given your specific constraints." },
        ].map((f, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 24, padding: "28px 0", borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.62rem", fontFamily: "var(--font-mono)", color: "var(--accent)", letterSpacing: "0.06em", textTransform: "uppercase", paddingTop: 3 }}>{f.label}</div>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 500, color: "var(--text-primary)", marginBottom: 8, lineHeight: 1.4, fontFamily: "var(--font-sans)" }}>{f.title}</h3>
              <p style={{ fontSize: "0.85rem", lineHeight: 1.75, color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}>{f.body}</p>
            </div>
          </div>
        ))}
      </section>

      <footer style={{ padding: "20px 40px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.62rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>SurgiVision</span>
        <span style={{ fontSize: "0.62rem", color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>Three.js / Groq / MediaPipe / Gaussian Splatting</span>
      </footer>
    </div>
  );
}
