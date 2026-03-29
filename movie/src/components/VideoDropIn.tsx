import React from "react";
import { OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, fade, mono, sans, serif } from "../constants";
import { WindowChrome } from "./Panels";

/**
 * VideoDropIn — App footage container for Praxis demo scenes.
 *
 * HOW TO USE WITH REAL FOOTAGE:
 *   1. Drop the .mp4 in movie/public/footage/
 *   2. Fill in the slot in src/videoSources.ts with { src, playbackRate }
 *   3. Pass `videoSrc` and `playbackRate` here — the video will be
 *      automatically stretched/compressed to fill the exact scene duration.
 *
 * The `overlayContent` (pets, labels) renders on top regardless.
 */
export const VideoDropIn: React.FC<{
  /** What shows inside the viewport when no real footage is available */
  children: React.ReactNode;
  /** Window chrome title shown in the title bar */
  windowTitle?: string;
  /** Tag shown top-left, e.g. "STEP 01 · UPLOAD" */
  stepLabel?: string;
  /** Overlay content rendered over the viewport (pets, badges, etc.) */
  overlayContent?: React.ReactNode;
  /** Overall scale — useful for fitting in constrained layouts */
  scale?: number;
  /**
   * Path to a real screen-recording (relative to public/).
   * When provided the video replaces the animated mock entirely.
   */
  videoSrc?: string;
  /**
   * video_duration_seconds / scene_duration_seconds.
   * Stretches or compresses the clip so it fills exactly the scene length.
   * Values < 1 slow it down; > 1 speed it up. See videoSources.ts for how
   * to compute this.
   */
  playbackRate?: number;
}> = ({
  children,
  windowTitle = "praxis — localhost:5173",
  stepLabel,
  overlayContent,
  scale = 1,
  videoSrc,
  playbackRate = 1,
}) => {
  const W = 1320 * scale;
  const H = 760 * scale;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <WindowChrome title={windowTitle} width={W}>
        {/* Viewport */}
        <div
          style={{
            position: "relative",
            width: W,
            height: H,
            overflow: "hidden",
            background: "linear-gradient(160deg, #fcfaf4 0%, #f8f4ec 60%, #f6f1ea 100%)",
          }}
        >
          {/* Real footage — stretched to fill the scene exactly */}
          {videoSrc ? (
            <OffthreadVideo
              src={staticFile(videoSrc)}
              playbackRate={playbackRate}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            children
          )}

          {/* Scanline texture overlay — makes it look like a screen recording */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(0,0,0,0.012) 0px, rgba(0,0,0,0.012) 1px, transparent 1px, transparent 3px)",
              pointerEvents: "none",
              mixBlendMode: "multiply",
            }}
          />

          {/* FOOTAGE PLACEHOLDER badge — hidden when real video is loaded */}
          {!videoSrc && <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 14px",
              borderRadius: 999,
              background: "rgba(18,14,11,0.54)",
              border: "1px solid rgba(255,255,255,0.14)",
              backdropFilter: "blur(8px)",
            }}
          >
            <RecDot />
            <span
              style={{
                fontFamily: mono,
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "rgba(245,240,230,0.8)",
              }}
            >
              drop footage here
            </span>
          </div>}

          {/* Overlay content (pets, annotations) */}
          {overlayContent && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
              }}
            >
              {overlayContent}
            </div>
          )}
        </div>
      </WindowChrome>

      {/* Step label badge below window */}
      {stepLabel && (
        <div
          style={{
            marginTop: 20,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 24px",
              borderRadius: 999,
              background: "rgba(253,250,244,0.88)",
              border: `1px solid ${C.line}`,
              boxShadow: "0 4px 16px rgba(38,29,20,0.08)",
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: C.ember,
              }}
            />
            <span
              style={{
                fontFamily: mono,
                fontSize: 11,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: C.inkMuted,
              }}
            >
              {stepLabel}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Pulsing red REC dot
const RecDot: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 0.5 + (Math.sin(frame / 14) * 0.5 + 0.5) * 0.5;
  return (
    <div
      style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: "#e05a4a",
        opacity: pulse,
        boxShadow: "0 0 6px rgba(224,90,74,0.6)",
      }}
    />
  );
};

// ─── APP MOCK UIs ───────────────────────────────────────────────────────────────
// These are used inside VideoDropIn as mockContent.
// Replace with <Video> when real footage is available.

