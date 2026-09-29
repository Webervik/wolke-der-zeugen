/* Wolke der Zeugen — App-Kern: Initialisierung, Views, Onboarding, URL-Parameter. */
(function () {
  let aktuelleView = "home";
  let aktuellerOrt = null;
  let letzterOrtStatus = "";
  let hinweisSchluessel = "";
  let meilensteinWarteschlange = [];

  function formatDistanz(d) {
    return d >= 1000 ? `~${(d / 1000).toFixed(1)} km` : `~${Math.round(d / 10) * 10} m`;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---------- Init ---------- */
  async function init() {
    const [config, orte, figuren, hintergrund] = await Promise.all([
      fetch("data/config.json").then(r => r.json()),
      fetch("data/orte.json").then(r => r.json()),
      fetch("data/figuren.json").then(r => r.json()),
      // Kartenhintergrund ist optional — ohne ihn bleibt die Karte einfach schlichter
      fetch("data/karte-hintergrund.json").then(r => r.json()).catch(() => null)
    ]);
    window.Daten = { config, orte: orte.orte, figuren: figuren.figuren, hintergrund };

    const params = new URLSearchParams(location.search);
    window.Rotation.init(config, params.get("heute"));

    if (params.get("demo") === "1") window.Store.setDemo(true);

    // QR-Freischaltung: ?ort=<id>&k=<code> — gescannt mit der normalen Kamera-App
    const ortParam = params.get("ort"), code = params.get("k");
    let qrToast = null;
    if (ortParam && code) {
      const ort = window.Daten.orte.find(o => o.id === ortParam);
      if (ort && ort.qrCode === code) {
        window.Store.qrFreischalten(ort.id);
        qrToast = `📍 ${ort.name} ist für heute freigeschaltet!`;
      } else {
        qrToast = "Dieser Code passt zu keinem Ort. 🤔";
      }
    }

    // Event-/Rallye-Modus: ?event=<code>
    const eventCode = params.get("event");
    if (eventCode) {
      const ev = (config.eventCodes || []).find(e => e.code === eventCode);
      if (ev) {
        window.Store.aktiviereEvent();
        qrToast = qrToast || `🎉 ${ev.name} ist gestartet — heute sind alle Zeug:innen unterwegs!`;
      }
    }

    // URL aufräumen: keine Codes/Parameter in der Adresszeile stehen lassen
    if ([...params.keys()].length) {
      history.replaceState(null, "", location.pathname);
    }

    document.getElementById("app-laedt").hidden = true;

    verdrahteNav();
    // GPS-Fixes kommen beim Gehen alle 1–2 Sekunden. Sie dürfen nichts neu aufbauen,
    // was man gerade antippt oder ausfüllt (Karte, Code-Feld) — deshalb werden nur
    // Entfernungen und Hinweise an Ort und Stelle aktualisiert. Neu aufgebaut wird
    // nur, wenn sich ein Ort tatsächlich freischaltet oder wieder sperrt.
    window.Geo.onUpdate(() => {
      if (aktuelleView === "home") {
        window.Karte.aktualisiere(document.getElementById("karte-container"));
        aktualisiereHinweise();
      }
      if (aktuelleView === "ort" && aktuellerOrt) {
        const ort = window.Daten.orte.find(o => o.id === aktuellerOrt);
        const status = window.Geo.freischaltung(ort);
        if (status.frei + ":" + status.art !== letzterOrtStatus) renderOrt(aktuellerOrt);
        else aktualisiereOrtDistanz(ort, status);
      }
    });

    if (!window.Store.get().onboardingDone) {
      renderOnboarding();
      zeigeView("onboarding");
    } else {
      zeigeView("home");
    }
    if (qrToast) toast(qrToast);

    // Offline-Fähigkeit: Netz zuerst, bei schlechtem Empfang (z. B. am Waldhaus) aus dem Cache
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      navigator.serviceWorker.register("sw.js").catch(() => { /* ohne SW läuft alles wie bisher */ });
    }
  }

  /* ---------- View-Router ---------- */
  function zeigeView(name) {
    // Kamera/Lagesensor nie im Hintergrund weiterlaufen lassen
    if (name !== "ar" && window.AR) window.AR.stoppe();
    aktuelleView = name;
    document.querySelectorAll(".view").forEach(v => v.classList.remove("aktiv"));
    const view = document.getElementById("view-" + name);
    if (view) view.classList.add("aktiv");

    const nav = document.getElementById("nav");
    nav.hidden = (name === "onboarding" || name === "begegnung" || name === "ar");
    nav.querySelectorAll("[data-nav]").forEach(b => {
      b.classList.toggle("aktiv", b.getAttribute("data-nav") === name);
    });

    // GPS läuft nur, solange Karte oder Ort-Detail offen sind (Akku + Datensparsamkeit)
    if ((name === "home" || name === "ort") && window.Store.get().geoErlaubt) {
      window.Geo.start();
    } else if (name !== "home" && name !== "ort") {
      window.Geo.stop();
    }

    if (name === "home") renderHome();
    if (name === "ort" && aktuellerOrt) renderOrt(aktuellerOrt);
    if (name === "wolke") window.Wolke.renderAlbum(document.getElementById("view-wolke"));
    if (name === "einstellungen") renderEinstellungen();
    window.scrollTo(0, 0);
  }

  function verdrahteNav() {
    document.querySelectorAll("[data-nav]").forEach(b => {
      b.addEventListener("click", () => zeigeView(b.getAttribute("data-nav")));
    });
  }

  /* ---------- Onboarding ---------- */
  function renderOnboarding() {
    const c = window.Daten.config;
    const view = document.getElementById("view-onboarding");
    let schritt = 0;

    function render() {
      if (schritt === 0) {
        view.innerHTML = `
          <div class="onboarding">
            <div class="onboarding-wolke">☁️</div>
            <h1 class="app-titel">Wolke der Zeugen</h1>
            <div class="sendung panel-pergament">
              ${c.rahmen.sendung.map(z => `<p>${esc(z)}</p>`).join("")}
              <a class="link-tinte" href="${esc(c.rahmen.sendungBibellink)}" target="_blank" rel="noopener">📖 ${esc(c.rahmen.sendungBibelstelle)}</a>
            </div>
            <button class="btn btn-gold" id="ob-weiter">Ich geh los →</button>
          </div>`;
        view.querySelector("#ob-weiter").addEventListener("click", () => { schritt = 1; render(); });
      } else if (schritt === 1) {
        view.innerHTML = `
          <div class="onboarding">
            <h2>Wie dürfen die Zeug:innen dich nennen?</h2>
            <p class="dezent">Nur dein Vorname oder Spitzname — er bleibt auf deinem Gerät.</p>
            <input type="text" id="ob-name" maxlength="30" placeholder="Dein Vorname" autocomplete="off">
            <button class="btn btn-gold" id="ob-weiter" disabled>Weiter →</button>
          </div>`;
        const input = view.querySelector("#ob-name");
        const weiter = view.querySelector("#ob-weiter");
        input.addEventListener("input", () => { weiter.disabled = input.value.trim().length === 0; });
        weiter.addEventListener("click", () => {
          window.Store.setName(input.value);
          schritt = 2; render();
        });
        input.focus();
      } else {
        view.innerHTML = `
          <div class="onboarding">
            <h2>Kurz zum Datenschutz</h2>
            <div class="panel-nacht datenschutz-panel"><p>${esc(c.datenschutz.kurz)}</p></div>
            <p>Darf die App deinen Standort nutzen, damit Begegnungen automatisch starten, wenn du an einem Ort ankommst?</p>
            <button class="btn btn-gold" id="ob-geo-ja">📍 Ja, Standort nutzen</button>
            <button class="btn btn-sekundaer" id="ob-geo-nein">Lieber ohne — ich nutze die QR-Codes vor Ort</button>
            <p class="dezent">Beides ist völlig okay. Du kannst es jederzeit in den Einstellungen ändern.</p>
          </div>`;
        view.querySelector("#ob-geo-ja").addEventListener("click", () => fertig(true));
        view.querySelector("#ob-geo-nein").addEventListener("click", () => fertig(false));
      }
    }

    function fertig(geo) {
      window.Store.setGeoErlaubt(geo);
      window.Store.setOnboardingDone();
      zeigeView("home");
      toast(`Willkommen, ${window.Store.get().name}! ☁️`);
    }

    render();
  }

  /* ---------- Home: Karte + diese Woche ---------- */
  function renderHome() {
    const view = document.getElementById("view-home");
    const s = window.Store.get();
    const figuren = window.Daten.figuren;
    const n = window.Store.anzahlGesammelt();
    const eventAktiv = window.Store.istEventAktiv();
    const aktive = window.Rotation.aktiveFiguren();

    const getroffen = aktive.filter(f => window.Store.istGesammelt(f.id)).length;

    const chips = aktive.map(f => {
      const hat = window.Store.istGesammelt(f.id);
      const ort = window.Daten.orte.find(o => o.id === f.ortId);
      return `<button class="woche-chip${hat ? " hat" : ""}" data-figur-chip="${f.id}">
        <span class="woche-chip-gestalt">${window.Gestalt.svg(f, { praefix: "woche", unbekannt: !hat })}</span>
        <span class="woche-chip-text">
          <strong>${hat ? esc(f.name) + " ✓" : "Noch unbekannt"}</strong>
          <small>${esc(f.themaLabel)} · ${ort ? ort.icon : ""} ${esc(window.Karte.KURZNAMEN[f.ortId] || "")}</small>
        </span>
        <span class="woche-chip-pfeil" aria-hidden="true">›</span>
      </button>`;
    }).join("");

    view.innerHTML = `
      ${s.demo ? `<div class="demo-band">🧪 Demo-Modus — Begegnungen zählen als Probelauf</div>` : ""}
      ${eventAktiv ? `<div class="event-band">🎉 Rallye läuft — heute sind alle Zeug:innen unterwegs!</div>` : ""}
      <header class="home-kopf">
        <div>
          <div class="home-gruss">Hey ${esc(s.name || "du")} 👋</div>
          <div class="home-sub">Deine Wolke: <strong>${n} / ${figuren.length}</strong> Zeug:innen</div>
        </div>
        <div class="home-logo">☁️</div>
      </header>
      <div id="naechster-ort" class="naechster-ort"></div>
      <div id="gps-hinweis"></div>
      <div id="karte-container"></div>
      <section class="woche">
        <h2>${eventAktiv ? "Heute unterwegs (Rallye!)" : "Diese Woche unterwegs"}
          <span class="woche-stand">${getroffen}/${aktive.length} getroffen</span></h2>
        <div class="woche-chips">${chips}</div>
        ${eventAktiv ? "" : `<p class="dezent">Jede Woche (ab Sonntag) sind andere Zeug:innen an den Orten. Dranbleiben lohnt sich!</p>`}
      </section>`;

    hinweisSchluessel = "";
    window.Karte.render(view.querySelector("#karte-container"));
    aktualisiereHinweise();
    view.querySelectorAll("[data-figur-chip]").forEach(el => {
      el.addEventListener("click", () => {
        const f = figuren.find(x => x.id === el.getAttribute("data-figur-chip"));
        if (f) zeigeOrt(f.ortId);
      });
    });
  }

  /* Orte, an denen gerade eine (noch nicht getroffene) Zeug:in wartet */
  function offeneOrte() {
    const eventAktiv = window.Store.istEventAktiv();
    return window.Daten.orte.filter(o => {
      if (eventAktiv) return window.Rotation.figurenAnOrt(o.id).some(f => !window.Store.istGesammelt(f.id));
      const f = window.Rotation.aktiveFigur(o.id);
      return !!f && !window.Store.istGesammelt(f.id);
    });
  }

  /* "Kompass" auf der Startseite: Wo geht's als Nächstes hin? Wird bei GPS-Fixes
     nur dann neu aufgebaut, wenn sich die Aussage ändert — sonst nur die Entfernung. */
  function aktualisiereHinweise() {
    const box = document.getElementById("naechster-ort");
    if (!box) return;
    const s = window.Store.get();
    const eventAktiv = window.Store.istEventAktiv();
    const offen = offeneOrte();
    let schluessel = "", html = "", dist = "";

    if (!offen.length) {
      schluessel = "fertig";
      html = `<div class="hinweis-karte fertig"><span class="hinweis-icon">🎉</span><span>Du hast alle Zeug:innen getroffen, die ${eventAktiv ? "heute" : "diese Woche"} unterwegs sind!${eventAktiv ? "" : " Ab Sonntag warten neue an den Orten."}</span></div>`;
    } else {
      const da = offen.find(o => window.Geo.freischaltung(o).frei);
      if (da) {
        schluessel = "da:" + da.id;
        html = `<button class="hinweis-karte da" data-hinweis-ort="${da.id}"><span class="hinweis-icon">✨</span><span><strong>Du bist da!</strong> Hier wartet jemand auf dich: ${esc(da.name)} <span class="hinweis-los">Los →</span></span></button>`;
      } else if (window.Geo.hatPosition()) {
        let naechster = null, beste = Infinity;
        offen.forEach(o => {
          const d = window.Geo.distanzZu(o);
          if (d !== null && d < beste) { beste = d; naechster = o; }
        });
        if (naechster) {
          schluessel = "nah:" + naechster.id;
          dist = formatDistanz(beste);
          html = `<button class="hinweis-karte" data-hinweis-ort="${naechster.id}"><span class="hinweis-icon">🧭</span><span>Nächste Begegnung: <strong>${esc(naechster.name)}</strong> · <span class="hinweis-dist">${dist}</span></span></button>`;
        }
      } else if (s.geoErlaubt) {
        schluessel = "suche";
        html = `<div class="hinweis-karte leise"><span class="hinweis-icon">📍</span><span>Suche dein GPS-Signal … Draußen klappt's am besten. Am Ort geht's auch mit dem Code vom Schild.</span></div>`;
      } else if (!s.demo) {
        schluessel = "ohne";
        html = `<div class="hinweis-karte leise"><span class="hinweis-icon">📷</span><span>Ohne Standort? Kein Problem — tipp am Ort auf der Karte den Code vom Schild ein.</span></div>`;
      }
    }

    if (schluessel !== hinweisSchluessel) {
      box.innerHTML = html;
      hinweisSchluessel = schluessel;
      const btn = box.querySelector("[data-hinweis-ort]");
      if (btn) btn.addEventListener("click", () => zeigeOrt(btn.getAttribute("data-hinweis-ort")));
    } else if (dist) {
      const d = box.querySelector(".hinweis-dist");
      if (d && d.textContent !== dist) d.textContent = dist;
    }

    // Warnung bei ungenauem GPS — ebenfalls ohne Neuaufbau der Seite
    const gps = document.getElementById("gps-hinweis");
    if (gps) {
      const genau = window.Geo.genauigkeit();
      const text = (s.geoErlaubt && genau !== null && genau > 100)
        ? `GPS ist gerade ungenau (±${Math.round(genau)} m) — geh ein paar Schritte oder nutz den Code am Ort.` : "";
      if (gps.textContent !== text) {
        gps.textContent = text;
        gps.className = text ? "hinweis-band" : "";
      }
    }
  }

  /* ---------- Ort-Detail ---------- */
  function zeigeOrt(ortId) {
    aktuellerOrt = ortId;
    zeigeView("ort"); // rendert die Ortsansicht
  }

  function ortDistanzText(status) {
    if (status.distanz !== null) return `Du bist noch ${formatDistanz(status.distanz)} entfernt.`;
    return window.Store.get().geoErlaubt
      ? "Warte auf GPS-Signal …"
      : "Standort ist aus — tipp einfach den Code vom Schild am Ort ein.";
  }

  function aktualisiereOrtDistanz(ort, status) {
    const el = document.getElementById("ort-distanz-text");
    if (!el) return;
    const text = ortDistanzText(status);
    if (el.textContent !== text) el.textContent = text;
  }

  function renderOrt(ortId) {
    const ort = window.Daten.orte.find(o => o.id === ortId);
    if (!ort) return;
    const view = document.getElementById("view-ort");
    const s = window.Store.get();
    const status = window.Geo.freischaltung(ort);
    letzterOrtStatus = status.frei + ":" + status.art;
    const eventAktiv = window.Store.istEventAktiv();
    const figurenHier = window.Rotation.figurenAnOrt(ortId);
    const aktiv = window.Rotation.aktiveFigur(ortId);

    let begegnungsBereich = "";
    const kandidaten = eventAktiv ? figurenHier : (aktiv ? [aktiv] : []);
    const offen = kandidaten.filter(f => !window.Store.istGesammelt(f.id));

    if (status.frei && offen.length) {
      begegnungsBereich = offen.map(f => `
        <div class="ort-begegnung panel-pergament wartet-panel">
          <div class="ort-begegnung-nische">${window.Gestalt.svg(f, { praefix: "ort" })}</div>
          <div class="ort-begegnung-text">
            <strong>${esc(f.name)}</strong> wartet hier auf dich.
            <small>${esc(f.kurzvorstellung)}</small>
          </div>
          <button class="btn btn-gold" data-begegnung="${f.id}">✨ Begegnung beginnen</button>
          <button class="btn btn-sekundaer" data-ar="${f.id}">📷 In AR sehen</button>
        </div>`).join("");
    } else if (status.frei) {
      const bekannt = kandidaten.filter(f => window.Store.istGesammelt(f.id));
      begegnungsBereich = `<div class="panel-nacht ort-info">
        ${aktiv
          ? `<p>${eventAktiv ? "Allen Zeug:innen hier" : `<strong>${esc(aktiv.name)}</strong>`} ${eventAktiv ? "bist du schon begegnet" : "ist diese Woche hier — ihr kennt euch schon"}! 💛${eventAktiv ? "" : " Ab Sonntag wartet hier jemand anderes."}</p>`
          : "<p>Gerade ist hier niemand unterwegs.</p>"}
        ${bekannt.map(f => `<button class="btn btn-sekundaer" data-replay="${f.id}">💬 Nochmal mit ${esc(f.name)} reden</button>`).join("")}
      </div>`;
    } else {
      begegnungsBereich = `
        <div class="panel-nacht ort-info">
          <p>${aktiv ? `Diese Woche wartet hier: <strong>${window.Store.istGesammelt(aktiv.id) ? esc(aktiv.name) : "??? (" + esc(aktiv.themaLabel) + ")"}</strong>` : ""}</p>
          <p class="ort-distanz">📍 <span id="ort-distanz-text">${esc(ortDistanzText(status))}</span></p>
          <div class="ort-code">
            <label for="ort-code-eingabe">Code vom Schild am Ort:</label>
            <div class="ort-code-zeile">
              <input type="text" id="ort-code-eingabe" placeholder="WDZ-…" autocomplete="off" autocapitalize="characters">
              <button class="btn btn-sekundaer" id="ort-code-btn">Freischalten</button>
            </div>
          </div>
        </div>`;
    }

    const figurenListe = figurenHier.map(f => {
      const hat = window.Store.istGesammelt(f.id);
      const istAktiv = aktiv && aktiv.id === f.id;
      return `<span class="chip${hat ? " chip-gold" : ""}">${hat ? f.emoji + " " + esc(f.name) : "❔ " + esc(f.themaLabel)}${istAktiv && !eventAktiv ? " · diese Woche" : ""}</span>`;
    }).join("");

    const routeLinks = (ort.lat !== null && ort.lng !== null)
      ? `<a class="link-gold" href="geo:${ort.lat},${ort.lng}?q=${ort.lat},${ort.lng}(${encodeURIComponent(ort.name)})">🧭 Route öffnen</a>
         <a class="link-gold" href="https://www.openstreetmap.org/?mlat=${ort.lat}&mlon=${ort.lng}#map=17/${ort.lat}/${ort.lng}" target="_blank" rel="noopener">🗺️ Auf OpenStreetMap ↗</a>`
      : "";

    view.innerHTML = `
      <button class="zurueck" data-zurueck>‹ Karte</button>
      <header class="ort-kopf" style="--ort-farbe:${ort.farbe}">
        <div class="ort-icon">${ort.icon}</div>
        <div>
          <h1>${esc(ort.name)}</h1>
          <p class="ort-untertitel">${esc(ort.untertitel)}</p>
          ${ort.adresse ? `<p class="ort-adresse">📍 ${esc(ort.adresse)}</p>` : ""}
        </div>
        ${window.Store.hatSiegel(ort.id) ? `<div class="ort-siegel" title="Orts-Siegel">✦</div>` : ""}
      </header>
      ${ort.denkmal ? `<div class="denkmal-band">🕯️ Erinnerungsort — die Kirche stand hier ${esc(ort.jahre)}</div>` : ""}
      <p class="ort-beschreibung">${esc(ort.beschreibung)}</p>
      ${s.demo ? `<button class="btn btn-sekundaer" id="ort-beam">🧪 Demo: Beam mich hierhin</button>` : ""}
      ${begegnungsBereich}
      <section class="ort-figuren">
        <h3>Zeug:innen an diesem Ort</h3>
        <div class="chips">${figurenListe}</div>
      </section>
      <div class="ort-links">
        ${routeLinks}
        <a class="link-gold" href="${esc(ort.seite)}" target="_blank" rel="noopener">ℹ️ Mehr über diesen Ort ↗</a>
      </div>`;

    view.querySelector("[data-zurueck]").addEventListener("click", () => zeigeView("home"));
    view.querySelectorAll("[data-begegnung]").forEach(b => {
      b.addEventListener("click", () => {
        const f = window.Daten.figuren.find(x => x.id === b.getAttribute("data-begegnung"));
        if (f) window.Encounter.start(f);
      });
    });
    view.querySelectorAll("[data-ar]").forEach(b => {
      b.addEventListener("click", () => {
        const f = window.Daten.figuren.find(x => x.id === b.getAttribute("data-ar"));
        if (f) window.AR.oeffne(f, { zurueck: "ort" });
      });
    });
    view.querySelectorAll("[data-replay]").forEach(b => {
      b.addEventListener("click", () => {
        const f = window.Daten.figuren.find(x => x.id === b.getAttribute("data-replay"));
        if (f) window.Encounter.start(f, { replay: true });
      });
    });
    const beam = view.querySelector("#ort-beam");
    if (beam) beam.addEventListener("click", () => { window.Geo.beamZu(ortId); renderOrt(ortId); });
    const codeBtn = view.querySelector("#ort-code-btn");
    const codeFeld = view.querySelector("#ort-code-eingabe");
    // Enter auf der Handytastatur löst ebenfalls aus
    if (codeFeld) codeFeld.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); codeBtn.click(); } });
    if (codeBtn) codeBtn.addEventListener("click", () => {
      // Tolerant: Leerzeichen raus, fehlende Bindestriche egal (WDZDKBRUNNEN = WDZ-DK-BRUNNEN),
      // und kyrillische Doppelgänger-Buchstaben (А, В, Е, К, М, Н, О, Р, С, Т, У, Х) zählen als lateinisch
      const KYRILLISCH = { "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O", "Р": "P", "С": "C", "Т": "T", "У": "Y", "Х": "X" };
      const norm = t => t.toUpperCase().replace(/[\s\-–—_]/g, "").replace(/[АВЕКМНОРСТУХ]/g, z => KYRILLISCH[z]);
      const eingabe = norm(codeFeld.value);
      if (eingabe && eingabe === norm(ort.qrCode)) {
        window.Store.qrFreischalten(ort.id);
        toast(`📍 ${ort.name} ist für heute freigeschaltet!`);
        renderOrt(ortId);
      } else {
        toast("Dieser Code passt hier nicht. 🤔");
      }
    });
  }

  /* ---------- Figuren-Detail ---------- */
  function zeigeFigur(figurId) {
    const f = window.Daten.figuren.find(x => x.id === figurId);
    if (!f) return;
    zeigeView("figur");
    window.Wolke.renderFigurDetail(document.getElementById("view-figur"), f);
  }

  /* ---------- Einstellungen ---------- */
  function renderEinstellungen() {
    const view = document.getElementById("view-einstellungen");
    const s = window.Store.get();
    const c = window.Daten.config;

    view.innerHTML = `
      <h1>Einstellungen</h1>
      <div class="panel-nacht einstellung">
        <h3>📍 Standort</h3>
        <p class="dezent">Wird nur auf deinem Gerät verwendet — nie gespeichert, nie gesendet.</p>
        <label class="schalter"><input type="checkbox" id="e-geo" ${s.geoErlaubt ? "checked" : ""}> Standort für Begegnungen nutzen</label>
      </div>
      <div class="panel-nacht einstellung">
        <h3>🧪 Demo-Modus</h3>
        <p class="dezent">Zum Ausprobieren zu Hause: Beam dich zu den Orten. Begegnungen zählen als »Probelauf« — der echte Besuch wertet sie auf.</p>
        <label class="schalter"><input type="checkbox" id="e-demo" ${s.demo ? "checked" : ""}> Demo-Modus aktivieren</label>
      </div>
      <div class="panel-nacht einstellung">
        <h3>🎉 Aktionstag</h3>
        <p class="dezent">Bei einer Konfi-Rallye bekommst du von der Leitung einen Code.</p>
        <div class="ort-code-zeile">
          <input type="text" id="e-event" placeholder="Event-Code" autocomplete="off" autocapitalize="characters">
          <button class="btn btn-sekundaer" id="e-event-btn">Aktivieren</button>
        </div>
        ${window.Store.istEventAktiv() ? `<p class="chip chip-gold">Rallye ist heute aktiv! 🎉</p>` : ""}
      </div>
      <div class="panel-nacht einstellung">
        <h3>🔒 Datenschutz</h3>
        <p class="datenschutz-lang">${esc(c.datenschutz.lang)}</p>
      </div>
      <div class="panel-nacht einstellung">
        <h3>🗑️ Alles löschen</h3>
        <p class="dezent">Entfernt alle Daten dieser App von deinem Gerät — Wolke, Notizen, Name.</p>
        <button class="btn btn-warnung" id="e-loeschen">Alle meine Daten löschen</button>
      </div>
      <p class="einstellung-fuss">
        Wolke der Zeugen · Ev. Kirchengemeinde Staaken<br>
        <a class="link-gold" href="leiter.html">Leitungsbereich</a>
      </p>`;

    view.querySelector("#e-geo").addEventListener("change", e => {
      window.Store.setGeoErlaubt(e.target.checked);
      if (!e.target.checked) window.Geo.stop();
    });
    view.querySelector("#e-demo").addEventListener("change", e => {
      window.Store.setDemo(e.target.checked);
      if (!e.target.checked) window.Geo.beamZuruecksetzen();
      toast(e.target.checked ? "Demo-Modus an 🧪" : "Demo-Modus aus");
    });
    view.querySelector("#e-event-btn").addEventListener("click", () => {
      const code = view.querySelector("#e-event").value.trim().toUpperCase();
      const ev = (c.eventCodes || []).find(x => x.code.toUpperCase() === code);
      if (ev) {
        window.Store.aktiviereEvent();
        toast(`🎉 ${ev.name} gestartet — alle Zeug:innen sind heute unterwegs!`);
        renderEinstellungen();
      } else {
        toast("Diesen Event-Code kenne ich nicht. 🤔");
      }
    });
    view.querySelector("#e-loeschen").addEventListener("click", () => {
      if (confirm("Wirklich alles löschen? Deine Wolke, Notizen und dein Name werden von diesem Gerät entfernt.")) {
        window.Store.allesLoeschen();
        location.reload();
      }
    });
  }

  /* ---------- Meilensteine (Jesus-Rahmen) ---------- */
  function pruefeMeilensteine(kontext) {
    kontext = kontext || {};
    const c = window.Daten.config;
    const n = window.Store.anzahlGesammelt();
    const alle = window.Daten.figuren.length;

    (c.rahmen.meilensteine || []).forEach(m => {
      if (m.bei && n >= m.bei && !window.Store.istGelesen(m.id)) {
        meilensteinWarteschlange.push(m);
        window.Store.markiereGelesen(m.id);
      }
      if (m.beiOrtKomplett && kontext.ortKomplett) {
        const id = m.id + "-" + kontext.ortKomplett;
        if (!window.Store.istGelesen(id)) {
          meilensteinWarteschlange.push(m);
          window.Store.markiereGelesen(id);
        }
      }
      if (m.beiAllen && n >= alle && !window.Store.istGelesen(m.id)) {
        meilensteinWarteschlange.push(m);
        window.Store.markiereGelesen(m.id);
      }
    });
    zeigeNaechstenMeilenstein();
  }

  function zeigeNaechstenMeilenstein() {
    const m = meilensteinWarteschlange.shift();
    const overlay = document.getElementById("meilenstein-overlay");
    if (!m) { overlay.hidden = true; return; }
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="meilenstein panel-pergament">
        <div class="meilenstein-zeichen">☁️ ✦ ☁️</div>
        <p>${esc(m.text)}</p>
        <button class="btn btn-gold" id="meilenstein-weiter">Amen. Weiter! →</button>
      </div>`;
    overlay.querySelector("#meilenstein-weiter").addEventListener("click", zeigeNaechstenMeilenstein);
  }

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(text) {
    const el = document.getElementById("toast");
    el.textContent = text;
    el.classList.add("sichtbar");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("sichtbar"), 3500);
  }

  window.App = { zeigeView, zeigeOrt, zeigeFigur, pruefeMeilensteine, toast };

  document.addEventListener("DOMContentLoaded", () => {
    init().catch(err => {
      document.getElementById("app-laedt").textContent =
        "Die App konnte nicht laden. Bitte über einen Webserver öffnen (nicht als Datei) und neu versuchen.";
      console.error(err);
    });
  });
})();
