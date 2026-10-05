#!/usr/bin/env bash
# Richtet Wolke der Zeugen auf dem Server ein (läuft auf dem VPS, als root).
# Wird von deploy/einrichten.sh hochgeladen und aufgerufen. Darf mehrfach laufen.
set -euo pipefail
QUELLE="$(cd "$(dirname "$0")" && pwd)"
SNIPPET=/etc/nginx/snippets/wolke-der-zeugen.conf
ANKER="include snippets/zwoelf-steine.conf;"
ZEILE="include snippets/wolke-der-zeugen.conf;"
SICHERUNG=/root/nginx-vor-wolke-der-zeugen.conf
DATEI=""
GEAENDERT=0

zurueck() {
  echo "Stelle den vorherigen Zustand wieder her …" >&2
  if [ "$GEAENDERT" = 1 ] && [ -f "$SICHERUNG" ]; then cp "$SICHERUNG" "$DATEI"; fi
  if [ -f "$SNIPPET.vorher" ]; then cp "$SNIPPET.vorher" "$SNIPPET"; else rm -f "$SNIPPET"; fi
  echo "Nichts kaputt: Die Homepage läuft unverändert weiter." >&2
}

echo "1/4 Verzeichnis /var/www/wolke-der-zeugen anlegen …"
install -d -m 755 /var/www/wolke-der-zeugen

echo "2/4 nginx-Abschnitt nach $SNIPPET legen …"
rm -f "$SNIPPET.vorher"
[ -f "$SNIPPET" ] && cp "$SNIPPET" "$SNIPPET.vorher"
install -m 644 "$QUELLE/nginx-location.conf" "$SNIPPET"

echo "3/4 Im Block der Homepage einbinden (unter der Zeile von Zwölf Steine) …"
TREFFER=$(grep -lF "$ANKER" /etc/nginx/sites-enabled/* 2>/dev/null || true)
if [ "$(printf '%s\n' "$TREFFER" | grep -c .)" != 1 ]; then
  echo "FEHLER: Die Zeile „$ANKER“ steht nicht in genau einer Datei unter /etc/nginx/sites-enabled/:" >&2
  printf '  %s\n' $TREFFER >&2
  zurueck; exit 1
fi
DATEI=$(readlink -f "$TREFFER")   # sites-enabled enthält oft Verknüpfungen
if grep -qF "$ZEILE" "$DATEI"; then
  echo "   … ist schon eingebunden ($DATEI)."
else
  if [ "$(grep -cF "$ANKER" "$DATEI")" != 1 ]; then
    echo "FEHLER: „$ANKER“ steht mehrfach in $DATEI. Bitte von Hand einbinden (siehe LIESMICH)." >&2
    zurueck; exit 1
  fi
  cp "$DATEI" "$SICHERUNG"
  GEAENDERT=1
  # Neue Zeile mit derselben Einrückung direkt unter die von Zwölf Steine setzen.
  # „cat >“ statt Verschieben: Rechte und Besitzer der Datei bleiben erhalten.
  awk -v anker="$ANKER" -v zeile="$ZEILE" '{ print } index($0, anker) { match($0, /^[ \t]*/); print substr($0, 1, RLENGTH) zeile }' \
    "$SICHERUNG" > /tmp/wolke-nginx.neu
  cat /tmp/wolke-nginx.neu > "$DATEI" && rm -f /tmp/wolke-nginx.neu
  echo "   eingefügt in $DATEI (Sicherung: $SICHERUNG):"
  grep -nF -e "$ANKER" -e "$ZEILE" "$DATEI" | sed 's/^/     /'
fi

echo "4/4 nginx prüfen …"
if nginx -t; then
  systemctl reload nginx
  echo "Fertig: nginx kennt jetzt /wolke-der-zeugen/."
else
  echo "FEHLER: nginx-Prüfung fehlgeschlagen." >&2
  zurueck; nginx -t >/dev/null 2>&1 || true; exit 1
fi
