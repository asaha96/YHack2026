import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { fade, spr } from "../constants";
import { VideoDropIn, HandTrackMock } from "../components/VideoDropIn";

// Scene 5: Hand tracking — rehearse with hands, webcam-based
export const HandTrackingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const fadeIn = fade(frame, 0, 30);
  const fadeOut = fade(
    frame,
    Math.max(0, durationInFrames - 30),
    durationInFrames,
    1,
    0
  );
  const opacity = fadeIn * fadeOut;

  const panelY = interpolate(
    spr(frame, fps, 18, 16, 130, 0.88),
    [0, 1],
    [50, 0]
  );

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          display: "flex",
          paddingTop: 24,
        }}
      >
        <div
          style={{
            transform: `translateY(${panelY}px)`,
            opacity: fade(frame, 16, 45),
          }}
        >
          <VideoDropIn
            windowTitle="praxis — hand tracking"
            scale={0.82}
          >
            <HandTrackMock />
          </VideoDropIn>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
