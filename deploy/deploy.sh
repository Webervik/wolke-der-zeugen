#!/usr/bin/env bash
# Wolke der Zeugen auf den Server kopieren (rsync über SSH) – Anleitung: deploy/LIESMICH.md
#
#   ZIEL=benutzer@server ./wolke-der-zeugen/deploy/deploy.sh --probe   # nur anzeigen
#   ZIEL=benutzer@server ./wolke-der-zeugen/deploy/deploy.sh           # wirklich kopieren
#
# ZIEL ist genau das, was du sonst hinter „ssh“ schreibst (auch ein Alias aus ~/.ssh/config).
#
# Kopiert nur das Spiel nach /var/www/wolke-der-zeugen/ und löscht dort Dateien,
# die es lokal nicht mehr gibt. Andere Verzeichnisse auf dem Server bleiben unberührt.
set -euo pipefail

: "${ZIEL:?Bitte ZIEL setzen – dasselbe wie hinter ssh, z. B. ZIEL=benutzer@server}"
ZIEL_PFAD="${ZIEL_PFAD:-/var/www/wolke-der-zeugen/}"
QUELLE="$(cd "$(dirname "$0")/.." && pwd)"

# Schutz: nur aus dem Spielordner und nur in ein wolke-der-zeugen-Verzeichnis
[ -f "$QUELLE/index.html" ] && [ -f "$QUELLE/sw.js" ] && [ -f "$QUELLE/data/figuren.json" ] || { echo "Spielordner nicht gefunden: $QUELLE" >&2; exit 1; }
case "$ZIEL_PFAD" in */wolke-der-zeugen/) ;; *) echo "ZIEL_PFAD muss auf /wolke-der-zeugen/ enden" >&2; exit 1 ;; esac

# Jede Datei aus der Offline-Liste (KERN in sw.js) muss es geben, sonst
# scheitert die Installation des Service Workers auf den Handys.
FEHLT=""
while IFS= read -r datei; do
  [ "$datei" = "./" ] && continue
  [ -f "$QUELLE/$datei" ] || FEHLT="$FEHLT $datei"
done < <(sed -n '/^const KERN = \[/,/^\];/s/^ *"\([^"]*\)".*/\1/p' "$QUELLE/sw.js")
[ -z "$FEHLT" ] || { echo "In sw.js (KERN) stehen Dateien, die es nicht gibt:$FEHLT" >&2; exit 1; }
CACHE=$(sed -n 's/^const CACHE = "\([^"]*\)".*/\1/p' "$QUELLE/sw.js")

# Nur einen sauberen, eingecheckten Stand hochladen
if [ -d "$QUELLE/.git" ] && [ -n "$(git -C "$QUELLE" status --porcelain)" ]; then
  echo "Es gibt nicht eingecheckte Änderungen. Bitte erst committen." >&2; exit 1
fi

PROBE=""
if [ "${1:-}" = "--probe" ]; then PROBE="--dry-run"; echo "Probelauf – es wird nichts kopiert."; fi
echo "Stand $(git -C "$QUELLE" rev-parse --short HEAD 2>/dev/null || echo "?") · Cache $CACHE → $ZIEL:$ZIEL_PFAD"

rsync -rlptvz --delete $PROBE --chmod=u=rwX,go=rX \
  --exclude ".*" \
  --exclude "*.md" \
  --exclude "deploy/" \
  --exclude "werkstatt/" \
  "$QUELLE/" "$ZIEL:$ZIEL_PFAD"

if [ -z "$PROBE" ]; then echo "Fertig. Test: https://www.viktor-weber.com/wolke-der-zeugen/"; fi
