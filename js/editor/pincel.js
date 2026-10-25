// ---------- el pincel (tecla B): rociar, tupir el bosque y abrir claros ----------
// Se pinta arrastrando; el círculo bajo el puntero es el pincel ([ y ] cambian el tamaño, Shift+[ y ] la densidad).
// Rociar: pone lo elegido de una mezcla (bosque, abetal, robledal, abedular, rocas, sotobosque) o el objeto elegido en
// la lista, cada uno con su variante, tamaño y lado, sin caer en caminos ni en el agua ni encima de otro.
// Abrir: saca los árboles, rocas y plantas del círculo (no lo de la historia ni las casas) y, si «bordes» está
// prendido, deja tocones y árboles talados o quebrados en la orilla, como los claros del bosque.
// Todo el trazo es un solo paso de Deshacer.
window.EDITOR_PINCEL = (function () {
  "use strict";
  const E = window.EDITOR,
    W = E.W,
    t = E.t,
    $ = (id) => document.getElementById(id);
  const MEZCLAS = {
    bosque: [["pino", 55], ["roble", 22], ["abedul", 15], ["abetoAnciano", 4], ["robleAnciano", 1], ["roca", 3]],
    abetal: [["pino", 78], ["abetoAnciano", 18], ["roca", 4]],
    robledal: [["roble", 68], ["robleAnciano", 8], ["abedul", 20], ["roca", 4]],
    abedular: [["abedul", 85], ["pino", 10], ["roca", 5]],
    rocas: [["roca", 100]],
    sotobosque: [["helechos", 50], ["hongosRocio", 30], ["alfombraMusgo", 20]],
  };
  const BORDES = [["tocon", 50], ["pinoTalado", 30], ["arbolQuebrado", 20]];
  let radio = 600,
    trazo = null; // { modo, poner: [], quitar: Map, ultimo: [x, y] }
  const modo = () => $("pincelModo").value,
    densidad = () => +$("pincelDensidad").value;
  function azar(l) {
    const tot = l.reduce((s, q) => s + q[1], 0);
    let r = Math.random() * tot;
    for (const [id, p] of l) if ((r -= p) <= 0) return id;
    return l[0][0];
  }
  const radioDe = (id) => {
    const d = ASSETS.LISTA[id];
    return d && d.choque && d.choque.r ? d.choque.r : 12;
  };
  // ¿se puede poner acá? fuera de caminos y agua, y lejos de lo que ya hay (de lo del mundo y de lo de este trazo)
  function libre(x, y, id, cerca) {
    if (x < 0 || y < 0 || x > W.ANCHO || y > W.ALTO) return false;
    const r = radioDe(id),
      piso = ASSETS.LISTA[id] && ASSETS.LISTA[id].piso;
    for (const c of W.CAMINOS) if (W.distLinea(x, y, c.p) < c.w / 2 + r) return false;
    for (const rio of W.RIOS) if (!rio.seco && W.distLinea(x, y, rio.p) < rio.w / 2 + r) return false;
    for (const l of W.LAGOS) if (!l.seco && Math.hypot((x - l.p[0]) / (l.rx + r), (y - l.p[1]) / (l.ry + r)) < 1) return false;
    if (piso) return true;
    for (const o of cerca) if (o.cuenta && Math.hypot(o.x - x, o.y - y) < (radioDe(o.id) + r) * 1.6) return false;
    return true;
  }
  function pintarEn(x, y) {
    const tr = trazo,
      x0 = x - radio,
      y0 = y - radio,
      x1 = x + radio,
      y1 = y + radio;
    if (tr.modo === "abrir") {
      E.cosasEn(x0, y0, x1, y1).forEach((o) => {
        if (o.historia || !(o.natural || o.id === "tocon")) return;
        if (Math.hypot(o.x - x, o.y - y) > radio) return;
        const k = o.u || o.id + "@" + o.x + "," + o.y;
        if (!tr.quitar.has(k)) tr.quitar.set(k, o.u ? { u: o.u, x: o.x, y: o.y } : { id: o.id, x: o.x, y: o.y });
      });
      // lo puesto en este mismo trazo y que cae adentro, también se va
      tr.poner = tr.poner.filter((a) => Math.hypot(a.x - x, a.y - y) > radio || a.borde);
      return;
    }
    // textura: un parche de la textura elegida por cada toque, del tamaño del pincel (los toques se pisan y se juntan)
    if (tr.modo === "textura") {
      const id = E.elegido();
      if (!id || !/^tx_/.test(id)) return;
      tr.poner.push({ id, x: Math.round(x), y: Math.round(y), o: { rx: Math.round(radio * 0.95), ry: Math.round(radio * 0.5), sem: Math.floor(Math.random() * 999) } });
      return;
    }
    // rociar: tantos intentos como pida la densidad por el área del círculo
    const elegido = E.elegido(),
      mezcla = modo() === "elegido" && elegido ? [[elegido, 1]] : MEZCLAS[modo()] || MEZCLAS.bosque,
      area = Math.PI * radio * radio,
      n = Math.max(1, Math.round((area / 90000) * densidad())),
      cerca = E.cosasEn(x0 - 60, y0 - 60, x1 + 60, y1 + 60)
        .map((o) => Object.assign(o, { cuenta: true }))
        .concat(tr.poner.map((a) => ({ id: a.id, x: a.x, y: a.y, cuenta: true })));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2,
        d = Math.sqrt(Math.random()) * radio,
        px = Math.round(x + Math.cos(a) * d),
        py = Math.round(y + Math.sin(a) * d),
        id = azar(mezcla);
      if (!ASSETS.LISTA[id] || !libre(px, py, id, cerca)) continue;
      const o = { sem: Math.floor(Math.random() * 12), esc: Math.round((0.82 + Math.random() * 0.36) * 100) / 100 };
      o.v = o.sem;
      if (Math.random() < 0.5) o.esp = true;
      Object.keys(ASSETS.EJEMPLO[id] || {}).forEach((k) => k !== "x2" && k !== "y2" && o[k] === undefined && (o[k] = ASSETS.EJEMPLO[id][k]));
      const nuevo = { id, x: px, y: py, o };
      tr.poner.push(nuevo);
      cerca.push({ id, x: px, y: py, cuenta: true });
    }
  }
  // al terminar de abrir: la orilla del claro con tocones y árboles caídos, donde había árboles
  function bordes() {
    const tr = trazo,
      q = [...tr.quitar.values()].filter((o) => o.id && /pino|roble|abedul|abeto/i.test(o.id));
    if (!q.length) return;
    // un punto del trazo está «adentro» si cae en algún círculo pintado; la orilla es lo sacado cerca del borde
    const pasos = tr.pasos;
    q.forEach((o) => {
      const dmin = Math.min(...pasos.map(([px, py]) => Math.hypot(o.x - px, o.y - py)));
      if (dmin < radio * 0.72 || Math.random() > 0.55) return;
      const id = azar(BORDES);
      tr.poner.push({ id, x: o.x, y: o.y, o: { sem: Math.floor(Math.random() * 12), v: Math.floor(Math.random() * 12), esp: Math.random() < 0.5 }, borde: true });
    });
  }
  function clic(x, y, e) {
    if (E.herr() !== "pincel" || e.button !== 0) return false;
    if (modo() === "textura" && !/^tx_/.test(E.elegido() || "")) return E.avisar(t("ed.pincel_sin_textura")), true;
    trazo = { modo: modo() === "abrir" ? "abrir" : modo() === "textura" ? "textura" : "rociar", poner: [], quitar: new Map(), ultimo: [x, y], pasos: [[x, y]] };
    pintarEn(x, y);
    E.pedir();
    return true;
  }
  function mover(x, y) {
    if (!trazo) return E.herr() === "pincel" && E.pedir(), false;
    const [ux, uy] = trazo.ultimo;
    // un nuevo toque cada medio radio, así un trazo rápido no deja huecos
    if (Math.hypot(x - ux, y - uy) >= radio * 0.5) {
      trazo.ultimo = [x, y];
      trazo.pasos.push([x, y]);
      pintarEn(x, y);
    }
    E.pedir();
    return true;
  }
  function soltar() {
    if (!trazo) return false;
    if (trazo.modo === "abrir" && $("pincelBordes").checked) bordes();
    const ops = { poner: trazo.poner.map((a) => ({ id: a.id, x: a.x, y: a.y, o: a.o })), quitar: [...trazo.quitar.values()] };
    trazo = null;
    if (ops.poner.length || ops.quitar.length) {
      E.aplicar(ops, { sinElegir: true });
      E.avisar(t("ed.pincel_hecho", [ops.poner.length, ops.quitar.length]));
    }
    E.pedir();
    return true;
  }
  function tecla(e) {
    if (e.ctrlKey || e.metaKey) return false;
    if (e.key === "b" || e.key === "B") return E.ponerHerr(E.herr() === "pincel" ? "mover" : "pincel"), true;
    if (E.herr() !== "pincel") return false;
    // Esc a mitad de un trazo lo deja sin aplicar
    if (e.key === "Escape" && trazo) return (trazo = null), E.pedir(), true;
    // Shift+[ y ] es { y } en la mayoría de los teclados, pero no en todos
    const mas = e.key === "]" || e.key === "}";
    if (e.key === "{" || e.key === "}" || ((e.key === "[" || e.key === "]") && e.shiftKey)) $("pincelDensidad").value = +$("pincelDensidad").value + (mas ? 1 : -1);
    else if (e.key === "[" || e.key === "]") radio = Math.max(60, Math.min(2400, Math.round(radio * (mas ? 1.2 : 1 / 1.2))));
    else return false;
    pintarPanel();
    E.pedir();
    return true;
  }
  function pintarPanel() {
    $("pincelRadio").value = radio;
    $("pincelRadioV").textContent = Math.round(radio / 30) + " m";
    $("pincelDensidadV").textContent = $("pincelDensidad").value;
    $("pincelFilaDensidad").classList.toggle("oculto", modo() === "abrir" || modo() === "textura");
    $("pincelFilaBordes").classList.toggle("oculto", modo() !== "abrir");
  }
  $("pincelRadio").addEventListener("input", () => ((radio = +$("pincelRadio").value), pintarPanel()));
  $("pincelDensidad").addEventListener("input", pintarPanel);
  $("pincelModo").addEventListener("change", pintarPanel);
  $("hPincel").onclick = () => E.ponerHerr("pincel");
  pintarPanel();

  // el círculo del pincel y lo que el trazo va a poner o sacar
  function dibujar(c, cam, V, cursor, tt) {
    if (E.herr() !== "pincel") return;
    c.save();
    if (trazo) {
      c.fillStyle = "rgba(200,64,45,0.85)";
      trazo.quitar.forEach((o) => {
        const [px, py] = V(o.x, o.y);
        c.beginPath();
        c.arc(px, py, 7 / cam.z, 0, Math.PI * 2);
        c.fill();
      });
      E.fantasmas(c, trazo.poner, tt, 0.8);
    }
    if (cursor) {
      const [px, py] = V(cursor.x, cursor.y);
      c.beginPath();
      c.ellipse(px, py, radio, radio, 0, 0, Math.PI * 2);
      c.strokeStyle = modo() === "abrir" ? "#C8402D" : "#7BC86C";
      c.lineWidth = 2.5 / cam.z;
      c.setLineDash([10 / cam.z, 6 / cam.z]);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = modo() === "abrir" ? "rgba(200,64,45,0.08)" : "rgba(123,200,108,0.08)";
      c.fill();
    }
    c.restore();
  }
  return { clic, mover, soltar, tecla, dibujar, radio: () => radio };
})();
