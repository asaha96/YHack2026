/**
 * videoSources.ts — Real footage slots for each demo scene.
 *
 * To add a recording:
 *   1. Drop the .mp4 into  movie/public/footage/
 *   2. Fill in the `src` below — duration is measured automatically.
 *
 * calculateMetadata() probes each file with an HTMLVideoElement at build time
 * and computes the exact playbackRate needed to fill the scene, so the video
 * always stays in sync with the audio regardless of clip length changes.
 *
 * Scenes with no VideoDropIn (Title, Problem, Hero, Closing) are null and ignored.
 */

export interface VideoSlot {
  /** Path relative to public/, e.g. "footage/upload-demo.mp4" */
  src: string;
}

// prettier-ignore
export const VIDEO_SOURCES: (VideoSlot | null)[] = [
  null,  // 0 · TitleScene       — no video panel
  null,  // 1 · ProblemScene     — no video panel

  // ── Screen recordings of the Praxis app ─────────────────────────────────────
  { src: "footage/upload-demo.mp4" },  // 2 · UploadScene      — drag-drop DICOM → progress bar → case created
  null,  // 3 · ReconstructScene — DICOM slices → 3D volume spinning in the viewer
  null,  // 4 · HandTrackingScene— hand skeleton overlay, pinch gesture navigating anatomy
  null,  // 5 · AIScene          — surgeon types a question, copilot streams an answer
  null,  // 6 · SummaryScene     — surgical summary panel, PDF export flow
  // ────────────────────────────────────────────────────────────────────────────

  null,  // 7 · HeroScene        — no video panel
  null,  // 8 · ClosingScene     — no video panel
];
