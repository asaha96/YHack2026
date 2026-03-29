import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, fade, mono, sans, serif } from "../constants";
import { HeaderBar, PanelShell } from "./Panels";

export const AnatomyDiagram: React.FC = () => {
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

export const AnatomyStage: React.FC<{ large?: boolean }> = ({
  large = false,
}) => {
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
        background:
          "linear-gradient(180deg, rgba(247,244,239,0.9), rgba(252,249,244,0.96))",
      }}
    >
      <HeaderBar
        title="Anatomy"
        detail={large ? "Live patient model" : "Volume study"}
      />
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
      {/* Scan line */}
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
        {
          label: "portal vein",
          top: large ? "41%" : "44%",
          left: large ? "70%" : "68%",
          color: C.ember,
        },
        {
          label: "left lung",
          top: large ? "32%" : "32%",
          left: large ? "17%" : "18%",
          color: C.accent,
        },
        {
          label: "safe plane",
          top: large ? "74%" : "70%",
          left: large ? "58%" : "56%",
          color: C.sage,
        },
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

export const WorkflowColumn: React.FC = () => {
  const steps: [string, string, boolean][] = [
    ["Upload", "DICOM stack received", true],
    ["Reconstruct", "Patient volume resolved", true],
    ["Annotate", "Critical structures mapped", true],
    ["Simulate", "Live rehearsal ready", false],
  ];

  return (
    <div style={{ height: "100%", background: "rgba(255,255,255,0.26)" }}>
      <HeaderBar title="Workflow" detail="Case 4471-B" />
      <div
        style={{
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
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
              borderTop:
                i === 0 ? "1px solid rgba(47,39,31,0.08)" : undefined,
              borderBottom: "1px solid rgba(47,39,31,0.08)",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                border: `1px solid ${done ? "rgba(130,144,125,0.26)" : "rgba(47,39,31,0.12)"}`,
                background: done
                  ? "rgba(130,144,125,0.08)"
                  : "rgba(255,255,255,0.36)",
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

export const GuidanceColumn: React.FC = () => {
  return (
    <div style={{ height: "100%", background: "rgba(255,255,255,0.26)" }}>
      <HeaderBar title="Guidance" detail="Risk-aware" />
      <div
        style={{
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
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
        {(
          [
            [
              "assistant",
              "Reconstruction complete. Critical structures aligned to this patient.",
            ],
            ["surgeon", "What is the safest incision corridor?"],
            [
              "assistant",
              "Favor a left subcostal path. Hold 12 mm of clearance from the hepatic artery.",
            ],
          ] as [string, string][]
        ).map(([role, body], i) => (
          <div
            key={`${role}-${i}`}
            style={{
              padding: "16px 18px",
              borderRadius: 22,
              background:
                role === "surgeon"
                  ? "rgba(233,227,218,0.56)"
                  : "rgba(255,255,255,0.5)",
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
            <span style={{ fontFamily: mono, fontSize: 11, color: C.inkMuted }}>
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
                borderRadius: 999,
                background:
                  "linear-gradient(90deg, rgba(178,110,87,0.76), rgba(178,110,87,0.22))",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export const Board: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
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
      {/* Shimmer sweep */}
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
