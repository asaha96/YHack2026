import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fade, serif, spr } from "../constants";
import { Eyebrow } from "../components/Typography";
import { VideoDropIn, UploadMock } from "../components/VideoDropIn";
import { PetCat, SparkleOverlay } from "../components/PetOverlay";

// Local frame: 0 → 180 (6s)
export const UploadScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = fade(frame, 0, 40);
  const fadeOut = fade(frame, 140, 180, 1, 0);
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
        {/* Step label */}
        <div
          style={{
            opacity: fade(frame, 10, 40),
            transform: `translateY(${interpolate(fade(frame, 10, 40), [0, 1], [16, 0])}px)`,
          }}
        >
          <Eyebrow text="Step 01 · Upload" />
        </div>

        {/* Headline */}
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
          Start with the imaging data you already have.
        </p>

        {/* Video frame */}
        <div
          style={{
            transform: `translateY(${panelY}px)`,
            opacity: fade(frame, 18, 52),
          }}
        >
          <VideoDropIn
            windowTitle="praxis — upload · case 4471-B"
            stepLabel="STEP 01 · DICOM UPLOAD"
            scale={0.86}
            overlayContent={
              <>
                <PetCat
                  enterDelay={60}
                  speech="nom nom CT scan data"
                />
                <SparkleOverlay count={4} />
              </>
            }
          >
            <UploadMock />
          </VideoDropIn>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
