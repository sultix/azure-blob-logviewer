import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { ease, fontFamily, palette, timing, type } from './motion';

type Tone = 'onDark' | 'onLight';

const inkFor = (tone: Tone) => (tone === 'onDark' ? palette.onNight : palette.ink);
const softFor = (tone: Tone) => (tone === 'onDark' ? palette.onNightSoft : palette.inkSoft);

/**
 * Zeilenweiser Reveal hinter einer Maske: die Zeile schiebt sich von unten in
 * ihr eigenes Fenster. Kein Buchstabenspringen, keine Rotation, kein Blur —
 * die Bewegung soll die Aussage tragen, nicht auffallen.
 */
export const KineticLines: React.FC<{
  lines: string[];
  start?: number;
  end?: number;            // Frame, ab dem ausgeblendet wird
  tone?: Tone;
  scale?: 'heroLarge' | 'hero' | 'heroSmall';
  align?: 'left' | 'center';
}> = ({ lines, start = 0, end, tone = 'onDark', scale = 'hero', align = 'left' }) => {
  const frame = useCurrentFrame();
  const style = type[scale];
  const out = end === undefined ? 1 : interpolate(frame, [end, end + timing.typeOut], [1, 0], {
    easing: ease.soft, extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{ textAlign: align, opacity: out }}>
      {lines.map((line, i) => {
        const from = start + i * timing.typeStagger;
        const p = interpolate(frame, [from, from + timing.typeIn], [0, 1], {
          easing: ease.settle, extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });
        return (
          <div key={line + i} style={{ overflow: 'hidden', paddingBottom: '0.06em' }}>
            <div style={{
              ...style,
              fontFamily,
              color: inkFor(tone),
              transform: `translateY(${((1 - p) * 108).toFixed(2)}%)`,
              opacity: interpolate(p, [0, 0.35], [0, 1], { extrapolateRight: 'clamp' }),
              whiteSpace: 'pre',
            }}>
              {line}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Kleine Auszeichnung über der Hero-Zeile — die Rubrik, nicht die Aussage. */
export const Eyebrow: React.FC<{
  text: string; start?: number; end?: number; tone?: Tone;
}> = ({ text, start = 0, end, tone = 'onDark' }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [start, start + timing.typeIn], [0, 1], {
    easing: ease.settle, extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const out = end === undefined ? 1 : interpolate(frame, [end, end + timing.typeOut], [1, 0], {
    easing: ease.soft, extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      ...type.eyebrow,
      fontFamily,
      // Auf dem Produktbild gewinnt Lesbarkeit: die Rubrik steht weiß,
      // die Marke bringt nur der kurze Strich davor.
      color: tone === 'onDark' ? 'rgba(255,255,255,0.86)' : palette.azure,
      opacity: p * out,
      transform: `translateY(${((1 - p) * 14).toFixed(2)}px)`,
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <span style={{
        width: 34, height: 2,
        background: tone === 'onDark' ? palette.azureLight : 'currentColor',
        transform: `scaleX(${p.toFixed(3)})`, transformOrigin: 'left center',
      }} />
      {text}
    </div>
  );
};

/**
 * Rubrik plus Aussage als Block. Wird über der Produktbühne (auf einem
 * Verlauf) und auf den dunklen Kapiteltafeln gleichermaßen verwendet.
 */
export const FeatureTitle: React.FC<{
  eyebrow?: string;
  lines: string[];
  note?: string;
  start?: number;
  end?: number;
  tone?: Tone;
  scale?: 'heroLarge' | 'hero' | 'heroSmall';
  align?: 'left' | 'center';
}> = ({ eyebrow, lines, note, start = 0, end, tone = 'onDark', scale = 'hero', align = 'left' }) => {
  const frame = useCurrentFrame();
  const noteP = interpolate(
    frame,
    [start + timing.typeIn + lines.length * timing.typeStagger, start + timing.typeIn * 2 + lines.length * timing.typeStagger],
    [0, 1],
    { easing: ease.settle, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const out = end === undefined ? 1 : interpolate(frame, [end, end + timing.typeOut], [1, 0], {
    easing: ease.soft, extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 22,
      alignItems: align === 'center' ? 'center' : 'flex-start',
    }}>
      {eyebrow && <Eyebrow text={eyebrow} start={start} end={end} tone={tone} />}
      <KineticLines
        lines={lines} start={start + 4} end={end} tone={tone} scale={scale} align={align}
      />
      {note && (
        <div style={{
          ...type.lead, fontFamily, color: softFor(tone),
          opacity: noteP * out, transform: `translateY(${((1 - noteP) * 12).toFixed(2)}px)`,
          maxWidth: 900, textAlign: align,
        }}>
          {note}
        </div>
      )}
    </div>
  );
};
