import { useState, useCallback } from "react";

interface Props {
  onUploadComplete: (sessionId: string, splatPath: string) => void;
  onUseSample: () => void;
}

export default function UploadPanel({ onUploadComplete, onUseSample }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const name = file.name.toLowerCase();
      if (![".dcm", ".nii", ".nii.gz", ".zip"].some((ext) => name.endsWith(ext))) {
        setError("Accepted formats: DICOM (.dcm), NIfTI (.nii), ZIP archive");
        return;
      }
      setFileName(file.name);
      setIsUploading(true);
      setError(null);
      setUploadProgress(0);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("http://localhost:8000/api/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
        setUploadProgress(50);
        const data = await res.json();
        setUploadProgress(100);
        onUploadComplete(data.session_id, data.splat_path || `/splats/${data.session_id}.splat`);
      } catch (e: any) {
        setError(e.message || "Upload failed");
        setIsUploading(false);
      }
    },
    [onUploadComplete]
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: 40, gap: 32 }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--accent)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
          New Session
        </p>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 300, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.02em" }}>
          Upload patient scan
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", lineHeight: 1.6 }}>
          CT or MRI data will be reconstructed into a 3D model for surgical simulation.
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (isUploading) return;
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".dcm,.nii,.nii.gz,.zip";
          input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFile(f); };
          input.click();
        }}
        style={{
          width: "100%", maxWidth: 400, padding: "44px 32px",
          border: `1px ${isDragging ? "solid" : "dashed"} ${isDragging ? "var(--accent)" : "var(--border)"}`,
          borderRadius: "var(--radius-md)",
          backgroundColor: isDragging ? "var(--accent-dim)" : "var(--bg-surface)",
          cursor: isUploading ? "default" : "pointer",
          transition: "all 0.15s ease", textAlign: "center",
        }}
      >
        {isUploading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ width: 20, height: 20, border: "1.5px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>
              {uploadProgress < 50 ? `Uploading ${fileName}` : "Processing..."}
            </span>
            <div style={{ width: "100%", height: 2, backgroundColor: "var(--border)", overflow: "hidden", borderRadius: 1 }}>
              <div style={{ height: "100%", width: `${uploadProgress}%`, backgroundColor: "var(--accent)", transition: "width 0.4s ease" }} />
            </div>
          </div>
        ) : (
          <>
            <div style={{ width: 32, height: 32, margin: "0 auto 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17,8 12,3 7,8" />
                <line x1="12" y1="3" x2="12" y2="15" />
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              </svg>
            </div>
            <p style={{ color: "var(--text-primary)", fontSize: "0.82rem", fontWeight: 500, marginBottom: 4 }}>Drop scan file or click to browse</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>DICOM, NIfTI, or ZIP</p>
          </>
        )}
      </div>

      {error && <p style={{ color: "var(--risk-high)", fontSize: "0.75rem" }}>{error}</p>}

      <div style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", maxWidth: 400 }}>
        <div style={{ flex: 1, height: 1, backgroundColor: "var(--border)" }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: "var(--text-muted)", letterSpacing: "0.04em" }}>OR</span>
        <div style={{ flex: 1, height: 1, backgroundColor: "var(--border)" }} />
      </div>

      <button
        onClick={onUseSample}
        disabled={isUploading}
        style={{
          padding: "10px 24px", borderRadius: "var(--radius-sm)",
          border: "1px solid var(--accent)", backgroundColor: "var(--accent-dim)",
          color: "var(--accent)", fontSize: "0.8rem", fontWeight: 500,
          opacity: isUploading ? 0.4 : 1,
        }}
      >
        Use sample dataset
      </button>
      <p style={{ color: "var(--text-muted)", fontSize: "0.68rem", marginTop: -16 }}>
        Abdominal CT — pre-loaded for demonstration
      </p>
    </div>
  );
}
