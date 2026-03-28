interface Props {
  roomCode: string | null;
  phoneConnected: boolean;
  streaming: boolean;
}

export default function RoomSetup({
  roomCode,
  phoneConnected,
  streaming,
}: Props) {
  const hostname = window.location.hostname || "localhost";
  const port = window.location.port || "5173";
  const phoneUrl = roomCode
    ? `${window.location.protocol}//${hostname}:${port}/camera/${roomCode}`
    : "";

  const status = streaming
    ? "Streaming"
    : phoneConnected
      ? "Phone connected"
      : roomCode
        ? "Waiting for phone..."
        : "Connecting...";

  const statusColor = streaming
    ? "#22c55e"
    : phoneConnected
      ? "#3b82f6"
      : "#eab308";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        padding: 48,
        minHeight: "60vh",
      }}
    >
      {/* Status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 16,
          color: "rgba(255,255,255,0.7)",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: statusColor,
            boxShadow: `0 0 12px ${statusColor}`,
            animation: !streaming ? "dotPulse 2s ease-in-out infinite" : "none",
          }}
        />
        {status}
      </div>

      {/* Room code */}
      {roomCode && !streaming && (
        <>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.4)",
                marginBottom: 12,
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              Room Code
            </div>
            <div
              style={{
                fontSize: 64,
                fontWeight: 700,
                color: "#2dd4bf",
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: 12,
                textShadow: "0 0 30px rgba(45, 212, 191, 0.3)",
              }}
            >
              {roomCode}
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.4)",
                marginBottom: 8,
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              Open on your phone
            </div>
            <div
              style={{
                fontSize: 16,
                color: "rgba(255,255,255,0.8)",
                fontFamily: "'JetBrains Mono', monospace",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                padding: "12px 24px",
                cursor: "pointer",
                userSelect: "all",
              }}
              onClick={() => {
                navigator.clipboard?.writeText(phoneUrl);
              }}
              title="Click to copy"
            >
              {phoneUrl}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                marginTop: 8,
              }}
            >
              Click to copy URL
            </div>
          </div>
        </>
      )}
    </div>
  );
}
