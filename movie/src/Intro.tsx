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
import { FoundersScene } from "./scenes/FoundersScene";
import { HeroScene } from "./scenes/HeroScene";
import { UploadScene } from "./scenes/UploadScene";
import { ReconstructScene } from "./scenes/ReconstructScene";
import { HandTrackingScene } from "./scenes/HandTrackingScene";
import { DemoAgentScene } from "./scenes/DemoAgentScene";
import { AIScene } from "./scenes/AIScene";
import { SummaryScene } from "./scenes/SummaryScene";
import { ClosingScene } from "./scenes/ClosingScene";

export interface IntroProps {
  sceneStarts: number[];             // absolute start frame for each scene
  sceneDurations: number[];          // duration in frames for each scene
  clipFromFrames: number[];          // absolute start frame per clip
  audioDurations: number[];          // audio clip length in frames
  clipAudioFiles: (string | null)[]; // external audio file per clip, if any
  videoPlaybackRates: (number | null)[]; // per scene: rate to fill scene exactly, or null
  resolvedVideoSrcs: (string | null)[];
  sceneUsesEmbeddedAudio: boolean[];
}

export interface VideoSceneProps {
  /** Pre-computed playbackRate (video_duration / scene_duration). Null → show mock. */
  videoPlaybackRate: number | null;
  /** Video file that successfully resolved at metadata time. */
  videoSrc: string | null;
}

export const Intro: React.FC<IntroProps> = ({
  sceneStarts,
  sceneDurations,
  clipFromFrames,
  audioDurations,
  clipAudioFiles,
  videoPlaybackRates,
  resolvedVideoSrcs,
  sceneUsesEmbeddedAudio,
}) => {
  const frame = useCurrentFrame();

  const lastIdx = sceneStarts.length - 1;
  const totalFrames = sceneStarts[lastIdx] + sceneDurations[lastIdx];
  const globalOpacity = fade(frame, totalFrames - 30, totalFrames, 1, 0);
  const activeSceneIdx = sceneStarts.findIndex((start, i) => {
    const end = start + (sceneDurations[i] ?? 0);
    return frame >= start && frame < end;
  });
  const shouldDuckMusic = activeSceneIdx >= 0 ? (sceneUsesEmbeddedAudio[activeSceneIdx] ?? false) : false;

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
      {seq(0, <TitleScene videoPlaybackRate={videoPlaybackRates[0]} videoSrc={resolvedVideoSrcs[0]} />)}
      {seq(1, <ProblemScene videoPlaybackRate={videoPlaybackRates[1]} videoSrc={resolvedVideoSrcs[1]} />)}
      {seq(2, <FoundersScene videoSrc={resolvedVideoSrcs[2]} />)}
      {seq(3, <HeroScene         videoPlaybackRate={videoPlaybackRates[3]} videoSrc={resolvedVideoSrcs[3]} />)}
      {seq(4, <UploadScene       videoPlaybackRate={videoPlaybackRates[4]} videoSrc={resolvedVideoSrcs[4]} />)}
      {seq(5, <ReconstructScene  videoPlaybackRate={videoPlaybackRates[5]} videoSrc={resolvedVideoSrcs[5]} />)}
      {seq(6, <HandTrackingScene videoPlaybackRate={videoPlaybackRates[6]} videoSrc={resolvedVideoSrcs[6]} />)}
      {seq(7, <DemoAgentScene    videoPlaybackRate={videoPlaybackRates[7]} videoSrc={resolvedVideoSrcs[7]} />)}
      {seq(8, <AIScene           videoPlaybackRate={videoPlaybackRates[8]} videoSrc={resolvedVideoSrcs[8]} />)}
      {seq(9, <SummaryScene      videoPlaybackRate={videoPlaybackRates[9]} videoSrc={resolvedVideoSrcs[9]} />)}
      {seq(10, <ClosingScene />)}

      {/* ── Subtitles (global frame, outside any Sequence) ──────────────────── */}
      <Subtitles clipFromFrames={clipFromFrames} audioDurations={audioDurations} audioFiles={clipAudioFiles} />

      {/* ── Background music ─────────────────────────────────────────────────── */}
      <Audio src={staticFile("music.mp3")} volume={shouldDuckMusic ? 0 : 0.18} />
    </AbsoluteFill>
  );
};
