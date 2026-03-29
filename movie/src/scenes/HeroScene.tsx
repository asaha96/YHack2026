import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fade, spr } from "../constants";

export const HeroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const appear = fade(frame, 0, 40);
  const disappear = fade(
    frame,
    Math.max(0, durationInFrames - 40),
    durationInFrames,
    1,
    0
  );
  const opacity = appear * disappear;

  const cards = [
    { color: C.ember, delay: 15 },
    { color: C.sage, delay: 28 },
  ];

  return (
    <AbsoluteFill style={{ opacity, padding: "80px 100px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 28, height: "100%" }}>
        <div
          style={{
            width: 140,
            height: 14,
            borderRadius: 999,
            background: `${C.sage}33`,
            opacity: fade(frame, 4, 22),
          }}
        />

        <div style={{ display: "flex", gap: 32 }}>
          {cards.map((card, index) => {
            const progress = spr(frame, fps, card.delay, 16, 140, 0.82);
            const y = interpolate(progress, [0, 1], [40, 0]);
            const o = fade(frame, card.delay, card.delay + 22);

            return (
              <div
                key={index}
                style={{
                  width: 280,
                  padding: "28px 36px",
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.65)",
                  border: `2px solid ${card.color}22`,
                  boxShadow: `0 12px 36px ${C.shadow}`,
                  opacity: o,
                  transform: `translateY(${y}px)`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 96,
                    height: 64,
                    borderRadius: 24,
                    background: `${card.color}33`,
                  }}
                />
                <div
                  style={{
                    width: "75%",
                    height: 12,
                    borderRadius: 999,
                    background: "rgba(47,39,31,0.07)",
                  }}
                />
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 16,
            opacity: fade(frame, 70, 100),
            transform: `translateY(${interpolate(
              spr(frame, fps, 70, 18, 120, 0.88),
              [0, 1],
              [20, 0]
            )}px)`,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            maxWidth: 780,
          }}
        >
          <div
            style={{
              width: "100%",
              height: 24,
              borderRadius: 999,
              background: "rgba(47,39,31,0.08)",
            }}
          />
          <div
            style={{
              width: "44%",
              height: 12,
              borderRadius: 999,
              background: "rgba(47,39,31,0.05)",
            }}
          />
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              width: 56,
              height: 10,
              borderRadius: 999,
              background: "rgba(47,39,31,0.05)",
              opacity: fade(frame, 120, 145),
            }}
          />
          {[130, 140, 150].map((delay, index) => (
            <div
              key={index}
              style={{
                width: 170,
                height: 42,
                borderRadius: 10,
                background: "rgba(255,255,255,0.5)",
                border: `1px solid ${C.line}`,
                opacity: fade(frame, delay, delay + 18),
              }}
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
