#!/usr/bin/env bash
# Wolke der Zeugen einmalig auf dem VPS einrichten – vom Mac aus, im Ordner „Apps KU“:
#   ZIEL=benutzer@server ./wolke-der-zeugen/deploy/einrichten.sh
# Fragt einmal nach dem Server-Passwort. Danach:
#   1. Server: Verzeichnis anlegen, nginx-Abschnitt ablegen und einbinden, nginx prüfen
#      und neu laden (bei einem Fehler wird alles zurückgestellt).
#   2. Das Spiel hochladen (deploy.sh).
#   3. Von außen testen.
set -euo pipefail
: "${ZIEL:?Bitte ZIEL setzen – dasselbe wie hinter ssh, z. B. ZIEL=benutzer@server}"
HIER="$(cd "$(dirname "$0")" && pwd)"
URL="https://www.viktor-weber.com/wolke-der-zeugen"

# Eine SSH-Verbindung für alle Schritte, damit das Passwort nur einmal nötig ist
STEUER="/tmp/wolke-ssh-%C"
export RSYNC_RSH="ssh -o ControlMaster=auto -o ControlPath=$STEUER -o ControlPersist=120"
trap 'ssh -o ControlPath="$STEUER" -O exit "$ZIEL" 2>/dev/null || true' EXIT

echo "━━ 1/3 Server einrichten"
COPYFILE_DISABLE=1 tar -C "$HIER" -cf - nginx-location.conf server-einrichten.sh \
  | $RSYNC_RSH "$ZIEL" 'set -e; rm -rf /root/wolke-einrichten; mkdir -p /root/wolke-einrichten; tar -xf - -C /root/wolke-einrichten 2>/dev/null; bash /root/wolke-einrichten/server-einrichten.sh'

echo
echo "━━ 2/3 Spiel hochladen"
"$HIER/deploy.sh"

echo
echo "━━ 3/3 Test von außen"
FEHLER=0
pruefe() { # Beschreibung, erwartet, tatsächlich
  if [ "$2" = "$3" ]; then echo "  ✅ $1"; else echo "  ❌ $1 (erwartet: $2, bekommen: $3)"; FEHLER=1; fi
}
code() { curl -s -o /dev/null -w '%{http_code}' "$1"; }
kopf() { curl -sI "$1" | tr -d '\r' | awk -v k="$2" 'tolower($1)==tolower(k)":" {sub(/^[^:]*: */,""); print; exit}'; }

pruefe "Startseite des Spiels antwortet"           200 "$(code "$URL/")"
pruefe "Adresse ohne / leitet weiter"              301 "$(code "$URL")"
pruefe "Leitungsbereich erreichbar"                200 "$(code "$URL/leiter.html")"
pruefe "Figuren-Daten erreichbar"                  200 "$(code "$URL/data/figuren.json")"
pruefe "Skripte werden nicht lange zwischengespeichert" "no-cache" "$(kopf "$URL/js/app.js" cache-control)"
pruefe "Manifest hat den richtigen Typ"            "application/manifest+json" "$(kopf "$URL/manifest.webmanifest" content-type | cut -d';' -f1)"
pruefe "Werkstatt ist nicht abrufbar"              404 "$(code "$URL/werkstatt/arsim.js")"
pruefe "Homepage läuft weiter"                     200 "$(code "https://www.viktor-weber.com/")"
pruefe "Zwölf Steine läuft weiter"                 200 "$(code "https://www.viktor-weber.com/zwoelf-steine/")"

echo
if [ "$FEHLER" = 0 ]; then
  echo "Alles gut. Das Spiel läuft unter $URL/"
  echo "Nächster Schritt: Claude Bescheid geben – dann wird die alte GitHub-Adresse auf die neue umgeleitet."
else
  echo "Mindestens ein Test ist fehlgeschlagen. Bitte die Ausgabe an Claude schicken."
  exit 1
fi
