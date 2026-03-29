import React from "react";
import { Composition, staticFile } from "remotion";
import { getAudioDuration } from "@remotion/media-utils";
import { Intro } from "./Intro";
import type { IntroProps } from "./Intro";
import { SCENE_NARRATIONS } from "./components/Subtitles";
import { VIDEO_SOURCES } from "./videoSources";

const FPS = 30;

// Extra frames after the last audio clip in each scene (1 second of breathing room).
const TRAIL_FRAMES = 30;

// Gap between consecutive clips within the same scene when connecting them (0.4 s).
const INTER_CLIP_GAP = Math.round(0.4 * FPS);

// Fallback props used in Remotion Studio before calculateMetadata resolves.
const DEFAULT_PROPS: IntroProps = {
  sceneStarts: [0, 200, 400, 600, 800, 1000, 1200, 1400, 1600],
  sceneDurations: Array(9).fill(200) as number[],
  clipFromFrames: [18, 98, 214, 314, 414, 492, 614, 710, 814, 906, 1014, 1092, 1214, 1296, 1414, 1500, 1620, 1696],
  audioDurations: Array(18).fill(150) as number[],
  videoPlaybackRates: Array(9).fill(null) as (number | null)[],
};

/** Probe a video file's native duration using an HTMLVideoElement (runs in Chromium). */
function getVideoDurationInSeconds(src: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.onloadedmetadata = () => {
      resolve(video.duration);
      video.src = ""; // release
    };
    video.onerror = () => reject(new Error(`Cannot probe video: ${src}`));
    video.src = src;
    video.load();
  });
}

async function calculateMetadata() {
  const allClips = SCENE_NARRATIONS.flat();

  // ── 1. Measure audio clips ─────────────────────────────────────────────────
  const clipSeconds = await Promise.all(
    allClips.map((clip) => getAudioDuration(staticFile(`narration/${clip.audio}`)))
  );
  const audioDurations = clipSeconds.map((s) => Math.ceil(s * FPS));

  // ── 2. Build scene timeline (audio-driven) ─────────────────────────────────
  const sceneStarts: number[] = [];
  const sceneDurations: number[] = [];
  const clipFromFrames: number[] = [];
  let currentFrame = 0;
  let clipIdx = 0;
  let prevClipEnd = 0;

  for (const sceneClips of SCENE_NARRATIONS) {
    sceneStarts.push(currentFrame);

    let sceneMaxEnd = 0;
    let isFirstInScene = true;
    for (const clip of sceneClips) {
      const naturalFrom = currentFrame + clip.offset;
      const connectedFrom = prevClipEnd + INTER_CLIP_GAP;
      const from = isFirstInScene
        ? Math.max(naturalFrom, prevClipEnd)
        : Math.max(naturalFrom, connectedFrom);
      isFirstInScene = false;
      clipFromFrames.push(from);

      const end = from + audioDurations[clipIdx];
      prevClipEnd = end;
      if (end - currentFrame > sceneMaxEnd) sceneMaxEnd = end - currentFrame;
      clipIdx++;
    }

    const duration = sceneMaxEnd + TRAIL_FRAMES;
    sceneDurations.push(duration);
    currentFrame += duration;
  }

  // ── 3. Probe video files and compute per-scene playback rates ──────────────
  const videoPlaybackRates: (number | null)[] = await Promise.all(
    VIDEO_SOURCES.map(async (slot, i) => {
      if (!slot) return null;
      try {
        const videoDuration = await getVideoDurationInSeconds(staticFile(slot.src));
        const sceneDurationSeconds = sceneDurations[i] / FPS;
        return videoDuration / sceneDurationSeconds;
      } catch {
        // File not found or unreadable — fall back to animated mock
        return null;
      }
    })
  );

  const props: IntroProps = {
    sceneStarts,
    sceneDurations,
    clipFromFrames,
    audioDurations,
    videoPlaybackRates,
  };
  return { durationInFrames: currentFrame, props };
}

export const RemotionRoot: React.FC = () => {
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Composition
      id="Intro"
      component={Intro as any}
      durationInFrames={1800}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={DEFAULT_PROPS as any}
      calculateMetadata={calculateMetadata as any}
    />
  );
};
