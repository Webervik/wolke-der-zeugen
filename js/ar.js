/* Wolke der Zeugen — AR-Ansicht: "Such die Gestalt!"
   Die Handy-Kamera läuft als Live-Hintergrund. Über den Lagesensor des Handys
   (deviceorientation) bleibt die Lichtgestalt an einer festen Stelle im Raum
   stehen: Sie erscheint seitlich versetzt, man muss sich umschauen, sie finden
   und antippen. Bewusst OHNE WebXR/Raum-Tracking: Das hält es zuverlässig auf
   allen Handy-Browsern und akkuschonend.

   Rückfalle, damit niemand hängen bleibt:
   - kein Lagesensor / Erlaubnis verweigert / Querformat → Gestalt steht mittig
   - keine Kamera / Erlaubnis verweigert → Sternenhimmel statt Live-Bild
   - der Button "… ansprechen" ist immer da

   Datenschutz: Kamerabild und Lagedaten bleiben ausschließlich auf dem Gerät.
   Nichts wird aufgenommen, gespeichert oder übertragen. Kamera und Sensor
   werden beim Verlassen der Ansicht sofort gestoppt. */
(function () {
  const SICHTFELD_H = 60;   // angenommenes horizontales Kamera-Sichtfeld (Hochformat), Grad
  const SICHTFELD_V = 75;   // vertikal

  let stream = null;
  let figur = null;
  let zurueckView = "ort";
  let anker = null;          // Weltrichtung der Gestalt { alpha, beta }
  let glatt = null;          // geglättete Handy-Ausrichtung
  let verankert = false;
  let gefunden = false;
  let gegruesst = false;
  let fundSeit = 0;
  let rueckfallTimer = null;
  let letztesX = null, letztesY = null;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function unterstuetzt() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function winkelDiff(a, b) {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  function vibriere(muster) {
    try { if (navigator.vibrate) navigator.vibrate(muster); } catch (e) { /* iOS kann das nicht — egal */ }
  }

  /* iOS verlangt eine ausdrückliche Erlaubnis — muss direkt im Tipp passieren. */
  async function bewegungErlauben() {
    const DOE = window.DeviceOrientationEvent;
    if (!DOE) return false;
    if (typeof DOE.requestPermission === "function") {
      try { return (await DOE.requestPermission()) === "granted"; } catch (e) { return false; }
    }
    return true;
  }

  function aufraeumen() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    window.removeEventListener("deviceorientation", onOrientierung);
    clearTimeout(rueckfallTimer);
  }

  async function oeffne(f, opts) {
    opts = opts || {};
    aufraeumen();
    figur = f;
    zurueckView = opts.zurueck || "ort";
    anker = null; glatt = null; verankert = false;
    gefunden = false; gegruesst = false; fundSeit = 0;
    letztesX = null; letztesY = null;

    const view = document.getElementById("view-ar");
    window.App.zeigeView("ar");
    render(view, "laedt");

    // Reihenfolge wichtig: Bewegungs-Erlaubnis zuerst (braucht den Tipp), dann Kamera
    const bewegungOk = await bewegungErlauben();

    let modus = "fallback";
    if (unterstuetzt()) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false
        });
        modus = "kamera";
      } catch (e) {
        modus = "fallback"; // abgelehnt, keine Kamera, kein Secure Context → Sternenhimmel
      }
    }
    // Wurde die Ansicht inzwischen verlassen? Dann Kamera gleich wieder aus.
    if (!document.getElementById("view-ar").classList.contains("aktiv")) { aufraeumen(); return; }

    render(view, modus);
    if (modus === "kamera") {
      const v = view.querySelector("#ar-video");
      if (v) {
        v.srcObject = stream;
        v.setAttribute("playsinline", "");
        try { await v.play(); } catch (e) { /* Autoplay-Sperre — Bild bleibt trotzdem */ }
      }
    }

    if (bewegungOk) window.addEventListener("deviceorientation", onOrientierung);
    // Kommen keine Lagedaten (Desktop, Sensor fehlt, verweigert): Gestalt steht mittig
    rueckfallTimer = setTimeout(() => {
      if (!verankert) {
        setzeStatus("mittig");
        setTimeout(finde, 700);
      }
    }, 1500);
  }

  function onOrientierung(e) {
    if (e.alpha === null || e.beta === null || e.alpha === undefined) return;
    if (window.innerWidth > window.innerHeight) return; // Querformat: nicht verankern
    if (!glatt) {
      glatt = { alpha: e.alpha, beta: e.beta };
    } else {
      glatt.alpha = (glatt.alpha + winkelDiff(e.alpha, glatt.alpha) * 0.25 + 360) % 360;
      glatt.beta = glatt.beta + (e.beta - glatt.beta) * 0.25;
    }
    if (!anker) {
      // Die Gestalt steht 35–65° seitlich — man muss sich erst umschauen
      const seite = Math.random() < 0.5 ? -1 : 1;
      anker = {
        alpha: (glatt.alpha + seite * (35 + Math.random() * 30) + 360) % 360,
        beta: Math.min(100, Math.max(65, glatt.beta))
      };
      verankert = true;
      clearTimeout(rueckfallTimer);
      if (!gefunden) setzeStatus("suchen");
    }
    // Richtungspfeil und Fund-Erkennung hängen am Sensor, nicht an der Bildrate
    // (die im Stromsparmodus gedrosselt sein kann)
    const p = bildPosition();
    setzePosition(p.x, p.y);
    aktualisiereRichtung(p.x);
    pruefeFund(p.x, p.y);
  }

  /* Nur transform ändern (läuft auf der Grafikkarte, kein Layout) */
  function setzePosition(x, y) {
    const el = document.getElementById("ar-gestalt-pos");
    if (!el) return;
    if (letztesX === null || Math.abs(x - letztesX) > 0.5 || Math.abs(y - letztesY) > 0.5) {
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      letztesX = x; letztesY = y;
    }
  }

  /* Weltfeste Position der Gestalt auf dem Bildschirm (px relativ zur Mitte):
     Dreht man das Handy nach links, wandert die Gestalt nach rechts. */
  function bildPosition() {
    if (!(verankert && anker && glatt)) return { x: 0, y: 0 };
    const w = window.innerWidth, h = window.innerHeight;
    return {
      x: winkelDiff(glatt.alpha, anker.alpha) * (w / SICHTFELD_H),
      y: Math.max(-h * 0.35, Math.min(h * 0.35, (glatt.beta - anker.beta) * (h / SICHTFELD_V)))
    };
  }

  function aktualisiereRichtung(x) {
    const pfeil = document.getElementById("ar-richtung");
    if (!pfeil) return;
    const aussen = Math.abs(x) > window.innerWidth * 0.42;
    const text = !aussen ? "" : (x < 0 ? "← Dreh dich nach links" : "Dreh dich nach rechts →");
    if (pfeil.textContent !== text) {
      pfeil.textContent = text;
      pfeil.classList.toggle("sichtbar", !!text);
    }
  }

  function pruefeFund(x, y) {
    if (gefunden || !verankert) return;
    const mittig = Math.abs(x) < window.innerWidth * 0.2 && Math.abs(y) < window.innerHeight * 0.25;
    const jetzt = performance.now();
    if (mittig) {
      if (!fundSeit) fundSeit = jetzt;
      if (jetzt - fundSeit > 250) finde();
    } else {
      fundSeit = 0;
    }
  }

  function setzeStatus(art) {
    const el = document.getElementById("ar-status");
    if (!el) return;
    const name = esc(figur.name);
    const texte = {
      laedt: "Kamera wird geöffnet …",
      suchen: "👀 Irgendwo hier ist jemand … Schau dich langsam um!",
      mittig: "✨ Da erscheint jemand …",
      gefunden: `✨ Du hast ${name} gefunden! Tipp die Gestalt an.`,
      gegruesst: "" // jetzt spricht die Sprechblase
    };
    el.innerHTML = texte[art] || "";
  }

  function finde() {
    if (gefunden) return;
    gefunden = true;
    const buehne = document.querySelector("#view-ar .ar-buehne");
    if (buehne) buehne.classList.add("gefunden");
    const btn = document.getElementById("ar-ansprechen");
    if (btn) { btn.classList.remove("btn-sekundaer"); btn.classList.add("btn-gold"); }
    setzeStatus("gefunden");
    vibriere([40, 60, 90]);
  }

  function gruesse() {
    gegruesst = true;
    const blase = document.getElementById("ar-blase");
    const name = window.Store.get().name;
    if (blase) {
      blase.textContent = `${name ? "Hey " + name + "! " : "Hey! "}Schön, dass du mich gefunden hast. Ich bin ${figur.name} — ${figur.beiname}. Magst du kurz mit mir reden?`;
      blase.classList.add("sichtbar");
    }
    const gestalt = document.getElementById("ar-gestalt");
    if (gestalt) {
      gestalt.classList.remove("huepft");
      void gestalt.offsetWidth; // Animation neu starten
      gestalt.classList.add("huepft");
    }
    setzeStatus("gegruesst");
    vibriere(30);
  }

  function tippeGestalt() {
    if (!gefunden) { finde(); return; }
    if (!gegruesst) { gruesse(); return; }
    ansprechen();
  }

  function verlasse(ziel) {
    aufraeumen();
    window.App.zeigeView(ziel || zurueckView);
  }

  function ansprechen() {
    aufraeumen();
    window.Encounter.start(figur);
  }

  function render(view, modus) {
    const laden = modus === "laedt";
    const hintergrund = modus === "kamera"
      ? `<video id="ar-video" autoplay muted playsinline></video>`
      : `<div class="ar-sternenhimmel"></div>`;
    const fallbackHinweis = modus === "fallback"
      ? `<div class="ar-hinweis">📷 Ohne Kamerabild — ${esc(figur.name)} ist trotzdem da.</div>`
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
              ${fallbackHinweis}
              <button class="btn btn-sekundaer" id="ar-ansprechen">💬 ${esc(figur.name)} ansprechen</button>
              <button class="ar-textlink" id="ar-zurueck">Zurück ohne AR</button>
              <p class="ar-datenschutz">🔒 Kamerabild und Bewegung bleiben auf deinem Gerät — nichts wird aufgenommen oder verschickt. 📸 Tipp: Screenshot als Erinnerung!</p>
            </div>`}
        </div>
      </div>`;

    const close = view.querySelector("#ar-close");
    if (close) close.addEventListener("click", () => verlasse());
    const zurueck = view.querySelector("#ar-zurueck");
    if (zurueck) zurueck.addEventListener("click", () => verlasse());
    const ansprechenBtn = view.querySelector("#ar-ansprechen");
    if (ansprechenBtn) ansprechenBtn.addEventListener("click", ansprechen);
    const gestalt = view.querySelector("#ar-gestalt");
    if (gestalt) gestalt.addEventListener("click", tippeGestalt);
  }

  window.AR = { oeffne, verlasse, unterstuetzt, stoppe: aufraeumen };
})();
