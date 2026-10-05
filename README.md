# ☁️ Wolke der Zeugen

**Das ortsbasierte Begegnungsspiel der Ev. Kirchengemeinde Staaken** — im Geist von Pokémon Go, aber mit biblischen Zeug:innen: Konfis besuchen die sechs realen Orte der Gemeinde, begegnen dort Figuren wie Maria Magdalena, Zachäus oder Hagar, führen einen Dialog, denken über einen Impuls nach, beantworten eine Frage — und nehmen die Figur als illuminierte Sammelkarte in ihre persönliche „Wolke der Zeugen" auf (Hebräer 12,1).

## Religionspädagogisches Konzept

- **Begegnen statt fangen.** Niemand wird „gefangen" oder besessen — die Zeug:innen sind Vorbilder, die *dich* anfeuern (Hebr 12,1). Beziehung statt Besitz.
- **Jesus ist keine Sammelkarte.** Er ist der Rahmen: Er sendet beim Onboarding los, meldet sich an Meilensteinen und steht am Ziel als „Anfänger und Vollender des Glaubens" (Hebr 12,2).
- **Keine Beschämung.** Die Frage nach jeder Begegnung ist keine Prüfung: Bei falscher Antwort gibt es einen zweiten Versuch, die Figur kommt *immer* in die Wolke. Die erste richtige Antwort verleiht der Karte nur einen Goldglanz.
- **Orte tragen Bedeutung.** Jede Figur passt zu ihrem Ort: Maria Magdalena (Gärtnerszene!) an der Kirche Gartenstadt, Jeremia (Ackerkauf im Untergang) am Erinnerungsort Zuversichtskirche, Elia (Erschöpfung & leise Stimme) am Waldhaus …
- **Moderne evangelische Frömmigkeit:** Zweifel (Thomas), Klage (Hiob), Gerechtigkeit (Amos), Mut (Esther), Gesehen-werden (Hagar, Bartimäus) — Themen, die Konfis heute betreffen, mit BasisBibel-Links zu jeder Geschichte.

## Die 18 Zeug:innen (3 je Ort, wöchentliche Rotation)

| Ort | Zeug:innen |
|---|---|
| ⛪ Dorfkirche Alt-Staaken | Abraham, Sara, Jakob ★ |
| 🌿 Kirche Gartenstadt | Maria Magdalena ★, Thomas, Ruth |
| ✊ Kirche Heerstraße Nord | Amos, Zachäus, Bartimäus |
| 🎵 Ernst-Lange-Haus | Mirjam, David ★, Esther |
| 🌲 Waldhaus am Sonnenhügel | Johannes der Täufer, Elia, Hagar ★ |
| 🕊️ Zuversichtskirche (Erinnerungsort) | Hiob, Jeremia ★, Noomi |

★ = „Legende des Glaubens" (prächtigere Illumination — genauso erreichbar wie alle anderen)

## So funktioniert das Spiel

1. **Karte:** Eine Pilgerkarte im Pergament-Stil zeigt die 6 Orte mit echten Straßen, Bahn und Grünflächen (aus OpenStreetMap, fest eingebacken — keine externen Kartendienste zur Laufzeit). Ein **Kompass-Hinweis** oben nennt die nächste offene Begegnung mit Entfernung und meldet „Du bist da!".
2. **Hingehen:** Per GPS schaltet sich ein Ort im Umkreis von ~75 m frei — oder per **QR-Code am Ort** (mit der normalen Kamera-App scannen) bzw. Code-Eingabe (tolerant: Bindestriche/Leerzeichen egal, kyrillische Doppelgänger-Buchstaben werden erkannt).
3. **AR-Begegnung (fester Teil jeder Begegnung):** „✨ Begegnung beginnen" öffnet die Kamera. Die Figur steht als **Lichtgestalt** fest an einer Stelle im Raum (Lagesensor) — seitlich, **hinter dir** (Maria Magdalena), **oben im Baum** (Zachäus) oder **unten am Straßenrand** (Bartimäus). Man sucht sie, tippt sie an, sie grüßt mit Namen und lädt zu einer **Glaubensgeste** ein (siehe unten). Danach steht ihr Bibelwort da, dann beginnt das Gespräch.
4. **Begegnung:** Dialog mit Wahlmomenten → Impuls mit privater Notiz → Frage (mit zweiter Chance) → Aufnahme in die Wolke mit Funkenregen.

