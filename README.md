# ☁️ Wolke der Zeugen

**Das ortsbasierte Begegnungsspiel der Ev. Kirchengemeinde Staaken** — im Geist von Pokémon Go, aber mit biblischen Zeug:innen: Konfis besuchen die sechs realen Orte der Gemeinde, begegnen dort Figuren wie Maria Magdalena, Zachäus oder Hagar, führen einen Dialog, denken über einen Impuls nach, beantworten eine Frage — und nehmen die Figur als illuminierte Sammelkarte in ihre persönliche „Wolke der Zeugen" auf (Hebräer 12,1).

## Religionspädagogisches Konzept

- **Begegnen statt fangen.** Niemand wird „gefangen" oder besessen — die Zeug:innen sind Vorbilder, die *dich* anfeuern (Hebr 12,1). Beziehung statt Besitz.
- **Jesus ist keine Sammelkarte.** Er ist der Rahmen: Er sendet beim Onboarding los, meldet sich an Meilensteinen und steht am Ziel als „Anfänger und Vollender des Glaubens" (Hebr 12,2).
- **Keine Beschämung.** Die Frage nach jeder Begegnung ist keine Prüfung: Bei falscher Antwort gibt es einen zweiten Versuch, die Figur kommt *immer* in die Wolke. Die erste richtige Antwort verleiht der Karte nur einen Goldglanz.
- **Orte tragen Bedeutung.** Jede Figur passt zu ihrem Ort: Maria Magdalena (Gärtnerszene!) an der Kirche Gartenstadt, Jeremia (Ackerkauf im Untergang) am Erinnerungsort Zuversichtskirche, Elia (Erschöpfung & leise Stimme) am Waldhaus …
- **Moderne evangelische Frömmigkeit:** Zweifel (Thomas), Klage (Hiob), Gerechtigkeit (Amos), Mut (Esther), Gesehen-werden (Hagar, Bartimäus) — Themen, die Konfis heute betreffen, mit BasisBibel-Links zu jeder Geschichte.

## Die 26 Zeug:innen an 13 Orten (wöchentliche Rotation)

| Ort | Zeug:innen |
|---|---|
| ⛪ Dorfkirche Alt-Staaken | Abraham, Sara, Jakob ★ |
| 🌿 Kirche Gartenstadt | Maria Magdalena ★, Thomas, Ruth |
| ✊ Kirche Heerstraße Nord | Amos, Zachäus, Bartimäus |
| 🎵 Ernst-Lange-Haus | Mirjam, David ★, Esther |
| 🌲 Waldhaus am Sonnenhügel | Johannes der Täufer, Elia, Hagar ★ |
| 🕊️ Zuversichtskirche (Erinnerungsort) | Hiob, Jeremia ★, Noomi |
| 🤝 Staakentreff (Gemeinwesenverein Heerstraße Nord) | Tabita — Füreinander da sein |
| 🫖 Seniorenzentrum Hohenlohe | Hanna (Seniorenseelsorge), Mose ★ (Ex 17/18: nicht alles allein tragen — große Gemeinde, weniger Kräfte) |
| 🧸 Kita Arche Noah (neben der Zuversichtskirche) | Noah ★ |
| 🛖 Waldarche (Waldgruppe, Bauwagen am Waldhaus) | Frau Weisheit (Spr 8: »ich spielte vor ihm«) |
| 🌈 Kita Regenbogen (neben Heerstraße Nord) | Schifra (Ex 1: die Hebammen schützen die Kinder) |
| 🌻 Kita Staaken-Gartenstadt | Samuel (1 Sam 3: »Rede, ich höre«) |
| 🎒 Hort Staaken-Gartenstadt | Der Junge mit den Broten (Joh 6) |

Kitas, Hort und Waldarche liegen direkt neben einer Kirche (`nebenAn` in `orte.json`): Auf der Karte hängen sie als kleine Medaillons an ihrer Kirche, in der Ortsansicht sind sie gegenseitig verlinkt. An Kitas, Hort und Seniorenzentrum bleibt die Kamera aus (`kameraAus`) und ein Hinweis bittet um Rücksicht (`hinweis`). Neue Figuren immer **hinten** in `figuren.json` anhängen (Spielstand-Code, siehe unten).

★ = „Legende des Glaubens" (prächtigere Illumination — genauso erreichbar wie alle anderen)

## So funktioniert das Spiel

