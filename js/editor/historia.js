// ---------- la historia en el mapa ----------
// «Ver la historia» marca cada punto del guion (PUNTOS) y lo nombrado (NOMBRADAS) con su nombre; los lugares de los
// objetivos de la misión elegida salen en dorado con su número. Los lugares que los sistemas arman al empezar (etapas.js)
// no se ven acá porque el editor no corre los sistemas. Probar en el juego puede arrancar en una misión y a una hora (?mision=EL-03&hora=22).
window.EDITOR_HISTORIA = (function () {
  "use strict";
  const E = window.EDITOR,
    W = E.W,
    t = E.t,
    $ = (id) => document.getElementById(id),
    HI = window.HISTORIA;
  const MIS = HI ? HI.MISIONES : [];
  $("probarMision").innerHTML = `<option value="">${t("ed.probar_mision_ahora")}</option>` + MIS.map((m) => `<option value="${m.id}">${m.id}</option>`).join("");
  $("verHistoria").innerHTML = `<option value="">${t("ed.historia_no")}</option><option value="*">${t("ed.historia_todo")}</option>` + MIS.map((m) => `<option value="${m.id}">${t("ed.historia_mision", [m.id])}</option>`).join("");
  // dónde está cada cosa que nombra el guion
  function lugar(k) {
    if (!k) return null;
    if (W.PUNTOS[k]) return W.PUNTOS[k];
    if (W.NOMBRADAS[k]) return [W.NOMBRADAS[k].x, W.NOMBRADAS[k].y];
    if (W.LUGARES[k]) return W.LUGARES[k].p;
    return null;
  }
  function dibujar(c, cam, V) {
    const ver = $("verHistoria").value;
    if (!ver) return;
    const marcar = new Map(); // punto → números de objetivo
    MIS.forEach((m) => {
      if (ver !== "*" && ver !== m.id) return;
      m.objetivos.forEach((o, i) => {
        if (!o.donde) return;
        const k = o.donde;
        if (!marcar.has(k)) marcar.set(k, []);
        marcar.get(k).push(m.id.slice(3) + "." + (i + 1));
      });
    });
    c.save();
    const etiqueta = (x, y, txt, col, fondo) => {
      const [vx, vy] = V(x, y);
      c.save();
      c.translate(vx, vy);
      c.scale(1 / cam.z, 1 / cam.z);
      c.beginPath();
      c.moveTo(0, -12);
      c.lineTo(7, -4);
      c.lineTo(0, 4);
      c.lineTo(-7, -4);
      c.closePath();
      c.fillStyle = col;
      c.fill();
      c.font = "12px system-ui, sans-serif";
      const w = c.measureText(txt).width + 10;
      c.fillStyle = fondo;
      c.fillRect(10, -14, w, 18);
      c.fillStyle = col;
      c.fillText(txt, 15, -1);
      c.restore();
    };
    if (ver === "*")
      Object.keys(W.PUNTOS).forEach((k) => {
        if (marcar.has(k)) return;
        const p = W.PUNTOS[k];
        etiqueta(p[0], p[1], k, "#73D5DB", "rgba(17,17,17,0.75)");
      });
    marcar.forEach((nums, k) => {
      const p = lugar(k);
      if (p) etiqueta(p[0], p[1], nums.join(" · ") + "  " + k, "#FFD98A", "rgba(17,17,17,0.85)");
    });
    c.restore();
  }
  // lo que Probar suma a la dirección del juego
  function consulta() {
    let s = "";
    if ($("probarMision").value) s += "&mision=" + $("probarMision").value;
    if ($("probarHora").value) s += "&hora=" + $("probarHora").value;
    return s;
  }
  $("verHistoria").addEventListener("change", () => E.pedir());
  return { dibujar, consulta, lugar };
})();
