import React from 'react';
import { AbsoluteFill, Audio, staticFile } from 'remotion';
import {
  TransitionPresentation, TransitionSeries, TransitionTiming, linearTiming,
} from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { wipe } from '@remotion/transitions/wipe';
import { Chapter, ChapterData } from './Chapter';
import { ActCard } from './ChapterTransition';
import { ClipRef, Intro, Outro } from './Bookends';
import { ease, timing } from './motion';
import { acts } from './story';
import data from './data.json';

const clips = data.chapters.filter((c) => c.kind === 'clip') as unknown as ChapterData[];
const byId = (id: string) => clips.find((c) => c.id === id);

const ref = (c: ChapterData): ClipRef => ({
  clip: c.clip, clipWidth: c.clipWidth, clipHeight: c.clipHeight, clipFrames: c.clipFrames,
});

const intro = data.chapters.find((c) => c.kind === 'intro')!;
const outro = data.chapters.find((c) => c.kind === 'outro')!;
const first = byId('01')!;
// Vorspann auf der Leseansicht, Abspann auf den einlaufenden Live-Zeilen:
// beides zeigt das Produkt in Betrieb statt eines leeren Dashboards.
const opening = byId('04') ?? first;
const closing = byId('06') ?? first;
const INTRO_FROM = 11 * data.fps;

const ACT_FRAMES = timing.actCard;
const ACT_WIPE = 14;

type Item =
  | { kind: 'intro' }
  | { kind: 'act'; index: string; title: string }
  | { kind: 'clip'; chapter: ChapterData }
  | { kind: 'outro' };

/** Erzählreihenfolge: Vorspann, Akte mit ihren Kapiteln, Abspann. */
const items: Item[] = [{ kind: 'intro' }];
for (const c of clips) {
  const act = acts.find((a) => a.before === c.id);
  if (act) items.push({ kind: 'act', index: act.index, title: act.title });
  items.push({ kind: 'clip', chapter: c });
}
items.push({ kind: 'outro' });

const lengthOf = (item: Item) => {
  if (item.kind === 'intro') return intro.durationInFrames;
  if (item.kind === 'outro') return outro.durationInFrames;
  if (item.kind === 'act') return ACT_FRAMES;
  return item.chapter.durationInFrames;
};

type Cut = { presentation: TransitionPresentation<any>; timing: TransitionTiming };

/** Überblendung zwischen zwei Elementen — oder gar keine, wo der Raum weiterläuft. */
const transitionFor = (prev: Item, next: Item): Cut | null => {
  if (prev.kind === 'intro') {
    return {
      presentation: fade(),
      timing: linearTiming({ durationInFrames: 16, easing: ease.soft }),
    };
  }
  if (prev.kind === 'act' || next.kind === 'act') {
    return {
      presentation: wipe({ direction: 'from-bottom' }),
      timing: linearTiming({ durationInFrames: ACT_WIPE, easing: ease.cine }),
    };
  }
  if (next.kind === 'outro') {
    return {
      presentation: fade(),
      timing: linearTiming({ durationInFrames: 18, easing: ease.soft }),
    };
  }
  return {
    presentation: fade(),
    timing: linearTiming({ durationInFrames: timing.crossfade, easing: ease.soft }),
  };
};

export const totalFrames = items.reduce((sum, item, i) => {
  const t = i === 0 ? null : transitionFor(items[i - 1], item);
  return sum + lengthOf(item) - (t ? (t.timing.getDurationInFrames({ fps: data.fps })) : 0);
}, 0);

export const Tutorial: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#0B1020' }}>
    <TransitionSeries>
      {items.flatMap((item, i) => {
        const body =
          item.kind === 'intro' ? (
            <>
              <Intro shot={ref(opening)} from={INTRO_FROM} />
              {intro.audio && <Audio src={staticFile(intro.audio)} />}
            </>
          ) : item.kind === 'outro' ? (
            <>
              <Outro shot={ref(closing)} />
              {outro.audio && <Audio src={staticFile(outro.audio)} />}
            </>
          ) : item.kind === 'act' ? (
            <ActCard index={item.index} title={item.title} />
          ) : (
            <Chapter data={item.chapter} />
          );

        const key = item.kind === 'clip' ? item.chapter.id
          : item.kind === 'act' ? `act-${item.index}` : item.kind;

        const seq = (
          <TransitionSeries.Sequence key={key} durationInFrames={lengthOf(item)}>
            <AbsoluteFill>{body}</AbsoluteFill>
          </TransitionSeries.Sequence>
        );

        if (i === 0) return [seq];
        const t = transitionFor(items[i - 1], item);
        if (!t) return [seq];
        return [
          <TransitionSeries.Transition key={`t-${key}`} presentation={t.presentation} timing={t.timing} />,
          seq,
        ];
      })}
    </TransitionSeries>
  </AbsoluteFill>
);
