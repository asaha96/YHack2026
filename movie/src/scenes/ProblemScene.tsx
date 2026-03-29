import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fade, sans, serif, spr } from "../constants";
import { Eyebrow } from "../components/Typography";
import { StatCard } from "../components/Panels";

// Local frame: 0 → 180 (6s)
// The problem with surgery prep today — presented with statistical gravitas and mild horror.
export const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = fade(frame, 0, 40);
  const fadeOut = fade(frame, 140, 180, 1, 0);
  const opacity = fadeIn * fadeOut;

  const headlineY = interpolate(
    spr(frame, fps, 10, 20, 130, 0.8),
    [0, 1],
    [32, 0]
  );

  const stats = [
    {
      number: "73%",
      label: "of complications are preventable",
      detail: "when teams can prepare with enough context",
      color: C.ember,
      delay: 40,
    },
    {
      number: "0×",
      label: "true rehearsals for a specific patient",
      detail: "most planning stops before simulation starts",
      color: C.accent,
      delay: 60,
    },
    {
      number: "$150",
      label: "per minute of OR time",
      detail: "hesitation gets expensive very quickly",
      color: C.sage,
      delay: 80,
    },
  ];

  return (
    <AbsoluteFill style={{ padding: "80px 100px", opacity }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 40, height: "100%" }}>

        {/* Top eyebrow */}
        <Eyebrow text="The problem" />

        {/* Headline */}
        <p
          style={{
            margin: 0,
            fontFamily: serif,
            fontSize: 72,
            lineHeight: 0.96,
            letterSpacing: "-0.06em",
            color: C.ink,
            transform: `translateY(${headlineY}px)`,
            opacity: fade(frame, 8, 48),
            maxWidth: 900,
          }}
        >
          Surgical teams are ready.
          <br />
          <span style={{ color: C.inkSoft }}>Their tools still are not.</span>
        </p>

        {/* Subtext */}
        <p
          style={{
            margin: 0,
            fontFamily: sans,
            fontSize: 22,
            lineHeight: 1.6,
            color: C.inkSoft,
            maxWidth: 640,
            opacity: fade(frame, 30, 70),
          }}
        >
          Every case is different, but planning still happens across static scans,
          disconnected software, and mental guesswork instead of a rehearsal
          space built around <em>that</em> patient.
        </p>

        {/* Stat cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 24,
            marginTop: 8,
          }}
        >
          {stats.map((stat) => {
              const progress = spr(frame, fps, stat.delay, 20, 120, 0.85);
            const cardY = interpolate(progress, [0, 1], [40, 0]);
            const cardOpacity = fade(frame, stat.delay, stat.delay + 30);
            return (
              <StatCard
                key={stat.label}
                number={stat.number}
                label={stat.label}
                detail={stat.detail}
                opacity={cardOpacity}
                translateY={cardY}
                accentColor={stat.color}
              />
            );
          })}
        </div>

        {/* Transition hook */}
        <p
          style={{
            margin: 0,
            fontFamily: serif,
            fontSize: 32,
            letterSpacing: "-0.04em",
            color: C.ink,
            opacity: fade(frame, 110, 150),
            fontStyle: "italic",
          }}
        >
          Praxis gives teams that better way.
        </p>
      </div>
    </AbsoluteFill>
  );
};
