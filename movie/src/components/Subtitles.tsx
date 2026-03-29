import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, serif } from "../constants";

export type SubtitleStyle = "normal" | "punchline" | "whisper";

export interface SubtitleEntry {
  from: number;  // global frame
  to: number;    // global frame
  text: string;
  style?: SubtitleStyle;
}

// ─── NARRATION SCRIPT ──────────────────────────────────────────────────────────
// Edit these to match your recording. Times are in frames at 30fps.
// Add humor. We beg of you.
export const SUBTITLE_SCRIPT: SubtitleEntry[] = [
  // TitleScene (0–180)
  { from: 15, to: 85, text: "Meet Praxis.", style: "punchline" },
  { from: 90, to: 168, text: "It knows your patient before you do." },

  // ProblemScene (180–360)
  { from: 195, to: 275, text: "Most surgeons see their patient's anatomy for the first time. In the OR." },
  { from: 280, to: 358, text: "Surgeons practice on real patients. Which is… fine. (It's not fine.)", style: "whisper" },

  // UploadScene (360–540)
  { from: 370, to: 430, text: "So we built something better.", style: "punchline" },
  { from: 435, to: 528, text: "Upload a CT or MRI scan. Any scan. Yes, even that one." },

  // ReconstructScene (540–720)
  { from: 550, to: 638, text: "Praxis reconstructs the full 3D anatomy in seconds." },
  { from: 643, to: 710, text: "Your patient's actual liver. Their actual heart." },

  // HandTrackingScene (720–900)
  { from: 730, to: 810, text: "Rehearse the operation with your real hands." },
  { from: 815, to: 890, text: "No $50k haptic gloves. Just a webcam and courage." },

  // AIScene (900–1080)
  { from: 908, to: 978, text: "Stuck? Ask the AI anything.", style: "punchline" },
  { from: 983, to: 1068, text: "Like a brilliant colleague who never says 'just Google it.'" },

  // SummaryScene (1080–1260)
  { from: 1088, to: 1168, text: "Export the full surgical plan to PDF." },
  { from: 1173, to: 1250, text: "Print it. Frame it. Impress your attendings." },

  // HeroScene (1260–1440)
  { from: 1268, to: 1348, text: "Workflow. Anatomy. Guidance. All in one platform." },
  { from: 1353, to: 1428, text: "Because the OR is not the place to wing it." },

  // ClosingScene (1440–1590)
  { from: 1455, to: 1520, text: "Praxis.", style: "punchline" },
  { from: 1525, to: 1578, text: "Practice makes perfect. Now you can." },
];

// ─── COMPONENT ─────────────────────────────────────────────────────────────────

const FADE_FRAMES = 10;

export const Subtitles: React.FC = () => {
  const frame = useCurrentFrame();

  const active = SUBTITLE_SCRIPT.filter(
    (s) => frame >= s.from - FADE_FRAMES && frame <= s.to + FADE_FRAMES
  );

  if (active.length === 0) return null;

  // Show the most recent active entry
  const entry = active[active.length - 1];

  const opacity = interpolate(
    frame,
    [entry.from - FADE_FRAMES, entry.from, entry.to, entry.to + FADE_FRAMES],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const slideY = interpolate(
    frame,
    [entry.from - FADE_FRAMES, entry.from],
    [10, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const style = entry.style ?? "normal";

  const textStyle: React.CSSProperties =
    style === "punchline"
      ? {
        fontFamily: serif,
        fontSize: 36,
        fontWeight: 400,
        color: "#e8c87a",
        letterSpacing: "-0.02em",
        textShadow: "0 0 40px rgba(232,200,122,0.4)",
      }
      : style === "whisper"
        ? {
          fontFamily: serif,
          fontSize: 26,
          fontStyle: "italic",
          color: "rgba(245,240,230,0.72)",
          letterSpacing: "0.01em",
        }
        : {
          fontFamily: serif,
          fontSize: 32,
          color: "#f5f0e6",
          letterSpacing: "-0.01em",
        };

  return (
    <div
      style={{
        position: "absolute",
        bottom: 72,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 100,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${slideY}px)`,
          padding: "18px 52px",
          borderRadius: 999,
          background: "rgba(18,14,11,0.72)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
          maxWidth: 1400,
          textAlign: "center",
        }}
      >
        {/* Decorative top rule for punchlines */}
        {style === "punchline" && (
          <div
            style={{
              width: 40,
              height: 1,
              background: "rgba(232,200,122,0.4)",
              margin: "0 auto 10px",
            }}
          />
        )}
        <span style={textStyle}>{entry.text}</span>
      </div>
    </div>
  );
};
