import { staticFile } from "remotion";
import type { SubtitleEntry, SubtitleStyle } from "./components/Subtitles";

export const MOVIE_FPS = 30;
const AUDIO_PADDING_FRAMES = 6;
const LINE_GAP_FRAMES = 8;
const SCENE_TAIL_FRAMES = 24;

export type SceneId =
  | "title"
  | "problem"
  | "upload"
  | "reconstruct"
  | "handTracking"
  | "ai"
  | "summary"
  | "hero"
  | "closing";

export interface SceneTiming {
  id: SceneId;
  from: number;
  durationInFrames: number;
}

export interface TimelineData {
  scenes: SceneTiming[];
  subtitles: SubtitleEntry[];
  durationInFrames: number;
}

interface SceneTemplate {
  id: SceneId;
  minDurationInFrames: number;
}

interface SubtitleTemplate {
  sceneId: SceneId;
  offsetInFrames: number;
  minDurationInFrames: number;
  text: string;
  style?: SubtitleStyle;
  audio: string;
}

const SCENE_TEMPLATES: SceneTemplate[] = [
  { id: "title", minDurationInFrames: 180 },
  { id: "problem", minDurationInFrames: 180 },
  { id: "upload", minDurationInFrames: 180 },
  { id: "reconstruct", minDurationInFrames: 180 },
  { id: "handTracking", minDurationInFrames: 180 },
  { id: "ai", minDurationInFrames: 180 },
  { id: "summary", minDurationInFrames: 180 },
  { id: "hero", minDurationInFrames: 180 },
  { id: "closing", minDurationInFrames: 150 },
];

const SUBTITLE_TEMPLATES: SubtitleTemplate[] = [
  {
    sceneId: "title",
    offsetInFrames: 15,
    minDurationInFrames: 71,
    text: "Meet Praxis.",
    style: "punchline",
    audio: "line-01.mp3",
  },
  {
    sceneId: "title",
    offsetInFrames: 90,
    minDurationInFrames: 79,
    text: "It knows your patient before you do.",
    audio: "line-02.mp3",
  },
  {
    sceneId: "problem",
    offsetInFrames: 15,
    minDurationInFrames: 136,
    text: "Most surgeons see their patient's anatomy for the first time. In the OR.",
    audio: "line-03.mp3",
  },
  {
    sceneId: "problem",
    offsetInFrames: 160,
    minDurationInFrames: 81,
    text: "Surgeons practice on real patients. Which is… fine. (It's not fine.)",
    audio: "line-04.mp3",
  },
  {
    sceneId: "upload",
    offsetInFrames: 10,
    minDurationInFrames: 61,
    text: "But we thought we could build something better.",
    style: "punchline",
    audio: "line-05.mp3",
  },
  {
    sceneId: "upload",
    offsetInFrames: 75,
    minDurationInFrames: 94,
    text: "Upload a CT or MRI scan. Any scan. Yes, even that one.",
    audio: "line-06.mp3",
  },
  {
    sceneId: "reconstruct",
    offsetInFrames: 10,
    minDurationInFrames: 89,
    text: "Praxis reconstructs the full 3D anatomy in seconds.",
    audio: "line-07.mp3",
  },
  {
    sceneId: "reconstruct",
    offsetInFrames: 103,
    minDurationInFrames: 68,
    text: "Your patient's actual liver. Their actual heart.",
    audio: "line-08.mp3",
  },
  {
    sceneId: "handTracking",
    offsetInFrames: 10,
    minDurationInFrames: 81,
    text: "Rehearse the operation with your real hands.",
    audio: "line-09.mp3",
  },
  {
    sceneId: "handTracking",
    offsetInFrames: 95,
    minDurationInFrames: 76,
    text: "No $50k haptic gloves. Just a webcam and courage.",
    audio: "line-10.mp3",
  },
  {
    sceneId: "ai",
    offsetInFrames: 8,
    minDurationInFrames: 71,
    text: "Stuck? Ask the AI anything.",
    style: "punchline",
    audio: "line-11.mp3",
  },
  {
    sceneId: "ai",
    offsetInFrames: 83,
    minDurationInFrames: 86,
    text: "Like a brilliant colleague who never says 'just Google it.'",
    audio: "line-12.mp3",
  },
  {
    sceneId: "summary",
    offsetInFrames: 8,
    minDurationInFrames: 81,
    text: "Export the full surgical plan to PDF.",
    audio: "line-13.mp3",
  },
  {
    sceneId: "summary",
    offsetInFrames: 93,
    minDurationInFrames: 78,
    text: "Print it. Frame it. Impress your attendings.",
    audio: "line-14.mp3",
  },
  {
    sceneId: "hero",
    offsetInFrames: 8,
    minDurationInFrames: 81,
    text: "Workflow. Anatomy. Guidance. All in one platform.",
    audio: "line-15.mp3",
  },
  {
    sceneId: "hero",
    offsetInFrames: 93,
    minDurationInFrames: 76,
    text: "Because the OR is not the place to wing it.",
    audio: "line-16.mp3",
  },
  {
    sceneId: "closing",
    offsetInFrames: 15,
    minDurationInFrames: 66,
    text: "Praxis.",
    style: "punchline",
    audio: "line-17.mp3",
  },
  {
    sceneId: "closing",
    offsetInFrames: 85,
    minDurationInFrames: 54,
    text: "Practice makes perfect. Now you can.",
    audio: "line-18.mp3",
  },
];

