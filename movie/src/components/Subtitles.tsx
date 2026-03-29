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
  // ── Title Scene (0–200) ──────────────────────────────────────────────────── Nik
  {
    from: 18, to: 92,
    text: "Meet Praxis.",
    style: "punchline",
    audio: "line-01.mp3",
  },
  {
    from: 98, to: 188,
    text: "The workspace for patient-specific surgical planning and rehearsal.",
    audio: "line-02.mp3",
  },

  // ── Problem Scene (200–400) ──────────────────────────────────────────────── Sujal
  {
    from: 214, to: 306,
    text: "Today, surgeons plan from flat scans, disconnected tools, and mental reconstruction.",
    audio: "line-03.mp3",
  },
  {
    from: 314, to: 392,
    text: "That means less certainty before incision and fewer chances to rehearse the exact case.",
    audio: "line-04.mp3",
  },

  // ── Upload Scene (400–600) ───────────────────────────────────────────────── Aritra
  {
    from: 414, to: 486,
    text: "Praxis starts with the scan the team already has.",
    style: "punchline",
    audio: "line-05.mp3",
  },
  {
    from: 492, to: 590,
    text: "Upload CT or MRI data, and Praxis organizes the case in seconds.",
    audio: "line-06.mp3",
  },

  // ── Reconstruct Scene (600–800) ──────────────────────────────────────────── Vedant
  {
    from: 614, to: 704,
    text: "Praxis converts image slices into an interactive 3D anatomy model.",
    audio: "line-07.mp3",
  },
  {
    from: 710, to: 790,
    text: "Now the team can inspect organs, vessels, and spatial risk before entering the OR.",
    audio: "line-08.mp3",
  },

  // ── Hand Tracking Scene (800–1000) ───────────────────────────────────────── Sujal
  {
    from: 814, to: 900,
    text: "Then surgeons rehearse the procedure with natural hand tracking.",
    audio: "line-09.mp3",
  },
  {
    from: 906, to: 990,
    text: "They can trace an approach, explore anatomy, and simulate decisions on real patient geometry.",
    audio: "line-10.mp3",
  },

  // ── AI Scene (1000–1200) ─────────────────────────────────────────────────── Aritra
  {
    from: 1014, to: 1086,
    text: "Need support mid-plan? Ask the built-in surgical copilot.",
    style: "punchline",
    audio: "line-11.mp3",
  },
  {
    from: 1092, to: 1190,
    text: "It explains structures, answers workflow questions, and keeps the team moving.",
    audio: "line-12.mp3",
  },

  // ── Summary Scene (1200–1400) ────────────────────────────────────────────── Nik
  {
    from: 1214, to: 1290,
    text: "When planning is done, Praxis exports a clear surgical summary.",
    audio: "line-13.mp3",
  },
  {
    from: 1296, to: 1390,
    text: "Teams can share risks, steps, and findings with attendings and collaborators.",
    audio: "line-14.mp3",
  },

  // ── Hero Scene (1400–1600) ───────────────────────────────────────────────── Vedant
  {
    from: 1414, to: 1494,
    text: "One platform for imaging, simulation, guidance, and communication.",
    audio: "line-15.mp3",
  },
  {
    from: 1500, to: 1590,
    text: "So preparation happens before the operating room, not inside it.",
    audio: "line-16.mp3",
  },

  // ── Closing Scene (1600–1800) ────────────────────────────────────────────── Nik
  {
    from: 1620, to: 1688,
    text: "Praxis.",
    style: "punchline",
    audio: "line-17.mp3",
  },
  {
    from: 1696, to: 1788,
    text: "See the patient. Rehearse the case. Walk in ready.",
    audio: "line-18.mp3",
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
