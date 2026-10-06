/* Wolke der Zeugen — stilisierte SVG-Pilgerkarte.
   Statt Online-Kartendiensten: eine eigene Karte im Pergament-Stil.
   Straßen, Bahn und Grünflächen stammen aus OpenStreetMap, sind aber fest in
   data/karte-hintergrund.json eingebacken — zur Laufzeit gibt es keine
   Fremd-Requests (Datenschutz) und die Karte funktioniert offline.
   Projektion: äquirektangular — für ein Gebiet von wenigen Kilometern völlig ausreichend.

   Wichtig: Die Karte wird nur bei echten Zustandswechseln neu aufgebaut.
   GPS-Fixes (mehrmals pro Sekunde möglich) verschieben nur den Positionspunkt
   und aktualisieren Entfernungen an Ort und Stelle — sonst gingen Taps
   verloren, die zufällig in einen Neuaufbau fallen. */
(function () {
  const W = 800, H = 800, PAD = 80; // quadratisch: das Gemeindegebiet ist mit Hohenlohe höher als breit
  const PAD_OBEN = 125;              // Platz für die Titel-Kartusche

  // Reihenfolge des gestrichelten Pilgerwegs auf der Karte (geografischer Bogen West → Nord → Südost).
  // Kitas und Hort liegen direkt neben einer Kirche ("nebenAn" in orte.json) und hängen dort als kleine Medaillons.
  const WEG_REIHENFOLGE = ["waldhaus", "dorfkirche", "hohenlohe", "gartenstadt", "zuversichtskirche", "staakentreff", "ernst-lange-haus", "heerstrasse-nord"];
  const NACHBAR_ABSTAND = 54;   // px vom Medaillon der Kirche
  const NACHBAR_SKALA = 0.62;

  function kurzname(o) { return o.kurzname || o.name; }
  function istNachbar(o) { return !!o.nebenAn; }

  const STRASSE_BREITE = { trunk: [8, 5], primary: [7, 4.4], secondary: [5, 3], tertiary: [3.4, 1.8] };

  let letzteSignatur = "";
  let projektion = null;

  function alleKoordinaten() {
    return window.Daten.orte.every(o => o.lat !== null && o.lng !== null);
  }

  /* Liefert {x,y} je Ort: echte Projektion, sonst Layout-Fallback. */
  function positionen() {
    const orte = window.Daten.orte;
    const map = {};
    projektion = null;
    if (alleKoordinaten()) {
      const lats = orte.map(o => o.lat), lngs = orte.map(o => o.lng);
      const latMin = Math.min(...lats), latMax = Math.max(...lats);
      const lngMin = Math.min(...lngs), lngMax = Math.max(...lngs);
      const latMitte = (latMin + latMax) / 2;
      const mProLat = 111320;
      const mProLng = 111320 * Math.cos(latMitte * Math.PI / 180);
      const spannX = Math.max((lngMax - lngMin) * mProLng, 1);
      const spannY = Math.max((latMax - latMin) * mProLat, 1);
      const skala = Math.min((W - 2 * PAD) / spannX, (H - PAD - PAD_OBEN) / spannY);
      const offX = (W - spannX * skala) / 2;
      const offY = PAD_OBEN + (H - PAD - PAD_OBEN - spannY * skala) / 2;
      projektion = (lat, lng) => ({
        x: offX + (lng - lngMin) * mProLng * skala,
        y: offY + (latMax - lat) * mProLat * skala
      });
      orte.forEach(o => { map[o.id] = projektion(o.lat, o.lng); });
    } else {
      orte.forEach(o => { map[o.id] = { x: o.layoutX * W, y: o.layoutY * H }; });
    }
    return map;
  }

  /* Nachbarorte liegen oft nur 30–140 m neben der Kirche — auf der Karte wären sie
     deckungsgleich. Sie wandern deshalb seitlich neben das Kirchen-Medaillon,
     in ihrer echten Himmelsrichtung, aber nie unter den Namen (unten) oder darüber. */
  function nachbarnAnlegen(map, seiten) {
    const orte = window.Daten.orte;
    const proHaupt = {};
    orte.filter(istNachbar).forEach(o => {
      const h = map[o.nebenAn], p = map[o.id];
      if (!h || !p) return;
      const rechts = p.x >= h.x;
      let winkel = Math.atan2(p.y - h.y, p.x - h.x) * 180 / Math.PI; // 0° = rechts, 90° = unten
      // erlaubte Bereiche weg vom Namen: Name unten → rechts −60°…20°, links 160°…240°;
      // Name oben → rechts −20°…60°, links 120°…200°
      const oben = seiten && seiten[o.nebenAn] === "oben";
      const [r1, r2] = oben ? [-20, 60] : [-60, 20];
      const [l1, l2] = oben ? [120, 200] : [160, 240];
      if (rechts) winkel = Math.max(r1, Math.min(r2, winkel));
      else { if (winkel < 0) winkel += 360; winkel = Math.max(l1, Math.min(l2, winkel)); }
      (proHaupt[o.nebenAn] = proHaupt[o.nebenAn] || []).push({ o, winkel, rechts });
    });
    Object.keys(proHaupt).forEach(hid => {
      const h = map[hid];
      const liste = proHaupt[hid];
      // Zwei Nachbarn auf derselben Seite: den zweiten weiter nach oben schieben
      [true, false].forEach(seite => {
        const teil = liste.filter(n => n.rechts === seite).sort((a, b) => seite ? b.winkel - a.winkel : a.winkel - b.winkel);
        teil.forEach((n, i) => { if (i > 0) n.winkel += seite ? -50 * i : 50 * i; });
      });
      liste.forEach(n => {
        const r = n.winkel * Math.PI / 180;
        map[n.o.id] = { x: h.x + Math.cos(r) * NACHBAR_ABSTAND, y: h.y + Math.sin(r) * NACHBAR_ABSTAND, haupt: h };
      });
    });
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---------- Hintergrund aus OpenStreetMap ---------- */
  function pfad(punkte, schliessen) {
    let d = "";
    punkte.forEach((p, i) => {
      const q = projektion(p[0], p[1]);
      d += (i ? " L" : "M") + q.x.toFixed(1) + " " + q.y.toFixed(1);
    });
    return schliessen ? d + " Z" : d;
  }

  function hintergrund() {
    const hg = window.Daten.hintergrund;
    if (!hg || !projektion) return { defs: "", ebenen: "", quelle: "" };

    const gruen = hg.gruen.map(p => `<path d="${pfad(p, true)}"/>`).join("");
    const wasser = hg.wasser.map(p => `<path d="${pfad(p, true)}"/>`).join("");

    const nachRang = ["tertiary", "secondary", "primary", "trunk"];
    const strassen = nachRang.map(k => {
      const teile = hg.strassen.filter(s => s.k === k).map(s => pfad(s.p)).join(" ");
      if (!teile) return "";
      const [aussen, innen] = STRASSE_BREITE[k];
      return `<path class="strasse-rand" d="${teile}" stroke-width="${aussen}"/>
              <path class="strasse-innen" d="${teile}" stroke-width="${innen}"/>`;
    }).join("");

    const bahnD = hg.bahn.map(p => pfad(p)).join(" ");
    const bahn = bahnD
      ? `<path class="bahn-grund" d="${bahnD}"/><path class="bahn-schwellen" d="${bahnD}"/>`
      : "";

    // Straßennamen entlang der Straße — nur auf dem sichtbaren Stück (sonst werden sie
    // am Rand abgeschnitten), immer lesbar von links nach rechts
    let labelDefs = "", labels = "";
    const drin = q => q.x > 40 && q.x < W - 40 && q.y > 80 && q.y < H - 40;
    hg.labels.forEach((l, i) => {
      let lauf = [], bester = [];
      l.p.map(p => projektion(p[0], p[1])).forEach(q => {
        if (drin(q)) { lauf.push(q); if (lauf.length > bester.length) bester = lauf.slice(); }
        else lauf = [];
      });
      let laenge = 0;
      for (let k = 1; k < bester.length; k++) laenge += Math.hypot(bester[k].x - bester[k - 1].x, bester[k].y - bester[k - 1].y);
      if (laenge < l.n.length * 7.5 + 30) return; // zu kurz für den Namen
      if (bester[0].x > bester[bester.length - 1].x) bester.reverse();
      const d = bester.map((q, k) => (k ? "L" : "M") + q.x.toFixed(1) + " " + q.y.toFixed(1)).join(" ");
      labelDefs += `<path id="strassenlabel-${i}" d="${d}"/>`;
      labels += `<text class="strassen-name" dy="-5"><textPath href="#strassenlabel-${i}" startOffset="50%" text-anchor="middle">${esc(l.n)}</textPath></text>`;
    });

    return {
      defs: labelDefs,
      ebenen: `<g class="gruen">${gruen}</g><g class="wasser">${wasser}</g>
               <g class="strassen">${strassen}</g><g class="bahn">${bahn}</g>
               <g class="strassen-namen">${labels}</g>`,
      quelle: hg.quelle || ""
    };
  }

  function wegPfad(pos) {
    const pts = WEG_REIHENFOLGE.map(id => pos[id]).filter(Boolean);
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      // sanfte Kurve über einen leicht versetzten Mittelpunkt
      const nx = mx + (b.y - a.y) * 0.15, ny = my - (b.x - a.x) * 0.15;
      d += ` Q ${nx} ${ny} ${b.x} ${b.y}`;
    }
    return d;
  }

  function kompass(x, y) {
    return `<g class="kompass" transform="translate(${x},${y})" aria-hidden="true">
      <circle r="27" fill="var(--pergament)" opacity="0.85"/>
      <circle r="26" fill="none" stroke="var(--gold-tief)" stroke-width="1.5" opacity="0.7"/>
      <path d="M0,-22 L5,0 L0,22 L-5,0 Z" fill="var(--gold-tief)" opacity="0.8"/>
      <path d="M-22,0 L0,-5 L22,0 L0,5 Z" fill="var(--gold-tief)" opacity="0.45"/>
      <text y="-30" text-anchor="middle" class="karte-kompass-n">N</text>
    </g>`;
  }

  /* ---------- Zustand je Ort ---------- */
  function wartet(ort) {
    const status = window.Geo.freischaltung(ort);
    if (!status.frei) return false;
    if (window.Store.istEventAktiv()) {
      return window.Rotation.figurenAnOrt(ort.id).some(f => !window.Store.istGesammelt(f.id));
    }
    const figur = window.Rotation.aktiveFigur(ort.id);
    return !!figur && !window.Store.istGesammelt(figur.id);
  }

  function distanzText(ort) {
    const status = window.Geo.freischaltung(ort);
    if (status.frei || status.distanz === null || status.distanz <= ort.radiusMeter) return "";
    const d = status.distanz;
    return d >= 1000 ? `~${(d / 1000).toFixed(1)} km` : `~${Math.round(d / 10) * 10} m`;
  }

  /* Signatur aller sichtbaren Zustände — ändert sie sich, wird neu aufgebaut. */
  function signatur() {
    return window.Daten.orte.map(o =>
      o.id + ":" + window.Geo.freischaltung(o).frei + ":" + wartet(o) + ":" + window.Store.hatSiegel(o.id)
    ).join("|") + "|" + window.Store.istEventAktiv() + "|" + window.Store.anzahlGesammelt();
  }

  /* Beschriftungen, die sich überlappen würden: die obere wandert über das Medaillon. */
  function labelSeiten(pos) {
    const orte = window.Daten.orte.filter(o => !istNachbar(o));
    const seite = {};
    const box = o => {
      const w = kurzname(o).length * 8.6 + 12;
      return { x1: pos[o.id].x - w / 2, x2: pos[o.id].x + w / 2, y1: pos[o.id].y + 38, y2: pos[o.id].y + 82 };
    };
    orte.forEach(o => { seite[o.id] = "unten"; });
    for (let i = 0; i < orte.length; i++) {
      for (let j = i + 1; j < orte.length; j++) {
        const a = box(orte[i]), b = box(orte[j]);
        const ueberlappt = a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
        if (ueberlappt) {
          const oben = pos[orte[i].id].y <= pos[orte[j].id].y ? orte[i] : orte[j];
          seite[oben.id] = "oben";
        }
      }
    }
    return seite;
  }

  function medaillon(ort, p, seite) {
    const siegel = window.Store.hatSiegel(ort.id);
    const wartetBegegnung = wartet(ort);
    const klein = istNachbar(ort);
    const oben = seite === "oben";
    const yName = oben ? -42 : 50;
    const yJahre = oben ? -56 : 64;
    const yDist = oben ? (ort.denkmal ? -70 : -56) : (ort.denkmal ? 78 : 64);

    const ringKlasse = ort.denkmal ? "medaillon-ring denkmal" : "medaillon-ring";
    return `<g class="medaillon${klein ? " nachbar" : ""}${wartetBegegnung ? " wartet" : ""}" data-ort="${ort.id}" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})${klein ? ` scale(${NACHBAR_SKALA})` : ""}" role="button" tabindex="0" aria-label="${esc(ort.name)}${wartetBegegnung ? " — hier wartet jemand auf dich" : ""}">
      <circle r="44" fill="transparent"/>
      ${wartetBegegnung ? `<circle class="medaillon-puls" r="34" fill="var(--gold)"/>` : ""}
      <circle r="30" fill="var(--pergament)" stroke="${ort.farbe}" stroke-width="3" class="${ringKlasse}"/>
      <text y="9" text-anchor="middle" class="medaillon-icon">${ort.icon}</text>
      ${wartetBegegnung ? `<g transform="translate(-22,-22)"><circle r="11" fill="var(--gold)" stroke="var(--gold-tief)"/><text y="4.5" text-anchor="middle" class="medaillon-siegel">!</text></g>` : ""}
      ${siegel ? `<g transform="translate(22,-22)"><circle r="11" fill="var(--gold)" stroke="var(--gold-tief)"/><text y="4.5" text-anchor="middle" class="medaillon-siegel">✦</text></g>` : ""}
      ${klein ? "" : `<text y="${yName}" text-anchor="middle" class="medaillon-name">${esc(kurzname(ort))}</text>
      ${ort.denkmal ? `<text y="${yJahre}" text-anchor="middle" class="medaillon-jahre">${esc(ort.jahre || "")}</text>` : ""}
      <text y="${yDist}" text-anchor="middle" class="medaillon-distanz" data-dist="${ort.id}">${distanzText(ort)}</text>`}
    </g>`;
  }

  function spielerTransform() {
    const xy = window.Geo.positionXY();
    if (!xy || !projektion) return null;
    const p = projektion(xy.lat, xy.lng);
    if (p.x < 24 || p.x > W - 24 || p.y < 24 || p.y > H - 24) return null;
    return `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`;
  }

  function render(container) {
    const pos = positionen();
    const orte = window.Daten.orte;
    const seiten = labelSeiten(pos);
    nachbarnAnlegen(pos, seiten);
    const hg = hintergrund();
    const spieler = spielerTransform();

    container.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" class="pilgerkarte" role="img" aria-label="Karte der Gemeindeorte in Staaken">
        <defs>
          <radialGradient id="pergamentTon" cx="50%" cy="42%" r="75%">
            <stop offset="0%" stop-color="var(--pergament)"/>
            <stop offset="100%" stop-color="var(--pergament-tief)"/>
          </radialGradient>
          <clipPath id="kartenRahmen"><rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="6"/></clipPath>
          ${hg.defs}
        </defs>
        <rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="14" fill="var(--pergament)"/>
        <rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="14" fill="url(#pergamentTon)" opacity="0.5"/>
        <g clip-path="url(#kartenRahmen)" class="karten-hintergrund">${hg.ebenen}</g>
        <rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="8" fill="none" stroke="var(--gold-tief)" stroke-width="1.5" opacity="0.65"/>
        <rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="6" fill="none" stroke="var(--gold-tief)" stroke-width="0.75" opacity="0.4"/>
        <g class="kartusche">
          <rect x="30" y="30" width="300" height="36" rx="6" fill="var(--pergament)" stroke="var(--gold-tief)" stroke-width="1" opacity="0.94"/>
          <text x="180" y="55" text-anchor="middle" class="karte-titel">Staaken · Orte der Gemeinde</text>
        </g>
        ${kompass(W - 70, 100)}
        <path d="${wegPfad(pos)}" fill="none" stroke="var(--gold-tief)" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round" opacity="0.9"/>
        ${orte.filter(istNachbar).map(o => pos[o.id].haupt ? `<line class="nachbar-linie" x1="${pos[o.id].haupt.x.toFixed(1)}" y1="${pos[o.id].haupt.y.toFixed(1)}" x2="${pos[o.id].x.toFixed(1)}" y2="${pos[o.id].y.toFixed(1)}"/>` : "").join("")}
        ${orte.filter(o => !istNachbar(o)).map(o => medaillon(o, pos[o.id], seiten[o.id])).join("")}
        ${orte.filter(istNachbar).map(o => medaillon(o, pos[o.id], "unten")).join("")}
        <g id="spieler" class="spieler" transform="${spieler || "translate(-100,-100)"}" style="${spieler ? "" : "display:none"}" aria-label="Deine Position">
          <circle class="spieler-puls" r="14" fill="var(--gold)"/>
          <circle r="7" fill="var(--gold)" stroke="var(--pergament)" stroke-width="2.5"/>
        </g>
        ${hg.quelle ? `<text x="28" y="${H - 26}" class="karte-quelle">${esc(hg.quelle)}</text>` : ""}
      </svg>`;

    letzteSignatur = signatur();

    container.querySelectorAll("[data-ort]").forEach(el => {
      const oeffnen = () => window.App.zeigeOrt(el.getAttribute("data-ort"));
      el.addEventListener("click", oeffnen);
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); oeffnen(); } });
    });
  }

  /* Leichtes Update bei GPS-Fixes: nur Punkt + Entfernungen, Neuaufbau nur bei Zustandswechsel. */
  function aktualisiere(container) {
    if (!container || !container.querySelector("svg.pilgerkarte") || signatur() !== letzteSignatur) {
      if (container) render(container);
      return;
    }
    const g = container.querySelector("#spieler");
    const t = spielerTransform();
    if (g) {
      if (t) { g.setAttribute("transform", t); g.style.display = ""; }
      else g.style.display = "none";
    }
    window.Daten.orte.forEach(o => {
      const el = container.querySelector(`[data-dist="${o.id}"]`);
      if (el) {
        const txt = distanzText(o);
        if (el.textContent !== txt) el.textContent = txt;
      }
    });
  }

  window.Karte = { render, aktualisiere, kurzname };
})();
