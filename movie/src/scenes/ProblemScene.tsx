import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { fade, spr } from "../constants";
import { VideoDropIn } from "../components/VideoDropIn";
import type { VideoSceneProps } from "../Intro";

export const ProblemScene: React.FC<VideoSceneProps> = ({ videoPlaybackRate, videoSrc }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = fade(frame, 0, 34);
  const fadeOut = fade(frame, durationInFrames - 42, durationInFrames, 1, 0);
  const opacity = fadeIn * fadeOut;
  const panelY = interpolate(spr(frame, fps, 10, 18, 120, 0.9), [0, 1], [42, 0]);

  return (
    <AbsoluteFill style={{ opacity, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          transform: `translateY(${panelY}px)`,
          opacity: fade(frame, 10, 42),
        }}
      >
        <VideoDropIn
          scale={0.96}
          videoSrc={videoSrc ?? undefined}
          playbackRate={videoPlaybackRate ?? undefined}
          useNativePlayback={videoPlaybackRate === 1}
        >
          <div style={{ width: "100%", height: "100%" }} />
        </VideoDropIn>
      </div>
    </AbsoluteFill>
  );
};
