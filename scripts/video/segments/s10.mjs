import { boot } from '../lib/kit.mjs';

export const meta = {};

export async function run(api) {
  const { page } = api;
  await boot(api);

  api.say('Bleiben die Einstellungen.');
  await api.click('header >> text=Einstellungen', { after: 1800 });

  api.say('Die Darstellung folgt dem System oder erzwingt hell bzw. dunkel.');
  await api.click('button:has-text("Hell")', { after: 2600 });
  await api.click('button:has-text("Dunkel")', { after: 2200 });
  await api.click('button:has-text("System")', { after: 1800 });

  api.say('Die Sprache schaltet die Oberfläche um.');
  await api.click('button:has-text("English")', { after: 2800 });
  await api.click('button:has-text("Deutsch")', { after: 2400 });

  api.say('Das Live-Intervall bestimmt, wie oft nachgeladen wird.');
  await api.click('button:has-text("5S"), button:has-text("5s")', { after: 2000 });
  await api.click('button:has-text("10S"), button:has-text("10s")', { after: 1800 });

  api.say('Die Log-Level-Einfärbung lässt sich abschalten.');
  await api.click('button:has-text("Aus")', { after: 2000 });
  await api.click('button:has-text("An")', { after: 1800 });

  api.say('Verbindungen lassen sich als JSON exportieren und importieren.');
  await api.moveTo('button:has-text("Exportieren")');
  await api.wait(2600);

  api.say('Unter „Diagnose" öffnet sich das Logverzeichnis der App.');
  await api.moveTo('button:has-text("Logverzeichnis öffnen")');
  await api.wait(3000);

}
