import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './lib/kit.mjs';
import { CHAPTERS } from './lib/chapters.mjs';

const W = 1920, H = 1080, FPS = 25, FADE = 0.35;
const work = path.join(OUT, 'work');
fs.mkdirSync(work, { recursive: true });
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const dur = (f) =>
  parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim());

/** Still image -> clip of the given length. */
function card(png, seconds, out) {
  ff(['-loop', '1', '-t', String(seconds), '-i', png, '-vf',
      `fps=${FPS},scale=${W}:${H},${fades(seconds)},format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', out]);
}

// Dieses ffmpeg kennt kein xfade -> weiche Uebergaenge ueber Ab-/Aufblenden.
function fades(total) {
  return `fade=t=in:st=0:d=${FADE},fade=t=out:st=${Math.max(0, total - FADE).toFixed(2)}:d=${FADE}`;
}

/** Segment video + its captions, normalised to 1920x1080. */
function segment(id) {
  const src = path.join(OUT, `${id}.webm`);
  const meta = JSON.parse(fs.readFileSync(path.join(OUT, `${id}.json`), 'utf8'));
  const out = path.join(work, `${id}.mp4`);
  const total = dur(src);
  const pngs = meta.captions.map((_, i) => path.join(OUT, 'ov', `${id}-${String(i).padStart(2, '0')}.png`));

  const inputs = ['-i', src, ...pngs.flatMap((p) => ['-i', p])];
  const chain = [];
  // Kleinere Aufnahmen (Segment 9) auf 1080p hochskalieren und mittig einbetten.
  chain.push(`[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=#070b13,fps=${FPS},setsar=1[base]`);
  let last = 'base';
  meta.captions.forEach((c, i) => {
    const start = i === 0 ? 0 : Math.max(0, c.at - 0.15);  // erste Einblendung steht ab Segmentbeginn
    const end = i + 1 < meta.captions.length ? meta.captions[i + 1].at - 0.15 : total;
    const label = i + 1 === meta.captions.length ? 'vout' : `v${i}`;
    chain.push(`[${last}][${i + 1}:v]overlay=0:0:enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'[${label}]`);
    last = label;
  });
  const mapLabel = meta.captions.length ? 'vout' : 'base';
  chain.push(`[${mapLabel}]${fades(total)}[vfinal]`);
  ff([...inputs, '-filter_complex', chain.join(';'), '-map', '[vfinal]',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), out]);
  console.log(`✓ ${id} (${total.toFixed(1)}s, ${meta.captions.length} Einblendungen)`);
  return out;
}

const ids = Object.keys(CHAPTERS).filter((id) => fs.existsSync(path.join(OUT, `${id}.webm`))).sort();
const intro = path.join(work, 'intro.mp4');
const outro = path.join(work, 'outro.mp4');
card(path.join(OUT, 'ov', 'intro.png'), 5, intro);
card(path.join(OUT, 'ov', 'outro.png'), 8, outro);
const clips = [intro, ...ids.map(segment), outro];

// Alles aneinanderhaengen (gleiche Encodier-Parameter -> verlustfreies Kopieren).
const listFile = path.join(work, 'concat.txt');
fs.writeFileSync(listFile, clips.map((c) => `file '${c}'`).join('\n'));
const final = path.join(OUT, 'anleitung-azure-blob-logviewer.mp4');
ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', final]);
console.log(`\n\u25b6 ${final}  (${dur(final).toFixed(1)}s)`);
