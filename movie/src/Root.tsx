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
  audioDurations: Array(18).fill(150) as number[],
};

async function calculateMetadata() {
  const allClips = SCENE_NARRATIONS.flat();

  // Measure every audio clip (getAudioDuration returns seconds → convert to frames)
  const clipSeconds = await Promise.all(
    allClips.map((clip) => getAudioDuration(staticFile(`narration/${clip.audio}`)))
  );
  const audioDurations = clipSeconds.map((s) => Math.ceil(s * FPS));

  // Build scene starts and durations:
  // Each scene lasts until the end of its longest clip + TRAIL_FRAMES.
  const sceneStarts: number[] = [];
  const sceneDurations: number[] = [];
  let currentFrame = 0;
  let clipIdx = 0;

  for (const sceneClips of SCENE_NARRATIONS) {
    sceneStarts.push(currentFrame);

    let maxEnd = 0;
    for (const clip of sceneClips) {
      const end = clip.offset + audioDurations[clipIdx];
      if (end > maxEnd) maxEnd = end;
      clipIdx++;
    }

    const duration = maxEnd + TRAIL_FRAMES;
    sceneDurations.push(duration);
    currentFrame += duration;
  }

  const props: IntroProps = { sceneStarts, sceneDurations, audioDurations };
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
