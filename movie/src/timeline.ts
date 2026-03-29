import { staticFile } from "remotion";
import type { SubtitleEntry, SubtitleStyle } from "./components/Subtitles";

export const MOVIE_FPS = 30;
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

export type SpeakerId = "nik" | "sujal" | "aritra" | "vedant";

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
  speaker: SpeakerId;
  offsetInFrames: number;
  minDurationInFrames: number;
  text: string;
  style?: SubtitleStyle;
  audio?: string;
}

const SCENE_TEMPLATES: SceneTemplate[] = [
  { id: "title", minDurationInFrames: 200 },
  { id: "problem", minDurationInFrames: 200 },
  { id: "upload", minDurationInFrames: 200 },
  { id: "reconstruct", minDurationInFrames: 200 },
  { id: "handTracking", minDurationInFrames: 200 },
  { id: "ai", minDurationInFrames: 200 },
  { id: "summary", minDurationInFrames: 200 },
  { id: "hero", minDurationInFrames: 200 },
  { id: "closing", minDurationInFrames: 200 },
];

const SUBTITLE_TEMPLATES: SubtitleTemplate[] = [
  // ── 60 second cut: one narration block per scene, one uploaded file per speaker switch
  {
    sceneId: "title",
    speaker: "nik",
    offsetInFrames: 20,
    minDurationInFrames: 156,
    text: "Every year, 250,000 surgical complications happen in the US, and a quarter are preventable.",
    style: "punchline",
  },
  {
    sceneId: "problem",
    speaker: "sujal",
    offsetInFrames: 20,
    minDurationInFrames: 156,
    text: "Praxis lets surgeons upload a patient scan, see their exact anatomy, and rehearse before the first incision.",
    style: "punchline",
  },
  {
    sceneId: "upload",
    speaker: "aritra",
    offsetInFrames: 20,
    minDurationInFrames: 156,
    text: "Start with a CT, MRI, or PET scan. Praxis processes roughly 48 million voxels in under 90 seconds.",
  },
  {
    sceneId: "reconstruct",
    speaker: "vedant",
    offsetInFrames: 20,
    minDurationInFrames: 156,
    text: "We turn that scan into a navigable 3D world model of the patient's actual anatomy.",
    style: "punchline",
  },
  {
    sceneId: "handTracking",
    speaker: "nik",
    offsetInFrames: 20,
    minDurationInFrames: 156,
    text: "Then surgeons rehearse the procedure with webcam hand tracking, no expensive hardware required.",
  },
  {
    sceneId: "ai",
    speaker: "vedant",
    offsetInFrames: 20,
    minDurationInFrames: 156,
    text: "They can compare surgical approaches and use AI to pull relevant case studies and recommendations.",
  },
  {
    sceneId: "summary",
    speaker: "aritra",
    offsetInFrames: 20,
    minDurationInFrames: 156,
    text: "When they're done, Praxis exports an annotated surgical plan the whole team can use.",
  },
  {
    sceneId: "hero",
    speaker: "sujal",
    offsetInFrames: 20,
    minDurationInFrames: 156,
    text: "We're building the rehearsal layer for surgery, so preparation becomes patient-specific instead of guesswork.",
    style: "punchline",
  },
  {
    sceneId: "closing",
    speaker: "nik",
    offsetInFrames: 20,
    minDurationInFrames: 156,
    text: "Praxis helps teams practice on the patient they're about to treat, not the one in the textbook.",
    style: "punchline",
  },
];

const withAudioAssignedAtSpeakerSwitches = (
  entries: SubtitleTemplate[]
): SubtitleTemplate[] => {
  let previousSpeaker: SpeakerId | null = null;
  let segmentIndex = 0;

  return entries.map((entry) => {
    if (entry.speaker !== previousSpeaker) {
      previousSpeaker = entry.speaker;
      segmentIndex += 1;

      return {
        ...entry,
        audio: `line-${String(segmentIndex).padStart(2, "0")}.mp3`,
      };
    }

    return entry;
  });
};

const TIMED_SUBTITLE_TEMPLATES =
  withAudioAssignedAtSpeakerSwitches(SUBTITLE_TEMPLATES);

export const buildTimelineData = (
  _audioDurationsInSeconds: Record<string, number | undefined>
): TimelineData => {
  const scenes: SceneTiming[] = [];
  const subtitles: SubtitleEntry[] = [];

  let currentSceneStart = 0;

  for (const scene of SCENE_TEMPLATES) {
    const sceneEntries = TIMED_SUBTITLE_TEMPLATES.filter(
      (entry) => entry.sceneId === scene.id
    );

    let previousLineEndExclusive = 0;

    for (const entry of sceneEntries) {
      // Keep the edit locked to the 60 second cut. New narration uploads
      // should be recorded to fit these timings rather than stretching scenes.
      const lineDurationInFrames = entry.minDurationInFrames;

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
    TIMED_SUBTITLE_TEMPLATES
      .filter((entry): entry is SubtitleTemplate & { audio: string } =>
        Boolean(entry.audio)
      )
      .map(async (entry) => {
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
