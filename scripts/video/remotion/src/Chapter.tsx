import React from 'react';
import {
  AbsoluteFill, Audio, Freeze, OffthreadVideo, Sequence,
  staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';
import { Camera, Shot } from './Camera';
import { FeatureTitle } from './KineticText';
import { AmbientGlow, ProductWindow, Scrim } from './ProductStage';
import { Cue } from './Sfx';
import { ramp } from './motion';
import { HeroSpec, ShotSpec, script } from './story';

export type Slice = {
  videoFrom: number; videoTo: number;
  shown: number;   // Länge im fertigen Video (nach Beschleunigung)
  rate: number;    // Abspieltempo dieses Abschnitts
  hold: number;    // Standbild am Ende, falls der Satz länger spricht
  text: string; audio: string | null;
};

export type ChapterData = {
  id: string; title: string; clip: string;
  clipFrames: number; clipWidth: number; clipHeight: number;
  durationInFrames: number;
  slices: Slice[];
};

/** Anfang und Länge jedes Abschnitts im Kapitel. */
const bounds = (slices: Slice[]) => {
  let at = 0;
  return slices.map((s) => {
    const start = at;
    const len = s.shown + s.hold;
    at += len;
    return { start, len };
  });
};

/**
 * Abschnittsbezogene Regieangaben in absolute Frames auflösen. Dadurch bleiben
 * die Fahrten gültig, wenn sich Vertonung oder Tempo ändern.
 */
const resolveShots = (specs: ShotSpec[], marks: { start: number; len: number }[]): Shot[] => {
  const shots = specs
    .filter((s) => marks[s.slice])
    .map((s) => ({
      at: Math.round(marks[s.slice].start + (s.t ?? 0) * marks[s.slice].len),
      zoom: s.zoom, x: s.x, y: s.y, ease: s.ease,
    }))
    .sort((a, b) => a.at - b.at);

  if (shots.length === 0) return [{ at: 0, zoom: 1, x: 0.5, y: 0.5 }];
  if (shots[0].at > 0) shots.unshift({ ...shots[0], at: 0 });
  return shots;
};

const heroFrames = (hero: HeroSpec, marks: { start: number; len: number }[], fps: number) => {
  const m = marks[hero.slice] ?? marks[0];
  const start = Math.round(m.start + (hero.t ?? 0) * m.len);
  return { start, end: start + Math.round(hero.hold * fps) };
};

const heroBox: Record<NonNullable<HeroSpec['place']>, React.CSSProperties> = {
  bottomLeft: {
    left: 128, right: 640, bottom: 0, paddingBottom: 116,
    justifyContent: 'flex-end', alignItems: 'flex-start',
  },
  left: { left: 128, right: 940, justifyContent: 'center', alignItems: 'flex-start' },
  center: { justifyContent: 'center', alignItems: 'center' },
};

export const Chapter: React.FC<{ data: ChapterData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps, width: frameWidth, height: frameHeight } = useVideoConfig();

  const marks = bounds(data.slices);
  const plan = script[data.id];
  const shots = resolveShots(plan?.shots ?? [], marks);
  const hero = plan?.hero;
  const heroAt = hero ? heroFrames(hero, marks, fps) : null;

  // Das Produktfenster übernimmt das Seitenverhältnis der Aufnahme, damit die
  // schmal aufgenommene Variante nicht in die Breite gezogen wird.
  const aspect = data.clipWidth / data.clipHeight;
  const winHeight = frameHeight;
  const winWidth = Math.min(frameWidth, Math.round(winHeight * aspect));

  const clip = (props: { startFrom?: number; rate?: number } = {}) => (
    <OffthreadVideo
      src={staticFile(data.clip)}
      trimBefore={props.startFrom}
      playbackRate={props.rate}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      muted
    />
  );

  return (
    <AbsoluteFill>
      <AmbientGlow />

      <Camera
        shots={shots}
        width={winWidth}
        height={winHeight}
        frameWidth={frameWidth}
        frameHeight={frameHeight}
      >
        <ProductWindow width={winWidth} height={winHeight}>
          {data.slices.map((s, i) => (
            <Sequence key={i} from={marks[i].start} durationInFrames={marks[i].len}>
              <Sequence durationInFrames={s.shown}>
                {clip({ startFrom: s.videoFrom, rate: s.rate })}
              </Sequence>
              {/* Spricht der Satz länger als der Abschnitt dauert, hält das Bild an. */}
              {s.hold > 0 && (
                <Sequence from={s.shown} durationInFrames={s.hold}>
                  <Freeze frame={Math.max(0, s.videoTo - 1)}>{clip()}</Freeze>
                </Sequence>
              )}
            </Sequence>
          ))}
        </ProductWindow>
      </Camera>

      {/* Ton liegt außerhalb der Kamerafahrt — Transformationen gehen ihn nichts an. */}
      {data.slices.map((s, i) => s.audio && (
        <Sequence key={`a-${i}`} from={marks[i].start} durationInFrames={marks[i].len} layout="none">
          <Audio src={staticFile(s.audio)} />
        </Sequence>
      ))}

      {hero && heroAt && (
        <>
          <Scrim
            side={hero.place === 'left' ? 'left' : hero.place === 'center' ? 'full' : 'bottomLeft'}
            amount={ramp(frame, heroAt.start - 6, 14)
              * (1 - ramp(frame, heroAt.end, 16))}
          />
          <AbsoluteFill style={{ display: 'flex', ...heroBox[hero.place ?? 'bottomLeft'] }}>
            <FeatureTitle
              eyebrow={hero.eyebrow}
              lines={hero.lines}
              start={heroAt.start}
              end={heroAt.end}
              tone="onDark"
              scale={hero.scale ?? 'hero'}
            />
          </AbsoluteFill>
        </>
      )}

      {/* Vorbereitete Klangmarken — ohne hinterlegte Datei passiert nichts. */}
      {marks.map((m, i) => <Cue key={`c-${i}`} name="click" at={m.start} />)}
    </AbsoluteFill>
  );
};
