import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const OUT = path.join(ROOT, 'out');
export const APP = 'http://localhost:34115';
export const STATE = path.join(OUT, 'state.json');

const CURSOR = `
(() => {
  const install = () => {
    if (document.getElementById('__cur')) return;
    const s = document.createElement('style');
    s.textContent = \`
      #__cur{position:fixed;z-index:2147483647;width:20px;height:20px;margin:-10px 0 0 -10px;
        border-radius:50%;background:rgba(255,255,255,.92);
        box-shadow:0 0 0 2px rgba(0,0,0,.6),0 3px 10px rgba(0,0,0,.55);
        pointer-events:none;left:-200px;top:-200px;opacity:0;
        transition:opacity .28s ease}
      #__cur.__on{opacity:1}
      .__rip{position:fixed;z-index:2147483646;width:18px;height:18px;margin:-9px 0 0 -9px;
        border-radius:50%;border:2px solid #38bdf8;pointer-events:none;
        animation:__rip .55s ease-out forwards}
      @keyframes __rip{to{transform:scale(3.4);opacity:0}}\`;
    document.head.appendChild(s);
    const c = document.createElement('div');
    c.id = '__cur';
    document.body.appendChild(c);
    // Der Zeiger gehoert zur Handlung, nicht zum Bild: er blendet sich beim
    // Bewegen ein und nach kurzer Ruhe wieder aus. Wo die Kamera die Aktion
    // schon erklaert, bleibt er damit von selbst weg.
    let idle;
    addEventListener('mousemove', e => {
      c.style.left = e.clientX + 'px';
      c.style.top = e.clientY + 'px';
      c.classList.add('__on');
      clearTimeout(idle);
      idle = setTimeout(() => c.classList.remove('__on'), 900);
    }, true);
    addEventListener('mousedown', e => {
      c.classList.add('__on');
      const r = document.createElement('div');
      r.className = '__rip';
      r.style.left = e.clientX + 'px';
      r.style.top = e.clientY + 'px';
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 600);
    }, true);
  };
  if (document.body) install();
  else addEventListener('DOMContentLoaded', install);
})();
`;

/** Records one segment into out/<id>.webm plus out/<id>.json (caption timeline). */
export async function record(id, opts, fn) {
  const { width = 1920, height = 1080, useState = true, saveState = false } = opts;
  fs.mkdirSync(OUT, { recursive: true });
  const dir = path.join(OUT, `raw-${id}`);
  fs.rmSync(dir, { recursive: true, force: true });

  const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    recordVideo: { dir, size: { width, height } },
    storageState: useState && fs.existsSync(STATE) ? STATE : undefined,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    colorScheme: 'light',   // App folgt dem Systemthema -> helles Design
  });
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  let t0 = Date.now();
  const captions = [];

  const api = {
    page,
    /** Caption shown from now until the next caption. */
    say: (text) => { captions.push({ at: (Date.now() - t0) / 1000, text }); },
    /**
     * Chromium schreibt nur Bilder, wenn sich etwas aendert: die stille
     * Ladephase am Anfang fehlt in der Aufnahme, und alles danach rutscht um
     * genau diese Zeit nach vorn. Ein kurzer Magenta-Blitz markiert deshalb den
     * Nullpunkt; record() sucht ihn spaeter im Video und verschiebt die
     * Einblendungen entsprechend.
     */
    async syncMark() {
      await page.evaluate(() => {
        const d = document.createElement('div');
        d.id = '__sync';
        d.style.cssText = 'position:fixed;inset:0;background:#ff00ff;z-index:2147483647;pointer-events:none';
        document.body.appendChild(d);
      });
      await page.waitForTimeout(200);
      await page.evaluate(() => document.getElementById('__sync')?.remove());
      await page.waitForTimeout(60);
      t0 = Date.now();
    },
    wait: (ms) => page.waitForTimeout(ms),
    /** Smooth mouse travel to an element, then click it. */
    async moveTo(target, { dx = 0, dy = 0 } = {}) {
      const loc = typeof target === 'string' ? page.locator(target) : target;
      await loc.first().scrollIntoViewIfNeeded().catch(() => {});
      const box = await loc.first().boundingBox();
      if (!box) throw new Error(`no bounding box for ${target}`);
      const x = box.x + box.width / 2 + dx;
      const y = box.y + box.height / 2 + dy;
      await page.mouse.move(x, y, { steps: 26 });
      await page.waitForTimeout(260);
      return { x, y };
    },
    async click(target, o = {}) {
      const { x, y } = await api.moveTo(target, o);
      await page.mouse.down();
      await page.waitForTimeout(90);
      await page.mouse.up();
      await page.waitForTimeout(o.after ?? 500);
      return { x, y };
    },
    async ctrlClick(target) {
      await api.moveTo(target);
      await page.keyboard.down('Meta');
      await page.mouse.down();
      await page.waitForTimeout(90);
      await page.mouse.up();
      await page.keyboard.up('Meta');
      await page.waitForTimeout(500);
    },
    async typeSlow(target, text, delay = 95) {
      await api.click(target, { after: 200 });
      await page.keyboard.type(text, { delay });
      await page.waitForTimeout(400);
    },
  };

  let error = null;
  try {
    await fn(api);
  } catch (e) {
    error = e;
    api.say('(Aufnahmefehler)');
    await page.waitForTimeout(500);
  }

  if (saveState) await context.storageState({ path: STATE });
  const video = page.video();
  await context.close();
  await browser.close();

  const src = await video.path();
  const dest = path.join(OUT, `${id}.webm`);
  fs.rmSync(dest, { force: true });
  fs.renameSync(src, dest);
  fs.rmSync(dir, { recursive: true, force: true });
  const videoStart = findSyncMark(dest);
  fs.writeFileSync(path.join(OUT, `${id}.json`),
    JSON.stringify({ id, width, height, videoStart, captions }, null, 2));

  if (error) throw error;
  return dest;
}

/** Boot the app page and wait until Angular + the Wails bridge are live.
 *  Angular uses path routing, but the Wails dev server only serves "/",
 *  so every segment starts at the dashboard and navigates through the UI. */
export async function boot(api) {
  await api.page.goto(APP + '/', { waitUntil: 'domcontentloaded' });
  await api.page.waitForFunction(() => !!window.go?.app?.App?.GetVersion, null, { timeout: 30000 });
  await api.page.waitForSelector('app-root', { timeout: 30000 });
  await api.wait(700);
  await api.syncMark();
  await api.wait(500);
}

/** Sekunde im Video, an der der Magenta-Blitz endet - dort steht die Uhr auf null. */
function findSyncMark(file) {
  const raw = execFileSync('ffmpeg',
    ['-v', 'error', '-i', file, '-vf', 'scale=1:1,fps=25', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    { maxBuffer: 1 << 24 });
  let last = -1;
  for (let i = 0; i + 2 < raw.length; i += 3) {
    if (raw[i] > 190 && raw[i + 1] < 90 && raw[i + 2] > 190) last = i / 3;
  }
  return last < 0 ? 0 : Number(((last + 1) / 25).toFixed(3));
}

export const CONNECTION = {
  name: 'prod-app-logs',
  category: 'Betrieb',
  account: 'aicoachtest',
  container: 'logviewer-demo',
};
