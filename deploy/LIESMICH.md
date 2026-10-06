# Wolke der Zeugen online stellen

Ziel: `https://www.viktor-weber.com/wolke-der-zeugen/`, Hostinger-VPS, nginx — genauso wie Zwölf Steine.
Das Spiel bekommt ein **eigenes Verzeichnis** `/var/www/wolke-der-zeugen/`. Es liegt nicht im Web-Stammverzeichnis der Homepage, deshalb löscht ein Homepage-Deploy das Spiel nicht.

Dateien in diesem Ordner:
- `einrichten.sh`: einmalig: richtet den Server ein, lädt das Spiel hoch und testet alles
- `server-einrichten.sh`: der Teil, der auf dem Server läuft (wird von `einrichten.sh` hochgeladen)
- `nginx-location.conf`: der Abschnitt für den Server-Block der Homepage
- `deploy.sh`: jede neue Version hochladen
- `LIESMICH.md`: diese Anleitung

`ZIEL` steht in den Befehlen unten für genau das, was du sonst hinter `ssh` schreibst, z. B. `root@1.2.3.4`.
Alle Befehle laufen auf dem **Mac** im Ordner „Apps KU“.

---

## Einmalig: einrichten

```bash
ZIEL=benutzer@server ./wolke-der-zeugen/deploy/einrichten.sh
```

Fragt einmal nach dem Server-Passwort. Das Skript
1. legt `/var/www/wolke-der-zeugen/` an,
2. legt den nginx-Abschnitt als `/etc/nginx/snippets/wolke-der-zeugen.conf` ab,
3. fügt im Block der Homepage direkt unter `include snippets/zwoelf-steine.conf;` die Zeile `include snippets/wolke-der-zeugen.conf;` ein (Sicherung vorher: `/root/nginx-vor-wolke-der-zeugen.conf`),
4. prüft nginx mit `nginx -t`. Nur wenn das gut geht, lädt es nginx neu, sonst stellt es alles zurück. Die Homepage läuft in jedem Fall weiter,
5. lädt das Spiel hoch und
6. testet von außen: Spiel, Umleitung ohne Schrägstrich, Zwischenspeicher-Regeln, Manifest-Typ, Homepage und Zwölf Steine.

Am Ende steht „Alles gut“ oder eine Liste mit ❌.

Das Skript darf mehrfach laufen. Ist die Zeile schon eingebunden, wird nur der nginx-Abschnitt erneuert.

**Danach:** Claude Bescheid geben. Erst dann wird die alte Adresse `webervik.github.io/wolke-der-zeugen/` auf die neue umgeleitet (siehe unten).

## Jede neue Version: nur hochladen

```bash
ZIEL=benutzer@server ./wolke-der-zeugen/deploy/deploy.sh
```
Das Skript bricht ab,
- wenn es nicht eingecheckte Änderungen gibt (erst committen),
- wenn in `sw.js` (Liste `KERN`) eine Datei steht, die es nicht gibt.

Nicht hochgeladen werden `.git`, `.claude`, alle `*.md`, `deploy/` und `werkstatt/`.

Bei neuen Dateien: in `sw.js` in `KERN` eintragen und `CACHE` hochzählen (`wdz-v4` → `wdz-v5`).
Hat sich `nginx-location.conf` geändert, einfach `einrichten.sh` noch einmal laufen lassen.

Zum Sichern zusätzlich `git push`. Die Kopie auf GitHub leitet nur noch weiter, das schadet also nichts.

## Die alte Adresse (GitHub Pages)

`js/umzug.js` erkennt die alte Adresse `webervik.github.io`:
- **Im Browser** leitet sie sofort auf die neue Adresse weiter. Der ganze Spielstand (mit Name und Notizen) reist im `#`-Teil der Adresse mit. Dieser Teil wird nie an einen Server geschickt. Die neue Seite liest ihn ein, legt ihn mit einem vorhandenen Stand zusammen und löscht ihn sofort aus der Adresszeile. Parameter in der Adresse und der Leitungsbereich werden mit umgeleitet.
- **Als App auf dem Home-Bildschirm** startet die alte App normal und zeigt einen Hinweis mit dem Spielstand-Code. Auf dem iPhone hat die App einen eigenen Speicher, eine Weiterleitung käme dort nicht an.
- Den alten Offline-Speicher räumt sie dabei ab, und zwar nur den dieser App.

