import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fade, mono, serif, spr } from "../constants";
import { Eyebrow } from "../components/Typography";
import { Board } from "../components/AnatomyUI";

// Local frame: 0 → 180 (6s)
export const HeroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const appear = fade(frame, 0, 50);
  const disappear = fade(
    frame,
    Math.max(0, durationInFrames - 50),
    durationInFrames,
    1,
    0
  );
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
        <Eyebrow text="Everything in one platform" />
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
          Workflow · Anatomy · Guidance
        </p>
      </div>

      {/* The board */}
      <div
        style={{
          transform: `translateY(${boardLift}px) scale(${cameraScale})`,
          marginTop: 60,
        }}
      >
        <Board />
      </div>
    </AbsoluteFill>
  );
};
