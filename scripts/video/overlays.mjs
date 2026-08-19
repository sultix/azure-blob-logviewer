import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './lib/kit.mjs';

import { CHAPTERS } from './lib/chapters.mjs';

const CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1920px;height:1080px;background:transparent;
       font-family:"Inter","Helvetica Neue",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{position:absolute;left:0;right:0;bottom:54px;display:flex;justify-content:center}
  .box{max-width:1560px;background:rgba(9,14,24,.93);border:1px solid rgba(125,190,255,.22);
       border-radius:18px;padding:22px 34px 24px;box-shadow:0 18px 48px rgba(0,0,0,.55);
       border-left:5px solid #7dc4ff}
  .eyebrow{font-size:17px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#7dc4ff;margin-bottom:9px}
  .text{font-size:35px;line-height:1.32;font-weight:600;color:#eef4fb}

  .card{position:absolute;inset:0;background:#070b13;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:26px;text-align:center}
  .card .kicker{font-size:22px;letter-spacing:.34em;text-transform:uppercase;color:#7dc4ff;font-weight:700}
  .card h1{font-size:86px;font-weight:800;color:#f4f8ff;letter-spacing:-.02em}
  .card h2{font-size:52px;font-weight:700;color:#f4f8ff}
  .card p{font-size:32px;color:#a8b6c9;max-width:1280px;line-height:1.45}
  .card ul{list-style:none;display:flex;flex-wrap:wrap;gap:14px;justify-content:center;max-width:1400px}
  .card li{font-size:26px;color:#cfe0f2;background:rgba(125,196,255,.12);
           border:1px solid rgba(125,196,255,.28);border-radius:999px;padding:10px 22px}
  .card .foot{font-size:26px;color:#7f8ea3;margin-top:8px}
`;

const captionHtml = (eyebrow, text) => `<style>${CSS}</style>
  <div class="wrap"><div class="box">
    <div class="eyebrow">${eyebrow}</div>
    <div class="text">${text}</div>
  </div></div>`;

const introHtml = (version) => `<style>${CSS}</style>
  <div class="card">
    <div class="kicker">Anleitung</div>
    <h1>Azure Blob Logviewer</h1>
    <p>Logdateien aus Azure Blob Storage durchsuchen, live mitlesen und zusammenführen — alle Funktionen in gut fünf Minuten.</p>
    <div class="foot">Version ${version}</div>
  </div>`;

const outroHtml = () => `<style>${CSS}</style>
  <div class="card">
    <div class="kicker">Zusammengefasst</div>
    <h2>Das kann der Azure Blob Logviewer</h2>
    <ul>
      <li>Anmeldung über die Azure CLI</li><li>Verbindungen je Container</li>
      <li>Filter nach Name und Datum</li><li>Volltextsuche im Log</li>
      <li>Log-Level farbig</li><li>Dateien über 20 MB streamen</li>
      <li>Live-Modus (Tail)</li><li>Bis zu 5 Dateien zusammenführen</li>
      <li>Gelöschte Blobs wiederherstellen</li><li>Import/Export der Verbindungen</li>
    </ul>
    <div class="foot">Voraussetzung: Azure CLI installiert und „az login" ausgeführt.</div>
  </div>`;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const dir = path.join(OUT, 'ov');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

async function shot(html, file) {
  await page.setContent(html);
  await page.waitForTimeout(120);
  await page.screenshot({ path: file, omitBackground: true });
}

for (const id of Object.keys(CHAPTERS)) {
  const metaFile = path.join(OUT, `${id}.json`);
  if (!fs.existsSync(metaFile)) continue;
  const { captions } = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  for (let i = 0; i < captions.length; i++) {
    await shot(captionHtml(esc(CHAPTERS[id]), esc(captions[i].text)), path.join(dir, `${id}-${String(i).padStart(2, '0')}.png`));
  }
  console.log(`overlays ${id}: ${captions.length}`);
}

await shot(introHtml('1.1.0'), path.join(dir, 'intro.png'));
await shot(outroHtml(), path.join(dir, 'outro.png'));
console.log('title cards ok');

await browser.close();