Aktiv wird das erst mit `git push`, denn GitHub Pages veröffentlicht den Stand aus `main`. Deshalb erst pushen, wenn die neue Adresse läuft.

## Testen von Hand

```bash
curl -sI https://www.viktor-weber.com/wolke-der-zeugen/ | head -5
curl -sI https://www.viktor-weber.com/wolke-der-zeugen
```

Auf dem Handy:
1. Die neue Adresse öffnen, einmal eine Begegnung im Demo-Modus spielen.
2. **Teilen → Zum Home-Bildschirm** (iPhone) bzw. **⋮ → App installieren** (Android).
3. Im Flugmodus starten: Das Spiel muss auch offline laufen.
4. Kamera, Standort und Bewegung fragen auf der neuen Adresse **neu** um Erlaubnis. Das ist normal.

## Neue Stationen einmessen

Im Leitungsbereich (`…/wolke-der-zeugen/leiter.html`) unter **Position messen** an die Stelle stellen, warten bis ±10 m, **Koordinaten kopieren** und in `data/orte.json` (`lat`, `lng`) eintragen — oder an Claude schicken. Geschätzt sind bisher: Waldarche (Bauwagen), Staakentreff, die Kitas, der Hort und Hohenlohe.

## Textbaustein für die Datenschutzerklärung der Homepage

> **Spiel „Wolke der Zeugen“ (www.viktor-weber.com/wolke-der-zeugen/)**
> Das ortsbasierte Spiel der Ev. Kirchengemeinde Staaken läuft vollständig in Ihrem Browser. Vorname, gesammelte Begegnungen, private Notizen und Einstellungen werden ausschließlich lokal auf Ihrem Gerät gespeichert (Web Storage des Browsers) und nicht an uns oder Dritte übertragen. Es gibt kein Konto, keine Cookies, keine Analyse- oder Tracking-Dienste und keine Inhalte von fremden Servern. Wenn Sie es erlauben, nutzt das Spiel den Standort, die Kamera sowie den Lage- und Bewegungssensor Ihres Geräts. Diese Daten werden ausschließlich auf dem Gerät verarbeitet: Der Standort dient nur dazu, die Entfernung zu den Gemeindeorten zu berechnen. Das Kamerabild wird nur während einer Begegnung als Hintergrund angezeigt. Nichts davon wird gespeichert oder übertragen. Für die Seiten des Spiels führt unser Webserver kein Zugriffsprotokoll. Die beim Aufruf technisch notwendigen Verbindungsdaten (z. B. IP-Adresse) werden nur für die Dauer der Verbindung verarbeitet. Links zu www.die-bibel.de und zu den Seiten der Orte (z. B. Kitas, Gemeinwesenverein, Seniorenzentrum) öffnen sich nur auf Ihren Klick; dann gelten die Datenschutzbestimmungen dieser Seiten. Alle Spieldaten lassen sich im Spiel unter *Mehr → Alles löschen* oder über die Browser-Einstellungen („Websitedaten löschen“) entfernen.

## Rückgängig machen

Auf dem Server:
```bash
DATEI="$(readlink -f "$(grep -lF 'include snippets/wolke-der-zeugen.conf;' /etc/nginx/sites-enabled/*)")"
sudo sed -i '/include snippets\/wolke-der-zeugen.conf;/d' "$DATEI"
sudo nginx -t && sudo systemctl reload nginx
sudo rm /etc/nginx/snippets/wolke-der-zeugen.conf && sudo rm -rf /var/www/wolke-der-zeugen
```
Und auf dem Mac `js/umzug.js` aus `index.html` und `leiter.html` entfernen und pushen, sonst leitet GitHub weiter ins Leere.
