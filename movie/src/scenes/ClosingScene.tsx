import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fade, mono, serif, spr } from "../constants";
import { PraxisWordmark } from "../components/Typography";
import { SparkleOverlay } from "../components/PetOverlay";

// Local frame: 0 → 150 (5s)
export const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = fade(frame, 0, 50);
  const logoY = interpolate(
    spr(frame, fps, 4, 18, 120, 0.88),
    [0, 1],
    [24, 0]
  );

  const taglineOpacity = fade(frame, 40, 80);
  const taglineY = interpolate(
    spr(frame, fps, 44, 18, 110, 0.9),
    [0, 1],
    [16, 0]
  );

  const ctaOpacity = fade(frame, 80, 116);
  const ctaY = interpolate(
    spr(frame, fps, 84, 18, 100, 0.92),
    [0, 1],
    [14, 0]
  );

  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", opacity: appear }}
    >
      {/* Subtle sparkles in background */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
        <SparkleOverlay count={8} />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
          transform: `translateY(${logoY}px)`,
          zIndex: 1,
        }}
      >
        {/* Compact Praxis wordmark */}
        <PraxisWordmark compact />

        {/* Divider */}
        <div
          style={{
            width: 120,
            height: 1,
            background: "rgba(23,19,17,0.18)",
          }}
        />

        {/* Tagline */}
        <p
          style={{
            margin: 0,
            fontFamily: mono,
            fontSize: 13,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.inkMuted,
            opacity: taglineOpacity,
            transform: `translateY(${taglineY}px)`,
          }}
        >
          AI-guided surgical simulation
        </p>

        {/* CTA */}
        <p
          style={{
            margin: 0,
            fontFamily: serif,
            fontSize: 28,
            letterSpacing: "-0.03em",
            color: C.inkSoft,
            fontStyle: "italic",
            opacity: ctaOpacity,
            transform: `translateY(${ctaY}px)`,
            textAlign: "center",
          }}
        >
          Practice makes perfect.
          <br />
          <span style={{ color: C.ember }}>Now you can practice.</span>
        </p>

        {/* Small ornament */}
        <div
          style={{
            opacity: ctaOpacity * 0.5,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ width: 32, height: 1, background: C.accentSoft }} />
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: C.accentSoft,
            }}
          />
          <div style={{ width: 32, height: 1, background: C.accentSoft }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
