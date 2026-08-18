/**
 * Legt die in audio/ abgelegten Sprachaufnahmen an ihre Startzeit und muxt sie ins Video.
 *   1. Sprechtexte aus transcript/elevenlabs/*.txt bei ElevenLabs vertonen
 *   2. Ergebnisse als audio/<ID>.mp3 speichern (ID = Dateiname des Textes, z. B. 03.mp3)
 *   3. node mix-audio.mjs
 * Fehlende Blöcke werden übersprungen, zu lange Blöcke gemeldet.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const tl = JSON.parse(fs.readFileSync(path.join(HERE, 'transcript/timeline.json'), 'utf8'));
const video = path.join(HERE, tl.video);
const out = path.join(HERE, 'out/anleitung-azure-blob-logviewer-vertont.mp4');
const dur = (f) => parseFloat(execFileSync('ffprobe',
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }));

const found = [];
for (const b of tl.blocks) {
  const hit = ['mp3', 'wav', 'm4a', 'aac', 'ogg']
    .map((e) => path.join(HERE, 'audio', `${b.id}.${e}`)).find((f) => fs.existsSync(f));
  if (!hit) { console.log(`⚠︎  ${b.id}: keine Audiodatei in audio/ — Block bleibt stumm`); continue; }
  const len = dur(hit);
  const over = len - b.slot;
  console.log(`${over > 0.4 ? '⚠︎ ' : '✓ '} ${b.id}  ${len.toFixed(1)}s / Fenster ${b.slot.toFixed(1)}s`
    + (over > 0.4 ? `  → ${over.toFixed(1)}s zu lang, läuft ins nächste Kapitel` : ''));
  found.push({ ...b, file: hit });
}
if (found.length === 0) { console.error('\nKeine Audiodateien gefunden — nichts zu tun.'); process.exit(1); }

const inputs = ['-i', video, ...found.flatMap((b) => ['-i', b.file])];
const chain = found.map((b, i) =>
  `[${i + 1}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,`
  // aelteres ffmpeg kennt adelay=...:all=1 nicht -> Verzoegerung je Kanal angeben
  + `adelay=${Math.round(b.start * 1000)}|${Math.round(b.start * 1000)}[a${i}]`);
// amix teilt die Pegel durch die Eingangszahl -> mit volume wieder anheben
// (die Blöcke überlappen sich nicht, deshalb ist das verlustfrei)
chain.push(`${found.map((_, i) => `[a${i}]`).join('')}amix=inputs=${found.length}:duration=longest,`
  // apad + -shortest: Tonspur bis zum Videoende mit Stille auffuellen, nicht kuerzen
  + `volume=${found.length},loudnorm=I=-16:TP=-1.5:LRA=11,apad[aout]`);

execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs,
  '-filter_complex', chain.join(';'), '-map', '0:v', '-map', '[aout]',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out],
  { stdio: 'inherit' });
console.log(`\n▶ ${out}  (${dur(out).toFixed(1)}s)`);
