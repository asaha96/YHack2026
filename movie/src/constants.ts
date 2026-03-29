import { interpolate, spring } from "remotion";

export const C = {
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
  gold: "#c4932a",
  shadow: "rgba(38, 29, 20, 0.1)",
  shadowDeep: "rgba(38, 29, 20, 0.16)",
};

export const serif =
  "'Iowan Old Style', 'Baskerville', 'Palatino Linotype', 'Book Antiqua', Georgia, serif";
export const sans = "'Helvetica Neue', Arial, sans-serif";
export const mono = "'SFMono-Regular', 'Menlo', monospace";

export const spr = (
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

export const fade = (
  frame: number,
  start: number,
  end: number,
  from = 0,
  to = 1
) =>
  interpolate(frame, [start, end], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
