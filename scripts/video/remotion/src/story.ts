/**
 * Regie des Films: Kamerafahrten, Hero-Typografie und Aktgliederung.
 *
 * Die Zeitachse selbst kommt weiterhin aus `data.json` (Ton führt). Hier steht
 * nur, wohin die Kamera schaut und wann eine Aussage groß im Bild steht.
 * Fahrten werden relativ zu den Abschnitten notiert (`slice` + `t` von 0 bis 1),
 * damit sie eine Neuvertonung oder ein neues Tempo unbeschadet überstehen.
 */
import { EaseName } from './motion';

/**
 * Ein Blickpunkt: `x`/`y` sind Bildanteile der Aufnahme, `zoom` ist relativ zur
 * Bühne. `t` markiert den **Beginn** der Fahrt, `dur` ihre Länge in Frames —
 * danach steht die Kamera, bis die nächste Fahrt beginnt.
 *
 * Wenige, klar gesetzte Fahrten schlagen viele kleine: drei pro Kapitel sind
 * die Regel, vier die Ausnahme für Hero-Momente.
 */
export type ShotSpec = {
  slice: number;
  t?: number;          // 0 = Abschnittsanfang, 1 = Abschnittsende
  zoom: number;
  x?: number;
  y?: number;
  dur?: number;
  ease?: EaseName;
};

export type HeroSpec = {
  eyebrow: string;
  lines: string[];
  slice: number;
  t?: number;
  hold: number;        // Sekunden, die die Aussage steht
  place?: 'bottomLeft' | 'left' | 'center';
  scale?: 'heroLarge' | 'hero' | 'heroSmall';
};

export type ChapterScript = {
  shots: ShotSpec[];
  hero?: HeroSpec;
};

/**
 * Fünf Akte statt zehn Kapitelkarten. Jede Tafel steht rund eine Sekunde und
 * gibt dem hellen Produktbild einen Kontrastschlag.
 */
export const acts: { before: string; index: string; title: string }[] = [
  // Vor Kapitel 1 steht bewusst keine Tafel: der Vorspann führt direkt ins
  // Produkt, und ein Schnitt dorthin wäre der erste Bruch im Film.
  { before: '03', index: '02 — Dateien', title: 'Logdateien finden' },
  { before: '05', index: '03 — Inhalt', title: 'Inhalte lesen' },
  { before: '07', index: '04 — Export', title: 'Ergebnisse sichern' },
  { before: '09', index: '05 — Konfiguration', title: 'Einstellungen anpassen' },
];

