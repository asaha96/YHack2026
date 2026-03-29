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
  sceneStarts: [0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000],
  sceneDurations: Array(11).fill(200) as number[],
  clipFromFrames: [18, 214, 414, 614, 814, 1014, 1214, 1414, 1614, 1814],
  audioDurations: Array(10).fill(150) as number[],
  clipAudioFiles: Array(10).fill(null) as (string | null)[],
  videoPlaybackRates: Array(11).fill(null) as (number | null)[],
  resolvedVideoSrcs: Array(11).fill(null) as (string | null)[],
  sceneUsesEmbeddedAudio: Array(11).fill(false) as boolean[],
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

  // ── 1. Measure clip and video durations ────────────────────────────────────
  const audioDurations = await Promise.all(
    allClips.map(async (clip) => {
      if (!clip.audio) return 0;
      const seconds = await getAudioDuration(staticFile(`narration/${clip.audio}`));
      return Math.ceil(seconds * FPS);
    })
  );

  const videoDurations = await Promise.all(
    VIDEO_SOURCES.map(async (slot) => {
      if (!slot) return null;
      try {
        const seconds = await getVideoDurationInSeconds(staticFile(slot.src));
        return Math.ceil(seconds * FPS);
      } catch {
        return null;
      }
    })
  );
  const resolvedVideoSrcs = VIDEO_SOURCES.map((slot, i) => (slot && videoDurations[i] ? slot.src : null));
  const sceneUsesEmbeddedAudio = VIDEO_SOURCES.map(
    (slot, i) => Boolean(slot?.useEmbeddedAudio && resolvedVideoSrcs[i])
  );

  // ── 2. Build scene timeline (audio-driven) ─────────────────────────────────
  const sceneStarts: number[] = [];
  const sceneDurations: number[] = [];
  const clipFromFrames: number[] = [];
  const clipAudioFiles: (string | null)[] = [];
  let currentFrame = 0;
  let clipIdx = 0;
  let prevClipEnd = 0;

  for (const [sceneIdx, sceneClips] of SCENE_NARRATIONS.entries()) {
    sceneStarts.push(currentFrame);

    let sceneMaxEnd = 0;
    let isFirstInScene = true;
    const slot = VIDEO_SOURCES[sceneIdx];
    const resolvedVideoSrc = resolvedVideoSrcs[sceneIdx];
    const nativeDuration = slot?.useNativeDuration ? videoDurations[sceneIdx] ?? 0 : 0;
    const useEmbeddedAudio = Boolean(slot?.useEmbeddedAudio && resolvedVideoSrc);
    const nextSlot = VIDEO_SOURCES[sceneIdx + 1];
    const nextUsesEmbeddedAudio = Boolean(nextSlot?.useEmbeddedAudio && resolvedVideoSrcs[sceneIdx + 1]);

    for (const clip of sceneClips) {
      const naturalFrom = currentFrame + clip.offset;
      const connectedFrom = prevClipEnd + INTER_CLIP_GAP;
      const from = isFirstInScene
        ? Math.max(naturalFrom, prevClipEnd)
        : Math.max(naturalFrom, connectedFrom);
      isFirstInScene = false;
      clipFromFrames.push(from);
      const externalAudio = useEmbeddedAudio ? null : clip.audio ?? null;
      clipAudioFiles.push(externalAudio);

      const clipDuration = externalAudio
        ? audioDurations[clipIdx]
        : Math.max(150, nativeDuration - (from - currentFrame));
      audioDurations[clipIdx] = clipDuration;

      const end = from + clipDuration;
      prevClipEnd = end;
      if (end - currentFrame > sceneMaxEnd) sceneMaxEnd = end - currentFrame;
      clipIdx++;
    }

    const trailFrames = nextUsesEmbeddedAudio ? 0 : TRAIL_FRAMES;
    const duration = nativeDuration || sceneMaxEnd + trailFrames;
    sceneDurations.push(duration);
    currentFrame += duration;
  }

  // ── 3. Probe video files and compute per-scene playback rates ──────────────
  const videoPlaybackRates: (number | null)[] = VIDEO_SOURCES.map((slot, i) => {
    if (!slot) return null;
    if (slot.useNativeDuration) return 1;

    const videoDuration = videoDurations[i];
    if (!videoDuration) return null;

    return videoDuration / sceneDurations[i];
  });

  const props: IntroProps = {
    sceneStarts,
    sceneDurations,
    clipFromFrames,
    audioDurations,
    clipAudioFiles,
    videoPlaybackRates,
    resolvedVideoSrcs,
    sceneUsesEmbeddedAudio,
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
