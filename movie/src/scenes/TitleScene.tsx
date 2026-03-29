import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, fade } from "../constants";
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
        <div style={{ position: "relative" }}>
          {/* Ambient Glow Effect for the text */}
          <div
            style={{
              position: "absolute",
              top: "-20%",
              left: "-10%",
              width: "90%",
              height: "140%",
              background: `radial-gradient(circle, rgba(178, 110, 87, 0.05) 0%, rgba(196, 147, 42, 0.03) 50%, rgba(201, 190, 176, 0) 70%)`,
              filter: "blur(60px)",
              zIndex: 0,
              pointerEvents: "none",
              opacity: fadeOut, // match the scene fade out
            }}
          />

          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 32 }}>
            <Eyebrow text="Patient-specific surgical planning" delay={0} />
            <div style={{ marginTop: -12 }}>
              <PraxisWordmark />
            </div>
            
            <AnimatedHeadline
              lines={[
                "See the case clearly",
                <span
                  key="gradient-text"
                  style={{
                    display: "inline-block",
                    background: `linear-gradient(135deg, ${C.ink} 10%, ${C.ember} 90%)`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    paddingRight: "8px", // handle potential clipping of italicized/bold letters
                  }}
                >
                  before the first incision.
                </span>,
              ]}
              delay={26}
              size={72}
              style={{ fontWeight: 500, letterSpacing: "-0.04em" }}
            />

            <div style={{ marginTop: 8 }}>
              <AnimatedBody
                text="From CT or MRI to interactive anatomy, procedural rehearsal, AI guidance, and a shareable surgical plan in one workflow."
                delay={48}
                maxWidth={720}
              />
            </div>
          </div>
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
