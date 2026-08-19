import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { ease, palette, radii, shadows } from './motion';

/**
 * Hintergrund der Produktbühne: heller Verlauf, zwei sehr langsam wandernde
 * Lichtwolken in Azure und Indigo. Wenn man die Bewegung bewusst bemerkt,
 * ist sie zu stark — deshalb Amplituden im Bereich weniger Prozent.
 */
export const AmbientGlow: React.FC<{ intensity?: number }> = ({ intensity = 1 }) => {
  const frame = useCurrentFrame();
  const cycle = (period: number, phase = 0) =>
    Math.sin(((frame + phase) / period) * Math.PI * 2);

  const ax = 300 + cycle(1800) * 45;
  const ay = 180 + cycle(2300, 200) * 30;
  const bx = 1640 + cycle(2100, 400) * 55;
  const by = 940 + cycle(2600, 100) * 35;

  return (
    <AbsoluteFill style={{
      background: `linear-gradient(155deg, ${palette.stageWarm} 0%, ${palette.stage} 55%, #EEF3FB 100%)`,
    }}>
      <AbsoluteFill style={{
        background: `radial-gradient(900px circle at ${ax}px ${ay}px,`
          + ` rgba(0,120,212,${0.15 * intensity}), transparent 68%)`,
      }} />
      <AbsoluteFill style={{
        background: `radial-gradient(960px circle at ${bx}px ${by}px,`
          + ` rgba(99,102,241,${0.13 * intensity}), transparent 70%)`,
      }} />
      {/* Weiche Abdunklung zu den Rändern statt einer Textur: dasselbe Ziel,
          aber ohne das Rauschen, das jede Kompression teuer bezahlt. */}
      <AbsoluteFill style={{
        background: 'radial-gradient(120% 100% at 50% 42%,'
          + ` transparent 52%, rgba(11,16,32,${0.06 * intensity}) 100%)`,
      }} />
    </AbsoluteFill>
  );
};

/**
 * Rahmen um die Aufnahme: dünne Kante, große weiche Schatten, moderne Radien.
 * Bewusst ohne Transparenz — die echte Anwendung muss klar lesbar bleiben.
 */
export const ProductWindow: React.FC<{
  width: number;
  height: number;
  /** 0 = flach eingesetzt, 1 = voll plastisch. Für Ein- und Ausstiege. */
  presence?: number;
  children: React.ReactNode;
}> = ({ width, height, presence = 1, children }) => (
  <div style={{
    width, height, position: 'relative',
    borderRadius: radii.window,
    overflow: 'hidden',
    background: '#ffffff',
    boxShadow: presence > 0.02 ? shadows.window : 'none',
    outline: `1px solid ${palette.line}`,
    outlineOffset: -1,
  }}>
    {children}
  </div>
);

/**
 * Setzt einen Bildbereich in den Fokus, ohne zu zoomen: alles außerhalb
 * verliert etwas Kontrast. Bewusst schwach dosiert — das übrige Interface
 * darf nicht wie ein deaktivierter Zustand aussehen.
 */
export const FocusArea: React.FC<{
  rect: { x: number; y: number; width: number; height: number };  // Bildanteile 0…1
  amount?: number;
  frameWidth: number;
  frameHeight: number;
}> = ({ rect, amount = 1, frameWidth, frameHeight }) => {
  if (amount <= 0.01) return null;
  const px = {
    x: rect.x * frameWidth, y: rect.y * frameHeight,
    w: rect.width * frameWidth, h: rect.height * frameHeight,
  };
  const feather = 90;
  return (
    <AbsoluteFill style={{
      opacity: amount,
      background: '#F3F6FB',
      mixBlendMode: 'lighten',
      WebkitMaskImage:
        `radial-gradient(${px.w / 2 + feather}px ${px.h / 2 + feather}px at`
        + ` ${px.x + px.w / 2}px ${px.y + px.h / 2}px, transparent 55%, #000 100%)`,
      maskImage:
        `radial-gradient(${px.w / 2 + feather}px ${px.h / 2 + feather}px at`
        + ` ${px.x + px.w / 2}px ${px.y + px.h / 2}px, transparent 55%, #000 100%)`,
    }} />
  );
};

/**
 * Dunkler Verlauf an einer Bildkante, auf dem Hero-Typografie sicher liegt.
 * Ersetzt das frühere Untertitel-Kärtchen: keine Box, nur Licht.
 */
export type ScrimSide = 'bottom' | 'left' | 'bottomLeft' | 'full';

const gradients: Record<ScrimSide, string> = {
  bottom: 'linear-gradient(0deg, rgba(11,16,32,0.88) 0%, rgba(11,16,32,0.62) 26%, rgba(11,16,32,0) 58%)',
  left: 'linear-gradient(90deg, rgba(11,16,32,0.93) 0%, rgba(11,16,32,0.66) 30%, rgba(11,16,32,0) 66%)',
  bottomLeft: 'linear-gradient(26deg, rgba(11,16,32,0.93) 0%, rgba(11,16,32,0.62) 38%, rgba(11,16,32,0) 72%)',
  full: 'linear-gradient(0deg, rgba(11,16,32,0.72), rgba(11,16,32,0.72))',
};

export const Scrim: React.FC<{ amount: number; side?: ScrimSide }> = ({
  amount, side = 'bottom',
}) => {
  if (amount <= 0.01) return null;
  return <AbsoluteFill style={{ background: gradients[side], opacity: amount }} />;
};

/** Sanftes Ein-/Ausblenden der ganzen Bühne, z. B. an Aktgrenzen. */
export const stagePresence = (frame: number, from: number, len: number) =>
  interpolate(frame, [from, from + len], [0, 1], {
    easing: ease.soft, extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
