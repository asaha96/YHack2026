import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fade, mono, sans, serif, spr } from "../constants";
import { AnimatedBody, AnimatedHeadline, Eyebrow, PraxisWordmark } from "../components/Typography";
import { AnatomyDiagram } from "../components/AnatomyUI";

// Local frame: 0 → 180 (6s)
export const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeOut = fade(frame, 140, 180, 1, 0);
  const diagramOpacity = fade(frame, 52, 96);

  return (
    <AbsoluteFill style={{ padding: "90px 102px 80px", opacity: fadeOut }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          alignItems: "center",
          height: "100%",
          gap: 44,
        }}
      >
        {/* Left: text */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <Eyebrow text="Patient-specific surgical rehearsal" />
          <PraxisWordmark />
          <AnimatedHeadline
            lines={["Rehearse the operation", "before the room goes live."]}
            delay={26}
            size={66}
          />
          <AnimatedBody
            text="From CT scan to full 3D simulation in minutes — with AI guidance, hand tracking, and a surgical plan you can actually use."
            delay={48}
            maxWidth={720}
          />
        </div>

        {/* Right: anatomy diagram */}
        <div style={{ position: "relative", height: 700, opacity: diagramOpacity }}>
          <div
            style={{
              position: "absolute",
              inset: 34,
              borderRadius: "50%",
              border: "1px solid rgba(47,39,31,0.08)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 128,
              borderRadius: "50%",
              border: "1px dashed rgba(47,39,31,0.08)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 380,
              height: 470,
              transform: "translate(-50%, -50%)",
              borderRadius: 240,
              background:
                "radial-gradient(circle at 50% 28%, rgba(255,255,255,0.68), rgba(247,240,232,0.64))",
              border: `1px solid ${C.line}`,
              boxShadow: "0 26px 60px rgba(38,29,20,0.08)",
            }}
          />
          <AnatomyDiagram />
        </div>
      </div>
    </AbsoluteFill>
  );
};
