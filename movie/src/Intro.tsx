/**
 * Intro.tsx — Main composition orchestrator.
 *
 * Scene durations are computed dynamically in Root.tsx via calculateMetadata,
 * which measures audio and video files. The scene/clip data lives in
 * Subtitles.tsx (SCENE_NARRATIONS) and videoSources.ts (VIDEO_SOURCES).
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
  sceneStarts: number[];             // absolute start frame for each of the 9 scenes
  sceneDurations: number[];          // duration in frames for each scene
  clipFromFrames: number[];          // absolute start frame per clip (18 total)
  audioDurations: number[];          // audio clip length in frames (18 total)
  videoPlaybackRates: (number | null)[]; // per scene: rate to fill scene exactly, or null
}

export interface VideoSceneProps {
  /** Pre-computed playbackRate (video_duration / scene_duration). Null → show mock. */
  videoPlaybackRate: number | null;
}

export const Intro: React.FC<IntroProps> = ({
  sceneStarts,
  sceneDurations,
  clipFromFrames,
  audioDurations,
  videoPlaybackRates,
}) => {
  const frame = useCurrentFrame();

  const lastIdx = sceneStarts.length - 1;
  const totalFrames = sceneStarts[lastIdx] + sceneDurations[lastIdx];
  const globalOpacity = fade(frame, totalFrames - 30, totalFrames, 1, 0);

  const seq = (i: number, children: React.ReactNode) => (
    <Sequence key={i} from={sceneStarts[i]} durationInFrames={sceneDurations[i]}>
      {children}
    </Sequence>
  );

  return (
    <AbsoluteFill style={{ opacity: globalOpacity }}>
      {/* Persistent background — always visible */}
      <SoftBackground />
      <Atmosphere />

      {/* ── Scenes — each sized to match its audio ─────────────────────────── */}
      {seq(0, <TitleScene />)}
      {seq(1, <ProblemScene />)}
      {seq(2, <UploadScene       videoPlaybackRate={videoPlaybackRates[2]} />)}
      {seq(3, <ReconstructScene  videoPlaybackRate={videoPlaybackRates[3]} />)}
      {seq(4, <HandTrackingScene videoPlaybackRate={videoPlaybackRates[4]} />)}
      {seq(5, <AIScene           videoPlaybackRate={videoPlaybackRates[5]} />)}
      {seq(6, <SummaryScene      videoPlaybackRate={videoPlaybackRates[6]} />)}
      {seq(7, <HeroScene />)}
      {seq(8, <ClosingScene />)}

      {/* ── Subtitles (global frame, outside any Sequence) ──────────────────── */}
      <Subtitles clipFromFrames={clipFromFrames} audioDurations={audioDurations} />

      {/* ── Background music ─────────────────────────────────────────────────── */}
      <Audio src={staticFile("music.mp3")} volume={0.18} />
    </AbsoluteFill>
  );
};
