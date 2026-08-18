/**
 * Vertont jede einzelne Einblendung (out/NN.json) sowie Vor- und Abspann.
 * Ergebnis: audio/lines/<Kapitel>-<Nr>.mp3 — Remotion legt jede Zeile genau an
 * die Stelle, an der die zugehörige Aktion im Bild passiert.
 *
 *   node tts-lines.mjs                 # nur fehlende Zeilen erzeugen
 *   node tts-lines.mjs --force 03      # Kapitel 03 komplett neu
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const LINES = path.join(HERE, 'audio/lines');
const CHAPTERS = JSON.parse(fs.readFileSync(path.join(HERE, 'lib/chapters.json'), 'utf8'));
const VOICE = process.env.ELEVENLABS_VOICE ?? 'rKiu7lQ4c5P3az3745s3';   // Carla Blum
const MODEL = 'eleven_multilingual_v2';
const TEMPO = 1.08;   // etwas zügiger sprechen, ohne die Stimmlage zu verändern

/**
 * Was im Bild steht, ist nicht immer gut sprechbar: typografische Anführungs-
 * zeichen und Gedankenstriche bringen die Sprachsynthese aus dem Takt - aus
 * sieben Wörtern wurden so schon sechs Sekunden Gemurmel. Die Einblendung
 * bleibt unverändert, nur der gesprochene Text wird geglättet.
 */
const speakable = (text) => text
  .replace(/[„“”"]/g, '')
  .replace(/\s*—\s*/g, ', ')
  .replace(/…/g, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

const KEY = (process.env.ELEVENLABS_API_KEY
  ?? fs.readFileSync(path.join(HERE, '.env'), 'utf8').match(/ELEVENLABS_API_KEY\s*=\s*(.+)/)?.[1] ?? '').trim();
if (!KEY) { console.error('Kein API-Schlüssel gefunden.'); process.exit(1); }

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));

const jobs = [];
jobs.push({ id: '00-intro', text: fs.readFileSync(path.join(HERE, 'transcript/elevenlabs/00-intro.txt'), 'utf8').trim() });
for (const { id } of CHAPTERS) {
  const f = path.join(OUT, `${id}.json`);
  if (!fs.existsSync(f)) continue;
  JSON.parse(fs.readFileSync(f, 'utf8')).captions.forEach((c, i) => {
    jobs.push({ id: `${id}-${String(i).padStart(2, '0')}`, chapter: id, text: c.text });
  });
}
jobs.push({ id: '11-outro', text: fs.readFileSync(path.join(HERE, 'transcript/elevenlabs/11-outro.txt'), 'utf8').trim() });

fs.mkdirSync(LINES, { recursive: true });
let made = 0, chars = 0, skipped = 0;

for (const [i, job] of jobs.entries()) {
  if (only.length && !only.some((o) => job.id.startsWith(o))) continue;
  const target = path.join(LINES, `${job.id}.mp3`);
  if (fs.existsSync(target) && !force) { skipped++; continue; }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: speakable(job.text),
      model_id: MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, use_speaker_boost: true },
    }),
  });
  if (!res.ok) { console.error(`${job.id}: FEHLER ${res.status} ${(await res.text()).slice(0, 200)}`); process.exit(1); }
  const raw = target + '.raw.mp3';
  fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));

  // Vorlauf und Nachlauf abschneiden, Tempo leicht anziehen, Pegel angleichen.
  // Ohne das Trimmen entstehen zwischen den Sätzen hörbare Löcher.
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-af',
    'silenceremove=start_periods=1:start_silence=0:start_threshold=-50dB,'
    + 'areverse,silenceremove=start_periods=1:start_silence=0.10:start_threshold=-50dB,areverse,'
    + `atempo=${TEMPO},loudnorm=I=-16:TP=-1.5:LRA=11`,
    '-codec:a', 'libmp3lame', '-q:a', '2', target]);
  fs.rmSync(raw);
  made++; chars += job.text.length;

  // Deutlich zu lange Aufnahmen bedeuten meist erfundenen Text - melden statt still übernehmen.
  const seconds = parseFloat(execFileSync('ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', target], { encoding: 'utf8' }));
  const expected = job.text.split(/\s+/).length / 2.4 + 1.2;
  if (seconds > expected * 1.35) {
    console.error(`  ⚠︎ ${job.id}: ${seconds.toFixed(1)}s für ${job.text.split(/\s+/).length} Wörter `
      + `(erwartet ~${expected.toFixed(1)}s) — Text prüfen und mit --force neu erzeugen`);
  }
  console.log(`${job.id.padEnd(10)} ${(fs.statSync(target).size / 1024).toFixed(0).padStart(4)} KB  ${job.text.slice(0, 60)}`);
}
console.log(`\n${made} Zeilen erzeugt, ${skipped} übersprungen, ${chars} Zeichen verbraucht.`);
