import React from 'react';
import { AbsoluteFill, Audio, Img, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export interface VideoTemplateProps {
  script?: string;
  audioUrl?: string;
  avatarUrl?: string;
  backgroundUrl?: string;
  words?: Array<{ text: string; start: number; end: number }>;
}

export const VideoTemplate: React.FC<VideoTemplateProps> = ({
  script = 'Default script text',
  audioUrl = '',
  avatarUrl,
  backgroundUrl,
  words
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const getCurrentWord = () => {
    if (!words || words.length === 0) {
      const wordsArray = script.split(' ');
      const wordIndex = Math.floor((frame / fps) * 3);
      return wordsArray.slice(0, wordIndex + 1).join(' ');
    }

    const currentWords = words.filter(
      (word) => currentTime >= word.start && currentTime <= word.end
    );
    
    if (currentWords.length > 0) {
      const wordIndex = words.indexOf(currentWords[currentWords.length - 1]);
      return words.slice(0, wordIndex + 1).map(w => w.text).join(' ');
    }
    
    return '';
  };

  const avatarScale = interpolate(
    frame,
    [0, 30],
    [0.8, 1],
    {
      extrapolateRight: 'clamp',
    }
  );

  const captionOpacity = interpolate(
    frame,
    [0, 15],
    [0, 1],
    {
      extrapolateRight: 'clamp',
    }
  );

  return (
    <AbsoluteFill>
      {/* Background */}
      {backgroundUrl ? (
        <Img
          src={backgroundUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'brightness(0.6) blur(2px)',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        />
      )}

      {/* Audio */}
      <Audio src={audioUrl} />

      {/* Avatar Placeholder */}
      <div
        style={{
          position: 'absolute',
          top: 100,
          left: '50%',
          transform: `translateX(-50%) scale(${avatarScale})`,
          width: 200,
          height: 200,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '4px solid white',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          backgroundColor: '#ccc',
        }}
      >
        {avatarUrl ? (
          <Img
            src={avatarUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              fontSize: 64,
              fontWeight: 'bold',
            }}
          >
            AI
          </div>
        )}
      </div>

      {/* Animated Captions */}
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          left: 0,
          right: 0,
          padding: '0 40px',
          opacity: captionOpacity,
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            padding: '30px 40px',
            borderRadius: 20,
            textAlign: 'center',
            backdropFilter: 'blur(10px)',
          }}
        >
          <p
            style={{
              color: 'white',
              fontSize: 42,
              fontWeight: 'bold',
              margin: 0,
              lineHeight: 1.4,
              textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
              fontFamily: 'Arial, sans-serif',
            }}
          >
            {getCurrentWord()}
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};
