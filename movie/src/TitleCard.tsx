import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const LETTERS = ["P", "r", "a", "x", "i", "s"];
const STAGGER = 6; // frames between each letter

const AnimatedLetter: React.FC<{ char: string; index: number }> = ({
  char,
  index,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = index * STAGGER;

  // Spring rise
  const y = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.8 },
    from: 60,
    to: 0,
  });

  // Fade in
  const opacity = interpolate(frame - delay, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Blur clear
  const blur = interpolate(frame - delay, [0, 18], [8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtle continuous float per letter, offset by index
  const floatY = Math.sin((frame + index * 22) / 55) * 3.5;

  return (
    <span
      style={{
        display: "inline-block",
        transform: `translateY(${y + floatY}px)`,
        opacity,
        filter: `blur(${blur}px)`,
        // Stagger spacing slightly on i/s for optical balance
        letterSpacing: char === "s" ? 0 : undefined,
      }}
    >
      {char}
    </span>
  );
};

export const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();

  // Tile fade-in
  const tileOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const tileScale = interpolate(frame, [0, 25], [0.96, 1], {
    extrapolateRight: "clamp",
  });

  // Subtle tile shimmer — light band sweeps left to right
  const shimmerX = interpolate(frame, [30, 90], [-100, 120], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      {/* Base warm paper color */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(160deg, #f5f0e8 0%, #ede6d6 35%, #e8dfc8 65%, #efe8d8 100%)",
        }}
      />

      {/* Paper grain layers */}
      <AbsoluteFill
        style={{
          backgroundImage: [
            `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeBlend in='SourceGraphic' mode='multiply'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.09'/%3E%3C/svg%3E")`,
            `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.02 0.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23f)' opacity='0.04'/%3E%3C/svg%3E")`,
          ].join(", "),
          backgroundSize: "200px 200px, 400px 400px",
          pointerEvents: "none",
        }}
      />

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(160,140,110,0.18) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Center glassmorphic tile */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Outer glow */}
        <div
          style={{
            position: "absolute",
            width: 680,
            height: 280,
            borderRadius: 40,
            background: "rgba(255,255,255,0.22)",
            filter: "blur(36px)",
            opacity: tileOpacity,
            transform: `scale(${tileScale})`,
          }}
        />

        {/* Glass tile */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            padding: "52px 88px",
            borderRadius: 28,
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.52) 0%, rgba(255,255,255,0.28) 50%, rgba(255,255,255,0.38) 100%)",
            backdropFilter: "blur(40px) saturate(1.6) brightness(1.08)",
            WebkitBackdropFilter: "blur(40px) saturate(1.6) brightness(1.08)",
            border: "1px solid rgba(255,255,255,0.72)",
            borderBottom: "1px solid rgba(255,255,255,0.28)",
            borderRight: "1px solid rgba(255,255,255,0.28)",
            boxShadow: [
              "0 20px 60px rgba(100, 80, 50, 0.18)",
              "0 4px 24px rgba(100, 80, 50, 0.10)",
              "inset 0 1.5px 0 rgba(255,255,255,0.85)",
              "inset 1.5px 0 0 rgba(255,255,255,0.5)",
              "inset 0 -1px 0 rgba(0,0,0,0.04)",
            ].join(", "),
            opacity: tileOpacity,
            transform: `scale(${tileScale})`,
          }}
        >
          {/* Inner top highlight band */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "45%",
              borderRadius: "28px 28px 0 0",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.38) 0%, transparent 100%)",
              pointerEvents: "none",
            }}
          />

          {/* Shimmer sweep */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: `${shimmerX}%`,
              width: "30%",
              height: "100%",
              background:
                "linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.28) 50%, transparent 100%)",
              pointerEvents: "none",
              transform: "skewX(-15deg)",
            }}
          />

          {/* Animated letter-by-letter wordmark */}
          <div
            style={{
              fontFamily: "'Georgia', 'Times New Roman', serif",
              fontSize: 112,
              fontWeight: 400,
              letterSpacing: "0.1em",
              color: "#2a2015",
              lineHeight: 1,
              position: "relative",
              display: "flex",
              textShadow: [
                "0 1px 0 rgba(255,255,255,0.8)",
                "0 4px 16px rgba(0,0,0,0.10)",
              ].join(", "),
            }}
          >
            {LETTERS.map((char, i) => (
              <AnimatedLetter key={i} char={char} index={i} />
            ))}
          </div>
        </div>
      </AbsoluteFill>

      {/* Drop music.mp3 into public/ and uncomment */}
      <Audio src={staticFile("music.mp3")} />
    </AbsoluteFill>
  );
};