**Glaubensgesten** (`js/gesten.js`, Inhalte in `figuren.json` → `ar`): Frömmigkeit als leibliche Praxis — nicht nur über etwas reden, sondern etwas tun und spüren.

| Geste | Figuren | Was man tut |
|---|---|---|
| Sammeln | Abraham (Sterne am Himmel), Ruth (Ähren am Boden), Amos (Wassertropfen rundum) | sich umschauen und Dinge im Raum antippen |
| Stille | Elia (nach Sturm, Beben, Feuer), Hiob (7 Lichter) | das Handy ganz ruhig halten |
| Festhalten | Jakob (bis zum Morgenrot), Thomas (Licht berühren), Esther (zitternd durchhalten), Jeremia (Siegel drücken) | Finger auflegen und halten |
| Wischen | Johannes (Staub), Hagar (Tränen → Brunnen), Noomi („Mara“ → „Noomi“) | Schleier wegwischen |
| Schütteln | Mirjam (Tamburin), Sara (Lachen), Bartimäus (laut rufen) | Handy schütteln |
| Saitenspiel | David | Leier-Saiten zupfen |
| nur Suchen | Maria Magdalena (umdrehen), Zachäus (hochschauen) | — |

Jede Geste hat einen Rückfall ohne Sensor (Dinge auf dem Bildschirm, Finger auflegen statt still halten, Tippen statt Schütteln). Nach 20 s gibt es „Überspringen", nach 25 s Suche „Ich finde niemanden — hilf mir". Ohne Kamera (abgelehnt oder unter *Mehr* ausgeschaltet) erscheinen die Figuren vor einem Sternenhimmel. Wer die Geste gemacht hat, bekommt das Merkmal `erlebt` an der Karte.

**Als App auf den Home-Bildschirm** (`js/installieren.js`): Auf iPhones erklärt eine Anleitung „Teilen → Zum Home-Bildschirm“; auf Android gibt es einen echten „Installieren“-Knopf (`beforeinstallprompt`). Achtung iPhone: Die Home-Bildschirm-App hat einen eigenen Speicher — dafür gibt es unter *Mehr → Spielstand mitnehmen* einen 14-stelligen Code (ohne Name und Notizen).
5. **Rotation:** Pro Woche (Wechsel sonntags) ist an jedem Ort eine andere Figur „unterwegs" — Grund, immer wieder zu kommen. Bekannten Figuren kann man „Nochmal zuhören".
6. **Sammeln:** Karten als Buntglas-Heiligenbildchen (Rahmen je nach Bedeutsamkeit), Orts-Siegel, ein **Kirchenfenster**, das sich Scheibe für Scheibe füllt, Finale bei 18/18.
7. **Rallye-Modus:** Per Event-Code (z. B. am Konfi-Tag) sind alle 18 Figuren gleichzeitig aktiv — der Ortsbesuch bleibt Pflicht.

**Lichtgestalten** (`js/gestalt.js`): Jede Figur wird als Kirchenfenster-Gestalt in ihrer Farbe gezeichnet und hält ihr Symbol wie ein Attribut vor der Brust — bewusst ohne Gesichtszüge. Reines SVG, keine Bilddateien; die Glasfacetten sind pro Figur zufällig, aber reproduzierbar.

## Datenschutz (wichtig: Minderjährige!)

