/* Wolke der Zeugen — Umzug von GitHub Pages nach www.viktor-weber.com.

   Alte Adresse (webervik.github.io): leitet sofort weiter und nimmt den ganzen
   Spielstand im #-Teil der Adresse mit. Der #-Teil wird nie an einen Server
   geschickt, er bleibt im Browser. Läuft die alte Fassung als App auf dem
   Home-Bildschirm, wird nicht weitergeleitet (iPhone: eigener Speicher), sondern
   die App startet normal und zeigt einen Hinweis mit dem Spielstand-Code.

   Neue Adresse: liest den Spielstand ein, BEVOR storage.js lädt, legt ihn mit
   einem vorhandenen Stand zusammen und entfernt ihn sofort aus der Adresszeile. */
(function () {
  const ALT_HOST = "webervik.github.io";
  const NEU = "https://www.viktor-weber.com/wolke-der-zeugen/";
  const KEY = "wolkeDerZeugen.v1";
  const MARKE = "#umzug=";

  const ID = /^[a-z0-9-]{1,48}$/;
  const DATUM = /^\d{4}-\d{2}-\d{2}$/;
  const VERIFIKATION = ["gps", "qr", "demo", "uebertragen"];

  let meldung = null;
  let leitetWeiter = false;
  let hinweisImApp = false;

  /* ---------- Kodieren: JSON → UTF-8 → base64url ---------- */
  function kodiere(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function dekodiere(text) {
    const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function lies() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; }
  }

  function istObjekt(x) { return x && typeof x === "object" && !Array.isArray(x); }

  /* Nur bekannte Felder mit passenden Typen übernehmen. Ein präparierter Link
     kann so höchstens Fortschritt hinzufügen (wie der Spielstand-Code), aber
     nichts löschen und keine fremden Felder einschleusen. */
  function saeubere(roh) {
    if (!istObjekt(roh)) return null;
    const s = { gesammelt: {}, notizen: {}, ortsSiegel: {}, qrFreischaltungen: {}, gelesen: {} };
    if (typeof roh.name === "string") s.name = roh.name.trim().slice(0, 30);
    ["onboardingDone", "geoErlaubt", "demo", "installHinweisAus", "kameraAus"].forEach(k => {
      if (roh[k] === true) s[k] = true;
    });
    if (typeof roh.eventAktivBis === "string" && DATUM.test(roh.eventAktivBis)) s.eventAktivBis = roh.eventAktivBis;
    if (istObjekt(roh.gesammelt)) Object.keys(roh.gesammelt).forEach(id => {
      const g = roh.gesammelt[id];
      if (!ID.test(id) || !istObjekt(g)) return;
      s.gesammelt[id] = {
        datum: typeof g.datum === "string" && DATUM.test(g.datum) ? g.datum : new Date().toISOString().slice(0, 10),
        glanz: g.glanz === true,
        verifikation: VERIFIKATION.indexOf(g.verifikation) >= 0 ? g.verifikation : "uebertragen"
      };
      if (g.erlebt === true) s.gesammelt[id].erlebt = true;
    });
    if (istObjekt(roh.notizen)) Object.keys(roh.notizen).forEach(id => {
      if (ID.test(id) && typeof roh.notizen[id] === "string" && roh.notizen[id].trim()) s.notizen[id] = roh.notizen[id].slice(0, 4000);
    });
    ["ortsSiegel", "gelesen"].forEach(feld => {
      if (istObjekt(roh[feld])) Object.keys(roh[feld]).forEach(id => { if (ID.test(id) && roh[feld][id] === true) s[feld][id] = true; });
    });
    if (istObjekt(roh.qrFreischaltungen)) Object.keys(roh.qrFreischaltungen).forEach(id => {
      const d = roh.qrFreischaltungen[id];
      if (ID.test(id) && typeof d === "string" && DATUM.test(d)) s.qrFreischaltungen[id] = d;
    });
    return s;
  }

  /* Mitgebrachten Stand mit dem an der neuen Adresse zusammenlegen: nichts geht verloren. */
  function verbinde(hier, mit) {
    const z = Object.assign({}, hier || {});
    if (!z.name && mit.name) z.name = mit.name;
    ["onboardingDone", "geoErlaubt", "demo", "installHinweisAus", "kameraAus"].forEach(k => { if (mit[k]) z[k] = true; });
    if (mit.eventAktivBis && (!z.eventAktivBis || mit.eventAktivBis > z.eventAktivBis)) z.eventAktivBis = mit.eventAktivBis;

    z.gesammelt = Object.assign({}, z.gesammelt);
    Object.keys(mit.gesammelt).forEach(id => {
      const a = mit.gesammelt[id], h = z.gesammelt[id];
      if (!h) { z.gesammelt[id] = a; return; }
      const neu = Object.assign({}, h);
      if (neu.verifikation === "demo" && a.verifikation !== "demo") { neu.verifikation = a.verifikation; neu.datum = a.datum; }
      if (a.glanz) neu.glanz = true;
      if (a.erlebt) neu.erlebt = true;
      z.gesammelt[id] = neu;
    });

    z.notizen = Object.assign({}, z.notizen);
    Object.keys(mit.notizen).forEach(id => {
      const h = (z.notizen[id] || "").trim(), a = mit.notizen[id].trim();
      if (!h) z.notizen[id] = a;
      else if (h !== a && h.indexOf(a) < 0) z.notizen[id] = h + "\n\n" + a;
    });

    ["ortsSiegel", "gelesen"].forEach(feld => { z[feld] = Object.assign({}, z[feld], mit[feld]); });
    z.qrFreischaltungen = Object.assign({}, z.qrFreischaltungen);
    Object.keys(mit.qrFreischaltungen).forEach(id => {
      if (!z.qrFreischaltungen[id] || mit.qrFreischaltungen[id] > z.qrFreischaltungen[id]) z.qrFreischaltungen[id] = mit.qrFreischaltungen[id];
    });
    if (!z.version) z.version = 1;
    return z;
  }

  function istStandalone() {
    return (window.matchMedia && (window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches)) || navigator.standalone === true;
  }

  /* ---------- Alte Adresse: weiterleiten ---------- */
  function weiterleiten() {
    const leiter = /\/leiter(\.html)?$/.test(location.pathname); // GitHub Pages liefert auch /leiter
    let ziel = NEU + (leiter ? "leiter.html" : "") + location.search;
    const stand = leiter ? null : lies();
    if (stand && (stand.onboardingDone || stand.name || (stand.gesammelt && Object.keys(stand.gesammelt).length))) {
      try { ziel += MARKE + kodiere(stand); } catch (e) { /* ohne Spielstand weiter */ }
    }

    const laedt = document.getElementById("app-laedt");
    if (laedt) {
      laedt.innerHTML = '☁️ Die Wolke ist umgezogen — einen Moment …<br><a class="link-gold" id="umzug-link">Weiter zur neuen Adresse</a>';
      document.getElementById("umzug-link").href = ziel;
    }

    // Den alten Offline-Speicher dieser App abräumen (nur ihren eigenen:
    // unter webervik.github.io liegen auch andere Projekte).
    const aufraeumen = Promise.all([
      navigator.serviceWorker && navigator.serviceWorker.getRegistrations
        ? navigator.serviceWorker.getRegistrations().then(rs => Promise.all(
          rs.filter(r => r.scope.indexOf("/wolke-der-zeugen/") >= 0).map(r => r.unregister())))
        : null,
      window.caches
        ? caches.keys().then(ks => Promise.all(ks.filter(k => k.indexOf("wdz-") === 0).map(k => caches.delete(k))))
        : null
    ]).catch(() => {});
    Promise.race([aufraeumen, new Promise(r => setTimeout(r, 700))]).then(() => location.replace(ziel));
  }

  /* ---------- Neue Adresse: einlesen ---------- */
  function einlesen() {
    if (location.hash.indexOf(MARKE) !== 0) return;
    const roh = location.hash.slice(MARKE.length);
    // Sofort aus der Adresszeile (und damit aus Lesezeichen/Teilen) entfernen
    history.replaceState(null, "", location.pathname + location.search);
    let mit;
    try { mit = saeubere(dekodiere(roh)); } catch (e) { mit = null; }
    if (!mit) return;
    const zusammen = verbinde(lies(), mit);
    try {
      localStorage.setItem(KEY, JSON.stringify(zusammen));
      const n = Object.keys(mit.gesammelt).length;
      meldung = "☁️ Willkommen an der neuen Adresse!" +
        (n ? ` ${n === 1 ? "Deine Begegnung ist" : "Deine " + n + " Begegnungen sind"} mitgekommen.` : "");
    } catch (e) { /* Speicher voll/gesperrt — App läuft trotzdem */ }
  }

  /* ---------- Hinweis in der alten Home-Bildschirm-App ---------- */
  function zeigeHinweis() {
    if (!window.Spielstand || !window.Daten) return;
    const code = window.Spielstand.erzeugeCode();
    const hatStand = window.Store && window.Store.anzahlGesammelt() > 0;
    const overlay = document.createElement("div");
    overlay.className = "anleitung-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="anleitung panel-pergament">
        <div class="anleitung-symbol"><img src="assets/icon-180.png" alt="" width="64" height="64"></div>
        <h2>Die Wolke ist umgezogen</h2>
        <p>Die neue Adresse ist <strong>www.viktor-weber.com/wolke-der-zeugen</strong>. Diese App hier bekommt keine Neuigkeiten mehr.</p>
        <ol class="anleitung-schritte">
          ${hatStand ? `<li>Kopiere deinen Spielstand-Code:<div class="code-anzeige">${code}</div><button class="btn btn-sekundaer" data-umzug-kopieren>📋 Code kopieren</button></li>` : ""}
          <li>Öffne die neue Adresse in Safari bzw. Chrome und lege sie wie gewohnt auf den Home-Bildschirm.</li>
          ${hatStand ? `<li>In der neuen App unter <em>Mehr → Spielstand mitnehmen</em> den Code einfügen.</li>` : ""}
          <li>Dieses alte Symbol kannst du danach löschen.</li>
        </ol>
        <a class="btn btn-gold" href="${NEU}" target="_blank" rel="noopener">Neue Adresse öffnen ↗</a>
        <button class="btn btn-sekundaer" data-umzug-zu>Später</button>
      </div>`;
    document.body.appendChild(overlay);
    const kopieren = overlay.querySelector("[data-umzug-kopieren]");
    if (kopieren) kopieren.addEventListener("click", () => {
      const fertig = () => { kopieren.textContent = "✅ Kopiert"; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(fertig, () => {});
    });
    overlay.querySelector("[data-umzug-zu]").addEventListener("click", () => overlay.remove());
  }

  if (location.hostname === ALT_HOST) {
    if (istStandalone()) hinweisImApp = true;
    else { leitetWeiter = true; weiterleiten(); }
  } else {
    einlesen();
  }

  window.Umzug = {
    get leitetWeiter() { return leitetWeiter; },
    get hinweisImApp() { return hinweisImApp; },
    get meldung() { return meldung; },
    zeigeHinweis,
    _test: { kodiere, dekodiere, saeubere, verbinde }
  };
})();
