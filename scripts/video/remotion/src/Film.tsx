import React from 'react';
import {
  AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';
import {
  TransitionPresentation, TransitionSeries, TransitionTiming, linearTiming,
} from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { wipe } from '@remotion/transitions/wipe';
import { Camera } from './Camera';
import { ChapterData } from './Chapter';
import { ActCard } from './ChapterTransition';
import { Outro } from './Bookends';
import { FeatureTitle } from './KineticText';
import { AmbientGlow, ProductWindow, Scrim } from './ProductStage';
import { ease, ramp } from './motion';
import { FilmHero, FilmShot, film } from './filmScript';
import data from './data.json';

const FPS = data.fps;
const clips = data.chapters.filter((c) => c.kind === 'clip') as unknown as ChapterData[];
const byId = (id: string) => clips.find((c) => c.id === id)!;

const heroBox: Record<NonNullable<FilmHero['place']>, React.CSSProperties> = {
  bottomLeft: {
    left: 128, right: 640, bottom: 0, paddingBottom: 116,
    justifyContent: 'flex-end', alignItems: 'flex-start',
  },
  left: { left: 128, right: 940, justifyContent: 'center', alignItems: 'flex-start' },
  center: { justifyContent: 'center', alignItems: 'center' },
};

/**
 * Eine Einstellung des Produktfilms: ein Ausschnitt einer Aufnahme, eine
 * Kamerafahrt darüber, optional eine Aussage. Kein Sprechertext — das Tempo
 * bestimmt hier die Regie, nicht die Vertonung.
 */
const Shot: React.FC<{
  chapter: ChapterData;
  from: number;      // Quellframe
  rate: number;
  shots: FilmShot[];
  hero?: FilmHero;
}> = ({ chapter, from, rate, shots, hero }) => {
  const frame = useCurrentFrame();
  const { width: frameWidth, height: frameHeight, durationInFrames } = useVideoConfig();

  const aspect = chapter.clipWidth / chapter.clipHeight;
  const winHeight = frameHeight;
  const winWidth = Math.min(frameWidth, Math.round(winHeight * aspect));

  const keys = shots.map((s) => ({
    at: Math.round(s.at * durationInFrames),
    zoom: s.zoom, x: s.x, y: s.y, ease: s.ease,
  }));

  const heroStart = hero ? Math.round(hero.at * durationInFrames) : 0;
  const heroEnd = hero ? heroStart + Math.round(hero.hold * FPS) : 0;

  return (
    <AbsoluteFill>
      <AmbientGlow />
      <Camera
        shots={keys}
        width={winWidth}
        height={winHeight}
        frameWidth={frameWidth}
        frameHeight={frameHeight}
      >
        <ProductWindow width={winWidth} height={winHeight}>
          <OffthreadVideo
            src={staticFile(chapter.clip)}
            trimBefore={from}
            playbackRate={rate}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            muted
          />
        </ProductWindow>
      </Camera>

      {hero && (
        <>
          <Scrim
            side={hero.place === 'left' ? 'left' : hero.place === 'center' ? 'full' : 'bottomLeft'}
            amount={ramp(frame, heroStart - 6, 14) * (1 - ramp(frame, heroEnd, 16))}
          />
          <AbsoluteFill style={{ display: 'flex', ...heroBox[hero.place ?? 'bottomLeft'] }}>
            <FeatureTitle
              eyebrow={hero.eyebrow}
              lines={hero.lines}
              start={heroStart}
              end={heroEnd}
              tone="onDark"
              scale={hero.scale ?? 'hero'}
            />
          </AbsoluteFill>
        </>
      )}
    </AbsoluteFill>
  );
};

const ACT_FRAMES = 26;
const ACT_WIPE = 12;
const CUT = 8;

const lengthOf = (scene: (typeof film)[number]) => {
  if (scene.kind === 'act') return ACT_FRAMES;
  return Math.round(scene.seconds * FPS);
};

type Cut = { presentation: TransitionPresentation<any>; timing: TransitionTiming };

const transitionBefore = (scene: (typeof film)[number], prev: (typeof film)[number]): Cut => {
  if (scene.kind === 'act' || prev.kind === 'act') {
    return {
      presentation: wipe({ direction: 'from-bottom' }),
      timing: linearTiming({ durationInFrames: ACT_WIPE, easing: ease.cine }),
    };
  }
  return {
    presentation: fade(),
    timing: linearTiming({
      durationInFrames: scene.kind === 'outro' ? 16 : CUT,
      easing: ease.soft,
    }),
  };
};

export const filmFrames = film.reduce((sum, scene, i) => {
  const cut = i === 0 ? 0
    : transitionBefore(scene, film[i - 1]).timing.getDurationInFrames({ fps: FPS });
  return sum + lengthOf(scene) - cut;
}, 0);

export const ProductFilm: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#0B1020' }}>
    <TransitionSeries>
      {film.flatMap((scene, i) => {
        const key = scene.kind === 'act' ? `act-${scene.index}`
          : scene.kind === 'outro' ? 'outro' : scene.id;

        const body = scene.kind === 'act' ? (
          <ActCard index={scene.index} title={scene.title} />
        ) : scene.kind === 'outro' ? (
          <Outro shot={byId(scene.chapter)} />
        ) : (
          <Shot
            chapter={byId(scene.chapter)}
            from={Math.round(scene.from * FPS)}
            rate={scene.rate ?? 1}
            shots={scene.shots}
            hero={scene.hero}
          />
        );

        const seq = (
          <TransitionSeries.Sequence key={key} durationInFrames={lengthOf(scene)}>
            <AbsoluteFill>{body}</AbsoluteFill>
          </TransitionSeries.Sequence>
        );

        if (i === 0) return [seq];
        const t = transitionBefore(scene, film[i - 1]);
        return [
          <TransitionSeries.Transition key={`t-${key}`} presentation={t.presentation} timing={t.timing} />,
          seq,
        ];
      })}
    </TransitionSeries>
  </AbsoluteFill>
);

export const filmSeconds = filmFrames / FPS;
