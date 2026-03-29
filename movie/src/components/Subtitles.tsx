import React from "react";
import { Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { serif } from "../constants";

export type SubtitleStyle = "normal" | "punchline" | "whisper";

export interface SubtitleEntry {
  from: number;       // global frame the subtitle appears
  to: number;         // global frame the subtitle disappears
  text: string;
  style?: SubtitleStyle;
  audio: string;      // filename inside public/narration/, e.g. "line-01.mp3"
}

// ─── NARRATION SCRIPT ──────────────────────────────────────────────────────────
//
// DROP YOUR AUDIO FILES IN:  movie/public/narration/
//
// NAME THEM EXACTLY AS LISTED in the `audio` field below.
// Each file should contain just that one line of narration.
// Remotion will start playing it at the exact frame the subtitle appears.
//
// If a file is missing, Remotion will warn but won't crash.
//
export const SUBTITLE_SCRIPT: SubtitleEntry[] = [
  // ── Title Scene (0–180) ────────────────────────────────────────────────────
  {
    from: 15, to: 85,
    text: "Meet Praxis.",
    style: "punchline",
    audio: "line-01.mp3",   // "Meet Praxis."
  },
  {
    from: 90, to: 168,
    text: "It knows your patient before you do.",
    audio: "line-02.mp3",   // "It knows your patient before you do."
  },

  // ── Problem Scene (180–360) ────────────────────────────────────────────────
  {
    from: 195, to: 275,
    text: "Most surgeons see their patient's anatomy for the first time. In the OR.",
    audio: "line-03.mp3",   // "Most surgeons see their patient's anatomy for the first time. In the OR."
  },
  {
    from: 280, to: 358,
    text: "Surgeons practice on real patients. Which is… fine. (It's not fine.)",
    audio: "line-04.mp3",   // "Surgeons practice on real patients. Which is… fine. (It's not fine.)"
  },

  // ── Upload Scene (360–540) ─────────────────────────────────────────────────
  {
    from: 370, to: 430,
    text: "But we thought we could build something better.",
    style: "punchline",
    audio: "line-05.mp3",   // "So we built something better."
  },
  {
    from: 435, to: 528,
    text: "Upload a CT or MRI scan. Any scan. Yes, even that one.",
    audio: "line-06.mp3",   // "Upload a CT or MRI scan. Any scan. Yes, even that one."
  },

  // ── Reconstruct Scene (540–720) ────────────────────────────────────────────
  {
    from: 550, to: 638,
    text: "Praxis reconstructs the full 3D anatomy in seconds.",
    audio: "line-07.mp3",   // "Praxis reconstructs the full 3D anatomy in seconds."
  },
  {
    from: 643, to: 710,
    text: "Your patient's actual liver. Their actual heart.",
    audio: "line-08.mp3",   // "Your patient's actual liver. Their actual heart."
  },

  // ── Hand Tracking Scene (720–900) ──────────────────────────────────────────
  {
    from: 730, to: 810,
    text: "Rehearse the operation with your real hands.",
    audio: "line-09.mp3",   // "Rehearse the operation with your real hands."
  },
  {
    from: 815, to: 890,
    text: "No $50k haptic gloves. Just a webcam and courage.",
    audio: "line-10.mp3",   // "No $50k haptic gloves. Just a webcam and courage."
  },

  // ── AI Scene (900–1080) ────────────────────────────────────────────────────
  {
    from: 908, to: 978,
    text: "Stuck? Ask the AI anything.",
    style: "punchline",
    audio: "line-11.mp3",   // "Stuck? Ask the AI anything."
  },
  {
    from: 983, to: 1068,
    text: "Like a brilliant colleague who never says 'just Google it.'",
    audio: "line-12.mp3",   // "Like a brilliant colleague who never says 'just Google it.'"
  },

  // ── Summary Scene (1080–1260) ──────────────────────────────────────────────
  {
    from: 1088, to: 1168,
    text: "Export the full surgical plan to PDF.",
    audio: "line-13.mp3",   // "Export the full surgical plan to PDF."
  },
  {
    from: 1173, to: 1250,
    text: "Print it. Frame it. Impress your attendings.",
    audio: "line-14.mp3",   // "Print it. Frame it. Impress your attendings."
  },

  // ── Hero Scene (1260–1440) ─────────────────────────────────────────────────
  {
    from: 1268, to: 1348,
    text: "Workflow. Anatomy. Guidance. All in one platform.",
    audio: "line-15.mp3",   // "Workflow. Anatomy. Guidance. All in one platform."
  },
  {
    from: 1353, to: 1428,
    text: "Because the OR is not the place to wing it.",
    audio: "line-16.mp3",   // "Because the OR is not the place to wing it."
  },

  // ── Closing Scene (1440–1590) ──────────────────────────────────────────────
  {
    from: 1455, to: 1520,
    text: "Praxis.",
    style: "punchline",
    audio: "line-17.mp3",   // "Praxis."
  },
  {
    from: 1525, to: 1578,
    text: "Practice makes perfect. Now you can.",
    audio: "line-18.mp3",   // "Practice makes perfect. Now you can."
  },
];

// ─── COMPONENT ─────────────────────────────────────────────────────────────────

const FADE_FRAMES = 10;

export const Subtitles: React.FC = () => {
  const frame = useCurrentFrame();

  const active = SUBTITLE_SCRIPT.filter(
    (s) => frame >= s.from - FADE_FRAMES && frame <= s.to + FADE_FRAMES
  );

  // Render audio players for every line (each wrapped in a Sequence so it
  // fires at the right global frame). Rendered unconditionally so Remotion
  // can seek correctly during render.
  const audioTracks = SUBTITLE_SCRIPT.map((entry, i) => (
    <Sequence
      key={`audio-${i}`}
      from={entry.from}
      durationInFrames={entry.to - entry.from + FADE_FRAMES}
    >
      <Audio src={staticFile(`narration/${entry.audio}`)} />
    </Sequence>
  ));

  if (active.length === 0) return <>{audioTracks}</>;

  // Show the most recent active subtitle
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
    <>
      {audioTracks}
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
    </>
  );
};
