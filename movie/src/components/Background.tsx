import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export const SoftBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 900], [0, 10], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `linear-gradient(${146 + drift}deg, #fcfaf4 0%, #f8f4ec 42%, #f6f1ea 70%, #fbf9f5 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 18% 20%, rgba(120, 104, 91, 0.08), transparent 26%), radial-gradient(circle at 82% 76%, rgba(178, 110, 87, 0.06), transparent 24%)",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: [
            "linear-gradient(rgba(54, 46, 38, 0.028) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(54, 46, 38, 0.028) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "128px 128px",
          opacity: 0.36,
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.14) 0px, rgba(255,255,255,0.14) 2px, transparent 2px, transparent 4px)",
          mixBlendMode: "soft-light",
          opacity: 0.22,
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at center, transparent 58%, rgba(53, 41, 30, 0.06) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

export const Atmosphere: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {[
        {
          top: "12%",
          left: "10%",
          width: 440,
          height: 320,
          color: "rgba(201,190,176,0.16)",
          speed: 54,
        },
        {
          top: "54%",
          left: "68%",
          width: 380,
          height: 280,
          color: "rgba(178,110,87,0.09)",
          speed: 68,
        },
      ].map((shape, i) => {
        const y = Math.sin((frame + i * 70) / shape.speed) * 12;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: shape.top,
              left: shape.left,
              width: shape.width,
              height: shape.height,
              borderRadius: "50%",
              background: shape.color,
              filter: "blur(18px)",
              transform: `translateY(${y}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
