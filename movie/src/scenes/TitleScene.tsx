import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fade, spr } from "../constants";

export const TitleScene: React.FC = () => {
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

  const cards = [
    { width: 420, height: 220, color: C.ember, delay: 6 },
    { width: 360, height: 180, color: C.sage, delay: 20 },
    { width: 360, height: 180, color: C.accent, delay: 34 },
    { width: 420, height: 220, color: "#d64545", delay: 90 },
  ];

  return (
    <AbsoluteFill style={{ padding: "80px 100px", opacity }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 28,
          height: "100%",
          alignContent: "center",
        }}
      >
        {cards.map((card, index) => {
          const progress = spr(frame, fps, card.delay, 16, 140, 0.82);
          const cardY = interpolate(progress, [0, 1], [50, 0]);
          const cardOpacity = fade(frame, card.delay, card.delay + 25);
          const scale = interpolate(progress, [0, 1], [0.9, 1]);

          return (
            <div
              key={index}
              style={{
                padding: "36px 40px",
                borderRadius: 24,
                background: "rgba(255,255,255,0.65)",
                border: `2px solid ${card.color}22`,
                boxShadow: `0 16px 48px ${C.shadow}, 0 0 0 1px ${card.color}11`,
                opacity: cardOpacity,
                transform: `translateY(${cardY}px) scale(${scale})`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  width: "42%",
                  height: 12,
                  borderRadius: 999,
                  background: `${card.color}33`,
                }}
              />
              <div
                style={{
                  width: "60%",
                  height: 70,
                  borderRadius: 28,
                  background: `${card.color}22`,
                  alignSelf: "center",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div
                  style={{
                    width: `${card.width / 5}px`,
                    height: 12,
                    borderRadius: 999,
                    background: "rgba(47,39,31,0.08)",
                  }}
                />
                <div
                  style={{
                    width: `${card.width / 6}px`,
                    height: 10,
                    borderRadius: 999,
                    background: "rgba(47,39,31,0.05)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
