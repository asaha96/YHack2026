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

const C = {
  bg: "#f8f4ec",
  bg2: "#fbf8f2",
  panel: "rgba(253, 250, 244, 0.9)",
  panelStrong: "#fcfaf5",
  line: "rgba(47, 39, 31, 0.09)",
  ink: "#171311",
  inkSoft: "#635b54",
  inkMuted: "#8b8178",
  accent: "#6d6257",
  accentSoft: "#c9beb0",
  ember: "#b26e57",
  sage: "#82907d",
  shadow: "rgba(38, 29, 20, 0.1)",
  shadowDeep: "rgba(38, 29, 20, 0.16)",
};

const serif =
  "'Iowan Old Style', 'Baskerville', 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "'Helvetica Neue', Arial, sans-serif";
const mono = "'SFMono-Regular', 'Menlo', monospace";

const spr = (
  frame: number,
  fps: number,
  delay = 0,
  damping = 18,
  stiffness = 120,
  mass = 0.92
) =>
  spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping, stiffness, mass },
  });

const fade = (frame: number, start: number, end: number, from = 0, to = 1) =>
  interpolate(frame, [start, end], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const SoftBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 450], [0, 10], {
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

const Atmosphere: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {[
        { top: "12%", left: "10%", width: 440, height: 320, color: "rgba(201,190,176,0.16)", speed: 54 },
        { top: "54%", left: "68%", width: 380, height: 280, color: "rgba(178,110,87,0.09)", speed: 68 },
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

const WordLetter: React.FC<{ char: string; index: number }> = ({ char, index }) => {
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

const CharacterI: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const frame = useCurrentFrame();
  const scale = compact ? 0.48 : 1;
  const sway = Math.sin(frame / 18) * 3.5;
  const beam = 0.08 + (Math.sin(frame / 12) * 0.5 + 0.5) * 0.08;

  return (
    <span
      style={{
        display: "inline-flex",
        position: "relative",
        width: 74 * scale,
        height: 148 * scale,
        marginLeft: compact ? 0 : -6,
        marginRight: compact ? 4 : 6,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 26 * scale,
          bottom: 12 * scale,
          width: 22 * scale,
          height: 90 * scale,
          borderRadius: 18 * scale,
          background: "linear-gradient(180deg, #2b241f 0%, #171311 100%)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.15), 0 14px 24px rgba(31, 24, 19, 0.12)",
        }}
      />
      <span
        style={{
          position: "absolute",
          left: 15 * scale,
          bottom: 106 * scale,
          width: 44 * scale,
          height: 44 * scale,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 38% 34%, #fff7ef 0%, #e7d4c6 35%, #c18b73 68%, #8c5f4d 100%)",
          transform: `translateX(${sway * scale}px)`,
          boxShadow:
            "0 16px 30px rgba(93, 62, 49, 0.14), inset 0 1px 0 rgba(255,255,255,0.32)",
        }}
      />
      <span
        style={{
          position: "absolute",
          left: 35 * scale,
          top: 48 * scale,
          width: 2 * scale,
          height: 76 * scale,
          background: `linear-gradient(180deg, rgba(193,139,115,0), rgba(193,139,115,${beam}), rgba(193,139,115,0))`,
          transform: `translateX(${sway * 0.5 * scale}px) rotate(8deg)`,
          transformOrigin: "top center",
        }}
      />
    </span>
  );
};

const PraxisWordmark: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
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
        color: C.ink,
        opacity: compact ? 1 : fade(frame, 0, 40),
      }}
    >
      <WordLetter char="P" index={0} />
      <WordLetter char="r" index={1} />
      <WordLetter char="a" index={2} />
      <WordLetter char="x" index={3} />
      <CharacterI compact={compact} />
      <WordLetter char="s" index={5} />
    </div>
  );
};

const Eyebrow: React.FC<{ text: string; delay?: number }> = ({ text, delay = 0 }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        opacity: fade(frame, 12 + delay, 34 + delay),
        transform: `translateY(${interpolate(fade(frame, 12 + delay, 34 + delay), [0, 1], [14, 0])}px)`,
      }}
    >
      <div
        style={{
          width: 46,
          height: 1,
          background: "rgba(23,19,17,0.22)",
        }}
      />
      <span
        style={{
          fontFamily: mono,
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: C.inkMuted,
        }}
      >
        {text}
      </span>
    </div>
  );
};