const toFrameCount = (seconds: number) =>
  Math.max(1, Math.ceil(seconds * MOVIE_FPS) + AUDIO_PADDING_FRAMES);

export const buildTimelineData = (
  audioDurationsInSeconds: Record<string, number | undefined>
): TimelineData => {
  const scenes: SceneTiming[] = [];
  const subtitles: SubtitleEntry[] = [];

  let currentSceneStart = 0;

  for (const scene of SCENE_TEMPLATES) {
    const sceneEntries = SUBTITLE_TEMPLATES.filter(
      (entry) => entry.sceneId === scene.id
    );

    let previousLineEndExclusive = 0;

    for (const entry of sceneEntries) {
      const audioFrames = audioDurationsInSeconds[entry.audio]
        ? toFrameCount(audioDurationsInSeconds[entry.audio] as number)
        : 0;

      const lineDurationInFrames = Math.max(
        entry.minDurationInFrames,
        audioFrames
      );

      const plannedStart = entry.offsetInFrames;
      const safeStart =
        previousLineEndExclusive === 0
          ? plannedStart
          : Math.max(
              plannedStart,
              previousLineEndExclusive + LINE_GAP_FRAMES
            );

      const lineEndExclusive = safeStart + lineDurationInFrames;
      previousLineEndExclusive = lineEndExclusive;

      subtitles.push({
        from: currentSceneStart + safeStart,
        to: currentSceneStart + lineEndExclusive - 1,
        text: entry.text,
        style: entry.style,
        audio: entry.audio,
      });
    }

    const sceneDurationInFrames = Math.max(
      scene.minDurationInFrames,
      previousLineEndExclusive + SCENE_TAIL_FRAMES
    );

    scenes.push({
      id: scene.id,
      from: currentSceneStart,
      durationInFrames: sceneDurationInFrames,
    });

    currentSceneStart += sceneDurationInFrames;
  }

  return {
    scenes,
    subtitles,
    durationInFrames: currentSceneStart,
  };
};

const resolveAudioDurationInBrowser = async (audio: string) => {
  const { getAudioDurationInSeconds } = await import("@remotion/media-utils");
  return getAudioDurationInSeconds(staticFile(`narration/${audio}`));
};

const resolveAudioDurationInNode = async (audio: string) => {
  const { ALL_FORMATS, FilePathSource, Input } = await import("mediabunny");
  const nodeProcess = (
    globalThis as typeof globalThis & {
      process?: { cwd?: () => string };
    }
  ).process;

  const cwd = nodeProcess?.cwd?.() ?? "";
  const candidates = [
    `${cwd}/public/narration/${audio}`,
    `${cwd}/movie/public/narration/${audio}`,
  ];

  let lastError: unknown = null;

  for (const candidate of candidates) {
    const input = new Input({
      source: new FilePathSource(candidate),
      formats: ALL_FORMATS,
    });

    try {
      const duration = await input.computeDuration();
      input.dispose();
      return duration;
    } catch (error) {
      lastError = error;
      input.dispose();
    }
  }

  throw lastError ?? new Error(`Could not resolve audio duration for ${audio}`);
};

export const resolveTimelineData = async (): Promise<TimelineData> => {
  const durations = await Promise.all(
    SUBTITLE_TEMPLATES.map(async (entry) => {
      try {
        const duration =
          typeof document === "undefined"
            ? await resolveAudioDurationInNode(entry.audio)
            : await resolveAudioDurationInBrowser(entry.audio);

        return [entry.audio, duration] as const;
      } catch (error) {
        console.warn(
          `Falling back to default timing for narration/${entry.audio}`,
          error
        );
        return [entry.audio, undefined] as const;
      }
    })
  );

  return buildTimelineData(Object.fromEntries(durations));
};

export const DEFAULT_TIMELINE = buildTimelineData({});
