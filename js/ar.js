/* Wolke der Zeugen — AR-Begegnung: suchen, finden, Geste, Bibelwort.
   Jede Begegnung beginnt hier: Die Handy-Kamera läuft als Live-Hintergrund,
   die Lichtgestalt steht über den Lagesensor fest an einer Stelle im Raum —
   seitlich, hinter dir, oben im Baum oder unten am Straßenrand. Hat man sie
   gefunden und angetippt, lädt sie zu einer Glaubensgeste ein (js/gesten.js).
   Danach steht ihr Bibelwort da, und das Gespräch beginnt.

   Bewusst OHNE WebXR/Raum-Tracking: zuverlässig auf allen Handy-Browsern.
   Rückfälle, damit niemand hängen bleibt:
   - kein Lagesensor / Erlaubnis verweigert / Querformat → Gestalt steht mittig
   - keine Kamera / abgelehnt / in den Einstellungen aus → Sternenhimmel
   - jede Geste hat eine Variante ohne Sensor; "Überspringen" nach 20 s
   - "Ich finde niemanden" holt die Gestalt nach 25 s in die Mitte

   Datenschutz: Kamerabild und Bewegungsdaten bleiben ausschließlich auf dem
   Gerät. Nichts wird aufgenommen, gespeichert oder übertragen. Kamera und
   Sensoren werden beim Verlassen der Ansicht sofort gestoppt. */
