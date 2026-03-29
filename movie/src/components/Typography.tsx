import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fade, mono, sans, serif, spr } from "../constants";

export const WordLetter: React.FC<{ char: string; index: number }> = ({
  char,
  index,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spr(frame, fps, 14 + index * 6, 22, 150, 0.74);
  const y = interpolate(progress, [0, 1], [42, 0]);
  const opacity = fade(frame, 4 + index * 6, 30 + index * 6);
  const blur = interpolate(progress, [0, 1], [12, 0]);

  return (
    <span
      style={{
        display: "inline-block",
        transform: `translateY(${y}px)`,
        opacity,
        filter: `blur(${blur}px)`,
      }}
    >
      {char}
    </span>
  );
};

export const PraxisWordmark: React.FC<{ compact?: boolean }> = ({
  compact = false,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        fontFamily: serif,
        fontSize: compact ? 64 : 170,
        lineHeight: 0.9,
        letterSpacing: compact ? "0.1em" : "0.08em",
        color: compact ? C.ink : "#f2ead8",
        WebkitTextStroke: compact ? undefined : "2px #18110a",
        textShadow: compact
          ? undefined
          : [
              "-5px -5px 0 #9e7224",
              "0 -5px 0 #9e7224",
              "5px -5px 0 #9e7224",
              "5px 0 0 #9e7224",
              "5px 5px 0 #9e7224",
              "0 5px 0 #9e7224",
              "-5px 5px 0 #9e7224",
              "-5px 0 0 #9e7224",
              "0 24px 56px rgba(30,18,8,0.18)",
            ].join(", "),
        opacity: compact ? 1 : fade(frame, 0, 40),
      }}
    >
      {"Praxis".split("").map((char, i) => (
        <WordLetter key={i} char={char} index={i} />
      ))}
    </div>
  );
};

export const Eyebrow: React.FC<{ text: string; delay?: number }> = ({
  text,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const opacity = fade(frame, 12 + delay, 34 + delay);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        opacity,
        transform: `translateY(${interpolate(opacity, [0, 1], [14, 0])}px)`,
        padding: "8px 16px",
        background: "linear-gradient(135deg, rgba(201, 190, 176, 0.2), rgba(201, 190, 176, 0.05))",
        borderRadius: 100,
        border: "1px solid rgba(139, 129, 120, 0.15)",
        backdropFilter: "blur(12px)",
        alignSelf: "flex-start",
        boxShadow: "0 4px 12px rgba(38, 29, 20, 0.04)",
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: C.ember,
          boxShadow: `0 0 8px ${C.ember}`,
        }}
      />
      <span
        style={{
          fontFamily: mono,
          fontSize: 11,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: C.inkSoft,
          fontWeight: 600,
        }}
      >
        {text}
      </span>
    </div>
  );
};

export const AnimatedHeadline: React.FC<{
  lines: (string | React.ReactNode)[];
  delay?: number;
  color?: string;
  size?: number;
  style?: React.CSSProperties;
}> = ({ lines, delay = 0, color = C.ink, size = 64, style = {} }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spr(frame, fps, delay, 22, 135, 0.76);
  const y = interpolate(progress, [0, 1], [42, 0]);
  const opacity = fade(frame, delay, delay + 40);
  return (
    <p
      style={{
        margin: 0,
        fontFamily: serif,
        fontSize: size,
        lineHeight: 1.02,
        letterSpacing: "-0.055em",
        color,
        transform: `translateY(${y}px)`,
        opacity,
        ...style
      }}
    >
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </p>
  );
};

export const AnimatedBody: React.FC<{
  text: string;
  delay?: number;
  maxWidth?: number;
}> = ({ text, delay = 0, maxWidth = 640 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spr(frame, fps, delay, 22, 120, 0.86);
  const y = interpolate(progress, [0, 1], [24, 0]);
  const opacity = fade(frame, delay, delay + 40);
  return (
    <p
      style={{
        margin: 0,
        maxWidth,
        fontFamily: sans,
        fontSize: 22,
        lineHeight: 1.6,
        letterSpacing: "-0.01em",
        color: C.inkSoft,
        transform: `translateY(${y}px)`,
        opacity,
      }}
    >
      {text}
    </p>
  );
};
