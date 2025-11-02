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
        durationInFrames={1800}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          script: 'This is a sample script for your vertical video. The text will appear as animated captions synced with the audio.',
          audioUrl: '',  // ✅ CORRIGÉ: Chaîne vide au lieu de 'https://example.com/audio.mp3'
          avatarUrl: undefined,
          backgroundUrl: undefined,
        }}
      />
    </>
  );
};
