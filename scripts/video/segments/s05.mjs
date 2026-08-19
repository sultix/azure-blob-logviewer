import { boot } from '../lib/kit.mjs';

export const meta = {};

export async function run(api) {
  const { page } = api;
  await boot(api);
  await api.click('button:has-text("Logs öffnen"), a:has-text("Logs öffnen")', { after: 2200 });
  await page.waitForSelector('text=big-export.log', { timeout: 30000 });

  api.say('Diese Datei ist rund sechsundzwanzig Megabyte groß.');
  await api.moveTo('button:has-text("big-export.log")');
  await api.wait(2200);

  api.say('Ab zwanzig Megabyte übernimmt ein Streaming-Viewer: das Ende ist sofort da, der Rest lädt nach.');
  await api.click('button:has-text("big-export.log")', { after: 3000 });
  await api.wait(2500);

  await api.moveTo('text=/geladen/');
  await api.wait(3500);

  api.say('Gescrollt wird trotzdem flüssig.');
  await page.mouse.move(1200, 700, { steps: 20 });
  await page.mouse.wheel(0, 1400);
  await api.wait(1500);
  await page.mouse.wheel(0, -900);
  await api.wait(2500);

  await api.wait(2600);
}
