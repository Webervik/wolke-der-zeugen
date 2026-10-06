/* Wolke der Zeugen — "Als App auf den Home-Bildschirm" + Spielstand mitnehmen.

   iPhone/iPad: Safari kennt keinen Installieren-Knopf für Webseiten. Es bleibt der
   Weg über "Teilen → Zum Home-Bildschirm" — den erklären wir Schritt für Schritt.
   Achtung: Die App auf dem Home-Bildschirm hat auf dem iPhone einen EIGENEN Speicher.
   Wer schon gesammelt hat, nimmt seinen Stand mit einem kurzen Code mit.

   Android (Chrome, Edge, Samsung Internet …): Der Browser meldet "beforeinstallprompt" —
   dann gibt es einen echten "Installieren"-Knopf. Der Speicher bleibt derselbe.

   Testen ohne Handy: ?iphone bzw. ?android erzwingt die jeweilige Anzeige. */
(function () {
  const params = new URLSearchParams(location.search);
  const TEST = params.has("iphone") ? "ios" : params.has("android") ? "android" : null;

  let installEreignis = null;
  const beobachter = [];

  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();          // eigener, freundlicher Knopf statt Browser-Leiste
    installEreignis = e;
    beobachter.forEach(fn => { try { fn(); } catch (x) {} });
  });
  window.addEventListener("appinstalled", () => {
    installEreignis = null;
    if (window.App) window.App.toast("☁️ Die Wolke ist jetzt auf deinem Home-Bildschirm!");
    beobachter.forEach(fn => { try { fn(); } catch (x) {} });
  });

  function plattform() {
    if (TEST) return TEST;
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
    if (/Android/.test(ua)) return "android";
    return "andere";
  }

  function imStandalone() {
    if (TEST) return false;
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      navigator.standalone === true;
  }

  /* Hinweis sinnvoll? Nur auf Handys und nur, wenn nicht schon als App geöffnet. */
  function hinweisSinnvoll() {
    return !imStandalone() && (plattform() === "ios" || plattform() === "android");
  }

  async function installieren() {
    if (!installEreignis) { zeigeAnleitung(); return; }
    const e = installEreignis;
    installEreignis = null;
    try {
      e.prompt();
      await e.userChoice;
    } catch (x) { /* abgebrochen — nicht schlimm */ }
    beobachter.forEach(fn => { try { fn(); } catch (x) {} });
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---------- Anleitung als Fenster ---------- */
  function zeigeAnleitung() {
    const p = plattform();
    const gesammelt = window.Store ? window.Store.anzahlGesammelt() : 0;
    let titel, schritte, nachsatz = "";

    if (p === "ios") {
      titel = "Die Wolke auf deinen Home-Bildschirm";
      schritte = [
        `Tippe auf <strong>„Teilen“</strong> <span class="anl-symbol">⬆︎</span> — in Safari unten in der Leiste. Bei neueren iPhones zuerst auf <strong>„•••“</strong> tippen.`,
        `Etwas nach unten wischen und <strong>„Zum Home-Bildschirm“</strong> wählen.`,
        `Oben rechts auf <strong>„Hinzufügen“</strong> tippen.`,
        `Ab jetzt die Wolke über das neue Symbol ☁️ starten — mit ganzem Bildschirm und ohne Adressleiste.`
      ];
      nachsatz = gesammelt
        ? `<p class="anl-wichtig">📦 <strong>Wichtig:</strong> Die App auf dem Home-Bildschirm fängt mit einem eigenen Speicher an. Deine ${gesammelt} gesammelten ${gesammelt === 1 ? "Zeug:in nimmst" : "Zeug:innen nimmst"} du so mit: hier unter <em>Mehr → Spielstand mitnehmen</em> den Code kopieren und in der neuen App unter <em>Mehr</em> wieder einfügen.</p>`
        : `<p class="dezent">Am besten machst du das gleich am Anfang — die App auf dem Home-Bildschirm hat ihren eigenen Speicher.</p>`;
    } else if (p === "android") {
      titel = "Die Wolke als App installieren";
      schritte = [
        `Tippe oben rechts auf das Menü <strong>⋮</strong> deines Browsers.`,
        `Wähle <strong>„App installieren“</strong> oder <strong>„Zum Startbildschirm hinzufügen“</strong>.`,
        `Bestätigen — die Wolke erscheint als eigenes Symbol ☁️ und startet ohne Adressleiste.`
      ];
      nachsatz = `<p class="dezent">Dein Spielstand bleibt dabei erhalten.</p>`;
    } else {
      titel = "Die Wolke als App";
      schritte = [
        `Öffne diese Seite auf deinem Handy.`,
        `iPhone: „Teilen“ → „Zum Home-Bildschirm“. Android: Menü ⋮ → „App installieren“.`
      ];
    }

    const overlay = document.createElement("div");
    overlay.className = "anleitung-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="anleitung panel-pergament">
        <div class="anleitung-symbol"><img src="assets/icon-180.png" alt="" width="64" height="64"></div>
        <h2>${esc(titel)}</h2>
        <ol class="anleitung-schritte">${schritte.map(s => `<li>${s}</li>`).join("")}</ol>
        ${nachsatz}
        <button class="btn btn-gold" data-anl-ok>Verstanden</button>
      </div>`;
    document.body.appendChild(overlay);
    const seit = performance.now();
    const zu = () => {
      if (performance.now() - seit < 350) return; // der öffnende Tipp darf nicht gleich schließen
      overlay.remove();
    };
    overlay.querySelector("[data-anl-ok]").addEventListener("click", zu);
    overlay.addEventListener("click", e => { if (e.target === overlay) zu(); });
  }

  /* ---------- Karte auf der Startseite ---------- */
  function karteHTML() {
    if (!hinweisSinnvoll() || (window.Store && window.Store.get().installHinweisAus)) return "";
    const android = plattform() === "android";
    return `<div class="install-karte" id="install-karte">
      <div class="install-text">
        <strong>📲 Hol dir die Wolke als App</strong>
        <span>${android ? "Eigenes Symbol, ohne Adressleiste — ein Tipp genügt." : "Auf den Home-Bildschirm: ganzer Bildschirm, schneller Start."}</span>
      </div>
      <button class="btn btn-gold install-los" data-install-los>${android && installEreignis ? "Installieren" : "Zeig mir wie"}</button>
      <button class="install-zu" data-install-zu aria-label="Hinweis ausblenden">✕</button>
    </div>`;
  }

  function verdrahteKarte(wurzel) {
    const los = wurzel.querySelector("[data-install-los]");
    if (los) los.addEventListener("click", installieren);
    const zu = wurzel.querySelector("[data-install-zu]");
    if (zu) zu.addEventListener("click", () => {
      window.Store.setInstallHinweisAus(true);
      const k = document.getElementById("install-karte");
      if (k) k.remove();
      window.App.toast("Okay! Du findest das später unter „Mehr“.");
    });
  }

  /* Knopf-Beschriftung nachziehen, wenn Android das Install-Ereignis erst später schickt */
  beobachter.push(() => {
    const los = document.querySelector("[data-install-los]");
    if (los) los.textContent = (plattform() === "android" && installEreignis) ? "Installieren" : "Zeig mir wie";
    const k = document.getElementById("install-karte");
    if (k && imStandalone()) k.remove();
  });

  window.Installieren = { plattform, imStandalone, hinweisSinnvoll, installieren, zeigeAnleitung, karteHTML, verdrahteKarte, kannDirekt: () => !!installEreignis };

  /* ---------- Spielstand mitnehmen: kurzer Code ----------
     Pro Figur 3 Bit (gesammelt, Goldglanz, echter Besuch), in der Reihenfolge von
     figuren.json → Crockford-Base32 + 1 Prüfzeichen, vorne "W1" (Version).
     18 Figuren = 11 Zeichen, 26 Figuren = 16 Zeichen. Neue Figuren werden in
     figuren.json immer HINTEN angehängt — dann bleiben ältere, kürzere Codes gültig.
     Bewusst NICHT enthalten: Name und private Notizen. */
  const ZEICHEN = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

  function pruefzeichen(s) {
    let summe = 0;
    for (let i = 0; i < s.length; i++) summe = (summe + ZEICHEN.indexOf(s[i]) * (i + 1)) % 32;
    return ZEICHEN[summe];
  }

  function erzeugeCode() {
    const figuren = window.Daten.figuren;
    const bits = [];
    figuren.forEach(f => {
      const g = window.Store.get().gesammelt[f.id];
      bits.push(g ? 1 : 0, g && g.glanz ? 1 : 0, g && g.verifikation !== "demo" ? 1 : 0);
    });
    while (bits.length % 5) bits.push(0);
    let daten = "";
    for (let i = 0; i < bits.length; i += 5) {
      daten += ZEICHEN[(bits[i] << 4) | (bits[i + 1] << 3) | (bits[i + 2] << 2) | (bits[i + 3] << 1) | bits[i + 4]];
    }
    const roh = "W1" + daten + pruefzeichen(daten);
    return roh.match(/.{1,4}/g).join("-");
  }

  function leseCode(text) {
    // Crockford: O→0, I/L→1, Leerzeichen und Striche egal
    const s = String(text || "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
    if (!s.startsWith("W1")) return null;
    const daten = s.slice(2, -1), pruef = s.slice(-1);
    // Wie viele Figuren stecken im Code? Ältere Codes kennen nur die ersten Figuren.
    const anzahl = Math.min(window.Daten.figuren.length, Math.floor(daten.length * 5 / 3));
    if (!daten.length || daten.length !== Math.ceil(anzahl * 3 / 5) || pruefzeichen(daten) !== pruef) return null;
    const bits = [];
    for (const z of daten) {
      const v = ZEICHEN.indexOf(z);
      if (v < 0) return null;
      for (let b = 4; b >= 0; b--) bits.push((v >> b) & 1);
    }
    return window.Daten.figuren.slice(0, anzahl).map((f, i) => ({ id: f.id, gesammelt: !!bits[i * 3], glanz: !!bits[i * 3 + 1], echt: !!bits[i * 3 + 2] }));
  }

  function uebernehmen(text) {
    const eintraege = leseCode(text);
    if (!eintraege) return { ok: false };
    let neu = 0;
    eintraege.forEach(e => {
      if (!e.gesammelt) return;
      if (!window.Store.istGesammelt(e.id)) neu++;
      window.Store.sammle(e.id, e.echt ? "uebertragen" : "demo", e.glanz);
    });
    // Siegel und schon erreichte Meilensteine nachziehen (ohne Popup-Flut)
    window.Daten.orte.forEach(o => {
      const alle = window.Daten.figuren.filter(f => f.ortId === o.id);
      if (alle.length && alle.every(f => window.Store.istGesammelt(f.id))) {
        window.Store.setzeSiegel(o.id);
        window.Store.markiereGelesen("meilenstein-ort-" + o.id);
      }
    });
    const n = window.Store.anzahlGesammelt();
    (window.Daten.config.rahmen.meilensteine || []).forEach(m => {
      if ((m.bei && n >= m.bei) || (m.beiAllen && n >= window.Daten.figuren.length)) window.Store.markiereGelesen(m.id);
    });
    return { ok: true, neu, gesamt: n };
  }

  window.Spielstand = { erzeugeCode, leseCode, uebernehmen };
})();
