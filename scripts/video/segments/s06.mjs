import { boot } from '../lib/kit.mjs';

export const meta = {};

export async function run(api) {
  const { page } = api;
  await boot(api);
  await api.click('button:has-text("Logs öffnen"), a:has-text("Logs öffnen")', { after: 2200 });
  await page.waitForSelector('text=live.log', { timeout: 30000 });

  api.say('In eine Datei, die gerade beschrieben wird, sieht man live hinein.');
  await api.click('button:has-text("live.log")', { after: 2600 });
  await page.waitForSelector('#logs-live-mode', { timeout: 30000 });
  await api.wait(1200);

  api.say('Der Schalter „Live" oben rechts schaltet ihn ein.');
  await api.click('label[for="logs-live-mode"] .p-toggleswitch-slider', { after: 2600 });

  api.say('Neue Zeilen laufen automatisch unten ein.');
  await api.wait(9000);

  api.say('Wie oft nachgeladen wird, legen die Einstellungen fest — fünf bis sechzig Sekunden.');
  await api.wait(6000);

  await api.click('label[for="logs-live-mode"] .p-toggleswitch-slider', { after: 3000 });
}
