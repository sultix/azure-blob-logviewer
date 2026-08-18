import React from 'react';
import { Audio, Sequence, staticFile } from 'remotion';

/**
 * Vorbereitung für Sound-Design.
 *
 * Im Projekt liegen bewusst keine Klangdateien — es werden keine fremden
 * Assets geladen. Die Choreografie markiert aber schon jetzt jede Stelle, an
 * der ein Klang sitzen würde. Sobald unter `public/sfx/` eigene Dateien
 * liegen, genügt es, sie hier einzutragen; alles andere ist verkabelt.
 */
export const cues = {
  click: null as string | null,        // Mausklick im Interface
  toggle: null as string | null,       // Live-Schalter, Umschalter
  transition: null as string | null,   // Aktwechsel
  whoosh: null as string | null,       // Kamerafahrt
  pop: null as string | null,          // Dialog, Treffer, Toast
  tick: null as string | null,         // einlaufende Live-Zeile
} satisfies Record<string, string | null>;

export type CueName = keyof typeof cues;

/** Spielt einen Cue, sofern eine Datei hinterlegt ist — sonst passiert nichts. */
export const Cue: React.FC<{ name: CueName; at: number; volume?: number }> = ({
  name, at, volume = 0.5,
}) => {
  const file = cues[name];
  if (!file) return null;
  return (
    <Sequence from={at} durationInFrames={60} layout="none">
      <Audio src={staticFile(file)} volume={volume} />
    </Sequence>
  );
};
