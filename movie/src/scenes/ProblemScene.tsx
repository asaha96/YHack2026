import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fade, spr } from "../constants";

export const ProblemScene: React.FC = () => {
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

  const tiles = [50, 65, 80, 95, 110];

  return (
    <AbsoluteFill style={{ padding: "80px 100px", opacity }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 28,
          height: "100%",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 260,
            height: 18,
            borderRadius: 999,
            background: "rgba(47,39,31,0.06)",
            opacity: fade(frame, 6, 25),
            transform: `translateY(${interpolate(fade(frame, 6, 25), [0, 1], [12, 0])}px)`,
          }}
        />

        <div
          style={{
            width: 420,
            height: 72,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${C.ember}33, ${C.sage}22)`,
            opacity: fade(frame, 10, 35),
            transform: `translateY(${interpolate(
              spr(frame, fps, 10, 18, 130, 0.85),
              [0, 1],
              [30, 0]
            )}px)`,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            maxWidth: 700,
            opacity: fade(frame, 30, 60),
            transform: `translateY(${interpolate(
              spr(frame, fps, 30, 18, 120, 0.88),
              [0, 1],
              [20, 0]
            )}px)`,
          }}
        >
          <div
            style={{
              width: "100%",
              height: 22,
              borderRadius: 999,
              background: "rgba(47,39,31,0.08)",
            }}
          />
          <div
            style={{
              width: "72%",
              height: 22,
              borderRadius: 999,
              background: "rgba(47,39,31,0.05)",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            marginTop: 20,
          }}
        >
          {tiles.map((delay, index) => {
            const progress = spr(frame, fps, delay, 16, 130, 0.88);
            const y = interpolate(progress, [0, 1], [20, 0]);
            const o = fade(frame, delay, delay + 22);

            return (
              <div
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "14px 20px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.6)",
                  border: `1px solid ${C.line}`,
                  boxShadow: `0 8px 24px ${C.shadow}`,
                  opacity: o,
                  transform: `translateY(${y}px)`,
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: index % 2 === 0 ? `${C.ember}44` : `${C.sage}44`,
                  }}
                />
                <div
                  style={{
                    width: 170,
                    height: 12,
                    borderRadius: 999,
                    background: "rgba(47,39,31,0.07)",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
