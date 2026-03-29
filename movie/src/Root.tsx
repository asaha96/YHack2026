import React from "react";
import { Composition } from "remotion";
import { Intro } from "./Intro";
import { DEFAULT_TIMELINE, MOVIE_FPS, resolveTimelineData } from "./timeline";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Intro"
        component={Intro}
        durationInFrames={DEFAULT_TIMELINE.durationInFrames}
        fps={MOVIE_FPS}
        width={1920}
        height={1080}
        defaultProps={{ timeline: DEFAULT_TIMELINE }}
        calculateMetadata={async () => {
          const timeline = await resolveTimelineData();
          return {
            durationInFrames: timeline.durationInFrames,
            props: { timeline },
          };
        }}
      />
    </>
  );
};
