import { boot } from '../lib/kit.mjs';

export const meta = { useState: false, saveState: true };

async function pick(api, index, optionName) {
  const select = api.page.locator('.p-dialog p-select').nth(index);
  await api.click(select);
  const option = api.page.getByRole('option', { name: optionName, exact: true });
  await option.waitFor({ timeout: 30000 });
  await api.click(option, { after: 700 });
}

export async function run(api) {
  const { page } = api;
  await boot(api);

  api.say('Das Dashboard verwaltet die Storage-Verbindungen.');
  await api.wait(2400);

  await api.moveTo('text=Container gesamt');
  await api.wait(2000);

  api.say('Neue Verbindung anlegen.');
  await api.click('button:has-text("Neue Storage-Verbindung")', { after: 1400 });

  api.say('Zuerst ein frei wählbarer Name.');
  await api.typeSlow('.p-dialog input[formcontrolname="name"]', 'prod-app-logs');

  api.say('Dazu optional eine Kategorie zum Gruppieren.');
  await api.typeSlow('.p-dialog input[formcontrolname="category"]', 'Betrieb');

  api.say('Dann folgt die Auswahl des Azure-Abos.');
  await pick(api, 0, 'Azure-Abonnement 1');

  api.say('Danach das Speicherkonto.');
  await pick(api, 1, 'logviewertest');

  api.say('Und zuletzt der Container.');
  await pick(api, 2, 'logviewer-demo');

  await api.click('.p-dialog button:has-text("Verbindung speichern")', { after: 2000 });

  await api.moveTo('text=logviewertest / logviewer-demo');
  await api.wait(2400);

  api.say('Das Suchfeld filtert die Verbindungen.');
  await api.typeSlow('input[placeholder*="Verbindungen"]', 'prod', 110);
  await api.wait(1400);
  await page.locator('input[placeholder*="Verbindungen"]').fill('');
  await api.wait(900);

  api.say('Über das Drei-Punkte-Menü lässt sich jede Verbindung bearbeiten.');
  await api.click('button[aria-label="Weitere Aktionen"]', { after: 900 });
  await api.click('text=Bearbeiten', { after: 1600 });
  await api.wait(2200);
  await api.click('.p-dialog button:has-text("Abbrechen")', { after: 1200 });

  api.say('Oder wieder entfernen.');
  await api.click('button[aria-label="Weitere Aktionen"]', { after: 900 });
  await api.click('text=Entfernen', { after: 1500 });
  await api.wait(2000);
  await api.click('.p-confirmdialog button:has-text("Abbrechen")', { after: 1400 });
}