1. **Karte:** Eine Pilgerkarte im Pergament-Stil zeigt die 13 Orte mit echten Straßen, Bahn und Grünflächen (aus OpenStreetMap, fest eingebacken — keine externen Kartendienste zur Laufzeit). Ein **Kompass-Hinweis** oben nennt die nächste offene Begegnung mit Entfernung und meldet „Du bist da!".
2. **Hingehen:** Wie bei Pokémon Go schaltet allein der echte Standort einen Ort frei (Umkreis `radiusMeter`, plus GPS-Ungenauigkeit bis 30 m). Es gibt keine QR- oder Ortscodes mehr — also auch nichts zu drucken oder aufzuhängen. Ohne Standort kann man im Demo-Modus reinschnuppern. Bei blockiertem oder nur ungefährem Standort erklärt die App, wo man ihn freischaltet (iPhone: „Genauer Standort“).
3. **AR-Begegnung (fester Teil jeder Begegnung):** „✨ Begegnung beginnen" öffnet die Kamera. Die Figur steht als **Lichtgestalt** fest an einer Stelle im Raum (Lagesensor) — seitlich, **hinter dir** (Maria Magdalena), **oben im Baum** (Zachäus) oder **unten am Straßenrand** (Bartimäus). Man sucht sie, tippt sie an, sie grüßt mit Namen und lädt zu einer **Glaubensgeste** ein (siehe unten). Danach steht ihr Bibelwort da, dann beginnt das Gespräch.
4. **Begegnung:** Dialog mit Wahlmomenten → Impuls mit privater Notiz → Frage (mit zweiter Chance) → Aufnahme in die Wolke mit Funkenregen.

**Glaubensgesten** (`js/gesten.js`, Inhalte in `figuren.json` → `ar`): Frömmigkeit als leibliche Praxis — nicht nur über etwas reden, sondern etwas tun und spüren.

| Geste | Figuren | Was man tut |
|---|---|---|
| Sammeln | Abraham (Sterne am Himmel), Ruth (Ähren am Boden), Amos (Wassertropfen rundum), Noah (Tiere in die Arche), Tabita (Kleider), Frau Weisheit (Waldschätze am Boden), der Junge (5 Brote, 2 Fische) | sich umschauen und Dinge im Raum antippen |
| Stille | Elia (nach Sturm, Beben, Feuer), Hiob (7 Lichter), Samuel (nach dreimaligem Ruf in der Nacht) | das Handy ganz ruhig halten |
| Festhalten | Jakob (bis zum Morgenrot), Thomas (Licht berühren), Esther (zitternd durchhalten), Jeremia (Siegel drücken), Schifra (Hand schützend aufs Kind), Mose (Arme stützen bis zum Sonnenuntergang) | Finger auflegen und halten |
| Wischen | Johannes (Staub), Hagar (Tränen → Brunnen), Noomi („Mara“ → „Noomi“), Hanna (Nebel → das Kind) | Schleier wegwischen |
| Schütteln | Mirjam (Tamburin), Sara (Lachen), Bartimäus (laut rufen) | Handy schütteln |
| Saitenspiel | David | Leier-Saiten zupfen |
| nur Suchen | Maria Magdalena (umdrehen), Zachäus (hochschauen) | — |

Jede Geste hat einen Rückfall ohne Sensor (Dinge auf dem Bildschirm, Finger auflegen statt still halten, Tippen statt Schütteln). Nach 20 s gibt es „Überspringen", nach 25 s Suche „Ich finde niemanden — hilf mir". Ohne Kamera (abgelehnt oder unter *Mehr* ausgeschaltet) erscheinen die Figuren vor einem Sternenhimmel. Wer die Geste gemacht hat, bekommt das Merkmal `erlebt` an der Karte.

**Als App auf den Home-Bildschirm** (`js/installieren.js`): Auf iPhones erklärt eine Anleitung „Teilen → Zum Home-Bildschirm“; auf Android gibt es einen echten „Installieren“-Knopf (`beforeinstallprompt`). Achtung iPhone: Die Home-Bildschirm-App hat einen eigenen Speicher — dafür gibt es unter *Mehr → Spielstand mitnehmen* einen kurzen Code (ohne Name und Notizen; ältere Codes mit 18 Figuren bleiben gültig).
5. **Rotation:** Pro Woche (Wechsel sonntags) ist an jedem Ort eine andere Figur „unterwegs" — Grund, immer wieder zu kommen. Bekannten Figuren kann man „Nochmal zuhören".
6. **Sammeln:** Karten als Buntglas-Heiligenbildchen (Rahmen je nach Bedeutsamkeit), Orts-Siegel, ein **Kirchenfenster**, das sich Scheibe für Scheibe füllt, Finale bei 18/18.
7. **Aktionstage:** An den Tagen in `data/config.json` → `aktionstage` (z. B. `{ "datum": "2026-11-14", "name": "Konfi-Tag Rallye" }`) sind alle Figuren gleichzeitig aktiv — der Ortsbesuch bleibt Pflicht. Kein Code nötig.

**Lichtgestalten** (`js/gestalt.js`): Jede Figur wird als Kirchenfenster-Gestalt in ihrer Farbe gezeichnet und hält ihr Symbol wie ein Attribut vor der Brust — bewusst ohne Gesichtszüge. Reines SVG, keine Bilddateien; die Glasfacetten sind pro Figur zufällig, aber reproduzierbar.

## Datenschutz (wichtig: Minderjährige!)

