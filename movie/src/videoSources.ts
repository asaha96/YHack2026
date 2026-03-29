/**
 * videoSources.ts — Real footage slots for each demo scene.
 *
 * When you have a screen recording ready:
 *   1. Drop the .mp4 into  movie/public/footage/
 *   2. Fill in the `src` below (e.g. "footage/upload-demo.mp4")
 *   3. Compute playbackRate = video_duration_seconds / scene_duration_seconds
 *      - Get video duration:  ffprobe -v quiet -show_entries format=duration -of csv=p=0 file.mp4
 *      - Get scene duration:  open Remotion Studio, hover the scene in the timeline
 *      - Example: 8.2s video / 9.4s scene = 0.87
 *   4. Set playbackRate. Values < 1 slow the video down; > 1 speed it up.
 *
 * Scenes with no VideoDropIn (Title, Problem, Hero, Closing) are null and ignored.
 */

export interface VideoSlot {
  /** Path relative to public/, e.g. "footage/upload-demo.mp4" */
  src: string;
  /**
   * video_duration_seconds / scene_duration_seconds.
   * Remotion will stretch or compress the video to exactly fill the scene.
   */
  playbackRate: number;
}

// prettier-ignore
export const VIDEO_SOURCES: (VideoSlot | null)[] = [
  null,  // 0 · TitleScene       — no video panel
  null,  // 1 · ProblemScene     — no video panel

  // ── Screen recordings of the Praxis app ─────────────────────────────────────
  { src: "footage/upload-demo.mp4", playbackRate: 0.87 },  // 2 · UploadScene      — drag-drop a DICOM/CT file → progress bar → case created
  null,  // 3 · ReconstructScene — DICOM slices → 3D volume spinning in the viewer
  null,  // 4 · HandTrackingScene— hand skeleton overlay, pinch gesture navigating anatomy
  null,  // 5 · AIScene          — surgeon types a question, copilot streams an answer
  null,  // 6 · SummaryScene     — surgical summary panel, PDF export flow
  // ────────────────────────────────────────────────────────────────────────────

  null,  // 7 · HeroScene        — no video panel
  null,  // 8 · ClosingScene     — no video panel
];
