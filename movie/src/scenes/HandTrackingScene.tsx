import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fade, serif, spr } from "../constants";
import { Eyebrow } from "../components/Typography";
import { VideoDropIn, HandTrackMock } from "../components/VideoDropIn";
import { VIDEO_SOURCES } from "../videoSources";
import { PetBunny, SparkleOverlay } from "../components/PetOverlay";

// Local frame: 0 → 180 (6s)
export const HandTrackingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const slot = VIDEO_SOURCES[4];
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = fade(frame, 0, 40);
  const fadeOut = fade(frame, durationInFrames - 40, durationInFrames, 1, 0);
  const opacity = fadeIn * fadeOut;

  const panelY = interpolate(
    spr(frame, fps, 20, 18, 120, 0.9),
    [0, 1],
    [60, 0]
  );

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill
        style={{
          padding: "60px 0 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        <div
          style={{
            opacity: fade(frame, 10, 40),
            transform: `translateY(${interpolate(fade(frame, 10, 40), [0, 1], [16, 0])}px)`,
          }}
        >
          <Eyebrow text="Step 03 · Simulate" />
        </div>

        <p
          style={{
            margin: 0,
            fontFamily: serif,
            fontSize: 48,
            lineHeight: 1.0,
            letterSpacing: "-0.05em",
            color: C.ink,
            textAlign: "center",
            opacity: fade(frame, 14, 48),
          }}
        >
          Rehearse with natural hand tracking.
          <br />
          <span style={{ color: C.inkSoft, fontSize: 36 }}>Explore the case before the room goes live.</span>
        </p>

        <div
          style={{
            transform: `translateY(${panelY}px)`,
            opacity: fade(frame, 18, 52),
          }}
        >
          <VideoDropIn
            windowTitle="praxis — simulate · hand tracking active"
            stepLabel="STEP 03 · GESTURE SIMULATION"
            scale={0.86}
            videoSrc={slot?.src}
            videoDurationInSeconds={slot?.durationInSeconds}
            overlayContent={
              <>
                <PetBunny
                  enterDelay={55}
                  speech="my hands also do this"
                />
                <SparkleOverlay count={3} />
              </>
            }
          >
            <HandTrackMock />
          </VideoDropIn>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
