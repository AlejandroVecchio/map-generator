// ---------- las zonas fuera del mapa: generar y retocar mazmorras y tierras con islas (tecla M) ----------
// Pedido de Alejandro (24/10/2026): una sección en el mismo editor para generar el mapa de cada zona desde un texto
// («gran trozo de tierra con islas alrededor, una isla con un volcán, otra con una cueva que lleva a una mazmorra con
// un dragón») y retocarlo a mano para dejarlo más preciso. El plano de la izquierda es la zona vista desde arriba:
//   · mazmorra: salas sobre la grilla (se arrastran, se agrandan desde la esquina, cambian de clase) y pasillos que
//     las siguen; «Unir con…» traza uno nuevo.
//   · tierra: la tierra grande y las islas (se arrastran enteras o punto por punto), los bancos de arena que las unen y
//     lo que hay encima (volcán, cueva, campamento, ruinas, bosque, cofre, muelle), que se mueve, se cambia o se saca.
// Todo va a AGREGADOS.zonas (con Deshacer) y motor/zonas.js lo arma en el juego. Las tres mazmorras que vienen con el
// juego también se retocan: se guarda una copia con su mismo id («Como era» la borra).
window.EDITOR_ZONAS = (function () {
  "use strict";
  const E = window.EDITOR,
    t = E.t,
    Z = window.ZONAS,
    $ = (id) => document.getElementById(id);
  if (!Z) return { abrir() {}, abierta: () => false, tecla() {}, alternar() {}, dibujar() {}, clic: () => false };
  const caja = $("zonas"),
    cv = $("znLienzo"),
    c = cv.getContext("2d");
  const CLASES = ["entrada", "sala", "oscura", "tesoro", "jefe"];
  const COL_SALA = { entrada: "#2E5A5E", sala: "#4A3C34", oscura: "#241C1A", tesoro: "#6A5A30", jefe: "#5E130D" };
  const COSAS = ["volcan", "cueva", "campamento", "ruinas", "bosque", "cofre", "muelle"];
  const ASSET_COSA = { volcan: "volcan", cueva: "bocaCueva", campamento: "totemCampamento", ruinas: "pilarCripta", bosque: "pino", cofre: "cofreRunico", muelle: "barcaVikinga" };
  let zid = null,
    sel = null, // { sala: i } | { pasillo: i } | { masa: i, punto?: j } | { cosa: i }
    vivo = null, // copia que se mueve mientras se arrastra
    arrastre = null,
    uniendo = false,
    poniendo = null, // tipo de cosa que se pone con el próximo clic
    cursor = null,
    k = 1,
    ox = 0,
    oy = 0;
  const copia = (o) => JSON.parse(JSON.stringify(o));
  // ---------- los datos: las del juego, con lo guardado encima ----------
  let bases = null;
  function todas() {
    if (!bases)
      try {
        bases = Z.bases(E.W);
      } catch (e) {
        bases = {};
      }
    const out = {};
    for (const id in bases) out[id] = { d: bases[id], base: true, cambiada: !!(E.est().zonas || {})[id] };
    const g = E.est().zonas || {};
    for (const id in g) out[id] = { d: g[id], base: !!bases[id], cambiada: !!bases[id] };
    return out;
  }
  const actual = () => (zid && todas()[zid] ? todas()[zid] : null);
  const datos = () => vivo || (actual() && actual().d);
  const usable = (d) => d && (d.tipo === "mazmorra" || d.tipo === "tierra");
  // un cambio con Deshacer sobre la zona de ahora (si es una del juego, se guarda una copia con su id)
  function cambiar(fn) {
    const a = actual();
    if (!a) return;
    E.cambiar((est) => {
      est.zonas = est.zonas || {};
      const d = (est.zonas[zid] = est.zonas[zid] || copia(a.d));
      fn(d, est);
    });
    vivo = null;
    pintar();
  }
  const nuevoId = (pre) => {
    let n = 1;
    const ya = todas();
    while (ya[pre + n]) n++;
    return pre + n;
  };

  // ---------- el plano: de la zona al lienzo ----------
  const medidas = (d) => (d.tipo === "mazmorra" ? [d.ancho, d.alto] : [d.ancho, d.alto]);
  function encuadrar(d) {
    const [w, h] = medidas(d);
    k = Math.min(cv.width / w, cv.height / h) * 0.94;
    ox = (cv.width - w * k) / 2;
    oy = (cv.height - h * k) / 2;
  }
  const aLienzo = (x, y) => [ox + x * k, oy + y * k];
  const aZona = (px, py) => [(px - ox) / k, (py - oy) / k];
  const celdaDe = (px, py) => aZona(px, py).map(Math.floor);
  // la grilla de una mazmorra como la arma el juego: 1 = sala, 2 = pasillo
  function grilla(d) {
    const g = new Uint8Array(d.ancho * d.alto);
    const marcar = (x, y, v) => x >= 0 && y >= 1 && x < d.ancho && y < d.alto - 1 && (g[y * d.ancho + x] = g[y * d.ancho + x] || v);
    d.salas.forEach((s) => {
      for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) marcar(x, y, 1);
    });
    (d.pasillos || []).forEach((pa) => {
      for (let i = 0; i + 1 < pa.p.length; i++) {
        const [ax, ay] = pa.p[i],
          [bx, by] = pa.p[i + 1];
        for (let x = Math.min(ax, bx); x <= Math.max(ax, bx) + 1; x++) for (let y = Math.min(ay, by); y <= Math.max(ay, by) + 1; y++) marcar(x, y, 2);
      }
    });
    return g;
  }
  const centro = (s) => [Math.floor(s.x + s.w / 2), Math.floor(s.y + s.h / 2)];
  // el pasillo sigue a sus salas: conserva hacia dónde dobla
  function rehacerPasillo(pa, salas) {
    const A = salas[pa.a],
      B = salas[pa.b];
    if (!A || !B) return;
    const [ax, ay] = centro(A),
      [bx, by] = centro(B),
      horiz = !pa.p[1] || pa.p[1][1] === pa.p[0][1];
    pa.p = horiz ? [[ax, ay], [bx, ay], [bx, by]] : [[ax, ay], [ax, by], [bx, by]];
  }
  // ¿quedó alguna sala sin camino desde la entrada?
  function sueltas(d) {
    const e = d.salas.findIndex((s) => s.tipo === "entrada");
    if (e < 0) return d.salas.length;
    const ok = new Set([e]);
    for (let cambio = true; cambio; ) {
      cambio = false;
      (d.pasillos || []).forEach((pa) => {
        if (ok.has(pa.a) !== ok.has(pa.b)) ok.add(pa.a), ok.add(pa.b), (cambio = true);
      });
    }
    return d.salas.length - ok.size;
  }
  function salaEn(d, cx, cy) {
    for (let i = d.salas.length - 1; i >= 0; i--) {
      const s = d.salas[i];
      if (cx >= s.x && cx < s.x + s.w && cy >= s.y && cy < s.y + s.h) return i;
    }
    return -1;
  }
  function pasilloEn(d, cx, cy) {
    return (d.pasillos || []).findIndex((pa) => {
      for (let i = 0; i + 1 < pa.p.length; i++) {
        const [ax, ay] = pa.p[i],
          [bx, by] = pa.p[i + 1];
        if (cx >= Math.min(ax, bx) && cx <= Math.max(ax, bx) + 1 && cy >= Math.min(ay, by) && cy <= Math.max(ay, by) + 1) return true;
      }
      return false;
    });
  }
  const esquina = (s) => aLienzo(s.x + s.w, s.y + s.h);
  // ---------- tierras ----------
  function masaEn(d, x, y) {
    for (let i = d.masas.length - 1; i >= 0; i--) if (Z.enPoli(d.masas[i].pts, x, y)) return i;
    return -1;
  }
  function cosaEn(d, px, py) {
    for (let i = d.cosas.length - 1; i >= 0; i--) {
      const [cx, cy] = aLienzo(d.cosas[i].x, d.cosas[i].y);
      if (Math.hypot(cx - px, cy - 8 - py) < 18) return i;
    }
    return -1;
  }
  function puntoEn(d, mi, px, py) {
    const m = d.masas[mi];
    if (!m) return -1;
    return m.pts.findIndex(([x, y]) => {
      const [qx, qy] = aLienzo(x, y);
      return Math.hypot(qx - px, qy - py) < 9;
    });
  }
  function recentrar(m) {
    const xs = m.pts.map((p) => p[0]),
      ys = m.pts.map((p) => p[1]);
    m.c = [Math.round((Math.min(...xs) + Math.max(...xs)) / 2), Math.round((Math.min(...ys) + Math.max(...ys)) / 2)];
    m.r = Math.round(Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * 1.4) / 2.4);
  }
  function caminoMasa(m) {
    const n = m.pts.length,
      mid = (i) => aLienzo((m.pts[i % n][0] + m.pts[(i + 1) % n][0]) / 2, (m.pts[i % n][1] + m.pts[(i + 1) % n][1]) / 2);
    c.beginPath();
    c.moveTo(...mid(0));
    for (let i = 1; i <= n; i++) c.quadraticCurveTo(...aLienzo(m.pts[i % n][0], m.pts[i % n][1]), ...mid(i));
    c.closePath();
  }

  // ---------- dibujar ----------
  function etiqueta(txt, x, y, col, fondo) {
    c.font = "600 12px system-ui, sans-serif";
    c.textAlign = "center";
    const w = c.measureText(txt).width + 10;
    c.fillStyle = fondo || "rgba(17,17,17,0.82)";
    c.fillRect(x - w / 2, y - 9, w, 18);
    c.fillStyle = col || "#F2ECEC";
    c.fillText(txt, x, y + 4);
  }
  function dibujarMazmorra(d) {
    const g = grilla(d);
    c.fillStyle = "#0A0606";
    c.fillRect(0, 0, cv.width, cv.height);
    // la grilla de fondo
    c.strokeStyle = "rgba(242,236,236,0.05)";
    c.lineWidth = 1;
    c.beginPath();
    for (let x = 0; x <= d.ancho; x++) c.moveTo(...aLienzo(x, 0)), c.lineTo(...aLienzo(x, d.alto));
    for (let y = 0; y <= d.alto; y++) c.moveTo(...aLienzo(0, y)), c.lineTo(...aLienzo(d.ancho, y));
    c.stroke();
    // pasillos
    for (let y = 0; y < d.alto; y++)
      for (let x = 0; x < d.ancho; x++)
        if (g[y * d.ancho + x] === 2) {
          const [px, py] = aLienzo(x, y);
          c.fillStyle = "#3A2E28";
          c.fillRect(px, py, k + 0.5, k + 0.5);
        }
    if (sel && sel.pasillo != null && d.pasillos[sel.pasillo]) {
      const pa = d.pasillos[sel.pasillo];
      c.strokeStyle = "#73D5DB";
      c.lineWidth = 3;
      c.setLineDash([6, 5]);
      c.beginPath();
      pa.p.forEach(([x, y], i) => (i ? c.lineTo(...aLienzo(x + 1, y + 1)) : c.moveTo(...aLienzo(x + 1, y + 1))));
      c.stroke();
      c.setLineDash([]);
    }
    // salas
    d.salas.forEach((s, i) => {
      const [px, py] = aLienzo(s.x, s.y);
      c.fillStyle = COL_SALA[s.tipo] || COL_SALA.sala;
      c.fillRect(px, py, s.w * k, s.h * k);
      // la luz de arriba a la derecha: la mitad izquierda un poco más oscura
      c.fillStyle = "rgba(0,0,0,0.18)";
      c.fillRect(px, py, (s.w * k) / 2, s.h * k);
      const elegida = sel && sel.sala === i;
      c.strokeStyle = elegida ? "#73D5DB" : "rgba(242,236,236,0.22)";
      c.lineWidth = elegida ? 3 : 1.5;
      c.strokeRect(px + 0.5, py + 0.5, s.w * k - 1, s.h * k - 1);
      const nom = t("ed.zn_sala_" + s.tipo) + (s.tipo === "jefe" && d.jefe ? " · " + t("ed.zn_jefe_" + d.jefe) : "");
      etiqueta(nom, px + (s.w * k) / 2, py + (s.h * k) / 2, s.tipo === "jefe" ? "#FF8D71" : s.tipo === "tesoro" ? "#FFD98A" : s.tipo === "entrada" ? "#73D5DB" : "#F2ECEC");
      if (elegida) {
        const [hx, hy] = esquina(s);
        c.fillStyle = "#73D5DB";
        c.fillRect(hx - 7, hy - 7, 12, 12);
      }
    });
    if (uniendo && sel && sel.sala != null && cursor && d.salas[sel.sala]) {
      const [ax, ay] = centro(d.salas[sel.sala]);
      c.strokeStyle = "#FFD98A";
      c.lineWidth = 2;
      c.setLineDash([8, 6]);
      c.beginPath();
      c.moveTo(...aLienzo(ax + 0.5, ay + 0.5));
      c.lineTo(cursor[0], cursor[1]);
      c.stroke();
      c.setLineDash([]);
    }
  }
  function dibujarTierra(d) {
    c.fillStyle = "#16303A";
    c.fillRect(0, 0, cv.width, cv.height);
    const pasos = d.pasos === false ? [] : Z.pasosDe(d.masas);
    const linea = (q, col, w) => {
      c.strokeStyle = col;
      c.lineWidth = Math.max(2, w * k);
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(...aLienzo(q.ax, q.ay));
      c.lineTo(...aLienzo(q.bx, q.by));
      c.stroke();
    };
    pasos.forEach((q) => linea(q, "#2A5A66", q.w + 140));
    const ceniza = new Set(d.cosas.filter((q) => q.tipo === "volcan").map((q) => q.m));
    c.lineJoin = "round";
    d.masas.forEach((m, i) => {
      caminoMasa(m);
      c.strokeStyle = "#2A5A66";
      c.lineWidth = Math.max(3, 260 * k);
      c.stroke();
      c.strokeStyle = ceniza.has(i) ? "#4A4442" : "#B8A47A";
      c.lineWidth = Math.max(2, 120 * k);
      c.stroke();
      c.fillStyle = ceniza.has(i) ? "#3A3432" : "#3E5A2E";
      c.fill();
    });
    pasos.forEach((q) => linea(q, "#B8A47A", q.w));
    c.lineCap = "butt";
    // la masa elegida: borde y sus puntos
    if (sel && sel.masa != null && d.masas[sel.masa]) {
      const m = d.masas[sel.masa];
      c.strokeStyle = "#73D5DB";
      c.lineWidth = 2;
      c.setLineDash([7, 5]);
      c.beginPath();
      m.pts.forEach(([x, y], i) => (i ? c.lineTo(...aLienzo(x, y)) : c.moveTo(...aLienzo(x, y))));
      c.closePath();
      c.stroke();
      c.setLineDash([]);
      m.pts.forEach(([x, y], j) => {
        const [px, py] = aLienzo(x, y);
        c.fillStyle = sel.punto === j ? "#FFD98A" : "#73D5DB";
        c.beginPath();
        c.arc(px, py, sel.punto === j ? 6 : 4.5, 0, Math.PI * 2);
        c.fill();
      });
    }
    // lo que hay encima, con su dibujo del juego en chico
    d.cosas.forEach((q, i) => {
      const [px, py] = aLienzo(q.x, q.y),
        id = ASSET_COSA[q.tipo];
      c.save();
      c.translate(px, py);
      const s = q.tipo === "volcan" ? k : Math.max(k * 2.4, 0.07);
      c.scale(s, s);
      try {
        ASSETS.dibujar(c, id, 0, 0, 0, { s: q.tipo === "volcan" ? 0.9 : 1, luz: !!q.a, tipo: "lobo" });
      } catch (e) {}
      c.restore();
      const elegida = sel && sel.cosa === i;
      if (elegida) {
        c.strokeStyle = "#73D5DB";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(px, py - 8, 20, 0, Math.PI * 2);
        c.stroke();
      }
      let nom = t("ed.zn_cosa_" + q.tipo);
      if (q.tipo === "cueva") {
        const m = q.a && todas()[q.a];
        nom += m ? " → " + m.d.nombre : "";
      }
      etiqueta(nom, px, py + 16, elegida ? "#73D5DB" : "#F2ECEC");
    });
    if (poniendo && cursor) etiqueta("+ " + t("ed.zn_cosa_" + poniendo), cursor[0], cursor[1] - 18, "#FFD98A");
  }
  function cuadro() {
    if (!abierta()) return;
    requestAnimationFrame(cuadro);
    const r = cv.getBoundingClientRect();
    if (cv.width !== Math.round(r.width) || cv.height !== Math.round(r.height)) (cv.width = Math.round(r.width)), (cv.height = Math.round(r.height));
    const d = datos();
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (!usable(d)) {
      c.fillStyle = "#0A0606";
      c.fillRect(0, 0, cv.width, cv.height);
      etiqueta(t("ed.zn_vacio"), cv.width / 2, cv.height / 2, "#B5A5A0");
      return;
    }
    encuadrar(d);
    if (d.tipo === "mazmorra") dibujarMazmorra(d);
    else dibujarTierra(d);
  }

  // ---------- tocar el plano ----------
  cv.addEventListener("pointerdown", (e) => {
    const d = datos();
    if (!usable(d)) return;
    cv.setPointerCapture(e.pointerId);
    const px = e.offsetX,
      py = e.offsetY;
    if (d.tipo === "mazmorra") {
      const [cx, cy] = celdaDe(px, py);
      // agrandar desde la esquina de la sala elegida
      if (sel && sel.sala != null && d.salas[sel.sala]) {
        const [hx, hy] = esquina(d.salas[sel.sala]);
        if (Math.abs(px - hx) < 10 && Math.abs(py - hy) < 10) {
          vivo = copia(d);
          arrastre = { tam: sel.sala };
          return;
        }
      }
      const si = salaEn(d, cx, cy);
      if (uniendo && sel && sel.sala != null) {
        uniendo = false;
        if (si >= 0 && si !== sel.sala) {
          const a = sel.sala;
          cambiar((z) => {
            const pa = { a, b: si, p: [[0, 0], [0, 0]] };
            rehacerPasillo(pa, z.salas);
            z.pasillos = z.pasillos || [];
            z.pasillos.push(pa);
          });
          E.avisar(t("ed.zn_unidas"));
        }
        return pintar();
      }
      if (si >= 0) {
        sel = { sala: si };
        vivo = copia(d);
        arrastre = { sala: si, dx: cx - d.salas[si].x, dy: cy - d.salas[si].y, movio: false };
        return pintar();
      }
      const pi = pasilloEn(d, cx, cy);
      sel = pi >= 0 ? { pasillo: pi } : null;
      return pintar();
    }
    // tierra
    const [x, y] = aZona(px, py);
    if (poniendo) {
      const tipo = poniendo;
      poniendo = null;
      const mi = masaEn(d, x, y);
      if (mi < 0 && tipo !== "muelle") return E.avisar(t("ed.zn_fuera")), pintar();
      cambiar((z) => {
        z.cosas.push({ tipo, x: Math.round(x), y: Math.round(y), m: Math.max(0, mi >= 0 ? mi : 0) });
        sel = { cosa: z.cosas.length - 1 };
      });
      return;
    }
    if (sel && sel.masa != null) {
      const j = puntoEn(d, sel.masa, px, py);
      if (j >= 0) {
        sel.punto = j;
        vivo = copia(d);
        arrastre = { punto: j, masa: sel.masa };
        return pintar();
      }
    }
    const ci = cosaEn(d, px, py);
    if (ci >= 0) {
      sel = { cosa: ci };
      vivo = copia(d);
      arrastre = { cosa: ci, x0: x, y0: y, movio: false };
      return pintar();
    }
    const mi = masaEn(d, x, y);
    if (mi >= 0) {
      sel = { masa: mi };
      vivo = copia(d);
      arrastre = { masa: mi, x0: x, y0: y, movio: false };
      return pintar();
    }
    sel = null;
    pintar();
  });
  cv.addEventListener("pointermove", (e) => {
    cursor = [e.offsetX, e.offsetY];
    if (!arrastre || !vivo) return;
    const d = vivo;
    if (d.tipo === "mazmorra") {
      const [cx, cy] = celdaDe(e.offsetX, e.offsetY);
      if (arrastre.tam != null) {
        const s = d.salas[arrastre.tam];
        s.w = Math.max(3, Math.min(d.ancho - 1 - s.x, cx - s.x + 1));
        s.h = Math.max(3, Math.min(d.alto - 1 - s.y, cy - s.y + 1));
      } else {
        const s = d.salas[arrastre.sala];
        const nx = Math.max(1, Math.min(d.ancho - 1 - s.w, cx - arrastre.dx)),
          ny = Math.max(1, Math.min(d.alto - 1 - s.h, cy - arrastre.dy));
        if (nx !== s.x || ny !== s.y) arrastre.movio = true;
        s.x = nx;
        s.y = ny;
      }
      (d.pasillos || []).forEach((pa) => (pa.a === (arrastre.sala ?? arrastre.tam) || pa.b === (arrastre.sala ?? arrastre.tam)) && rehacerPasillo(pa, d.salas));
      return;
    }
    const [x, y] = aZona(e.offsetX, e.offsetY);
    if (arrastre.punto != null) {
      d.masas[arrastre.masa].pts[arrastre.punto] = [Math.round(x), Math.round(y)];
      return;
    }
    const dx = x - arrastre.x0,
      dy = y - arrastre.y0;
    if (Math.abs(dx) + Math.abs(dy) > 20) arrastre.movio = true;
    if (!arrastre.movio) return;
    const base = actual().d;
    if (arrastre.cosa != null) {
      const q = base.cosas[arrastre.cosa];
      Object.assign(d.cosas[arrastre.cosa], { x: Math.round(q.x + dx), y: Math.round(q.y + dy) });
    } else {
      // la masa entera, con lo que tiene encima
      const m0 = base.masas[arrastre.masa];
      d.masas[arrastre.masa].pts = m0.pts.map(([px, py]) => [Math.round(px + dx), Math.round(py + dy)]);
      d.masas[arrastre.masa].c = [Math.round(m0.c[0] + dx), Math.round(m0.c[1] + dy)];
      d.cosas.forEach((q, i) => q.m === arrastre.masa && Object.assign(q, { x: Math.round(base.cosas[i].x + dx), y: Math.round(base.cosas[i].y + dy) }));
    }
  });
  addEventListener("pointerup", () => {
    if (!arrastre) return;
    const a = arrastre,
      v = vivo;
    arrastre = null;
    if (!v || (a.movio === false && a.tam == null && a.punto == null)) return (vivo = null), pintar();
    // la cosa queda en la masa donde se soltó
    if (a.cosa != null) {
      const q = v.cosas[a.cosa],
        mi = masaEn(v, q.x, q.y);
      if (mi >= 0) q.m = mi;
    }
    if (a.punto != null) recentrar(v.masas[a.masa]);
    cambiar((z) => Object.assign(z, v.tipo === "mazmorra" ? { salas: v.salas, pasillos: v.pasillos } : { masas: v.masas, cosas: v.cosas }));
  });
  cv.addEventListener("pointerleave", () => (cursor = null));

  // ---------- el panel ----------
  const FAM = Z.FAMILIAS;
  $("znFamilia").innerHTML = FAM.map((f) => `<option value="${f}">${t("ed.zn_fam_" + f)}</option>`).join("");
  $("znJefe").innerHTML = ["dreki", "campeon", ""].map((j) => `<option value="${j}">${t("ed.zn_jefe_" + (j || "nada"))}</option>`).join("");
  $("znSelClase").innerHTML = CLASES.map((s) => `<option value="${s}">${t("ed.zn_sala_" + s)}</option>`).join("");
  $("znSelCosa").innerHTML = COSAS.map((s) => `<option value="${s}">${t("ed.zn_cosa_" + s)}</option>`).join("");
  $("znPoner").innerHTML = `<option value="">${t("ed.zn_poner")}</option>` + COSAS.map((s) => `<option value="${s}">${t("ed.zn_cosa_" + s)}</option>`).join("");
  function llenarLista() {
    const T = todas(),
      l = $("znLista");
    const ids = Object.keys(T).filter((id) => usable(T[id].d) || T[id].base);
    l.innerHTML = ids.length ? "" : `<option value="">${t("ed.zn_ninguna")}</option>`;
    const grupo = (nom, lista) => {
      if (!lista.length) return;
      const og = document.createElement("optgroup");
      og.label = nom;
      lista.forEach((id) => {
        const o = document.createElement("option");
        o.value = id;
        const d = T[id].d;
        o.textContent = usable(d) ? d.nombre + (T[id].cambiada ? " *" : "") : id + " · " + t("ed.zn_quitada");
        og.appendChild(o);
      });
      l.appendChild(og);
    };
    grupo(t("ed.zn_del_juego"), ids.filter((id) => T[id].base));
    grupo(t("ed.zn_mias"), ids.filter((id) => !T[id].base));
    if (zid && T[zid]) l.value = zid;
  }
  function describir(d) {
    if (!usable(d)) return t("ed.zn_quitada_que");
    if (d.tipo === "mazmorra") {
      const n = sueltas(d);
      return t("ed.zn_que_mazmorra", [d.salas.length, (d.pasillos || []).length, t("ed.zn_jefe_" + (d.jefe || "nada")), t("ed.zn_fam_" + d.familia)]) + (n ? " " + t("ed.zn_sueltas", [n]) : "");
    }
    return t("ed.zn_que_tierra", [d.masas.filter((m) => !m.isla).length ? t("ed.zn_con_grande") : t("ed.zn_sin_grande"), d.masas.filter((m) => m.isla).length, d.cosas.filter((q) => q.tipo !== "muelle").map((q) => t("ed.zn_cosa_" + q.tipo).toLowerCase()).join(", ") || "—"]);
  }
  function dondeEntra(d) {
    if (d.en) return t("ed.zn_entra_en", [Math.round(d.en.x), Math.round(d.en.y)]);
    if (d.desde) {
      const T = todas()[d.desde.zona];
      return t("ed.zn_entra_cueva", [T ? T.d.nombre : d.desde.zona]);
    }
    return t("ed.zn_sin_entrada");
  }
  function pintar() {
    llenarLista();
    const a = actual(),
      d = a && a.d;
    document.querySelectorAll("#zonas .conZona").forEach((f) => f.classList.toggle("oculto", !a));
    if (!a) return;
    const ok = usable(d);
    $("znNombre").value = ok ? d.nombre : "";
    $("znNombre").disabled = !ok;
    $("znQue").textContent = describir(d);
    $("znEntra").textContent = ok ? dondeEntra(d) : "";
    document.querySelectorAll("#zonas .soloMaz").forEach((f) => f.classList.toggle("oculto", !ok || d.tipo !== "mazmorra"));
    document.querySelectorAll("#zonas .soloTierra").forEach((f) => f.classList.toggle("oculto", !ok || d.tipo !== "tierra"));
    $("znComoEra").classList.toggle("oculto", !a.cambiada);
    $("znBorrar").textContent = t(a.base ? "ed.zn_quitar" : "ed.zn_borrar");
    $("znBorrar").disabled = a.base && !ok;
    if (ok && d.tipo === "mazmorra") {
      $("znFamilia").value = d.familia;
      $("znJefe").value = d.jefe || "";
      $("znPal").value = d.pal || 0;
    }
    if (ok && d.tipo === "tierra") {
      $("znBosque").value = d.bosque != null ? d.bosque : 0.55;
      $("znPasos").checked = d.pasos !== false;
    }
    // lo elegido
    const hay = ok && sel && ((sel.sala != null && d.salas && d.salas[sel.sala]) || (sel.pasillo != null && d.pasillos && d.pasillos[sel.pasillo]) || (sel.masa != null && d.masas && d.masas[sel.masa]) || (sel.cosa != null && d.cosas && d.cosas[sel.cosa]));
    $("znSel").classList.toggle("oculto", !hay);
    if (!hay) return;
    ["znSelSalaF", "znSelCosaF", "znSelCuevaF", "znSelPuntoF", "znUnir"].forEach((id) => $(id).classList.add("oculto"));
    if (sel.sala != null) {
      const s = d.salas[sel.sala];
      $("znSelNombre").textContent = t("ed.zn_sala_" + s.tipo) + " · " + s.w + " × " + s.h;
      $("znSelClase").value = s.tipo;
      $("znSelSalaF").classList.remove("oculto");
      $("znUnir").classList.remove("oculto");
    } else if (sel.pasillo != null) {
      const pa = d.pasillos[sel.pasillo];
      $("znSelNombre").textContent = t("ed.zn_pasillo", [t("ed.zn_sala_" + d.salas[pa.a].tipo), t("ed.zn_sala_" + d.salas[pa.b].tipo)]);
    } else if (sel.masa != null) {
      const m = d.masas[sel.masa];
      $("znSelNombre").textContent = t(m.isla ? "ed.zn_isla" : "ed.zn_grande") + " · " + t("ed.zn_puntos", [m.pts.length]);
      $("znSelPuntoF").classList.remove("oculto");
      $("znSacarPunto").disabled = sel.punto == null || m.pts.length <= 5;
      $("znSumarPunto").disabled = sel.punto == null;
    } else {
      const q = d.cosas[sel.cosa];
      $("znSelNombre").textContent = t("ed.zn_cosa_" + q.tipo);
      $("znSelCosa").value = q.tipo;
      $("znSelCosaF").classList.remove("oculto");
      if (q.tipo === "cueva") {
        $("znSelCuevaF").classList.remove("oculto");
        const T = todas();
        const maz = Object.keys(T).filter((id) => T[id].d.tipo === "mazmorra" && !T[id].base);
        $("znSelLleva").innerHTML = `<option value="">${t("ed.zn_lleva_nada")}</option>` + maz.map((id) => `<option value="${id}">${T[id].d.nombre}</option>`).join("");
        $("znSelLleva").value = q.a && T[q.a] ? q.a : "";
      }
    }
  }
  $("znLista").addEventListener("change", () => elegir($("znLista").value));
  $("znCerrar").onclick = () => cerrar();
  $("znNombre").addEventListener("change", () => {
    const v = $("znNombre").value.trim().slice(0, 60);
    if (v) cambiar((z) => (z.nombre = v));
  });
  $("znFamilia").addEventListener("change", () => cambiar((z) => (z.familia = $("znFamilia").value)));
  $("znJefe").addEventListener("change", () => cambiar((z) => (z.jefe = $("znJefe").value || null)));
  $("znPal").addEventListener("change", () => cambiar((z) => (z.pal = +$("znPal").value)));
  $("znBosque").addEventListener("change", () => cambiar((z) => (z.bosque = +$("znBosque").value)));
  $("znPasos").addEventListener("change", () => cambiar((z) => ($("znPasos").checked ? delete z.pasos : (z.pasos = false))));
  $("znSelClase").addEventListener("change", () => {
    const v = $("znSelClase").value,
      i = sel.sala;
    cambiar((z) => {
      // una sola entrada y un solo jefe: la que tenía esa clase pasa a ser sala común
      if (v === "entrada" || v === "jefe") z.salas.forEach((s, j) => j !== i && s.tipo === v && (s.tipo = "sala"));
      z.salas[i].tipo = v;
      if (v === "jefe" && !z.jefe) z.jefe = "campeon";
    });
  });
  $("znSelCosa").addEventListener("change", () => {
    const v = $("znSelCosa").value,
      i = sel.cosa;
    cambiar((z) => {
      z.cosas[i].tipo = v;
      if (v !== "cueva") delete z.cosas[i].a;
    });
  });
  $("znSelLleva").addEventListener("change", () => {
    const v = $("znSelLleva").value,
      i = sel.cosa,
      tid = zid;
    cambiar((z, est) => {
      if (v) z.cosas[i].a = v;
      else delete z.cosas[i].a;
      if (v && est.zonas[v]) (est.zonas[v].desde = { zona: tid }), delete est.zonas[v].en;
    });
  });
  // una mazmorra nueva para esta cueva (con dragón si la tierra todavía no tiene uno)
  $("znSelCrear").onclick = () => {
    const i = sel.cosa,
      tid = zid,
      mid = nuevoId(tid + "m");
    const d0 = actual().d;
    const conDragon = !d0.cosas.some((q) => q.a && todas()[q.a] && todas()[q.a].d.jefe === "dreki");
    const m = Z.generarMazmorra({ jefe: conDragon ? "dreki" : "campeon", familia: conDragon ? "fatuos" : undefined, nombre: t(conDragon ? "zn.nombre_guarida" : "zn.nombre_cueva", [d0.nombre]) }, Math.random());
    m.desde = { zona: tid };
    cambiar((z, est) => {
      est.zonas[mid] = m;
      z.cosas[i].a = mid;
    });
    E.avisar(t("ed.zn_creada", [m.nombre]));
  };
  $("znSelIr").onclick = () => {
    const q = actual().d.cosas[sel.cosa];
    if (q && q.a && todas()[q.a]) elegir(q.a);
  };
  $("znUnir").onclick = () => {
    uniendo = true;
    E.avisar(t("ed.zn_unir_aviso"));
  };
  $("znSelSacar").onclick = () => sacar();
  $("znSacarPunto").onclick = () => {
    const mi = sel.masa,
      j = sel.punto;
    cambiar((z) => {
      z.masas[mi].pts.splice(j, 1);
      recentrar(z.masas[mi]);
    });
    sel = { masa: mi };
    pintar();
  };
  $("znSumarPunto").onclick = () => {
    const mi = sel.masa,
      j = sel.punto;
    cambiar((z) => {
      const p = z.masas[mi].pts,
        a = p[j],
        b = p[(j + 1) % p.length];
      p.splice(j + 1, 0, [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)]);
    });
    sel = { masa: mi, punto: j + 1 };
    pintar();
  };
  function sacar() {
    const d = actual() && actual().d;
    if (!sel || !usable(d)) return;
    if (sel.sala != null) {
      const i = sel.sala;
      if (d.salas[i].tipo === "entrada") return E.avisar(t("ed.zn_sin_sacar_entrada"));
      cambiar((z) => {
        z.salas.splice(i, 1);
        z.pasillos = (z.pasillos || []).filter((pa) => pa.a !== i && pa.b !== i).map((pa) => Object.assign(pa, { a: pa.a > i ? pa.a - 1 : pa.a, b: pa.b > i ? pa.b - 1 : pa.b }));
      });
    } else if (sel.pasillo != null) {
      const i = sel.pasillo;
      cambiar((z) => z.pasillos.splice(i, 1));
    } else if (sel.masa != null) {
      const mi = sel.masa;
      if (d.masas.length <= 1) return E.avisar(t("ed.zn_sin_sacar_masa"));
      cambiar((z) => {
        z.masas.splice(mi, 1);
        z.cosas = z.cosas.filter((q) => q.m !== mi).map((q) => Object.assign(q, { m: q.m > mi ? q.m - 1 : q.m }));
      });
    } else if (sel.cosa != null) {
      const i = sel.cosa;
      cambiar((z) => z.cosas.splice(i, 1));
    }
    sel = null;
    pintar();
  }
  // sumar una sala (unida a la más cercana) o una isla
  $("znMasSala").onclick = () => {
    const d = actual().d;
    const choca = (a) => d.salas.some((b) => a.x < b.x + b.w + 1 && b.x < a.x + a.w + 1 && a.y < b.y + b.h + 1 && b.y < a.y + a.h + 1);
    let s = null;
    for (let r = 0; r < 20 && !s; r++)
      for (let k2 = 0; k2 < 40 && !s; k2++) {
        const q = { x: Math.round(d.ancho / 2 - 2 + (Math.random() * 2 - 1) * r * 2), y: Math.round(d.alto / 2 - 2 + (Math.random() * 2 - 1) * r * 1.5), w: 5, h: 4, tipo: "sala" };
        if (q.x >= 1 && q.y >= 1 && q.x + q.w < d.ancho - 1 && q.y + q.h < d.alto - 1 && !choca(q)) s = q;
      }
    if (!s) return E.avisar(t("ed.zn_sin_lugar"));
    cambiar((z) => {
      z.salas.push(s);
      const i = z.salas.length - 1;
      let mejor = -1,
        md = 1e9;
      z.salas.forEach((o, j) => {
        if (j === i || o.tipo === "jefe") return;
        const dd = Math.hypot(centro(o)[0] - centro(s)[0], centro(o)[1] - centro(s)[1]);
        if (dd < md) (md = dd), (mejor = j);
      });
      if (mejor >= 0) {
        const pa = { a: mejor, b: i, p: [[0, 0], [0, 0]] };
        rehacerPasillo(pa, z.salas);
        (z.pasillos = z.pasillos || []).push(pa);
      }
      sel = { sala: i };
    });
  };
  $("znMasIsla").onclick = () => {
    const d = actual().d;
    // en el lugar con más mar alrededor de una grilla gruesa
    let mejor = null;
    for (let gx = 1; gx < 8; gx++)
      for (let gy = 1; gy < 6; gy++) {
        const x = (gx / 8) * d.ancho,
          y = (gy / 6) * d.alto;
        const dd = Math.min(...d.masas.map((m) => Math.hypot(m.c[0] - x, (m.c[1] - y) * 1.3) - m.r * 1.2), 1e9);
        if (!mejor || dd > mejor.d) mejor = { d: dd, x, y };
      }
    const rad = 900,
      pts = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2,
        kk = 0.8 + Math.random() * 0.3;
      pts.push([Math.round(mejor.x + Math.cos(a) * rad * 1.15 * kk), Math.round(mejor.y + Math.sin(a) * rad * 0.8 * kk)]);
    }
    cambiar((z) => {
      z.masas.push({ pts, isla: true, c: [Math.round(mejor.x), Math.round(mejor.y)], r: rad });
      sel = { masa: z.masas.length - 1 };
    });
  };
  $("znPoner").addEventListener("change", () => {
    poniendo = $("znPoner").value || null;
    $("znPoner").value = "";
    if (poniendo) E.avisar(t("ed.zn_poner_aviso", [t("ed.zn_cosa_" + poniendo)]));
  });
  // entrada en el bosque: al centro de la vista del editor
  $("znEntrada").onclick = () => {
    const x = Math.round(E.cam.x),
      y = Math.round(E.cam.y);
    cambiar((z, est) => {
      z.en = { x, y };
      delete z.desde;
      // si alguna cueva llevaba acá, ya no
      Object.values(est.zonas).forEach((o) => o && o.cosas && o.cosas.forEach((q) => q.a === zid && delete q.a));
    });
    E.avisar(t("ed.zn_entrada_lista"));
  };
  $("znIrEntrada").onclick = () => {
    const d = actual().d;
    if (!d.en) return;
    E.cam.x = d.en.x;
    E.cam.y = d.en.y;
    E.cam.z = Math.max(E.cam.z, 0.5);
    cerrar();
  };
  $("znDuplicar").onclick = () => {
    const a = actual();
    if (!a || !usable(a.d)) return;
    const id = nuevoId(a.d.tipo === "mazmorra" ? "maz" : "tierra"),
      d = copia(a.d);
    d.nombre = t("ed.zn_copia", [d.nombre]);
    delete d.base;
    if (d.en) d.en = { x: d.en.x + 400, y: d.en.y + 200 };
    if (d.cosas) d.cosas.forEach((q) => delete q.a);
    E.cambiar((est) => (est.zonas[id] = d));
    elegir(id);
  };
  $("znBorrar").onclick = () => {
    const a = actual();
    if (!a || !confirm(t(a.base ? "ed.zn_quitar_seguro" : "ed.zn_borrar_seguro", [a.d.nombre || zid]))) return;
    const id = zid;
    E.cambiar((est) => {
      if (a.base) est.zonas[id] = { tipo: "quitada" };
      else delete est.zonas[id];
      Object.values(est.zonas).forEach((o) => o && o.cosas && o.cosas.forEach((q) => q.a === id && delete q.a));
    });
    if (!a.base) zid = Object.keys(todas())[0] || null;
    sel = null;
    pintar();
  };
  $("znComoEra").onclick = () => {
    if (!confirm(t("ed.zn_como_era_seguro"))) return;
    const id = zid;
    E.cambiar((est) => delete est.zonas[id]);
    sel = null;
    pintar();
  };
  $("znProbar").onclick = () => {
    const lang = new URLSearchParams(location.search).get("lang");
    open("index.html?borrador=1&jugar=9&zona=" + encodeURIComponent(zid) + (lang ? "&lang=" + lang : ""), "_blank");
  };

  // ---------- generar desde un texto ----------
  // lo generado entra entero (la tierra y la mazmorra de cada cueva); si se vuelve a generar sobre una mía, la pisa
  function generar(pedido, txt, sobre) {
    const id = sobre || nuevoId(pedido.tipo === "mazmorra" ? "maz" : "tierra");
    const sem = Math.round(Math.random() * 1000) / 1000;
    const out = Z.armarPedido(pedido, sem, id);
    const d = out[id];
    d.pedido = txt;
    d.op = pedido;
    const viejo = sobre && E.est().zonas[sobre];
    d.en = viejo && viejo.en ? viejo.en : { x: Math.round(E.cam.x), y: Math.round(E.cam.y) };
    if (viejo && viejo.nombre && !pedido.nombre) d.nombre = viejo.nombre;
    E.cambiar((est) => {
      // las mazmorras de las cuevas de la versión anterior se van con ella
      if (viejo && viejo.cosas) viejo.cosas.forEach((q) => q.a && est.zonas[q.a] && est.zonas[q.a].desde && est.zonas[q.a].desde.zona === sobre && delete est.zonas[q.a]);
      Object.assign(est.zonas, out);
    });
    elegir(id);
    E.avisar(t(sobre ? "ed.zn_otra_lista" : "ed.zn_generada", [d.nombre, Object.keys(out).length - 1]));
  }
  $("znGenOk").onclick = () => {
    const txt = $("znGenTexto").value.trim();
    if (!txt) return E.avisar(t("ed.zn_gen_sin_texto"));
    generar(Z.leerPedido(txt), txt);
  };
  $("znGenOtra").onclick = () => {
    const a = actual();
    if (!a || a.base || !a.d.op) return E.avisar(t("ed.zn_gen_otra_no"));
    generar(a.d.op, a.d.pedido, zid);
  };
  // con IA: el texto libre pasa al mismo pedido que arma el lector (y lo que la IA no entiende, lo lee él)
  $("znGenIA").onclick = async () => {
    const txt = $("znGenTexto").value.trim();
    if (!txt) return E.avisar(t("ed.zn_gen_sin_texto"));
    const ia = window.EDITOR_IA && EDITOR_IA.paraTarea("generar");
    if (!ia) return E.avisar(t("ed.cu_gen_sin_clave"));
    const sistema =
      "Convertís el pedido de una zona de un juego vikingo en JSON, solo JSON, sin texto alrededor. Hay dos clases de zona. " +
      'Mazmorra: {"tipo": "mazmorra", "nombre": texto corto en el idioma del pedido, "salas": 3 a 14, "jefe": "dreki" (dragón) o "campeon" o null, "familia": una de ' +
      FAM.join(", ") +
      ', "oscuras": 0 a 1 (cuántas salas sin antorchas)}. ' +
      'Tierra: {"tipo": "tierra", "nombre": texto corto, "grande": true si hay una tierra grande, "islas": 0 a 8, "rasgos": [{"cosa": una de ' +
      Z.COSAS.join(", ") +
      ', "donde": "isla" o "tierra", "familia": para un campamento, una de las familias, "mazmorra": solo para una cueva que lleva a una mazmorra: {"jefe": "dreki" o "campeon", "familia": una familia, "oscuras": 0 a 1}}]}.';
    $("znGenIA").disabled = true;
    E.avisar(t("ed.cu_gen_pensando"));
    try {
      const r = (await EDITOR_IA.llamarTarea("generar", [{ role: "user", content: txt }], sistema)).txt;
      const js = JSON.parse((r.match(/\{[\s\S]*\}/) || ["{}"])[0]);
      const leido = Z.leerPedido(txt);
      let p;
      if (js.tipo === "mazmorra")
        p = { tipo: "mazmorra", salas: Math.max(3, Math.min(14, +js.salas || leido.salas || 8)), jefe: js.jefe === "dreki" || js.jefe === "campeon" ? js.jefe : null, familia: FAM.includes(js.familia) ? js.familia : leido.familia, oscuras: js.oscuras != null ? Math.max(0, Math.min(1, +js.oscuras)) : undefined };
      else
        p = {
          tipo: "tierra",
          grande: js.grande !== false,
          islas: Math.max(0, Math.min(8, js.islas != null ? +js.islas : leido.islas || 0)),
          rasgos: (Array.isArray(js.rasgos) ? js.rasgos : leido.rasgos || [])
            .filter((q) => q && Z.COSAS.includes(q.cosa))
            .map((q) => ({ cosa: q.cosa, donde: q.donde === "tierra" ? "tierra" : "isla", familia: FAM.includes(q.familia) ? q.familia : undefined, mazmorra: q.cosa === "cueva" && q.mazmorra ? { jefe: q.mazmorra.jefe === "dreki" ? "dreki" : "campeon", familia: FAM.includes(q.mazmorra.familia) ? q.mazmorra.familia : undefined, oscuras: q.mazmorra.oscuras != null ? +q.mazmorra.oscuras : undefined } : undefined })),
        };
      if (typeof js.nombre === "string" && js.nombre.trim()) p.nombre = js.nombre.trim().slice(0, 60);
      generar(p, txt);
    } catch (e) {
      E.avisar(t("ed.cu_gen_error", [e.message || e]));
    } finally {
      $("znGenIA").disabled = false;
    }
  };

  // ---------- en el mapa del editor: cada entrada con su dibujo y su nombre; con Mover se arrastra ----------
  function entradas() {
    const T = todas();
    return Object.keys(T)
      .filter((id) => usable(T[id].d) && T[id].d.en)
      .map((id) => ({ id, d: T[id].d }));
  }
  function dibujar(c2, cam, V, tt) {
    if (!$("verZonas").checked) return;
    entradas().forEach(({ id, d }) => {
      const p = arrastreMapa && arrastreMapa.id === id ? arrastreMapa : d.en;
      const dv = E.enVista({ id: d.tipo === "mazmorra" ? "bocaMazmorra" : "barcaVikinga", x: p.x, y: p.y, o: { s: 1, luz: !!d.jefe } });
      try {
        ASSETS.dibujar(c2, dv.id, dv.x, dv.y, tt, dv.o);
      } catch (e) {}
      const [vx, vy] = V(p.x, p.y);
      c2.save();
      c2.translate(vx, vy + 40);
      c2.scale(1 / cam.z, 1 / cam.z);
      c2.font = "bold 14px system-ui, sans-serif";
      c2.textAlign = "center";
      const txt = d.nombre,
        w = c2.measureText(txt).width + 16;
      c2.fillStyle = "rgba(17,17,17,0.85)";
      c2.fillRect(-w / 2, 0, w, 22);
      c2.fillStyle = "#FF8D71";
      c2.fillText(txt, 0, 16);
      c2.restore();
    });
  }
  let arrastreMapa = null;
  function clic(x, y) {
    if (E.herr() !== "mover" || !$("verZonas").checked) return false;
    const e = entradas().find(({ d }) => Math.abs(d.en.x - x) < 170 && y < d.en.y + 40 && y > d.en.y - 260);
    if (!e) return false;
    arrastreMapa = { id: e.id, x: e.d.en.x, y: e.d.en.y, dx: x - e.d.en.x, dy: y - e.d.en.y };
    return true;
  }
  $("mapa").addEventListener("pointermove", (ev) => {
    if (!arrastreMapa) return;
    const [x, y] = E.aMundo(ev.offsetX, ev.offsetY);
    arrastreMapa.x = Math.round(x - arrastreMapa.dx);
    arrastreMapa.y = Math.round(y - arrastreMapa.dy);
    E.pedir();
  });
  addEventListener("pointerup", () => {
    if (!arrastreMapa) return;
    const a = arrastreMapa;
    arrastreMapa = null;
    const T = todas()[a.id];
    if (!T || (T.d.en.x === a.x && T.d.en.y === a.y)) return E.pedir();
    E.cambiar((est) => {
      const d = (est.zonas[a.id] = est.zonas[a.id] || copia(T.d));
      d.en = { x: a.x, y: a.y };
    });
    E.avisar(t("ed.zn_movida", [T.d.nombre]));
  });

  // ---------- abrir y cerrar ----------
  function elegir(id) {
    zid = id || null;
    sel = null;
    vivo = null;
    uniendo = false;
    poniendo = null;
    pintar();
  }
  const abierta = () => !caja.classList.contains("oculto");
  function abrir(id) {
    E.usar("zonas");
    bases = null;
    if (id) zid = id;
    if (!zid || !todas()[zid]) zid = Object.keys(todas())[0] || null;
    caja.classList.remove("oculto");
    pintar();
    requestAnimationFrame(cuadro);
  }
  function cerrar() {
    caja.classList.add("oculto");
    arrastre = null;
    E.pedir();
  }
  function tecla(e) {
    const kk = e.key;
    if (kk === "Escape") {
      e.preventDefault();
      if (uniendo || poniendo || sel) return (uniendo = false), (poniendo = null), (sel = null), pintar();
      return cerrar();
    }
    if (kk === "Delete" || kk === "Backspace") return e.preventDefault(), sacar();
    if (kk === "m" || kk === "M") return cerrar();
  }
  $("hZonas").onclick = () => abrir();
  return { abrir, cerrar, abierta, tecla, alternar: () => (abierta() ? cerrar() : abrir()), dibujar, clic, elegir, zona: () => zid };
})();
