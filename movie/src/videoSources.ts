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
 * Scenes with no VideoDropIn (Title, Problem, Founders, Hero, Closing) are null and ignored.
 */

export interface VideoSlot {
  /** Path relative to public/, e.g. "footage/upload-demo.mp4" */
  src: string;
  /** When true, keep native speed and let this video define the scene duration. */
  useNativeDuration?: boolean;
}

// prettier-ignore
export const VIDEO_SOURCES: (VideoSlot | null)[] = [
  null,  // 0 · TitleScene       — no video panel
  null,  // 1 · ProblemScene     — no video panel
  { src: "footage/intro.mp4", useNativeDuration: true },  // 2 · FoundersScene    — team intro video with embedded audio
  { src: "footage/mainpage.mp4" },  // 3 · HeroScene        — no video panel

  // ── Screen recordings of the Praxis app ─────────────────────────────────────
  { src: "footage/upload-demo.mp4" },  // 4 · UploadScene      — drag-drop DICOM → progress bar → case created
  null,  // 5 · ReconstructScene — DICOM slices → 3D volume spinning in the viewer
  null,  // 6 · HandTrackingScene— hand skeleton overlay, pinch gesture navigating anatomy
  null,  // 7 · AIScene          — surgeon types a question, copilot streams an answer
  null,  // 8 · SummaryScene     — surgical summary panel, PDF export flow
  // ────────────────────────────────────────────────────────────────────────────

  null,  // 9 · ClosingScene     — no video panel
];
