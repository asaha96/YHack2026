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
      const validExtensions = [".dcm", ".nii", ".nii.gz", ".zip"];
      const name = file.name.toLowerCase();
      if (!validExtensions.some((ext) => name.endsWith(ext))) {
        setError("Please upload a DICOM (.dcm), NIfTI (.nii/.nii.gz), or ZIP archive");
        return;
      }

      setFileName(file.name);
      setIsUploading(true);
      setError(null);
      setUploadProgress(0);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("http://localhost:8000/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);

        setUploadProgress(50);

        const data = await res.json();
        setUploadProgress(100);

        // Trigger reconstruction
        onUploadComplete(data.session_id, data.splat_path || `/splats/${data.session_id}.splat`);
      } catch (e: any) {
        setError(e.message || "Upload failed");
        setIsUploading(false);
      }
    },
    [onUploadComplete]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: 40,
        gap: 32,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 500 }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
          Upload Patient Scan
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", lineHeight: 1.6 }}>
          Upload a CT or MRI scan to reconstruct a 3D model of the patient's anatomy
          for surgical simulation.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (isUploading) return;
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".dcm,.nii,.nii.gz,.zip";
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleFile(file);
          };
          input.click();
        }}
        style={{
          width: "100%",
          maxWidth: 460,
          padding: "48px 32px",
          borderRadius: 16,
          border: `2px dashed ${isDragging ? "var(--accent)" : "var(--border)"}`,
          backgroundColor: isDragging ? "var(--accent-glow)" : "var(--bg-surface)",
          cursor: isUploading ? "default" : "pointer",
          transition: "all 0.2s ease",
          textAlign: "center",
        }}
      >
        {isUploading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ width: 32, height: 32, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ color: "var(--text-primary)", fontSize: "0.85rem", fontWeight: 500 }}>
              {uploadProgress < 50 ? `Uploading ${fileName}...` : "Processing scan..."}
            </span>
            <div style={{ width: "100%", height: 4, borderRadius: 2, backgroundColor: "var(--border)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${uploadProgress}%`, backgroundColor: "var(--accent)", borderRadius: 2, transition: "width 0.5s ease" }} />
            </div>
          </div>
        ) : (
          <>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17,8 12,3 7,8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p style={{ color: "var(--text-primary)", fontSize: "0.88rem", fontWeight: 500, marginBottom: 4 }}>
              Drop CT/MRI scan here or click to browse
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
              DICOM (.dcm), NIfTI (.nii), or ZIP archive
            </p>
          </>
        )}
      </div>

      {error && (
        <p style={{ color: "var(--risk-high)", fontSize: "0.82rem" }}>{error}</p>
      )}

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, width: "100%", maxWidth: 460 }}>
        <div style={{ flex: 1, height: 1, backgroundColor: "var(--border)" }} />
        <span style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: 500 }}>OR</span>
        <div style={{ flex: 1, height: 1, backgroundColor: "var(--border)" }} />
      </div>

      {/* Sample dataset button */}
      <button
        onClick={onUseSample}
        disabled={isUploading}
        style={{
          padding: "12px 28px",
          borderRadius: 12,
          border: "1px solid var(--accent)",
          backgroundColor: "var(--accent-glow)",
          color: "var(--accent-light)",
          fontSize: "0.88rem",
          fontWeight: 600,
          cursor: isUploading ? "not-allowed" : "pointer",
          opacity: isUploading ? 0.5 : 1,
          transition: "all 0.2s ease",
        }}
      >
        Use Sample Dataset
      </button>
      <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", marginTop: -16 }}>
        Pre-loaded abdominal CT scan for demonstration
      </p>
    </div>
  );
}