export const script: Record<string, ChapterScript> = {
  // Anmeldung: Überblick, Einstellungen, der eine Klick. Dazwischen Ruhe.
  '01': {
    shots: [
      { slice: 0, t: 0, zoom: 1.0 },
      { slice: 0, t: 0.3, zoom: 1.3, x: 0.88, y: 0.06 },
      { slice: 1, t: 0.12, zoom: 1.12, x: 0.5, y: 0.36, dur: 56 },
      { slice: 2, t: 0.25, zoom: 1.34, x: 0.5, y: 0.42 },
    ],
  },

  // Verbindungen: der Dialog wächst aus der Schaltfläche, die ihn öffnet.
  '02': {
    shots: [
      { slice: 0, t: 0, zoom: 1.0 },
      { slice: 1, t: 0.04, zoom: 1.3, x: 0.74, y: 0.39 },
      { slice: 1, t: 0.28, zoom: 1.16, x: 0.5, y: 0.52, dur: 56 },
      { slice: 3, t: 0.2, zoom: 1.28, x: 0.8, y: 0.5 },
    ],
    hero: {
      eyebrow: 'Verbindungen', lines: ['Abonnement, Konto', 'und Container festlegen.'],
      slice: 0, t: 0.12, hold: 4.4, place: 'bottomLeft', scale: 'heroSmall',
    },
  },

  // Dateiliste: hinein in den Container, dann einmal auf die Filterspalte.
  '03': {
    shots: [
      { slice: 0, t: 0, zoom: 1.0 },
      { slice: 0, t: 0.18, zoom: 1.28, x: 0.77, y: 0.5 },
      // Der Klick wechselt die ganze Ansicht: erst zurück auf Überblick,
      // sonst hinge die Kamera auf dem leeren Lesebereich fest.
      { slice: 0, t: 0.62, zoom: 1.04, x: 0.5, y: 0.5, dur: 56 },
      { slice: 1, t: 0.22, zoom: 1.36, x: 0.12, y: 0.14, dur: 56 },
      { slice: 4, t: 0.25, zoom: 1.1, x: 0.3, y: 0.3, dur: 56 },
    ],
  },

  // Hero: die Volltextsuche. Anflug auf das Suchfeld, dann zu den Treffern.
  '04': {
    shots: [
      { slice: 0, t: 0, zoom: 1.0 },
      { slice: 0, t: 0.28, zoom: 1.2, x: 0.13, y: 0.33 },
      { slice: 0, t: 0.74, zoom: 1.04, x: 0.5, y: 0.5, dur: 56 },
      { slice: 1, t: 0.3, zoom: 1.3, x: 0.44, y: 0.3, dur: 56 },
      { slice: 2, t: 0.12, zoom: 1.42, x: 0.82, y: 0.09, dur: 66 },
      { slice: 3, t: 0.3, zoom: 1.14, x: 0.62, y: 0.36, dur: 66 },
    ],
    hero: {
      eyebrow: 'Volltextsuche', lines: ['Den Inhalt durchsuchen,', 'Treffer durchblättern.'],
      slice: 2, t: 0.5, hold: 5.2, place: 'bottomLeft', scale: 'heroSmall',
    },
  },

  // Hero: große Dateien. Größe im Bild, dann der Streaming-Viewer.
  '05': {
    shots: [
      { slice: 0, t: 0, zoom: 1.0 },
      { slice: 0, t: 0.38, zoom: 1.36, x: 0.14, y: 0.31 },
      { slice: 1, t: 0.12, zoom: 1.06, x: 0.5, y: 0.45, dur: 66 },
      { slice: 2, t: 0.35, zoom: 1.2, x: 0.58, y: 0.55, dur: 66 },
    ],
    hero: {
      eyebrow: 'Große Dateien', lines: ['Ab 20 MB lädt', 'der Viewer im Hintergrund.'],
      slice: 1, t: 0.5, hold: 5.0, place: 'bottomLeft', scale: 'heroSmall',
    },
  },

  // Hero: Live-Modus. Ein langsamer Anflug auf den Schalter, ein Rückzug —
  // danach macht die Bewegung der einlaufenden Zeilen den Rest.
  '06': {
    shots: [
      { slice: 0, t: 0, zoom: 1.0 },
      { slice: 0, t: 0.46, zoom: 1.24, x: 0.13, y: 0.3 },
      { slice: 1, t: 0.16, zoom: 1.46, x: 0.73, y: 0.08, dur: 72 },
      { slice: 2, t: 0.16, zoom: 1.08, x: 0.56, y: 0.62, dur: 72 },
    ],
    hero: {
      eyebrow: 'Live-Modus', lines: ['Neue Zeilen erscheinen,', 'sobald sie entstehen.'],
      slice: 2, t: 0.3, hold: 5.4, place: 'left', scale: 'heroSmall',
    },
  },

  // Zusammenführen: Auswahl, Ergebnis, Bestätigung.
  '07': {
    shots: [
      { slice: 0, t: 0, zoom: 1.0 },
      { slice: 0, t: 0.42, zoom: 1.26, x: 0.13, y: 0.36 },
      { slice: 2, t: 0.18, zoom: 1.16, x: 0.3, y: 0.11, dur: 56 },
      { slice: 4, t: 0.1, zoom: 1.2, x: 0.82, y: 0.84, dur: 56 },
    ],
    hero: {
      eyebrow: 'Zusammenführen', lines: ['Bis zu fünf Dateien', 'in einer Ansicht.'],
      slice: 2, t: 0.2, hold: 4.4, place: 'bottomLeft', scale: 'heroSmall',
    },
  },

  // Hero: gelöschte Dateien. Zwei Wege — mit Rückfrage und ohne.
  '08': {
    shots: [
      { slice: 0, t: 0, zoom: 1.0 },
      { slice: 1, t: 0.16, zoom: 1.4, x: 0.16, y: 0.24 },
      { slice: 2, t: 0.3, zoom: 1.34, x: 0.14, y: 0.46, dur: 56 },
      { slice: 3, t: 0.3, zoom: 1.08, x: 0.5, y: 0.48, dur: 66 },
      { slice: 5, t: 0.25, zoom: 1.3, x: 0.29, y: 0.11, dur: 56 },
    ],
    hero: {
      eyebrow: 'Wiederherstellen', lines: ['Gelöschte Dateien', 'wiederherstellen.'],
      slice: 3, t: 0.14, hold: 4.6, place: 'bottomLeft', scale: 'heroSmall',
    },
  },

  // Kompaktes Fenster: die Aufnahme ist schmaler, das Produktfenster auch.
  '09': {
    shots: [
      { slice: 0, t: 0, zoom: 1.02 },
      { slice: 1, t: 0.18, zoom: 1.34, x: 0.88, y: 0.1, dur: 56 },
    ],
  },

  // Einstellungen: zwei Blicke, dann zurück auf Überblick.
  '10': {
    shots: [
      { slice: 0, t: 0, zoom: 1.04, x: 0.5, y: 0.42 },
      { slice: 0, t: 0.26, zoom: 1.3, x: 0.67, y: 0.46 },
      { slice: 2, t: 0.2, zoom: 1.3, x: 0.68, y: 0.56, dur: 56 },
      { slice: 4, t: 0.2, zoom: 1.26, x: 0.64, y: 0.86, dur: 66 },
      { slice: 5, t: 0.35, zoom: 1.1, x: 0.5, y: 0.78, dur: 66 },
    ],
  },
};
