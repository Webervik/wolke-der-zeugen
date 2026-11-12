/* Wolke der Zeugen — illuminierte Sammelkarten, Album & Kirchenfenster.
   Karten werden als SVG generiert: Pergament, Goldrahmen nach Bedeutsamkeit
   ("Seltenheit" = Pracht der Illumination, keine künstliche Verknappung).
   In der Einzelansicht liegt die Karte in einer Holo-Hülle (js/fx.js): Sie kippt
   in 3D, Glanzlicht und Folie wandern mit Finger oder Handyneigung. */
(function () {
  const KW = 300, KH = 420;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* Dezente Themen-Muster hinter dem Medaillon */
  function musterSVG(muster, farbe) {
    const o = 0.18;
    switch (muster) {
      case "strahlen": {
        let s = "";
        for (let i = 0; i < 12; i++) {
          const a = (i * 30) * Math.PI / 180;
          s += `<line x1="${150 + Math.cos(a) * 52}" y1="${140 + Math.sin(a) * 52}" x2="${150 + Math.cos(a) * 95}" y2="${140 + Math.sin(a) * 95}" stroke="${farbe}" stroke-width="3" opacity="${o}" stroke-linecap="round"/>`;
        }
        return s;
      }
      case "wellen": {
        let s = "";
        for (let y = 70; y <= 210; y += 28) {
          s += `<path d="M40 ${y} Q 77 ${y - 14} 115 ${y} T 190 ${y} T 260 ${y}" fill="none" stroke="${farbe}" stroke-width="3" opacity="${o}"/>`;
        }
        return s;
      }
      case "ranken":
        return `<path d="M55 225 Q 90 160 70 100 Q 62 70 90 55 M70 100 Q 110 105 125 75 M245 225 Q 210 160 230 100 Q 238 70 210 55 M230 100 Q 190 105 175 75" fill="none" stroke="${farbe}" stroke-width="3.5" opacity="${o}" stroke-linecap="round"/>
          <circle cx="90" cy="55" r="5" fill="${farbe}" opacity="${o}"/><circle cx="210" cy="55" r="5" fill="${farbe}" opacity="${o}"/>`;
      case "noten":
        return `<g fill="${farbe}" opacity="${o}" font-size="42" font-family="Georgia, serif">
          <text x="52" y="105">♪</text><text x="228" y="88">♫</text><text x="66" y="205">♬</text><text x="222" y="196">♪</text></g>`;
      case "weg":
        return `<path d="M45 235 Q 110 190 90 130 Q 75 85 150 62 Q 225 42 255 90" fill="none" stroke="${farbe}" stroke-width="4" opacity="${o}" stroke-dasharray="2 12" stroke-linecap="round"/>`;
      case "sterne": {
        const pts = [[60, 80], [240, 70], [50, 190], [250, 175], [95, 55], [205, 215]];
        return pts.map(([x, y], i) =>
          `<path transform="translate(${x},${y}) scale(${0.7 + (i % 3) * 0.3})" d="M0,-9 L2.2,-2.2 L9,0 L2.2,2.2 L0,9 L-2.2,2.2 L-9,0 L-2.2,-2.2 Z" fill="${farbe}" opacity="${o}"/>`).join("");
      }
      default:
        return "";
    }
  }

  /* Rahmenpracht nach Bedeutsamkeit — g = Goldverlauf der Karte */
  function rahmenSVG(seltenheit, g) {
    const einfach = `<rect x="12" y="12" width="${KW - 24}" height="${KH - 24}" rx="12" fill="none" stroke="${g}" stroke-width="2.4"/>`;
    if (seltenheit === "gewoehnlich") return einfach;
    const doppelt = einfach + `<rect x="20" y="20" width="${KW - 40}" height="${KH - 40}" rx="8" fill="none" stroke="${g}" stroke-width="1" opacity="0.8"/>`;
    if (seltenheit === "besonders") {
      const ecke = (x, y, sx, sy) => `<g transform="translate(${x},${y}) scale(${sx},${sy})"><path d="M0 18 Q 0 0 18 0" fill="none" stroke="${g}" stroke-width="2.5"/><circle cx="7" cy="7" r="3" fill="${g}"/></g>`;
      return doppelt + ecke(26, 26, 1, 1) + ecke(KW - 26, 26, -1, 1) + ecke(26, KH - 26, 1, -1) + ecke(KW - 26, KH - 26, -1, -1);
    }
    // legende: voll illuminierte Ecken
    const pracht = (x, y, sx, sy) => `<g transform="translate(${x},${y}) scale(${sx},${sy})">
      <path d="M0 34 Q 0 0 34 0 M0 22 Q 0 0 22 0 M4 46 Q 10 18 46 4" fill="none" stroke="${g}" stroke-width="2.5"/>
      <circle cx="12" cy="12" r="4.5" fill="${g}"/>
      <path d="M28 10 q 6 -6 12 0 q -6 6 -12 0 M10 28 q -6 6 0 12 q 6 -6 0 -12" fill="${g}" opacity="0.9"/></g>`;
    return doppelt +
      pracht(26, 26, 1, 1) + pracht(KW - 26, 26, -1, 1) + pracht(26, KH - 26, 1, -1) + pracht(KW - 26, KH - 26, -1, -1) +
      `<path d="M${KW / 2 - 34} 22 h68 M${KW / 2 - 34} ${KH - 22} h68" stroke="${g}" stroke-width="2.5"/>
       <circle cx="${KW / 2}" cy="22" r="4" fill="${g}"/><circle cx="${KW / 2}" cy="${KH - 22}" r="4" fill="${g}"/>`;
  }

  const SELTENHEIT_LABEL = { gewoehnlich: "Zeugnis", besonders: "Besonderes Zeugnis", legende: "Legende des Glaubens" };

  // Jede Karte bekommt eigene IDs — dieselbe Figur kann gleichzeitig in
  // Album, Zeremonie und Detailansicht im Dokument stehen.
  let zaehler = 0;

  // Spitzbogen-Fenster, in dem die Lichtgestalt steht
  const FENSTER = `M90 226 L90 92 A60 60 0 0 1 210 92 L210 226 Z`;
  const FENSTERSTERNE = [[104, 78, 1.1], [196, 96, 0.9], [118, 52, 0.8], [182, 60, 1.2], [100, 150, 0.8], [200, 170, 1], [150, 42, 0.9]];

  function fensterMitGestalt(figur, uid, unbekannt, gold) {
    const rand = unbekannt ? "var(--sternennebel)" : gold;
    return `
      <path d="${FENSTER}" fill="url(#${uid}-nacht)"/>
      <g clip-path="url(#${uid}-fc)">
        ${FENSTERSTERNE.map(s => `<circle cx="${s[0]}" cy="${s[1]}" r="${s[2]}" fill="#fff3c8" opacity="${unbekannt ? 0.3 : 0.75}"/>`).join("")}
        ${unbekannt ? "" : `<path d="M150 22 L96 236 L122 236 Z M150 22 L138 236 L162 236 Z M150 22 L178 236 L204 236 Z" fill="#fff3c8" opacity="0.07"/>
        <ellipse cx="150" cy="140" rx="56" ry="92" fill="url(#${uid}-aura)"/>`}
      </g>
      <svg x="99" y="40" width="102" height="174" viewBox="0 0 200 340">${window.Gestalt.svg(figur, { praefix: uid, unbekannt }).replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")}</svg>
      <path d="${FENSTER}" fill="none" stroke="${rand}" stroke-width="4.5"/>
      <path d="${FENSTER}" fill="none" stroke="#2b1f0c" stroke-width="1" opacity="${unbekannt ? 0 : 0.45}" transform="translate(150 132) scale(0.965) translate(-150 -132)"/>
      <path d="${FENSTER}" fill="none" stroke="${unbekannt ? "var(--wolke)" : gold}" stroke-width="1.5" opacity="0.8" transform="translate(150 132) scale(1.07) translate(-150 -132)"/>
      <path d="M80 229 h140" stroke="${rand}" stroke-width="3.2" stroke-linecap="round"/>`;
  }

  function verlaeufe(uid, farbe) {
    return `<radialGradient id="${uid}-nacht" cx="50%" cy="40%" r="70%">
        <stop offset="0%" stop-color="#31457a"/>
        <stop offset="100%" stop-color="#0f1630"/>
      </radialGradient>
      <radialGradient id="${uid}-aura" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${farbe}" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="${farbe}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${uid}-gold" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${KW}" y2="${KH}">
        <stop offset="0" stop-color="#8f6a1c"/><stop offset="0.2" stop-color="#f3d98c"/><stop offset="0.42" stop-color="#bd8c27"/>
        <stop offset="0.68" stop-color="#fff1c2"/><stop offset="0.86" stop-color="#c2912a"/><stop offset="1" stop-color="#8f6a1c"/>
      </linearGradient>
      <clipPath id="${uid}-fc"><path d="${FENSTER}"/></clipPath>`;
  }

  function funkelstern(x, y, s, farbe) {
    return `<path transform="translate(${x},${y}) scale(${s})" d="M0,-9 L1.8,-1.8 L9,0 L1.8,1.8 L0,9 L-1.8,1.8 L-9,0 L-1.8,-1.8 Z" fill="${farbe}"/>`;
  }

  function kartenSVG(figur, opts) {
    opts = opts || {};
    const info = window.Store.get().gesammelt[figur.id];
    const glanz = opts.glanz !== undefined ? opts.glanz : (info && info.glanz);
    const probelauf = info && info.verifikation === "demo";
    const ort = window.Daten.orte.find(o => o.id === figur.ortId);
    const uid = "k" + (++zaehler);
    const g = `url(#${uid}-gold)`;

    return `<svg viewBox="0 0 ${KW} ${KH}" class="zeugenkarte s-${figur.seltenheit}${glanz ? " glanz" : ""}" role="img" aria-label="Karte: ${esc(figur.name)}">
      <defs>
        <radialGradient id="${uid}-kt" cx="50%" cy="35%" r="80%">
          <stop offset="0%" stop-color="#fbf3df"/>
          <stop offset="100%" stop-color="#e3cfa4"/>
        </radialGradient>
        <radialGradient id="${uid}-rand" cx="50%" cy="46%" r="72%">
          <stop offset="62%" stop-color="#7a5418" stop-opacity="0"/>
          <stop offset="100%" stop-color="#7a5418" stop-opacity="0.3"/>
        </radialGradient>
        ${verlaeufe(uid, figur.farbe)}
        ${glanz ? `<linearGradient id="${uid}-foil" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff1c2" stop-opacity="0"/>
          <stop offset="50%" stop-color="#fff1c2" stop-opacity="0.34"/>
          <stop offset="100%" stop-color="#fff1c2" stop-opacity="0"/>
        </linearGradient>` : ""}
      </defs>
      <rect x="4" y="4" width="${KW - 8}" height="${KH - 8}" rx="16" fill="url(#${uid}-kt)"/>
      <ellipse cx="70" cy="330" rx="60" ry="34" fill="#a8823e" opacity="0.07"/>
      <ellipse cx="240" cy="70" rx="48" ry="30" fill="#a8823e" opacity="0.06"/>
      <rect x="4" y="4" width="${KW - 8}" height="${KH - 8}" rx="16" fill="url(#${uid}-rand)" stroke="${g}" stroke-width="1.6"/>
      ${musterSVG(figur.muster, figur.farbe)}
      ${rahmenSVG(figur.seltenheit, g)}
      ${fensterMitGestalt(figur, uid, false, g)}
      <text x="${KW / 2}" y="258" text-anchor="middle" class="karte-name"${figur.name.length > 19 ? ` style="font-size:${Math.floor(540 / figur.name.length)}px"` : ""}>${esc(figur.name)}</text>
      <text x="${KW / 2}" y="280" text-anchor="middle" class="karte-beiname"${figur.beiname.length > 34 ? ` style="font-size:${Math.floor(510 / figur.beiname.length)}px"` : ""}>${esc(figur.beiname)}</text>
      <path d="M112 292 h28 M160 292 h28" stroke="${g}" stroke-width="1.3"/>
      <path d="M150 287 l5 5 l-5 5 l-5 -5 Z" fill="${g}"/>
      <rect x="${KW / 2 - 82}" y="305" width="164" height="30" rx="15" fill="${figur.farbe}" fill-opacity="0.15" stroke="${figur.farbe}" stroke-opacity="0.45"/>
      <text x="${KW / 2}" y="325" text-anchor="middle" class="karte-thema" fill="${figur.farbe}">${esc(figur.themaLabel)}</text>
      <text x="${KW / 2}" y="364" text-anchor="middle" class="karte-ort">${esc(ort ? ort.kurzname || ort.name : "")} ${ort ? ort.icon : ""}</text>
      <text x="${KW / 2}" y="392" text-anchor="middle" class="karte-seltenheit">— ${SELTENHEIT_LABEL[figur.seltenheit] || ""} —</text>
      ${glanz ? `<rect x="6" y="6" width="${KW - 12}" height="${KH - 12}" rx="15" fill="url(#${uid}-foil)" class="foil"/>
        <g opacity="0.95">${funkelstern(44, 250, 0.8, g)}${funkelstern(258, 262, 0.6, g)}${funkelstern(52, 60, 0.55, g)}${funkelstern(250, 348, 0.7, g)}</g>` : ""}
      ${probelauf ? `<g transform="translate(${KW - 66},44) rotate(12)"><rect x="-38" y="-12" width="76" height="24" rx="4" fill="var(--nacht-hell)" opacity="0.9"/><text text-anchor="middle" y="5" class="karte-probelauf">Probelauf</text></g>` : ""}
    </svg>`;
  }

  function silhouetteSVG(figur) {
    const ort = window.Daten.orte.find(o => o.id === figur.ortId);
    const uid = "s" + (++zaehler);
    return `<svg viewBox="0 0 ${KW} ${KH}" class="zeugenkarte nebel" role="img" aria-label="Noch nicht begegnet — zu finden: ${esc(ort ? ort.name : "")}">
      <defs>${verlaeufe(uid, "#5a6480")}
        <linearGradient id="${uid}-dunst" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#26335a"/><stop offset="1" stop-color="#151c36"/>
        </linearGradient>
        <radialGradient id="${uid}-schleier" cx="50%" cy="34%" r="60%">
          <stop offset="0" stop-color="#aeb9d9" stop-opacity="0.2"/><stop offset="1" stop-color="#aeb9d9" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect x="4" y="4" width="${KW - 8}" height="${KH - 8}" rx="16" fill="url(#${uid}-dunst)" stroke="var(--sternennebel)" stroke-width="2" stroke-dasharray="6 6"/>
      <rect x="4" y="4" width="${KW - 8}" height="${KH - 8}" rx="16" fill="url(#${uid}-schleier)"/>
      ${fensterMitGestalt(figur, uid, true, "")}
      <text x="${KW / 2}" y="266" text-anchor="middle" class="karte-nebel-text">Noch nicht begegnet</text>
      <text x="${KW / 2}" y="330" text-anchor="middle" class="karte-nebel-hinweis">${ort ? ort.icon : ""} ${esc(ort ? ort.kurzname || ort.name : "")}</text>
      <text x="${KW / 2}" y="354" text-anchor="middle" class="karte-nebel-hinweis klein">${esc(figur.themaLabel)}</text>
    </svg>`;
  }

  /* Karte in der Holo-Hülle (Einzelansicht, Zeremonie) */
  function holoKarte(figur, opts) {
    opts = opts || {};
    const info = window.Store.get().gesammelt[figur.id];
    const glanz = opts.glanz !== undefined ? opts.glanz : (info && info.glanz);
    return `<div class="holo s-${figur.seltenheit}${glanz ? " glanz" : ""}" style="--farbe-rgb:${window.Fx.rgb(figur.farbe)}">${kartenSVG(figur, opts)}${window.Fx.holoSchichten()}</div>`;
  }

  /* ---- Album ("Wolke") ---- */
  let neuId = null;
  function merkeNeu(id) { neuId = id; }

  function renderAlbum(container) {
    const figuren = window.Daten.figuren;
    const n = window.Store.anzahlGesammelt();
    const komplett = n === figuren.length;
    const neu = neuId;
    neuId = null;

    let finale = "";
    if (komplett) {
      finale = `<div class="finale panel-pergament">
        <div class="finale-titel">☁️ Deine Wolke ist voll!</div>
        <p>»Wir sind von einer großen Wolke von Zeugen umgeben. So lasst uns laufen in dem Lauf, der uns bestimmt ist — und dabei auf Jesus sehen, den Anfänger und Vollender des Glaubens.«</p>
        <p class="finale-quelle">Hebräer 12,1-2 · <strong>${esc(window.Store.get().name || "Du")}</strong>, ${zahlwort(figuren.length)} Zeug:innen feuern dich an.</p>
      </div>`;
    }

    const karten = figuren.map((f, i) => {
      const hat = window.Store.istGesammelt(f.id);
      const svg = hat ? kartenSVG(f) : silhouetteSVG(f);
      return `<button class="album-karte${hat ? " hat s-" + f.seltenheit : ""}${f.id === neu ? " neu" : ""}" data-figur="${f.id}" style="--drehung:${(i % 5 - 2) * 1.4}deg;--i:${Math.min(i, 9)}" aria-label="${esc(f.name)}">${svg}${f.id === neu ? `<span class="album-neu">Neu ✦</span>` : ""}</button>`;
    }).join("");

    container.innerHTML = `
      ${finale}
      <div class="album-kopf">
        <div class="album-zaehler"><strong id="album-zahl">${n}</strong> von ${figuren.length} Zeug:innen in deiner Wolke</div>
        <div class="album-balken" aria-hidden="true"><i style="width:${(n / figuren.length * 100).toFixed(1)}%"></i></div>
        <div class="album-tabs" role="tablist">
          <button class="tab aktiv" data-tab="wolke" role="tab" aria-selected="true">☁️ Wolke</button>
          <button class="tab" data-tab="fenster" role="tab" aria-selected="false">🪟 Kirchenfenster</button>
        </div>
      </div>
      <div class="album-wolke" id="album-tab-wolke">${karten}</div>
      <div class="album-fenster" id="album-tab-fenster" hidden></div>`;

    window.Fx.zaehle(container.querySelector("#album-zahl"), n);
    container.querySelectorAll(".album-karte").forEach(el => {
      el.addEventListener("click", () => window.App.zeigeFigur(el.getAttribute("data-figur")));
    });
    container.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => {
        container.querySelectorAll(".tab").forEach(t => { t.classList.remove("aktiv"); t.setAttribute("aria-selected", "false"); });
        tab.classList.add("aktiv");
        tab.setAttribute("aria-selected", "true");
        const fenster = tab.getAttribute("data-tab") === "fenster";
        container.querySelector("#album-tab-wolke").hidden = fenster;
        container.querySelector("#album-tab-fenster").hidden = !fenster;
        if (fenster) renderFenster(container.querySelector("#album-tab-fenster"));
      });
    });

    // Die frisch gewonnene Karte ins Bild holen und feiern
    const neuEl = neu && container.querySelector(".album-karte.neu");
    if (neuEl) {
      setTimeout(() => {
        if (!neuEl.isConnected || neuEl.offsetParent === null) return;
        neuEl.scrollIntoView({ block: "center", behavior: window.Fx.an() ? "smooth" : "auto" });
        setTimeout(() => {
          if (!neuEl.isConnected || neuEl.offsetParent === null) return;
          const f = figuren.find(x => x.id === neu);
          window.Fx.funken(neuEl, { anzahl: 26, farben: window.Fx.palette(f ? f.farbe : "#d4a73a"), kraft: [2, 8], dauer: [700, 1500] });
          window.Fx.ring(neuEl, { radius: 170 });
        }, 520);
      }, 250);
    }
  }

  /* Zahl als Wort (für Texte wie »sechsundzwanzig Zeug:innen«) */
  function zahlwort(n, gross) {
    const einer = ["", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"];
    const zehner = ["", "zehn", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];
    const besondere = { 1: "eins", 10: "zehn", 11: "elf", 12: "zwölf", 16: "sechzehn", 17: "siebzehn" };
    let w;
    if (n < 1 || n > 99) w = String(n);
    else if (besondere[n]) w = besondere[n];
    else if (n < 10) w = einer[n];
    else if (n < 20) w = einer[n - 10] + "zehn";
    else w = (n % 10 ? einer[n % 10] + "und" : "") + zehner[Math.floor(n / 10)];
    return gross ? w.charAt(0).toUpperCase() + w.slice(1) : w;
  }

  /* ---- Kirchenfenster: Mit jeder Begegnung leuchtet eine Scheibe ----
     Unten das Raster der Scheiben, im Bogenfeld eine Rosette, deren Blätter
     mit dem Fortschritt aufleuchten. Leuchtende Scheiben werfen farbiges
     Licht auf den Boden. */
  function renderFenster(container) {
    const figuren = window.Daten.figuren;
    const n = window.Store.anzahlGesammelt();
    const FW = 320, FH = 560, L = 34, R = FW - 34, BOGEN = 196, UNTEN = FH - 22;
    const arch = `M ${L} ${UNTEN} L ${L} ${BOGEN} Q ${L} 44 ${FW / 2} 30 Q ${R} 44 ${R} ${BOGEN} L ${R} ${UNTEN} Z`;

    const cols = figuren.length > 18 ? 4 : 3, rows = Math.ceil(figuren.length / cols);
    const yTop = BOGEN + 6;
    const cw = (R - L) / cols, rh = (UNTEN - yTop) / rows;
    const zelle = i => ({ x: L + (i % cols) * cw, y: UNTEN - (Math.floor(i / cols) + 1) * rh });

    let glut = "", scheiben = "", spiegel = "", k = 0;
    figuren.forEach((f, i) => {
      const hat = window.Store.istGesammelt(f.id);
      const { x, y } = zelle(i);
      if (hat) {
        glut += `<rect x="${x + 3}" y="${y + 3}" width="${cw - 6}" height="${rh - 6}" fill="${f.farbe}"/>`;
        spiegel += `<rect x="${x + 3}" y="${y + 3}" width="${cw - 6}" height="${rh - 6}" fill="${f.farbe}"/>`;
      }
      scheiben += `<g class="scheibe${hat ? " an" : ""}" style="--i:${hat ? k++ : 0}">
        <rect x="${x + 2.5}" y="${y + 2.5}" width="${cw - 5}" height="${rh - 5}" fill="${hat ? f.farbe : "#26325a"}" opacity="${hat ? 0.92 : 0.5}"/>
        ${hat ? `<rect x="${x + 2.5}" y="${y + 2.5}" width="${cw - 5}" height="${rh - 5}" fill="url(#kf-glas)"/>
        <text x="${x + cw / 2}" y="${y + rh / 2 + 9}" text-anchor="middle" class="fenster-emoji">${f.emoji}</text>` : ""}
      </g>`;
    });
    for (let i = figuren.length; i < cols * rows; i++) {
      const { x, y } = zelle(i);
      scheiben += `<rect x="${x + 2.5}" y="${y + 2.5}" width="${cw - 5}" height="${rh - 5}" fill="#d4a73a" opacity="0.3"/>
        <text x="${x + cw / 2}" y="${y + rh / 2 + 6}" text-anchor="middle" class="fenster-zier">✦</text>`;
    }

    // Bleiruten
    let blei = "";
    for (let c = 1; c < cols; c++) blei += `M${L + c * cw} ${yTop} V${UNTEN} `;
    for (let r = 0; r <= rows; r++) blei += `M${L} ${UNTEN - r * rh} H${R} `;

    // Rosette im Bogenfeld: 8 Blätter leuchten mit dem Fortschritt
    const mx = FW / 2, my = 122, blaetter = 8, an = Math.floor(n / figuren.length * blaetter + 0.0001);
    let rosette = "";
    for (let i = 0; i < blaetter; i++) {
      const a = (i / blaetter) * 360 - 90;
      rosette += `<ellipse class="blatt${i < an ? " an" : ""}" style="--i:${i}" cx="${mx}" cy="${my - 36}" rx="13" ry="22" transform="rotate(${a + 22.5} ${mx} ${my})" fill="${i < an ? "#f0d284" : "#26325a"}" opacity="${i < an ? 0.95 : 0.55}" stroke="#141a2e" stroke-width="3"/>`;
    }

    container.innerHTML = `
      <div class="fenster-szene${n ? " leuchtet" : ""}" style="--helle:${(0.25 + 0.75 * n / figuren.length).toFixed(2)}">
        <div class="fenster-strahlen" aria-hidden="true"><i></i><i></i><i></i></div>
        <svg viewBox="0 0 ${FW} ${FH}" class="kirchenfenster" role="img" aria-label="Kirchenfenster: ${n} von ${figuren.length} Scheiben leuchten">
          <defs>
            <clipPath id="fensterClip"><path d="${arch}"/></clipPath>
            <linearGradient id="kf-glas" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#ffffff" stop-opacity="0.42"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.04"/><stop offset="1" stop-color="#000000" stop-opacity="0.2"/>
            </linearGradient>
            <linearGradient id="kf-stein" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#48557e"/><stop offset="1" stop-color="#1c2444"/>
            </linearGradient>
            <filter id="kf-glut" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>
          </defs>
          <path d="${arch}" fill="none" stroke="url(#kf-stein)" stroke-width="22" stroke-linejoin="round"/>
          <path d="${arch}" fill="#0c1124"/>
          <g clip-path="url(#fensterClip)">
            <g filter="url(#kf-glut)" opacity="0.75">${glut}</g>
            ${scheiben}
            <path d="${blei}" stroke="#141a2e" stroke-width="5" fill="none"/>
            <circle cx="${mx}" cy="${my}" r="66" fill="#131a33" stroke="#141a2e" stroke-width="5"/>
            ${rosette}
            <circle cx="${mx}" cy="${my}" r="17" fill="${n ? "#f0d284" : "#26325a"}" stroke="#141a2e" stroke-width="3.5"/>
            <text x="${mx}" y="${my + 6}" text-anchor="middle" class="fenster-mitte">✦</text>
            <circle cx="${L + 34}" cy="${BOGEN - 30}" r="15" fill="${n >= figuren.length / 2 ? "#d4a73a" : "#26325a"}" opacity="0.8" stroke="#141a2e" stroke-width="3.5"/>
            <circle cx="${R - 34}" cy="${BOGEN - 30}" r="15" fill="${komplettFarbe(n, figuren.length)}" opacity="0.8" stroke="#141a2e" stroke-width="3.5"/>
          </g>
          <path d="${arch}" fill="none" stroke="#9c7420" stroke-width="5"/>
          <path d="${arch}" fill="none" stroke="#f0d284" stroke-width="1.6"/>
        </svg>
        <svg viewBox="0 0 ${FW} ${FH}" class="fenster-spiegel" aria-hidden="true" preserveAspectRatio="none">
          <g filter="url(#kf-glut)">${spiegel}</g>
        </svg>
        <p class="fenster-text">Mit jeder Begegnung leuchtet eine Scheibe mehr.<br><strong>${n} / ${figuren.length}</strong></p>
      </div>`;
  }
  function komplettFarbe(n, alle) { return n >= alle ? "#d4a73a" : "#26325a"; }

  /* ---- Figuren-Detail mit Holo-Karte und Kartenflip ---- */
  function renderFigurDetail(container, figur) {
    const hat = window.Store.istGesammelt(figur.id);
    const info = window.Store.get().gesammelt[figur.id];
    const notiz = window.Store.getNotiz(figur.id);
    const f = figur.frage;

    const rueckseite = `
      <div class="karte-rueckseite panel-pergament">
        <div class="rueck-zier" aria-hidden="true">❦</div>
        <div class="rueck-spruch">»${esc(figur.kartenspruch)}«</div>
        <div class="rueck-bibel">📖 ${esc(f.bibelstelle)}</div>
        <a class="link-tinte" href="${esc(f.bibellink)}" target="_blank" rel="noopener">In der BasisBibel lesen ↗</a>
      </div>`;

    container.innerHTML = `
      <button class="zurueck" data-zurueck>‹ Zurück</button>
      ${hat ? `
        <div class="detail-buehne" style="--farbe-rgb:${window.Fx.rgb(figur.farbe)}">
          <div class="lichtkranz" aria-hidden="true"></div>
          <div class="flip-buehne">
            <div class="neig">
              <div class="flip-karte" tabindex="0" role="button" aria-label="Karte umdrehen">
                <div class="flip-vorn">${holoKarte(figur)}</div>
                <div class="flip-hinten">${rueckseite}</div>
              </div>
            </div>
          </div>
        </div>
        <p class="flip-hinweis">Neig dein Handy oder streich über die Karte — tippen dreht sie um</p>
        <div class="detail-meta">
          ${info ? `<span class="chip">Begegnet am ${esc(info.datum)}</span>` : ""}
          ${info && info.glanz ? `<span class="chip chip-gold">✨ Goldglanz</span>` : ""}
          ${info && info.erlebt ? `<span class="chip chip-gold">🙌 Geste erlebt</span>` : ""}
          ${info && info.verifikation === "demo" ? `<span class="chip">Probelauf — besuch den Ort für die echte Begegnung!</span>` : ""}
        </div>
        <div class="detail-block panel-nacht">
          <h3>Deine private Notiz</h3>
          <p class="dezent">Nur auf deinem Gerät. Niemand sonst sieht sie.</p>
          <textarea id="detail-notiz" rows="3" placeholder="Deine Gedanken …">${esc(notiz)}</textarea>
          <button class="btn btn-sekundaer" id="detail-notiz-speichern">Notiz speichern</button>
        </div>
        <button class="btn btn-gold" id="detail-replay">💬 Gespräch noch einmal führen</button>
      ` : `
        <div class="flip-buehne nebelkarte">${silhouetteSVG(figur)}</div>
        <p class="detail-hinweis">Du bist ${esc(figur.name)} noch nicht begegnet. Schau auf der Karte, wo — und mach dich auf den Weg!</p>
      `}`;

    container.querySelector("[data-zurueck]").addEventListener("click", () => window.App.zeigeView("wolke"));
    const flip = container.querySelector(".flip-karte");
    if (flip) {
      // Streichen kippt die Karte, nur ein echter Tipp dreht sie um
      let start = null;
      flip.addEventListener("pointerdown", e => { start = { x: e.clientX, y: e.clientY }; });
      const drehen = () => flip.classList.toggle("gedreht");
      flip.addEventListener("click", e => {
        if (e.target.closest && e.target.closest("a")) return;
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) return;
        drehen();
      });
      flip.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); drehen(); } });
      window.Fx.holo(container.querySelector(".neig"));
    }
    const speichern = container.querySelector("#detail-notiz-speichern");
    if (speichern) speichern.addEventListener("click", () => {
      window.Store.setNotiz(figur.id, container.querySelector("#detail-notiz").value);
      window.App.toast("Notiz gespeichert 🔒");
    });
    const replay = container.querySelector("#detail-replay");
    if (replay) replay.addEventListener("click", () => window.Encounter.start(figur, { replay: true }));
  }

  window.Wolke = { kartenSVG, silhouetteSVG, holoKarte, merkeNeu, renderAlbum, renderFenster, renderFigurDetail, zahlwort };
})();
