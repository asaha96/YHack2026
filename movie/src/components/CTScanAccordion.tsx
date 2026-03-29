import React from "react";
import { interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, fade, mono, serif, sans } from "../constants";

const SCANS = [
  { file: "ct/ct-01.jpg", label: "Axial · L1", sublabel: "Liver · Portal phase" },
  { file: "ct/ct-02.jpg", label: "Axial · L2", sublabel: "Hepatic veins" },
  { file: "ct/ct-03.jpg", label: "Coronal", sublabel: "Biliary tree" },
  { file: "ct/ct-04.jpg", label: "Sagittal", sublabel: "Vascular anatomy" },
  { file: "ct/ct-05.jpg", label: "Axial · L3", sublabel: "Tumor margin" },
  { file: "ct/ct-06.jpg", label: "MPR", sublabel: "3D reconstruction ref." },
];

// How many frames each panel stays "active" before advancing
const DWELL = 24;
// Transition overlap in frames
const TRANSITION = 12;

export const CTScanAccordion: React.FC = () => {
  const frame = useCurrentFrame();

  // Cycle the active panel index slowly through all 6
  const cycleFrames = DWELL * SCANS.length;
  const cycleFrame = frame % cycleFrames;
  const rawActive = Math.floor(cycleFrame / DWELL);
  const activeIndex = Math.min(rawActive, SCANS.length - 1);

  // Width fractions — active panel takes ~40%, rest split the remaining 60%
  const getWidth = (i: number) => {
    const isActive = i === activeIndex;
    const nextActive = (activeIndex + 1) % SCANS.length;
    const isNext = i === nextActive;

    // Smooth transition between current and next panel
    const transitionProgress = interpolate(
      cycleFrame % DWELL,
      [DWELL - TRANSITION, DWELL],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    if (isActive) return interpolate(transitionProgress, [0, 1], [40, 20]);
    if (isNext) return interpolate(transitionProgress, [0, 1], [12, 40]);
    return 12;
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0b0908",
        display: "flex",
        flexDirection: "row",
        gap: 3,
        padding: 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {SCANS.map((scan, i) => {
        const widthPct = getWidth(i);
        const isActive = i === activeIndex;
        const labelOpacity = isActive
          ? fade(frame % DWELL, 2, 10)
          : interpolate(
              (cycleFrame % DWELL),
              [DWELL - TRANSITION, DWELL],
              [i === (activeIndex + 1) % SCANS.length ? 0 : 0, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

        return (
          <div
            key={i}
            style={{
              position: "relative",
              width: `${widthPct}%`,
              height: "100%",
              overflow: "hidden",
              transition: "width 0.05s",
              flexShrink: 0,
            }}
          >
            {/* CT image */}
            <img
              src={staticFile(scan.file)}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center",
                filter: isActive
                  ? "brightness(0.95) contrast(1.08)"
                  : "brightness(0.55) contrast(1.02) saturate(0.7)",
              }}
            />

            {/* Subtle gradient overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: isActive
                  ? "linear-gradient(to top, rgba(11,9,8,0.72) 0%, transparent 55%)"
                  : "linear-gradient(to top, rgba(11,9,8,0.9) 0%, rgba(11,9,8,0.3) 100%)",
              }}
            />

            {/* Active: amber left border */}
            {isActive && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: `linear-gradient(to bottom, transparent, ${C.ember}, transparent)`,
                  opacity: fade(frame % DWELL, 2, 10),
                }}
              />
            )}

            {/* Collapsed: vertical label */}
            {!isActive && (
              <div
                style={{
                  position: "absolute",
                  bottom: 28,
                  left: 0,
                  right: 0,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: 9,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "rgba(200,188,176,0.45)",
                    writingMode: "vertical-rl",
                    textOrientation: "mixed",
                    transform: "rotate(180deg)",
                  }}
                >
                  {scan.label}
                </span>
              </div>
            )}

            {/* Active: bottom info panel */}
            {isActive && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: "20px 24px",
                  opacity: fade(frame % DWELL, 3, 14),
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: serif,
                        fontSize: 18,
                        color: "rgba(245,240,230,0.95)",
                        letterSpacing: "-0.02em",
                        lineHeight: 1.1,
                      }}
                    >
                      {scan.label}
                    </div>
                    <div
                      style={{
                        fontFamily: mono,
                        fontSize: 10,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "rgba(200,188,176,0.65)",
                        marginTop: 5,
                      }}
                    >
                      {scan.sublabel}
                    </div>
                  </div>

                  {/* Slice counter */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 12px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: C.ember,
                        boxShadow: `0 0 6px ${C.ember}`,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: mono,
                        fontSize: 9,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: "rgba(200,188,176,0.7)",
                      }}
                    >
                      {i + 1} / {SCANS.length}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Index pip at top */}
            <div
              style={{
                position: "absolute",
                top: 14,
                left: "50%",
                transform: "translateX(-50%)",
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: isActive
                  ? C.ember
                  : "rgba(200,188,176,0.2)",
                boxShadow: isActive ? `0 0 8px ${C.ember}` : "none",
              }}
            />
          </div>
        );
      })}

      {/* Top HUD strip */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background:
            "linear-gradient(to bottom, rgba(11,9,8,0.7) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontFamily: mono,
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(200,188,176,0.55)",
          }}
        >
          DICOM · Case 4471-B · 6 series
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {SCANS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === activeIndex ? 18 : 5,
                height: 3,
                borderRadius: 999,
                background:
                  i === activeIndex
                    ? C.ember
                    : "rgba(200,188,176,0.22)",
                transition: "width 0.08s",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
