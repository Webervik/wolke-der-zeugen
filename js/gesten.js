/* Wolke der Zeugen — Glaubensgesten in der AR-Begegnung.
   Jede Figur lädt zu einer leiblichen Geste aus ihrer Geschichte ein:
   aufschauen und Sterne zählen, still werden, festhalten, sammeln,
   Tränen wegwischen, im Takt schütteln, Saiten zupfen.
   Religionspädagogisch: Frömmigkeit als Praxis mit dem ganzen Körper —
   nicht nur über etwas reden, sondern etwas tun und spüren.

   Jede Geste hat einen Rückfall ohne Sensoren (Tippen, Finger auflegen),
   damit niemand an der Technik scheitert. Bewegungsdaten bleiben auf dem Gerät.

   Aufruf: Gesten.starte(geste, ctx) → { stop() }
   ctx (von ar.js): ebene, figurPos, buehne, verankert(), richtung(), zuBild(a, b),
                    aufOrientierung(fn), aufBewegung(fn), status(t), fortschritt(w, t),
                    vibriere(m), fertig() */
(function () {
  /* ---------- Klang (sparsam: nur Saiten und Tamburin) ---------- */
  let audio = null;
  function audioKontext() {
    try {
      if (!audio) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audio = new AC();
      }
      if (audio.state === "suspended") audio.resume();
      return audio;
    } catch (e) { return null; }
  }

  function zupfe(frequenz) {
    const a = audioKontext();
    if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator(), g = a.createGain();
    o.type = "triangle";
    o.frequency.value = frequenz;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + 1.7);
  }

  function schelle() {
    const a = audioKontext();
    if (!a) return;
    const t = a.currentTime, dauer = 0.18;
    const puffer = a.createBuffer(1, Math.floor(a.sampleRate * dauer), a.sampleRate);
    const d = puffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const quelle = a.createBufferSource(), filter = a.createBiquadFilter(), g = a.createGain();
    quelle.buffer = puffer;
    filter.type = "bandpass"; filter.frequency.value = 7000; filter.Q.value = 1.2;
    g.gain.value = 0.35;
    quelle.connect(filter); filter.connect(g); g.connect(a.destination);
    quelle.start(t);
  }

  function element(tag, klasse, text) {
    const el = document.createElement(tag);
    if (klasse) el.className = klasse;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function zufall(a, b) { return a + Math.random() * (b - a); }

  /* ---------- Sammeln: Dinge rund um dich im Raum antippen ---------- */
  function sammeln(g, ctx) {
    const n = g.anzahl || 5;
    const dinge = [];
    let gesammelt = 0;
    const welt = ctx.verankert() && ctx.richtung();
    const start = ctx.richtung();

    for (let i = 0; i < n; i++) {
      if (welt) {
        const spreizung = g.bereich === "rundum" ? 300 : 150;
        const anteil = n === 1 ? 0.5 : i / (n - 1);
        const alpha = (start.alpha + (anteil - 0.5) * spreizung + zufall(-0.3, 0.3) * spreizung / n + 360) % 360;
        const beta = g.bereich === "himmel" ? zufall(110, 138) : g.bereich === "boden" ? zufall(40, 62) : zufall(72, 98);
        dinge.push({ alpha, beta });
      } else {
        dinge.push({ sx: zufall(12, 88), sy: g.bereich === "boden" ? zufall(42, 62) : zufall(16, 50) });
      }
    }

    dinge.forEach((d, i) => {
      const b = element("button", "geste-ding", g.symbol);
      b.setAttribute("aria-label", "Einsammeln");
      b.style.animationDelay = (i * 0.37) + "s";
      b.addEventListener("click", () => sammle(d));
      ctx.ebene.appendChild(b);
      d.el = b;
    });

    function platziere() {
      const w = window.innerWidth, h = window.innerHeight;
      const oben = 130, unten = h - 190; // Bereich zwischen Statuszeile und unteren Knöpfen
      let sichtbar = 0, naechster = null, abstand = Infinity;
      dinge.forEach(d => {
        if (d.weg) return;
        if (!welt) {
          d.el.style.transform = `translate(${(d.sx / 100 * w).toFixed(0)}px, ${(d.sy / 100 * h).toFixed(0)}px) translate(-50%, -50%)`;
          sichtbar++;
          return;
        }
        const p = ctx.zuBild(d.alpha, d.beta);
        const x = w / 2 + p.x, y = h * 0.42 + p.y;
        const drin = x > 24 && x < w - 24 && y > oben && y < unten;
        if (drin) {
          sichtbar++;
          d.el.classList.remove("rand");
        } else {
          d.el.classList.add("rand"); // Randmarke: zeigt die Richtung, ist aber nicht antippbar
          const a = Math.abs(p.x) / w + Math.abs(p.y) / h;
          if (a < abstand) { abstand = a; naechster = p; }
        }
        const cx = drin ? x : Math.max(22, Math.min(w - 22, x));
        const cy = drin ? y : Math.max(oben, Math.min(unten, y));
        d.el.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px) translate(-50%, -50%)`;
      });
      if (!welt) return;
      let hinweis = "tipp sie an!";
      if (!sichtbar && naechster) {
        if (Math.abs(naechster.x) > w * 0.45) hinweis = naechster.x < 0 ? "dreh dich nach links ←" : "dreh dich nach rechts →";
        else hinweis = naechster.y < 0 ? "schau nach oben ↑" : "schau nach unten ↓";
      }
      ctx.status(`${g.symbol} ${gesammelt}/${n} — ${hinweis}`);
    }

    function sammle(d) {
      if (d.weg || d.el.classList.contains("rand")) return;
      d.weg = true;
      d.el.classList.add("gesammelt");
      setTimeout(() => d.el.remove(), 450);
      gesammelt++;
      ctx.vibriere(25);
      ctx.fortschritt(gesammelt / n, `${gesammelt} / ${n}`);
      if (gesammelt >= n) { aufraeumen(); ctx.fertig(); }
      else platziere();
    }

    const abmelden = welt ? ctx.aufOrientierung(platziere) : () => {};
    ctx.fortschritt(0, `0 / ${n}`);
    platziere();
    if (!welt) ctx.status(`${g.symbol} Tipp alle ${n} an!`);

    function aufraeumen() { abmelden(); }
    return { stop() { aufraeumen(); dinge.forEach(d => d.el && d.el.remove()); } };
  }

  /* ---------- Stille: das Handy ganz ruhig halten ---------- */
  function stille(g, ctx) {
    const ziel = g.sekunden || 6;
    let fortschritt = 0, unruhe = 0, bewegungKam = false, gedrueckt = false, rueckfall = false, beendet = false;
    let letzteSchwere = null;
    const timer = [];

    const box = element("div", "stille-box");
    const lichter = g.lichter ? element("div", "stille-lichter") : null;
    if (lichter) for (let i = 0; i < g.lichter; i++) lichter.appendChild(element("span", "stille-licht"));
    const kreis = element("button", "stille-kreis", "🤫");
    kreis.setAttribute("aria-label", "Finger auflegen und still halten");
    if (lichter) box.appendChild(lichter);
    box.appendChild(kreis);
    const titel = element("div", "geste-gross");

    // Rückfall ohne Bewegungssensor: Finger ruhig auf den Kreis legen
    const druck = an => e => { if (!rueckfall) return; e.preventDefault(); gedrueckt = an; kreis.classList.toggle("gedrueckt", an); };
    kreis.addEventListener("pointerdown", druck(true));
    ["pointerup", "pointercancel", "pointerleave"].forEach(t => kreis.addEventListener(t, druck(false)));

    const abmelden = ctx.aufBewegung(e => {
      bewegungKam = true;
      let wert = null;
      const rr = e.rotationRate;
      if (rr && rr.alpha !== null && rr.alpha !== undefined) {
        wert = Math.abs(rr.alpha || 0) + Math.abs(rr.beta || 0) + Math.abs(rr.gamma || 0);
      } else if (e.acceleration && e.acceleration.x !== null && e.acceleration.x !== undefined) {
        wert = (Math.abs(e.acceleration.x) + Math.abs(e.acceleration.y) + Math.abs(e.acceleration.z)) * 12;
      } else if (e.accelerationIncludingGravity) {
        const a = e.accelerationIncludingGravity;
        const s = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
        wert = letzteSchwere === null ? 0 : Math.abs(s - letzteSchwere) * 40;
        letzteSchwere = s;
      }
      if (wert !== null) unruhe = unruhe * 0.85 + wert * 0.15;
    });

    function stillePhase() {
      titel.remove();
      ctx.ebene.appendChild(box);
      ctx.status(g.vorspiel ? "Und dann … 🤫 Halt dein Handy ganz ruhig." : "🤫 Halt dein Handy ganz ruhig.");
      ctx.fortschritt(0, `0 / ${ziel} s`);
      // Kommen nach 1,2 s keine Bewegungsdaten: Finger-Variante anbieten
      timer.push(setTimeout(() => {
        if (!bewegungKam) {
          rueckfall = true;
          box.classList.add("rueckfall");
          ctx.status("🤫 Leg deinen Finger auf den Kreis und halte ganz still.");
        }
      }, 1200));
      timer.push(setInterval(() => {
        if (beendet) return;
        let ruhig;
        if (bewegungKam && !rueckfall) ruhig = unruhe < 22; else ruhig = gedrueckt;
        fortschritt = ruhig ? fortschritt + 0.1 : Math.max(0, fortschritt - 0.12);
        box.classList.toggle("ruhig", ruhig);
        if (lichter) [...lichter.children].forEach((l, i) => l.classList.toggle("an", i < Math.floor(fortschritt / ziel * g.lichter + 0.0001)));
        ctx.fortschritt(Math.min(1, fortschritt / ziel), `${Math.min(ziel, Math.floor(fortschritt))} / ${ziel} s`);
        if (!rueckfall && bewegungKam) ctx.status(ruhig ? "🤫 Ganz ruhig …" : "🤫 Noch ein bisschen ruhiger …");
        if (fortschritt >= ziel) {
          beendet = true;
          aufraeumen();
          box.classList.add("erfuellt");
          if (g.vorspiel) {
            // Elia: das leise Säuseln
            const leise = element("div", "geste-gross leise", "… ein leises Säuseln …");
            ctx.ebene.appendChild(leise);
          }
          ctx.fertig();
        }
      }, 100));
    }

    if (g.vorspiel) {
      const phasen = [
        { klasse: "sturm", text: "🌪️ Ein gewaltiger Sturm …", nach: "Aber Gott war nicht im Sturm." },
        { klasse: "beben", text: "🌍 Ein Erdbeben …", nach: "Aber Gott war nicht im Erdbeben." },
        { klasse: "feuer", text: "🔥 Ein Feuer …", nach: "Aber Gott war nicht im Feuer." }
      ];
      ctx.ebene.appendChild(titel);
      let zeit = 0;
      phasen.forEach(p => {
        timer.push(setTimeout(() => {
          ctx.buehne.classList.add(p.klasse);
          titel.textContent = p.text;
          ctx.status(p.text);
          if (p.klasse === "beben") ctx.vibriere([200, 80, 200, 80, 300]);
        }, zeit));
        timer.push(setTimeout(() => { titel.textContent = p.nach; ctx.status(p.nach); }, zeit + 1700));
        timer.push(setTimeout(() => ctx.buehne.classList.remove(p.klasse), zeit + 2600));
        zeit += 2700;
      });
      timer.push(setTimeout(stillePhase, zeit));
    } else {
      stillePhase();
    }

    function aufraeumen() {
      abmelden();
      timer.forEach(t => { clearTimeout(t); clearInterval(t); });
      ["sturm", "beben", "feuer"].forEach(k => ctx.buehne.classList.remove(k));
    }
    return { stop() { beendet = true; aufraeumen(); box.remove(); titel.remove(); } };
  }

  /* ---------- Festhalten: Finger auflegen und halten ---------- */
  function festhalten(g, ctx) {
    const ziel = (g.sekunden || 5) * 1000;
    let gehalten = 0, druck = false, beendet = false;
    const effekt = g.effekt || "licht";

    const knopf = element("button", "halte-ziel effekt-" + effekt);
    knopf.setAttribute("aria-label", "Finger auflegen und festhalten");
    knopf.innerHTML = `<svg viewBox="0 0 100 100" class="halte-ring" aria-hidden="true">
        <circle cx="50" cy="50" r="44" class="halte-ring-grund"/>
        <circle cx="50" cy="50" r="44" class="halte-ring-wert" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>
      </svg><span class="halte-symbol">${g.symbol || "✋"}</span>`;
    ctx.figurPos.appendChild(knopf);
    const ring = knopf.querySelector(".halte-ring-wert");
    const symbol = knopf.querySelector(".halte-symbol");

    let himmel = null;
    if (effekt === "morgenrot") {
      himmel = element("div", "ar-morgenrot");
      ctx.buehne.insertBefore(himmel, ctx.buehne.querySelector(".ar-welt"));
    }

    const setze = an => e => {
      if (beendet) return;
      if (e) e.preventDefault();
      druck = an;
      knopf.classList.toggle("gedrueckt", an);
      if (effekt === "zittern") ctx.buehne.classList.toggle("zittern", an);
      if (an) {
        try { knopf.setPointerCapture(e.pointerId); } catch (x) { /* synthetische Ereignisse */ }
        ctx.vibriere(15);
      }
      ctx.status(an ? "✋ Halt fest …" : (g.symbol || "✋") + " Leg deinen Finger auf den Kreis und halt fest.");
    };
    knopf.addEventListener("pointerdown", setze(true));
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(t => knopf.addEventListener(t, setze(false)));
    knopf.addEventListener("contextmenu", e => e.preventDefault());

    const takt = setInterval(() => {
      if (beendet) return;
      // Nachsichtig: Loslassen setzt nicht zurück, es geht nur langsam etwas verloren
      gehalten = druck ? gehalten + 50 : Math.max(0, gehalten - 20);
      const anteil = Math.min(1, gehalten / ziel);
      ring.setAttribute("stroke-dashoffset", (100 - anteil * 100).toFixed(1));
      ctx.fortschritt(anteil, "");
      if (himmel) himmel.style.opacity = anteil.toFixed(3);
      if (effekt === "licht") ctx.figurPos.style.setProperty("--licht", anteil.toFixed(3));
      if (effekt === "siegel") symbol.style.transform = `scale(${(1 + anteil * 0.6).toFixed(3)})`;
      if (anteil >= 1) {
        beendet = true;
        clearInterval(takt);
        ctx.buehne.classList.remove("zittern");
        knopf.classList.add("erfuellt");
        if (effekt === "zittern") symbol.textContent = "✨";
        if (effekt === "siegel") { symbol.textContent = "🔴"; knopf.classList.add("gestempelt"); }
        ctx.vibriere([30, 40, 80]);
        setTimeout(() => knopf.remove(), 900);
        ctx.fertig();
      }
    }, 50);

    ctx.status((g.symbol || "✋") + " Leg deinen Finger auf den Kreis und halt fest.");
    return {
      stop() {
        beendet = true;
        clearInterval(takt);
        ctx.buehne.classList.remove("zittern");
        knopf.remove();
        // Das Morgenrot bleibt bewusst stehen, solange die Begegnung läuft
      }
    };
  }

  /* ---------- Wischen: Schleier wegwischen und sehen, was darunter ist ---------- */
  function wischen(g, ctx) {
    const art = g.schleier || "nebel";
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // Nur der mittlere Bereich ist verschleiert — so muss man nicht den ganzen Schirm reiben
    const bereich = { x: w * 0.06, y: h * 0.14, b: w * 0.88, h: h * 0.52 };

    let enthuellt = null;
    if (g.enthuellt) {
      enthuellt = element("div", "wisch-enthuellt" + (g.enthuellt.length > 3 ? " wort" : ""));
      enthuellt.innerHTML = g.enthuellt === "NOOMI"
        ? `<span class="wisch-wort">NOOMI</span><span class="wisch-unter">die Liebliche</span>`
        : `<span class="wisch-bild">${g.enthuellt}</span>`;
      ctx.ebene.appendChild(enthuellt);
    }

    const leinwand = element("canvas", "wisch-leinwand");
    leinwand.width = Math.round(w * dpr);
    leinwand.height = Math.round(h * dpr);
    ctx.ebene.appendChild(leinwand);
    const c = leinwand.getContext("2d");
    c.scale(dpr, dpr);

    // Schleier zeichnen
    const farben = {
      staub: ["rgba(166,142,104,0.94)", "rgba(120,98,70,0.5)"],
      traenen: ["rgba(118,148,190,0.9)", "rgba(220,235,255,0.35)"],
      nebel: ["rgba(150,158,176,0.92)", "rgba(230,232,240,0.4)"],
      mara: ["rgba(48,34,36,0.95)", "rgba(90,60,60,0.5)"]
    }[art] || ["rgba(150,158,176,0.92)", "rgba(230,232,240,0.4)"];
    const r = 22;
    c.fillStyle = farben[0];
    c.beginPath();
    if (c.roundRect) c.roundRect(bereich.x, bereich.y, bereich.b, bereich.h, r); else c.rect(bereich.x, bereich.y, bereich.b, bereich.h);
    c.fill();
    c.fillStyle = farben[1];
    for (let i = 0; i < 140; i++) {
      const x = bereich.x + Math.random() * bereich.b, y = bereich.y + Math.random() * bereich.h;
      const rad = art === "traenen" ? zufall(4, 16) : zufall(1, 4);
      c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
    }
    if (art === "mara") {
      c.fillStyle = "rgba(170,140,130,0.85)";
      c.font = `700 ${Math.round(w * 0.2)}px Georgia, serif`;
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("MARA", w / 2, h * 0.38);
      c.font = `italic ${Math.round(w * 0.05)}px Georgia, serif`;
      c.fillText("die Bittere", w / 2, h * 0.38 + w * 0.15);
    }

    // Wischen
    c.globalCompositeOperation = "destination-out";
    c.lineCap = "round"; c.lineJoin = "round"; c.lineWidth = 72;
    let unten = false, letzter = null, zuege = 0, beendet = false;

    const punkt = e => {
      const rect = leinwand.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    leinwand.addEventListener("pointerdown", e => {
      if (beendet) return;
      e.preventDefault();
      unten = true; letzter = punkt(e);
      try { leinwand.setPointerCapture(e.pointerId); } catch (x) {}
      c.beginPath(); c.arc(letzter.x, letzter.y, 36, 0, Math.PI * 2); c.fill();
    });
    leinwand.addEventListener("pointermove", e => {
      if (!unten || beendet) return;
      e.preventDefault();
      const p = punkt(e);
      c.beginPath(); c.moveTo(letzter.x, letzter.y); c.lineTo(p.x, p.y); c.stroke();
      letzter = p;
      if (++zuege % 6 === 0) pruefe();
    });
    ["pointerup", "pointercancel"].forEach(t => leinwand.addEventListener(t, () => { unten = false; pruefe(); }));

    function pruefe() {
      if (beendet) return;
      // Stichprobe im verschleierten Bereich: wie viel ist schon frei?
      const daten = c.getImageData(0, 0, leinwand.width, leinwand.height).data;
      let frei = 0, alle = 0;
      for (let y = bereich.y + 8; y < bereich.y + bereich.h; y += 22) {
        for (let x = bereich.x + 8; x < bereich.x + bereich.b; x += 22) {
          const i = (Math.round(y * dpr) * leinwand.width + Math.round(x * dpr)) * 4 + 3;
          alle++;
          if (daten[i] < 60) frei++;
        }
      }
      const anteil = alle ? frei / alle : 0;
      ctx.fortschritt(Math.min(1, anteil / 0.6), "");
      if (anteil >= 0.6) {
        beendet = true;
        leinwand.classList.add("weg");
        if (enthuellt) enthuellt.classList.add("sichtbar");
        setTimeout(() => leinwand.remove(), 700);
        ctx.vibriere([20, 30, 60]);
        ctx.fertig();
      }
    }

    ctx.fortschritt(0, "");
    return {
      stop() {
        leinwand.remove();
        // Das Enthüllte bleibt stehen, wenn es wirklich freigewischt wurde
        if (enthuellt && !beendet) enthuellt.remove();
        beendet = true;
      }
    };
  }

  /* ---------- Schütteln: im Takt, vor Lachen oder laut rufen ---------- */
  function schuetteln(g, ctx) {
    const n = g.anzahl || 6;
    let zahl = 0, letzterSchlag = 0, bewegungKam = false, beendet = false;
    const art = g.art || "tamburin";

    const buehne = element("div", "schuettel-box");
    const symbol = element("div", "schuettel-symbol", g.symbol || "🥁");
    const tippen = element("button", "btn btn-sekundaer schuettel-tippen", (g.symbol || "🥁") + " Tippen statt schütteln");
    tippen.hidden = true;
    tippen.addEventListener("click", () => schlag());
    buehne.appendChild(symbol);
    ctx.ebene.appendChild(buehne);
    ctx.ebene.appendChild(tippen);

    const abmelden = ctx.aufBewegung(e => {
      bewegungKam = true;
      let staerke = null;
      const a = e.acceleration;
      if (a && a.x !== null && a.x !== undefined) staerke = Math.hypot(a.x, a.y, a.z);
      else if (e.accelerationIncludingGravity) {
        const ag = e.accelerationIncludingGravity;
        staerke = Math.abs(Math.hypot(ag.x || 0, ag.y || 0, ag.z || 0) - 9.81);
      }
      const jetzt = performance.now();
      if (staerke !== null && staerke > 10 && jetzt - letzterSchlag > 260) {
        letzterSchlag = jetzt;
        schlag();
      }
    });
    // Kein Bewegungssensor? Dann geht es auch mit Tippen
    const rueckfallTimer = setTimeout(() => { if (!bewegungKam) tippen.hidden = false; }, 1500);
    const hilfeTimer = setTimeout(() => { tippen.hidden = false; }, 9000);

    function schlag() {
      if (beendet) return;
      zahl++;
      symbol.classList.remove("schlag"); void symbol.offsetWidth; symbol.classList.add("schlag");
      const welle = element("span", "schuettel-welle");
      buehne.appendChild(welle);
      setTimeout(() => welle.remove(), 700);
      if (art === "lachen") {
        const ha = element("span", "schuettel-ha", ["Ha!", "Haha!", "Hihi!", "Ha ha!"][zahl % 4]);
        ha.style.left = zufall(10, 75) + "%";
        buehne.appendChild(ha);
        setTimeout(() => ha.remove(), 1200);
      }
      if (art === "tamburin") schelle();
      ctx.vibriere(20);
      ctx.fortschritt(zahl / n, `${zahl} / ${n}`);
      if (zahl >= n) {
        beendet = true;
        aufraeumen();
        ctx.fertig();
      }
    }

    function aufraeumen() { abmelden(); clearTimeout(rueckfallTimer); clearTimeout(hilfeTimer); tippen.remove(); }
    ctx.fortschritt(0, `0 / ${n}`);
    return { stop() { beendet = true; aufraeumen(); buehne.remove(); } };
  }

  /* ---------- Saiten: Davids Leier ---------- */
  function saiten(g, ctx) {
    const n = g.anzahl || 5;
    const toene = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33]; // D-Dur pentatonisch
    const gezupft = new Set();
    let beendet = false, unten = false, letzte = -1;

    const leier = element("div", "leier");
    leier.setAttribute("aria-label", "Leier mit " + n + " Saiten");
    for (let i = 0; i < n; i++) {
      const s = element("button", "saite");
      s.dataset.i = i;
      s.setAttribute("aria-label", "Saite " + (i + 1));
      s.appendChild(element("span", "saite-linie"));
      leier.appendChild(s);
    }
    ctx.ebene.appendChild(leier);

    function zupfeSaite(i) {
      if (beendet || i < 0) return;
      const s = leier.children[i];
      s.classList.remove("schwingt"); void s.offsetWidth; s.classList.add("schwingt", "gezupft");
      zupfe(toene[i % toene.length]);
      ctx.vibriere(10);
      gezupft.add(i);
      ctx.fortschritt(gezupft.size / n, `${gezupft.size} / ${n}`);
      if (gezupft.size >= n) {
        beendet = true;
        setTimeout(() => ctx.fertig(), 500); // ausklingen lassen
      }
    }
    const saiteBei = e => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const s = el && el.closest && el.closest(".saite");
      return s && leier.contains(s) ? Number(s.dataset.i) : -1;
    };
    leier.addEventListener("pointerdown", e => {
      e.preventDefault(); unten = true;
      letzte = saiteBei(e); zupfeSaite(letzte);
    });
    leier.addEventListener("pointermove", e => {
      if (!unten) return;
      const i = saiteBei(e);
      if (i !== letzte) { letzte = i; zupfeSaite(i); } // über die Saiten streichen
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(t => leier.addEventListener(t, () => { unten = false; letzte = -1; }));

    ctx.fortschritt(0, `0 / ${n}`);
    return { stop() { beendet = true; leier.remove(); } };
  }

  const GESTEN = { sammeln, stille, festhalten, wischen, schuetteln, saiten };

  function starte(geste, ctx) {
    const fn = geste && GESTEN[geste.typ];
    if (!fn) { ctx.fertig(); return { stop() {} }; }
    return fn(geste, ctx);
  }

  window.Gesten = { starte };
})();
