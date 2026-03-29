/**
 * Intro.tsx — Main composition orchestrator.
 *
 * Scene durations are computed dynamically in Root.tsx via calculateMetadata,
 * which measures each audio file and sizes every scene to match its longest clip.
 * The scene/clip data lives in Subtitles.tsx (SCENE_NARRATIONS).
 */

import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { fade } from "./constants";
import { SoftBackground, Atmosphere } from "./components/Background";
import { Subtitles } from "./components/Subtitles";
import { TitleScene } from "./scenes/TitleScene";
import { ProblemScene } from "./scenes/ProblemScene";
import { UploadScene } from "./scenes/UploadScene";
import { ReconstructScene } from "./scenes/ReconstructScene";
import { HandTrackingScene } from "./scenes/HandTrackingScene";
import { AIScene } from "./scenes/AIScene";
import { SummaryScene } from "./scenes/SummaryScene";
import { HeroScene } from "./scenes/HeroScene";
import { ClosingScene } from "./scenes/ClosingScene";

export interface IntroProps {
  sceneStarts: number[];    // absolute start frame for each of the 9 scenes
  sceneDurations: number[]; // duration in frames for each scene
  audioDurations: number[]; // actual audio clip lengths in frames (18 clips, flattened)
}

const SCENE_COMPONENTS = [
  TitleScene,
  ProblemScene,
  UploadScene,
  ReconstructScene,
  HandTrackingScene,
  AIScene,
  SummaryScene,
  HeroScene,
  ClosingScene,
];

export const Intro: React.FC<IntroProps> = ({ sceneStarts, sceneDurations, audioDurations }) => {
  const frame = useCurrentFrame();

  const lastSceneIdx = sceneStarts.length - 1;
  const totalFrames = sceneStarts[lastSceneIdx] + sceneDurations[lastSceneIdx];
  const globalOpacity = fade(frame, totalFrames - 30, totalFrames, 1, 0);

  return (
    <AbsoluteFill style={{ opacity: globalOpacity }}>
      {/* Persistent background — always visible */}
      <SoftBackground />
      <Atmosphere />

      {/* ── Scenes — each sized to match its audio ─────────────────── */}
      {SCENE_COMPONENTS.map((SceneComponent, i) => (
        <Sequence key={i} from={sceneStarts[i]} durationInFrames={sceneDurations[i]}>
          <SceneComponent />
        </Sequence>
      ))}

      {/* ── Subtitles (global frame, outside any Sequence) ──────────── */}
      <Subtitles sceneStarts={sceneStarts} audioDurations={audioDurations} />

      {/* ── Background music ─────────────────────────────────────────── */}
      <Audio src={staticFile("music.mp3")} volume={0.18} />
    </AbsoluteFill>
  );
};
