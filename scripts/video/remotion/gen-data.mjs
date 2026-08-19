/**
 * Baut src/data.json aus Aufnahmen, Einblendungen und Sprachzeilen.
 *
 * Kernidee: Die Tonspur führt. Jede Einblendung bekommt ein Zeitfenster, das
 * mindestens so lang ist wie ihr gesprochener Satz. Reicht die Aufnahme nicht,
 * hält Remotion das letzte Bild an dieser Stelle an ("hold"), statt dass die
 * Stimme den Klicks davonläuft.
 *
 * Aufruf: node remotion/gen-data.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = path.dirname(HERE);
const OUT = path.join(VIDEO, 'out');
const LINES = path.join(VIDEO, 'audio/lines');
const FPS = 25;
const TRANSITION = 12;   // Frames Überblendung zwischen Kapiteln
const PAUSE = 4;         // knappe Atempause nach jedem gesprochenen Satz
const TAIL = 8;          // Nachlauf am Kapitelende
const MAX_RATE = 2.0;    // Höchsttempo für Abschnitte, in denen niemand spricht

/**
 * Rhythmus des Films. Hero-Kapitel laufen dichter an Echtzeit und bekommen
 * dadurch Luft; Nebenkapitel dürfen zügig durchziehen. Der gesprochene Satz
 * bleibt immer die Untergrenze eines Abschnitts.
 */
const RATE = {
  '01': 1.7, '02': 2.3, '03': 2.3, '04': 1.3, '05': 1.3,
  '06': 1.3, '07': 1.7, '08': 1.35, '09': 1.7, '10': 2.3,
};

/**
 * Das gesprochene Skript steht in lib/narration.json, nicht mehr in den
 * Aufnahmen. Grund: die Einblendungen aus der Aufnahme markieren Handgriffe,
 * der Text soll aber als zusammenhängende Erzählung geschrieben sein — mit
 * eigenen Sätzen dort, wo im Bild etwas passiert, das beim Drehen keinen
 * eigenen Marker hatte.
 */
const NARRATION = JSON.parse(fs.readFileSync(path.join(VIDEO, 'lib/narration.json'), 'utf8'));

// Die Erfolgsmeldung verschwindet vor dem Ende der Aufnahme. Damit das
// Standbild am Kapitelende sie noch zeigt, endet Kapitel 07 frueher.
const TRIM = { '07': 21.6 };

const CHAPTERS = JSON.parse(fs.readFileSync(path.join(VIDEO, 'lib/chapters.json'), 'utf8'));
const dur = (f) => parseFloat(execFileSync('ffprobe',
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }));
const frames = (seconds) => Math.round(seconds * FPS);

function link(src, relTarget) {
  const dest = path.join(HERE, 'public', relTarget);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.rmSync(dest, { force: true });
  try { fs.linkSync(src, dest); } catch { fs.copyFileSync(src, dest); }
  return relTarget;
}

const lineFile = (id) => {
  const f = path.join(LINES, `${id}.mp3`);
  return fs.existsSync(f) ? f : null;
};

const chapters = [];
let holdTotal = 0;
let sped = 0;

const introAudio = lineFile('00-intro');
chapters.push({
  id: '00-intro', kind: 'intro',
  durationInFrames: Math.max(frames(5), introAudio ? frames(dur(introAudio)) + 28 : 0),
  audio: introAudio ? link(introAudio, 'audio/00-intro.mp3') : null,
});

for (const { id, title } of CHAPTERS) {
  const clip = path.join(OUT, `${id}.webm`);
  if (!fs.existsSync(clip)) continue;
  const meta = JSON.parse(fs.readFileSync(path.join(OUT, `${id}.json`), 'utf8'));
  const caps = (NARRATION[id] ?? meta.captions).map((c, i) => ({ ...c, index: i }));
  // Aufnahmen mit Sync-Marke bringen den Nullpunkt der Uhr mit; aeltere nicht.
  const start = meta.videoStart ?? 0;
  const clipFrames = Math.min(frames(dur(clip)), TRIM[id] ? frames(TRIM[id]) : Infinity);

  const slices = caps.map((c, i) => {
    const videoFrom = i === 0 ? frames(start) : frames(start + c.at);
    const videoTo = i + 1 < caps.length ? frames(start + caps[i + 1].at) : clipFrames;
    const lineId = `${id}-${String(c.index).padStart(2, '0')}`;
    const file = lineFile(lineId);
    const speech = file ? frames(dur(file)) + PAUSE : 0;
    const play = Math.max(1, videoTo - videoFrom);

    // Dauert der Abschnitt länger als der Satz, wird er beschleunigt (bis MAX_RATE),
    // damit keine Totzeit entsteht. Ist er kürzer, hält am Ende das Bild an.
    const cap = RATE[id] ?? MAX_RATE;
    const rate = speech > 0 && play > speech ? Math.min(cap, play / speech) : 1;
    const shown = Math.max(1, Math.round(play / rate));
    const hold = Math.max(0, speech - shown) + (i + 1 === caps.length ? TAIL : 0);
    holdTotal += hold;
    sped += play - shown;

    return {
      videoFrom, videoTo, shown, rate: Number(rate.toFixed(3)), hold, text: c.text,
      audio: file ? link(file, `audio/lines/${lineId}.mp3`) : null,
    };
  });

  chapters.push({
    id, kind: 'clip', title,
    clip: link(clip, `clips/${id}.webm`),
    clipFrames,
    // Kapitel 9 wurde schmaler aufgenommen; das Produktfenster übernimmt das
    // Seitenverhältnis, statt die Aufnahme zu verzerren.
    clipWidth: meta.width ?? 1920,
    clipHeight: meta.height ?? 1080,
    durationInFrames: slices.reduce((s, x) => s + x.shown + x.hold, 0),
    slices,
  });
}

const outroAudio = lineFile('11-outro');
chapters.push({
  id: '11-outro', kind: 'outro',
  durationInFrames: Math.max(frames(8), outroAudio ? frames(dur(outroAudio)) + 40 : 0),
  audio: outroAudio ? link(outroAudio, 'audio/11-outro.mp3') : null,
});

fs.writeFileSync(path.join(HERE, 'src/data.json'), JSON.stringify(
  { fps: FPS, width: 1920, height: 1080, transitionInFrames: TRANSITION, chapters }, null, 2));

const total = chapters.reduce((s, c) => s + c.durationInFrames, 0) - TRANSITION * (chapters.length - 1);
console.log(`${chapters.length} Kapitel · ${(total / FPS).toFixed(1)}s`
  + ` · ${(holdTotal / FPS).toFixed(1)}s gehalten · ${(sped / FPS).toFixed(1)}s durch Beschleunigen gespart`);
for (const c of chapters) {
  const held = (c.slices ?? []).reduce((s, x) => s + x.hold, 0);
  console.log(`  ${c.id.padEnd(9)} ${(c.durationInFrames / FPS).toFixed(1).padStart(5)}s`
    + `  ${(c.slices?.length ?? 1)} Einblendungen${held ? `, +${(held / FPS).toFixed(1)}s gehalten` : ''}`);
}
