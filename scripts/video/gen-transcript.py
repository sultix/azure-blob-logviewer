#!/usr/bin/env python3
"""Baut aus den Sprechtexten in transcript/elevenlabs/ die Zeitleiste und das Skript.
Quelle der Wahrheit sind die .txt-Dateien - dort aendern, dann dieses Skript erneut laufen lassen."""
import json, subprocess, os, textwrap

TITLES = [
    ('00-intro', 'Titel', 'intro'),
    ('01', 'Kapitel 1 — Anmeldung an Azure', '01'),
    ('02', 'Kapitel 2 — Verbindungen verwalten', '02'),
    ('03', 'Kapitel 3 — Logdateien finden', '03'),
    ('04', 'Kapitel 4 — Logs lesen und durchsuchen', '04'),
    ('05', 'Kapitel 5 — Sehr große Dateien', '05'),
    ('06', 'Kapitel 6 — Live-Modus', '06'),
    ('07', 'Kapitel 7 — Dateien zusammenführen', '07'),
    ('08', 'Kapitel 8 — Gelöschte Dateien', '08'),
    ('09', 'Kapitel 9 — Kompaktes Fenster', '09'),
    ('10', 'Kapitel 10 — Einstellungen', '10'),
    ('11-outro', 'Abspann', 'outro'),
]
WPS = 2.35  # Richtwert deutsche TTS-Stimme, normales Tempo

dur = lambda f: float(subprocess.check_output(
    ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).decode())
tc = lambda s: f'{int(s // 60)}:{s % 60:05.2f}'

offset, rows = 0.0, []
for bid, title, seg in TITLES:
    text = open(f'transcript/elevenlabs/{bid}.txt').read().strip()
    d = dur(f'out/work/{seg}.mp4')
    words = len(text.split())
    rows.append(dict(id=bid, title=title, start=round(offset, 2), slot=round(d, 2),
                     words=words, estimate=round(words / WPS, 1), text=text))
    offset += d

json.dump({'video': 'out/anleitung-azure-blob-logviewer.mp4', 'total': round(offset, 2), 'blocks': rows},
          open('transcript/timeline.json', 'w'), ensure_ascii=False, indent=2)

md = ['# Sprecherskript — Anleitung „Azure Blob Logviewer"', '',
      f'Video {tc(offset)} · 12 Blöcke · {sum(r["words"] for r in rows)} Wörter · '
      f'geschätzte Sprechzeit {tc(sum(r["estimate"] for r in rows))}', '',
      '## Ablauf', '',
      '1. Je Block den Text unten (oder die Datei `transcript/elevenlabs/<ID>.txt`) bei ElevenLabs vertonen.',
      '2. Ergebnis als `audio/<ID>.mp3` speichern — Dateiname exakt wie die Block-ID, z. B. `audio/03.mp3`.',
      '3. `node mix-audio.mjs` — legt jeden Block auf seine Startzeit, normalisiert auf -16 LUFS',
      '   und schreibt `out/anleitung-azure-blob-logviewer-vertont.mp4`.', '',
      'Empfohlene ElevenLabs-Einstellungen: Modell **Eleven Multilingual v2** (deutsche Stimme),',
      'Stability ~50 %, Similarity ~75 %, Speed 1.0, Ausgabe MP3 44,1 kHz. Blöcke einzeln rendern,',
      'nicht am Stück — nur so passen die Startzeiten. Bleibt ein Block länger als sein Fenster,',
      'meldet das Mix-Skript es und die Stimme läuft ins nächste Kapitel hinein.', '',
      'Die Texte sind sprechfertig: Zahlen und Einheiten sind ausgeschrieben (»zwanzig Megabyte«),',
      'damit die Stimme sie nicht buchstabiert.', '',
      '| Block | Start | Fenster | Wörter | geschätzt | Reserve |', '|---|---|---|---|---|---|']
md += [f'| `{r["id"]}` | {tc(r["start"])} | {r["slot"]:.1f}s | {r["words"]} | {r["estimate"]:.1f}s | '
       f'{r["slot"] - r["estimate"]:+.1f}s |' for r in rows]
md += ['', '---', '']
for r in rows:
    md += [f'## {r["id"]} — {r["title"]}',
           f'*Start {tc(r["start"])} · Fenster {r["slot"]:.1f}s · Ziel ≈ {r["estimate"]:.1f}s*', '',
           textwrap.fill(r['text'], 100), '']
open('transcript/skript.md', 'w').write('\n'.join(md) + '\n')

print(f'{"Block":10}{"Start":>9}{"Fenster":>9}{"Wörter":>8}{"geschätzt":>11}{"Reserve":>9}')
for r in rows:
    print(f'{r["id"]:10}{tc(r["start"]):>9}{r["slot"]:8.1f}s{r["words"]:8}{r["estimate"]:10.1f}s'
          f'{r["slot"] - r["estimate"]:+8.1f}s')
print(f'\nSprechzeit ~{sum(r["estimate"] for r in rows):.0f}s / Video {offset:.0f}s')
