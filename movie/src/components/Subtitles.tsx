import React from "react";
import { Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { serif } from "../constants";

export type SubtitleStyle = "normal" | "punchline" | "whisper";

export interface SceneNarration {
  offset: number; // frames from the scene's start frame
  text: string;
  style?: SubtitleStyle;
  audio: string;  // filename inside public/narration/
}

// ─── NARRATION SCRIPT ─────────────────────────────────────────────────────────
// Offsets are relative to each scene's start frame (not global).
// calculateMetadata in Root.tsx measures each audio file and sets scene
// durations so every scene lasts exactly as long as its longest audio clip.
export const SCENE_NARRATIONS: SceneNarration[][] = [
  // Scene 0: TitleScene
  [
    { offset: 18,  text: "Meet Praxis.", style: "punchline", audio: "line-01.mp3" },
    { offset: 98,  text: "The workspace for patient-specific surgical planning and rehearsal.", audio: "line-02.mp3" },
  ],
  // Scene 1: ProblemScene
  [
    { offset: 14,  text: "Today, surgeons plan from flat scans, disconnected tools, and mental reconstruction.", audio: "line-03.mp3" },
    { offset: 114, text: "That means less certainty before incision and fewer chances to rehearse the exact case.", audio: "line-04.mp3" },
  ],
  // Scene 2: UploadScene
  [
    { offset: 14,  text: "Praxis starts with the scan the team already has.", style: "punchline", audio: "line-05.mp3" },
    { offset: 92,  text: "Upload CT or MRI data, and Praxis organizes the case in seconds.", audio: "line-06.mp3" },
  ],
  // Scene 3: ReconstructScene
  [
    { offset: 14,  text: "Praxis converts image slices into an interactive 3D anatomy model.", audio: "line-07.mp3" },
    { offset: 110, text: "Now the team can inspect organs, vessels, and spatial risk before entering the OR.", audio: "line-08.mp3" },
  ],
  // Scene 4: HandTrackingScene
  [
    { offset: 14,  text: "Then surgeons rehearse the procedure with natural hand tracking.", audio: "line-09.mp3" },
    { offset: 106, text: "They can trace an approach, explore anatomy, and simulate decisions on real patient geometry.", audio: "line-10.mp3" },
  ],
  // Scene 5: AIScene
  [
    { offset: 14,  text: "Need support mid-plan? Ask the built-in surgical copilot.", style: "punchline", audio: "line-11.mp3" },
    { offset: 92,  text: "It explains structures, answers workflow questions, and keeps the team moving.", audio: "line-12.mp3" },
  ],
  // Scene 6: SummaryScene
  [
    { offset: 14,  text: "When planning is done, Praxis exports a clear surgical summary.", audio: "line-13.mp3" },
    { offset: 96,  text: "Teams can share risks, steps, and findings with attendings and collaborators.", audio: "line-14.mp3" },
  ],
  // Scene 7: HeroScene
  [
    { offset: 14,  text: "One platform for imaging, simulation, guidance, and communication.", audio: "line-15.mp3" },
    { offset: 100, text: "So preparation happens before the operating room, not inside it.", audio: "line-16.mp3" },
  ],
  // Scene 8: ClosingScene
  [
    { offset: 20,  text: "Praxis.", style: "punchline", audio: "line-17.mp3" },
    { offset: 96,  text: "See the patient. Rehearse the case. Walk in ready.", audio: "line-18.mp3" },
  ],
];

// ─── COMPONENT ─────────────────────────────────────────────────────────────────

const FADE_FRAMES = 10;

interface ResolvedEntry {
  from: number;          // absolute global frame the audio starts
  audioDuration: number; // actual clip length in frames
  text: string;
  style?: SubtitleStyle;
  audio: string;
}

interface Props {
  clipFromFrames: number[]; // absolute start frame per clip (18 total), no-overlap guaranteed
  audioDurations: number[]; // clip length in frames (18 total)
}

export const Subtitles: React.FC<Props> = ({ clipFromFrames, audioDurations }) => {
  const frame = useCurrentFrame();

  // Build resolved entries directly from pre-computed, no-overlap frame positions
  const allClips = SCENE_NARRATIONS.flat();
  const entries: ResolvedEntry[] = allClips.map((clip, i) => ({
    from: clipFromFrames[i] ?? 0,
    audioDuration: audioDurations[i] ?? 150,
    text: clip.text,
    style: clip.style,
    audio: clip.audio,
  }));

  // Audio tracks — no durationInFrames so the clip plays to its natural end
  const audioTracks = entries.map((entry, i) => (
    <Sequence key={`audio-${i}`} from={entry.from}>
      <Audio src={staticFile(`narration/${entry.audio}`)} />
    </Sequence>
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
