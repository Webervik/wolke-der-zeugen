/* Wolke der Zeugen — illuminierte Sammelkarten, Album & Kirchenfenster.
   Karten werden als SVG generiert: Pergament, Goldrahmen nach Bedeutsamkeit
   ("Seltenheit" = Pracht der Illumination, keine künstliche Verknappung). */
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

  /* Rahmenpracht nach Bedeutsamkeit */
  function rahmenSVG(seltenheit) {
    const einfach = `<rect x="12" y="12" width="${KW - 24}" height="${KH - 24}" rx="12" fill="none" stroke="var(--gold-tief)" stroke-width="2"/>`;
    if (seltenheit === "gewoehnlich") return einfach;
    const doppelt = einfach + `<rect x="20" y="20" width="${KW - 40}" height="${KH - 40}" rx="8" fill="none" stroke="var(--gold-tief)" stroke-width="1" opacity="0.7"/>`;
    if (seltenheit === "besonders") {
      const ecke = (x, y, sx, sy) => `<g transform="translate(${x},${y}) scale(${sx},${sy})"><path d="M0 18 Q 0 0 18 0" fill="none" stroke="var(--gold)" stroke-width="2.5"/><circle cx="7" cy="7" r="3" fill="var(--gold)"/></g>`;
      return doppelt + ecke(26, 26, 1, 1) + ecke(KW - 26, 26, -1, 1) + ecke(26, KH - 26, 1, -1) + ecke(KW - 26, KH - 26, -1, -1);
    }
    // legende: voll illuminierte Ecken
    const pracht = (x, y, sx, sy) => `<g transform="translate(${x},${y}) scale(${sx},${sy})">
      <path d="M0 34 Q 0 0 34 0 M0 22 Q 0 0 22 0 M4 46 Q 10 18 46 4" fill="none" stroke="var(--gold)" stroke-width="2.5"/>
      <circle cx="12" cy="12" r="4.5" fill="var(--gold)"/>
      <path d="M28 10 q 6 -6 12 0 q -6 6 -12 0 M10 28 q -6 6 0 12 q 6 -6 0 -12" fill="var(--gold)" opacity="0.85"/></g>`;
    return doppelt +
      pracht(26, 26, 1, 1) + pracht(KW - 26, 26, -1, 1) + pracht(26, KH - 26, 1, -1) + pracht(KW - 26, KH - 26, -1, -1) +
      `<path d="M${KW / 2 - 34} 22 h68 M${KW / 2 - 34} ${KH - 22} h68" stroke="var(--gold)" stroke-width="2.5"/>
       <circle cx="${KW / 2}" cy="22" r="4" fill="var(--gold)"/><circle cx="${KW / 2}" cy="${KH - 22}" r="4" fill="var(--gold)"/>`;
  }

  const SELTENHEIT_LABEL = { gewoehnlich: "Zeugnis", besonders: "Besonderes Zeugnis", legende: "Legende des Glaubens" };

  // Jede Karte bekommt eigene IDs — dieselbe Figur kann gleichzeitig in
  // Album, Zeremonie und Detailansicht im Dokument stehen.
  let zaehler = 0;

  // Spitzbogen-Fenster, in dem die Lichtgestalt steht
  const FENSTER = `M90 226 L90 92 A60 60 0 0 1 210 92 L210 226 Z`;

  function fensterMitGestalt(figur, uid, unbekannt) {
    return `
      <path d="${FENSTER}" fill="url(#${uid}-nacht)"/>
      <svg x="99" y="40" width="102" height="174" viewBox="0 0 200 340">${window.Gestalt.svg(figur, { praefix: uid, unbekannt }).replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")}</svg>
      <path d="${FENSTER}" fill="none" stroke="${unbekannt ? "var(--sternennebel)" : "var(--gold-tief)"}" stroke-width="4"/>
      <path d="${FENSTER}" fill="none" stroke="${unbekannt ? "var(--wolke)" : "var(--gold)"}" stroke-width="1.5" opacity="0.8" transform="translate(150 132) scale(1.07) translate(-150 -132)"/>`;
  }

  function nachtVerlauf(uid) {
    return `<radialGradient id="${uid}-nacht" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#2a3a63"/>
      <stop offset="100%" stop-color="#131a30"/>
    </radialGradient>`;
  }

  function kartenSVG(figur, opts) {
    opts = opts || {};
    const info = window.Store.get().gesammelt[figur.id];
    const glanz = opts.glanz !== undefined ? opts.glanz : (info && info.glanz);
    const probelauf = info && info.verifikation === "demo";
    const ort = window.Daten.orte.find(o => o.id === figur.ortId);
    const uid = "k" + (++zaehler);

    return `<svg viewBox="0 0 ${KW} ${KH}" class="zeugenkarte s-${figur.seltenheit}${glanz ? " glanz" : ""}" role="img" aria-label="Karte: ${esc(figur.name)}">
      <defs>
        <radialGradient id="${uid}-kt" cx="50%" cy="35%" r="80%">
          <stop offset="0%" stop-color="var(--pergament)"/>
          <stop offset="100%" stop-color="var(--pergament-tief)"/>
        </radialGradient>
        ${nachtVerlauf(uid)}
        ${glanz ? `<linearGradient id="${uid}-foil" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="var(--gold-hell)" stop-opacity="0"/>
          <stop offset="50%" stop-color="var(--gold-hell)" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="var(--gold-hell)" stop-opacity="0"/>
        </linearGradient>` : ""}
      </defs>
      <rect x="4" y="4" width="${KW - 8}" height="${KH - 8}" rx="16" fill="url(#${uid}-kt)" stroke="var(--gold-tief)" stroke-width="1"/>
      ${musterSVG(figur.muster, figur.farbe)}
      ${rahmenSVG(figur.seltenheit)}
      ${fensterMitGestalt(figur, uid, false)}
      <text x="${KW / 2}" y="252" text-anchor="middle" class="karte-name"${figur.name.length > 19 ? ` style="font-size:${Math.floor(540 / figur.name.length)}px"` : ""}>${esc(figur.name)}</text>
      <text x="${KW / 2}" y="278" text-anchor="middle" class="karte-beiname"${figur.beiname.length > 34 ? ` style="font-size:${Math.floor(510 / figur.beiname.length)}px"` : ""}>${esc(figur.beiname)}</text>
      <rect x="${KW / 2 - 80}" y="300" width="160" height="30" rx="15" fill="${figur.farbe}" opacity="0.16"/>
      <text x="${KW / 2}" y="320" text-anchor="middle" class="karte-thema" fill="${figur.farbe}">${esc(figur.themaLabel)}</text>
      <text x="${KW / 2}" y="362" text-anchor="middle" class="karte-ort">${esc(ort ? ort.kurzname || ort.name : "")} ${ort ? ort.icon : ""}</text>
      <text x="${KW / 2}" y="392" text-anchor="middle" class="karte-seltenheit">— ${SELTENHEIT_LABEL[figur.seltenheit] || ""} —</text>
      ${glanz ? `<rect x="6" y="6" width="${KW - 12}" height="${KH - 12}" rx="15" fill="url(#${uid}-foil)" class="foil"/>` : ""}
      ${probelauf ? `<g transform="translate(${KW - 66},44) rotate(12)"><rect x="-38" y="-12" width="76" height="24" rx="4" fill="var(--nacht-hell)" opacity="0.9"/><text text-anchor="middle" y="5" class="karte-probelauf">Probelauf</text></g>` : ""}
    </svg>`;
  }

  function silhouetteSVG(figur) {
    const ort = window.Daten.orte.find(o => o.id === figur.ortId);
    const uid = "s" + (++zaehler);
    return `<svg viewBox="0 0 ${KW} ${KH}" class="zeugenkarte nebel" role="img" aria-label="Noch nicht begegnet — zu finden: ${esc(ort ? ort.name : "")}">
      <defs>${nachtVerlauf(uid)}</defs>
      <rect x="4" y="4" width="${KW - 8}" height="${KH - 8}" rx="16" fill="var(--nacht-hell)" stroke="var(--sternennebel)" stroke-width="2" stroke-dasharray="6 6"/>
      ${fensterMitGestalt(figur, uid, true)}
      <text x="${KW / 2}" y="262" text-anchor="middle" class="karte-nebel-text">Noch nicht begegnet</text>
      <text x="${KW / 2}" y="330" text-anchor="middle" class="karte-nebel-hinweis">${ort ? ort.icon : ""} ${esc(ort ? ort.kurzname || ort.name : "")}</text>
      <text x="${KW / 2}" y="354" text-anchor="middle" class="karte-nebel-hinweis klein">${esc(figur.themaLabel)}</text>
    </svg>`;
  }

  /* ---- Album ("Wolke") ---- */
  function renderAlbum(container) {
    const figuren = window.Daten.figuren;
    const n = window.Store.anzahlGesammelt();
    const komplett = n === figuren.length;

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
      return `<button class="album-karte" data-figur="${f.id}" style="--drehung:${(i % 5 - 2) * 1.4}deg" aria-label="${esc(f.name)}">${svg}</button>`;
    }).join("");

    container.innerHTML = `
      ${finale}
      <div class="album-kopf">
        <div class="album-zaehler"><strong>${n}</strong> von ${figuren.length} Zeug:innen in deiner Wolke</div>
        <div class="album-tabs" role="tablist">
          <button class="tab aktiv" data-tab="wolke" role="tab" aria-selected="true">☁️ Wolke</button>
          <button class="tab" data-tab="fenster" role="tab" aria-selected="false">🪟 Kirchenfenster</button>
        </div>
      </div>
      <div class="album-wolke" id="album-tab-wolke">${karten}</div>
      <div class="album-fenster" id="album-tab-fenster" hidden></div>`;

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

  /* ---- Kirchenfenster: Mit jeder Begegnung leuchtet eine Scheibe ---- */
  function renderFenster(container) {
    const figuren = window.Daten.figuren;
    const FW = 320, FH = 480;
    const arch = `M 36 ${FH - 20} L 36 190 Q 36 44 ${FW / 2} 36 Q ${FW - 36} 44 ${FW - 36} 190 L ${FW - 36} ${FH - 20} Z`;

    // Bis 18 Figuren 3 Spalten, darüber 4 — freie Felder oben werden zu Zierscheiben
    const cols = figuren.length > 18 ? 4 : 3, rows = Math.ceil(figuren.length / cols);
    const x0 = 36, x1 = FW - 36, yTop = 40, yBot = FH - 20;
    const cw = (x1 - x0) / cols, rh = (yBot - yTop) / rows;

    const scheiben = figuren.map((f, i) => {
      const hat = window.Store.istGesammelt(f.id);
      const col = i % cols;
      const rowVonUnten = Math.floor(i / cols);
      const y = yBot - (rowVonUnten + 1) * rh;
      const x = x0 + col * cw;
      const fill = hat ? f.farbe : "var(--sternennebel)";
      const op = hat ? 0.85 : 0.25;
      return `<g>
        <rect x="${x + 2}" y="${y + 2}" width="${cw - 4}" height="${rh - 4}" fill="${fill}" opacity="${op}"/>
        ${hat ? `<text x="${x + cw / 2}" y="${y + rh / 2 + 9}" text-anchor="middle" class="fenster-emoji">${f.emoji}</text>` : ""}
      </g>`;
    }).join("") + Array.from({ length: cols * rows - figuren.length }, (_, k) => {
      const i = figuren.length + k;
      const x = x0 + (i % cols) * cw, y = yBot - (Math.floor(i / cols) + 1) * rh;
      return `<rect x="${x + 2}" y="${y + 2}" width="${cw - 4}" height="${rh - 4}" fill="var(--gold)" opacity="0.28"/>
        <text x="${x + cw / 2}" y="${y + rh / 2 + 6}" text-anchor="middle" class="fenster-zier">✦</text>`;
    }).join("");

    // Steinrahmen (Maßwerk) über den Scheiben
    let masswerk = "";
    for (let c = 1; c < cols; c++) {
      masswerk += `<line x1="${x0 + c * cw}" y1="${yTop + 30}" x2="${x0 + c * cw}" y2="${yBot}" stroke="var(--nacht)" stroke-width="5"/>`;
    }
    for (let r = 1; r < rows; r++) {
      masswerk += `<line x1="${x0}" y1="${yBot - r * rh}" x2="${x1}" y2="${yBot - r * rh}" stroke="var(--nacht)" stroke-width="5"/>`;
    }

    const n = window.Store.anzahlGesammelt();
    container.innerHTML = `
      <div class="fenster-wrap">
        <svg viewBox="0 0 ${FW} ${FH}" class="kirchenfenster" role="img" aria-label="Kirchenfenster: ${n} von ${figuren.length} Scheiben leuchten">
          <defs><clipPath id="fensterClip"><path d="${arch}"/></clipPath></defs>
          <path d="${arch}" fill="var(--nacht)"/>
          <g clip-path="url(#fensterClip)">${scheiben}${masswerk}</g>
          <path d="${arch}" fill="none" stroke="var(--gold-tief)" stroke-width="7"/>
          <path d="${arch}" fill="none" stroke="var(--gold)" stroke-width="2"/>
        </svg>
        <p class="fenster-text">Mit jeder Begegnung leuchtet eine Scheibe mehr.<br><strong>${n} / ${figuren.length}</strong></p>
      </div>`;
  }

  /* ---- Figuren-Detail mit Kartenflip ---- */
  function renderFigurDetail(container, figur) {
    const hat = window.Store.istGesammelt(figur.id);
    const info = window.Store.get().gesammelt[figur.id];
    const notiz = window.Store.getNotiz(figur.id);
    const f = figur.frage;

    const rueckseite = `
      <div class="karte-rueckseite panel-pergament">
        <div class="rueck-spruch">»${esc(figur.kartenspruch)}«</div>
        <div class="rueck-bibel">📖 ${esc(f.bibelstelle)}</div>
        <a class="link-gold" href="${esc(f.bibellink)}" target="_blank" rel="noopener">In der BasisBibel lesen ↗</a>
      </div>`;

    container.innerHTML = `
      <button class="zurueck" data-zurueck>‹ Zurück</button>
      ${hat ? `
        <div class="flip-buehne">
          <div class="flip-karte" tabindex="0" role="button" aria-label="Karte umdrehen">
            <div class="flip-vorn">${kartenSVG(figur)}</div>
            <div class="flip-hinten">${rueckseite}</div>
          </div>
        </div>
        <p class="flip-hinweis">Tippe auf die Karte, um sie umzudrehen</p>
        <div class="detail-meta">
          ${info ? `<span class="chip">Begegnet am ${esc(info.datum)}</span>` : ""}
          ${info && info.glanz ? `<span class="chip chip-gold">✨ Goldglanz</span>` : ""}
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
        <div class="flip-buehne">${silhouetteSVG(figur)}</div>
        <p class="detail-hinweis">Du bist ${esc(figur.name)} noch nicht begegnet. Schau auf der Karte, wo — und mach dich auf den Weg!</p>
      `}`;

    container.querySelector("[data-zurueck]").addEventListener("click", () => window.App.zeigeView("wolke"));
    const flip = container.querySelector(".flip-karte");
    if (flip) {
      const drehen = () => flip.classList.toggle("gedreht");
      flip.addEventListener("click", drehen);
      flip.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); drehen(); } });
    }
    const speichern = container.querySelector("#detail-notiz-speichern");
    if (speichern) speichern.addEventListener("click", () => {
      window.Store.setNotiz(figur.id, container.querySelector("#detail-notiz").value);
      window.App.toast("Notiz gespeichert 🔒");
    });
    const replay = container.querySelector("#detail-replay");
    if (replay) replay.addEventListener("click", () => window.Encounter.start(figur, { replay: true }));
  }

  window.Wolke = { kartenSVG, silhouetteSVG, renderAlbum, renderFenster, renderFigurDetail, zahlwort };
})();
