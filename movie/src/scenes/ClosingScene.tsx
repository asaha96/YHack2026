import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fade, spr } from "../constants";

export const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = fade(frame, 0, 40);
  const logoY = interpolate(
    spr(frame, fps, 4, 16, 130, 0.88),
    [0, 1],
    [30, 0]
  );

  const detailOpacity = fade(frame, 35, 65);
  const detailY = interpolate(
    spr(frame, fps, 38, 16, 120, 0.9),
    [0, 1],
    [16, 0]
  );

  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", opacity: appear }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
          transform: `translateY(${logoY}px)`,
        }}
      >
        <div
          style={{
            width: 280,
            height: 64,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${C.ember}33, ${C.sage}22)`,
          }}
        />

        <div
          style={{
            width: 80,
            height: 2,
            background: C.ember,
            borderRadius: 1,
            opacity: detailOpacity,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "center",
            opacity: detailOpacity,
            transform: `translateY(${detailY}px)`,
          }}
        >
          <div
            style={{
              width: 420,
              height: 18,
              borderRadius: 999,
              background: "rgba(47,39,31,0.08)",
            }}
          />
          <div
            style={{
              width: 320,
              height: 18,
              borderRadius: 999,
              background: "rgba(47,39,31,0.05)",
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
