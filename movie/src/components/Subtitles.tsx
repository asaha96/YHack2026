import React from "react";
import { Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { serif } from "../constants";

export type SubtitleStyle = "normal" | "punchline" | "whisper";

export interface SubtitleEntry {
  from: number;       // global frame the subtitle appears
  to: number;         // global frame the subtitle disappears
  text: string;
  style?: SubtitleStyle;
  audio?: string;     // filename inside public/narration/, e.g. "line-01.mp3"
}

const FADE_FRAMES = 10;

export const Subtitles: React.FC<{ entries: SubtitleEntry[] }> = ({ entries }) => {
  const frame = useCurrentFrame();

  const active = entries.filter(
    (s) => frame >= s.from - FADE_FRAMES && frame <= s.to + FADE_FRAMES
  );

  // Render audio players for every line (each wrapped in a Sequence so it
  // fires at the right global frame). Rendered unconditionally so Remotion
  // can seek correctly during render.
  const audioTracks = entries.flatMap((entry, i) =>
    entry.audio
      ? [
        <Sequence
          key={`audio-${i}`}
          from={entry.from}
          durationInFrames={entry.to - entry.from + 1 + FADE_FRAMES}
        >
          <Audio src={staticFile(`narration/${entry.audio}`)} />
        </Sequence>,
      ]
      : []
  );

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
