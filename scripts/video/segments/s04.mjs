import { boot } from '../lib/kit.mjs';

export const meta = {};

export async function run(api) {
  const { page } = api;
  await boot(api);
  await api.click('button:has-text("Logs öffnen"), a:has-text("Logs öffnen")', { after: 2200 });
  await page.waitForSelector('text=app-2026-08-17.log', { timeout: 30000 });

  api.say('Die Datei öffnet sich im Viewer.');
  await api.click('button:has-text("app-2026-08-17.log")', { after: 2600 });
  await page.waitForSelector('pre', { timeout: 30000 });
  await api.wait(1200);

  await api.moveTo('header:has-text("app-2026-08-17.log")');
  await api.wait(2400);

  api.say('Log-Level werden farbig hervorgehoben.');
  await page.mouse.move(1200, 700, { steps: 20 });
  await page.mouse.wheel(0, 600);
  await api.wait(2600);

  api.say('Die Inhaltssuche greift ab drei Zeichen und zählt die Treffer.');
  await api.typeSlow('input[placeholder="Inhalt durchsuchen..."]', 'ERROR', 130);
  await api.wait(2200);

  api.say('Mit den Pfeilen geht es von Treffer zu Treffer.');
  await api.click('button[aria-label="Nächster Treffer"]', { after: 1400 });
  await api.click('button[aria-label="Nächster Treffer"]', { after: 1400 });
  await api.click('button[aria-label="Nächster Treffer"]', { after: 1400 });
  await api.click('button[aria-label="Vorheriger Treffer"]', { after: 1600 });

  await api.click('button[aria-label="Inhaltssuche löschen"]', { after: 1600 });

  await api.moveTo('footer:has-text("Zeilen")');
  await api.wait(2600);
}
