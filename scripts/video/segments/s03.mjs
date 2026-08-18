import { boot } from '../lib/kit.mjs';

export const meta = {};

export async function run(api) {
  const { page } = api;
  await boot(api);

  api.say('„Logs öffnen" führt in den Container.');
  await api.click('button:has-text("Logs öffnen"), a:has-text("Logs öffnen")', { after: 2500 });
  await page.waitForSelector('text=Verfügbare Logs', { timeout: 30000 });
  await page.waitForSelector('text=app-2026-08-17.log', { timeout: 30000 });
  await api.wait(1200);

  api.say('Links liegen alle Dateien mit Datum und Größe.');
  await api.moveTo('text=app-2026-08-17.log');
  await api.wait(2600);

  api.say('Das Suchfeld filtert die Dateinamen.');
  await api.typeSlow('input[placeholder="Logs durchsuchen..."]', 'app-2026', 110);
  await api.wait(1800);
  await page.locator('input[placeholder="Logs durchsuchen..."]').fill('');
  await api.wait(900);

  api.say('Ein Datumsfeld grenzt auf einen einzelnen Tag ein.');
  await api.click('input[placeholder="Erstellt am"]', { after: 900 });
  await page.waitForSelector('.p-datepicker-panel', { timeout: 10000 });
  await api.click('.p-datepicker-panel .p-datepicker-today', { after: 1600 });
  await page.keyboard.press('Escape');
  await api.wait(1600);

  api.say('Das zweite Feld nimmt einen Zeitraum.');
  await api.click('input[placeholder="Erstellt von - Erstellt bis"]', { after: 900 });
  await page.waitForSelector('.p-datepicker-panel', { timeout: 10000 });
  await api.click('.p-datepicker-panel td:not(.p-datepicker-other-month) >> text="15"', { after: 800 });
  await api.click('.p-datepicker-panel td:not(.p-datepicker-other-month) >> text="17"', { after: 1400 });
  await page.keyboard.press('Escape');
  await api.wait(1600);

  await api.click('button:has-text("Filter löschen")', { after: 1800 });

  api.say('Die Sortierung lässt sich umdrehen.');
  await api.click('p-splitbutton button:has-text("Neueste zuerst")', { after: 1800 });

  api.say('Das Menü wechselt zwischen Erstell- und Änderungsdatum.');
  await api.click('p-splitbutton button.p-splitbutton-dropdown', { after: 1200 });
  await api.wait(1400);
  await api.click('text=Nach Zuletzt geändert sortieren', { after: 1800 });

  api.say('Aktualisieren lädt die Liste neu.');
  await api.click('p-button[aria-label="Verfügbare Logs aktualisieren"]', { after: 2200 });

  await api.moveTo('text=Aktualisiert');
  await api.wait(2600);
}
