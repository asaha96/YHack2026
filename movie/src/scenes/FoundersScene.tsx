import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fade, mono, serif, spr } from "../constants";
import { VideoDropIn } from "../components/VideoDropIn";

const FOUNDERS = [
  { name: "Sujal", top: 88, left: 180 },
  { name: "Aritra", top: 168, right: 180 },
  { name: "Nik", bottom: 186, left: 220 },
  { name: "Vedant", bottom: 108, right: 210 },
] as const;

export const FoundersScene: React.FC<{ videoSrc: string | null }> = ({ videoSrc }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = fade(frame, 0, 36);
  const fadeOut = fade(frame, durationInFrames - 42, durationInFrames, 1, 0);
  const opacity = fadeIn * fadeOut;

  const videoRise = interpolate(
    spr(frame, fps, 12, 18, 120, 0.9),
    [0, 1],
    [36, 0]
  );

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          fontFamily: mono,
          fontSize: 13,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: C.inkMuted,
          opacity: fade(frame, 10, 36),
        }}
      >
        Meet the team
      </div>

      {FOUNDERS.map((founder, index) => (
        <div
          key={founder.name}
          style={{
            position: "absolute",
            ...founder,
            opacity: fade(frame, 24 + index * 8, 52 + index * 8),
            transform: `translateY(${interpolate(
              spr(frame, fps, 24 + index * 8, 18, 100, 0.9),
              [0, 1],
              [22, 0]
            )}px)`,
          }}
        >
          <div
            style={{
              padding: "14px 22px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.62)",
              border: "1px solid rgba(47,39,31,0.08)",
              boxShadow: "0 18px 40px rgba(34,28,22,0.08)",
              fontFamily: serif,
              fontSize: 38,
              letterSpacing: "-0.04em",
              color: C.ink,
            }}
          >
            {founder.name}
          </div>
        </div>
      ))}

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          transform: `translateY(${videoRise}px)`,
        }}
      >
        <VideoDropIn
          windowTitle="praxis — founders intro"
          stepLabel="TEAM INTRO"
          scale={0.78}
          videoSrc={videoSrc ?? undefined}
          useNativePlayback
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(145deg, rgba(252,250,244,1), rgba(245,240,232,1))",
              fontFamily: serif,
              fontSize: 44,
              letterSpacing: "-0.04em",
              color: C.inkSoft,
            }}
          >
            Drop `movie/public/footage/intro.mp4` here
          </div>
        </VideoDropIn>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
