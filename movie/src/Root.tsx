import React from "react";
import { Composition, staticFile } from "remotion";
import { getAudioDuration } from "@remotion/media-utils";
import { Intro } from "./Intro";
import type { IntroProps } from "./Intro";
import { SCENE_NARRATIONS } from "./components/Subtitles";

const FPS = 30;

// Extra frames after the last audio clip in each scene (1 second of breathing room).
const TRAIL_FRAMES = 30;

// Fallback props used in Remotion Studio before calculateMetadata resolves.
const DEFAULT_PROPS: IntroProps = {
  sceneStarts: [0, 200, 400, 600, 800, 1000, 1200, 1400, 1600],
  sceneDurations: Array(9).fill(200) as number[],
  clipFromFrames: [18, 98, 214, 314, 414, 492, 614, 710, 814, 906, 1014, 1092, 1214, 1296, 1414, 1500, 1620, 1696],
  audioDurations: Array(18).fill(150) as number[],
};

async function calculateMetadata() {
  const allClips = SCENE_NARRATIONS.flat();

  // Measure every audio clip (getAudioDuration returns seconds → convert to frames)
  const clipSeconds = await Promise.all(
    allClips.map((clip) => getAudioDuration(staticFile(`narration/${clip.audio}`)))
  );
  const audioDurations = clipSeconds.map((s) => Math.ceil(s * FPS));

  // Build scene starts, durations, and per-clip absolute from-frames.
  // Within each scene, clips play sequentially: clip N+1 starts no earlier
  // than clip N ends (no overlap). Scene duration grows to fit.
  const sceneStarts: number[] = [];
  const sceneDurations: number[] = [];
  const clipFromFrames: number[] = [];
  let currentFrame = 0;
  let clipIdx = 0;
  let prevClipEnd = 0; // tracks the end of the last clip globally

  for (const sceneClips of SCENE_NARRATIONS) {
    sceneStarts.push(currentFrame);

    let sceneMaxEnd = 0;
    for (const clip of sceneClips) {
      // Natural start = scene start + relative offset, but never before prev clip ends
      const naturalFrom = currentFrame + clip.offset;
      const from = Math.max(naturalFrom, prevClipEnd);
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

  const props: IntroProps = { sceneStarts, sceneDurations, clipFromFrames, audioDurations };
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
