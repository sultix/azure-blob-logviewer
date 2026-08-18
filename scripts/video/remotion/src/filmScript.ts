/**
 * Drehbuch des kurzen Produktfilms.
 *
 * Kein gekürztes Tutorial: eigene Auswahl, eigenes Tempo, keine Sprecherstimme.
 * Es laufen dieselben Aufnahmen wie im Hauptfilm, aber nur die Stellen, an
 * denen das Produkt für sich spricht. Zeiten in Sekunden der Originalaufnahme.
 */
import { EaseName } from './motion';

export type FilmShot = {
  at: number;          // 0…1 innerhalb der Einstellung: Beginn der Fahrt
  zoom: number;
  x?: number;
  y?: number;
  dur?: number;        // Länge der Fahrt in Frames; danach steht die Kamera
  ease?: EaseName;
};

export type FilmHero = {
  eyebrow?: string;
  lines: string[];
  at: number;          // 0…1 innerhalb der Einstellung
  hold: number;        // Sekunden
  place?: 'bottomLeft' | 'left' | 'center';
  scale?: 'heroLarge' | 'hero' | 'heroSmall';
};

export type FilmScene =
  | { kind: 'act'; index: string; title: string }
  | {
      kind: 'shot';
      id: string;
      chapter: string;
      from: number;      // Sekunde in der Aufnahme
      seconds: number;   // Länge im Film
      rate?: number;
      shots: FilmShot[];
      hero?: FilmHero;
    }
  | { kind: 'outro'; chapter: string; seconds: number };

