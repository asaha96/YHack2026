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
  /** When true, suppress separate narration audio and use the video's audio track. */
  useEmbeddedAudio?: boolean;
}

// prettier-ignore
export const VIDEO_SOURCES: (VideoSlot | null)[] = [
  { src: "footage/title-slide.mp4", useNativeDuration: true, useEmbeddedAudio: true },  // 0 · TitleScene       — title footage with embedded audio
  { src: "footage/problem-slide.mp4", useNativeDuration: true, useEmbeddedAudio: true },  // 1 · ProblemScene     — problem footage with embedded audio
  { src: "footage/intro.mp4", useNativeDuration: true },  // 2 · FoundersScene    — team intro video with embedded audio
  { src: "footage/mainpage.mp4" },  // 3 · HeroScene        — main workspace screen recording

  // ── Screen recordings of the Praxis app ─────────────────────────────────────
  { src: "footage/upload-demo.mp4" },  // 4 · UploadScene      — drag-drop DICOM → progress bar → case created
  { src: "footage/agent_quick.mp4" },  // 5 · ReconstructScene — K2 thinking agents / reconstruction demo
  { src: "footage/handuse.mp4" },  // 6 · HandTrackingScene — hand-use demo for line-07
  { src: "footage/demo_agent.mp4", useNativeDuration: true, useEmbeddedAudio: true },  // 7 · DemoAgentScene   — agent demo clip with embedded audio
  null,  // 8 · AIScene          — surgeon types a question, copilot streams an answer
  null,  // 9 · SummaryScene     — surgical summary panel, PDF export flow
  // ────────────────────────────────────────────────────────────────────────────

  null,  // 10 · ClosingScene    — no video panel
];
