/* Wolke der Zeugen — Wochenrotation & Event-Modus.
   Serverlos und deterministisch: Welche Figur an einem Ort "unterwegs" ist,
   ergibt sich allein aus dem Datum. Test-Override: ?heute=YYYY-MM-DD (nur im Speicher). */
(function () {
  let config = null;
  let heuteOverride = null; // Date | null — wird nie gespeichert

  function heute() {
    return heuteOverride ? new Date(heuteOverride.getTime()) : new Date();
  }

  function wochenIndex() {
    if (!config) return 0;
    const start = new Date(config.jahresStart + "T00:00:00");
    const diffTage = Math.floor((heute() - start) / 86400000);
    const idx = Math.floor(diffTage / 7);
    // Vor dem Jahresstart läuft die Rotation rückwärts weiter (sicheres Modulo in aktiveFigur)
    return idx;
  }

  function figurenAnOrt(ortId) {
    const alle = (window.Daten && window.Daten.figuren) || [];
    return alle.filter(f => f.ortId === ortId);
  }

  function aktiveFigur(ortId) {
    const liste = figurenAnOrt(ortId);
    if (!liste.length) return null;
    const n = liste.length;
    const i = ((wochenIndex() % n) + n) % n;
    return liste[i];
  }

  function istAktiv(figur) {
    if (window.Store.istEventAktiv()) return true;
    const aktiv = aktiveFigur(figur.ortId);
    return !!aktiv && aktiv.id === figur.id;
  }

  function aktiveFiguren() {
    const orte = (window.Daten && window.Daten.orte) || [];
    if (window.Store.istEventAktiv()) {
      return (window.Daten && window.Daten.figuren) || [];
    }
    return orte.map(o => aktiveFigur(o.id)).filter(Boolean);
  }

  window.Rotation = {
    init(cfg, overrideDatum) {
      config = cfg;
      if (overrideDatum && /^\d{4}-\d{2}-\d{2}$/.test(overrideDatum)) {
        heuteOverride = new Date(overrideDatum + "T12:00:00");
      }
    },
    heute,
    wochenIndex,
    figurenAnOrt,
    aktiveFigur,
    istAktiv,
    aktiveFiguren
  };
})();