- **Kein Backend, kein Konto, keine Cloud.** Alles liegt im localStorage des Geräts.
- **GPS nur auf dem Gerät:** Die Position wird nie gespeichert, nie übertragen — die App rechnet lokal die Distanz aus. Standortfreigabe ist optional (QR-Codes als vollwertiger Weg).
- **Keine Fremd-Requests zur Laufzeit** (deshalb eigene SVG-Karte statt Google/OSM-Tiles; die OSM-Daten liegen fest in `data/karte-hintergrund.json`). Links (die-bibel.de, staaken-evangelisch.de) öffnen nur auf aktiven Tipp.
- **Kamera, Lage- und Bewegungssensor (AR)** laufen nur in der AR-Ansicht, bleiben auf dem Gerät und werden beim Verlassen sofort gestoppt. Die Kamera lässt sich unter *Mehr* ganz abschalten.
- **Offline:** Ein Service Worker hält die App-Dateien vor (Strategie „Netz zuerst", Cache nach 4 s ohne Netz). Er speichert keine Nutzerdaten.
- Nur der Vorname wird erfragt; „Alles löschen" in den Einstellungen entfernt sämtliche Daten.
- Die QR-/Event-Codes im JSON sind eine Fairness-Hürde, keine Security — wer sie ausliest, betrügt nur sich selbst.

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
| `?ort=dorfkirche&k=WDZ-DK-BRUNNEN` | Simuliert einen QR-Scan |
| `?event=RALLYE-2026` | Aktiviert den Rallye-Modus für heute |
| `?iphone` / `?android` | Zeigt den Home-Bildschirm-Hinweis wie auf dem jeweiligen Handy |

AR-Tests im Browser: `werkstatt/arsim.js` (nur lokal, nicht im Repo) simuliert Lage- und Bewegungssensor.

**Deployment:** Statisches Hosting genügt (z. B. GitHub Pages wie bei konfi-check). **HTTPS ist Pflicht**, sonst gibt der Browser kein GPS frei. Nach dem Deploy in `data/config.json` die `basisUrl` eintragen.

**Leitungsbereich** (`leiter.html`, Zugangscode in `data/config.json` → `leiterCode`):
- **QR-Bögen drucken** (ein A4-Bogen pro Ort + Rallye-Bogen). Erst nach dem Deploy drucken — die QR-Codes enthalten die Basis-URL! Die Klartext-Codes zum Eintippen funktionieren unabhängig davon.
- **Koordinaten-Check:** Zeigt vor Ort live die Distanz zu allen Orten — damit beim Feldtest die Radien (`radiusMeter` in `data/orte.json`) justieren.

## Inhalte pflegen

- **Figuren:** `data/figuren.json` — Dialog (`sprecher: "figur"` / Wahlmomente mit `optionen`), `impuls`, `frage` (Format wie konfi-check), `kartenspruch`. Die Reihenfolge im Array bestimmt die Rotationswoche je Ort.
- **Orte:** `data/orte.json` — Koordinaten (Quelle: OSM/Nominatim, vor Ort validieren!), Radius, QR-Codes, Beschreibungen.
- **Rahmentexte & Codes:** `data/config.json` — Jesus-Sendung, Meilensteine, `jahresStart` (erster Sonntag des Konfi-Jahres), Event-/Leiter-Codes, Datenschutztexte.

## Ideen für später („größer bauen")

Karten untereinander zeigen/tauschen („Zeugnis teilen") · weitere Figuren (Tabita, Lydia, Magnificat-Maria als Adventsspezial) · Audio-Stimmen · Kompass-Richtungspfeil zur nächsten Begegnung · Erweiterung auf die Pilgerweg-Zonen aus konfi-check (St. Nikolai, Gedächtniskirche, Wittenberg …) · perspektivisch: begehbare 3D-/Voxel-Welt

---

*Technik: Pures HTML/CSS/JavaScript ohne Build-Step (wie konfi-check und mitunteruns). Einzige Fremdbibliothek: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT, nur im Leitungsbereich). Kartendaten © OpenStreetMap-Mitwirkende, Lizenz ODbL (Hinweis steht auf der Karte). Design „Illuminierte Sammelkarten": Nachthimmel, Pergament, Gold.*
