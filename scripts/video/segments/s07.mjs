import { boot } from '../lib/kit.mjs';

export const meta = {};

export async function run(api) {
  const { page } = api;
  await boot(api);
  await api.click('button:has-text("Logs öffnen"), a:has-text("Logs öffnen")', { after: 2200 });
  await page.waitForSelector('text=app-2026-08-15.log', { timeout: 30000 });

  api.say('Mehrere Dateien lassen sich zusammenführen.');
  await api.click('button:has-text("app-2026-08-15.log")', { after: 2200 });

  api.say('Dazu die weiteren mit gedrückter Command- oder Steuerungstaste anklicken.');
  await api.ctrlClick('button:has-text("app-2026-08-16.log")');
  await api.wait(1200);
  await api.ctrlClick('button:has-text("app-2026-08-17.log")');
  await api.wait(2600);

  await api.moveTo('text=Dateien ausgewählt');
  await api.wait(2600);

  api.say('Bis zu fünf Dateien, in Klickreihenfolge.');
  await api.wait(2800);

  api.say('Der Download speichert alles als eine Textdatei.');
  await api.click('button[aria-label="Herunterladen"]', { after: 1600 });

  api.say('Ein Hinweis bestätigt den Download samt Dateinamen.');
  await api.wait(1800);
}
