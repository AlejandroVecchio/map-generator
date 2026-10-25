// ---------- regiones, piezas y exportar el mundo ----------
// Región (tecla 0): clic en cada punto del borde, Enter o clic en el primer punto para cerrarla; se le pone nombre en
// los dos idiomas y el juego lo muestra al entrar (motor/regiones.js). Con la herramienta, un clic adentro de una
// región la renombra o la saca.
// Piezas: lo elegido se guarda como una pieza con nombre («granja chica») y se pone entera donde se hace clic.
// Exportar: todo el mundo armado (objetos, caminos, agua, alturas, lugares, interiores y regiones) en un JSON abierto,
// para leerlo desde otro motor (docs/formato-mundo.md).
window.EDITOR_MUNDO = (function () {
  "use strict";
  const E = window.EDITOR,
    W = E.W,
    t = E.t,
    $ = (id) => document.getElementById(id);
  let trazo = null, // los puntos de la región que se está dibujando
    pieza = null; // la pieza que se pone con el próximo clic
  const r1 = (v) => Math.round(v);
  // el nombre y «¿está adentro?» son los mismos que usa el juego (motor/regiones.js)
  const { nombreDe, adentro } = window.REGIONES;
  function pedirNombre(previo) {
    const es = prompt(t("ed.reg_nombre_es"), (previo && previo.es) || "");
    if (es === null) return null;
    const en = prompt(t("ed.reg_nombre_en"), (previo && previo.en) || es);
    if (en === null) return null;
    return { es: es.trim(), en: (en || es).trim() };
  }

  // ---------- regiones ----------
  function cerrarRegion() {
    const p = trazo;
    trazo = null;
    if (!p || p.length < 3) return E.pedir();
    const nombre = pedirNombre();
    if (!nombre || !nombre.es) return E.pedir();
    E.cambiar((est) => (est.regiones = est.regiones || []).push({ u: "r" + Date.now().toString(36), nombre, p }));
    E.avisar(t("ed.reg_hecha", [nombre.es]));
  }
  function clic(x, y, e) {
    if (pieza) {
      E.pegarEn(pieza.items, x, y);
      if (!e.shiftKey) soltarPieza();
      return true;
    }
    if (E.herr() !== "region") return false;
    if (trazo) {
      const [fx, fy] = trazo[0],
        cerca = Math.hypot(fx - x, fy - y) * E.cam.z < 16;
      if (cerca && trazo.length >= 3) cerrarRegion();
      else trazo.push([r1(x), r1(y)]);
      return true;
    }
    // un clic adentro de una región ya hecha: renombrarla o sacarla
    const regs = E.est().regiones || [];
    for (let i = regs.length - 1; i >= 0; i--) {
      if (!adentro(x, y, regs[i].p)) continue;
      if (confirm(t("ed.reg_sacar", [nombreDe(regs[i])]))) E.cambiar((est) => est.regiones.splice(i, 1));
      else {
        const n = pedirNombre(regs[i].nombre);
        if (n && n.es) E.cambiar((est) => (est.regiones[i].nombre = n));
      }
      return true;
    }
    trazo = [[r1(x), r1(y)]];
    return true;
  }
  function tecla(e) {
    if (e.key === "0" && !e.ctrlKey && !e.metaKey) return E.ponerHerr("region"), true;
    if (trazo && e.key === "Enter") return cerrarRegion(), true;
    if (trazo && e.key === "Escape") return (trazo = null), E.pedir(), true;
    if (trazo && e.key === "Backspace") return trazo.pop(), trazo.length || (trazo = null), E.pedir(), true;
    if (pieza && e.key === "Escape") return soltarPieza(), true;
    return false;
  }
  function dibujar(c, cam, V, cursor, tt) {
    const regs = E.est().regiones || [],
      ver = E.herr() === "region" || $("verRegiones").checked;
    c.save();
    if (ver)
      regs.forEach((r) => {
        c.beginPath();
        r.p.forEach(([x, y], i) => (i ? c.lineTo(...V(x, y)) : c.moveTo(...V(x, y))));
        c.closePath();
        c.fillStyle = "rgba(154,107,216,0.10)";
        c.fill();
        c.strokeStyle = "#9A6BD8";
        c.lineWidth = 2.5 / cam.z;
        c.setLineDash([12 / cam.z, 7 / cam.z]);
        c.stroke();
        c.setLineDash([]);
        const cx = r.p.reduce((s, q) => s + q[0], 0) / r.p.length,
          cy = r.p.reduce((s, q) => s + q[1], 0) / r.p.length,
          [vx, vy] = V(cx, cy);
        c.save();
        c.translate(vx, vy);
        c.scale(1 / cam.z, 1 / cam.z);
        c.font = "bold 15px system-ui, sans-serif";
        c.textAlign = "center";
        c.fillStyle = "rgba(17,17,17,0.85)";
        const w = c.measureText(nombreDe(r)).width + 16;
        c.fillRect(-w / 2, -14, w, 24);
        c.fillStyle = "#C9B0F0";
        c.fillText(nombreDe(r), 0, 3);
        c.restore();
      });
    if (trazo) {
      c.beginPath();
      trazo.concat(cursor ? [[cursor.x, cursor.y]] : []).forEach(([x, y], i) => (i ? c.lineTo(...V(x, y)) : c.moveTo(...V(x, y))));
      c.strokeStyle = "#9A6BD8";
      c.lineWidth = 3 / cam.z;
      c.stroke();
      trazo.forEach(([x, y], i) => {
        c.beginPath();
        c.arc(...V(x, y), (i ? 5 : 8) / cam.z, 0, Math.PI * 2);
        c.fillStyle = i ? "#9A6BD8" : "#FFD98A";
        c.fill();
      });
    }
    // la pieza que se va a poner, transparente bajo el puntero
    if (pieza && cursor)
      E.fantasmas(
        c,
        pieza.items.map((it) => {
          const o = Object.assign({}, it.o);
          if (o.x2 !== undefined) (o.x2 += cursor.x), (o.y2 += cursor.y);
          return { id: it.id, x: cursor.x + it.dx, y: cursor.y + it.dy, o };
        }),
        tt,
        0.55
      );
    c.restore();
  }

  // ---------- piezas ----------
  function pintarPiezas() {
    const pz = E.est().piezas || {},
      antes = $("piezas").value;
    $("piezas").innerHTML = `<option value="">${t("ed.piezas")}</option>` + Object.keys(pz).sort().map((k) => `<option value="${encodeURIComponent(k)}">${k.replace(/</g, "&lt;")} · ${pz[k].length}</option>`).join("");
    $("piezas").value = pieza ? antes : "";
  }
  function soltarPieza() {
    pieza = null;
    $("piezas").value = "";
    E.pedir();
  }
  $("bPieza").onclick = () => {
    const items = E.copiarElegido();
    if (!items) return;
    const nom = (prompt(t("ed.pieza_nombre")) || "").trim();
    if (!nom) return;
    E.cambiar((est) => ((est.piezas = est.piezas || {})[nom] = JSON.parse(JSON.stringify(items))));
    pintarPiezas();
    E.usar("pieza");
    E.avisar(t("ed.pieza_ok", [nom]));
  };
  $("piezas").addEventListener("change", () => {
    const k = decodeURIComponent($("piezas").value),
      pz = (E.est().piezas || {})[k];
    $("piezas").blur();
    if (!pz) return soltarPieza();
    pieza = { nombre: k, items: pz };
    E.avisar(t("ed.pieza_poner", [k]));
  });

  // ---------- exportar el mundo entero en JSON ----------
  // sin funciones, sin ciclos y con números redondeados: lo que un motor necesita para volver a armarlo
  function limpio(v, vistos) {
    if (v === null || typeof v === "boolean" || typeof v === "string") return v;
    if (typeof v === "number") return isFinite(v) ? Math.round(v * 100) / 100 : null;
    if (typeof v !== "object") return undefined;
    if (vistos.has(v)) return undefined;
    vistos.add(v);
    let r;
    if (Array.isArray(v)) r = v.map((x) => limpio(x, vistos)).filter((x) => x !== undefined);
    else {
      r = {};
      for (const k of Object.keys(v)) {
        if (k[0] === "_" || k === "luzCv") continue;
        const x = limpio(v[k], vistos);
        if (x !== undefined) r[k] = x;
      }
    }
    vistos.delete(v);
    return r;
  }
  function exportar() {
    const est = E.est(),
      L = (o) => limpio(o, new Set()),
      usados = new Set(),
      nombradas = new Map(Object.entries(W.NOMBRADAS || {}).map(([k, o]) => [o, k]));
    const objetos = W.COSAS.map((o) => {
      usados.add(o.id);
      const r = { id: o.id, x: r1(o.x), y: r1(o.y), o: L(o.o || {}) };
      if (nombradas.has(o)) r.nombre = nombradas.get(o);
      return r;
    });
    const catalogo = {};
    usados.forEach((id) => {
      const d = ASSETS.LISTA[id];
      if (!d) return;
      const md = ASSETS.medidas(id, Object.assign({}, ASSETS.EJEMPLO[id]));
      catalogo[id] = { clave: "as." + id, nombre: I18N.t("as." + id), grupo: d.grupo || "", alto: d.alto || 0, choque: L(md.choque || null), piso: !!d.piso };
    });
    const interiores = {};
    if (window.INTERIORES && INTERIORES.vista)
      INTERIORES.PLANTILLAS.forEach((pl) => {
        const d = INTERIORES.vista(pl, est.cuartos || {});
        interiores[pl] = { pared: d.pared, ventana: d.ventana, estandarte: d.estandarte, repisa: d.repisa, muebles: d.muebles.map((q) => ({ id: q.id, x: r1(q.x), y: r1(q.y), o: L(q.o), r: q.r, piso: !!q.piso, accion: q.accion || null })), gente: d.gente.map((g) => ({ id: g.id, x: r1(g.x), y: r1(g.y) })) };
      });
    const mundo = {
      formato: "eromash-mundo",
      version: 1,
      juego: "eromash-aventura",
      zona: "eldervald",
      fecha: new Date().toISOString(),
      unidades: { porMetro: 30, porPixelDelMapa: W.U, ancho: W.ANCHO, alto: W.ALTO, ejes: "x crece al este, y crece al sur; x, y es donde el objeto toca el piso" },
      catalogo,
      objetos,
      piso: L(W.DECO || []),
      barro: L(W.BARROS || []),
      caminos: L(W.CAMINOS),
      agua: { rios: L(W.RIOS), lagos: L(W.LAGOS), puentes: L(W.PUENTES || []) },
      alturas: L(W.NIVELES || []),
      lugares: L(W.LUGARES || {}),
      puntos: L(W.PUNTOS || {}),
      regiones: L(est.regiones || []),
      texturas: L(est.texturas || {}),
      interiores,
      cuarto: { ancho: window.INTERIORES ? INTERIORES.RW : 1600, alto: window.INTERIORES ? INTERIORES.RH : 900, fondo: window.INTERIORES ? INTERIORES.FONDO : 600 },
    };
    const blob = new Blob([JSON.stringify(mundo)], { type: "application/json" }),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "eldervald.mundo.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    E.avisar(t("ed.exportado", [objetos.length]));
    return mundo;
  }
  $("bExportar").onclick = () => exportar();
  $("bExportar").title = t("ed.exportar");
  // cambiar de herramienta deja la región a medio dibujar
  E.alCambiarHerr((h) => h !== "region" && trazo && ((trazo = null), E.pedir()));
  pintarPiezas();
  return { clic, tecla, dibujar, exportar, pintarPiezas, enTrazo: () => !!trazo || !!pieza, trazando: () => !!trazo, pieza: () => !!pieza };
})();