- **Kein Backend, kein Konto, keine Cloud.** Alles liegt im localStorage des Geräts.
- **GPS nur auf dem Gerät:** Die Position wird nie gespeichert, nie übertragen — die App rechnet lokal die Distanz aus. Ohne Standortfreigabe geht nur der Demo-Modus.
- **Keine Fremd-Requests zur Laufzeit** (deshalb eigene SVG-Karte statt Google/OSM-Tiles; die OSM-Daten liegen fest in `data/karte-hintergrund.json`). Links (die-bibel.de, staaken-evangelisch.de) öffnen nur auf aktiven Tipp.
- **Kamera, Lage- und Bewegungssensor (AR)** laufen nur in der AR-Ansicht, bleiben auf dem Gerät und werden beim Verlassen sofort gestoppt. Die Kamera lässt sich unter *Mehr* ganz abschalten.
- **Offline:** Ein Service Worker hält die App-Dateien vor (Strategie „Netz zuerst", Cache nach 4 s ohne Netz). Er speichert keine Nutzerdaten.
- Nur der Vorname wird erfragt; „Alles löschen" in den Einstellungen entfernt sämtliche Daten.
- Der Leitungscode im JSON ist eine Hürde, keine Security.
- **Kitas, Hort, Seniorenzentrum:** keine Kamera, Begegnung vom Gehweg aus, Hinweis auf Rücksicht.

## Entwicklung & Betrieb

**Lokal starten** (im Ordner `wolke-der-zeugen/`):

```bash
npx serve -l 3457 .
# → http://localhost:3457
```

**Test-Parameter** (nur für Entwicklung/Probelauf):

| URL-Parameter | Wirkung |
|---|---|
| `?demo=1` | Demo-Modus: „Beam mich hierhin"-Buttons, Begegnungen zählen als Probelauf |
| `?heute=2026-09-13` | Simuliert ein Datum (testet die Wochenrotation) |
| `?iphone` / `?android` | Zeigt den Home-Bildschirm-Hinweis wie auf dem jeweiligen Handy |

AR-Tests im Browser: `werkstatt/arsim.js` (nur lokal, nicht im Repo) simuliert Lage- und Bewegungssensor.

**Deployment:** Das Spiel läuft auf dem eigenen Server unter **https://www.viktor-weber.com/wolke-der-zeugen/** (Hostinger-VPS, nginx, eigenes Verzeichnis wie Zwölf Steine). Einrichten und Hochladen: siehe [`deploy/LIESMICH.md`](deploy/LIESMICH.md). **HTTPS ist Pflicht**, sonst gibt der Browser kein GPS frei. Die `basisUrl` in `data/config.json` steht auf der neuen Adresse.

Die frühere Adresse `webervik.github.io/wolke-der-zeugen/` (GitHub Pages aus `main`) leitet per `js/umzug.js` weiter und nimmt den Spielstand im `#`-Teil der Adresse mit. Der `#`-Teil wird nie an einen Server geschickt.

**Leitungsbereich** (`leiter.html`, Zugangscode in `data/config.json` → `leiterCode`):
- **Position messen & Koordinaten-Check:** Zeigt vor Ort die eigene Position (zum Kopieren) und live die Distanz zu allen Orten — damit neue Stationen einmessen (z. B. den Bauwagen der Waldarche) und Radien (`radiusMeter` in `data/orte.json`) justieren.
- **Aktionstage** und **alle Orte** mit Koordinaten-Status im Überblick.

## Inhalte pflegen

- **Figuren:** `data/figuren.json` — Dialog (`sprecher: "figur"` / Wahlmomente mit `optionen`), `impuls`, `frage` (Format wie konfi-check), `kartenspruch`. Die Reihenfolge im Array bestimmt die Rotationswoche je Ort.
- **Orte:** `data/orte.json` — Koordinaten (Quelle: OSM/Nominatim, vor Ort validieren!), Radius, Beschreibungen, `kurzname` (Karte), `nebenAn`, `kameraAus`, `hinweis`.
- **Kartenhintergrund:** `werkstatt/karte-backen.py` (Anleitung im Kopf der Datei) — neu backen, wenn ein Ort außerhalb des Ausschnitts dazukommt.
- **Rahmentexte & Codes:** `data/config.json` — Jesus-Sendung, Meilensteine, `jahresStart` (erster Sonntag des Konfi-Jahres), Event-/Leiter-Codes, Datenschutztexte.

## Ideen für später („größer bauen")

Karten untereinander zeigen/tauschen („Zeugnis teilen") · weitere Figuren (Tabita, Lydia, Magnificat-Maria als Adventsspezial) · Audio-Stimmen · Kompass-Richtungspfeil zur nächsten Begegnung · Erweiterung auf die Pilgerweg-Zonen aus konfi-check (St. Nikolai, Gedächtniskirche, Wittenberg …) · perspektivisch: begehbare 3D-/Voxel-Welt

---

*Technik: Pures HTML/CSS/JavaScript ohne Build-Step (wie konfi-check und mitunteruns). Keine Fremdbibliotheken. Kartendaten © OpenStreetMap-Mitwirkende, Lizenz ODbL (Hinweis steht auf der Karte). Design „Illuminierte Sammelkarten": Nachthimmel, Pergament, Gold.*
