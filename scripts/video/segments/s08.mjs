import { boot } from '../lib/kit.mjs';

export const meta = {};

export async function run(api) {
  const { page } = api;
  await boot(api);
  await api.click('button:has-text("Logs öffnen"), a:has-text("Logs öffnen")', { after: 2200 });
  await page.waitForSelector('text=Verfügbare Logs', { timeout: 30000 });

  api.say('Gelöschte Dateien bleiben erreichbar, solange die Soft-Delete-Frist läuft.');
  await api.wait(2200);

  api.say('Der Schalter „Gelöschte" nimmt sie in die Liste auf.');
  await api.click('label[for="logs-include-deleted"] .p-toggleswitch-slider', { after: 1200 });
  await page.waitForSelector('text=archived.log', { timeout: 30000 });
  await api.wait(1800);

  api.say('Das rote Kennzeichen zeigt die Restdauer.');
  await api.moveTo('button:has-text("archived.log")');
  await api.wait(2800);

  api.say('Beim Öffnen bietet die App an, sie wiederherzustellen.');
  await api.click('button:has-text("archived.log")', { after: 2200 });
  await page.waitForSelector('.p-confirmdialog', { timeout: 20000 });
  await api.wait(2600);

  await api.click('.p-confirmdialog button:has-text("Abbrechen")', { after: 2000 });

  api.say('Von manchen gelöschten Dateien liegt noch eine Version im Speicher.');
  await api.moveTo('button:has-text("versioned.log")');
  await api.wait(2400);

  api.say('Die öffnet sich sofort und schreibgeschützt, ganz ohne Rückfrage.');
  await api.click('button:has-text("versioned.log")', { after: 2400 });
  await page.waitForSelector('text=schreibgeschützt', { timeout: 20000 });
  await api.moveTo('text=schreibgeschützt', { dy: 30 });
  await api.wait(3000);
}
