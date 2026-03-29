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
