/* Wolke der Zeugen — einfache AR-Ansicht ("Foto-Moment").
   Die Handy-Kamera läuft als Live-Hintergrund, die Figur wird darüber
   eingeblendet. Bewusst OHNE echtes Raum-Tracking (kein WebXR): Das hält
   es zuverlässig auf allen Handy-Browsern und akkuschonend.

   Datenschutz: Der Kamera-Stream bleibt ausschließlich auf dem Gerät.
   Nichts wird aufgenommen, gespeichert oder übertragen. Der Stream wird
   beim Verlassen der Ansicht sofort gestoppt. */
(function () {
  let stream = null;
  let figur = null;
  let zurueckView = "ort";

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function unterstuetzt() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function stoppeStream() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
  }

  async function oeffne(f, opts) {
    opts = opts || {};
    figur = f;
    zurueckView = opts.zurueck || "ort";
    const view = document.getElementById("view-ar");
    window.App.zeigeView("ar");
    render(view, "laedt");

    if (!unterstuetzt()) { render(view, "fallback"); return; }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      render(view, "kamera");
      const v = view.querySelector("#ar-video");
      if (v) {
        v.srcObject = stream;
        v.setAttribute("playsinline", "");
        try { await v.play(); } catch (e) { /* Autoplay-Sperre — Bild bleibt trotzdem */ }
      }
    } catch (e) {
      // Kein Zugriff (abgelehnt, keine Kamera, kein Secure Context) → Sternenhimmel
      render(view, "fallback");
    }
  }

  function verlasse(ziel) {
    stoppeStream();
    window.App.zeigeView(ziel || zurueckView);
  }

  function ansprechen() {
    stoppeStream();
    window.Encounter.start(figur);
  }

  function render(view, modus) {
    const hintergrund = modus === "kamera"
      ? `<video id="ar-video" autoplay muted playsinline></video>`
      : `<div class="ar-sternenhimmel"></div>`;

    const laden = modus === "laedt";
    const fallbackHinweis = modus === "fallback"
      ? `<div class="ar-hinweis">📷 Ich konnte die Kamera nicht öffnen — macht nichts! ${esc(figur.name)} ist trotzdem da. (Am Handy und mit Kamera-Erlaubnis erscheint hier dein Live-Bild.)</div>`
      : "";

    view.innerHTML = `
      <div class="ar-buehne ${modus}">
        ${hintergrund}
        <div class="ar-overlay">
          <button class="ar-schliessen" id="ar-close" aria-label="Schließen">✕</button>
          <div class="ar-kopf">
            <span class="ar-badge">${modus === "kamera" ? "📷 AR" : "✨"}</span>
          </div>

          ${laden ? `<div class="ar-laedt">Kamera wird geöffnet …</div>` : `
            <div class="ar-figur">
              <div class="ar-medaillon" style="border-color:${figur.farbe}">
                <span class="ar-emoji">${figur.emoji}</span>
              </div>
              <div class="ar-name-tafel">
                <div class="ar-gefunden">✨ Du hast jemanden gefunden!</div>
                <div class="ar-name">${esc(figur.name)}</div>
                <div class="ar-beiname">${esc(figur.beiname)}</div>
              </div>
            </div>
            ${fallbackHinweis}
            <div class="ar-fuss">
              <p class="ar-foto-tipp">📸 Tipp: Mach ein Erinnerungsfoto (Screenshot)!</p>
              <button class="btn btn-gold" id="ar-ansprechen">💬 ${esc(figur.name)} ansprechen</button>
              <button class="ar-textlink" id="ar-zurueck">Zurück ohne AR</button>
              <p class="ar-datenschutz">🔒 Das Kamerabild bleibt auf deinem Gerät — es wird nicht aufgenommen oder verschickt.</p>
            </div>
          `}
        </div>
      </div>`;

    const close = view.querySelector("#ar-close");
    if (close) close.addEventListener("click", () => verlasse());
    const zurueck = view.querySelector("#ar-zurueck");
    if (zurueck) zurueck.addEventListener("click", () => verlasse());
    const ansprechenBtn = view.querySelector("#ar-ansprechen");
    if (ansprechenBtn) ansprechenBtn.addEventListener("click", ansprechen);
  }

  window.AR = { oeffne, verlasse, stoppeStream, unterstuetzt };
})();
