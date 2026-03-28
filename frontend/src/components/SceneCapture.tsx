import { useState, useRef, useCallback } from "react";

interface Props {
  onComplete: (sessionId: string, sceneData: any) => void;
}

const EQUIPMENT_OPTIONS = ["First aid kit", "AED", "Splints", "Tourniquet", "Stretcher", "Cervical collar", "Oxygen", "IV kit"];
const LOCATION_TYPES = ["Road", "Building", "Wilderness", "Vehicle", "Industrial", "Residential"];

export default function SceneCapture({ onComplete }: Props) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [locationType, setLocationType] = useState("");
  const [weather, setWeather] = useState("clear");
  const [equipment, setEquipment] = useState<string[]>(["First aid kit"]);
  const [responders, setResponders] = useState(1);
  const [hospitalDist, setHospitalDist] = useState("15-30 min");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraActive(true);
    } catch { /* camera unavailable */ }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    setPhoto(canvas.toDataURL("image/jpeg", 0.7));
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraActive(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    setIsAnalyzing(true);
    const sessionId = `trauma-${Date.now().toString(36)}`;
    try {
      const res = await fetch("http://localhost:8000/api/scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          image_base64: photo?.split(",")[1] || null,
          location_type: locationType.toLowerCase(),
          weather,
          equipment,
          responders,
          hospital_distance: hospitalDist,
        }),
      });
      const data = await res.json();
      onComplete(sessionId, data);
    } catch (e) {
      console.error("Scene analysis failed:", e);
      onComplete(sessionId, { terrain: locationType.toLowerCase(), hazards: [], equipment_visible: [], people_count: responders, lighting: weather, notes: "" });
    }
  }, [photo, locationType, weather, equipment, responders, hospitalDist, onComplete]);

  const toggleEquipment = (item: string) => {
    setEquipment((prev) => prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "auto" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 24px", gap: 28, maxWidth: 480, margin: "0 auto", width: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--accent)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Step 1</p>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 300, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Capture the scene</h2>
        </div>

        {/* Photo capture */}
        <div style={{ width: "100%", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", overflow: "hidden", backgroundColor: "var(--bg-surface)" }}>
          {cameraActive ? (
            <div style={{ position: "relative" }}>
              <video ref={videoRef} style={{ width: "100%", display: "block" }} playsInline muted />
              <button onClick={capturePhoto} style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", width: 48, height: 48, borderRadius: "50%", border: "3px solid white", backgroundColor: "rgba(255,255,255,0.2)", cursor: "pointer" }} />
            </div>
          ) : photo ? (
            <div style={{ position: "relative" }}>
              <img src={photo} alt="Scene" style={{ width: "100%", display: "block" }} />
              <button onClick={() => { setPhoto(null); startCamera(); }} style={{ position: "absolute", top: 8, right: 8, padding: "4px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: "0.68rem", cursor: "pointer" }}>Retake</button>
            </div>
          ) : (
            <button onClick={startCamera} style={{ width: "100%", padding: "32px", border: "none", backgroundColor: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <span style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>Capture scene photo</span>
              <span style={{ color: "var(--text-muted)", fontSize: "0.65rem" }}>Optional — improves analysis</span>
            </button>
          )}
        </div>

        {/* Form */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Location */}
          <div>
            <label style={{ display: "block", fontSize: "0.68rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>Location</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {LOCATION_TYPES.map((t) => (
                <button key={t} onClick={() => setLocationType(t)} style={{ padding: "5px 12px", borderRadius: "var(--radius-sm)", border: `1px solid ${locationType === t ? "var(--accent)" : "var(--border)"}`, backgroundColor: locationType === t ? "var(--accent-dim)" : "transparent", color: locationType === t ? "var(--accent)" : "var(--text-secondary)", fontSize: "0.72rem", fontWeight: 500 }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Equipment */}
          <div>
            <label style={{ display: "block", fontSize: "0.68rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>Available equipment</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {EQUIPMENT_OPTIONS.map((e) => (
                <button key={e} onClick={() => toggleEquipment(e)} style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", border: `1px solid ${equipment.includes(e) ? "var(--accent)" : "var(--border)"}`, backgroundColor: equipment.includes(e) ? "var(--accent-dim)" : "transparent", color: equipment.includes(e) ? "var(--accent)" : "var(--text-muted)", fontSize: "0.68rem" }}>{e}</button>
              ))}
            </div>
          </div>

          {/* Responders + Hospital */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.68rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>Responders</label>
              <input type="number" min={1} max={20} value={responders} onChange={(e) => setResponders(Number(e.target.value))} style={{ width: "100%", padding: "7px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "0.78rem", outline: "none" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.68rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>Hospital ETA</label>
              <select value={hospitalDist} onChange={(e) => setHospitalDist(e.target.value)} style={{ width: "100%", padding: "7px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "0.78rem", outline: "none" }}>
                {["< 5 min", "5-15 min", "15-30 min", "30+ min"].map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>

        <button onClick={handleSubmit} disabled={isAnalyzing} style={{ width: "100%", padding: "11px", borderRadius: "var(--radius-sm)", border: "1px solid var(--accent)", backgroundColor: "var(--accent-dim)", color: "var(--accent)", fontSize: "0.82rem", fontWeight: 500, opacity: isAnalyzing ? 0.5 : 1 }}>
          {isAnalyzing ? "Analyzing scene..." : "Continue to patient assessment"}
        </button>
      </div>
    </div>
  );
}
