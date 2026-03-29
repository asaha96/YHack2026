import React from "react";
import { Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { serif } from "../constants";

export type SubtitleStyle = "normal" | "punchline" | "whisper";

export interface SceneNarration {
  offset: number; // frames from the scene's start frame
  text: string;
  style?: SubtitleStyle;
  audio?: string;  // filename inside public/narration/
}

// ─── NARRATION SCRIPT ─────────────────────────────────────────────────────────
// Offsets are relative to each scene's start frame (not global).
// calculateMetadata in Root.tsx measures each audio file and sets scene
// durations so every scene lasts exactly as long as its longest audio clip.
export const SCENE_NARRATIONS: SceneNarration[][] = [
  // Scene 0: TitleScene
  [
    { offset: 18, text: "Every year, over 300 million surgeries are performed worldwide where over 10% result in errors traced back to insufficient background with the anatomy or the procedure.", audio: "line-01.mp3" },
  ],
  // Scene 1: ProblemScene
  [
    { offset: 14, text: "Rehearsal has gotten sparse with cadavers becoming increasingly uncommon and simulators cost hundreds of thousands of dollars.", audio: "line-02.mp3" },
  ],
  // Scene 2: FoundersScene
  [
    { offset: 14, text: "Hey I'm Sujal, I'm Aritra, I'm Nik, and I'm Vedant and we built Praxis." },
  ],
  // Scene 3: HeroScene
  [
    { offset: 14, text: "Praxis lets any medical professional simulate a procedure on a hyper-personalized 3D reconstruction of their patient.", audio: "line-04.mp3" },
  ],
  // Scene 4: UploadScene
  [
    { offset: 14, text: "It starts with the patient's CT scan with surface imaging." },
  ],
  // Scene 5: ReconstructScene
  [
    { offset: 14, text: "Our modeling pipeline uses K2 thinking agents to generate a 3D reconstruction built entirely around that individual's anatomy.", audio: "line-06.mp3" },
  ],
  // Scene 6: HandTrackingScene
  [
    { offset: 14, text: "From there, the surgeon uses natural hand tracking to move through the model and determine what they want to simulate.", audio: "line-07.mp3" },
  ],
  // Scene 7: DemoAgentScene
  [],
  // Scene 8: AIScene
  [
    { offset: 14, text: "The orchestration layer generates a live annotated simulation showing exactly how that procedure plays out on this body, where the risk is, and what this person's anatomy changes about the approach.", audio: "line-08.mp3" },
  ],
  // Scene 9: SummaryScene
  [
    { offset: 14, text: "We've already spoken with two surgeons who said this fundamentally changes how they think about preparation especially for procedures they haven't performed in months.", audio: "line-09.mp3" },
  ],
  // Scene 10: ClosingScene
  [
    { offset: 14, text: "We are making that familiarity accessible to every medical professional before they operate and in doing so, we believe Praxis will save millions of lives.", audio: "line-10.mp3" },
  ],
];

// ─── COMPONENT ─────────────────────────────────────────────────────────────────

const FADE_FRAMES = 10;

interface ResolvedEntry {
  from: number;          // absolute global frame the audio starts
  audioDuration: number; // actual clip/subtitle length in frames
  text: string;
  style?: SubtitleStyle;
  audio?: string | null;
}

interface Props {
  clipFromFrames: number[]; // absolute start frame per clip, no-overlap guaranteed
  audioDurations: number[]; // clip length in frames
  audioFiles: (string | null)[]; // resolved audio file per clip, if any
}

export const Subtitles: React.FC<Props> = ({ clipFromFrames, audioDurations, audioFiles }) => {
  const frame = useCurrentFrame();

  // Build resolved entries directly from pre-computed, no-overlap frame positions
  const allClips = SCENE_NARRATIONS.flat();
  const entries: ResolvedEntry[] = allClips.map((clip, i) => ({
    from: clipFromFrames[i] ?? 0,
    audioDuration: audioDurations[i] ?? 150,
    text: clip.text,
    style: clip.style,
    audio: audioFiles[i] ?? null,
  }));

  // Audio tracks — no durationInFrames so the clip plays to its natural end
  const audioTracks = entries.map((entry, i) => (
    entry.audio ? (
      <Sequence key={`audio-${i}`} from={entry.from}>
        <Audio src={staticFile(`narration/${entry.audio}`)} />
      </Sequence>
    ) : null
  ));

  // Subtitle display
  const active = entries.filter(
    (e) => frame >= e.from - FADE_FRAMES && frame <= e.from + e.audioDuration + FADE_FRAMES
  );

  if (active.length === 0) return <>{audioTracks}</>;

  const entry = active[active.length - 1];
  const audioEnd = entry.from + entry.audioDuration;

  const opacity = interpolate(
    frame,
    [entry.from - FADE_FRAMES, entry.from, audioEnd - FADE_FRAMES, audioEnd],
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
        fontSize: 30,
        fontWeight: 400,
        color: "#e8c87a",
        letterSpacing: "-0.02em",
        textShadow: "0 0 40px rgba(232,200,122,0.4)",
      }
      : style === "whisper"
        ? {
          fontFamily: serif,
          fontSize: 22,
          fontStyle: "italic",
          color: "rgba(245,240,230,0.72)",
          letterSpacing: "0.01em",
        }
        : {
          fontFamily: serif,
          fontSize: 28,
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
            padding: "16px 44px",
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
                width: 34,
                height: 1,
                background: "rgba(232,200,122,0.4)",
                margin: "0 auto 8px",
              }}
            />
          )}
          <span style={textStyle}>{entry.text}</span>
        </div>
      </div>
    </>
  );
};