export const film: FilmScene[] = [
  {
    kind: 'shot', id: 'hook', chapter: '01', from: 1.0, seconds: 7.0, rate: 0.65,
    shots: [
      { at: 0, zoom: 0.94, x: 0.5, y: 0.5 },
      { at: 0.12, zoom: 1.06, x: 0.5, y: 0.46, dur: 120 },
    ],
    hero: {
      eyebrow: 'Azure Blob Logviewer', lines: ['Logdateien direkt aus', 'Azure Blob Storage.'],
      at: 0.06, hold: 5.6, place: 'bottomLeft', scale: 'hero',
    },
  },

  { kind: 'act', index: '01 — Azure', title: 'Verbindung herstellen' },
  {
    kind: 'shot', id: 'connect', chapter: '01', from: 14.4, seconds: 5.6, rate: 1.0,
    shots: [
      { at: 0, zoom: 1.12, x: 0.5, y: 0.36 },
      { at: 0.24, zoom: 1.34, x: 0.5, y: 0.42, dur: 60 },
    ],
    hero: {
      eyebrow: 'Azure CLI', lines: ['Die Anmeldung übernimmt', 'die bestehende Sitzung.'],
      at: 0.24, hold: 3.8, place: 'bottomLeft', scale: 'heroSmall',
    },
  },
  {
    kind: 'shot', id: 'connection', chapter: '02', from: 6.2, seconds: 7.0, rate: 2.4,
    shots: [
      { at: 0, zoom: 1.3, x: 0.74, y: 0.39 },
      { at: 0.16, zoom: 1.14, x: 0.5, y: 0.5, dur: 66 },
      { at: 0.62, zoom: 1.26, x: 0.5, y: 0.62, dur: 66 },
    ],
    hero: {
      eyebrow: 'Verbindungen', lines: ['Abonnement, Konto', 'und Container festlegen.'],
      at: 0.24, hold: 4.6, place: 'bottomLeft', scale: 'heroSmall',
    },
  },

  { kind: 'act', index: '02 — Dateien', title: 'Logdateien finden' },
  {
    kind: 'shot', id: 'filter', chapter: '03', from: 8.6, seconds: 6.6, rate: 1.7,
    shots: [
      { at: 0, zoom: 1.06, x: 0.5, y: 0.5 },
      { at: 0.18, zoom: 1.36, x: 0.12, y: 0.14, dur: 66 },
    ],
    hero: {
      eyebrow: 'Filter', lines: ['Nach Name, Datum', 'und Zeitraum eingrenzen.'],
      at: 0.3, hold: 4.2, place: 'bottomLeft', scale: 'heroSmall',
    },
  },
  {
    kind: 'shot', id: 'levels', chapter: '04', from: 9.4, seconds: 4.6, rate: 1.0,
    shots: [
      { at: 0, zoom: 1.04, x: 0.5, y: 0.5 },
      { at: 0.18, zoom: 1.42, x: 0.44, y: 0.28, dur: 66 },
    ],
    hero: {
      eyebrow: 'Log-Level', lines: ['Info, Warn und Error', 'farbig hervorgehoben.'],
      at: 0.3, hold: 3.0, place: 'bottomLeft', scale: 'heroSmall',
    },
  },
  {
    kind: 'shot', id: 'search', chapter: '04', from: 14.0, seconds: 10.0, rate: 1.0,
    shots: [
      { at: 0, zoom: 1.12, x: 0.5, y: 0.4 },
      { at: 0.14, zoom: 1.42, x: 0.82, y: 0.09, dur: 72 },
      { at: 0.62, zoom: 1.16, x: 0.62, y: 0.36, dur: 72 },
    ],
    hero: {
      eyebrow: 'Volltextsuche', lines: ['Den Inhalt durchsuchen,', 'Treffer durchblättern.'],
      at: 0.42, hold: 5.4, place: 'bottomLeft', scale: 'heroSmall',
    },
  },

  { kind: 'act', index: '03 — Inhalt', title: 'Inhalte lesen' },
  {
    kind: 'shot', id: 'stream', chapter: '05', from: 3.9, seconds: 8.2, rate: 1.25,
    shots: [
      { at: 0, zoom: 1.34, x: 0.14, y: 0.31 },
      { at: 0.2, zoom: 1.06, x: 0.5, y: 0.45, dur: 72 },
    ],
    hero: {
      eyebrow: 'Große Dateien', lines: ['Ab 20 MB lädt', 'der Viewer im Hintergrund.'],
      at: 0.36, hold: 4.9, place: 'bottomLeft', scale: 'heroSmall',
    },
  },
  {
    kind: 'shot', id: 'live', chapter: '06', from: 7.8, seconds: 11.5, rate: 1.0,
    shots: [
      { at: 0, zoom: 1.14, x: 0.5, y: 0.4 },
      { at: 0.1, zoom: 1.46, x: 0.73, y: 0.08, dur: 76 },
      { at: 0.5, zoom: 1.08, x: 0.56, y: 0.66, dur: 84 },
    ],
    hero: {
      eyebrow: 'Live-Modus', lines: ['Neue Zeilen erscheinen,', 'sobald sie entstehen.'],
      at: 0.58, hold: 4.6, place: 'left', scale: 'heroSmall',
    },
  },

  { kind: 'act', index: '04 — Export', title: 'Ergebnisse sichern' },
  {
    kind: 'shot', id: 'merge', chapter: '07', from: 5.0, seconds: 6.6, rate: 1.9,
    shots: [
      { at: 0, zoom: 1.26, x: 0.13, y: 0.36 },
      { at: 0.5, zoom: 1.14, x: 0.3, y: 0.13, dur: 66 },
    ],
    hero: {
      eyebrow: 'Zusammenführen', lines: ['Bis zu fünf Dateien', 'in einer Ansicht.'],
      at: 0.4, hold: 3.7, place: 'bottomLeft', scale: 'heroSmall',
    },
  },
  {
    kind: 'shot', id: 'restore', chapter: '08', from: 5.2, seconds: 8.2, rate: 1.5,
    shots: [
      { at: 0, zoom: 1.38, x: 0.16, y: 0.24 },
      { at: 0.44, zoom: 1.08, x: 0.5, y: 0.48, dur: 76 },
    ],
    hero: {
      eyebrow: 'Wiederherstellen', lines: ['Gelöschte Dateien', 'wiederherstellen.'],
      at: 0.5, hold: 3.9, place: 'bottomLeft', scale: 'heroSmall',
    },
  },

  { kind: 'outro', chapter: '06', seconds: 9.0 },
];
