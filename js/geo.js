/* Wolke der Zeugen — Standortlogik.
   Datenschutz: Die Position existiert nur im Speicher dieser Funktionen.
   Sie wird nie persistiert, nie in URLs geschrieben und nie übertragen.
   Wie bei Pokémon Go schaltet allein der echte Standort einen Ort frei
   (oder im Demo-Modus das "Beamen" zum Ausprobieren). */
(function () {
  let watchId = null;
  let position = null;      // { lat, lng, accuracy, zeit } — nur im Speicher
  let demoOrtId = null;     // im Demo-Modus "gebeamter" Ort
  let verweigert = false;   // Browser/Handy blockiert den Standort
  let listeners = [];

  /* Letzte Position bleibt kurz gültig: Ein GPS-Aussetzer (drinnen, unter Bäumen)
     oder der Wechsel ins Gespräch soll einen gerade erreichten Ort nicht wieder sperren. */
  function aktuell() {
    if (!position) return null;
    const maxAlter = watchId !== null ? 90000 : 180000;
    return Date.now() - position.zeit <= maxAlter ? position : null;
  }

  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function melde() { listeners.forEach(fn => { try { fn(); } catch (e) {} }); }

  function start() {
    if (watchId !== null || !window.Store.get().geoErlaubt) return;
    if (!("geolocation" in navigator)) return;
    watchId = navigator.geolocation.watchPosition(
      pos => {
        verweigert = false;
        position = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          zeit: Date.now()
        };
        melde();
      },
      // Fehler/Timeout: letzte Position nicht sofort verwerfen (siehe aktuell())
      err => {
        if (err && err.code === 1) { verweigert = true; stop(); } // PERMISSION_DENIED
        melde();
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
  }

  function stop() {
    if (watchId !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchId);
    }
    watchId = null;
  }

  function beamZu(ortId) {
    const ort = window.Daten.orte.find(o => o.id === ortId);
    if (!ort) return;
    demoOrtId = ortId;
    if (ort.lat !== null && ort.lng !== null) {
      // Simulierte Position läuft durch dieselbe Geofence-Pipeline wie echtes GPS
      position = { lat: ort.lat, lng: ort.lng, accuracy: 5, zeit: Date.now() };
    }
    melde();
  }

  function beamZuruecksetzen() { demoOrtId = null; if (watchId === null) position = null; melde(); }

  function distanzZu(ort) {
    const p = aktuell();
    if (!p || ort.lat === null || ort.lng === null) return null;
    return haversine(p.lat, p.lng, ort.lat, ort.lng);
  }

  /* Zentrale Freischaltungs-Prüfung: GPS oder Demo. */
  function freischaltung(ort) {
    if (window.Store.get().demo && demoOrtId === ort.id) {
      return { frei: true, art: "demo", distanz: 0 };
    }
    const d = distanzZu(ort);
    if (d !== null) {
      const toleranz = Math.min(aktuell().accuracy || 0, 30);
      if (d <= ort.radiusMeter + toleranz) {
        return { frei: true, art: "gps", distanz: d };
      }
      return { frei: false, art: null, distanz: d };
    }
    return { frei: false, art: null, distanz: null };
  }

  window.Geo = {
    start,
    stop,
    beamZu,
    beamZuruecksetzen,
    freischaltung,
    distanzZu,
    haversine,
    aktiv: () => watchId !== null,
    verweigert: () => verweigert,
    hatPosition: () => !!aktuell(),
    genauigkeit: () => (aktuell() ? aktuell().accuracy : null),
    positionXY: () => (aktuell() ? { lat: aktuell().lat, lng: aktuell().lng } : null),
    demoOrt: () => demoOrtId,
    onUpdate(fn) { listeners.push(fn); }
  };
})();
