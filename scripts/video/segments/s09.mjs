import { boot } from '../lib/kit.mjs';

// Schmaleres Fenster: unter 1536 px klappen die Aktionen ins Überlaufmenü.
export const meta = { width: 1512, height: 945 };

export async function run(api) {
  const { page } = api;
  await boot(api);
  await api.click('button:has-text("Logs öffnen"), a:has-text("Logs öffnen")', { after: 2200 });
  await page.waitForSelector('text=app-2026-08-16.log', { timeout: 30000 });
  await api.click('button:has-text("app-2026-08-16.log")', { after: 2400 });

  api.say('Im schmalen Fenster rücken die Aktionen in ein Menü.');
  await api.wait(2000);

  api.say('Das Drei-Punkte-Symbol öffnet es.');
  await api.click('button[aria-label="Weitere Aktionen"]', { after: 1600 });
  await api.wait(2800);
  await page.keyboard.press('Escape');
  await api.wait(1000);

  await api.click('button:has-text("Zurück")', { after: 2600 });

}
