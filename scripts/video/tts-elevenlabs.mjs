/**
 * Vertont alle Blöcke aus transcript/elevenlabs/*.txt über die ElevenLabs-API
 * und legt sie als audio/<ID>.mp3 ab.
 *
 *   node tts-elevenlabs.mjs --voices              # verfügbare Stimmen auflisten
 *   node tts-elevenlabs.mjs --voice <id|name>     # alles vertonen
 *   node tts-elevenlabs.mjs --voice <id> 03 07    # nur einzelne Blöcke
 *
 * Schlüssel: Umgebungsvariable ELEVENLABS_API_KEY oder eine Zeile
 * ELEVENLABS_API_KEY=... in scripts/video/.env (steht in .gitignore).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEXTS = path.join(HERE, 'transcript/elevenlabs');
const AUDIO = path.join(HERE, 'audio');
const API = 'https://api.elevenlabs.io/v1';
const MODEL = process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2';

/** Schlüssel aus Umgebung, .env oder macOS-Schlüsselbund - in dieser Reihenfolge. */
function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();

  const envFile = path.join(HERE, '.env');
  if (fs.existsSync(envFile)) {
    const hit = fs.readFileSync(envFile, 'utf8').match(/^\s*ELEVENLABS_API_KEY\s*=\s*(.+)$/m);
    if (hit) return hit[1].trim().replace(/^["']|["']$/g, '');
  }

  try {
    const fromKeychain = execFileSync(
      'security', ['find-generic-password', '-s', 'ELEVENLABS_API_KEY', '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    if (fromKeychain) return fromKeychain;
  } catch { /* nicht im Schlüsselbund hinterlegt */ }

  console.error(
    'Kein API-Schlüssel gefunden. Drei Möglichkeiten:\n\n'
    + '1) Projektdatei (ohne Eintrag in der Shell-History):\n'
    + `     read -rs -p "Key: " k && printf 'ELEVENLABS_API_KEY=%s\\n' "$k" > ${envFile} && chmod 600 ${envFile} && unset k\n\n`
    + '2) macOS-Schlüsselbund (fragt den Wert verdeckt ab):\n'
    + '     security add-generic-password -a "$USER" -s ELEVENLABS_API_KEY -w\n\n'
    + '3) Nur für die laufende Shell:\n'
    + '     export ELEVENLABS_API_KEY="…"',
  );
  process.exit(1);
}

const KEY = apiKey();
const args = process.argv.slice(2);
const voiceArg = args.includes('--voice') ? args[args.indexOf('--voice') + 1] : process.env.ELEVENLABS_VOICE;
const only = args.filter((a) => /^[\w-]+$/.test(a) && a !== voiceArg && !a.startsWith('--'));

async function voices() {
  const res = await fetch(`${API}/voices`, { headers: { 'xi-api-key': KEY } });
  if (!res.ok) throw new Error(`Stimmen konnten nicht geladen werden: ${res.status} ${await res.text()}`);
  return (await res.json()).voices;
}

if (args.includes('--check')) {
  const res = await fetch(`${API}/user/subscription`, { headers: { 'xi-api-key': KEY } });
  if (!res.ok) { console.error(`Schlüssel abgelehnt: ${res.status} ${await res.text()}`); process.exit(1); }
  const s = await res.json();
  const left = s.character_limit - s.character_count;
  console.log(`Schlüssel gültig · Tarif ${s.tier} · ${left} von ${s.character_limit} Zeichen frei`);
  console.log(left >= 4484 ? 'Reicht für das komplette Video (4484 Zeichen).'
                           : 'Achtung: reicht nicht für alle 12 Blöcke auf einmal.');
  process.exit(0);
}

if (args.includes('--voices')) {
  for (const v of await voices()) {
    const labels = Object.values(v.labels ?? {}).join(', ');
    console.log(`${v.voice_id}  ${v.name.padEnd(22)} ${labels}`);
  }
  process.exit(0);
}

if (!voiceArg) {
  console.error('Bitte eine Stimme wählen: node tts-elevenlabs.mjs --voices\n'
    + 'danach: node tts-elevenlabs.mjs --voice <id oder Name>');
  process.exit(1);
}

// Name -> ID auflösen, falls kein Hex-Identifier übergeben wurde
let voiceId = voiceArg;
if (!/^[a-zA-Z0-9]{20,}$/.test(voiceArg)) {
  // Stimmennamen tragen oft einen Zusatz ("Matilda - Knowledgable, Professional")
  const wanted = voiceArg.toLowerCase();
  const all = await voices();
  const match = all.find((v) => v.name.toLowerCase() === wanted)
    ?? all.find((v) => v.name.toLowerCase().startsWith(wanted))
    ?? all.find((v) => v.name.toLowerCase().includes(wanted));
  if (!match) { console.error(`Stimme "${voiceArg}" nicht gefunden.`); process.exit(1); }
  voiceId = match.voice_id;
  console.log(`Stimme: ${match.name} (${voiceId})`);
}

const blocks = fs.readdirSync(TEXTS).filter((f) => f.endsWith('.txt')).sort()
  .map((f) => ({ id: path.basename(f, '.txt'), text: fs.readFileSync(path.join(TEXTS, f), 'utf8').trim() }));
fs.mkdirSync(AUDIO, { recursive: true });

let chars = 0;
for (const [i, b] of blocks.entries()) {
  if (only.length && !only.includes(b.id)) continue;
  const target = path.join(AUDIO, `${b.id}.mp3`);
  process.stdout.write(`${b.id} … `);
  const res = await fetch(`${API}/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: b.text,
      model_id: MODEL,
      // Nachbartexte sorgen für durchgehende Betonung über Kapitelgrenzen hinweg
      previous_text: blocks[i - 1]?.text,
      next_text: blocks[i + 1]?.text,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
    }),
  });
  if (!res.ok) { console.error(`FEHLER ${res.status}: ${(await res.text()).slice(0, 300)}`); process.exit(1); }
  fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  chars += b.text.length;
  console.log(`${(fs.statSync(target).size / 1024).toFixed(0)} KB`);
}

console.log(`\nFertig — ${chars} Zeichen verbraucht.`);
console.log('Weiter mit:  node remotion/gen-data.mjs  &&  cd remotion && npx remotion render src/index.ts Tutorial ../out/anleitung-remotion.mp4');