const PanelShell: React.FC<{
  children: React.ReactNode;
  width: number | string;
  height: number | string;
  style?: React.CSSProperties;
}> = ({ children, width, height, style }) => (
  <div
    style={{
      width,
      height,
      borderRadius: 34,
      overflow: "hidden",
      background: C.panel,
      border: `1px solid ${C.line}`,
      boxShadow: `0 36px 90px ${C.shadowDeep}, 0 12px 30px ${C.shadow}`,
      ...style,
    }}
  >
    {children}
  </div>
);

const HeaderBar: React.FC<{ title: string; detail: string }> = ({ title, detail }) => (
  <div
    style={{
      height: 58,
      padding: "0 20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: `1px solid ${C.line}`,
      background: "rgba(255,255,255,0.34)",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: C.ember,
          boxShadow: "0 0 14px rgba(178,110,87,0.18)",
        }}
      />
      <span
        style={{
          fontFamily: mono,
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: C.inkMuted,
        }}
      >
        {title}
      </span>
    </div>
    <span
      style={{
        fontFamily: mono,
        fontSize: 10,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: C.inkMuted,
      }}
    >
      {detail}
    </span>
  </div>
);

const WorkflowColumn: React.FC = () => {
  const steps = [
    ["Upload", "DICOM stack received", true],
    ["Reconstruct", "Patient volume resolved", true],
    ["Annotate", "Critical structures mapped", true],
    ["Simulate", "Live rehearsal ready", false],
  ] as const;

  return (
    <div style={{ height: "100%", background: "rgba(255,255,255,0.26)" }}>
      <HeaderBar title="Workflow" detail="Case 4471-B" />
      <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
        <p
          style={{
            margin: 0,
            fontFamily: serif,
            fontSize: 28,
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            color: C.ink,
          }}
        >
          Surgical rehearsal
          <br />
          in sequence.
        </p>
        <div style={{ height: 10 }} />
        {steps.map(([title, detail, done], i) => (
          <div
            key={title}
            style={{
              display: "grid",
              gridTemplateColumns: "40px 1fr",
              gap: 14,
              padding: "14px 0",
              borderTop: i === 0 ? "1px solid rgba(47,39,31,0.08)" : undefined,
              borderBottom: "1px solid rgba(47,39,31,0.08)",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                border: `1px solid ${done ? "rgba(130,144,125,0.26)" : "rgba(47,39,31,0.12)"}`,
                background: done ? "rgba(130,144,125,0.08)" : "rgba(255,255,255,0.36)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: mono,
                fontSize: 11,
                color: done ? C.sage : C.inkMuted,
              }}
            >
              {done ? "OK" : `0${i + 1}`}
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontFamily: serif,
                  fontSize: 20,
                  letterSpacing: "-0.03em",
                  color: C.ink,
                }}
              >
                {title}
              </p>
              <p
                style={{
                  margin: "5px 0 0",
                  fontFamily: sans,
                  fontSize: 12,
                  letterSpacing: "0.01em",
                  color: C.inkSoft,
                  lineHeight: 1.5,
                }}
              >
                {detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AnatomyStage: React.FC<{ large?: boolean }> = ({ large = false }) => {
  const frame = useCurrentFrame();
  const scan = interpolate(frame % 210, [0, 210], [0, 100], {
    extrapolateRight: "clamp",
  });
  const shift = Math.sin(frame / 34) * 10;

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        background: "linear-gradient(180deg, rgba(247,244,239,0.9), rgba(252,249,244,0.96))",
      }}
    >
      <HeaderBar title="Anatomy" detail={large ? "Live patient model" : "Volume study"} />
      <div
        style={{
          position: "absolute",
          inset: "58px 0 0 0",
          backgroundImage: [
            "linear-gradient(rgba(47,39,31,0.035) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(47,39,31,0.035) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: large ? "44px 44px" : "36px 36px",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 58,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width={large ? "470" : "320"}
          height={large ? "560" : "390"}
          viewBox="0 0 470 560"
          fill="none"
          style={{ transform: `translateX(${shift}px)` }}
        >
          <path
            d="M235 54 C168 54 112 108 102 176 L78 386 C70 450 118 506 176 506 L294 506 C352 506 400 450 392 386 L368 176 C358 108 302 54 235 54 Z"
            fill="rgba(255,255,255,0.42)"
            stroke="rgba(47,39,31,0.18)"
            strokeWidth="2.3"
          />
          <path
            d="M168 182 C140 194 120 238 126 294 C132 342 162 368 202 354 L236 334 L236 182 Z"
            fill="rgba(109,98,87,0.08)"
            stroke="rgba(109,98,87,0.28)"
            strokeWidth="2"
          />
          <path
            d="M302 182 C330 194 350 238 344 294 C338 342 308 368 268 354 L236 334 L236 182 Z"
            fill="rgba(109,98,87,0.08)"
            stroke="rgba(109,98,87,0.28)"
            strokeWidth="2"
          />
          <path
            d="M236 238 C208 204 164 216 170 258 C176 300 236 348 236 348 C236 348 296 300 302 258 C308 216 264 204 236 238 Z"
            fill="rgba(178,110,87,0.11)"
            stroke="rgba(178,110,87,0.4)"
            strokeWidth="2.3"
          />
          <path
            d="M154 376 C126 384 112 420 122 456 C136 504 194 520 246 516 C314 510 360 486 370 436 C380 394 342 364 280 362 Z"
            fill="rgba(130,144,125,0.11)"
            stroke="rgba(130,144,125,0.4)"
            strokeWidth="2.3"
          />
          {[1, 2, 3].map((ring) => (
            <ellipse
              key={ring}
              cx="236"
              cy="278"
              rx={74 + ring * 54}
              ry={110 + ring * 70}
              stroke={`rgba(47,39,31,${0.1 - ring * 0.02})`}
              strokeWidth="1"
            />
          ))}
        </svg>
      </div>
      <div
        style={{
          position: "absolute",
          left: 32,
          right: 32,
          top: `${76 + scan * (large ? 6.2 : 4.2)}px`,
          height: 2,
          background:
            "linear-gradient(90deg, transparent, rgba(178,110,87,0.26), rgba(130,144,125,0.34), transparent)",
          boxShadow: "0 0 12px rgba(178,110,87,0.14)",
        }}
      />
      {[
        { label: "portal vein", top: large ? "41%" : "44%", left: large ? "70%" : "68%", color: C.ember },
        { label: "left lung", top: large ? "32%" : "32%", left: large ? "17%" : "18%", color: C.accent },
        { label: "safe plane", top: large ? "74%" : "70%", left: large ? "58%" : "56%", color: C.sage },
      ].map((tag) => (
        <div
          key={tag.label}
          style={{
            position: "absolute",
            top: tag.top,
            left: tag.left,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: tag.color,
            }}
          />
          <span
            style={{
              fontFamily: mono,
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: C.inkMuted,
            }}
          >
            {tag.label}
          </span>
        </div>
      ))}
    </div>
  );
};

const GuidanceColumn: React.FC = () => {
  return (
    <div style={{ height: "100%", background: "rgba(255,255,255,0.26)" }}>
      <HeaderBar title="Guidance" detail="Risk-aware" />
      <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 18 }}>
        <p
          style={{
            margin: 0,
            fontFamily: serif,
            fontSize: 28,
            lineHeight: 1.06,
            letterSpacing: "-0.04em",
            color: C.ink,
          }}
        >
          The assistant speaks
          <br />
          like a second reader.
        </p>
        {[
          ["assistant", "Reconstruction complete. Critical structures aligned to this patient."],
          ["surgeon", "What is the safest incision corridor?"],
          ["assistant", "Favor a left subcostal path. Hold 12 mm of clearance from the hepatic artery."],
        ].map(([role, body], i) => (
          <div
            key={`${role}-${i}`}
            style={{
              padding: "16px 18px",
              borderRadius: 22,
              background: role === "surgeon" ? "rgba(233,227,218,0.56)" : "rgba(255,255,255,0.5)",
              border: `1px solid ${role === "surgeon" ? "rgba(47,39,31,0.1)" : "rgba(47,39,31,0.07)"}`,
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: mono,
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: C.inkMuted,
              }}
            >
              {role}
            </p>
            <p
              style={{
                margin: "10px 0 0",
                fontFamily: sans,
                fontSize: 14,
                lineHeight: 1.6,
                color: C.ink,
              }}
            >
              {body}
            </p>
          </div>
        ))}
        <div
          style={{
            padding: 18,
            borderRadius: 24,
            border: "1px solid rgba(47,39,31,0.08)",
            background: "rgba(255,255,255,0.42)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontFamily: serif,
                fontSize: 18,
                letterSpacing: "-0.03em",
                color: C.ink,
              }}
            >
              Hepatic artery
            </span>
            <span
              style={{
                fontFamily: mono,
                fontSize: 11,
                color: C.inkMuted,
              }}
            >
              82%
            </span>
          </div>
          <div
            style={{
              height: 5,
              borderRadius: 999,
              background: "rgba(47,39,31,0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "82%",
                height: "100%",
                background: "linear-gradient(90deg, rgba(178,110,87,0.76), rgba(178,110,87,0.22))",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const Board: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  const frame = useCurrentFrame();
  const sweep = interpolate(frame % 240, [0, 240], [-20, 100], {
    extrapolateRight: "clamp",
  });

  return (
    <PanelShell
      width={1480 * scale}
      height={820 * scale}
      style={{ position: "relative" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${340 * scale}px ${1}fr ${330 * scale}px`,
          height: "100%",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.36), rgba(245,239,232,0.42))",
        }}
      >
        <WorkflowColumn />
        <AnatomyStage large />
        <GuidanceColumn />
      </div>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${sweep}%`,
          width: "18%",
          background:
            "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.18), rgba(255,255,255,0))",
          transform: "skewX(-16deg)",
          pointerEvents: "none",
        }}
      />
    </PanelShell>
  );
};

const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeOut = fade(frame, 132, 176, 1, 0);
  const headlineY = interpolate(spr(frame, 30, 26, 22, 135, 0.76), [0, 1], [42, 0]);
  const subY = interpolate(spr(frame, 30, 48, 22, 120, 0.86), [0, 1], [24, 0]);
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
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <Eyebrow text="Patient-specific surgical rehearsal" />
          <PraxisWordmark />
          <p
            style={{
              margin: 0,
              fontFamily: serif,
              fontSize: 66,
              lineHeight: 0.98,
              letterSpacing: "-0.065em",
              color: C.ink,
              transform: `translateY(${headlineY}px)`,
              opacity: fade(frame, 20, 64),
            }}
          >
            Rehearse the operation
            <br />
            before the room goes live.
          </p>
          <p
            style={{
              margin: 0,
              maxWidth: 720,
              fontFamily: sans,
              fontSize: 22,
              lineHeight: 1.6,
              letterSpacing: "-0.01em",
              color: C.inkSoft,
              transform: `translateY(${subY}px)`,
              opacity: fade(frame, 42, 88),
            }}
          >
            The first act now opens with restraint: lighter space, slower
            timing, and a cleaner editorial surface that introduces the product
            before any human footage appears.
          </p>
        </div>

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

const AnatomyDiagram: React.FC = () => {
  const frame = useCurrentFrame();
  const orbit = Math.sin(frame / 28) * 12;
  return (
    <>
      <svg
        width="440"
        height="520"
        viewBox="0 0 440 520"
        fill="none"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <path
          d="M220 46 C160 46 110 98 100 162 L76 356 C68 418 114 474 168 474 L272 474 C326 474 372 418 364 356 L340 162 C330 98 280 46 220 46 Z"
          fill="rgba(255,255,255,0.34)"
          stroke="rgba(47,39,31,0.16)"
          strokeWidth="2.2"
        />
        <path
          d="M162 168 C138 178 122 216 126 260 C130 302 154 324 190 314 L220 296 L220 168 Z"
          fill="rgba(109,98,87,0.09)"
          stroke="rgba(109,98,87,0.28)"
          strokeWidth="1.8"
        />
        <path
          d="M278 168 C302 178 318 216 314 260 C310 302 286 324 250 314 L220 296 L220 168 Z"
          fill="rgba(109,98,87,0.09)"
          stroke="rgba(109,98,87,0.28)"
          strokeWidth="1.8"
        />
        <path
          d="M220 222 C196 194 158 204 164 240 C170 278 220 318 220 318 C220 318 270 278 276 240 C282 204 244 194 220 222 Z"
          fill="rgba(178,110,87,0.12)"
          stroke="rgba(178,110,87,0.42)"
          strokeWidth="2"
        />
        <path
          d="M144 352 C118 358 108 390 116 422 C128 464 180 478 228 474 C292 468 334 446 342 404 C350 366 316 340 258 338 Z"
          fill="rgba(130,144,125,0.11)"
          stroke="rgba(130,144,125,0.42)"
          strokeWidth="2"
        />
      </svg>
      {[
        { top: 154 + orbit, left: 116, label: "arterial risk" },
        { top: 278, left: 470, label: "volume mesh" },
        { top: 486 - orbit, left: 156, label: "safe plane" },
      ].map((tag) => (
        <div
          key={tag.label}
          style={{
            position: "absolute",
            top: tag.top,
            left: tag.left,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "rgba(47,39,31,0.4)",
            }}
          />
          <span
            style={{
              fontFamily: mono,
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: C.inkMuted,
            }}
          >
            {tag.label}
          </span>
        </div>
      ))}
    </>
  );
};

const HeroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const appear = fade(frame, 146, 198);
  const disappear = fade(frame, 300, 344, 1, 0);
  const heroLift = interpolate(spr(frame, 30, 154, 18, 120, 0.92), [0, 1], [48, 0]);
  const cameraScale = interpolate(frame, [160, 300], [0.94, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        opacity: appear * disappear,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 84,
          left: 100,
          zIndex: 3,
          opacity: fade(frame, 172, 220),
        }}
      >
        <Eyebrow text="Product first, not slideshow first" delay={154} />
      </div>

      <div
        style={{
          transform: `translateY(${heroLift}px) scale(${cameraScale})`,
        }}
      >
        <Board />
      </div>
    </AbsoluteFill>
  );
};

const DetailScene: React.FC = () => {
  const frame = useCurrentFrame();
  const appear = fade(frame, 316, 360);
  const disappear = fade(frame, 380, 420, 1, 0);
  const leftX = interpolate(spr(frame, 30, 320, 18, 118, 0.9), [0, 1], [-36, 0]);
  const rightX = interpolate(spr(frame, 30, 334, 18, 118, 0.9), [0, 1], [36, 0]);
  const boardY = interpolate(frame, [316, 430], [14, -8], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        padding: "88px 96px 74px",
        opacity: appear * disappear,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "0.72fr 1.28fr",
          gap: 34,
          alignItems: "center",
          height: "100%",
          transform: `translateY(${boardY}px)`,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            transform: `translateX(${leftX}px)`,
          }}
        >
          <Eyebrow text="Longer transitions, calmer surfaces" delay={320} />
          <p
            style={{
              margin: 0,
              fontFamily: serif,
              fontSize: 64,
              lineHeight: 0.98,
              letterSpacing: "-0.06em",
              color: C.ink,
            }}
          >
            One surface at a time.
          </p>
          <p
            style={{
              margin: 0,
              fontFamily: sans,
              fontSize: 20,
              lineHeight: 1.65,
              color: C.inkSoft,
              maxWidth: 430,
            }}
          >
            The handoff now breathes. Instead of stacked cards colliding into
            frame, the composition glides into a focused board and ends on a
            quieter close-up.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              "Serif-led UI typography",
              "Wide-panel hero shot",
              "Slower dissolves and camera drift",
            ].map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  paddingBottom: 12,
                  borderBottom: "1px solid rgba(47,39,31,0.08)",
                }}
              >
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: C.ink,
                  }}
                />
                <span
                  style={{
                    fontFamily: serif,
                    fontSize: 24,
                    letterSpacing: "-0.03em",
                    color: C.ink,
                  }}
                >
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 0.88fr",
            gap: 18,
            transform: `translateX(${rightX}px)`,
          }}
        >
          <PanelShell width="100%" height={730}>
            <AnatomyStage large />
          </PanelShell>
          <PanelShell width="100%" height={730}>
            <GuidanceColumn />
          </PanelShell>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const WatchScene: React.FC = () => {
  const frame = useCurrentFrame();

  const appear = fade(frame, 420, 460);
  const disappear = fade(frame, 570, 610, 1, 0);
  const opacity = appear * disappear;

  const modalProgress = spr(frame, 30, 424, 22, 135, 0.88);
  const modalScale = interpolate(modalProgress, [0, 1], [0.9, 1]);
  const modalY = interpolate(modalProgress, [0, 1], [50, 0]);

  const eyebrowOpacity = fade(frame, 428, 460);
  const eyebrowY = interpolate(modalProgress, [0, 1], [16, 0]);

  const videoProgress = interpolate(frame, [460, 570], [0, 76], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Backdrop */}
      <AbsoluteFill
        style={{
          background: "rgba(23,19,17,0.46)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        }}
      />

      {/* Modal */}
      <AbsoluteFill
        style={{ alignItems: "center", justifyContent: "center" }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
          }}
        >
          {/* Floating eyebrow above modal */}
          <div
            style={{
              opacity: eyebrowOpacity,
              transform: `translateY(${eyebrowY}px)`,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{ width: 46, height: 1, background: "rgba(255,255,255,0.28)" }}
            />
            <span
              style={{
                fontFamily: mono,
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.52)",
              }}
            >
              Watch it in action
            </span>
            <div
              style={{ width: 46, height: 1, background: "rgba(255,255,255,0.28)" }}
            />
          </div>

          {/* Modal panel */}
          <div
            style={{
              width: 1080,
              borderRadius: 36,
              overflow: "hidden",
              background: C.panelStrong,
              border: "1px solid rgba(255,255,255,0.72)",
              borderBottom: "1px solid rgba(255,255,255,0.28)",
              boxShadow: [
                "0 56px 140px rgba(38,29,20,0.28)",
                "0 18px 48px rgba(38,29,20,0.14)",
                "inset 0 1.5px 0 rgba(255,255,255,0.85)",
              ].join(", "),
              transform: `scale(${modalScale}) translateY(${modalY}px)`,
            }}
          >
            {/* Header bar */}
            <div
              style={{
                height: 62,
                padding: "0 26px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: `1px solid ${C.line}`,
                background: "rgba(255,255,255,0.52)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: C.ember,
                    boxShadow: "0 0 14px rgba(178,110,87,0.32)",
                  }}
                />
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: 11,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: C.inkMuted,
                  }}
                >
                  Live session
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: C.inkMuted,
                  }}
                >
                  Case 4471-B · Praxis
                </span>
                {/* Close button */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "rgba(47,39,31,0.06)",
                    border: `1px solid ${C.line}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: 15,
                      lineHeight: 1,
                      color: C.inkMuted,
                    }}
                  >
                    ×
                  </span>
                </div>
              </div>
            </div>

            {/* Video viewport */}
            <div
              style={{
                position: "relative",
                height: 544,
                overflow: "hidden",
                background:
                  "linear-gradient(160deg, #fcfaf4 0%, #f8f4ec 60%, #f6f1ea 100%)",
              }}
            >
              {/* Scaled-down Board */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              >
                <Board scale={0.65} />
              </div>

              {/* Scanline overlay for "screen recording" texture */}
              <AbsoluteFill
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg, rgba(0,0,0,0.016) 0px, rgba(0,0,0,0.016) 1px, transparent 1px, transparent 4px)",
                  pointerEvents: "none",
                  mixBlendMode: "multiply",
                }}
              />

              {/* Bottom gradient + controls */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 56,
                  background:
                    "linear-gradient(transparent, rgba(23,19,17,0.10))",
                  borderTop: `1px solid ${C.line}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "0 26px",
                }}
              >
                {/* Play triangle */}
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderTop: "7px solid transparent",
                    borderBottom: "7px solid transparent",
                    borderLeft: `12px solid ${C.inkSoft}`,
                    flexShrink: 0,
                  }}
                />
                {/* Progress track */}
                <div
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 999,
                    background: "rgba(47,39,31,0.12)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${videoProgress}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: `linear-gradient(90deg, ${C.ember}, rgba(178,110,87,0.55))`,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    color: C.inkMuted,
                    flexShrink: 0,
                  }}
                >
                  0:04
                </span>
              </div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const ClosingMark: React.FC = () => {
  const frame = useCurrentFrame();
  const appear = fade(frame, 620, 660);
  const y = interpolate(spr(frame, 30, 624, 18, 120, 0.88), [0, 1], [24, 0]);

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        opacity: appear,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          transform: `translateY(${y}px)`,
        }}
      >
        <PraxisWordmark compact />
        <div
          style={{
            width: 120,
            height: 1,
            background: "rgba(23,19,17,0.18)",
          }}
        />
        <p
          style={{
            margin: 0,
            fontFamily: mono,
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: C.inkMuted,
          }}
        >
          AI-guided surgical simulation
        </p>
      </div>
    </AbsoluteFill>
  );
};

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const globalOpacity = fade(frame, 670, 700, 1, 0);

  return (
    <AbsoluteFill style={{ opacity: globalOpacity }}>
      <SoftBackground />
      <Atmosphere />
      <TitleScene />
      <HeroScene />
      <DetailScene />
      <WatchScene />
      <ClosingMark />
      <Audio src={staticFile("music.mp3")} />
    </AbsoluteFill>
  );
};
