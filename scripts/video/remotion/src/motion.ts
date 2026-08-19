import { Easing, interpolate } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';

/**
 * Motion- und Design-Tokens für das ganze Video.
 *
 * Alles, was mehr als einmal vorkommt, steht hier: Farben, Kurven, Dauern,
 * Schriftgrößen, Radien, Schatten. Komponenten greifen nur auf diese Werte zu,
 * damit das Video als ein System wirkt und nicht als Sammlung von Einzelszenen.
 */

export const { fontFamily } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

export const palette = {
  // Helle Produktbühne
  stage: '#F7F9FC',
  stageWarm: '#F8FAFF',
  // Dunkle Editorial-Flächen
  night: '#0B1020',
  nightSoft: '#111827',
  // Azure
  azure: '#0078D4',
  azureLight: '#00A4EF',
  indigo: '#6366F1',
  // Typografie
  ink: '#0B1020',
  inkSoft: '#33415C',
  inkFaint: '#7C8AA0',
  onNight: '#FFFFFF',
  onNightSoft: 'rgba(255,255,255,0.62)',
  line: 'rgba(11,16,32,0.10)',
  lineNight: 'rgba(255,255,255,0.14)',
};

export const radii = { window: 18, card: 20, pill: 999 };

export const shadows = {
  /** Großer, weicher Schatten unter dem Produktfenster. Kein Glassmorphism. */
  window: '0 60px 140px rgba(11,16,32,0.20), 0 18px 44px rgba(11,16,32,0.10)',
  windowTight: '0 30px 70px rgba(11,16,32,0.16), 0 8px 20px rgba(11,16,32,0.08)',
};

/**
 * Kurven eines kontrollierten Kamera-Rigs — kein Feder-Bounce.
 * LEAD beschleunigt (Abfahrt), SETTLE bremst aus (Ankunft),
 * CINE ist die symmetrische Standardfahrt.
 */
export const ease = {
  /** Standardfahrt: sanft an, sanft aus — die ruhigste Kurve für ein Kamera-Rig. */
  glide: Easing.bezier(0.45, 0, 0.55, 1),
  cine: Easing.bezier(0.62, 0, 0.34, 1),
  settle: Easing.bezier(0.16, 0.9, 0.24, 1),
  lead: Easing.bezier(0.55, 0, 0.9, 0.35),
  soft: Easing.bezier(0.4, 0, 0.2, 1),
  linear: (t: number) => t,
};

export type EaseName = keyof typeof ease;

/** Kameramaßstab der Produktbühne: das UI füllt rund 86 % des Bildes. */
export const STAGE_SCALE = 0.86;

/** Obergrenze für Zooms — darüber wird das aufgezeichnete UI sichtbar weich. */
export const MAX_STAGE_SCALE = 1.5;

export const timing = {
  camera: 46,        // Standardfahrt zwischen zwei Blickpunkten
  cameraSlow: 66,    // langsame Annäherung für Hero-Momente
  cameraFast: 30,    // schnelles Nachführen bei kleinen Korrekturen
  typeIn: 16,        // Zeileneinblendung
  typeStagger: 5,    // Versatz zwischen Zeilen
  typeOut: 18,
  actCard: 40,       // dunkle Kapiteltafel: 1,6 s
  crossfade: 14,
};

export const type = {
  eyebrow: { fontSize: 24, fontWeight: 700, letterSpacing: '0.26em', textTransform: 'uppercase' as const },
  heroLarge: { fontSize: 104, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.04 },
  hero: { fontSize: 82, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08 },
  heroSmall: { fontSize: 62, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.12 },
  lead: { fontSize: 34, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.4 },
  meta: { fontSize: 22, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' as const },
};

/**
 * Ein Kanal einer Kamerafahrt. `at` ist der Beginn der Bewegung, `dur` ihre
 * Länge — danach steht die Kamera still, bis die nächste Fahrt beginnt.
 */
export type Key = { at: number; value: number; dur?: number; ease?: EaseName };

/**
 * Fahrt, Ruhe, Fahrt.
 *
 * Entscheidend ist die Ruhe: würde zwischen zwei Blickpunkten durchgehend
 * interpoliert, schöbe sich das Bild die ganze Zeit — genau das wirkt unruhig.
 * Jede Bewegung dauert deshalb ihre `dur` und hält den Wert danach.
 */
export const track = (frame: number, keys: Key[]): number => {
  if (keys.length === 0) return 0;
  let value = keys[0].value;
  for (let i = 1; i < keys.length; i += 1) {
    const b = keys[i];
    if (frame < b.at) break;
    const len = Math.max(1, b.dur ?? timing.camera);
    // Setzt die nächste Fahrt ein, bevor diese ausgelaufen ist, wird hier
    // eingefroren — die nächste beginnt dann an der tatsächlich erreichten
    // Stelle statt am Ziel. Ohne das entstünde genau dort ein Sprung.
    const until = keys[i + 1] ? Math.min(frame, keys[i + 1].at) : frame;
    value = interpolate(until, [b.at, b.at + len], [value, b.value], {
      easing: ease[b.ease ?? 'glide'],
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  }
  return value;
};

/** 0 → 1 über `len` Frames ab `from`, mit Kurve. Für Ein- und Ausblendungen. */
export const ramp = (
  frame: number, from: number, len: number, easing: EaseName = 'soft',
): number => interpolate(frame, [from, from + len], [0, 1], {
  easing: ease[easing], extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});
