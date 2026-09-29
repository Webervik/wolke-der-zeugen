/* Wolke der Zeugen — Begegnungsablauf: Dialog → Impuls → Frage → Aufnahme.
   Theologische Leitplanke: Es wird nichts "gefangen" und niemand bestraft.
   Die Frage ist keine Prüfung — die Figur kommt immer in die Wolke,
   die erste richtige Antwort verleiht der Karte nur einen Goldglanz. */
(function () {
  let figur = null;
  let replay = false;
  let verifikation = "gps";
  let dialogIndex = 0;
  let glanz = false;
  let versuch = 0;
  let container = null;
  let aufgenommen = null;   // nach der Zeremonie: { neuesSiegel }
  let sperreBis = 0;

  /* Schutz gegen Doppel-Taps: Ein schneller zweiter Tipp würde sonst den gerade
     neu erschienenen "Weiter"-Button treffen und eine Dialogzeile überspringen. */
  function zuSchnell() {
    const jetzt = Date.now();
    if (jetzt < sperreBis) return true;
    sperreBis = jetzt + 400;
    return false;
  }

  function sperre(ms) { sperreBis = Math.max(sperreBis, Date.now() + ms); }

  function vibriere(muster) {
    try { if (navigator.vibrate) navigator.vibrate(muster); } catch (e) { /* iOS: egal */ }
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function start(f, opts) {
    opts = opts || {};
    figur = f;
    replay = !!opts.replay;
    dialogIndex = 0;
    glanz = false;
    versuch = 0;
    aufgenommen = null;
    sperreBis = 0;

    if (!replay) {
      const ort = window.Daten.orte.find(o => o.id === f.ortId);
      const status = window.Geo.freischaltung(ort);
      verifikation = status.art || "gps";
    }

    container = document.getElementById("view-begegnung");
    window.App.zeigeView("begegnung");
    renderRahmen();
    renderDialog();
  }

  function renderRahmen() {
    const ort = window.Daten.orte.find(o => o.id === figur.ortId);
    container.innerHTML = `
      <div class="begegnung-kopf">
        <button class="zurueck" id="beg-abbruch" aria-label="Begegnung verlassen">‹</button>
        <div class="begegnung-titel">
          <span class="begegnung-emoji" style="border-color:${figur.farbe}">${figur.emoji}</span>
          <div>
            <div class="begegnung-name">${esc(figur.name)}</div>
            <div class="begegnung-ort">${ort ? ort.icon + " " + esc(ort.name) : ""}</div>
          </div>
        </div>
      </div>
      <div class="begegnung-inhalt" id="beg-inhalt"></div>`;
    container.querySelector("#beg-abbruch").addEventListener("click", () => {
      if (aufgenommen) { zurWolke(); return; }
      window.App.zeigeView(replay ? "wolke" : "home");
    });
  }

  /* ---- Phase 1: Dialog in Chat-Bubbles ---- */
  function renderDialog() {
    const inhalt = container.querySelector("#beg-inhalt");
    inhalt.innerHTML = `<div class="chat" id="beg-chat"></div><div class="chat-aktionen" id="beg-aktionen"></div>`;
    naechsterSchritt();
  }

  function bubble(text, wer) {
    const chat = container.querySelector("#beg-chat");
    const el = document.createElement("div");
    el.className = "bubble " + (wer === "du" ? "bubble-du" : "bubble-figur");
    el.textContent = text;
    chat.appendChild(el);
    el.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function naechsterSchritt() {
    const aktionen = container.querySelector("#beg-aktionen");
    aktionen.innerHTML = "";

    if (dialogIndex >= figur.dialog.length) {
      dialogEnde(aktionen);
      return;
    }

    const schritt = figur.dialog[dialogIndex];
    if (schritt.sprecher === "figur") {
      bubble(schritt.text, "figur");
      dialogIndex++;
      const weiter = document.createElement("button");
      weiter.className = "btn btn-gold";
      weiter.textContent = dialogIndex >= figur.dialog.length ? "Weiter" : "Weiter …";
      weiter.addEventListener("click", () => { if (!zuSchnell()) naechsterSchritt(); });
      aktionen.appendChild(weiter);
      sperre(350); // frisch erschienene Buttons kurz gegen den "Nachklapp"-Tipp sperren
    } else {
      // Wahlmoment: Du antwortest, die Figur reagiert
      schritt.optionen.forEach(opt => {
        const b = document.createElement("button");
        b.className = "btn btn-wahl";
        b.textContent = opt.text;
        b.addEventListener("click", () => {
          if (zuSchnell()) return;
          aktionen.querySelectorAll("button").forEach(x => { x.disabled = true; });
          bubble(opt.text, "du");
          setTimeout(() => {
            bubble(opt.reaktion, "figur");
            dialogIndex++;
            naechsterSchritt();
          }, 350);
        });
        aktionen.appendChild(b);
      });
      sperre(350);
    }
  }

  function dialogEnde(aktionen) {
    const weiter = document.createElement("button");
    weiter.className = "btn btn-gold";
    if (replay) {
      weiter.textContent = "Fertig";
      weiter.addEventListener("click", () => { if (!zuSchnell()) window.App.zeigeFigur(figur.id); });
    } else {
      weiter.textContent = "Weiter zum Impuls →";
      weiter.addEventListener("click", () => { if (!zuSchnell()) renderImpuls(); });
    }
    aktionen.appendChild(weiter);
    sperre(350);
  }

  /* ---- Phase 2: Impuls + private Notiz ---- */
  function renderImpuls() {
    const inhalt = container.querySelector("#beg-inhalt");
    inhalt.innerHTML = `
      <div class="impuls panel-pergament">
        <div class="impuls-zeichen">✦</div>
        <h3>Zum Nachdenken</h3>
        <p>${esc(figur.impuls)}</p>
        <textarea id="impuls-notiz" rows="3" placeholder="Deine private Notiz (optional) …">${esc(window.Store.getNotiz(figur.id))}</textarea>
        <p class="dezent">🔒 Bleibt auf deinem Gerät. Niemand sonst sieht das.</p>
      </div>
      <button class="btn btn-gold" id="impuls-weiter">Weiter zur Frage →</button>`;
    inhalt.querySelector("#impuls-weiter").addEventListener("click", () => {
      window.Store.setNotiz(figur.id, inhalt.querySelector("#impuls-notiz").value);
      renderFrage();
    });
  }

  /* ---- Phase 3: Frage (kein Test — zweite Chance, Karte kommt immer) ---- */
  function renderFrage() {
    const f = figur.frage;
    const inhalt = container.querySelector("#beg-inhalt");
    inhalt.innerHTML = `
      <div class="frage panel-nacht">
        <div class="frage-label">Eine Frage noch — ${esc(figur.name)} ist gespannt:</div>
        <h3>${esc(f.frage)}</h3>
        <div class="frage-antworten" id="frage-antworten"></div>
        <div class="frage-feedback" id="frage-feedback" aria-live="polite"></div>
      </div>`;

    const wrap = inhalt.querySelector("#frage-antworten");
    f.antworten.forEach((a, i) => {
      const b = document.createElement("button");
      b.className = "btn btn-antwort";
      b.textContent = a;
      b.addEventListener("click", () => pruefeAntwort(i, b));
      wrap.appendChild(b);
    });
  }

  function pruefeAntwort(i, button) {
    const f = figur.frage;
    const feedback = container.querySelector("#frage-feedback");
    versuch++;

    if (i === f.richtig) {
      if (versuch === 1) glanz = true;
      container.querySelectorAll(".btn-antwort").forEach(b => b.disabled = true);
      button.classList.add("richtig");
      feedback.innerHTML = `
        <div class="feedback-richtig">${versuch === 1 ? "✨ Stark! Erste Antwort — deine Karte bekommt Goldglanz." : "Genau! 💛"}</div>
        <p>${esc(f.erklaerung)}</p>
        <a class="link-gold" href="${esc(f.bibellink)}" target="_blank" rel="noopener">📖 ${esc(f.bibelstelle)} — in der BasisBibel lesen ↗</a>`;
      const weiter = document.createElement("button");
      weiter.className = "btn btn-gold";
      weiter.textContent = "Weiter →";
      weiter.addEventListener("click", renderZeremonie);
      feedback.appendChild(weiter);
    } else if (versuch === 1) {
      button.classList.add("falsch");
      button.disabled = true;
      feedback.innerHTML = `<div class="feedback-hinweis">Hm, nicht ganz — hör nochmal in unser Gespräch hinein. Du hast noch einen Versuch, und in meine Wolke… äh, deine Wolke komme ich sowieso. 😉</div>`;
    } else {
      // Zweiter Versuch daneben: richtige Antwort zeigen, niemand wird beschämt
      container.querySelectorAll(".btn-antwort").forEach((b, idx) => {
        b.disabled = true;
        if (idx === f.richtig) b.classList.add("richtig");
      });
      button.classList.add("falsch");
      feedback.innerHTML = `
        <div class="feedback-hinweis">Kein Ding — jetzt weißt du es. Merken lohnt sich:</div>
        <p>${esc(f.erklaerung)}</p>
        <a class="link-gold" href="${esc(f.bibellink)}" target="_blank" rel="noopener">📖 ${esc(f.bibelstelle)} — in der BasisBibel lesen ↗</a>`;
      const weiter = document.createElement("button");
      weiter.className = "btn btn-gold";
      weiter.textContent = "Weiter →";
      weiter.addEventListener("click", renderZeremonie);
      feedback.appendChild(weiter);
    }
  }

  /* ---- Phase 4: Aufnahme in die Wolke ---- */
  function renderZeremonie() {
    if (aufgenommen) return; // Doppel-Tipp auf "Weiter →"
    window.Store.sammle(figur.id, verifikation, glanz);

    // Orts-Siegel prüfen
    const amOrt = window.Rotation.figurenAnOrt(figur.ortId);
    const komplett = amOrt.every(f => window.Store.istGesammelt(f.id));
    const neuesSiegel = komplett && !window.Store.hatSiegel(figur.ortId);
    if (neuesSiegel) window.Store.setzeSiegel(figur.ortId);
    aufgenommen = { neuesSiegel };

    const inhalt = container.querySelector("#beg-inhalt");
    inhalt.innerHTML = `
      <div class="zeremonie">
        <div class="zeremonie-karte">
          ${window.Wolke.kartenSVG(figur, { glanz })}
          <div class="zeremonie-funken" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<span style="--i:${i}"></span>`).join("")}</div>
        </div>
        <h2 class="zeremonie-titel">${esc(figur.name)} ist jetzt Teil deiner Wolke ☁️</h2>
        <p class="zeremonie-spruch">»${esc(figur.kartenspruch)}«</p>
        <button class="btn btn-gold" id="zeremonie-weiter">Zur Wolke →</button>
      </div>`;
    vibriere(glanz ? [60, 50, 60, 50, 140] : [60, 60, 120]);

    inhalt.querySelector("#zeremonie-weiter").addEventListener("click", zurWolke);
  }

  function zurWolke() {
    const siegel = aufgenommen && aufgenommen.neuesSiegel;
    aufgenommen = null;
    window.App.zeigeView("wolke");
    window.App.pruefeMeilensteine({ ortKomplett: siegel ? figur.ortId : null });
  }

  window.Encounter = { start };
})();
