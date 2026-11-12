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
      ebenen: `<g class="gruen">${gruen}</g><g class="gruen-muster">${gruen}</g><g class="wasser">${wasser}</g>
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
    let zacken = "";
    for (let i = 0; i < 8; i++) {
      const lang = i % 2 === 0, r = lang ? 24 : 13;
      zacken += `<path transform="rotate(${i * 45})" d="M0 ${-r} L${lang ? 4.5 : 3} 0 L0 0 Z" fill="var(--gold-tief)" opacity="${lang ? 0.9 : 0.6}"/>
                 <path transform="rotate(${i * 45})" d="M0 ${-r} L${lang ? -4.5 : -3} 0 L0 0 Z" fill="#f0d284" opacity="${lang ? 0.95 : 0.7}"/>`;
    }
    return `<g class="kompass" transform="translate(${x},${y})" aria-hidden="true">
      <circle r="31" fill="#f6ecd7" opacity="0.88"/>
      <circle r="30" fill="none" stroke="var(--gold-tief)" stroke-width="1.6" opacity="0.8"/>
      <circle r="26" fill="none" stroke="var(--gold-tief)" stroke-width="0.6" stroke-dasharray="1.5 3.6" opacity="0.8"/>
      ${zacken}
      <circle r="3" fill="#f6ecd7" stroke="var(--gold-tief)" stroke-width="1.2"/>
      <text y="-35" text-anchor="middle" class="karte-kompass-n">N</text>
    </g>`;
  }

  /* ---------- Zustand je Ort ---------- */
  function wartet(ort) {
    const status = window.Geo.freischaltung(ort);
    if (!status.frei) return false;
    if (window.Store.istEventAktiv()) {
      return window.Rotation.figurenAnOrt(ort.id).some(f => window.Store.brauchtBegegnung(f.id, status.art));
    }
    const figur = window.Rotation.aktiveFigur(ort.id);
    return !!figur && window.Store.brauchtBegegnung(figur.id, status.art);
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

  function medaillon(ort, p, seite, i) {
    const siegel = window.Store.hatSiegel(ort.id);
    const wartetBegegnung = wartet(ort);
    const klein = istNachbar(ort);
    const oben = seite === "oben";
    const yName = oben ? -42 : 50;
    const yJahre = oben ? -56 : 64;
    const yDist = oben ? (ort.denkmal ? -70 : -56) : (ort.denkmal ? 78 : 64);

    const ringKlasse = ort.denkmal ? "medaillon-ring denkmal" : "medaillon-ring";
    // Strahlen um einen Ort, an dem jemand wartet
    let strahlen = "";
    if (wartetBegegnung) {
      for (let k = 0; k < 12; k++) strahlen += `<path transform="rotate(${k * 30})" d="M-2.6 -35 L0 ${k % 2 ? -47 : -54} L2.6 -35 Z"/>`;
      strahlen = `<g class="medaillon-strahlen" fill="var(--gold)">${strahlen}</g>`;
    }
    return `<g class="medaillon${klein ? " nachbar" : ""}${wartetBegegnung ? " wartet" : ""}${siegel ? " besiegelt" : ""}" data-ort="${ort.id}" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})${klein ? ` scale(${NACHBAR_SKALA})` : ""}" role="button" tabindex="0" aria-label="${esc(ort.name)}${wartetBegegnung ? " — hier wartet jemand auf dich" : ""}">
      <g class="med-in" style="--i:${i}">
      <circle r="44" fill="transparent"/>
      ${strahlen}
      ${wartetBegegnung ? `<circle class="medaillon-puls" r="34" fill="var(--gold)"/>` : ""}
      <circle r="33" fill="#2b241d" opacity="0.22" transform="translate(1.5 3)"/>
      <circle r="30" fill="url(#med-glas)" stroke="${ort.farbe}" stroke-width="3.4" class="${ringKlasse}"/>
      <circle r="26.5" fill="none" stroke="${siegel ? "var(--gold)" : "#ffffff"}" stroke-width="${siegel ? 1.6 : 1}" opacity="${siegel ? 0.95 : 0.7}"/>
      <path d="M-19 -13 A 23 23 0 0 1 8 -22" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.75"/>
      <text y="9" text-anchor="middle" class="medaillon-icon">${ort.icon}</text>
      ${wartetBegegnung ? `<g class="medaillon-ruf" transform="translate(-22,-22)"><circle r="11.5" fill="url(#med-gold)" stroke="var(--gold-tief)"/><text y="4.5" text-anchor="middle" class="medaillon-siegel">!</text></g>` : ""}
      ${siegel ? `<g transform="translate(22,-22)"><circle r="11.5" fill="url(#med-gold)" stroke="var(--gold-tief)"/><text y="4.5" text-anchor="middle" class="medaillon-siegel">✦</text></g>` : ""}
      ${klein ? "" : `<text y="${yName}" text-anchor="middle" class="medaillon-name">${esc(kurzname(ort))}</text>
      ${ort.denkmal ? `<text y="${yJahre}" text-anchor="middle" class="medaillon-jahre">${esc(ort.jahre || "")}</text>` : ""}
      <text y="${yDist}" text-anchor="middle" class="medaillon-distanz" data-dist="${ort.id}">${distanzText(ort)}</text>`}
      </g>
    </g>`;
  }

  function spielerTransform() {
    const xy = window.Geo.positionXY();
    if (!xy || !projektion) return null;
    const p = projektion(xy.lat, xy.lng);
    if (p.x < 24 || p.x > W - 24 || p.y < 24 || p.y > H - 24) return null;
    return `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`;
  }

  /* Die Karte besteht aus zwei übereinanderliegenden Ebenen:
     - Grund (Pergament, Straßen, Rahmen): schwer, wird nur einmal gemalt
     - Ebene (Weg, Medaillons, eigener Standort): leicht, wird bei jedem
       Zustandswechsel neu gebaut und darf sich bewegen, ohne dass der Browser
       hunderte Straßen neu zeichnen muss. Dazwischen ziehen Wolkenschatten. */
  let ersteAnsicht = true;

  function grundSVG() {
    const hg = hintergrund();
    return `<svg viewBox="0 0 ${W} ${H}" class="pilgerkarte karte-grund" aria-hidden="true">
        <defs>
          <radialGradient id="pergamentTon" cx="50%" cy="42%" r="75%">
            <stop offset="0%" stop-color="#fbf3df"/>
            <stop offset="70%" stop-color="#eedfbb"/>
            <stop offset="100%" stop-color="#d9c192"/>
          </radialGradient>
          <radialGradient id="pergamentRand" cx="50%" cy="50%" r="72%">
            <stop offset="72%" stop-color="#6b4a16" stop-opacity="0"/>
            <stop offset="100%" stop-color="#6b4a16" stop-opacity="0.42"/>
          </radialGradient>
          <linearGradient id="kartenGold" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="${H}">
            <stop offset="0" stop-color="#8f6a1c"/><stop offset="0.25" stop-color="#f3d98c"/><stop offset="0.5" stop-color="#b98a26"/>
            <stop offset="0.75" stop-color="#fff1c2"/><stop offset="1" stop-color="#8f6a1c"/>
          </linearGradient>
          <pattern id="waldMuster" width="22" height="20" patternUnits="userSpaceOnUse">
            <path d="M6 14 l4 -9 l4 9 Z M10 14 v3" fill="#8fa06a" stroke="#7d8e5c" stroke-width="0.8" opacity="0.55"/>
            <path d="M17 6 l3 -6 l3 6 Z" fill="#8fa06a" opacity="0.35"/>
          </pattern>
          <clipPath id="kartenRahmen"><rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="6"/></clipPath>
          ${hg.defs}
        </defs>
        <rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="14" fill="url(#pergamentTon)"/>
        <ellipse cx="${W * 0.22}" cy="${H * 0.8}" rx="150" ry="90" fill="#a8823e" opacity="0.07"/>
        <ellipse cx="${W * 0.82}" cy="${H * 0.3}" rx="120" ry="80" fill="#a8823e" opacity="0.06"/>
        <g clip-path="url(#kartenRahmen)" class="karten-hintergrund">${hg.ebenen}</g>
        <rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="14" fill="url(#pergamentRand)"/>
        <rect x="13" y="13" width="${W - 26}" height="${H - 26}" rx="9" fill="none" stroke="url(#kartenGold)" stroke-width="3"/>
        <rect x="21" y="21" width="${W - 42}" height="${H - 42}" rx="5" fill="none" stroke="var(--gold-tief)" stroke-width="0.9" opacity="0.6"/>
        ${[[13, 13, 1, 1], [W - 13, 13, -1, 1], [13, H - 13, 1, -1], [W - 13, H - 13, -1, -1]].map(e =>
          `<g transform="translate(${e[0]},${e[1]}) scale(${e[2]},${e[3]})"><path d="M0 46 Q0 0 46 0 M8 30 Q10 10 30 8" fill="none" stroke="url(#kartenGold)" stroke-width="3"/><circle cx="14" cy="14" r="4.5" fill="url(#kartenGold)"/></g>`).join("")}
        <g class="kartusche">
          <path d="M34 36 h306 l-12 19 l12 19 h-306 l12 -19 Z" fill="#f6ecd7" stroke="url(#kartenGold)" stroke-width="1.8" opacity="0.96"/>
          <text x="187" y="62" text-anchor="middle" class="karte-titel">Staaken · Orte der Gemeinde</text>
        </g>
        ${kompass(W - 74, 96)}
        ${hg.quelle ? `<text x="30" y="${H - 28}" class="karte-quelle">${esc(hg.quelle)}</text>` : ""}
      </svg>`;
  }

  function ebeneInhalt(pos, seiten) {
    const orte = window.Daten.orte;
    const spieler = spielerTransform();
    const weg = wegPfad(pos);
    const lebendig = window.Fx.an();
    const lichter = (weg && lebendig) ? [0, -5.5, -11].map(start =>
      `<g class="weg-licht"><circle r="7" fill="#fff3c8" opacity="0.35"/><circle r="3" fill="#fffbe8"/>
         <animateMotion dur="16.5s" begin="${start}s" repeatCount="indefinite" path="${weg}"/></g>`).join("") : "";
    let i = 0;
    return `
      <defs>
        <radialGradient id="med-glas" cx="38%" cy="30%" r="80%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="45%" stop-color="#f6ecd7"/>
          <stop offset="100%" stop-color="#dcc79a"/>
        </radialGradient>
        <radialGradient id="med-gold" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stop-color="#fff3c8"/>
          <stop offset="60%" stop-color="#d4a73a"/>
          <stop offset="100%" stop-color="#a47a22"/>
        </radialGradient>
      </defs>
      <path d="${weg}" fill="none" stroke="#fff3c8" stroke-width="6" stroke-linecap="round" opacity="0.35"/>
      <path d="${weg}" fill="none" stroke="var(--gold-tief)" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round" opacity="0.95"/>
      ${lichter}
      ${orte.filter(istNachbar).map(o => pos[o.id].haupt ? `<line class="nachbar-linie" x1="${pos[o.id].haupt.x.toFixed(1)}" y1="${pos[o.id].haupt.y.toFixed(1)}" x2="${pos[o.id].x.toFixed(1)}" y2="${pos[o.id].y.toFixed(1)}"/>` : "").join("")}
      ${orte.filter(o => !istNachbar(o)).map(o => medaillon(o, pos[o.id], seiten[o.id], i++)).join("")}
      ${orte.filter(istNachbar).map(o => medaillon(o, pos[o.id], "unten", i++)).join("")}
      <g id="spieler" class="spieler" transform="${spieler || "translate(-100,-100)"}" style="${spieler ? "" : "display:none"}" aria-label="Deine Position">
        <circle class="spieler-puls" r="16" fill="var(--gold)"/>
        <circle r="13" fill="#fff3c8" opacity="0.45"/>
        <circle r="7.5" fill="url(#med-gold)" stroke="#ffffff" stroke-width="2.5"/>
      </g>`;
  }

  function render(container) {
    const pos = positionen();
    const seiten = labelSeiten(pos);
    nachbarnAnlegen(pos, seiten);

    const grundSig = window.Daten.orte.map(o => o.id + ":" + o.lat + ":" + o.lng).join("|");
    let stapel = container.querySelector(".karte-stapel");
    if (!stapel || stapel.dataset.sig !== grundSig) {
      container.innerHTML = `<div class="karte-stapel" role="img" aria-label="Karte der Gemeindeorte in Staaken">
        ${grundSVG()}
        <div class="karte-korn" aria-hidden="true"></div>
        <div class="karte-wolken" aria-hidden="true"><i></i><i></i><i></i></div>
        <svg viewBox="0 0 ${W} ${H}" class="karte-ebene${ersteAnsicht ? " neu" : ""}"></svg>
      </div>`;
      stapel = container.querySelector(".karte-stapel");
      stapel.dataset.sig = grundSig;
      ersteAnsicht = false;
    } else {
      stapel.querySelector(".karte-ebene").classList.remove("neu");
    }
    const ebene = stapel.querySelector(".karte-ebene");
    ebene.innerHTML = ebeneInhalt(pos, seiten);
    letzteSignatur = signatur();

    ebene.querySelectorAll("[data-ort]").forEach(el => {
      const oeffnen = () => window.App.zeigeOrt(el.getAttribute("data-ort"));
      el.addEventListener("click", oeffnen);
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); oeffnen(); } });
    });
  }

  /* Leichtes Update bei GPS-Fixes: nur Punkt + Entfernungen, Neuaufbau nur bei Zustandswechsel. */
  function aktualisiere(container) {
    if (!container || !container.querySelector(".karte-stapel") || signatur() !== letzteSignatur) {
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
