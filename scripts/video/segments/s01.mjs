import { boot } from '../lib/kit.mjs';

export const meta = { useState: false, saveState: false };

export async function run(api) {
  const { page } = api;
  await boot(api);

  api.say('Die App liest Logdateien direkt aus dem Blob Storage.');
  await api.wait(2600);

  api.say('Zuerst die Anmeldung, oben rechts über Einstellungen.');
  await api.click('header >> text=Einstellungen', { after: 1600 });

  await api.moveTo('text=Azure-Status');
  await api.wait(2000);

  api.say('So sieht der abgemeldete Zustand aus.');
  await api.click('button:has-text("Abmelden")', { after: 1600 });
  await page.waitForSelector('button:has-text("Mit Azure verbinden")', { timeout: 20000 });
  await api.wait(1600);

  api.say('Voraussetzung ist eine angemeldete Azure-Kommandozeile.');
  await api.moveTo('text=az login');
  await api.wait(2800);

  api.say('Ein Klick übernimmt die vorhandene Sitzung.');
  await api.click('button:has-text("Mit Azure verbinden")', { after: 1000 });
  await page.waitForSelector('button:has-text("Abmelden")', { timeout: 30000 });
  await api.wait(2000);

  api.say('Fertig — authentifiziert.');
  await api.moveTo('text=Azure-Status');
  await api.wait(2600);
}
