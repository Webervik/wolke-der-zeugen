/* Wolke der Zeugen — lokaler Zustand.
   Alles bleibt auf dem Gerät (localStorage). Es gibt bewusst kein Backend:
   Standortdaten werden nie gespeichert oder übertragen. */
(function () {
  const KEY = "wolkeDerZeugen.v1";

  const DEFAULT = {
    version: 1,
    name: "",
    onboardingDone: false,
    geoErlaubt: false,
    demo: false,
    gesammelt: {},          // figurId -> { datum, glanz, verifikation: "gps"|"qr"|"demo" }
    notizen: {},            // figurId -> string (privat, nur lokal)
    ortsSiegel: {},         // ortId -> true
    qrFreischaltungen: {},  // ortId -> "YYYY-MM-DD" (gültig am Kalendertag)
    eventAktivBis: null,    // ISO-Datum "YYYY-MM-DD" oder null
    gelesen: {},            // meilensteinId -> true
    installHinweisAus: false,
    kameraAus: false        // true: Begegnungen vor Sternenhimmel statt Kamerabild
  };

  // JSON-Kopie statt structuredClone: läuft auch auf älteren Handys (iOS < 15.4)
  function frisch() { return JSON.parse(JSON.stringify(DEFAULT)); }

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return frisch();
      const parsed = JSON.parse(raw);
      return Object.assign(frisch(), parsed);
    } catch (e) {
      return frisch();
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) { /* Speicher voll o. ä. — App bleibt nutzbar */ }
  }

  function heuteISO(datum) {
    const d = datum || window.Rotation && window.Rotation.heute() || new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const t = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + t;
  }

  window.Store = {
    get: () => state,

    setName(name) { state.name = String(name || "").trim().slice(0, 30); save(); },
    setOnboardingDone() { state.onboardingDone = true; save(); },
    setGeoErlaubt(v) { state.geoErlaubt = !!v; save(); },
    setDemo(v) { state.demo = !!v; save(); },
    setInstallHinweisAus(v) { state.installHinweisAus = !!v; save(); },
    setKameraAus(v) { state.kameraAus = !!v; save(); },

    istGesammelt(figurId) { return !!state.gesammelt[figurId]; },

    sammle(figurId, verifikation, glanz, erlebt) {
      const vorhanden = state.gesammelt[figurId];
      if (vorhanden) {
        // Echter Besuch wertet eine Demo-Begegnung auf; Glanz bleibt erhalten.
        if (vorhanden.verifikation === "demo" && verifikation !== "demo") {
          vorhanden.verifikation = verifikation;
          vorhanden.datum = heuteISO();
        }
        if (glanz) vorhanden.glanz = true;
        if (erlebt) vorhanden.erlebt = true;
      } else {
        state.gesammelt[figurId] = { datum: heuteISO(), glanz: !!glanz, verifikation };
        if (erlebt) state.gesammelt[figurId].erlebt = true; // Glaubensgeste in AR gemacht
      }
      save();
    },

    markiereErlebt(figurId) {
      if (state.gesammelt[figurId]) { state.gesammelt[figurId].erlebt = true; save(); }
    },

    anzahlGesammelt() { return Object.keys(state.gesammelt).length; },

    setNotiz(figurId, text) {
      const t = String(text || "").trim();
      if (t) state.notizen[figurId] = t; else delete state.notizen[figurId];
      save();
    },
    getNotiz(figurId) { return state.notizen[figurId] || ""; },

    setzeSiegel(ortId) { state.ortsSiegel[ortId] = true; save(); },
    hatSiegel(ortId) { return !!state.ortsSiegel[ortId]; },

    qrFreischalten(ortId) { state.qrFreischaltungen[ortId] = heuteISO(); save(); },
    istQrFrei(ortId) { return state.qrFreischaltungen[ortId] === heuteISO(); },

    aktiviereEvent() { state.eventAktivBis = heuteISO(); save(); },
    istEventAktiv() { return state.eventAktivBis === heuteISO(); },

    markiereGelesen(id) { state.gelesen[id] = true; save(); },
    istGelesen(id) { return !!state.gelesen[id]; },

    allesLoeschen() {
      try { localStorage.removeItem(KEY); } catch (e) {}
      state = frisch();
    }
  };
})();
