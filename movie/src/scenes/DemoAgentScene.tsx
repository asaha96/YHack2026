import React from "react";
import { AbsoluteFill, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fade, spr } from "../constants";
import type { VideoSceneProps } from "../Intro";

export const DemoAgentScene: React.FC<VideoSceneProps> = ({ videoPlaybackRate, videoSrc }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = fade(frame, 0, 20);
  const fadeOut = fade(frame, durationInFrames - 24, durationInFrames, 1, 0);
  const opacity = fadeIn * fadeOut;
  const panelY = interpolate(spr(frame, fps, 4, 16, 110, 0.9), [0, 1], [32, 0]);

  return (
    <AbsoluteFill style={{ opacity, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          transform: `translateY(${panelY}px)`,
          width: 1480,
          height: 832.5,
          maxWidth: "92%",
          maxHeight: "84%",
          borderRadius: 28,
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.18)",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        {videoSrc ? (
          <OffthreadVideo
            src={staticFile(videoSrc)}
            playbackRate={videoPlaybackRate === 1 ? 1 : (videoPlaybackRate ?? 1)}
            style={{ width: "100%", height: "100%", objectFit: "contain", backgroundColor: "transparent" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%" }} />
        )}
      </div>
    </AbsoluteFill>
  );
};
