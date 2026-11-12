/* Wolke der Zeugen — Effekte ("Fx"): Sternenhimmel, Partikel, Neigung, Holo-Karten.

   Alles wird zur Laufzeit gezeichnet — keine Bilddateien, keine Fremd-Requests.
   Leitlinien:
   - Akku schonen: Der Himmel läuft mit ~30 Bildern/s und pausiert, wenn die Seite
     verdeckt ist oder die Kamera läuft. Partikel laufen nur, solange welche da sind.
     Der Lagesensor wird nur abonniert, solange eine Holo-Karte zu sehen ist.
   - Niemand wird ausgeschlossen: Unter "Mehr" lassen sich die Effekte abschalten,
     und "Bewegung reduzieren" des Geräts wird respektiert. Dann ist Fx.an() false,
     alle Aufrufe tun nichts (oder führen nur ihre Rückrufe aus). */
(function () {
  "use strict";
  const TAU = Math.PI * 2;
  const mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  function an() {
    try { if (window.Store && window.Store.get().effekteAus) return false; } catch (e) { /* Store noch nicht da */ }
    return !(mq && mq.matches);
  }

  /* ---------- kleine Helfer ---------- */
  const zuf = (a, b) => a + Math.random() * (b - a);
  const klemme = (v, a, b) => Math.max(a, Math.min(b, v));
  const dpr = max => Math.min(window.devicePixelRatio || 1, max);

  function seedAus(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function prng(seed) {
    let a = seed;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hexRgb(hex) {
    const h = String(hex || "#f0d284").replace("#", "");
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0);
  }
  function rgb(hex) { return hexRgb(hex).join(","); }
  function mische(hex, ziel, anteil) {
    const a = hexRgb(hex), b = hexRgb(ziel);
    return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * anteil).toString(16).padStart(2, "0")).join("");
  }
  /* Farbfamilie einer Figur für Funken und Scherben */
  function palette(farbe) {
    return [mische(farbe, "#ffffff", 0.45), mische(farbe, "#ffffff", 0.2), farbe, mische(farbe, "#f0d284", 0.5), "#f0d284", "#fff3c8"];
  }
  function mitte(el) {
    if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    if (typeof el.x === "number") return el;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /* Leuchtpunkt als kleines Bild — einmal gemalt, tausendfach gestempelt */
  const glutCache = new Map();
  function glut(farbe) {
    let s = glutCache.get(farbe);
    if (s) return s;
    s = document.createElement("canvas");
    s.width = s.height = 64;
    const g = s.getContext("2d");
    const [r, gr, b] = hexRgb(farbe);
    const v = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    v.addColorStop(0, "rgba(255,255,255,1)");
    v.addColorStop(0.16, `rgba(${(r + 255) >> 1},${(gr + 255) >> 1},${(b + 255) >> 1},0.9)`);
    v.addColorStop(0.45, `rgba(${r},${gr},${b},0.32)`);
    v.addColorStop(1, `rgba(${r},${gr},${b},0)`);
    g.fillStyle = v;
    g.fillRect(0, 0, 64, 64);
    if (glutCache.size > 80) glutCache.clear();
    glutCache.set(farbe, s);
    return s;
  }

  /* ============================================================
     Sternenhimmel hinter der ganzen App
     - feste Schichten (einmal gemalt, per CSS verschoben → kostet fast nichts)
     - eine kleine lebendige Leinwand: funkelnde Sterne, Sternschnuppen und
       für jede gesammelte Zeug:in ein farbiger Stern ("deine Wolke über dir")
     - in der Begegnung ohne Kamera: Sterne stehen fest im Raum und wandern mit,
       wenn man sich dreht (wie ein Planetarium)
     ============================================================ */
  const Himmel = (function () {
    const RAND = 30;                      // Rand der Parallaxe-Schichten (px)
    const STERNFARBEN = ["#ffffff", "#ffffff", "#cfdcff", "#ffecbe", "#f0d284"];
    let wurzel = null, fern, mitteEl, nah, cv, c;
    let w = 0, h = 0, skala = 1;
    let funkler = [], zeugen = [], welt = [];
    let schnuppe = null, naechsteSchnuppe = 0;
    let raf = 0, letzter = 0, pausiert = false;
    let ar = false, blick = null;
    let par = 0, parGesetzt = null;

    function baue() {
      if (wurzel) return;
      wurzel = document.createElement("div");
      wurzel.id = "fx-himmel";
      wurzel.setAttribute("aria-hidden", "true");
      wurzel.innerHTML = '<div class="h-nebel"></div><i class="h-wolke"></i><i class="h-wolke"></i><canvas class="h-fern"></canvas><canvas class="h-mitte"></canvas><canvas class="h-nah"></canvas><canvas class="h-funkeln"></canvas>';
      document.body.insertBefore(wurzel, document.body.firstChild);
      fern = wurzel.querySelector(".h-fern");
      mitteEl = wurzel.querySelector(".h-mitte");
      nah = wurzel.querySelector(".h-nah");
      cv = wurzel.querySelector(".h-funkeln");
      c = cv.getContext("2d");

      const zufall = prng(20261112);
      // Sterne im Raum (Azimut 0–360°, Höhe als Kippwinkel 0–180°) für die Begegnung
      for (let i = 0; i < 900; i++) {
        welt.push({
          az: zufall() * 360, el: 10 + zufall() * 160,
          r: 0.5 + Math.pow(zufall(), 3) * 2.1, a: 0.35 + zufall() * 0.65,
          farbe: STERNFARBEN[Math.floor(zufall() * STERNFARBEN.length)], p: zufall() * TAU, v: 0.6 + zufall() * 1.6
        });
      }
      messe(true);
      let t = 0;
      window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => messe(false), 250); });
      window.addEventListener("scroll", parallaxe, { passive: true });
      document.addEventListener("visibilitychange", () => { if (!document.hidden) laufe(); });
    }

    function leinwand(el, breite, hoehe, s) {
      el.width = Math.round(breite * s);
      el.height = Math.round(hoehe * s);
      el.style.width = breite + "px";
      el.style.height = hoehe + "px";
      const g = el.getContext("2d");
      g.setTransform(s, 0, 0, s, 0, 0);
      g.clearRect(0, 0, breite, hoehe);
      return g;
    }

    function saeeSterne(g, breite, hoehe, anzahl, zufall, rMin, rMax, aMin) {
      for (let i = 0; i < anzahl; i++) {
        const x = zufall() * breite, y = zufall() * hoehe;
        const r = rMin + Math.pow(zufall(), 2.4) * (rMax - rMin);
        const a = aMin + zufall() * (1 - aMin);
        const farbe = STERNFARBEN[Math.floor(zufall() * STERNFARBEN.length)];
        g.globalAlpha = a;
        g.fillStyle = farbe;
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        if (r > 1) { g.globalAlpha = a * 0.4; g.drawImage(glut(farbe), x - r * 3, y - r * 3, r * 6, r * 6); }
      }
      g.globalAlpha = 1;
    }

    /* Größe merken und die festen Schichten malen. Auf Handys ändert sich die Höhe
       ständig ein wenig (Adressleiste) — neu gemalt wird nur bei echten Änderungen. */
    function messe(erzwingen) {
      const nw = window.innerWidth, nh = Math.max(window.innerHeight, document.documentElement.clientHeight) + 140;
      if (!erzwingen && nw === w && Math.abs(nh - h) < 180) return;
      w = nw; h = nh;
      skala = dpr(2);
      const zufall = prng(7 + w);

      // fern: Milchstraßenband + viele kleine Sterne (steht still)
      let g = leinwand(fern, w, h, dpr(1.5));
      const ax = -0.15 * w, ay = 0.62 * h, bx = 1.15 * w, by = 0.04 * h;
      const laenge = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / laenge, ny = (bx - ax) / laenge;
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 26; i++) {
        const t = i / 25, gr = h * (0.2 + zufall() * 0.16);
        g.globalAlpha = 0.03 + zufall() * 0.03;
        g.drawImage(glut(i % 3 ? "#9fb2e8" : "#c8a8e0"), ax + (bx - ax) * t - gr / 2, ay + (by - ay) * t - gr / 2 + (zufall() - 0.5) * h * 0.05, gr, gr);
      }
      g.globalCompositeOperation = "source-over";
      for (let i = 0; i < 520; i++) {
        const t = zufall(), ab = (zufall() + zufall() + zufall() - 1.5) * h * 0.1;
        g.globalAlpha = 0.12 + zufall() * 0.3;
        g.fillStyle = "#dfe6ff";
        g.beginPath(); g.arc(ax + (bx - ax) * t + nx * ab, ay + (by - ay) * t + ny * ab, 0.3 + zufall() * 0.6, 0, TAU); g.fill();
      }
      saeeSterne(g, w, h, Math.round(w * h / 2600), zufall, 0.3, 1.0, 0.25);

      // mitte + nah: wenige, hellere Sterne — verschieben sich leicht (Tiefe)
      g = leinwand(mitteEl, w + RAND * 2, h + RAND * 2, dpr(1.5));
      saeeSterne(g, w + RAND * 2, h + RAND * 2, Math.round(w * h / 9000), zufall, 0.6, 1.5, 0.45);
      g = leinwand(nah, w + RAND * 2, h + RAND * 2, dpr(1.5));
      saeeSterne(g, w + RAND * 2, h + RAND * 2, Math.round(w * h / 26000), zufall, 0.9, 1.6, 0.6);

      // funkelnde Sterne auf der lebendigen Leinwand
      leinwand(cv, w, h, skala);
      funkler = [];
      for (let i = 0; i < 34; i++) {
        funkler.push({
          x: zufall() * w, y: zufall() * h * 0.92, r: 0.7 + zufall() * 1.0,
          farbe: STERNFARBEN[Math.floor(zufall() * STERNFARBEN.length)],
          p: zufall() * TAU, v: 0.5 + zufall() * 1.7, kreuz: zufall() < 0.35
        });
      }
      parGesetzt = null;
      parallaxe();
      setzeZeugen();
      zeichne(performance.now());
    }

    function parallaxe() {
      if (!wurzel || ar) return;
      par = klemme((window.scrollY || 0) * 0.035, 0, RAND - 2);
      if (parGesetzt !== null && Math.abs(par - parGesetzt) < 0.4) return;
      parGesetzt = par;
      mitteEl.style.transform = `translate3d(${-RAND}px, ${(-RAND - par * 0.45).toFixed(1)}px, 0)`;
      nah.style.transform = `translate3d(${-RAND}px, ${(-RAND - par).toFixed(1)}px, 0)`;
    }

    /* Für jede gesammelte Zeug:in leuchtet ein Stern in ihrer Farbe */
    function setzeZeugen(neuId) {
      const daten = window.Daten, store = window.Store;
      if (!daten || !store || !w) { zeugen = []; return; }
      const jetzt = performance.now();
      const alt = {};
      zeugen.forEach(z => { alt[z.id] = z; });
      zeugen = daten.figuren.filter(f => store.istGesammelt(f.id)).map(f => {
        const z = prng(seedAus("stern:" + f.id));
        const info = store.get().gesammelt[f.id] || {};
        return {
          id: f.id,
          x: (0.07 + z() * 0.86) * w, y: (0.045 + z() * 0.27) * Math.min(h, 900),
          r: 2.3 + z() * 1.2 + (f.seltenheit === "legende" ? 0.9 : 0),
          farbe: mische(f.farbe, "#ffffff", 0.3), p: z() * TAU, v: 0.7 + z() * 0.8,
          kreuz: !!info.glanz || f.seltenheit === "legende",
          geboren: f.id === neuId ? jetzt : (alt[f.id] ? alt[f.id].geboren : 0)
        };
      });
      laufe();
    }

    function stern(x, y, r, farbe, alpha, kreuz) {
      if (alpha <= 0.01) return;
      c.globalAlpha = alpha;
      const g = r * 4.2;
      c.drawImage(glut(farbe), x - g, y - g, g * 2, g * 2);
      if (kreuz) {
        c.globalAlpha = alpha * 0.75;
        c.fillStyle = "#ffffff";
        const l = r * 4, d = Math.max(0.5, r * 0.2);
        c.beginPath();
        c.moveTo(x - l, y); c.lineTo(x, y - d); c.lineTo(x + l, y); c.lineTo(x, y + d); c.closePath();
        c.moveTo(x, y - l); c.lineTo(x + d, y); c.lineTo(x, y + l); c.lineTo(x - d, y); c.closePath();
        c.fill();
      }
    }

    function zeichne(t) {
      if (!c) return;
      const s = t / 1000, lebendig = an();
      c.clearRect(0, 0, w, h);
      c.globalCompositeOperation = "lighter";

      if (ar && blick) {
        // Planetarium: Sterne stehen fest im Raum (gleiche Abbildung wie die Lichtgestalt)
        const pxH = w / 60, pxV = window.innerHeight / 75, my = window.innerHeight * 0.42;
        for (let i = 0; i < welt.length; i++) {
          const st = welt[i];
          let d = (blick.alpha - st.az) % 360;
          if (d > 180) d -= 360; else if (d < -180) d += 360;
          const x = w / 2 + d * pxH;
          if (x < -12 || x > w + 12) continue;
          const y = my + (blick.beta - st.el) * pxV;
          if (y < -12 || y > h + 12) continue;
          const a = st.a * (lebendig ? 0.72 + 0.28 * Math.sin(s * st.v + st.p) : 0.85);
          if (st.r < 1.1) {
            c.globalAlpha = a; c.fillStyle = st.farbe;
            c.fillRect(x - st.r * 0.6, y - st.r * 0.6, st.r * 1.2, st.r * 1.2);
          } else stern(x, y, st.r * 0.8, st.farbe, a, st.r > 2.1);
        }
      } else {
        for (let i = 0; i < funkler.length; i++) {
          const f = funkler[i];
          const a = lebendig ? Math.pow(0.5 + 0.5 * Math.sin(s * f.v + f.p), 1.6) : 0.6;
          stern(f.x, f.y - par * 0.7, f.r * (0.7 + a * 0.5), f.farbe, 0.25 + a * 0.75, f.kreuz);
        }
        // Zeug:innen-Sterne
        for (let i = 0; i < zeugen.length; i++) {
          const z = zeugen[i];
          let groesse = 1, zusatz = 0;
          if (z.geboren) {
            const k = (t - z.geboren) / 1400;
            if (k < 1 && k >= 0) { groesse = 1 + (1 - k) * 2.2 * Math.sin(Math.min(1, k * 2.5) * Math.PI / 2); zusatz = (1 - k) * 0.6; }
          }
          const puls = lebendig ? 0.78 + 0.22 * Math.sin(s * z.v + z.p) : 0.9;
          stern(z.x, z.y - par * 0.25, z.r * groesse * (0.9 + puls * 0.15), z.farbe, Math.min(1, puls + zusatz), z.kreuz);
        }
        // Sternschnuppe
        if (lebendig) {
          if (!schnuppe && t > naechsteSchnuppe) {
            const rechts = Math.random() < 0.5;
            schnuppe = { x: zuf(0.15, 0.85) * w, y: zuf(0.02, 0.3) * h, w: rechts ? zuf(0.35, 0.6) : Math.PI - zuf(0.35, 0.6), t0: t, dauer: zuf(550, 900), tempo: zuf(0.55, 0.8) };
            naechsteSchnuppe = t + zuf(9000, 22000);
          }
          if (schnuppe) {
            const k = (t - schnuppe.t0) / schnuppe.dauer;
            if (k >= 1) schnuppe = null;
            else {
              const weg = (t - schnuppe.t0) * schnuppe.tempo;
              const x = schnuppe.x + Math.cos(schnuppe.w) * weg, y = schnuppe.y + Math.sin(schnuppe.w) * weg;
              const schweif = 110 * Math.sin(k * Math.PI);
              const xe = x - Math.cos(schnuppe.w) * schweif, ye = y - Math.sin(schnuppe.w) * schweif;
              const v = c.createLinearGradient(x, y, xe, ye);
              v.addColorStop(0, "rgba(255,255,255,0.95)");
              v.addColorStop(0.3, "rgba(240,210,132,0.5)");
              v.addColorStop(1, "rgba(240,210,132,0)");
              c.globalAlpha = Math.sin(k * Math.PI);
              c.strokeStyle = v; c.lineWidth = 1.8; c.lineCap = "round";
              c.beginPath(); c.moveTo(x, y); c.lineTo(xe, ye); c.stroke();
              stern(x, y, 1.6, "#fff3c8", Math.sin(k * Math.PI), false);
            }
          }
        }
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
    }

    function bild(t) {
      raf = 0;
      if (pausiert || document.hidden || !wurzel) return;
      // Im Planetarium jedes Bild (folgt der Drehung), sonst gemütliche ~30 Bilder/s
      if (ar || t - letzter >= 32) { letzter = t; zeichne(t); }
      if (an()) raf = requestAnimationFrame(bild);
    }

    function laufe() {
      if (!wurzel || raf || pausiert) return;
      if (!an()) { zeichne(performance.now()); return; }
      raf = requestAnimationFrame(bild);
    }

    return {
      start() { baue(); naechsteSchnuppe = performance.now() + zuf(4000, 9000); laufe(); },
      zeugen(neuId) { if (wurzel) setzeZeugen(neuId); },
      /* Begegnung: an = Sterne stehen im Raum; kamera = Himmel ist verdeckt → pausieren */
      begegnung(aktiv, kamera) {
        if (!wurzel) return;
        ar = !!aktiv && !kamera;
        blick = null;
        pausiert = !!aktiv && !!kamera;
        wurzel.classList.toggle("ar", ar);
        if (!ar) { parGesetzt = null; parallaxe(); }
        laufe();
      },
      blick(alpha, beta) { if (ar) blick = { alpha, beta }; },
      neu() { if (wurzel) { laufe(); if (!an()) zeichne(performance.now()); } }
    };
  })();

  /* ============================================================
     Partikel: Funken, Buntglas-Scherben, Ringe, fliegende Zeichen
     ============================================================ */
  const Partikel = (function () {
    let cv = null, c, w = 0, h = 0, raf = 0, letzte = 0;
    const liste = [], fluege = [], schauer = [];
    const MAX = 520;

    function sichere() {
      if (cv) return;
      cv = document.createElement("canvas");
      cv.id = "fx-partikel";
      cv.setAttribute("aria-hidden", "true");
      document.body.appendChild(cv);
      c = cv.getContext("2d");
      messe();
      window.addEventListener("resize", messe);
    }
    function messe() {
      const s = dpr(2);
      w = window.innerWidth; h = window.innerHeight;
      cv.width = Math.round(w * s); cv.height = Math.round(h * s);
      c.setTransform(s, 0, 0, s, 0, 0);
    }
    function start() {
      if (raf) return;
      letzte = performance.now();
      raf = requestAnimationFrame(bild);
    }
    function wahl(v, std) { return Array.isArray(v) ? zuf(v[0], v[1]) : (v === undefined ? std : v); }

    function neu(p) {
      if (liste.length >= MAX) liste.shift();
      p.t = 0;
      liste.push(p);
    }

    function funken(ort, o) {
      if (!an()) return;
      sichere();
      o = o || {};
      const m = mitte(ort);
      const farben = o.farben || ["#f0d284", "#fff3c8", "#d4a73a"];
      const formen = o.formen || ["glut", "glut", "stern"];
      const n = o.anzahl || 18;
      const richtung = o.winkel === undefined ? -Math.PI / 2 : o.winkel;
      const streuung = o.streuung === undefined ? TAU : o.streuung;
      for (let i = 0; i < n; i++) {
        const wkl = richtung + (Math.random() - 0.5) * streuung;
        const tempo = wahl(o.kraft, zuf(2, 7));
        const form = formen[Math.floor(Math.random() * formen.length)];
        const p = {
          form, x: m.x + (o.radius ? Math.cos(wkl) * o.radius : 0), y: m.y + (o.radius ? Math.sin(wkl) * o.radius : 0),
          vx: Math.cos(wkl) * tempo, vy: Math.sin(wkl) * tempo,
          g: o.schwerkraft === undefined ? 0.1 : o.schwerkraft,
          zug: o.widerstand === undefined ? 0.965 : o.widerstand,
          dauer: wahl(o.dauer, zuf(600, 1300)),
          r: wahl(o.groesse, zuf(2, 5)),
          farbe: farben[Math.floor(Math.random() * farben.length)],
          rot: Math.random() * TAU, rv: zuf(-0.2, 0.2), kipp: Math.random() * TAU, kv: zuf(0.1, 0.3)
        };
        if (form === "scherbe") {
          const ecken = 3 + (Math.random() < 0.5 ? 1 : 0);
          p.pts = Array.from({ length: ecken }, (_, k) => {
            const a = (k / ecken) * TAU + zuf(-0.4, 0.4), d = p.r * zuf(1.2, 2.2);
            return [Math.cos(a) * d, Math.sin(a) * d];
          });
        }
        if (form === "zeichen") { p.zeichen = (o.zeichen || ["✦"])[Math.floor(Math.random() * (o.zeichen || ["✦"]).length)]; p.rv *= 0.3; }
        neu(p);
      }
      start();
    }

    /* Kreis, der sich ausbreitet (Stoßwelle aus Licht) */
    function ring(ort, o) {
      if (!an()) return;
      sichere();
      o = o || {};
      const m = mitte(ort);
      neu({ form: "ring", x: m.x, y: m.y, vx: 0, vy: 0, g: 0, zug: 1, dauer: o.dauer || 700, r0: o.von || 8, r1: o.radius || 150, breite: o.breite || 3, farbe: o.farbe || "#f0d284", rot: 0, rv: 0 });
      start();
    }

    /* Strahlenkranz, der kurz aufblitzt */
    function strahlen(ort, o) {
      if (!an()) return;
      sichere();
      o = o || {};
      const m = mitte(ort), n = o.anzahl || 14;
      for (let i = 0; i < n; i++) {
        neu({ form: "strahl", x: m.x, y: m.y, vx: 0, vy: 0, g: 0, zug: 1, dauer: (o.dauer || 800) * zuf(0.7, 1.1), wkl: (i / n) * TAU + zuf(-0.12, 0.12), l0: o.von || 30, l1: (o.laenge || 190) * zuf(0.6, 1.1), breite: zuf(1.5, 4), farbe: o.farbe || "#fff3c8", rot: 0, rv: 0 });
      }
      start();
    }

    /* Funken, die von einem Kreis nach innen gezogen werden (Festhalten) */
    function sog(ort, radius, farbe) {
      if (!an()) return;
      sichere();
      const m = mitte(ort), wkl = Math.random() * TAU, tempo = zuf(1.6, 2.6);
      neu({ form: "glut", x: m.x + Math.cos(wkl) * radius, y: m.y + Math.sin(wkl) * radius, vx: -Math.cos(wkl) * tempo, vy: -Math.sin(wkl) * tempo, g: 0, zug: 1.012, dauer: (radius / tempo) * 14, r: zuf(1.6, 3.2), farbe: farbe || "#f0d284", rot: 0, rv: 0 });
      start();
    }

    /* Ein Zeichen fliegt im Bogen von A nach B und zieht eine Lichtspur */
    function flug(von, zu, o) {
      o = o || {};
      if (!an()) { if (o.amZiel) o.amZiel(); return; }
      sichere();
      const a = mitte(von), b = mitte(zu);
      fluege.push({
        x0: a.x, y0: a.y, x1: b.x, y1: b.y,
        cx: (a.x + b.x) / 2 + zuf(-60, 60), cy: Math.min(a.y, b.y) - (o.bogen === undefined ? 90 : o.bogen),
        t: 0, dauer: o.dauer || 620, zeichen: o.zeichen || "✦", groesse: o.groesse || 34,
        farbe: o.farbe || "#f0d284", amZiel: o.amZiel
      });
      start();
    }

    /* Funkelregen von oben über die ganze Breite */
    function regen(o) {
      if (!an()) return;
      sichere();
      o = o || {};
      schauer.push({ bis: performance.now() + (o.dauer || 1600), farben: o.farben || ["#f0d284", "#fff3c8", "#d4a73a"], formen: o.formen || ["stern", "glut", "scherbe"], dichte: o.dichte || 3 });
      start();
    }

    function bild(t) {
      const dt = Math.min(50, t - letzte) / 16.667;
      letzte = t;
      c.clearRect(0, 0, w, h);

      for (let i = schauer.length - 1; i >= 0; i--) {
        const s = schauer[i];
        if (t > s.bis) { schauer.splice(i, 1); continue; }
        for (let k = 0; k < s.dichte; k++) {
          funken({ x: Math.random() * w, y: -12 }, { anzahl: 1, farben: s.farben, formen: s.formen, winkel: Math.PI / 2, streuung: 0.5, kraft: [1.5, 4.5], schwerkraft: 0.045, widerstand: 0.992, dauer: [1700, 2800], groesse: [2, 4.5] });
        }
      }

      for (let i = fluege.length - 1; i >= 0; i--) {
        const f = fluege[i];
        f.t += dt * 16.667;
        const k = Math.min(1, f.t / f.dauer), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, u = 1 - e;
        const x = u * u * f.x0 + 2 * u * e * f.cx + e * e * f.x1, y = u * u * f.y0 + 2 * u * e * f.cy + e * e * f.y1;
        neu({ form: "glut", x, y, vx: zuf(-0.4, 0.4), vy: zuf(-0.4, 0.4), g: 0, zug: 0.95, dauer: zuf(260, 480), r: zuf(1.8, 3.4), farbe: f.farbe, rot: 0, rv: 0 });
        c.globalAlpha = 1;
        c.font = `${Math.round(f.groesse * (1 - e * 0.45))}px system-ui, sans-serif`;
        c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText(f.zeichen, x, y);
        if (k >= 1) {
          fluege.splice(i, 1);
          funken({ x: f.x1, y: f.y1 }, { anzahl: 10, farben: [f.farbe, "#fff3c8"], kraft: [1.5, 4], dauer: [350, 700], groesse: [1.5, 3.5] });
          if (f.amZiel) { try { f.amZiel(); } catch (x) { /* Ansicht inzwischen weg */ } }
        }
      }

      for (let i = liste.length - 1; i >= 0; i--) {
        const p = liste[i];
        p.t += dt * 16.667;
        const k = p.t / p.dauer;
        if (k >= 1) { liste.splice(i, 1); continue; }
        p.vx *= Math.pow(p.zug, dt);
        p.vy = p.vy * Math.pow(p.zug, dt) + p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.rv * dt;
        const a = k < 0.08 ? k / 0.08 : 1 - Math.pow((k - 0.08) / 0.92, 2);

        if (p.form === "glut") {
          c.globalCompositeOperation = "lighter";
          c.globalAlpha = a;
          const g = p.r * 3.2 * (1 - k * 0.4);
          c.drawImage(glut(p.farbe), p.x - g, p.y - g, g * 2, g * 2);
        } else if (p.form === "stern") {
          c.globalCompositeOperation = "lighter";
          c.globalAlpha = a;
          const l = p.r * 2.6 * (0.6 + 0.4 * Math.sin(p.t / 90 + p.rot)), d = Math.max(0.6, p.r * 0.32);
          c.fillStyle = p.farbe;
          c.beginPath();
          c.moveTo(p.x - l, p.y); c.lineTo(p.x, p.y - d); c.lineTo(p.x + l, p.y); c.lineTo(p.x, p.y + d); c.closePath();
          c.moveTo(p.x, p.y - l); c.lineTo(p.x + d, p.y); c.lineTo(p.x, p.y + l); c.lineTo(p.x - d, p.y); c.closePath();
          c.fill();
          c.globalAlpha = a * 0.6;
          c.drawImage(glut(p.farbe), p.x - p.r * 3, p.y - p.r * 3, p.r * 6, p.r * 6);
        } else if (p.form === "scherbe") {
          c.globalCompositeOperation = "source-over";
          p.kipp += p.kv * dt;
          c.save();
          c.translate(p.x, p.y); c.rotate(p.rot); c.scale(1, Math.cos(p.kipp));
          c.globalAlpha = a * 0.92;
          c.fillStyle = p.farbe;
          c.beginPath();
          p.pts.forEach((q, n) => { if (n) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); });
          c.closePath(); c.fill();
          c.globalAlpha = a * 0.7;
          c.strokeStyle = "rgba(255,255,255,0.8)"; c.lineWidth = 0.9; c.stroke();
          c.restore();
        } else if (p.form === "ring") {
          c.globalCompositeOperation = "lighter";
          const e = 1 - Math.pow(1 - k, 3);
          c.globalAlpha = (1 - k) * 0.9;
          c.strokeStyle = p.farbe; c.lineWidth = Math.max(0.5, p.breite * (1 - k));
          c.beginPath(); c.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * e, 0, TAU); c.stroke();
        } else if (p.form === "strahl") {
          c.globalCompositeOperation = "lighter";
          const e = 1 - Math.pow(1 - k, 2);
          const i0 = p.l0 + (p.l1 - p.l0) * e * 0.5, i1 = p.l0 + (p.l1 - p.l0) * e;
          c.globalAlpha = (1 - k) * 0.75;
          c.strokeStyle = p.farbe; c.lineWidth = p.breite; c.lineCap = "round";
          c.beginPath();
          c.moveTo(p.x + Math.cos(p.wkl) * i0, p.y + Math.sin(p.wkl) * i0);
          c.lineTo(p.x + Math.cos(p.wkl) * i1, p.y + Math.sin(p.wkl) * i1);
          c.stroke();
        } else if (p.form === "zeichen") {
          c.globalCompositeOperation = "source-over";
          c.globalAlpha = a;
          c.save();
          c.translate(p.x, p.y); c.rotate(p.rot * 0.5);
          c.font = `${Math.round(p.r * 4)}px Georgia, serif`;
          c.textAlign = "center"; c.textBaseline = "middle";
          c.fillStyle = p.farbe;
          c.fillText(p.zeichen, 0, 0);
          c.restore();
        }
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";

      if (liste.length || fluege.length || schauer.length) raf = requestAnimationFrame(bild);
      else { raf = 0; c.clearRect(0, 0, w, h); }
    }

    return { funken, ring, strahlen, sog, flug, regen };
  })();

  /* Lichtblitz über den ganzen Bildschirm (weich, kurz) */
  function blitz(farbe, staerke) {
    if (!an()) return;
    const el = document.createElement("div");
    el.className = "fx-blitz";
    el.style.setProperty("--blitz", `rgba(${rgb(farbe || "#fff3c8")},${staerke === undefined ? 0.5 : staerke})`);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  /* Große Feier: Scherben in den Farben der Figur, Strahlen, Ring, Blitz */
  function feier(ort, farbe, o) {
    if (!an()) return;
    o = o || {};
    const pal = palette(farbe || "#d4a73a");
    Partikel.strahlen(ort, { farbe: pal[5], laenge: o.gross ? 260 : 170 });
    Partikel.ring(ort, { farbe: pal[3], radius: o.gross ? 240 : 150, breite: 4 });
    Partikel.funken(ort, { anzahl: o.gross ? 54 : 30, farben: pal, formen: ["scherbe", "scherbe", "stern", "glut"], kraft: [3, o.gross ? 13 : 9], schwerkraft: 0.16, dauer: [900, 1900], groesse: [2.5, 5.5] });
    blitz(pal[4], o.gross ? 0.5 : 0.28);
  }

  /* ============================================================
     Neigung des Handys (nur abonniert, solange jemand zuhört)
     ============================================================ */
  const Neigung = (function () {
    const hoerer = new Set();
    let nullG = null, nullB = null, aktiv = false, lauscht = false;
    function on(e) {
      if (e.gamma === null || e.beta === null || e.gamma === undefined) return;
      aktiv = true;
      if (nullG === null) { nullG = e.gamma; nullB = e.beta; }
      // Die Ruhelage wandert langsam mit — so passt es zu jeder Handhaltung
      nullG += (e.gamma - nullG) * 0.012; nullB += (e.beta - nullB) * 0.012;
      const x = klemme((e.gamma - nullG) / 20, -1, 1), y = klemme((e.beta - nullB) / 20, -1, 1);
      hoerer.forEach(fn => fn(x, y));
    }
    return {
      abonniere(fn) {
        hoerer.add(fn);
        if (!lauscht && "DeviceOrientationEvent" in window) { window.addEventListener("deviceorientation", on, { passive: true }); lauscht = true; }
        return () => {
          hoerer.delete(fn);
          if (!hoerer.size && lauscht) { window.removeEventListener("deviceorientation", on); lauscht = false; nullG = null; aktiv = false; }
        };
      },
      aktiv: () => aktiv
    };
  })();

  /* ============================================================
     Holo-Karte: kippt in 3D, Glanzlicht und Regenbogenfolie wandern mit.
     Quelle der Bewegung: Finger/Maus > Lagesensor > sanftes Schaukeln.
     Erwartet ein Element .neig (wird gekippt) mit einer .holo darin.
     ============================================================ */
  function holo(el, o) {
    if (!el) return;
    o = o || {};
    const max = o.max || 13;
    let rx = 0, ry = 0, zx = 0, zy = 0, zeigerBis = 0, raf = 0;
    const t0 = performance.now();

    function zeiger(e) {
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      zy = klemme(((e.clientX - r.left) / r.width - 0.5) * 2.2, -1, 1);
      zx = klemme(-((e.clientY - r.top) / r.height - 0.5) * 2.2, -1, 1);
      zeigerBis = performance.now() + 1500;
    }
    el.addEventListener("pointermove", zeiger);
    el.addEventListener("pointerdown", zeiger);
    const ab = Neigung.abonniere((x, y) => { if (performance.now() > zeigerBis) { zy = x; zx = -y; } });

    function ende() {
      cancelAnimationFrame(raf);
      ab();
      el.removeEventListener("pointermove", zeiger);
      el.removeEventListener("pointerdown", zeiger);
    }

    function bild(t) {
      if (!el.isConnected || el.offsetParent === null) { ende(); return; }
      if (!an()) { el.style.setProperty("--rx", 0); el.style.setProperty("--ry", 0); ende(); return; }
      if (t > zeigerBis && !Neigung.aktiv()) {
        const s = (t - t0) / 1000;
        zy = Math.sin(s * 0.85) * 0.6;
        zx = Math.cos(s * 0.62) * 0.38;
      }
      rx += (zx * max - rx) * 0.1;
      ry += (zy * max - ry) * 0.1;
      el.style.setProperty("--rx", rx.toFixed(2));
      el.style.setProperty("--ry", ry.toFixed(2));
      el.style.setProperty("--gx", (50 + ry * 3.1).toFixed(1) + "%");
      el.style.setProperty("--gy", (42 - rx * 3.1).toFixed(1) + "%");
      el.style.setProperty("--hx", (50 + ry * 2.6).toFixed(1) + "%");
      el.style.setProperty("--hy", (50 + rx * 2.6).toFixed(1) + "%");
      el.style.setProperty("--kraft", Math.min(1, Math.hypot(rx, ry) / max).toFixed(3));
      raf = requestAnimationFrame(bild);
    }
    raf = requestAnimationFrame(bild);
  }

  /* Die drei Schichten über einer Karte: Folie, Glitzer, Glanzlicht */
  function holoSchichten() {
    return '<span class="holo-folie" aria-hidden="true"></span><span class="holo-glitzer" aria-hidden="true"></span><span class="holo-glanz" aria-hidden="true"></span>';
  }

  /* Zahl hochzählen (z. B. "7 / 26") */
  function zaehle(el, ziel, dauer) {
    if (!el) return;
    if (!an()) { el.textContent = ziel; return; }
    const von = Math.max(0, ziel - Math.min(ziel, 6)), t0 = performance.now(), d = dauer || 700;
    (function schritt(t) {
      const k = Math.min(1, (t - t0) / d);
      el.textContent = Math.round(von + (ziel - von) * (1 - Math.pow(1 - k, 3)));
      if (k < 1 && el.isConnected) requestAnimationFrame(schritt);
    })(t0);
  }

  /* Papierkorn für Pergament und Karte: einmal erzeugt, als CSS-Variable --korn */
  function korn() {
    try {
      const k = document.createElement("canvas");
      k.width = k.height = 160;
      const g = k.getContext("2d");
      const bild = g.createImageData(160, 160), d = bild.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random();
        d[i] = 96; d[i + 1] = 70; d[i + 2] = 34;
        d[i + 3] = v < 0.5 ? 0 : Math.round((v - 0.5) * 2 * 46);
      }
      g.putImageData(bild, 0, 0);
      g.strokeStyle = "rgba(96,70,34,0.16)"; g.lineWidth = 0.6;
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * 160, y = Math.random() * 160, l = zuf(6, 22), a = Math.random() * TAU;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
      document.documentElement.style.setProperty("--korn", `url(${k.toDataURL("image/png")})`);
    } catch (e) { /* ohne Korn sieht es nur glatter aus */ }
  }

  /* Kleine Funken, wenn man goldene Knöpfe antippt */
  function tippFunken() {
    document.addEventListener("pointerdown", e => {
      const ziel = e.target && e.target.closest && e.target.closest(".btn-gold, .hinweis-karte.da, .tab, #nav button");
      if (!ziel || ziel.disabled) return;
      const gold = ziel.classList.contains("btn-gold") || ziel.classList.contains("da");
      Partikel.funken({ x: e.clientX, y: e.clientY }, { anzahl: gold ? 9 : 4, kraft: [1, gold ? 4.5 : 2.5], dauer: [300, 650], groesse: [1.4, 3], schwerkraft: 0.05 });
    }, { passive: true });
  }

  function klassen() {
    const h = document.documentElement;
    h.classList.add("fx");
    h.classList.toggle("fx-aus", !an());
  }

  function start() {
    klassen();
    korn();
    Himmel.start();
    tippFunken();
    if (mq && mq.addEventListener) mq.addEventListener("change", () => { klassen(); Himmel.neu(); });
  }

  window.Fx = {
    an, start,
    /* nach dem Umschalten unter "Mehr" */
    aktualisiere() { klassen(); Himmel.neu(); },
    himmel: Himmel,
    funken: Partikel.funken, ring: Partikel.ring, strahlen: Partikel.strahlen, sog: Partikel.sog,
    flug: Partikel.flug, regen: Partikel.regen,
    blitz, feier, holo, holoSchichten, zaehle,
    palette, rgb, mische, mitte
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