export const UploadMock: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = Math.min(100, (frame / 120) * 100);
  const fileOpacity = fade(frame, 10, 35);
  const progressOpacity = fade(frame, 40, 60);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 32,
        background:
          "linear-gradient(160deg, #fcfaf4 0%, #f8f4ec 60%)",
      }}
    >
      {/* Drop zone */}
      <div
        style={{
          width: 580,
          padding: "52px 48px",
          borderRadius: 28,
          border: "2px dashed rgba(109,98,87,0.3)",
          background: "rgba(255,255,255,0.6)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          boxShadow: "0 12px 48px rgba(38,29,20,0.06)",
        }}
      >
        <div style={{ fontSize: 56 }}>🫁</div>
        <div
          style={{
            fontFamily: serif,
            fontSize: 26,
            color: C.ink,
            letterSpacing: "-0.03em",
            textAlign: "center",
          }}
        >
          Drop your CT or MRI scan here
        </div>
        <div
          style={{
            fontFamily: mono,
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: C.inkMuted,
          }}
        >
          DICOM · NIfTI · Any format, really
        </div>
      </div>

      {/* File being uploaded */}
      <div
        style={{
          opacity: fileOpacity,
          width: 580,
          padding: "22px 28px",
          borderRadius: 20,
          background: "rgba(255,255,255,0.72)",
          border: `1px solid ${C.line}`,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>📁</span>
            <div>
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 12,
                  color: C.ink,
                  letterSpacing: "0.02em",
                }}
              >
                patient_4471_ct.dcm
              </div>
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 10,
                  color: C.inkMuted,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginTop: 3,
                }}
              >
                218 MB · DICOM Series
              </div>
            </div>
          </div>
          <div
            style={{
              fontFamily: mono,
              fontSize: 11,
              color: C.sage,
              letterSpacing: "0.1em",
            }}
          >
            {Math.round(progress)}%
          </div>
        </div>
        <div
          style={{
            opacity: progressOpacity,
            height: 4,
            borderRadius: 999,
            background: "rgba(47,39,31,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              borderRadius: 999,
              background: `linear-gradient(90deg, ${C.ember}, ${C.sage})`,
              transition: "width 0.1s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export const ReconstructMock: React.FC = () => {
  const frame = useCurrentFrame();
  const rotate = frame * 0.8;
  const buildProgress = Math.min(100, (frame / 140) * 100);
  const ringScale = 0.85 + (Math.sin(frame / 20) * 0.5 + 0.5) * 0.15;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0e0c0a",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: [
            "linear-gradient(rgba(130,144,125,0.06) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(130,144,125,0.06) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "48px 48px",
        }}
      />

      {/* Rotating rings */}
      <svg
        width={520}
        height={520}
        viewBox="0 0 520 520"
        style={{ position: "absolute" }}
      >
        {[80, 130, 180, 220].map((r, i) => (
          <ellipse
            key={i}
            cx={260}
            cy={260}
            rx={r * ringScale}
            ry={r * 0.38 * ringScale}
            stroke={`rgba(130,144,125,${0.18 - i * 0.03})`}
            strokeWidth={1}
            fill="none"
            transform={`rotate(${rotate + i * 20}, 260, 260)`}
          />
        ))}
        {/* Body outline */}
        <path
          d="M260 100 C210 100 170 138 162 188 L144 340 C138 388 164 428 200 428 L320 428 C356 428 382 388 376 340 L358 188 C350 138 310 100 260 100 Z"
          fill="rgba(255,255,255,0.04)"
          stroke="rgba(178,110,87,0.48)"
          strokeWidth="1.8"
        />
        {/* Heart highlight */}
        <path
          d="M260 240 C244 220 218 228 220 248 C222 268 260 288 260 288 C260 288 298 268 300 248 C302 228 276 220 260 240 Z"
          fill="rgba(178,110,87,0.22)"
          stroke="rgba(178,110,87,0.7)"
          strokeWidth="1.6"
        />
      </svg>

      {/* Build progress */}
      <div
        style={{
          position: "absolute",
          bottom: 48,
          left: "50%",
          transform: "translateX(-50%)",
          width: 360,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontFamily: mono,
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "rgba(200,188,176,0.7)",
          }}
        >
          Reconstructing volume · {Math.round(buildProgress)}%
        </div>
        <div
          style={{
            width: "100%",
            height: 3,
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${buildProgress}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${C.ember}, ${C.sage})`,
              borderRadius: 999,
            }}
          />
        </div>
      </div>

      {/* Labels */}
      {[
        { x: "22%", y: "32%", label: "left lung", color: C.sage },
        { x: "64%", y: "42%", label: "portal vein", color: C.ember },
        { x: "55%", y: "68%", label: "safe plane", color: "rgba(200,188,176,0.7)" },
      ].map((tag) => (
        <div
          key={tag.label}
          style={{
            position: "absolute",
            left: tag.x,
            top: tag.y,
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: tag.color,
              boxShadow: `0 0 8px ${tag.color}`,
            }}
          />
          <span
            style={{
              fontFamily: mono,
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: tag.color,
            }}
          >
            {tag.label}
          </span>
        </div>
      ))}
    </div>
  );
};

export const HandTrackMock: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 0.7 + Math.sin(frame / 16) * 0.3;

  // Animated hand skeleton points
  const handX = 560 + Math.sin(frame / 28) * 40;
  const handY = 350 + Math.cos(frame / 22) * 30;

  const fingers = [
    { dx: 0, dy: -120 },
    { dx: 36, dy: -110 },
    { dx: 68, dy: -90 },
    { dx: 96, dy: -70 },
    { dx: -48, dy: -60 },
  ];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0a0908",
        position: "relative",
      }}
    >
      {/* Camera grain effect */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E\")",
          backgroundSize: "200px 200px",
          opacity: 0.4,
        }}
      />

      {/* Hand skeleton SVG */}
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute" }}
      >
        {/* Palm */}
        <ellipse
          cx={handX}
          cy={handY}
          rx={52}
          ry={44}
          fill="rgba(130,144,125,0.08)"
          stroke="rgba(130,144,125,0.5)"
          strokeWidth="1.5"
        />
        {/* Fingers */}
        {fingers.map((f, i) => (
          <g key={i}>
            <line
              x1={handX + (i - 2) * 22}
              y1={handY - 20}
              x2={handX + f.dx / 2}
              y2={handY + f.dy / 2}
              stroke="rgba(178,110,87,0.7)"
              strokeWidth="2"
            />
            <line
              x1={handX + f.dx / 2}
              y1={handY + f.dy / 2}
              x2={handX + f.dx}
              y2={handY + f.dy}
              stroke="rgba(178,110,87,0.5)"
              strokeWidth="1.5"
            />
            <circle
              cx={handX + f.dx}
              cy={handY + f.dy}
              r="5"
              fill="rgba(178,110,87,0.8)"
            />
          </g>
        ))}
        {/* Wrist dots */}
        {[
          [handX - 30, handY + 40],
          [handX + 30, handY + 40],
          [handX, handY + 50],
        ].map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="4"
            fill="rgba(130,144,125,0.7)"
          />
        ))}
      </svg>

      {/* Gesture label */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            padding: "10px 28px",
            borderRadius: 999,
            background: "rgba(178,110,87,0.18)",
            border: "1px solid rgba(178,110,87,0.4)",
            opacity: pulse,
          }}
        >
          <span
            style={{
              fontFamily: mono,
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(232,200,122,0.9)",
            }}
          >
            Gesture Detected: PINCH
          </span>
        </div>
        <div
          style={{
            fontFamily: mono,
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(200,188,176,0.5)",
          }}
        >
          Hand tracking active · 30fps
        </div>
      </div>

      {/* Corner HUD */}
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 24,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {["MEDIAPIPE HANDS", "CONFIDENCE 94%", "LANDMARKS 21"].map((t) => (
          <div
            key={t}
            style={{
              fontFamily: mono,
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(130,144,125,0.7)",
            }}
          >
            {t}
          </div>
        ))}
      </div>
    </div>
  );
};

export const AIMock: React.FC = () => {
  const frame = useCurrentFrame();
  const cursorBlink = Math.floor(frame / 18) % 2 === 0;
  const thirdMessageOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(160deg, #fcfaf4 0%, #f8f4ec 60%)",
        display: "flex",
        flexDirection: "column",
        padding: "24px 32px",
        gap: 16,
        overflowY: "hidden",
      }}
    >
      <div
        style={{
          fontFamily: serif,
          fontSize: 20,
          color: C.ink,
          letterSpacing: "-0.03em",
          marginBottom: 4,
        }}
      >
        Surgical Guidance Assistant
      </div>

      {(
        [
          [
            "surgeon",
            "Reconstruction looks good. What's the safest approach for the hepatectomy?",
          ],
          [
            "assistant",
            "Recommend a right subcostal incision, 2 cm below the costal margin. Maintain 12–15 mm clearance from the hepatic artery throughout. The portal vein bifurcation is atypically positioned in this patient — flag it before clamping.",
          ],
          ["surgeon", "Any contraindications I should know about?"],
        ] as [string, string][]
      ).map(([role, body], i) => (
        <div
          key={i}
          style={{
            padding: "18px 22px",
            borderRadius: 22,
            background:
              role === "surgeon"
                ? "rgba(233,227,218,0.72)"
                : "rgba(255,255,255,0.72)",
            border: `1px solid ${role === "surgeon" ? "rgba(47,39,31,0.1)" : "rgba(47,39,31,0.06)"}`,
            opacity: i === 2 ? thirdMessageOpacity : 1,
            maxWidth: i === 2 ? 520 : undefined,
          }}
        >
          <div
            style={{
              fontFamily: mono,
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: C.inkMuted,
              marginBottom: 8,
            }}
          >
            {role === "surgeon" ? "You" : "Praxis AI"}
          </div>
          <div
            style={{
              fontFamily: sans,
              fontSize: 15,
              lineHeight: 1.65,
              color: C.ink,
            }}
          >
            {body}
          </div>
        </div>
      ))}

      {/* Typing indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          opacity: frame > 90 ? 0.7 : 0,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: C.inkMuted,
              opacity:
                0.3 +
                (Math.sin((frame + i * 10) / 10) * 0.5 + 0.5) * 0.7,
            }}
          />
        ))}
        <span
          style={{
            fontFamily: mono,
            fontSize: 10,
            color: C.inkMuted,
            letterSpacing: "0.1em",
          }}
        >
          Praxis is thinking…
        </span>
      </div>
    </div>
  );
};

export const SummaryMock: React.FC = () => {
  const frame = useCurrentFrame();

  const steps = [
    { label: "Patient", detail: "Case 4471-B · Male · 58y · High risk", done: true },
    { label: "Incision", detail: "Right subcostal, 2 cm below costal margin", done: true },
    { label: "Approach", detail: "Left lateral — avoid hepatic artery", done: true },
    { label: "Clearance", detail: "12 mm minimum from portal vein bifurcation", done: true },
    { label: "Contingency", detail: "Flag atypical portal vein before clamping", done: false },
  ];

  const exportProgress = Math.min(100, ((frame - 80) / 60) * 100);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(160deg, #fcfaf4 0%, #f8f4ec 60%)",
        padding: "32px 40px",
        display: "flex",
        gap: 32,
      }}
    >
      {/* Plan */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            fontFamily: serif,
            fontSize: 26,
            color: C.ink,
            letterSpacing: "-0.04em",
          }}
        >
          Surgical Plan
        </div>
        <div
          style={{
            fontFamily: mono,
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: C.inkMuted,
          }}
        >
          Generated · Case 4471-B
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          {steps.map((step, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                padding: "14px 18px",
                borderRadius: 16,
                background: "rgba(255,255,255,0.6)",
                border: `1px solid ${C.line}`,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  background: step.done
                    ? "rgba(130,144,125,0.12)"
                    : "rgba(47,39,31,0.04)",
                  border: `1px solid ${step.done ? "rgba(130,144,125,0.3)" : "rgba(47,39,31,0.1)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: mono,
                  fontSize: 10,
                  color: step.done ? C.sage : C.inkMuted,
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {step.done ? "✓" : `0${i + 1}`}
              </div>
              <div>
                <div
                  style={{
                    fontFamily: serif,
                    fontSize: 15,
                    color: C.ink,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {step.label}
                </div>
                <div
                  style={{
                    fontFamily: sans,
                    fontSize: 12,
                    color: C.inkSoft,
                    lineHeight: 1.5,
                    marginTop: 3,
                  }}
                >
                  {step.detail}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export panel */}
      <div
        style={{
          width: 260,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            padding: "24px 20px",
            borderRadius: 20,
            background: "rgba(255,255,255,0.7)",
            border: `1px solid ${C.line}`,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ fontSize: 32, textAlign: "center" }}>📄</div>
          <div
            style={{
              fontFamily: serif,
              fontSize: 18,
              color: C.ink,
              letterSpacing: "-0.03em",
              textAlign: "center",
            }}
          >
            Export to PDF
          </div>
          <div
            style={{
              height: 4,
              borderRadius: 999,
              background: "rgba(47,39,31,0.08)",
              overflow: "hidden",
              opacity: frame > 80 ? 1 : 0,
            }}
          >
            <div
              style={{
                width: `${Math.max(0, exportProgress)}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${C.ember}, ${C.sage})`,
                borderRadius: 999,
              }}
            />
          </div>
          <div
            style={{
              fontFamily: mono,
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: C.sage,
              textAlign: "center",
              opacity: frame > 140 ? 1 : 0,
            }}
          >
            Ready · 2 pages
          </div>
        </div>
      </div>
    </div>
  );
};
