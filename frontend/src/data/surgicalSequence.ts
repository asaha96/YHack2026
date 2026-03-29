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
      "CT imaging has identified a 2.3 centimeter renal mass on the upper pole of the right kidney. We'll perform a laparoscopic partial nephrectomy to remove the mass while preserving kidney function.",
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
      "Isolating the right kidney. We mobilize the colon and dissect Gerota's fascia to expose the kidney surface and identify the tumor.",
  },
  {
    modification: {
      type: "highlight",
      coordinates: [HILUM],
      color: "#818cf8",
      label: "Renal Hilum",
      delay_ms: 7000,
      duration_ms: 800,
      animation: "pulse",
    },
    narration:
      "Identifying the renal hilum — the renal artery, renal vein, and ureter. We'll need vascular control before any resection.",
  },
  {
    modification: {
      type: "zone",
      coordinates: [ARTERY_CLAMP],
      color: "#f59e0b",
      label: "Renal Artery — Clamp",
      radius: 14,
      delay_ms: 10500,
      duration_ms: 800,
      animation: "pulse",
    },
    narration:
      "Clamping the renal artery with a bulldog clamp. Warm ischemia time starts now. We have 20 to 25 minutes to complete the resection and repair.",
  },
  {
    modification: {
      type: "incision",
      coordinates: RESECTION_MARGIN,
      color: "#f87171",
      label: "Resection Margin",
      delay_ms: 14000,
      duration_ms: 1500,
      animation: "draw",
    },
    narration:
      "Scoring the resection margin with cautery — maintaining a 5 millimeter clear margin around the mass. This defines our excision boundary.",
  },
  {
    modification: {
      type: "zone",
      coordinates: [TUMOR_POSITION],
      color: "#34d399",
      label: "Mass Excised",
      radius: 16,
      delay_ms: 17500,
      duration_ms: 800,
      animation: "pulse",
    },
    narration:
      "Mass excised en bloc with clear margins. Sending specimen for frozen section pathology to confirm negative margins before we close.",
  },
  {
    modification: {
      type: "highlight",
      coordinates: [CLOSURE_SITE],
      color: "#a78bfa",
      label: "Renorrhaphy",
      delay_ms: 21000,
      duration_ms: 800,
      animation: "pulse",
    },
    narration:
      "Closing the renal defect. Running renorrhaphy suture with Lapra-Ty clips and bolster material to achieve hemostasis and seal the collecting system.",
  },
  {
    modification: {
      type: "zone",
      coordinates: [HILUM],
      color: "#34d399",
      label: "Clamp Released",
      radius: 14,
      delay_ms: 24500,
      duration_ms: 800,
      animation: "pulse",
    },
    narration:
      "Bulldog clamp released. Warm ischemia time: 18 minutes — well within safe limits. The kidney is reperfusing with good color return.",
  },
  {
    modification: {
      type: "label",
      coordinates: [KIDNEY_CENTER],
      color: "#34d399",
      label: "Procedure Complete — EBL 150cc",
      delay_ms: 28000,
      duration_ms: 600,
      animation: "fade",
    },
    narration:
      "Partial nephrectomy complete. Estimated blood loss 150 cc. Kidney function preserved. Frozen section confirms negative margins — no residual tumor.",
  },
];
