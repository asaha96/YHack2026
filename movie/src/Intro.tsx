/**
 * Intro.tsx — Main composition orchestrator.
 *
 * Scene timeline (all frames at 30fps — revised flow):
 *   1. title        Problem cold open — hard numbers, no product name
 *   2. problem      Solution intro — "This is Praxis" + feature list
 *   3. upload       Demo: drop in DICOM scans
 *   4. reconstruct  Demo: 3D reconstruction — exact patient replica
 *   5. handTracking Demo: webcam hand tracking rehearsal
 *   6. ai           Demo: simulations + AI guidance
 *   7. summary      Demo: export surgical plan
 *   8. hero         Traction & credibility — surgeon feedback, roadmap
 *   9. closing      Praxis wordmark + "built by surgeons, for surgeons"
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