(function () {
  const SICHTFELD_H = 60;   // angenommenes horizontales Kamera-Sichtfeld (Hochformat), Grad
  const SICHTFELD_V = 75;   // vertikal
  const HOEHE_ANKER = 0.42; // Bildschirmhöhe, auf der der "Horizont" der Gestalt liegt

  const SUCHTEXTE = {
    seite: "👀 Irgendwo hier ist jemand … Schau dich langsam um!",
    hinten: "👀 Jemand steht hinter dir … Dreh dich um!",
    oben: "👀 Schau mal nach oben …",
    unten: "👀 Schau mal nach unten …"
  };

  let stream = null;
  let figur = null;
  let optionen = {};
  let zustand = "aus";       // laedt · suchen · gefunden · gegruesst · geste · erfuellt
  let anker = null;          // Weltrichtung der Gestalt { alpha, beta }
  let glatt = null;          // geglättete Handy-Ausrichtung
  let verankert = false;
  let fundSeit = 0;
  let erlebt = false;        // Geste vollständig gemacht?
  let kameraHierAus = false; // Kita, Hort, Seniorenzentrum: Sternenhimmel statt Kamerabild
  let laufendeGeste = null;
  let timer = [];
  let letztesX = null, letztesY = null;
  const orientierungsHoerer = new Set();
  const bewegungsHoerer = new Set();

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  const $ = id => document.getElementById(id);

  function winkelDiff(a, b) {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  function vibriere(muster) {
    try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(muster); } catch (e) { /* iOS kann das nicht — egal */ }
  }

  function arDaten() {
    return figur.ar || { suche: "seite", geste: null, einladung: "Hey {name}! Schön, dass du mich gefunden hast. Ich bin " + figur.name + ".", erfuellt: figur.kartenspruch, bibelstelle: "" };
  }

  /* iOS verlangt ausdrückliche Erlaubnisse — sie müssen direkt im Tipp angefragt
     werden. Deshalb beide Anfragen sofort, ohne vorher etwas abzuwarten. */
  function sensorErlaubnisse() {
    const DOE = window.DeviceOrientationEvent, DME = window.DeviceMotionEvent;
    const frage = (K) => (K && typeof K.requestPermission === "function")
      ? K.requestPermission().then(r => r === "granted").catch(() => false)
      : Promise.resolve(!!K);
    return Promise.all([frage(DOE), frage(DME)]);
  }

  function aufraeumen() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    window.removeEventListener("deviceorientation", onOrientierung);
    window.removeEventListener("devicemotion", onBewegung);
    timer.forEach(t => { clearTimeout(t); clearInterval(t); });
    timer = [];
    if (laufendeGeste) { laufendeGeste.stop(); laufendeGeste = null; }
    orientierungsHoerer.clear();
    bewegungsHoerer.clear();
    zustand = "aus";
  }

  async function oeffne(f, opts) {
    aufraeumen();
    figur = f;
    optionen = opts || {};
    anker = null; glatt = null; verankert = false;
    fundSeit = 0; erlebt = false;
    letztesX = null; letztesY = null;

    const view = $("view-ar");
    window.App.zeigeView("ar");
    zustand = "laedt";
    render(view, "laedt");

    const erlaubnis = sensorErlaubnisse(); // noch im Tipp anfragen
    const [orientierungOk, bewegungOk] = await erlaubnis;

    // An Kitas, Hort und Seniorenzentrum bleibt die Kamera aus (orte.json → kameraAus)
    const ort = window.Daten.orte.find(o => o.id === f.ortId);
    kameraHierAus = !!(ort && ort.kameraAus);
    let modus = "sterne";
    if (!window.Store.get().kameraAus && !kameraHierAus) {
      modus = "fallback";
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
          modus = "kamera";
        } catch (e) { modus = "fallback"; } // abgelehnt, keine Kamera, kein Secure Context
      }
    }
    // Wurde die Ansicht inzwischen verlassen? Dann Kamera gleich wieder aus.
    if (!$("view-ar").classList.contains("aktiv") || zustand !== "laedt") { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } return; }

    render(view, modus);
    if (modus === "kamera") {
      const v = $("ar-video");
      if (v) {
        v.srcObject = stream;
        v.setAttribute("playsinline", "");
        try { await v.play(); } catch (e) { /* Autoplay-Sperre — Bild bleibt trotzdem */ }
      }
    }

    setzeZustand("suchen");
    setzeStatus(arDaten().suchText || SUCHTEXTE[arDaten().suche] || SUCHTEXTE.seite);
    if (orientierungOk) window.addEventListener("deviceorientation", onOrientierung);
    if (bewegungOk) window.addEventListener("devicemotion", onBewegung);

    // Kommen keine Lagedaten (Desktop, Sensor fehlt, verweigert): Gestalt steht mittig
    timer.push(setTimeout(() => {
      if (!verankert && zustand === "suchen") {
        setzeStatus("✨ Da erscheint jemand …");
        timer.push(setTimeout(finde, 700));
      }
    }, 1500));
    // Wer nach 25 s noch sucht, bekommt Hilfe
    timer.push(setTimeout(() => {
      if (zustand === "suchen") zeigeHilfe("Ich finde niemanden — hilf mir", () => { verankert = false; setzePosition(0, 0); finde(); });
    }, 25000));
  }

  /* ---------- Sensoren ---------- */
  function onOrientierung(e) {
    if (e.alpha === null || e.beta === null || e.alpha === undefined) return;
    if (window.innerWidth > window.innerHeight) return; // Querformat: nicht verankern
    if (!glatt) {
      glatt = { alpha: e.alpha, beta: e.beta };
    } else {
      glatt.alpha = (glatt.alpha + winkelDiff(e.alpha, glatt.alpha) * 0.25 + 360) % 360;
      glatt.beta = glatt.beta + (e.beta - glatt.beta) * 0.25;
    }
    if (!anker && zustand === "suchen") {
      const seite = Math.random() < 0.5 ? -1 : 1;
      const horizont = Math.min(100, Math.max(65, glatt.beta));
      const art = arDaten().suche;
      // Wo steht die Gestalt? Seitlich, hinter dir, oben im Baum oder unten am Rand
      if (art === "hinten") anker = { alpha: glatt.alpha + 180 + seite * (5 + Math.random() * 15), beta: horizont };
      else if (art === "oben") anker = { alpha: glatt.alpha + seite * (10 + Math.random() * 20), beta: 125 };
      else if (art === "unten") anker = { alpha: glatt.alpha + seite * (10 + Math.random() * 20), beta: 52 };
      else anker = { alpha: glatt.alpha + seite * (35 + Math.random() * 30), beta: horizont };
      anker.alpha = (anker.alpha + 360) % 360;
      verankert = true;
    }
    const p = bildPosition();
    setzePosition(p.x, p.y);
    if (zustand === "suchen" || zustand === "gefunden") aktualisiereRichtung(p.x, p.y);
    if (zustand === "suchen") pruefeFund(p.x, p.y);
    orientierungsHoerer.forEach(fn => { try { fn(); } catch (x) {} });
  }

  function onBewegung(e) {
    bewegungsHoerer.forEach(fn => { try { fn(e); } catch (x) {} });
  }

  /* Bildschirm-Versatz (px) eines Punkts in Weltrichtung (alpha, beta) gegenüber der Mitte:
     Dreht man das Handy nach links, wandert er nach rechts; kippt man es hoch, wandert er nach unten. */
  function zuBild(alpha, beta) {
    if (!glatt) return { x: 0, y: 0 };
    const w = window.innerWidth, h = window.innerHeight;
    return {
      x: winkelDiff(glatt.alpha, alpha) * (w / SICHTFELD_H),
      y: (glatt.beta - beta) * (h / SICHTFELD_V)
    };
  }

  function bildPosition() {
    if (!(verankert && anker && glatt)) return { x: 0, y: 0 };
    const p = zuBild(anker.alpha, anker.beta);
    const h = window.innerHeight;
    return { x: p.x, y: Math.max(-h, Math.min(h, p.y)) };
  }

  /* Nur transform ändern (läuft auf der Grafikkarte, kein Layout) */
  function setzePosition(x, y) {
    const el = $("ar-gestalt-pos");
    if (!el) return;
    if (letztesX === null || Math.abs(x - letztesX) > 0.5 || Math.abs(y - letztesY) > 0.5) {
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      letztesX = x; letztesY = y;
    }
  }

  function aktualisiereRichtung(x, y) {
    const pfeil = $("ar-richtung");
    if (!pfeil) return;
    const w = window.innerWidth, h = window.innerHeight;
    let text = "";
    if (Math.abs(x) > w * 0.42) text = x < 0 ? "← Dreh dich nach links" : "Dreh dich nach rechts →";
    else if (y < -h * 0.38) text = "↑ Schau nach oben";
    else if (y > h * 0.3) text = "↓ Schau nach unten";
    if (pfeil.textContent !== text) {
      pfeil.textContent = text;
      pfeil.classList.toggle("sichtbar", !!text);
    }
  }

  function pruefeFund(x, y) {
    if (!verankert) return;
    const w = window.innerWidth, h = window.innerHeight;
    const mittig = Math.abs(x) < w * 0.2 && y > -h * 0.28 && y < h * 0.2;
    const jetzt = performance.now();
    if (mittig) {
      if (!fundSeit) fundSeit = jetzt;
      if (jetzt - fundSeit > 250) finde();
    } else {
      fundSeit = 0;
    }
  }

  /* ---------- Ablauf ---------- */
  function setzeZustand(z) {
    zustand = z;
    const b = document.querySelector("#view-ar .ar-buehne");
    if (b) b.dataset.zustand = z;
    // Der Richtungspfeil gehört nur zur Suche
    if (z !== "suchen" && z !== "gefunden") {
      const pfeil = $("ar-richtung");
      if (pfeil) { pfeil.textContent = ""; pfeil.classList.remove("sichtbar"); }
    }
  }

  function setzeStatus(text) {
    const el = $("ar-status");
    if (el && el.textContent !== text) el.textContent = text;
  }

  function zeigeHilfe(text, aktion) {
    const el = $("ar-hilfe");
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    el.onclick = () => { el.hidden = true; aktion(); };
  }
  function versteckeHilfe() { const el = $("ar-hilfe"); if (el) el.hidden = true; }

  function hauptknopf(text, gold, aktion) {
    const b = $("ar-haupt");
    if (!b) return;
    if (!text) { b.hidden = true; return; }
    b.hidden = false;
    b.textContent = text;
    b.classList.toggle("btn-gold", !!gold);
    b.classList.toggle("btn-sekundaer", !gold);
    b.onclick = aktion;
  }

  function fortschritt(wert, beschriftung) {
    const box = $("ar-fortschritt");
    if (!box) return;
    box.hidden = false;
    box.querySelector(".ar-fortschritt-wert").style.width = Math.round(Math.max(0, Math.min(1, wert)) * 100) + "%";
    box.querySelector(".ar-fortschritt-text").textContent = beschriftung || "";
  }

  function blase(text) {
    const el = $("ar-blase");
    if (!el) return;
    if (!text) { el.classList.remove("sichtbar"); return; }
    el.textContent = text;
    el.classList.add("sichtbar");
  }

  function finde() {
    if (zustand !== "suchen") return;
    setzeZustand("gefunden");
    versteckeHilfe();
    const pfeil = $("ar-richtung");
    if (pfeil) { pfeil.textContent = ""; pfeil.classList.remove("sichtbar"); }
    const buehne = document.querySelector("#view-ar .ar-buehne");
    if (buehne) buehne.classList.add("gefunden");
    setzeStatus(`✨ Du hast ${figur.name} gefunden! Tipp die Gestalt an.`);
    hauptknopf("👋 Hallo sagen", false, gruesse);
    vibriere([40, 60, 90]);
  }

  function gruesse() {
    if (zustand !== "gefunden") return;
    setzeZustand("gegruesst");
    const d = arDaten();
    const name = window.Store.get().name || "du";
    blase(d.einladung.replace("{name}", name));
    huepfen();
    vibriere(30);
    setzeStatus("");
    // Zachäus steigt vom Baum herunter
    if (d.suche === "oben" && verankert && glatt) senkeAnkerAb();
    if (d.geste) hauptknopf("✨ Los geht's", true, starteGeste);
    else hauptknopf("📖 Weiter", true, erfuellt);
  }

  function senkeAnkerAb() {
    const ziel = Math.min(100, Math.max(65, glatt.beta));
    const startBeta = anker.beta, dauer = 1400, t0 = performance.now();
    const t = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / dauer);
      anker.beta = startBeta + (ziel - startBeta) * (1 - Math.pow(1 - k, 3));
      const p = bildPosition();
      setzePosition(p.x, p.y);
      if (k >= 1) clearInterval(t);
    }, 30);
    timer.push(t);
  }

  /* Nach der Geste (oft schaut man dabei nach oben, unten oder zur Seite)
     kommt die Gestalt sanft dorthin, wohin man gerade blickt — zum Bibelwort ist sie bei dir. */
  function holeHeran() {
    if (!(verankert && anker && glatt)) return;
    const start = { alpha: anker.alpha, beta: anker.beta }, dauer = 1100, t0 = performance.now();
    const t = setInterval(() => {
      if (!glatt) { clearInterval(t); return; }
      const k = 1 - Math.pow(1 - Math.min(1, (performance.now() - t0) / dauer), 3);
      anker.alpha = (start.alpha + winkelDiff(glatt.alpha, start.alpha) * k + 360) % 360;
      anker.beta = start.beta + (glatt.beta - start.beta) * k;
      const p = bildPosition();
      setzePosition(p.x, p.y);
      if (k >= 1) clearInterval(t);
    }, 30);
    timer.push(t);
  }

  function huepfen() {
    const g = $("ar-gestalt");
    if (!g) return;
    g.classList.remove("huepft"); void g.offsetWidth; g.classList.add("huepft");
  }

  function starteGeste() {
    if (zustand !== "gegruesst") return;
    setzeZustand("geste");
    const d = arDaten();
    blase("");
    hauptknopf(null);
    setzeStatus(d.auftrag || "");
    const buehne = document.querySelector("#view-ar .ar-buehne");
    const ctx = {
      ebene: $("ar-geste-ebene"),
      figurPos: $("ar-gestalt-pos"),
      buehne,
      verankert: () => verankert,
      richtung: () => (glatt ? { alpha: glatt.alpha, beta: glatt.beta } : null),
      zuBild,
      aufOrientierung(fn) { orientierungsHoerer.add(fn); return () => orientierungsHoerer.delete(fn); },
      aufBewegung(fn) { bewegungsHoerer.add(fn); return () => bewegungsHoerer.delete(fn); },
      status: setzeStatus,
      fortschritt,
      vibriere,
      fertig: () => { erlebt = true; timer.push(setTimeout(erfuellt, 700)); }
    };
    laufendeGeste = window.Gesten.starte(d.geste, ctx);
    // Geht gerade nicht (Bewegungseinschränkung, im Bus …)? Nach 20 s darf man überspringen.
    timer.push(setTimeout(() => {
      if (zustand === "geste") zeigeHilfe("Geht gerade nicht? Überspringen", () => erfuellt());
    }, 20000));
  }

  function erfuellt() {
    if (zustand === "erfuellt" || zustand === "aus") return;
    if (laufendeGeste) laufendeGeste.stop(); // Bedienelemente der Geste weg, Enthülltes bleibt
    laufendeGeste = null;
    setzeZustand("erfuellt");
    versteckeHilfe();
    blase("");
    const fort = $("ar-fortschritt");
    if (fort) fort.hidden = true;
    const d = arDaten();
    const vers = $("ar-vers");
    if (vers) {
      vers.innerHTML = `<p>${esc(d.erfuellt)}</p>${d.bibelstelle ? `<span class="ar-vers-stelle">${esc(d.bibelstelle)}</span>` : ""}`;
      vers.hidden = false;
    }
    holeHeran();
    huepfen();
    setzeStatus(erlebt ? "✨ Geschafft!" : "");
    hauptknopf(optionen.replay ? `💬 Nochmal mit ${figur.name} reden` : `💬 ${figur.name} ansprechen`, true, ansprechen);
    if (erlebt) vibriere([30, 50, 120]);
  }

  function tippeGestalt() {
    if (zustand === "suchen") { finde(); return; }
    if (zustand === "gefunden") { gruesse(); return; }
    if (zustand === "gegruesst") { huepfen(); return; }
    if (zustand === "erfuellt") { ansprechen(); }
  }

  function verlasse(ziel) {
    aufraeumen();
    window.App.zeigeView(ziel || optionen.zurueck || "ort");
  }

  function ansprechen() {
    const warErlebt = erlebt;
    aufraeumen();
    window.Encounter.start(figur, { replay: !!optionen.replay, erlebt: warErlebt });
  }

  /* ---------- Darstellung ---------- */
  function render(view, modus) {
    const laden = modus === "laedt";
    const hintergrund = modus === "kamera"
      ? `<video id="ar-video" autoplay muted playsinline></video>`
      : `<div class="ar-sternenhimmel"></div>`;
    const fallbackHinweis = modus === "fallback"
      ? `<div class="ar-hinweis">📷 Ohne Kamerabild — ${esc(figur.name)} ist trotzdem da.</div>`
      : (modus === "sterne" && kameraHierAus)
        ? `<div class="ar-hinweis">🌙 An diesem Ort bleibt die Kamera aus. ${esc(figur.name)} ist trotzdem da.</div>`
        : "";

    view.innerHTML = `
      <div class="ar-buehne ${modus}">
        ${hintergrund}
        <div class="ar-welt" aria-hidden="${laden}">
          ${laden ? "" : `
            <div class="ar-gestalt-anker">
              <div id="ar-gestalt-pos" class="ar-gestalt-pos">
                <div id="ar-blase" class="ar-blase" role="status"></div>
                <button id="ar-gestalt" class="ar-gestalt" aria-label="${esc(figur.name)} antippen">
                  ${window.Gestalt.svg(figur, { praefix: "ar" })}
                </button>
                <div class="ar-funken" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<span style="--i:${i}"></span>`).join("")}</div>
              </div>
            </div>`}
        </div>
        <div id="ar-geste-ebene" class="ar-geste-ebene"></div>
        <div class="ar-overlay">
          <button class="ar-schliessen" id="ar-close" aria-label="Schließen">✕</button>
          <div class="ar-kopf">
            <span class="ar-badge">${modus === "kamera" ? "📷 AR" : "✨"}</span>
            <div id="ar-status" class="ar-status" aria-live="polite">${laden ? "Kamera wird geöffnet …" : ""}</div>
            <div id="ar-richtung" class="ar-richtung" aria-live="polite"></div>
          </div>
          ${laden ? "" : `
            <div class="ar-fuss">
              <div class="ar-name-tafel">
                <div class="ar-name">${esc(figur.name)}</div>
                <div class="ar-beiname">${esc(figur.beiname)}</div>
              </div>
              <div id="ar-vers" class="ar-vers" hidden></div>
              <div id="ar-fortschritt" class="ar-fortschritt" hidden>
                <div class="ar-fortschritt-balken"><div class="ar-fortschritt-wert"></div></div>
                <span class="ar-fortschritt-text"></span>
              </div>
              ${fallbackHinweis}
              <button class="btn btn-gold" id="ar-haupt" hidden></button>
              <button class="ar-textlink" id="ar-hilfe" hidden></button>
              <button class="ar-textlink" id="ar-zurueck">Zurück</button>
              <p class="ar-datenschutz">🔒 Kamerabild und Bewegung bleiben auf deinem Gerät — nichts wird aufgenommen oder verschickt.</p>
            </div>`}
        </div>
      </div>`;

    const close = $("ar-close");
    if (close) close.addEventListener("click", () => verlasse());
    const zurueck = $("ar-zurueck");
    if (zurueck) zurueck.addEventListener("click", () => verlasse());
    const gestalt = $("ar-gestalt");
    if (gestalt) gestalt.addEventListener("click", tippeGestalt);
  }

  window.AR = { oeffne, verlasse, stoppe: aufraeumen };
})();
