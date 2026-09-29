/* Wolke der Zeugen — "Lichtgestalten" im Kirchenfenster-Stil.
   Jede Figur wird als Buntglas-Gestalt in ihrer Farbe gezeichnet und hält ihr
   Symbol (Emoji) wie ein Attribut vor der Brust — angelehnt an die Tradition,
   Zeug:innen des Glaubens mit einem Erkennungszeichen darzustellen.
   Bewusst ohne Gesichtszüge: Die Gestalt lässt Raum für die eigene Vorstellung.
   Die Glas-Facetten sind pro Figur zufällig, aber reproduzierbar (Seed = id). */
(function () {
  // Gewand mit Schultern und weiten, herabhängenden Ärmeln
  const ROBE = "M100 84 C86 84 70 88 57 98 C44 108 39 130 37 154 C35 176 34 196 44 208 C41 244 37 284 33 322 Q100 337 167 322 C163 284 159 244 156 208 C166 196 165 176 163 154 C161 130 156 108 143 98 C130 88 114 84 100 84 Z";
  const KAPUZE = "M64 104 C56 64 70 28 100 26 C130 28 144 64 136 104 C124 93 112 89 100 89 C88 89 76 93 64 104 Z";
  // Ärmelsäume und Unterarme, die das Symbol vor der Brust halten
  const ARM_L = "M58 106 C50 140 46 178 44 208 C60 200 76 190 84 176";
  const ARM_R = "M142 106 C150 140 154 178 156 208 C140 200 124 190 116 176";
  const MANTEL = "M58 112 C92 150 118 212 146 322";
  const BLEI = "#241c14";

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
    const h = hex.replace("#", "");
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  }

  function mische(hex, ziel, anteil) {
    const a = hexRgb(hex), b = hexRgb(ziel);
    return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * anteil).toString(16).padStart(2, "0")).join("");
  }

  function palette(farbe) {
    return [
      mische(farbe, "#ffffff", 0.38),
      mische(farbe, "#ffffff", 0.18),
      farbe,
      mische(farbe, "#000000", 0.16),
      mische(farbe, "#000000", 0.3),
      mische(farbe, "#f0d284", 0.45)
    ];
  }

  /* Facetten: schräge Reihen, pro Kante verschobene Spalten → Buntglas-Raster */
  function facetten(zufall, pal, reihen, spalten, mitGold) {
    const zeilen = reihen.map(y => ({ l: y + (zufall() - 0.5) * 18, r: y + (zufall() - 0.5) * 18 }));
    const yBei = (z, x) => z.l + (z.r - z.l) * (x / 200);
    const kanten = zeilen.map(() => spalten.map((x, k) => (k === 0 || k === spalten.length - 1) ? x : x + (zufall() - 0.5) * 22));
    let out = "";
    for (let i = 0; i < zeilen.length - 1; i++) {
      for (let k = 0; k < spalten.length - 1; k++) {
        const x1 = kanten[i][k], x2 = kanten[i][k + 1], x3 = kanten[i + 1][k + 1], x4 = kanten[i + 1][k];
        const pts = [[x1, yBei(zeilen[i], x1)], [x2, yBei(zeilen[i], x2)], [x3, yBei(zeilen[i + 1], x3)], [x4, yBei(zeilen[i + 1], x4)]];
        const gold = zufall() < 0.08;
        const farbe = (gold && mitGold) ? "#d4a73a" : pal[Math.floor(zufall() * (pal.length - 1))];
        out += `<polygon points="${pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")}" fill="${farbe}" stroke="${BLEI}" stroke-width="2.6" stroke-linejoin="round"/>`;
      }
    }
    return out;
  }

  /* opts: { unbekannt: bool, id-Präfix für eindeutige defs } */
  function svg(figur, opts) {
    opts = opts || {};
    const unbekannt = !!opts.unbekannt;
    const farbe = unbekannt ? "#5a6480" : figur.farbe;
    const pal = unbekannt
      ? ["#3c4663", "#46506e", "#515b78", "#5d6784", "#353e58", "#4a5472"]
      : palette(farbe);
    const zufall = prng(seedAus(figur.id));
    const uid = (opts.praefix || "g") + "-" + figur.id;
    const mitKapuze = zufall() < 0.6;
    const mitMantel = zufall() < 0.5;

    const robenFacetten = facetten(zufall, pal, [92, 128, 166, 210, 258, 336], [0, 58, 100, 142, 200], !unbekannt);
    const kapuzenFacetten = facetten(zufall, pal.slice(2), [24, 60, 104], [0, 100, 200], !unbekannt);

    const emblem = unbekannt
      ? `<text x="100" y="180" text-anchor="middle" font-size="28" font-family="Georgia, serif" font-weight="700" fill="#aeb9d9">?</text>`
      : `<text x="100" y="180" text-anchor="middle" font-size="27">${figur.emoji}</text>`;

    return `<svg viewBox="0 0 200 340" class="gestalt${unbekannt ? " unbekannt" : ""}" role="img" aria-label="${unbekannt ? "Unbekannte Gestalt" : "Lichtgestalt: " + figur.name}">
      <defs>
        <radialGradient id="${uid}-schein" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stop-color="${unbekannt ? "#aeb9d9" : "#f0d284"}" stop-opacity="${unbekannt ? 0.18 : 0.55}"/>
          <stop offset="55%" stop-color="${farbe}" stop-opacity="${unbekannt ? 0.08 : 0.28}"/>
          <stop offset="100%" stop-color="${farbe}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="${uid}-kopfschein" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fff6d8" stop-opacity="${unbekannt ? 0.15 : 0.75}"/>
          <stop offset="100%" stop-color="#f0d284" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="${uid}-licht" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"/>
          <stop offset="45%" stop-color="#ffffff" stop-opacity="0"/>
        </linearGradient>
        <clipPath id="${uid}-robe"><path d="${ROBE}"/></clipPath>
        <clipPath id="${uid}-kapuze"><path d="${KAPUZE}"/></clipPath>
      </defs>
      <ellipse cx="100" cy="185" rx="98" ry="165" fill="url(#${uid}-schein)"/>
      <ellipse cx="100" cy="328" rx="82" ry="9" fill="${unbekannt ? "#aeb9d9" : "#f0d284"}" opacity="${unbekannt ? 0.1 : 0.22}"/>
      <circle cx="100" cy="58" r="46" fill="url(#${uid}-kopfschein)"/>
      ${mitKapuze ? `<g clip-path="url(#${uid}-kapuze)">${kapuzenFacetten}</g>
        <path d="${KAPUZE}" fill="none" stroke="${BLEI}" stroke-width="4.5" stroke-linejoin="round"/>` : ""}
      <g clip-path="url(#${uid}-robe)">
        ${robenFacetten}
        <rect x="0" y="80" width="200" height="260" fill="url(#${uid}-licht)"/>
      </g>
      ${mitMantel ? `<path d="${MANTEL}" fill="none" stroke="${BLEI}" stroke-width="3.5" stroke-linecap="round" clip-path="url(#${uid}-robe)"/>` : ""}
      <path d="${ROBE}" fill="none" stroke="${BLEI}" stroke-width="5" stroke-linejoin="round"/>
      <path d="${ARM_L}" fill="none" stroke="${BLEI}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${ARM_R}" fill="none" stroke="${BLEI}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="100" cy="58" r="24" fill="${unbekannt ? "#6b7592" : "#f2dcb9"}" stroke="${BLEI}" stroke-width="4"/>
      <path d="M87 50 C91 41 104 37 111 43" fill="none" stroke="#ffffff" stroke-opacity="${unbekannt ? 0.15 : 0.5}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="100" cy="171" r="25" fill="${unbekannt ? "#2a3a63" : "#f6ecd7"}" stroke="${BLEI}" stroke-width="4"/>
      <circle cx="100" cy="171" r="21" fill="none" stroke="${unbekannt ? "#5a6480" : "#d4a73a"}" stroke-width="2.5"/>
      ${emblem}
    </svg>`;
  }

  window.Gestalt = { svg };
})();
