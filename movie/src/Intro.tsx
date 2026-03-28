import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#f4f6ff",
  accent: "#6d28d9",
  accentSoft: "#a78bfa",
  accentDim: "rgba(109,40,217,0.08)",
  teal: "#2dd4bf",
  red: "#f87171",
  text: "#07071a",
  textSub: "#4b5563",
  textMuted: "#9ca3af",
  white: "#ffffff",
  darkBg: "#07070f",
  darkSurface: "#0f0f1c",
  darkBorder: "rgba(255,255,255,0.065)",
};

// Helper: clamped spring
const spr = (
  frame: number,
  fps: number,
  delay = 0,
  damping = 14,
  stiffness = 110,
  mass = 0.8
) =>
  spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping, stiffness, mass },
  });

// ─── Background ───────────────────────────────────────────────────────────────
const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 450], [0, 12], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      {/* Main gradient — light, airy, slightly purple-shifted */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(${148 + drift}deg, #eef1ff 0%, #f4f0ff 35%, #faf5ff 65%, #eef3ff 100%)`,
        }}
      />

      {/* Soft radial bloom — top left */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 18% 25%, rgba(139,92,246,0.09) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Soft radial bloom — bottom right */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 82% 78%, rgba(45,212,191,0.06) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Precision grid */}
      <AbsoluteFill
        style={{
          backgroundImage: [
            "linear-gradient(rgba(109,40,217,0.035) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(109,40,217,0.035) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "96px 96px",
          pointerEvents: "none",
        }}
      />

      {/* Soft vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(180,170,220,0.18) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Sonar Rings (ambient atmosphere) ────────────────────────────────────────
const SonarRings: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {[0, 60, 120].map((offset, i) => {
        const t = ((frame + offset) % 180) / 180;
        const scale = 0.15 + t * 1.2;
        const opacity = interpolate(t, [0, 0.3, 1], [0, 0.12, 0]);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 800,
              height: 800,
              borderRadius: "50%",
              border: `1.5px solid rgba(109,40,217,${opacity})`,
              transform: `translate(-50%,-50%) scale(${scale})`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ─── Act 1 — Title Reveal (frames 0–110) ─────────────────────────────────────
const LETTERS = ["P", "r", "a", "x", "i", "s"];

const AnimatedLetter: React.FC<{ char: string; index: number }> = ({
  char,
  index,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = 8 + index * 7;

  const progress = spr(frame, fps, delay, 18, 160, 0.65);
  const y = interpolate(progress, [0, 1], [55, 0]);
  const opacity = interpolate(frame - delay, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const blur = interpolate(progress, [0, 1], [16, 0]);
  const floatY = Math.sin((frame + index * 24) / 60) * 2.5;

  return (
    <span
      style={{
        display: "inline-block",
        transform: `translateY(${y + floatY}px)`,
        opacity,
        filter: `blur(${blur}px)`,
      }}
    >
      {char}
    </span>
  );
};

const TitleSection: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Icon entrance
  const iconProgress = spr(frame, fps, 0, 20, 140, 0.7);
  const iconScale = interpolate(iconProgress, [0, 1], [0.2, 1]);
  const iconOpacity = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Tagline (appears after letters settle)
  const tagProgress = spr(frame, fps, 60, 16, 100, 0.9);
  const tagY = interpolate(tagProgress, [0, 1], [24, 0]);
  const tagOpacity = interpolate(frame - 60, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Divider line grows in
  const lineWidth = interpolate(frame - 68, [0, 30], [0, 48], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Medical precision icon */}
      <div
        style={{
          marginBottom: 36,
          opacity: iconOpacity,
          transform: `scale(${iconScale})`,
        }}
      >
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle
            cx="24"
            cy="24"
            r="21"
            stroke={C.accent}
            strokeWidth="1.5"
            opacity="0.3"
          />
          <circle
            cx="24"
            cy="24"
            r="13"
            stroke={C.accentSoft}
            strokeWidth="0.8"
            opacity="0.4"
          />
          <circle cx="24" cy="24" r="4" fill={C.accent} opacity="0.7" />
          <line
            x1="24"
            y1="5"
            x2="24"
            y2="14"
            stroke={C.accent}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <line
            x1="24"
            y1="34"
            x2="24"
            y2="43"
            stroke={C.accent}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <line
            x1="5"
            y1="24"
            x2="14"
            y2="24"
            stroke={C.accent}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <line
            x1="34"
            y1="24"
            x2="43"
            y2="24"
            stroke={C.accent}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Wordmark */}
      <div
        style={{
          fontFamily: "'Georgia', 'Times New Roman', serif",
          fontSize: 152,
          fontWeight: 300,
          letterSpacing: "0.2em",
          color: C.text,
          display: "flex",
          lineHeight: 1,
        }}
      >
        {LETTERS.map((char, i) => (
          <AnimatedLetter key={i} char={char} index={i} />
        ))}
      </div>

      {/* Tagline group */}
      <div
        style={{
          marginTop: 28,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          opacity: tagOpacity,
          transform: `translateY(${tagY}px)`,
        }}
      >
        <div
          style={{
            height: 1,
            width: lineWidth,
            background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)`,
          }}
        />
        <p
          style={{
            fontFamily: "'Helvetica Neue', Arial, sans-serif",
            fontSize: 20,
            fontWeight: 400,
            letterSpacing: "0.26em",
            textTransform: "uppercase",
            color: C.textSub,
            margin: 0,
          }}
        >
          AI-Guided Surgical Simulation
        </p>
        <p
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            color: C.textMuted,
            letterSpacing: "0.1em",
            margin: 0,
          }}
        >
          Three.js · Gaussian Splatting · Groq / Llama 4 · MediaPipe
        </p>
      </div>
    </AbsoluteFill>
  );
};

// ─── Act 2 — Feature Badges (frames 90–200) ──────────────────────────────────
const FEATURES = [
  {
    label: "3D Reconstruction",
    sub: "CT / MRI → Gaussian Splat",
    color: C.accentSoft,
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <polygon
          points="10,2 18,6 18,14 10,18 2,14 2,6"
          stroke={C.accent}
          strokeWidth="1.2"
          fill="none"
          opacity="0.8"
        />
        <circle cx="10" cy="10" r="2.5" fill={C.accent} opacity="0.6" />
      </svg>
    ),
  },
  {
    label: "Hand Tracking",
    sub: "5 gesture types · zero hardware",
    color: C.teal,
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 16 L6 8 L6 5 Q6 4 7 4 Q8 4 8 5 L8 10 L9 10 L9 4 Q9 3 10 3 Q11 3 11 4 L11 10 L12 10 L12 5 Q12 4 13 4 Q14 4 14 5 L14 10 L15 10 L15 8 Q15 7 16 7 Q17 7 17 8 L17 12 Q17 15 14 16 Z"
          stroke="#2dd4bf"
          strokeWidth="1"
          fill="rgba(45,212,191,0.15)"
        />
      </svg>
    ),
  },
  {
    label: "AI Analysis",
    sub: "Real-time risk · Llama 4 Scout",
    color: C.red,
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle
          cx="10"
          cy="10"
          r="7"
          stroke="#f87171"
          strokeWidth="1.2"
          fill="none"
          opacity="0.6"
        />
        <path
          d="M10 6 L10 10 L13 13"
          stroke="#f87171"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="10" cy="6" r="1" fill="#f87171" opacity="0.8" />
      </svg>
    ),
  },
];

const FeatureBadge: React.FC<{
  feature: (typeof FEATURES)[0];
  index: number;
  startFrame: number;
}> = ({ feature, index, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = startFrame + index * 16;

  const progress = spr(frame, fps, delay, 16, 120, 0.85);
  const y = interpolate(progress, [0, 1], [32, 0]);
  const opacity = interpolate(frame - delay, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "20px 28px",
        background: "rgba(255,255,255,0.76)",
        border: "1px solid rgba(109,40,217,0.11)",
        borderRadius: 18,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow:
          "0 6px 32px rgba(109,40,217,0.07), 0 1px 4px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)",
        opacity,
        transform: `translateY(${y}px)`,
        minWidth: 288,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: C.accentDim,
          border: "1px solid rgba(109,40,217,0.13)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {feature.icon}
      </div>
      <div>
        <p
          style={{
            fontFamily: "'Helvetica Neue', Arial, sans-serif",
            fontSize: 14,
            fontWeight: 600,
            color: C.text,
            marginBottom: 4,
            letterSpacing: "-0.01em",
          }}
        >
          {feature.label}
        </p>
        <p
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            color: C.textMuted,
            letterSpacing: "0.04em",
          }}
        >
          {feature.sub}
        </p>
      </div>
    </div>
  );
};

// ─── Anatomy Viewer Mockup ────────────────────────────────────────────────────
const AnatomyViewerMock: React.FC<{ startFrame: number }> = ({
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spr(frame, fps, startFrame, 18, 130, 0.88);
  const opacity = interpolate(frame - startFrame, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(progress, [0, 1], [44, 0]);
  const scale = interpolate(progress, [0, 1], [0.93, 1]);

  const elapsed = frame - startFrame;
  const scanY = interpolate(elapsed, [0, 150], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pulse = (Math.sin(elapsed / 11) * 0.5 + 0.5);

  const annotations = [
    { label: "Liver", lx: 56, ly: 66, color: C.teal },
    { label: "L. Ventricle", lx: 30, ly: 43, color: C.red },
    { label: "Aorta", lx: 64, ly: 52, color: C.red },
    { label: "L. Lung", lx: 18, ly: 34, color: C.accentSoft },
  ];

  return (
    <div
      style={{
        width: 560,
        background: C.darkBg,
        borderRadius: 20,
        border: `1px solid ${C.darkBorder}`,
        boxShadow:
          "0 28px 72px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)",
        overflow: "hidden",
        opacity,
        transform: `translateY(${y}px) scale(${scale})`,
        flexShrink: 0,
      }}
    >
      {/* Header bar */}
      <div
        style={{
          padding: "12px 20px",
          borderBottom: `1px solid ${C.darkBorder}`,
          background: C.darkSurface,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: C.accent,
              boxShadow: `0 0 8px ${C.accent}`,
            }}
          />
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 12,
              color: "rgba(255,255,255,0.75)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Praxis
          </span>
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              color: "rgba(255,255,255,0.22)",
              letterSpacing: "0.04em",
            }}
          >
            / Simulation
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            ["Mesh", true],
            ["Splat", false],
          ].map(([label, active]) => (
            <div
              key={label as string}
              style={{
                padding: "4px 12px",
                borderRadius: 5,
                fontSize: 10,
                fontFamily: "monospace",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                background: active
                  ? "rgba(109,40,217,0.2)"
                  : "transparent",
                color: active ? C.accentSoft : "rgba(255,255,255,0.28)",
                border: `1px solid ${active ? "rgba(109,40,217,0.35)" : C.darkBorder}`,
              }}
            >
              {label as string}
            </div>
          ))}
        </div>
      </div>

      {/* 3D Viewport */}
      <div style={{ position: "relative", height: 280, overflow: "hidden" }}>
        {/* Viewport background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, #090912 0%, #06060e 100%)",
            backgroundImage: [
              "linear-gradient(rgba(109,40,217,0.045) 1px, transparent 1px)",
              "linear-gradient(90deg, rgba(109,40,217,0.045) 1px, transparent 1px)",
            ].join(", "),
            backgroundSize: "36px 36px",
          }}
        />

        {/* Center glow */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            width: 200,
            height: 260,
            background:
              "radial-gradient(ellipse, rgba(109,40,217,0.14) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Anatomy SVG */}
        <svg
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
          }}
          width="180"
          height="230"
          viewBox="0 0 180 230"
        >
          {/* Torso outline */}
          <path
            d="M90 10 C68 10 40 36 36 74 L28 168 C26 190 36 206 54 208 L126 208 C144 206 154 190 152 168 L144 74 C140 36 112 10 90 10 Z"
            fill="none"
            stroke="rgba(109,40,217,0.38)"
            strokeWidth="1.4"
          />

          {/* Left lung */}
          <path
            d="M58 65 C44 70 38 92 40 116 C42 134 54 142 70 137 L86 126 L90 65 Z"
            fill="rgba(109,40,217,0.07)"
            stroke="rgba(167,139,250,0.45)"
            strokeWidth="0.9"
          />

          {/* Right lung */}
          <path
            d="M122 65 C136 70 142 92 140 116 C138 134 126 142 110 137 L94 126 L90 65 Z"
            fill="rgba(109,40,217,0.07)"
            stroke="rgba(167,139,250,0.45)"
            strokeWidth="0.9"
          />

          {/* Heart */}
          <path
            d="M90 84 C76 70 55 74 58 95 C60 110 90 128 90 128 C90 128 120 110 122 95 C125 74 104 70 90 84 Z"
            fill="rgba(248,113,113,0.1)"
            stroke="rgba(248,113,113,0.55)"
            strokeWidth="1"
          />

          {/* Liver */}
          <path
            d="M58 142 C44 142 36 154 40 172 C44 184 64 192 90 190 C112 188 128 180 132 164 C136 148 120 140 92 140 Z"
            fill="rgba(45,212,191,0.07)"
            stroke="rgba(45,212,191,0.35)"
            strokeWidth="0.9"
          />

          {/* Spine */}
          {[98, 122, 146, 170, 194].map((cy, i) => (
            <circle
              key={i}
              cx="90"
              cy={cy}
              r="3.5"
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="0.7"
            />
          ))}

          {/* Ribs — left */}
          {[80, 96, 112].map((y, i) => (
            <path
              key={`rl${i}`}
              d={`M90 ${y} C72 ${y + 4}, 54 ${y + 10}, 46 ${y + 20}`}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="0.6"
            />
          ))}

          {/* Ribs — right */}
          {[80, 96, 112].map((y, i) => (
            <path
              key={`rr${i}`}
              d={`M90 ${y} C108 ${y + 4}, 126 ${y + 10}, 134 ${y + 20}`}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="0.6"
            />
          ))}
        </svg>

        {/* CT scan line */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${scanY}%`,
            height: 1.5,
            background:
              "linear-gradient(90deg, transparent 5%, rgba(109,40,217,0.55) 30%, rgba(45,212,191,0.4) 60%, rgba(109,40,217,0.3) 80%, transparent 95%)",
            boxShadow: "0 0 8px rgba(109,40,217,0.3)",
            pointerEvents: "none",
          }}
        />

        {/* Annotation dots + labels */}
        {annotations.map((ann, i) => {
          const annOpacity = interpolate(
            elapsed - i * 10,
            [0, 20],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const glow = 1 + Math.sin((elapsed + i * 18) / 10) * 0.4;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${ann.lx}%`,
                top: `${ann.ly}%`,
                opacity: annOpacity,
                display: "flex",
                alignItems: "center",
                gap: 6,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: ann.color,
                  boxShadow: `0 0 ${8 * glow}px ${ann.color}`,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  color: ann.color,
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                  textShadow: `0 0 10px ${ann.color}60`,
                }}
              >
                {ann.label}
              </span>
            </div>
          );
        })}

        {/* Corner coordinates */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 14,
            fontFamily: "monospace",
            fontSize: 9,
            color: "rgba(255,255,255,0.18)",
            letterSpacing: "0.04em",
          }}
        >
          X: +0.42 Y: −1.08 Z: +0.77
        </div>
      </div>

      {/* Status bar */}
      <div
        style={{
          padding: "10px 18px",
          borderTop: `1px solid ${C.darkBorder}`,
          background: C.darkSurface,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: C.red,
            boxShadow: `0 0 ${7 * pulse}px ${C.red}`,
          }}
        />
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            color: C.red,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          2 Risk Zones Identified
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            color: "rgba(255,255,255,0.2)",
          }}
        >
          session-47f2a
        </span>
      </div>
    </div>
  );
};

// ─── AI Panel Mockup ──────────────────────────────────────────────────────────
const AIPanelMock: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spr(frame, fps, startFrame, 18, 130, 0.88);
  const opacity = interpolate(frame - startFrame, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(progress, [0, 1], [36, 0]);
  const scale = interpolate(progress, [0, 1], [0.94, 1]);

  const elapsed = frame - startFrame;

  const messages = [
    {
      role: "assistant",
      text: "Reconstruction complete. Scanning for key structures...",
    },
    { role: "user", text: "Safest incision approach?" },
    {
      role: "assistant",
      text: "Left subcostal recommended. Hepatic artery 8mm proximal — maintain 12mm clearance. Portal vein at L2.",
    },
  ];

  const risks = [
    { label: "Hepatic Artery", level: 0.82 },
    { label: "Portal Vein", level: 0.61 },
    { label: "Bile Duct", level: 0.38 },
  ];

  return (
    <div
      style={{
        width: 420,
        background: "rgba(252,252,255,0.88)",
        borderRadius: 20,
        border: "1px solid rgba(109,40,217,0.1)",
        boxShadow:
          "0 20px 56px rgba(109,40,217,0.09), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.95)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        overflow: "hidden",
        opacity,
        transform: `translateY(${y}px) scale(${scale})`,
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid rgba(0,0,0,0.055)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(255,255,255,0.6)",
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: C.accent,
            boxShadow: `0 0 8px ${C.accent}60`,
          }}
        />
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            color: C.text,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          AI Guide
        </span>
        <div style={{ flex: 1 }} />
        <div
          style={{
            padding: "3px 10px",
            borderRadius: 5,
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.22)",
          }}
        >
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 9,
              color: "#ef4444",
              letterSpacing: "0.07em",
              textTransform: "uppercase",
            }}
          >
            High Risk
          </span>
        </div>
      </div>

      {/* Chat messages */}
      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {messages.map((msg, i) => {
          const msgOpacity = interpolate(
            elapsed - i * 14,
            [0, 20],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const isUser = msg.role === "user";
          return (
            <div
              key={i}
              style={{
                alignSelf: isUser ? "flex-end" : "flex-start",
                maxWidth: "88%",
                opacity: msgOpacity,
              }}
            >
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: isUser
                    ? "14px 14px 3px 14px"
                    : "14px 14px 14px 3px",
                  background: isUser
                    ? "rgba(109,40,217,0.09)"
                    : "rgba(245,246,252,0.9)",
                  border: isUser
                    ? "1px solid rgba(109,40,217,0.16)"
                    : "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <p
                  style={{
                    fontFamily: "'Helvetica Neue', Arial, sans-serif",
                    fontSize: 12,
                    lineHeight: 1.65,
                    color: isUser ? C.accent : C.text,
                    margin: 0,
                  }}
                >
                  {msg.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Risk breakdown */}
      <div
        style={{
          margin: "0 16px 16px",
          padding: "12px 14px",
          borderRadius: 10,
          background: "rgba(248,113,113,0.06)",
          border: "1px solid rgba(248,113,113,0.14)",
        }}
      >
        <p
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            color: "#ef4444",
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Risk Assessment
        </p>
        {risks.map((r, i) => {
          const rOpacity = interpolate(
            elapsed - 36 - i * 8,
            [0, 18],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const barW = interpolate(
            elapsed - 42 - i * 8,
            [0, 28],
            [0, r.level * 100],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          return (
            <div
              key={i}
              style={{ marginBottom: i < 2 ? 8 : 0, opacity: rOpacity }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 10,
                    color: C.textSub,
                  }}
                >
                  {r.label}
                </span>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 10,
                    color: C.textMuted,
                  }}
                >
                  {Math.round(r.level * 100)}%
                </span>
              </div>
              <div
                style={{
                  height: 4,
                  background: "rgba(0,0,0,0.06)",
                  borderRadius: 2,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 2,
                    width: `${barW}%`,
                    background: `linear-gradient(90deg, #f87171, #fca5a5)`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Workflow Panel Mockup ────────────────────────────────────────────────────
const WorkflowMock: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spr(frame, fps, startFrame, 18, 120, 0.9);
  const opacity = interpolate(frame - startFrame, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(progress, [0, 1], [36, 0]);
  const scale = interpolate(progress, [0, 1], [0.94, 1]);

  const elapsed = frame - startFrame;

  const steps = [
    { num: "01", label: "Upload", detail: "CT / MRI scan", done: true },
    {
      num: "02",
      label: "Reconstruct",
      detail: "3D Gaussian splat",
      done: true,
    },
    {
      num: "03",
      label: "Annotate",
      detail: "AI-labeled anatomy",
      active: true,
    },
    {
      num: "04",
      label: "Simulate",
      detail: "Hand-tracked surgery",
      done: false,
    },
    { num: "05", label: "Report", detail: "Surgical plan PDF", done: false },
  ];

  return (
    <div
      style={{
        width: 340,
        background: "rgba(252,252,255,0.88)",
        borderRadius: 20,
        border: "1px solid rgba(0,0,0,0.07)",
        boxShadow:
          "0 14px 44px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.95)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        overflow: "hidden",
        opacity,
        transform: `translateY(${y}px) scale(${scale})`,
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid rgba(0,0,0,0.055)",
          background: "rgba(255,255,255,0.6)",
        }}
      >
        <p
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            color: C.accent,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          Pipeline
        </p>
        <p
          style={{
            fontFamily: "'Helvetica Neue', Arial, sans-serif",
            fontSize: 15,
            fontWeight: 500,
            color: C.text,
            letterSpacing: "-0.02em",
          }}
        >
          Patient #4471-B
        </p>
      </div>

      {/* Steps */}
      <div style={{ padding: "8px 0" }}>
        {steps.map((step, i) => {
          const stepOpacity = interpolate(
            elapsed - i * 9,
            [0, 18],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const isActive = (step as any).active;
          const isDone = (step as any).done;

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "10px 20px",
                background: isActive ? "rgba(109,40,217,0.05)" : "transparent",
                opacity: stepOpacity,
              }}
            >
              {/* Step marker */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  flexShrink: 0,
                  background: isDone
                    ? "rgba(45,212,191,0.1)"
                    : isActive
                    ? "rgba(109,40,217,0.1)"
                    : "rgba(0,0,0,0.04)",
                  border: `1px solid ${
                    isDone
                      ? "rgba(45,212,191,0.28)"
                      : isActive
                      ? "rgba(109,40,217,0.22)"
                      : "rgba(0,0,0,0.08)"
                  }`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isDone ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <polyline
                      points="2,6 5,9 10,3"
                      stroke="#2dd4bf"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 9,
                      color: isActive ? C.accent : C.textMuted,
                    }}
                  >
                    {step.num}
                  </span>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <p
                  style={{
                    fontFamily: "'Helvetica Neue', Arial, sans-serif",
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive
                      ? C.text
                      : isDone
                      ? C.textSub
                      : C.textMuted,
                    marginBottom: 2,
                  }}
                >
                  {step.label}
                </p>
                <p
                  style={{
                    fontFamily: "monospace",
                    fontSize: 10,
                    color: C.textMuted,
                    letterSpacing: "0.03em",
                  }}
                >
                  {step.detail}
                </p>
              </div>

              {isActive && (
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: C.accent,
                    boxShadow: `0 0 ${
                      6 + Math.sin(elapsed / 9) * 3
                    }px ${C.accent}`,
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div
        style={{
          margin: "4px 20px 16px",
          height: 3,
          background: "rgba(0,0,0,0.06)",
          borderRadius: 2,
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 2,
            width: `${interpolate(elapsed, [0, 60], [0, 42], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}%`,
            background: `linear-gradient(90deg, ${C.accent}, ${C.accentSoft})`,
          }}
        />
      </div>
    </div>
  );
};

// ─── Small top logo for panel phase ──────────────────────────────────────────
const SmallLogo: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spr(frame, fps, startFrame, 16, 120, 0.9);
  const opacity = interpolate(frame - startFrame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(progress, [0, 1], [16, 0]);

  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        left: "50%",
        transform: `translateX(-50%) translateY(${y}px)`,
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <p
        style={{
          fontFamily: "'Georgia', serif",
          fontSize: 32,
          fontWeight: 300,
          letterSpacing: "0.24em",
          color: C.text,
          margin: 0,
        }}
      >
        PRAXIS
      </p>
      <div
        style={{
          width: 32,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)`,
        }}
      />
      <p
        style={{
          fontFamily: "monospace",
          fontSize: 10,
          color: C.textMuted,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          margin: 0,
        }}
      >
        AI-Guided Surgical Simulation
      </p>
    </div>
  );
};

// ─── Stack line at bottom ─────────────────────────────────────────────────────
const StackLine: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - startFrame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 56,
        left: "50%",
        transform: "translateX(-50%)",
        opacity,
        display: "flex",
        alignItems: "center",
        gap: 20,
      }}
    >
      {["Three.js", "Gaussian Splatting", "Groq / Llama 4", "MediaPipe"].map(
        (tech, i) => (
          <React.Fragment key={tech}>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: C.textMuted,
                letterSpacing: "0.07em",
              }}
            >
              {tech}
            </span>
            {i < 3 && (
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  color: "rgba(109,40,217,0.3)",
                }}
              >
                ·
              </span>
            )}
          </React.Fragment>
        )
      )}
    </div>
  );
};

// ─── Main Intro Component ─────────────────────────────────────────────────────
//
//  Timeline (30 fps):
//   0 – 110   Act 1: Title + icon reveal
//  60 – 200   Act 2: Tagline + feature badges
// 155 – 190   Crossfade: title fades out, panels phase begins
// 190 – 450   Act 3: UI panel showcase
// 400 – 450   Fade out
//
export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Global fade-out
  const globalOpacity = interpolate(frame, [410, 450], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Title phase fades out
  const titleOpacity = interpolate(frame, [150, 182], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleMoveUp = interpolate(
    spr(frame, fps, 150, 14, 90, 1),
    [0, 1],
    [0, -28]
  );

  // Badges fade out with title
  const badgesOpacity = interpolate(frame, [158, 186], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Panel phase appears
  const panelPhaseOpacity = interpolate(frame, [175, 210], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const showPanels = frame >= 170;

  return (
    <AbsoluteFill style={{ opacity: globalOpacity }}>
      <Background />
      <SonarRings />

      {/* ── Act 1+2: Title, tagline, badges ── */}
      <AbsoluteFill
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleMoveUp}px)`,
          pointerEvents: "none",
        }}
      >
        <TitleSection />

        {/* Feature badges pinned below center */}
        <div
          style={{
            position: "absolute",
            bottom: "18%",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 20,
            opacity: badgesOpacity,
          }}
        >
          {FEATURES.map((f, i) => (
            <FeatureBadge key={i} feature={f} index={i} startFrame={95} />
          ))}
        </div>
      </AbsoluteFill>

      {/* ── Act 3: UI Panel showcase ── */}
      {showPanels && (
        <AbsoluteFill style={{ opacity: panelPhaseOpacity }}>
          <SmallLogo startFrame={175} />

          {/* Three panels, horizontally centered */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -44%)",
              display: "flex",
              alignItems: "center",
              gap: 32,
            }}
          >
            <WorkflowMock startFrame={185} />
            <AnatomyViewerMock startFrame={198} />
            <AIPanelMock startFrame={212} />
          </div>

          <StackLine startFrame={280} />
        </AbsoluteFill>
      )}

      <Audio src={staticFile("music.mp3")} />
    </AbsoluteFill>
  );
};
