import React from 'react';
import {
  AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';
import { Camera } from './Camera';
import { Eyebrow, KineticLines } from './KineticText';
import { AmbientGlow, ProductWindow, Scrim } from './ProductStage';
import { fontFamily, palette, ramp, type } from './motion';

export type ClipRef = {
  clip: string; clipWidth: number; clipHeight: number; clipFrames: number;
};

const fit = (ref: ClipRef, frameWidth: number, frameHeight: number) => {
  const height = frameHeight;
  const width = Math.min(frameWidth, Math.round(height * (ref.clipWidth / ref.clipHeight)));
  return { width, height };
};

/**
 * Vorspann.
 *
 * Das Produkt steht von der ersten Sekunde an im Bild — der Titel liegt darauf,
 * nicht davor. Die Kamera fährt über den ganzen Vorspann langsam heran und
 * endet exakt auf der Einstellung, mit der Kapitel 1 beginnt: der Schnitt
 * dorthin ist damit eine Fortsetzung, kein Wechsel.
 */
export const Intro: React.FC<{
  shot: ClipRef; from?: number; rate?: number;
}> = ({ shot, from = 0, rate = 0.6 }) => {
  const frame = useCurrentFrame();
  const { width: frameWidth, height: frameHeight, durationInFrames } = useVideoConfig();
  const win = fit(shot, frameWidth, frameHeight);

  const clear = durationInFrames - 20;   // ab hier räumt der Titel das Bild
  const scrim = ramp(frame, 6, 16) * (1 - ramp(frame, clear, 22));

  return (
    <AbsoluteFill>
      <AmbientGlow />
      <Camera
        // Eine einzige, sehr lange Fahrt über den ganzen Vorspann: langsamer
        // Zuschub statt mehrerer Bewegungen.
        shots={[
          { at: 0, zoom: 0.98, x: 0.5, y: 0.5 },
          { at: 6, zoom: 1.1, x: 0.52, y: 0.46, dur: durationInFrames - 6, ease: 'soft' },
        ]}
        tilt={[
          { at: 0, value: 0.5 },
          { at: 6, value: 0, dur: Math.round(durationInFrames * 0.8), ease: 'soft' },
        ]}
        width={win.width}
        height={win.height}
        frameWidth={frameWidth}
        frameHeight={frameHeight}
      >
        <ProductWindow width={win.width} height={win.height}>
          <OffthreadVideo
            src={staticFile(shot.clip)}
            trimBefore={from}
            playbackRate={rate}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            muted
          />
        </ProductWindow>
      </Camera>

      <Scrim amount={scrim} side="left" />
      <Scrim amount={scrim * 0.35} side="full" />

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'flex-start', gap: 24, left: 128, right: 900,
      }}>
        <Img
          src={staticFile('app-logo.png')}
          style={{
            width: 96, height: 96, borderRadius: 22, objectFit: 'contain',
            opacity: ramp(frame, 4, 14) * (1 - ramp(frame, clear, 18)),
            transform: `translateY(${((1 - ramp(frame, 4, 18)) * 18).toFixed(1)}px)`,
          }}
        />
        <KineticLines
          lines={['Azure Blob', 'Logviewer']}
          start={8} end={clear} tone="onDark" scale="heroLarge"
        />
        <div style={{ marginTop: 6 }}>
          <Eyebrow text="Logdateien aus Azure Blob Storage lesen" start={26} end={clear} tone="onDark" />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * Abspann.
 *
 * Kein Funktionskatalog: die Anwendung läuft im Hintergrund weiter, die Kamera
 * zieht sich zurück, und ein Satz fasst zusammen, was das Video gezeigt hat.
 */
export const Outro: React.FC<{ shot: ClipRef }> = ({ shot }) => {
  const frame = useCurrentFrame();
  const { width: frameWidth, height: frameHeight, durationInFrames } = useVideoConfig();
  const win = fit(shot, frameWidth, frameHeight);

  // Spät im Clip einsteigen: dort laufen im Live-Modus neue Zeilen ein.
  const from = Math.max(0, shot.clipFrames - durationInFrames - 20);

  return (
    <AbsoluteFill>
      <AmbientGlow intensity={0.7} />
      <Camera
        // Langsamer Rückzug über die volle Länge des Abspanns.
        shots={[
          { at: 0, zoom: 1.14, x: 0.56, y: 0.6 },
          { at: 4, zoom: 0.94, x: 0.5, y: 0.5, dur: durationInFrames - 4, ease: 'soft' },
        ]}
        width={win.width}
        height={win.height}
        frameWidth={frameWidth}
        frameHeight={frameHeight}
      >
        <ProductWindow width={win.width} height={win.height}>
          <OffthreadVideo
            src={staticFile(shot.clip)}
            trimBefore={from}
            playbackRate={0.7}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            muted
          />
        </ProductWindow>
      </Camera>

      <Scrim amount={ramp(frame, 10, 26) * 0.88} side="full" />

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', gap: 30,
      }}>
        <Eyebrow text="Azure Blob Logviewer" start={18} tone="onDark" />
        <KineticLines
          lines={['Logdateien durchsuchen,', 'streamen und live mitlesen.']}
          start={26} tone="onDark" scale="hero" align="center"
        />
        <div style={{
          ...type.lead, fontFamily, color: palette.onNightSoft, textAlign: 'center',
          opacity: ramp(frame, 58, 20),
        }}>
          Voraussetzung: eine angemeldete Azure CLI.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
