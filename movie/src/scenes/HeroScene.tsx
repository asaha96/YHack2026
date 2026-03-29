import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fade, serif, spr } from "../constants";
import { Eyebrow } from "../components/Typography";
import { Board } from "../components/AnatomyUI";
import type { VideoSceneProps } from "../Intro";
import { VideoDropIn } from "../components/VideoDropIn";
import { VIDEO_SOURCES } from "../videoSources";

// Local frame: 0 → 180 (6s)
export const HeroScene: React.FC<VideoSceneProps> = ({ videoPlaybackRate }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = fade(frame, 0, 50);
  const disappear = fade(frame, 130, 180, 1, 0);
  const opacity = appear * disappear;

  const boardLift = interpolate(
    spr(frame, fps, 8, 18, 120, 0.92),
    [0, 1],
    [48, 0]
  );
  const cameraScale = interpolate(frame, [10, 120], [0.94, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity, alignItems: "center", justifyContent: "center" }}>

      {/* Top-left label */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 96,
          zIndex: 3,
          opacity: fade(frame, 20, 55),
        }}
      >
        <Eyebrow text="One workflow from scan to plan" />
      </div>

      {/* Headline floats above board */}
      <div
        style={{
          position: "absolute",
          top: 68,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: fade(frame, 22, 60),
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: serif,
            fontSize: 52,
            letterSpacing: "-0.055em",
            color: C.ink,
            textAlign: "center",
          }}
        >
          One place to prepare the case.
        </p>
      </div>

      {/* Main stage */}
      <div
        style={{
          transform: `translateY(${boardLift}px) scale(${cameraScale})`,
          marginTop: 60,
        }}
      >
        <VideoDropIn
          windowTitle="praxis — main workspace"
          stepLabel="MAIN WORKSPACE"
          scale={1}
          videoSrc={VIDEO_SOURCES[3]?.src}
          playbackRate={videoPlaybackRate ?? undefined}
        >
          <Board />
        </VideoDropIn>
      </div>
    </AbsoluteFill>
  );
};
