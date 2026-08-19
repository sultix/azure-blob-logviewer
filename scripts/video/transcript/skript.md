# Sprecherskript — Anleitung „Azure Blob Logviewer"

Video 5:22.44 · 12 Blöcke · 620 Wörter · geschätzte Sprechzeit 4:23.70

## Ablauf

1. Je Block den Text unten (oder die Datei `transcript/elevenlabs/<ID>.txt`) bei ElevenLabs vertonen.
2. Ergebnis als `audio/<ID>.mp3` speichern — Dateiname exakt wie die Block-ID, z. B. `audio/03.mp3`.
3. `node mix-audio.mjs` — legt jeden Block auf seine Startzeit, normalisiert auf -16 LUFS
   und schreibt `out/anleitung-azure-blob-logviewer-vertont.mp4`.

Empfohlene ElevenLabs-Einstellungen: Modell **Eleven Multilingual v2** (deutsche Stimme),
Stability ~50 %, Similarity ~75 %, Speed 1.0, Ausgabe MP3 44,1 kHz. Blöcke einzeln rendern,
nicht am Stück — nur so passen die Startzeiten. Bleibt ein Block länger als sein Fenster,
meldet das Mix-Skript es und die Stimme läuft ins nächste Kapitel hinein.

Die Texte sind sprechfertig: Zahlen und Einheiten sind ausgeschrieben (»zwanzig Megabyte«),
damit die Stimme sie nicht buchstabiert.

| Block | Start | Fenster | Wörter | geschätzt | Reserve |
|---|---|---|---|---|---|
| `00-intro` | 0:00.00 | 5.0s | 11 | 4.7s | +0.3s |
| `01` | 0:05.00 | 22.4s | 45 | 19.1s | +3.3s |
| `02` | 0:27.40 | 44.5s | 87 | 37.0s | +7.5s |
| `03` | 1:11.92 | 41.6s | 83 | 35.3s | +6.3s |
| `04` | 1:53.48 | 31.7s | 63 | 26.8s | +4.9s |
| `05` | 2:25.20 | 25.1s | 47 | 20.0s | +5.1s |
| `06` | 2:50.28 | 30.3s | 54 | 23.0s | +7.3s |
| `07` | 3:20.56 | 24.7s | 48 | 20.4s | +4.3s |
| `08` | 3:45.24 | 21.2s | 43 | 18.3s | +2.9s |
| `09` | 4:06.44 | 23.9s | 44 | 18.7s | +5.2s |
| `10` | 4:30.32 | 44.1s | 83 | 35.3s | +8.8s |
| `11-outro` | 5:14.44 | 8.0s | 12 | 5.1s | +2.9s |

---

## 00-intro — Titel
*Start 0:00.00 · Fenster 5.0s · Ziel ≈ 4.7s*

Azure Blob Logviewer. Logdateien direkt aus dem Azure Blob Storage lesen.

## 01 — Kapitel 1 — Anmeldung an Azure
*Start 0:05.00 · Fenster 22.4s · Ziel ≈ 19.1s*

Los geht es in den Einstellungen. Oben rechts sehen Sie den Verbindungsstatus. Ohne Anmeldung
passiert hier nichts: Die App nutzt Ihre Azure-Kommandozeile, Sie müssen sich also vorher im
Terminal angemeldet haben. Ein Klick auf Mit Azure verbinden übernimmt diese Sitzung. Zugangsdaten
speichert die App nicht.

## 02 — Kapitel 2 — Verbindungen verwalten
*Start 0:27.40 · Fenster 44.5s · Ziel ≈ 37.0s*

Das Dashboard verwaltet Ihre Storage-Verbindungen. Die Kachel oben zählt alle eingebundenen
Container. Für eine neue Verbindung vergeben Sie zuerst einen Namen und optional eine Kategorie.
Nach dieser Kategorie gruppiert das Dashboard später. Danach wählen Sie nacheinander Abonnement,
Storage-Konto und Blob-Container. Alle drei Listen sind durchsuchbar. Gespeichert wird die
Verbindung nur lokal auf Ihrem Rechner. Die fertige Karte zeigt Status, Konto, Container und den
Zugriffs-Tier. Das Suchfeld filtert nach Namen, Umgebungen und Kategorien. Über das Drei-Punkte-Menü
lässt sich jede Verbindung nachträglich bearbeiten oder wieder entfernen, letzteres mit
Sicherheitsabfrage.

## 03 — Kapitel 3 — Logdateien finden
*Start 1:11.92 · Fenster 41.6s · Ziel ≈ 35.3s*

Logs öffnen führt vom Dashboard in den Container. Links liegen alle Dateien mit Erstell- und
Änderungsdatum sowie Größe. Das Suchfeld filtert die Dateinamen. Darunter grenzen zwei Datumsfelder
die Liste ein: einmal auf einen einzelnen Tag, einmal auf einen Zeitraum. Filter löschen setzt alles
zurück. Rechts daneben steht die Sortierung. Ein Klick dreht die Reihenfolge um, das Menü daneben
schaltet zwischen Erstellungs- und Änderungsdatum um. Der Aktualisieren-Knopf lädt die Liste neu.
Ganz unten sehen Sie die aktive Verbindung und den Zeitpunkt der letzten Aktualisierung.

