import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EaseName, Key, MAX_STAGE_SCALE, STAGE_SCALE, track } from './motion';

/**
 * Eine Einstellung des virtuellen Kamera-Rigs.
 *
 * `x` und `y` sind Bildanteile (0…1) der Aufnahme — (0.5, 0.5) ist die Mitte.
 * `zoom` ist relativ zur Produktbühne: 1 zeigt das ganze Fenster, 1.4 fährt
 * dicht an ein Bedienelement heran.
 */
export type Shot = {
  at: number;      // Frame, an dem die Fahrt beginnt
  zoom: number;
  x?: number;
  y?: number;
  dur?: number;    // Länge der Fahrt; danach steht die Kamera
  ease?: EaseName;
};

const channel = (shots: Shot[], pick: (s: Shot) => number | undefined, fallback: number): Key[] =>
  shots.map((s) => ({ at: s.at, value: pick(s) ?? fallback, dur: s.dur, ease: s.ease }));

/**
 * Kamerafahrt über eine Bühne der Größe `width` × `height`.
 *
 * Geschwenkt wird nur so weit, wie das Fenster das Bild noch füllt. Überblicks-
 * einstellungen bleiben dadurch ruhig zentriert, Nahaufnahmen bekommen ihren
 * Versatz aus dem Zoom — nie entsteht eine Lücke neben dem Produkt.
 *
 * Zwischen zwei Einstellungen steht die Kamera still: eine Fahrt dauert ihre
 * `dur`, danach ruht das Bild bis zur nächsten.
 */
export const Camera: React.FC<{
  shots: Shot[];
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  /** Sehr dezente Neigung, nur für Vor- und Abspann gedacht. */
  tilt?: Key[];
  children: React.ReactNode;
}> = ({ shots, width, height, frameWidth, frameHeight, tilt, children }) => {
  const frame = useCurrentFrame();

  const zoom = track(frame, channel(shots, (s) => s.zoom, 1));
  const fx = track(frame, channel(shots, (s) => s.x, 0.5));
  const fy = track(frame, channel(shots, (s) => s.y, 0.5));
  const scale = Math.min(MAX_STAGE_SCALE, STAGE_SCALE * zoom);

  // Zielpunkt (Bildanteil) in die Bildmitte holen …
  const wantX = -scale * (fx - 0.5) * width;
  const wantY = -scale * (fy - 0.5) * height;
  // … aber nur so weit, wie das Fenster das Bild noch füllt. Eine Lücke zur
  // Bühne neben einer Nahaufnahme liest sich als Fehler, nicht als Absicht;
  // die Aufmerksamkeit lenkt hier der Zoom, der Schwenk setzt den Akzent.
  const roomX = Math.max(0, (width * scale - frameWidth) / 2);
  const roomY = Math.max(0, (height * scale - frameHeight) / 2);
  const tx = Math.max(-roomX, Math.min(roomX, wantX));
  const ty = Math.max(-roomY, Math.min(roomY, wantY));

  const lean = tilt ? track(frame, tilt) : 0;

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', perspective: 2600 }}>
      <div style={{
        width, height,
        transform: `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`
          + ` scale(${scale.toFixed(4)})`
          + (lean ? ` rotateX(${(lean * 1.1).toFixed(3)}deg)` : ''),
        transformStyle: lean ? 'preserve-3d' : undefined,
        willChange: 'transform',
      }}>
        {children}
      </div>
    </AbsoluteFill>
  );
};
