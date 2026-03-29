/**
 * Intro.tsx — Main composition orchestrator.
 *
 * Scene timeline (all frames at 30fps):
 *   0    – 200  TitleScene        "Meet Praxis"
 *   200  – 400  ProblemScene      "Planning is still fragmented"
 *   400  – 600  UploadScene       App demo: upload CT scan
 *   600  – 800  ReconstructScene  App demo: 3D reconstruction
 *   800  – 1000 HandTrackingScene App demo: hand gesture simulation
 *   1000 – 1200 AIScene           App demo: AI guidance chat
 *   1200 – 1400 SummaryScene      App demo: surgical summary export
 *   1400 – 1600 HeroScene         Full platform board
 *   1600 – 1800 ClosingScene      Praxis wordmark + CTA
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

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const globalOpacity = fade(frame, 1770, 1800, 1, 0);

  return (
    <AbsoluteFill style={{ opacity: globalOpacity }}>
      {/* Persistent background — always visible */}
      <SoftBackground />
      <Atmosphere />

      {/* ── Scenes ─────────────────────────────────────────────────── */}
      <Sequence from={0} durationInFrames={200}>
        <TitleScene />
      </Sequence>

      <Sequence from={200} durationInFrames={200}>
        <ProblemScene />
      </Sequence>

      <Sequence from={400} durationInFrames={200}>
        <UploadScene />
      </Sequence>

      <Sequence from={600} durationInFrames={200}>
        <ReconstructScene />
      </Sequence>

      <Sequence from={800} durationInFrames={200}>
        <HandTrackingScene />
      </Sequence>

      <Sequence from={1000} durationInFrames={200}>
        <AIScene />
      </Sequence>

      <Sequence from={1200} durationInFrames={200}>
        <SummaryScene />
      </Sequence>

      <Sequence from={1400} durationInFrames={200}>
        <HeroScene />
      </Sequence>

      <Sequence from={1600} durationInFrames={200}>
        <ClosingScene />
      </Sequence>

      {/* ── Subtitles (global frame, outside any Sequence) ──────── */}
      <Subtitles />

      {/* ── Background music ────────────────────────────────────── */}
      <Audio src={staticFile("music.mp3")} volume={0.18} />
    </AbsoluteFill>
  );
};
