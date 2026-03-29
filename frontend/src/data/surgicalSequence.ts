import type { Modification } from "../utils/api";

// ── Tumor placement (anatomy-local coordinates) ─────────────────────
// Upper pole of right kidney
export const TUMOR_POSITION: [number, number, number] = [120, -80, 870];
export const TUMOR_RADIUS = 12;

// Nearby anatomical landmarks for annotation placement
const KIDNEY_CENTER: [number, number, number] = [110, -100, 900];
const HILUM: [number, number, number] = [80, -110, 890];
const ARTERY_CLAMP: [number, number, number] = [50, -100, 880];
const CLOSURE_SITE: [number, number, number] = [115, -85, 875];

// Resection margin: arc of points around the tumor
const RESECTION_MARGIN: number[][] = [
  [135, -68, 860],
  [140, -75, 870],
  [135, -85, 880],
  [120, -92, 885],
  [105, -88, 882],
  [100, -78, 872],
  [105, -68, 862],
  [120, -65, 858],
  [135, -68, 860], // close the loop
];

// ── Surgical steps ──────────────────────────────────────────────────

export interface SurgicalStep {
  modification: Modification;
  narration: string;
}

export const SURGICAL_STEPS: SurgicalStep[] = [
  {
    modification: {
      type: "zone",
      coordinates: [TUMOR_POSITION],
      color: "#ef4444",
      label: "Renal Mass (2.3cm)",
      radius: 18,
      delay_ms: 0,
      duration_ms: 1200,
      animation: "pulse",
    },
    narration:
      "Alright, I can see the mass right here on the upper pole. Two point three centimeters. We're going to do a partial nephrectomy — take the tumor, save the kidney.",
  },
  {
    modification: {
      type: "highlight",
      coordinates: [KIDNEY_CENTER],
      color: "#2dd4bf",
      label: "Right Kidney",
      delay_ms: 3500,
      duration_ms: 800,
      animation: "pulse",
    },
    narration:
      "Mobilizing the kidney now. Getting Gerota's fascia off so we can see what we're working with.",
  },
  {
    modification: {
      type: "highlight",
      coordinates: [HILUM],
      color: "#818cf8",
      label: "Renal Hilum",
      delay_ms: 6500,
      duration_ms: 800,
      animation: "pulse",
    },
    narration:
      "There's the hilum. Artery, vein, ureter — all identified. Need control here before we cut anything.",
  },
  {
    modification: {
      type: "zone",
      coordinates: [ARTERY_CLAMP],
      color: "#f59e0b",
      label: "Renal Artery — Clamp",
      radius: 14,
      delay_ms: 9500,
      duration_ms: 800,
      animation: "pulse",
    },
    narration:
      "Clamping the artery. Clock starts now — we've got about twenty minutes of warm ischemia.",
  },
  {
    modification: {
      type: "incision",
      coordinates: RESECTION_MARGIN,
      color: "#f87171",
      label: "Resection Margin",
      delay_ms: 12000,
      duration_ms: 1500,
      animation: "draw",
    },
    narration:
      "Scoring the margin. Five millimeters clear all the way around.",
  },
  {
    modification: {
      type: "zone",
      coordinates: [TUMOR_POSITION],
      color: "#34d399",
      label: "Mass Excised",
      radius: 16,
      delay_ms: 15000,
      duration_ms: 800,
      animation: "pulse",
    },
    narration:
      "Mass is out. Sending it for frozen section now.",
  },
  {
    modification: {
      type: "highlight",
      coordinates: [CLOSURE_SITE],
      color: "#a78bfa",
      label: "Renorrhaphy",
      delay_ms: 17500,
      duration_ms: 800,
      animation: "pulse",
    },
    narration:
      "Closing the defect. Running suture with bolsters for hemostasis.",
  },
  {
    modification: {
      type: "zone",
      coordinates: [HILUM],
      color: "#34d399",
      label: "Clamp Released",
      radius: 14,
      delay_ms: 20000,
      duration_ms: 800,
      animation: "pulse",
    },
    narration:
      "Clamp off. Eighteen minutes ischemia. Good color, kidney's perfusing well.",
  },
  {
    modification: {
      type: "label",
      coordinates: [KIDNEY_CENTER],
      color: "#34d399",
      label: "Procedure Complete",
      delay_ms: 22500,
      duration_ms: 600,
      animation: "fade",
    },
    narration:
      "That's it. Margins are clear on frozen. Hundred fifty cc blood loss. Good result.",
  },
];
