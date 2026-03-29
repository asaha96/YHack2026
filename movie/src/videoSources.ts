/**
 * videoSources.ts — Real footage slots for each demo scene.
 *
 * When you have a screen recording ready:
 *   1. Drop the .mp4 into  movie/public/footage/
 *   2. Fill in the `src` and `durationInSeconds` below.
 *      Get duration:  ffprobe -v quiet -show_entries format=duration -of csv=p=0 file.mp4
 *
 * VideoDropIn reads `durationInSeconds` and computes the exact playbackRate at
 * render time using the live scene duration — so the video always fills the
 * scene perfectly even when audio changes the scene length.
 *
 * Scenes with no VideoDropIn (Title, Problem, Hero, Closing) are null and ignored.
 */

export interface VideoSlot {
  /** Path relative to public/, e.g. "footage/upload-demo.mp4" */
  src: string;
  /**
   * Native length of the video file in seconds.
   * Run:  ffprobe -v quiet -show_entries format=duration -of csv=p=0 file.mp4
   */
  durationInSeconds: number;
}

// prettier-ignore
export const VIDEO_SOURCES: (VideoSlot | null)[] = [
  null,  // 0 · TitleScene       — no video panel
  null,  // 1 · ProblemScene     — no video panel

  // ── Screen recordings of the Praxis app ─────────────────────────────────────
  { src: "footage/upload-demo.mp4", durationInSeconds: 44.233 },  // 2 · UploadScene
  null,  // 3 · ReconstructScene — DICOM slices → 3D volume spinning in the viewer
  null,  // 4 · HandTrackingScene— hand skeleton overlay, pinch gesture navigating anatomy
  null,  // 5 · AIScene          — surgeon types a question, copilot streams an answer
  null,  // 6 · SummaryScene     — surgical summary panel, PDF export flow
  // ────────────────────────────────────────────────────────────────────────────

  null,  // 7 · HeroScene        — no video panel
  null,  // 8 · ClosingScene     — no video panel
];
