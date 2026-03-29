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

function formatDobInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function dobToIso(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

function isoToDob(value: string) {
  const [yyyy, mm, dd] = value.split("-");
  return `${mm}/${dd}/${yyyy}`;
}

export default function Landing() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("hero");
  const [intakeVisible, setIntakeVisible] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [patientFiles, setPatientFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dob, setDob] = useState("");
  const [dobOpen, setDobOpen] = useState(false);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  /** Inline dropzone: ingest progress after files are added (not on empty state). */
  const [ingestState, setIngestState] = useState<"idle" | "running" | "done">("idle");
  const [ingestBarPct, setIngestBarPct] = useState(0);
  const [ingestNonce, setIngestNonce] = useState(0);
  const ingestRafRef = useRef<number>(0);
  const processStartRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dobRef = useRef<HTMLDivElement>(null);
  const todayIso = new Date().toISOString().split("T")[0];
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dobRef.current && !dobRef.current.contains(e.target as Node)) {
        setDobOpen(false);
        setYearPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
    if (patientFiles.length === 0) return;
    setStage("processing");
    processStartRef.current = performance.now();
  }, [patientFiles.length]);

  const addPatientFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setPatientFiles((prev) => [...prev, ...files]);
    setIngestNonce((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (patientFiles.length === 0) {
      cancelAnimationFrame(ingestRafRef.current);
      setIngestState("idle");
      setIngestBarPct(0);
      return;
    }
    if (ingestNonce === 0) return;

    cancelAnimationFrame(ingestRafRef.current);
    setIngestState("running");
    setIngestBarPct(0);

    const start = performance.now();
    const duration = 2200 + Math.random() * 400;
    let smooth = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - (1 - t) ** 1.85;
      const wobble = Math.sin(elapsed * 0.009) * 0.018 * (1 - t * 0.7);
      const jitter = (Math.random() - 0.5) * 0.04 * (1 - t * 0.85);
      const stall = t > 0.55 && t < 0.62 ? -0.03 : 0;
      const target = Math.min(1, Math.max(0, eased + wobble + jitter + stall));
      smooth = smooth * 0.55 + target * 0.45;
      setIngestBarPct(smooth * 100);

      if (t < 1) {
        ingestRafRef.current = requestAnimationFrame(tick);
      } else {
        setIngestBarPct(100);
        setIngestState("done");
      }
    };

    ingestRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ingestRafRef.current);
  }, [ingestNonce, patientFiles.length]);

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
          <img src="/logo.png" alt="Praxis" onClick={() => { setStage("hero"); setIntakeVisible(false); }} style={{ height: 44, filter: "var(--logo-filter)", cursor: "pointer" }} />
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
              <div ref={dobRef} style={{ position: "relative" }}>
                <label style={labelStyle}>Date of Birth</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    placeholder="mm/dd/yyyy"
                    value={dob}
                    onChange={(e) => setDob(formatDobInput(e.currentTarget.value))}
                    style={{ ...inputStyle, paddingRight: 44 }}
                    onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-dim)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.boxShadow = ""; }}
                  />
                  <button
                    type="button"
                    aria-label="Open date picker"
                    onClick={() => {
                      const iso = dobToIso(dob);
                      if (iso) {
                        const [year, month] = iso.split("-");
                        setCalYear(Number(year));
                        setCalMonth(Number(month) - 1);
                      }
                      setYearPickerOpen(false);
                      setDobOpen((open) => !open);
                    }}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 26,
                      height: 26,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 8,
                      border: "none",
                      background: "transparent",
                      color: "var(--text-muted)",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </button>
                </div>
                {dobOpen && (() => {
                  const firstDay = new Date(calYear, calMonth, 1).getDay();
                  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                  const currentYear = new Date().getFullYear();
                  const selectedIso = dobToIso(dob);
                  return (
                    <div style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: 0,
                      width: 280,
                      zIndex: 50,
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                      padding: 16,
                      animation: "fadeIn 0.15s ease",
                    }}>
                      {yearPickerOpen ? (
                        <div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                            <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>Select Year</span>
                            <button
                              type="button"
                              onClick={() => setYearPickerOpen(false)}
                              style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "0.85rem", padding: "2px 6px" }}
                            >
                              ×
                            </button>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4, maxHeight: 200, overflowY: "auto" }}>
                            {Array.from({ length: 100 }, (_, i) => {
                              const year = currentYear - i;
                              const isSelected = year === calYear;
                              return (
                                <button
                                  type="button"
                                  key={year}
                                  onClick={() => { setCalYear(year); setYearPickerOpen(false); }}
                                  style={{
                                    padding: "6px 0",
                                    borderRadius: 8,
                                    border: "none",
                                    fontSize: "0.72rem",
                                    fontFamily: "var(--font-sans)",
                                    fontWeight: isSelected ? 600 : 400,
                                    backgroundColor: isSelected ? "var(--accent)" : "transparent",
                                    color: isSelected ? "#fff" : "var(--text-primary)",
                                  }}
                                >
                                  {year}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (calMonth === 0) {
                                  setCalMonth(11);
                                  setCalYear((y) => y - 1);
                                } else {
                                  setCalMonth((m) => m - 1);
                                }
                              }}
                              style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "1.2rem", padding: "4px 10px", borderRadius: 8, lineHeight: 1 }}
                            >
                              ‹
                            </button>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>{monthNames[calMonth]}</span>
                              <button
                                type="button"
                                onClick={() => setYearPickerOpen(true)}
                                style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--accent)", fontFamily: "var(--font-sans)", background: "none", border: "none", padding: "2px 4px", borderRadius: 6 }}
                              >
                                {calYear}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (calMonth === 11) {
                                  setCalMonth(0);
                                  setCalYear((y) => y + 1);
                                } else {
                                  setCalMonth((m) => m + 1);
                                }
                              }}
                              style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "1.2rem", padding: "4px 10px", borderRadius: 8, lineHeight: 1 }}
                            >
                              ›
                            </button>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, textAlign: "center" }}>
                            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                              <div key={day} style={{ fontSize: "0.58rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", padding: "4px 0", letterSpacing: "0.04em" }}>{day}</div>
                            ))}
                            {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                            {Array.from({ length: daysInMonth }, (_, i) => {
                              const day = i + 1;
                              const iso = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                              const isSelected = iso === selectedIso;
                              const isToday = iso === todayIso;
                              return (
                                <button
                                  type="button"
                                  key={day}
                                  onClick={() => {
                                    setDob(isoToDob(iso));
                                    setDobOpen(false);
                                    setYearPickerOpen(false);
                                  }}
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    border: "none",
                                    fontSize: "0.75rem",
                                    fontFamily: "var(--font-sans)",
                                    fontWeight: isSelected ? 600 : 400,
                                    backgroundColor: isSelected ? "var(--accent)" : "transparent",
                                    color: isSelected ? "#fff" : isToday ? "var(--accent)" : "var(--text-primary)",
                                    margin: "0 auto",
                                  }}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
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
              <div style={{ ...inputStyle, color: "var(--text-muted)", cursor: "default" }}>
                {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <label style={labelStyle}>Patient Imaging</label>
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files.length) {
                    addPatientFiles(Array.from(e.dataTransfer.files));
                  }
                }}
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
                  onChange={e => {
                    if (e.target.files?.length) {
                      addPatientFiles(Array.from(e.target.files));
                      e.target.value = "";
                    }
                  }}
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
                    {(ingestState === "running" || ingestState === "done") && (
                      <div style={{ marginTop: 16, textAlign: "left" }}>
                        <div
                          style={{
                            height: 5,
                            borderRadius: 999,
                            backgroundColor: "var(--border)",
                            overflow: "hidden",
                            position: "relative",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${ingestBarPct}%`,
                              borderRadius: 999,
                              background: "linear-gradient(90deg, var(--accent-muted), var(--accent))",
                              transition: ingestState === "done" ? "width 0.35s cubic-bezier(0.22, 1, 0.36, 1)" : "none",
                              boxShadow: ingestState === "done" ? "0 0 12px rgba(45, 212, 191, 0.35)" : "none",
                            }}
                          />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, minHeight: 22 }}>
                          {ingestState === "running" && (
                            <p style={{ fontSize: "0.62rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
                              Preparing imaging…
                            </p>
                          )}
                          {ingestState === "done" && (
                            <>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: 22,
                                  height: 22,
                                  borderRadius: "50%",
                                  backgroundColor: "var(--accent-dim)",
                                  border: "1px solid var(--accent)",
                                  animation: "ingestCheckPop 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards",
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                                  <path
                                    className="landing-checkmark-path"
                                    d="M5 13l4 4L19 7"
                                    stroke="var(--accent)"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </div>
                              <p style={{ fontSize: "0.62rem", fontFamily: "var(--font-mono)", color: "var(--accent)", letterSpacing: "0.04em" }}>
                                Ready
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    )}
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
            <button
              type="submit"
              disabled={patientFiles.length === 0}
              style={{
                padding: "13px 28px",
                borderRadius: 999,
                border: "1px solid var(--accent)",
                backgroundColor: patientFiles.length === 0 ? "var(--border)" : "var(--accent-dim)",
                color: patientFiles.length === 0 ? "var(--text-muted)" : "var(--accent-light)",
                fontSize: "0.82rem",
                fontWeight: 600,
                fontFamily: "var(--font-sans)",
                marginTop: 4,
                transition: "all 0.2s ease",
                cursor: patientFiles.length === 0 ? "not-allowed" : "pointer",
                opacity: patientFiles.length === 0 ? 0.7 : 1,
              }}
            >
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
