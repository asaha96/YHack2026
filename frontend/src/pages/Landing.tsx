import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HeroSection } from "../components/ui/hero-section-5";

type Stage = "hero" | "dissolving" | "fading" | "intake" | "processing" | "transitioning";

const STATUS_MESSAGES = [
  "Analyzing imaging data...",
  "Segmenting anatomical structures...",
  "Reconstructing 3D volume...",
  "Mapping vasculature and nerve pathways...",
  "Building patient-specific model...",
  "Preparing simulation environment...",
];

const TOTAL_BLOCKS = 8;
const PROCESS_DURATION = 7000; // ms

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  backgroundColor: "var(--bg-surface)",
  color: "var(--text-primary)",
  fontSize: "0.85rem",
  fontFamily: "var(--font-sans)",
  outline: "none",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.68rem",
  fontFamily: "var(--font-mono)",
  color: "var(--accent)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  marginBottom: 6,
  display: "block",
};

export default function Landing() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("hero");
  const [intakeVisible, setIntakeVisible] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [patientFiles, setPatientFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const processStartRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split("T")[0];

  const handleBegin = useCallback(() => {
    setStage("dissolving");
  }, []);

  const handleDissolveComplete = useCallback(() => {
    // Start fading text while DNA finishes
    setStage("fading");
    setTimeout(() => {
      setStage("intake");
      setTimeout(() => setIntakeVisible(true), 50);
    }, 1400);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setStage("transitioning");
    setTimeout(() => navigate("/app", { state: { entered: true } }), 800);
  }, [navigate]);

  // Processing animation
  useEffect(() => {
    if (stage !== "processing") return;
    let raf: number;
    const tick = () => {
      const elapsed = performance.now() - processStartRef.current;
      const progress = Math.min(1, elapsed / PROCESS_DURATION);
      setProcessProgress(progress);
      setStatusIndex(Math.min(STATUS_MESSAGES.length - 1, Math.floor(progress * STATUS_MESSAGES.length)));

      if (progress >= 1) {
        // Hold on the completed state briefly, then fade out smoothly
        setTimeout(() => {
          setStage("transitioning");
          setTimeout(() => navigate("/app", { state: { entered: true } }), 800);
        }, 400);
      } else {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage, navigate]);

  const showHero = stage === "hero" || stage === "dissolving" || stage === "fading";
  const showIntake = !showHero;
  const isProcessing = stage === "processing" || stage === "transitioning";
  const isTransitioning = stage === "transitioning";
  const filledBlocks = Math.floor(processProgress * TOTAL_BLOCKS);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative", fontFamily: "var(--font-sans)" }}>
      {/* ──── HERO LAYER ──── */}
      <div style={{
        position: "absolute", inset: 0,
        background: "var(--page-gradient)",
        opacity: showHero ? 1 : 0,
        transition: "opacity 1.2s cubic-bezier(0.22, 0.61, 0.36, 1)",
        pointerEvents: showHero ? "auto" : "none",
        zIndex: showHero ? 2 : 0,
      }}>
        {(showHero || stage === "intake") && (
          <HeroSection
            dissolving={stage === "dissolving" || stage === "fading"}
            fading={stage === "fading"}
            onBegin={handleBegin}
            onDissolveComplete={handleDissolveComplete}
          />
        )}
      </div>

      {/* ──── INTAKE LAYER ──── */}
      <div style={{
        position: "absolute", inset: 0,
        background: "var(--bg-primary)",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: showIntake && !isTransitioning ? 1 : showIntake && isTransitioning ? 0 : 0,
        transition: "opacity 1.2s cubic-bezier(0.22, 0.61, 0.36, 1)",
        pointerEvents: showIntake ? "auto" : "none",
        zIndex: showIntake ? 2 : 1,
      }}>
        {/* Background accents — teal glow orbs */}
        <div style={{
          position: "absolute", top: "-10%", right: "-5%",
          width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(45, 212, 191, 0.22) 0%, rgba(45, 212, 191, 0.08) 35%, transparent 65%)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "-15%", left: "-8%",
          width: 550, height: 550, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(20, 184, 166, 0.18) 0%, rgba(20, 184, 166, 0.06) 35%, transparent 65%)",
          filter: "blur(70px)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: "25%", left: "5%",
          width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(45, 212, 191, 0.12) 0%, transparent 55%)",
          filter: "blur(50px)",
          pointerEvents: "none",
        }} />
        {/* Subtle grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(45, 212, 191, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(45, 212, 191, 0.04) 1px, transparent 1px)",
          backgroundSize: "100px 100px",
          maskImage: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.6), transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Header */}
        <header style={{
          position: "absolute", top: 0, left: 0, right: 0,
          padding: "20px 40px", zIndex: 5,
        }}>
          <img src="/logo.png" alt="Praxis" onClick={() => { setStage("hero"); setIntakeVisible(false); }} style={{ height: 36, filter: "var(--logo-filter)", cursor: "pointer" }} />
        </header>

        {/* Form */}
        <div style={{
          width: "100%", maxWidth: 520,
          padding: "0 24px",
          opacity: intakeVisible ? 1 : 0,
          transform: intakeVisible ? "translateY(0) scale(1)" : "translateY(30px) scale(0.97)",
          transition: "opacity 0.9s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.9s cubic-bezier(0.22, 0.61, 0.36, 1), filter 0.6s ease",
          filter: isProcessing ? "blur(14px)" : "none",
          pointerEvents: isProcessing ? "none" : "auto",
        }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h2 style={{
              fontSize: "2.2rem", fontWeight: 600,
              fontFamily: "var(--font-serif)",
              color: "var(--text-primary)",
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              marginBottom: 8,
            }}>
              New patient case
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Enter patient details and upload imaging to begin simulation.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 24,
            padding: "32px 28px",
            boxShadow: "var(--shadow-md)",
            display: "flex", flexDirection: "column", gap: 20,
          }}>
            {/* Name */}
            <div>
              <label style={labelStyle}>Patient Name</label>
              <input type="text" required placeholder="Last, First" style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-dim)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.boxShadow = ""; }}
              />
            </div>

            {/* Row: DOB + Gender */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Date of Birth</label>
                <input type="date" required style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-dim)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.boxShadow = ""; }}
                />
              </div>
              <div>
                <label style={labelStyle}>Gender</label>
                <select required style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
                  onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-dim)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.boxShadow = ""; }}
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Date (auto) */}
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" readOnly value={today} style={{ ...inputStyle, color: "var(--text-muted)", cursor: "default" }} />
            </div>

            {/* Image Upload */}
            <div>
              <label style={labelStyle}>Patient Imaging</label>
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) setPatientFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]); }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: patientFiles.length > 0 ? "14px 16px" : "28px 16px",
                  borderRadius: 14,
                  border: `2px dashed ${isDragging ? "var(--accent)" : "var(--border)"}`,
                  backgroundColor: isDragging ? "var(--accent-dim)" : "transparent",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.2s ease",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".dcm,.nii,.nii.gz,.zip,.png,.jpg,.jpeg"
                  style={{ display: "none" }}
                  onChange={e => { if (e.target.files?.length) { setPatientFiles(prev => [...prev, ...Array.from(e.target.files!)]); e.target.value = ""; } }}
                />
                {patientFiles.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {patientFiles.map((f, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-primary)", fontWeight: 500, flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", flexShrink: 0 }}>{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                        <button type="button" onClick={e => { e.stopPropagation(); setPatientFiles(prev => prev.filter((_, j) => j !== i)); }} style={{
                          background: "none", border: "none", color: "var(--text-muted)", fontSize: "0.75rem", padding: "2px 6px", borderRadius: 4, flexShrink: 0,
                        }}>x</button>
                      </div>
                    ))}
                    <p style={{ fontSize: "0.62rem", color: "var(--text-muted)", marginTop: 4 }}>
                      Click or drop to add more files
                    </p>
                  </div>
                ) : (
                  <>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ margin: "0 auto 8px" }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 4 }}>
                      Drop CT / MRI scans here
                    </p>
                    <p style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                      DICOM, NIfTI, ZIP, or image files
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Submit */}
            <button type="submit" style={{
              padding: "13px 28px",
              borderRadius: 999,
              border: "1px solid var(--accent)",
              backgroundColor: "var(--accent-dim)",
              color: "var(--accent-light)",
              fontSize: "0.82rem",
              fontWeight: 600,
              fontFamily: "var(--font-sans)",
              marginTop: 4,
              transition: "all 0.2s ease",
            }}>
              Begin Simulation
            </button>
          </form>
        </div>

        {/* Processing overlay */}
        {isProcessing && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 28,
            zIndex: 10,
            animation: "fadeIn 0.5s ease",
          }}>
            <div style={{ textAlign: "center" }}>
              <p style={{
                fontSize: "0.65rem", fontFamily: "var(--font-mono)",
                color: "var(--accent)", letterSpacing: "0.08em",
                textTransform: "uppercase", marginBottom: 12,
              }}>
                Building World Model
              </p>
              <p
                key={statusIndex}
                style={{
                  fontSize: "1.6rem", fontWeight: 600,
                  fontFamily: "var(--font-serif)",
                  color: "var(--text-primary)",
                  letterSpacing: "-0.03em",
                  animation: "statusFade 1.2s ease forwards",
                }}
              >
                {STATUS_MESSAGES[statusIndex]}
              </p>
            </div>

            {/* Segmented progress bar */}
            <div style={{
              display: "flex", gap: 4,
              width: 320,
            }}>
              {Array.from({ length: TOTAL_BLOCKS }).map((_, i) => (
                <div key={i} style={{
                  flex: 1, height: 6,
                  borderRadius: 3,
                  backgroundColor: i < filledBlocks
                    ? "var(--accent)"
                    : i === filledBlocks
                      ? "var(--accent-muted)"
                      : "var(--border)",
                  transition: "background-color 0.3s ease",
                  opacity: i < filledBlocks ? 1 : i === filledBlocks ? 0.6 : 0.3,
                }} />
              ))}
            </div>

            <p style={{
              fontSize: "0.68rem", fontFamily: "var(--font-mono)",
              color: "var(--text-muted)", letterSpacing: "0.04em",
            }}>
              {Math.round(processProgress * 100)}%
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