## 04 — Kapitel 4 — Logs lesen und durchsuchen
*Start 1:53.48 · Fenster 31.7s · Ziel ≈ 26.8s*

Ein Klick auf eine Datei öffnet den Inhalt rechts im Viewer. Die Kopfzeile nennt Pfad, Größe sowie
Erstell- und Änderungsdatum. Log-Level in eckigen Klammern werden farbig hervorgehoben: Info, Warn
und Error. Die Inhaltssuche greift ab drei Zeichen, zählt die Treffer und springt mit den Pfeilen
von Fundstelle zu Fundstelle. Das Kreuz leert die Suche. Die Fußzeile zeigt Zeilenzahl, Inhaltstyp
und die erkannten Zeilenenden.

## 05 — Kapitel 5 — Sehr große Dateien
*Start 2:25.20 · Fenster 25.1s · Ziel ≈ 20.0s*

Große Dateien behandelt die App besonders. Ab zwanzig Megabyte übernimmt ein Streaming-Viewer: Das
Dateiende ist sofort sichtbar, der Rest wird im Hintergrund nachgeladen. Der Fortschritt steht über
dem Inhalt. Gescrollt wird trotzdem flüssig, denn angezeigt wird immer nur der sichtbare Ausschnitt.
Hier sind es über zweihundertdreißigtausend Zeilen.

## 06 — Kapitel 6 — Live-Modus
*Start 2:50.28 · Fenster 30.3s · Ziel ≈ 23.0s*

In eine Datei, die gerade beschrieben wird, können Sie live hineinsehen. Der Schalter Live oben
rechts schaltet den Tail-Modus ein. Neue Zeilen laufen automatisch unten ein, die Ansicht folgt mit.
Wie oft nachgeladen wird, legen Sie in den Einstellungen fest, zwischen einer und sechzig Sekunden.
Ein erneuter Klick schaltet zurück auf die feste Momentaufnahme.

## 07 — Kapitel 7 — Dateien zusammenführen
*Start 3:20.56 · Fenster 24.7s · Ziel ≈ 20.4s*

Mehrere Logdateien lassen sich zu einer Ansicht zusammenführen. Dazu klicken Sie die weiteren
Dateien mit gedrückter Command- beziehungsweise Steuerungstaste an. Zusammengefügt wird in
Klickreihenfolge, bis zu fünf Dateien mit je maximal zwanzig Megabyte. Der Download-Knopf speichert
das Ergebnis als eine einzige Textdatei. Eine Meldung bestätigt den fertigen Download.

## 08 — Kapitel 8 — Gelöschte Dateien
*Start 3:45.24 · Fenster 21.2s · Ziel ≈ 18.3s*

Auch gelöschte Dateien bleiben erreichbar, solange die Soft-Delete-Frist von Azure läuft. Der
Schalter Gelöschte nimmt sie mit in die Liste auf. Ein rotes Kennzeichen zeigt, wie viele Tage noch
bleiben. Beim Anklicken bietet die App an, die Datei wiederherzustellen und direkt zu öffnen.

## 09 — Kapitel 9 — Kompaktes Fenster
*Start 4:06.44 · Fenster 23.9s · Ziel ≈ 18.7s*

Wird das Fenster schmaler, rücken Aktualisieren, Download und der Live-Schalter in ein Menü hinter
den drei Punkten. Dort steht auch, ob der Live-Modus gerade an oder aus ist. Oben links führt Zurück
wieder ins Dashboard. Die Titelleiste gehört zur App: verschieben, minimieren, maximieren,
schließen.

## 10 — Kapitel 10 — Einstellungen
*Start 4:30.32 · Fenster 44.1s · Ziel ≈ 35.3s*

Bleiben die Einstellungen. Die Darstellung folgt dem System oder erzwingt das helle beziehungsweise
dunkle Design. Die Sprache schaltet die gesamte Oberfläche samt Datumsformaten um, zwischen Deutsch
und Englisch. Das Live-Intervall bestimmt, wie oft der Tail-Modus nachlädt. Die Log-Level-Einfärbung
lässt sich abschalten, wenn sie stört, und Zurücksetzen stellt alle Standardwerte wieder her.
Gespeicherte Verbindungen können Sie als J-SON exportieren und wieder importieren. Beides öffnet den
Datei-Dialog des Betriebssystems. Unter Diagnose öffnet ein Klick das lokale Logverzeichnis der App.
Ganz unten stehen Kurzbeschreibung und Version.

## 11-outro — Abspann
*Start 5:14.44 · Fenster 8.0s · Ziel ≈ 5.1s*

Anmeldung, Filter, Volltextsuche, Live-Modus und Wiederherstellung. Das war der Azure Blob
Logviewer.

