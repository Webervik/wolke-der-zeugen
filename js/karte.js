/* Wolke der Zeugen — stilisierte SVG-Pilgerkarte.
   Statt Online-Kartendiensten: eine eigene Karte im Pergament-Stil.
   Dadurch keine Fremd-Requests (Datenschutz) und volle Offline-Fähigkeit.
   Projektion: äquirektangular — für ein Gebiet von wenigen Kilometern völlig ausreichend. */
(function () {
  const W = 800, H = 600, PAD = 90;

  const KURZNAMEN = {
    "dorfkirche": "Dorfkirche",
    "gartenstadt": "Gartenstadt",
    "heerstrasse-nord": "Heerstr. Nord",
    "ernst-lange-haus": "Ernst-Lange-Haus",
    "waldhaus": "Waldhaus",
    "zuversichtskirche": "Zuversicht"
  };

  // Reihenfolge des gestrichelten Pilgerwegs auf der Karte (geografischer Bogen West → Nord → Südost)
  const WEG_REIHENFOLGE = ["waldhaus", "dorfkirche", "gartenstadt", "zuversichtskirche", "ernst-lange-haus", "heerstrasse-nord"];

  function alleKoordinaten() {
    return window.Daten.orte.every(o => o.lat !== null && o.lng !== null);
  }

  /* Liefert {x,y} je Ort: echte Projektion, sonst Layout-Fallback. */
  function positionen() {
    const orte = window.Daten.orte;
    const map = {};
    if (alleKoordinaten()) {
      const lats = orte.map(o => o.lat), lngs = orte.map(o => o.lng);
      const latMin = Math.min(...lats), latMax = Math.max(...lats);
      const lngMin = Math.min(...lngs), lngMax = Math.max(...lngs);
      const latMitte = (latMin + latMax) / 2;
      const mProLat = 111320;
      const mProLng = 111320 * Math.cos(latMitte * Math.PI / 180);
      const spannX = Math.max((lngMax - lngMin) * mProLng, 1);
      const spannY = Math.max((latMax - latMin) * mProLat, 1);
      const skala = Math.min((W - 2 * PAD) / spannX, (H - 2 * PAD) / spannY);
      const offX = (W - spannX * skala) / 2;
      const offY = (H - spannY * skala) / 2;
      orte.forEach(o => {
        map[o.id] = {
          x: offX + (o.lng - lngMin) * mProLng * skala,
          y: offY + (latMax - o.lat) * mProLat * skala
        };
      });
      map.__projiziert = {
        zuXY(lat, lng) {
          return {
            x: offX + (lng - lngMin) * mProLng * skala,
            y: offY + (latMax - lat) * mProLat * skala
          };
        }
      };
    } else {
      orte.forEach(o => { map[o.id] = { x: o.layoutX * W, y: o.layoutY * H }; });
    }
    return map;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
      <circle r="26" fill="none" stroke="var(--gold-tief)" stroke-width="1.5" opacity="0.7"/>
      <path d="M0,-22 L5,0 L0,22 L-5,0 Z" fill="var(--gold-tief)" opacity="0.8"/>
      <path d="M-22,0 L0,-5 L22,0 L0,5 Z" fill="var(--gold-tief)" opacity="0.45"/>
      <text y="-30" text-anchor="middle" class="karte-kompass-n">N</text>
    </g>`;
  }

  function medaillon(ort, p) {
    const status = window.Geo.freischaltung(ort);
    const figur = window.Rotation.aktiveFigur(ort.id);
    const eventAktiv = window.Store.istEventAktiv();
    const offen = status.frei;
    const siegel = window.Store.hatSiegel(ort.id);
    const wartetBegegnung = offen && (eventAktiv
      ? window.Rotation.figurenAnOrt(ort.id).some(f => !window.Store.istGesammelt(f.id))
      : (figur && !window.Store.istGesammelt(figur.id)));

    let distanzText = "";
    if (!offen && status.distanz !== null && status.distanz > ort.radiusMeter) {
      const d = status.distanz;
      distanzText = d >= 1000 ? `~${(d / 1000).toFixed(1)} km` : `~${Math.round(d / 10) * 10} m`;
    }

    const ringKlasse = ort.denkmal ? "medaillon-ring denkmal" : "medaillon-ring";
    return `<g class="medaillon${wartetBegegnung ? " wartet" : ""}" data-ort="${ort.id}" transform="translate(${p.x},${p.y})" role="button" tabindex="0" aria-label="${esc(ort.name)}">
      ${wartetBegegnung ? `<circle class="medaillon-puls" r="34" fill="var(--gold)"/>` : ""}
      <circle r="30" fill="var(--pergament)" stroke="${ort.farbe}" stroke-width="3" class="${ringKlasse}"/>
      <text y="9" text-anchor="middle" class="medaillon-icon">${ort.icon}</text>
      ${siegel ? `<g transform="translate(20,-20)"><circle r="11" fill="var(--gold)" stroke="var(--gold-tief)"/><text y="4.5" text-anchor="middle" class="medaillon-siegel">✦</text></g>` : ""}
      <text y="50" text-anchor="middle" class="medaillon-name">${esc(KURZNAMEN[ort.id] || ort.name)}</text>
      ${ort.denkmal ? `<text y="64" text-anchor="middle" class="medaillon-jahre">${esc(ort.jahre || "")}</text>` : ""}
      ${distanzText ? `<text y="${ort.denkmal ? 78 : 64}" text-anchor="middle" class="medaillon-distanz">${distanzText}</text>` : ""}
    </g>`;
  }

  function render(container) {
    const pos = positionen();
    const orte = window.Daten.orte;

    let spieler = "";
    const xy = window.Geo.positionXY();
    if (xy && pos.__projiziert) {
      const p = pos.__projiziert.zuXY(xy.lat, xy.lng);
      if (p.x > 10 && p.x < W - 10 && p.y > 10 && p.y < H - 10) {
        spieler = `<g class="spieler" transform="translate(${p.x},${p.y})" aria-label="Deine Position">
          <circle class="spieler-puls" r="14" fill="var(--gold)"/>
          <circle r="7" fill="var(--gold)" stroke="var(--pergament)" stroke-width="2.5"/>
        </g>`;
      }
    }

    container.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" class="pilgerkarte" role="img" aria-label="Karte der Gemeindeorte in Staaken">
        <rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="14" fill="var(--pergament)"/>
        <rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="14" fill="url(#pergamentTon)" opacity="0.5"/>
        <rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="8" fill="none" stroke="var(--gold-tief)" stroke-width="1.5" opacity="0.65"/>
        <rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="6" fill="none" stroke="var(--gold-tief)" stroke-width="0.75" opacity="0.4"/>
        <defs>
          <radialGradient id="pergamentTon" cx="50%" cy="42%" r="75%">
            <stop offset="0%" stop-color="var(--pergament)"/>
            <stop offset="100%" stop-color="var(--pergament-tief)"/>
          </radialGradient>
        </defs>
        <text x="${W / 2}" y="52" text-anchor="middle" class="karte-titel">Staaken · Orte der Gemeinde</text>
        ${kompass(W - 70, 78)}
        <path d="${wegPfad(pos)}" fill="none" stroke="var(--gold-tief)" stroke-width="2.5" stroke-dasharray="2 9" stroke-linecap="round" opacity="0.8"/>
        ${orte.map(o => medaillon(o, pos[o.id])).join("")}
        ${spieler}
      </svg>`;

    container.querySelectorAll("[data-ort]").forEach(el => {
      const oeffnen = () => window.App.zeigeOrt(el.getAttribute("data-ort"));
      el.addEventListener("click", oeffnen);
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); oeffnen(); } });
    });
  }

  window.Karte = { render, KURZNAMEN };
})();
