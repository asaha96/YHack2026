import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// ─── INDIVIDUAL PET COMPONENTS ─────────────────────────────────────────────────

interface PetProps {
  /** Delay before pet slides in (frames) */
  enterDelay?: number;
  /** Optional speech bubble text */
  speech?: string;
}

const SpeechBubble: React.FC<{ text: string; opacity: number }> = ({ text, opacity }) => (
  <div
    style={{
      position: "absolute",
      top: -58,
      left: "50%",
      transform: "translateX(-50%)",
      padding: "8px 16px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.92)",
      border: "1px solid rgba(47,39,31,0.12)",
      boxShadow: "0 4px 16px rgba(38,29,20,0.1)",
      whiteSpace: "nowrap",
      fontFamily: "'Georgia', serif",
      fontSize: 13,
      color: "#2a2015",
      letterSpacing: "-0.01em",
      opacity,
    }}
  >
    {text}
    {/* Bubble tail */}
    <div
      style={{
        position: "absolute",
        bottom: -7,
        left: "50%",
        transform: "translateX(-50%)",
        width: 0,
        height: 0,
        borderLeft: "6px solid transparent",
        borderRight: "6px solid transparent",
        borderTop: "8px solid rgba(255,255,255,0.92)",
      }}
    />
  </div>
);

/** Cat: peeks from bottom-right, bounces happily */
export const PetCat: React.FC<PetProps> = ({
  enterDelay = 0,
  speech = "meow (this CT looks delicious)",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({ frame: Math.max(0, frame - enterDelay), fps, config: { damping: 14, stiffness: 100 } });
  const y = interpolate(slideIn, [0, 1], [120, 0]);
  const bounce = Math.sin(frame / 18) * 6;
  const speechOpacity = interpolate(frame, [enterDelay + 20, enterDelay + 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        right: 40,
        transform: `translateY(${y + bounce}px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        zIndex: 10,
      }}
    >
      <div style={{ position: "relative" }}>
        <SpeechBubble text={speech} opacity={speechOpacity} />
        <div style={{ fontSize: 64 }}>🐱</div>
      </div>
    </div>
  );
};

/** Dog: peeks from bottom-left, tail wag simulated via rotation */
export const PetDog: React.FC<PetProps> = ({
  enterDelay = 0,
  speech = "good scan! good scan!",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({ frame: Math.max(0, frame - enterDelay), fps, config: { damping: 16, stiffness: 90 } });
  const x = interpolate(slideIn, [0, 1], [-100, 0]);
  const wag = Math.sin(frame / 8) * 12;
  const speechOpacity = interpolate(frame, [enterDelay + 20, enterDelay + 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        left: 44,
        transform: `translateX(${x}px) rotate(${wag * 0.15}deg)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        zIndex: 10,
      }}
    >
      <div style={{ position: "relative" }}>
        <SpeechBubble text={speech} opacity={speechOpacity} />
        <div style={{ fontSize: 64 }}>🐶</div>
      </div>
    </div>
  );
};

/** Bunny: hops in from the right, bounces high */
export const PetBunny: React.FC<PetProps> = ({
  enterDelay = 0,
  speech = "hop hop hop (I am helping)",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({ frame: Math.max(0, frame - enterDelay), fps, config: { damping: 10, stiffness: 140 } });
  const x = interpolate(slideIn, [0, 1], [140, 0]);
  const hop = Math.abs(Math.sin(frame / 14)) * -24;
  const speechOpacity = interpolate(frame, [enterDelay + 15, enterDelay + 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 28,
        right: 80,
        transform: `translateX(${x}px) translateY(${hop}px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        zIndex: 10,
      }}
    >
      <div style={{ position: "relative" }}>
        <SpeechBubble text={speech} opacity={speechOpacity} />
        <div style={{ fontSize: 60 }}>🐰</div>
      </div>
    </div>
  );
};

/** Penguin: slides in from top-right, wobbles side to side — very dignified */
export const PetPenguin: React.FC<PetProps> = ({
  enterDelay = 0,
  speech = "I have studied every anatomy atlas",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({ frame: Math.max(0, frame - enterDelay), fps, config: { damping: 18, stiffness: 80 } });
  const y = interpolate(slideIn, [0, 1], [-100, 0]);
  const wobble = Math.sin(frame / 22) * 8;
  const speechOpacity = interpolate(frame, [enterDelay + 20, enterDelay + 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        top: 24,
        right: 56,
        transform: `translateY(${y}px) rotate(${wobble}deg)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        zIndex: 10,
      }}
    >
      <div style={{ position: "relative" }}>
        <SpeechBubble text={speech} opacity={speechOpacity} />
        <div style={{ fontSize: 64 }}>🐧</div>
      </div>
    </div>
  );
};

/** Corgi: bounces in from bottom-center, extremely pleased with everything */
export const PetCorgi: React.FC<PetProps> = ({
  enterDelay = 0,
  speech = "PDF READY. best. day. ever.",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({ frame: Math.max(0, frame - enterDelay), fps, config: { damping: 12, stiffness: 120 } });
  const y = interpolate(slideIn, [0, 1], [100, 0]);
  const spin = Math.sin(frame / 12) * 10;
  const speechOpacity = interpolate(frame, [enterDelay + 18, enterDelay + 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        left: "50%",
        transform: `translateX(-50%) translateY(${y}px) rotate(${spin}deg)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        zIndex: 10,
      }}
    >
      <div style={{ position: "relative" }}>
        <SpeechBubble text={speech} opacity={speechOpacity} />
        <div style={{ fontSize: 68 }}>🐕</div>
      </div>
    </div>
  );
};

/** Floating sparkles — appears over any scene for extra delight */
export const SparkleOverlay: React.FC<{ count?: number }> = ({ count = 6 }) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {Array.from({ length: count }).map((_, i) => {
        const phase = (i / count) * Math.PI * 2;
        const x = 10 + (i / (count - 1)) * 80;
        const y = 20 + Math.sin(frame / 30 + phase) * 15;
        const scale = 0.6 + (Math.sin(frame / 20 + phase) * 0.5 + 0.5) * 0.8;
        const opacity = 0.4 + (Math.sin(frame / 25 + phase) * 0.5 + 0.5) * 0.6;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              fontSize: 18,
              transform: `scale(${scale})`,
              opacity,
            }}
          >
            ✨
          </div>
        );
      })}
    </div>
  );
};
