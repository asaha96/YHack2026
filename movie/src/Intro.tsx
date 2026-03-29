/**
 * Intro.tsx — Main composition orchestrator.
 *
 * Scene timeline (all frames at 30fps):
 *   0    – 180  TitleScene        "Meet Praxis"
 *   180  – 360  ProblemScene      "Surgery prep is broken"
 *   360  – 540  UploadScene       App demo: upload CT scan
 *   540  – 720  ReconstructScene  App demo: 3D reconstruction
 *   720  – 900  HandTrackingScene App demo: hand gesture simulation
 *   900  – 1080 AIScene           App demo: AI guidance chat
 *   1080 – 1260 SummaryScene      App demo: PDF export
 *   1260 – 1440 HeroScene         Full platform board
 *   1440 – 1590 ClosingScene      Praxis wordmark + CTA
 *
 * Each scene fades in/out independently within its Sequence.
 * Subtitles are global — they see the full timeline frame number.
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
import type { SceneId, TimelineData } from "./timeline";

const SCENE_COMPONENTS: Record<SceneId, React.FC> = {
  title: TitleScene,
  problem: ProblemScene,
  upload: UploadScene,
  reconstruct: ReconstructScene,
  handTracking: HandTrackingScene,
  ai: AIScene,
  summary: SummaryScene,
  hero: HeroScene,
  closing: ClosingScene,
};

export const Intro: React.FC<{ timeline: TimelineData }> = ({ timeline }) => {
  const frame = useCurrentFrame();
  const globalOpacity = fade(
    frame,
    Math.max(0, timeline.durationInFrames - 30),
    timeline.durationInFrames,
    1,
    0
  );

  return (
    <AbsoluteFill style={{ opacity: globalOpacity }}>
      {/* Persistent background — always visible */}
      <SoftBackground />
      <Atmosphere />

      {/* ── Scenes ─────────────────────────────────────────────────── */}
      {timeline.scenes.map((scene) => {
        const SceneComponent = SCENE_COMPONENTS[scene.id];
        return (
          <Sequence
            key={scene.id}
            from={scene.from}
            durationInFrames={scene.durationInFrames}
          >
            <SceneComponent />
          </Sequence>
        );
      })}

      {/* ── Subtitles (global frame, outside any Sequence) ──────── */}
      <Subtitles entries={timeline.subtitles} />

      {/* ── Background music ────────────────────────────────────── */}
      <Audio src={staticFile("music.mp3")} volume={0.10} />
    </AbsoluteFill>
  );
};
