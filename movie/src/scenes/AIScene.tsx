import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fade, serif, spr } from "../constants";
import { Eyebrow } from "../components/Typography";
import type { VideoSceneProps } from "../Intro";
import { VideoDropIn, AIMock } from "../components/VideoDropIn";
import { VIDEO_SOURCES } from "../videoSources";
import { PetPenguin, SparkleOverlay } from "../components/PetOverlay";

// Local frame: 0 → 180 (6s)
export const AIScene: React.FC<VideoSceneProps> = ({ videoPlaybackRate }) => {
  const frame = useCurrentFrame();
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
          <Eyebrow text="Step 04 · Guidance" />
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
          Ask for guidance inside the workflow.
        </p>

        <div
          style={{
            transform: `translateY(${panelY}px)`,
            opacity: fade(frame, 18, 52),
          }}
        >
          <VideoDropIn
            windowTitle="praxis — AI surgical guidance · case 4471-B"
            stepLabel="STEP 04 · AI GUIDANCE"
            scale={0.86}
            videoSrc={VIDEO_SOURCES[5]?.src}
            playbackRate={videoPlaybackRate ?? undefined}
            overlayContent={
              <>
                <PetPenguin
                  enterDelay={45}
                  speech="I read 40,000 anatomy papers"
                />
                <SparkleOverlay count={4} />
              </>
            }
          >
            <AIMock />
          </VideoDropIn>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
