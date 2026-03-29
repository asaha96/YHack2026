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

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const globalOpacity = fade(frame, 1560, 1590, 1, 0);

  return (
    <AbsoluteFill style={{ opacity: globalOpacity }}>
      {/* Persistent background — always visible */}
      <SoftBackground />
      <Atmosphere />

      {/* ── Scenes ─────────────────────────────────────────────────── */}
      <Sequence from={0} durationInFrames={210}>
        <TitleScene />
      </Sequence>

      <Sequence from={180} durationInFrames={210}>
        <ProblemScene />
      </Sequence>

      <Sequence from={360} durationInFrames={210}>
        <UploadScene />
      </Sequence>

      <Sequence from={540} durationInFrames={210}>
        <ReconstructScene />
      </Sequence>

      <Sequence from={720} durationInFrames={210}>
        <HandTrackingScene />
      </Sequence>

      <Sequence from={900} durationInFrames={210}>
        <AIScene />
      </Sequence>

      <Sequence from={1080} durationInFrames={210}>
        <SummaryScene />
      </Sequence>

      <Sequence from={1260} durationInFrames={210}>
        <HeroScene />
      </Sequence>

      <Sequence from={1440} durationInFrames={150}>
        <ClosingScene />
      </Sequence>

      {/* ── Subtitles (global frame, outside any Sequence) ──────── */}
      <Subtitles />

      {/* ── Background music ────────────────────────────────────── */}
      <Audio src={staticFile("music.mp3")} volume={0.18} />
    </AbsoluteFill>
  );
};
