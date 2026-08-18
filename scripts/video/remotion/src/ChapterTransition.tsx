import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { KineticLines } from './KineticText';
import { ease, fontFamily, palette, type } from './motion';

/**
 * Dunkle Zwischentafel zwischen zwei Akten.
 *
 * Bewusst kurz (rund eine Sekunde) und ohne Erklärtext: sie trennt die
 * Abschnitte und gibt dem hellen Produktbild einen Kontrastschlag, statt wie
 * eine Kursnavigation zu wirken.
 */
export const ActCard: React.FC<{ index: string; title: string }> = ({ index, title }) => {
  const frame = useCurrentFrame();
  const line = interpolate(frame, [4, 22], [0, 1], {
    easing: ease.settle, extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: palette.night }}>
      {/* Kaum sichtbarer Lichtschimmer, damit die Fläche nicht tot wirkt. */}
      <AbsoluteFill style={{
        background: 'radial-gradient(1200px circle at 22% 78%, rgba(0,164,239,0.16), transparent 66%)',
      }} />
      <AbsoluteFill style={{
        padding: '0 150px', justifyContent: 'center', alignItems: 'flex-start', gap: 26,
      }}>
        <div style={{
          ...type.meta, fontFamily, color: palette.azureLight,
          display: 'flex', alignItems: 'center', gap: 18, opacity: line,
        }}>
          {index}
          <span style={{
            width: 120, height: 1, background: palette.lineNight,
            transform: `scaleX(${line.toFixed(3)})`, transformOrigin: 'left center',
          }} />
        </div>
        <KineticLines lines={[title]} start={2} tone="onDark" scale="heroLarge" />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
