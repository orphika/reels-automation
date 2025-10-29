import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';

export const MyComp: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: 100,
        color: '#000',
      }}
    >
      Frame: {frame}
    </AbsoluteFill>
  );
};
