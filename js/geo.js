/* Wolke der Zeugen — Standortlogik.
   Datenschutz: Die Position existiert nur im Speicher dieser Funktionen.
   Sie wird nie persistiert, nie in URLs geschrieben und nie übertragen.
   Die QR-/Leiter-Codes im JSON sind eine Fairness-Hürde, keine Security —
   wer sie ausliest, betrügt nur sich selbst ums Spiel. */
(function () {
  let watchId = null;
  let position = null;      // { lat, lng, accuracy } — nur im Speicher
  let demoOrtId = null;     // im Demo-Modus "gebeamter" Ort
  let listeners = [];

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
        position = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        melde();
      },
      () => { position = null; melde(); },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
  }

  function stop() {
    if (watchId !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchId);
    }
    watchId = null;
    position = null;
  }

  function beamZu(ortId) {
    const ort = window.Daten.orte.find(o => o.id === ortId);
    if (!ort) return;
    demoOrtId = ortId;
    if (ort.lat !== null && ort.lng !== null) {
      // Simulierte Position läuft durch dieselbe Geofence-Pipeline wie echtes GPS
      position = { lat: ort.lat, lng: ort.lng, accuracy: 5 };
    }
    melde();
  }

  function beamZuruecksetzen() { demoOrtId = null; if (watchId === null) position = null; melde(); }

  function distanzZu(ort) {
    if (!position || ort.lat === null || ort.lng === null) return null;
    return haversine(position.lat, position.lng, ort.lat, ort.lng);
  }

  /* Zentrale Freischaltungs-Prüfung: GPS, QR oder Demo. */
  function freischaltung(ort) {
    if (window.Store.get().demo && demoOrtId === ort.id) {
      return { frei: true, art: "demo", distanz: 0 };
    }
    if (window.Store.istQrFrei(ort.id)) {
      return { frei: true, art: "qr", distanz: distanzZu(ort) };
    }
    const d = distanzZu(ort);
    if (d !== null) {
      const toleranz = Math.min(position.accuracy || 0, 30);
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
    hatPosition: () => !!position,
    genauigkeit: () => (position ? position.accuracy : null),
    positionXY: () => (position ? { lat: position.lat, lng: position.lng } : null),
    demoOrt: () => demoOrtId,
    onUpdate(fn) { listeners.push(fn); }
  };
})();
