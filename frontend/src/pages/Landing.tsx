import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "auto", backgroundColor: "var(--bg-primary)" }}>
      {/* Nav */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 32px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>SurgiVision</span>
        </div>
        <button
          onClick={() => navigate("/app")}
          style={{ padding: "7px 18px", borderRadius: 6, border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 500, cursor: "pointer" }}
        >
          Open App
        </button>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 640, margin: "0 auto", padding: "80px 32px 48px", textAlign: "center" }}>
        <p style={{ fontSize: "0.72rem", fontWeight: 500, color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>
          Surgical Simulation Platform
        </p>
        <h1 style={{ fontSize: "2.4rem", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 16 }}>
          Practice surgery on your patient's exact anatomy
        </h1>
        <p style={{ fontSize: "0.95rem", lineHeight: 1.7, color: "var(--text-secondary)", marginBottom: 32 }}>
          Upload a CT or MRI scan. We reconstruct a 3D model of the patient's interior.
          Then simulate the procedure with hand tracking while an AI assistant guides you.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
          <button
            onClick={() => navigate("/app")}
            style={{ padding: "10px 24px", borderRadius: 6, border: "none", backgroundColor: "var(--accent)", color: "#fff", fontSize: "0.85rem", fontWeight: 500, cursor: "pointer" }}
          >
            Start Simulation
          </button>
          <button
            onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
            style={{ padding: "10px 24px", borderRadius: 6, border: "1px solid var(--border)", backgroundColor: "transparent", color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 500, cursor: "pointer" }}
          >
            How It Works
          </button>
        </div>
      </section>

      {/* Pipeline steps */}
      <section style={{ display: "flex", justifyContent: "center", gap: 6, padding: "0 32px 48px", flexWrap: "wrap" }}>
        {["Upload Scan", "3D Reconstruction", "AI Labeling", "Hand-Tracked Simulation", "Session Report"].map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {i > 0 && <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>→</span>}
            <span style={{ padding: "4px 10px", borderRadius: 4, backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: "0.7rem", fontWeight: 500 }}>
              {s}
            </span>
          </div>
        ))}
      </section>

      {/* Features */}
      <section id="how" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, maxWidth: 900, margin: "0 auto", padding: "0 32px 64px" }}>
        {[
          { title: "Patient-Specific 3D Models", desc: "CT and MRI scans are converted into navigable 3D anatomy using isosurface extraction and Gaussian splatting. Practice on the patient's exact interior — tumors, vessels, and all." },
          { title: "Hand-Tracked Simulation", desc: "Computer vision tracks your hand gestures in real-time. Point to inspect, pinch to select, trace incisions with two fingers, make a fist to retract tissue." },
          { title: "AI Surgical Assistant", desc: "An AI mentor identifies danger zones, recommends incision paths, and narrates risks during the simulation. Get real-time guidance through every step of the procedure." },
        ].map((f, i) => (
          <div key={i} style={{ padding: "24px", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>{f.title}</h3>
            <p style={{ fontSize: "0.8rem", lineHeight: 1.65, color: "var(--text-secondary)" }}>{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "24px 32px", borderTop: "1px solid var(--border)" }}>
        <p style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
          SurgiVision — Built with Gaussian Splatting, Groq, MediaPipe, Three.js
        </p>
      </footer>
    </div>
  );
}
