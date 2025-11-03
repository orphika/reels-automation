import React from 'react';
import { Composition } from 'remotion';
import { MyComp } from './MyComp';
import { VideoTemplate } from './VideoTemplate';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="MyComp"
        component={MyComp}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="VideoTemplate"
        component={VideoTemplate}
        durationInFrames={1440}
        fps={24}
        width={720}
        height={1280}
        defaultProps={{
          script: 'This is a sample script for your vertical video. The text will appear as animated captions synced with the audio.',
          audioUrl: '',
          avatarUrl: undefined,
          backgroundUrl: undefined,
        }}
      />
    </>
  );
};
