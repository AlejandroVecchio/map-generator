// ---------- el editor de Eldervald ----------
// Una página para que Alejandro ayude a armar el mapa sin Tiled: se ve el mundo como en el juego (el croquis de
// lejos, el piso y los objetos de cerca), se eligen objetos de la lista de assets y se ponen, se mueven o se sacan.
// Lo hecho queda guardado en este navegador y se descarga como js/mundo/agregados.js, que el mundo aplica al armarse
// (eldervald.js). ?borrador=1 en el juego usa lo de este navegador sin descargar nada.
(function () {
  "use strict";
  const W = ELDERVALD;
  const t = (k, v) => I18N.t(k, v);
  const params = new URLSearchParams(location.search);
  if (params.get("lang")) I18N.setLang(params.get("lang"));
  const $ = (id) => document.getElementById(id);
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
  document.querySelectorAll("[data-i18n-label]").forEach((el) => (el.label = t(el.dataset.i18nLabel)));
  $("buscar").placeholder = t("ed.buscar");
  const CLAVE = "eromash-aventura-editor";

  // ---------- estado ----------
  let est = { poner: [], quitar: [], mover: [], quitarDeco: [], caminos: [], quitarCaminos: [], estiloCaminos: [], rios: [], lagos: [], quitarRios: [], quitarLagos: [], estiloRios: [], estiloLagos: [], notas: [] };
  try {
    const b = JSON.parse(localStorage.getItem(CLAVE) || "null");
    if (b && b.poner) est = b;
    else if (window.AGREGADOS) est = JSON.parse(JSON.stringify(window.AGREGADOS));
  } catch (e) {
    if (window.AGREGADOS) est = JSON.parse(JSON.stringify(window.AGREGADOS));
  }
  if (!est.notas) est.notas = [];
  if (!est.caminos) est.caminos = [];
  if (!est.quitarCaminos) est.quitarCaminos = [];
  if (!est.estiloCaminos) est.estiloCaminos = [];
  if (!est.mover) est.mover = [];
  if (!est.quitarDeco) est.quitarDeco = [];
  const completar = (e) => {
    ["rios", "lagos", "quitarRios", "quitarLagos", "estiloRios", "estiloLagos"].forEach((k) => !e[k] && (e[k] = []));
    if (!e.cuartos || typeof e.cuartos !== "object") e.cuartos = {};
    if (!Array.isArray(e.regiones)) e.regiones = [];
    if (!e.piezas || typeof e.piezas !== "object") e.piezas = {};
    if (!e.texturas || typeof e.texturas !== "object") e.texturas = {};
    if (!e.casas || typeof e.casas !== "object") e.casas = {};
    if (!e.zonas || typeof e.zonas !== "object") e.zonas = {};
    if (!Array.isArray(e.npcs)) e.npcs = [];
    if (!e.imagenes || typeof e.imagenes !== "object") e.imagenes = {};
    if (!Array.isArray(e.capas)) e.capas = [];
    if (!e.capaSuelta || typeof e.capaSuelta !== "object") e.capaSuelta = { ver: true, lock: false };
  };
  completar(est);
  // ---------- capas propias ----------
  // Como en Photoshop: est.capas = [{ id, nom, ver, lock }] y lo agregado (poner, caminos, ríos, lagunas) lleva .capa;
  // lo que no tiene va a «Sueltos» (est.capaSuelta). Lo nuevo y lo pegado cae en la capa activa (est.capaActiva).
  // Apagada no se dibuja en el editor; trabada no se elige. El juego las dibuja todas.
  const capaPorId = (id) => (id && est.capas.find((c) => c.id === id)) || est.capaSuelta;
  const capaVe = (a) => capaPorId(a && a.capa).ver !== false;
  const capaTraba = (a) => !!capaPorId(a && a.capa).lock;
  function enCapa(a, id) {
    const c = id !== undefined ? id : est.capaActiva;
    if (c && est.capas.some((k) => k.id === c)) a.capa = c;
    else delete a.capa;
    return a;
  }
  // las texturas hechas acá son assets: se suman a la lista antes de armarla
  let firmaTex = "";
  const cargarTexturas = () => {
    if (!window.TEXTURAS) return false;
    TEXTURAS.cargar(est.texturas);
    const f = Object.keys(est.texturas).map((k) => k + ":" + (est.texturas[k].uso || "") + ":" + ((est.texturas[k].nombre || {}).es || "")).join();
    if (f === firmaTex) return false;
    firmaTex = f;
    return true;
  };
  cargarTexturas();
  // lo mismo con las imágenes importadas (estructuras, pinturas, calcos): cada una es el asset im_<id>
  let firmaImg = "";
  const cargarImagenes = () => {
    if (!window.IMAGENES) return false;
    IMAGENES.cargar(est.imagenes);
    const f = Object.keys(est.imagenes).map((k) => k + ":" + (est.imagenes[k].clase || "") + ":" + ((est.imagenes[k].nombre || {}).es || "") + ":" + (est.imagenes[k].src || "").length).join();
    if (f === firmaImg) return false;
    firmaImg = f;
    return true;
  };
  cargarImagenes();
  const historial = [],
    rehechos = []; // lo deshecho, para rehacerlo (Ctrl+Shift+Z o Ctrl+Y)
  const recordar = () => {
    historial.push(JSON.stringify(est));
    if (historial.length > 200) historial.shift();
    rehechos.length = 0;
  };
  const guardar = () => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(est));
    } catch (e) {}
    if (!est.notas) est.notas = [];
    if (!est.caminos) est.caminos = [];
    if (!est.quitarCaminos) est.quitarCaminos = [];
    if (!est.estiloCaminos) est.estiloCaminos = [];
    if (!est.mover) est.mover = [];
    if (!est.quitarDeco) est.quitarDeco = [];
    completar(est);
    armarMovidos();
    aplicarDeco();
    aplicarCaminos();
    aplicarAgua();
    $("cuenta").textContent = t("ed.cuenta", [est.poner.length, est.quitar.length]) + " · " + t("ed.cuenta_mas", [est.mover.length, est.caminos.length, est.notas.length]) + " · " + t("ed.cuenta_agua", [est.rios.length + est.lagos.length]);
    const h = new Date();
    $("guardadoV").textContent = t("ed.guardado_a", [String(h.getHours()).padStart(2, "0") + ":" + String(h.getMinutes()).padStart(2, "0"), historial.length]);
    armarIr();
    pintarPendiente();
    if (window.EDITOR_PLANO) EDITOR_PLANO();
    if (cargarTexturas() | cargarImagenes()) armarLista();
    if (window.EDITOR_TEXTURAS) EDITOR_TEXTURAS.pintarLista();
    if (window.EDITOR_MUNDO) EDITOR_MUNDO.pintarPiezas();
    if (window.EDITOR_CAPAS) EDITOR_CAPAS.pintar();
  };
  // «Descargar» se resalta mientras haya cambios que todavía no se bajaron
  let bajado = null;
  try {
    bajado = localStorage.getItem(CLAVE + "-bajado");
  } catch (e) {}
  const huella = () => {
    const s = JSON.stringify(est);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return String(h);
  };
  function pintarPendiente() {
    const b = document.getElementById("bDescargar");
    if (b) b.classList.toggle("pendiente", huella() !== bajado);
  }
  const r1 = (v) => Math.round(v);

  // ---------- lo que sigue: atajos según lo que se está haciendo y lo que se suele hacer después ----------
  // Abajo del mapa aparecen los pasos que tienen sentido ahora (con su tecla; también se tocan). El orden aprende en
  // este navegador: cuenta qué acción vino después de cuál (o de qué situación) y pone primero lo que más sigue.
  let uso = {},
    ultAccion = "",
    usoT = 0;
  try {
    uso = JSON.parse(localStorage.getItem(CLAVE + "-uso") || "{}") || {};
  } catch (e) {}
  function usar(id) {
    if (ultAccion && ultAccion !== id) {
      const m = (uso[ultAccion] = uso[ultAccion] || {});
      m[id] = Math.min(999, (m[id] || 0) + 1);
      clearTimeout(usoT);
      usoT = setTimeout(() => {
        try {
          localStorage.setItem(CLAVE + "-uso", JSON.stringify(uso));
        } catch (e) {}
      }, 800);
    }
    ultAccion = id;
  }
  // id: [texto, tecla, qué hace (null: solo se muestra la tecla)]
  const PASOS = {
    poner: ["ed.poner", "1", () => ponerHerr("poner")],
    mover: ["ed.sig_mover", "2", () => ponerHerr("mover")],
    deshacer: ["ed.deshacer", "Ctrl+Z", () => deshacer()],
    duplicar: ["ed.sel_duplicar", "Ctrl+D", () => duplicar()],
    copiar: ["ed.com_copiar", "Ctrl+C", () => copiar()],
    pegar: ["ed.com_pegar", "Ctrl+V", () => pegarAca()],
    sacar: ["ed.sel_sacar", "Supr", () => sacarElegidos()],
    iguales: ["ed.sel_iguales", "", () => elegirIguales()],
    pieza: ["ed.pieza_guardar", "", () => $("bPieza").click()],
    ia: ["ed.sig_ia", "8", () => window.EDITOR_IA && EDITOR_IA.abrir()],
    boceto: ["ed.bo_titulo", "U", () => window.EDITOR_BOCETO && EDITOR_BOCETO.abrir()],
    interior: ["ed.sel_interior", "9", () => $("selInterior").click()],
    girar: ["ed.sig_girar", "Q · E", null],
    vuelta: ["ed.sig_vuelta", "F", () => darVuelta()],
    soltar: ["ed.sel_soltar", "Esc", () => soltarTodo()],
    terminar: ["ed.sig_terminar", "Enter", () => (rio ? terminarRio() : camino && terminarCamino())],
    cerrarReg: ["ed.sig_cerrar_reg", "Enter", null],
    atras: ["ed.sig_atras", "⌫", null],
    otra: ["ed.sig_otra", "Shift+clic", null],
    tam: ["ed.sig_tam", "[ · ]", null],
    densidad: ["ed.sig_densidad", "{ · }", null],
    variar: ["ed.sig_variar", "V", () => alternarVariar()],
    probar: ["ed.probar", "P", () => $("bProbar").click()],
    descargar: ["ed.sig_descargar", "Ctrl+S", () => $("bDescargar").click()],
  };
  // la situación de ahora y los pasos que le van, en su orden de base
  function situacion() {
    const M = window.EDITOR_MUNDO,
      pend = document.getElementById("bDescargar").classList.contains("pendiente") ? "descargar" : null,
      pg = copia && copia.length ? "pegar" : null;
    if (M && M.pieza()) return ["pieza", ["otra", "soltar"]];
    if (M && M.trazando()) return ["region", ["cerrarReg", "atras", "soltar"]];
    if (camino || rio) return ["trazo", ["terminar", "atras", "soltar"]];
    if (herr === "pincel") return ["pincel", ["tam", $("pincelModo").value === "abrir" ? null : "densidad", "deshacer", "mover"]];
    if (grupo.length > 1) return ["grupo", ["copiar", "duplicar", "pieza", "ia", "sacar", "soltar"]];
    if (elegida) return ["uno", ["duplicar", $("selInterior").classList.contains("oculto") ? null : "interior", "girar", "vuelta", "iguales", "copiar", "sacar"]];
    if (herr === "poner" && elegido) return ["poner", ["variar", "mover", "deshacer", pg]];
    return ["libre_" + herr, [pg, herr === "poner" ? "mover" : "poner", "deshacer", "probar", pend]];
  }
  let sitPrevia = "",
    sigFirma = "";
  function pintarSiguiente() {
    const [sit, l] = situacion();
    if (sit !== sitPrevia) (sitPrevia = sit), usar("s_" + sit);
    const cuenta = uso[ultAccion] || {},
      ids = l
        .filter(Boolean)
        .map((id, i) => [id, i])
        .sort((a, b) => (cuenta[b[0]] || 0) - (cuenta[a[0]] || 0) || a[1] - b[1])
        .slice(0, 5)
        .map((q) => q[0]),
      firma = sit + ids.join() + I18N.lang + grupo.length;
    if (firma === sigFirma) return;
    sigFirma = firma;
    const caja = $("siguiente");
    caja.innerHTML = "";
    const tit = t("ed.sig_s_" + sit, [grupo.length]);
    if (tit !== "ed.sig_s_" + sit) {
      const b = document.createElement("b");
      b.textContent = tit;
      caja.appendChild(b);
    }
    ids.forEach((id, i) => {
      const [k, tecla, hacer] = PASOS[id],
        el = document.createElement(hacer ? "button" : "span");
      el.className = "paso" + (i === 0 ? " primero" : "");
      el.textContent = t(k);
      if (tecla) {
        const kb = document.createElement("kbd");
        kb.textContent = tecla;
        el.appendChild(kb);
      }
      if (hacer) el.onclick = () => (usar(id), hacer(), cv.focus());
      caja.appendChild(el);
    });
  }
  // lo de ahora para la paleta de comandos (lo que se toca, en el mismo orden)
  function sugeridos() {
    pintarSiguiente();
    const [, l] = situacion(),
      cuenta = uso[ultAccion] || {};
    return l
      .filter((id) => id && PASOS[id][2])
      .map((id, i) => [id, i])
      .sort((a, b) => (cuenta[b[0]] || 0) - (cuenta[a[0]] || 0) || a[1] - b[1])
      .map(([id]) => ({ nom: t(PASOS[id][0]), tecla: PASOS[id][1], hacer: () => (usar(id), PASOS[id][2]()) }));
  }

  // ---------- el lienzo y la cámara ----------
  const cv = $("mapa"),
    c = cv.getContext("2d");
  let cw = 0,
    ch = 0,
    dpr = 1;
  const cam = { x: W.CIUDAD.c[0], y: W.CIUDAD.c[1], z: 0.12, g: 0 };
  let giroMeta = 0; // a dónde va girando la cámara (Z y X, la barra Cámara o el botón Norte)
  function medir() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = cv.getBoundingClientRect();
    cw = cv.width = Math.round(r.width * dpr);
    ch = cv.height = Math.round(r.height * dpr);
  }
  addEventListener("resize", medir);
  medir();
  // la cámara gira (cam.g, en radianes) alrededor del centro de la vista: el piso gira con ella y los objetos quedan
// parados. V lleva un punto del mundo a la vista girada; aMundo, del puntero al mundo.
  // (el giro es el del piso en perspectiva, VOL.girar: lo mismo que haría la cámara del juego)
  const V = (x, y) => VOL.vista(x, y, cam.x, cam.y, cam.g);
  const desdeVista = (vx, vy) => VOL.mundo(vx, vy, cam.x, cam.y, cam.g);
  // un desplazamiento de la pantalla, pasado al mundo (para mover la vista)
  const giroInverso = (dx, dy) => VOL.desgirar(dx, dy, cam.g);
  const aMundo = (sx, sy) => desdeVista((sx * dpr - cw / 2) / cam.z + cam.x, (sy * dpr - ch / 2) / cam.z + cam.y);
  // lo que se dibuja parado, pasado a la vista: su pie (y las dos puntas de lo que va de punta a punta) giran con el
  // piso; lo que tiene todas sus caras (ASSETS.LISTA[id].caras) además se ve desde el lado que mira la cámara
  function enVista(d) {
    if (!cam.g) return d;
    const [x, y] = V(d.x, d.y),
      o = Object.assign({}, d.o);
    const def = ASSETS.LISTA[d.id];
    // lo armado con caras gira solo su otra punta (VOL.prSeg): le llega relativa al pie, sin girar
    if (o.x2 !== undefined) [o.x2, o.y2] = def && def.vol ? [x + o.x2 - d.x, y + o.y2 - d.y] : V(o.x2, o.y2);
    // lo que apunta a un punto del mundo (o.hacia: las cadenas de las ataduras) igual: relativo al pie
    if (o.hacia && def && def.vol) o.hacia = [x + o.hacia[0] - d.x, y + o.hacia[1] - d.y];
    // lo armado con caras (vol) mira solo la cámara (VOL.cam.g); lo que tiene todas sus caras a mano (caras) se gira
    // con o.giro; lo redondo o plano de frente (figura) y lo del piso quedan como están (ASSETS.sinGiro: la norma)
    if (def && def.caras && !def.vol) o.giro = (o.giro || 0) + (cam.g * 180) / Math.PI;
    return Object.assign({}, d, { x, y, o, mundo: d });
  }
  const croquis = new Image();
  if (!est.lienzo) croquis.src = "mapas/eldervald-croquis.png"; // un mapa de cero no tiene el de Eldervald

  // ---------- lo que se ve: el mundo con lo agregado y sin lo sacado ----------
  const sacado = (o) => est.quitar.some((q) => q.id === o.id && Math.abs(o.x - q.x) < 6 && Math.abs(o.y - q.y) < 6);
  // lo de la historia: tiene que estar (no se saca), pero se puede mover
  const nombradas = new Map(); // cosa → nombre en el juego
  Object.keys(W.NOMBRADAS).forEach((k) => {
    const v = W.NOMBRADAS[k];
    (Array.isArray(v) ? v : [v]).forEach((x) => x && x.id && !nombradas.has(x) && nombradas.set(x, k.replace(/\d+$/, "")));
  });
  // lo pintado en el piso (charcos de barro, musgo, helechos, hongos): se saca con Sacar (est.quitarDeco)
  const DECO0 = W.DECO.slice(),
    DECO_SACABLE = { barro: 1, alfombraMusgo: 1, helechos: 1, hongosRocio: 1 };
  let decoSacada = new Set();
  const claveDeco = (d) => d.id + "@" + Math.round(d.x) + "," + Math.round(d.y);
  function aplicarDeco() {
    const nueva = new Set(est.quitarDeco.map(claveDeco));
    // lo que quedó bajo el agua nueva tampoco se pinta (en el juego se saca)
    if (est.rios.length || est.lagos.length) DECO0.forEach((d) => enAguaNueva(d.x, d.y) && nueva.add(claveDeco(d)));
    const cambian = DECO0.filter((d) => nueva.has(claveDeco(d)) !== decoSacada.has(claveDeco(d)));
    decoSacada = nueva;
    if (!cambian.length) return;
    W.DECO.length = 0;
    DECO0.forEach((d) => !decoSacada.has(claveDeco(d)) && W.DECO.push(d));
    cambian.forEach((d) => W.invalidar(d.x, d.y));
  }
  // con Sacar: lo del piso gana si el puntero está sobre el charco y no al pie de un objeto (un tronco que lo tapa)
  function tocadoSacar(x, y) {
    const d = tocado(x, y),
      dd = cam.z >= 0.15 ? decoEn(x, y) : null;
    if (!dd) return d;
    if (d) {
      const ancho = d.choque ? (d.choque.w ? d.choque.w / 2 : d.choque.r) + 20 : 30,
        [vx, vy] = V(x, y),
        [dx, dy] = V(d.x, d.y);
      if (Math.abs(vx - dx) < ancho && Math.abs(vy - dy) < 40) return d;
    }
    return { deco: dd };
  }
  function decoEn(x, y) {
    let mejor = null,
      dm = 1;
    W.DECO.forEach((d) => {
      if (!DECO_SACABLE[d.id]) return;
      const rx = d.id === "barro" || d.id === "alfombraMusgo" ? 66 * (d.s || 1) : 36,
        ry = rx * 0.5;
      if (Math.abs(x - d.x) > rx || Math.abs(y - d.y) > ry) return;
      const q = Math.hypot((x - d.x) / rx, (y - d.y) / ry);
      if (q < dm) {
        dm = q;
        mejor = d;
      }
    });
    return mejor;
  }
  // lo del mundo que se movió (est.mover: { id, x, y } donde estaba → { nx, ny }), para dibujarlo en su lugar nuevo
  let movidos = new Map(); // cosa → índice en est.mover
  function armarMovidos() {
    movidos = new Map();
    est.mover.forEach((m, i) => {
      const cosa = W.COSAS.find((o) => o.id === m.id && Math.abs(o.x - m.x) < 6 && Math.abs(o.y - m.y) < 6);
      if (cosa) movidos.set(cosa, i);
    });
    // lo pintado en el piso (canal, puentes, tablones, losas) que se movió o se sacó deja de pintarse donde estaba
    PISO0.forEach((o) => {
      const oculto = movidos.has(o) || sacado(o);
      if (!!o.oculto === oculto) return;
      o.oculto = oculto;
      W.invalidar(o.x, o.y);
      if (o.o.x2 !== undefined) W.invalidar(o.o.x2, o.o.y2);
    });
  }
  const PISO0 = W.COSAS.filter((o) => o.o.piso);
  function opcionesDe(a) {
    const o = Object.assign({}, a.o || {});
    const k = W.ESCALA_CASA[a.id];
    if (k) o.s = (o.s || 1) * k;
    return o;
  }
  // capas: el bosque se puede ocultar y lo del mundo bloquear (solo se toca lo agregado); las notas, ocultar
  const esNatural = (id) => ((ASSETS.LISTA[id] || {}).grupo === "naturaleza");
  const sinBosque = () => !$("verBosque").checked;
  // lo que no se puede elegir: el mundo de base con «Trabar lo de base» y lo de una capa trabada
  const trabado = (d) => (d.agregado == null ? $("bloquear").checked : capaTraba(est.poner[d.agregado]));
  function visibles(x0, y0, x1, y1) {
    const l = visibles0(x0, y0, x1, y1);
    if (!sinBosque()) return l;
    return l.filter((d) => !(d.agregado == null && d.movido == null && esNatural(d.id) && !(d.cosa && nombradas.has(d.cosa))));
  }
  function visibles0(x0, y0, x1, y1) {
    const l = [];
    W.cercanas(x0 - 300, y0 - 100, x1 + 300, y1 + 600, (o) => {
      if (movidos.has(o) || o.x < x0 - 320 || o.x > x1 + 320 || o.y < y0 - 40 || o.y - o.alto * 1.2 > y1 || sacado(o) || ahogado(o)) return;
      l.push({ id: o.id, x: o.x, y: o.y, o: o.o, alto: o.alto, choque: o.choque, cosa: o, piso: !!o.o.piso });
    });
    // lo de base pintado en el piso no está en la grilla de cercanas: se busca aparte (enPiso: ya lo pinta el piso)
    PISO0.forEach((o) => {
      const x2 = o.o.x2 !== undefined ? o.o.x2 : o.x,
        y2 = o.o.y2 !== undefined ? o.o.y2 : o.y;
      if (movidos.has(o) || sacado(o) || Math.max(o.x, x2) < x0 - 300 || Math.min(o.x, x2) > x1 + 300 || Math.max(o.y, y2) < y0 - 300 || Math.min(o.y, y2) > y1 + 300) return;
      l.push({ id: o.id, x: o.x, y: o.y, o: o.o, alto: o.alto, choque: o.choque, cosa: o, piso: true, enPiso: true });
    });
    movidos.forEach((i, o) => {
      const m = est.mover[i];
      if (!m || m.nx < x0 - 400 || m.nx > x1 + 400 || m.ny < y0 - 60 || m.ny > y1 + 900) return;
      const op = Object.assign({}, o.o, m.o || {});
      if (op.x2 !== undefined && !(m.o && m.o.x2 !== undefined)) (op.x2 += m.nx - o.x), (op.y2 += m.ny - o.y);
      const md = m.o ? ASSETS.medidas(o.id, op) : o;
      l.push({ id: o.id, x: m.nx, y: m.ny, o: op, alto: md.alto, choque: md.choque, cosa: o, movido: i, piso: !!o.o.piso });
    });
    est.poner.forEach((a, i) => {
      const def = ASSETS.LISTA[a.id];
      if (!def || !capaVe(a) || a.x < x0 - 400 || a.x > x1 + 400 || a.y < y0 - 60 || a.y > y1 + 900) return;
      const o = opcionesDe(a),
        md = ASSETS.medidas(a.id, o);
      l.push({ id: a.id, x: a.x, y: a.y, o, alto: md.alto, choque: md.choque, agregado: i, piso: !!def.piso });
    });
    return l;
  }
  // ---------- de lejos, liviano ----------
  // Orden de importancia: 0 lo de la historia, lo agregado o movido y las estructuras; 1 lo demás que choca; 2 los
  // árboles; 3 lo chico de adorno. Según el zoom:
  //   cerca (≥ 0.7): todo como es
  //   medio (0.5–0.7): sin lo chico (3)
  //   de 0.5 para abajo: el mundo de base queda horneado en baldosas (piso + objetos, tres niveles de detalle) y
  //   encima solo se dibuja en vivo lo cambiado en el editor
  const LIVIANO = 0.7,
    HORNO = 0.5;
  const chico = (d) => !d.choque && d.alto < 90 && d.agregado == null && d.movido == null && !(d.cosa && nombradas.has(d.cosa));
  // baldosas horneadas: dos niveles (lejos y muy lejos). La firma de cada una son los cambios del editor que caen
  // adentro; si cambia, se vuelve a hornear.
  const NIVELES = [
    { T: 1024, res: 0.55, m: new Map() },
    { T: 2048, res: 0.26, m: new Map() },
    { T: 4096, res: 0.12, m: new Map() },
    { T: 8192, res: 0.05, m: new Map() },
  ];
  function firma(x0, y0, x1, y1) {
    const den = (x, y) => x > x0 - 500 && x < x1 + 500 && y > y0 - 300 && y < y1 + 1200;
    return firmaCaminos(x0, y0, x1, y1) + "|" + firmaAgua(x0, y0, x1, y1) + "|" + est.quitar.concat(est.quitarDeco).filter((q) => den(q.x, q.y)).map((q) => q.id + q.x + "," + q.y).join(";") + "|" + est.mover.filter((m) => den(m.x, m.y)).map((m) => m.id + m.x + "," + m.y).join(";");
  }
  function hornear(nv, tx, ty, soloPiso) {
    const x0 = tx * nv.T,
      y0 = ty * nv.T,
      x1 = x0 + nv.T,
      y1 = y0 + nv.T;
    const cvb = document.createElement("canvas");
    cvb.width = cvb.height = Math.ceil(nv.T * nv.res);
    const g = cvb.getContext("2d");
    g.scale(nv.res, nv.res);
    g.translate(-x0, -y0);
    W.dibujarPiso(g, x0, y0, x1, y1, 0.2, true);
    if (soloPiso) return { cv: cvb, firma: firma(x0, y0, x1, y1) };
    const l = [];
    W.cercanas(x0 - 400, y0 - 200, x1 + 400, y1 + 1200, (o) => {
      if (movidos.has(o) || sacado(o) || ahogado(o) || o.y < y0 - 60 || o.y - o.alto * 1.2 > y1 || o.x < x0 - 500 || o.x > x1 + 500) return;
      if (nv.res < 0.08 && !o.choque && o.alto < 90) return; // muy lejos lo chico ni se ve
      if (sinBosque() && esNatural(o.id) && !nombradas.has(o)) return;
      l.push(o);
    });
    l.filter((o) => o.o.piso).forEach((o) => ASSETS.dibujar(g, o.id, o.x, o.y, 0, o.o));
    l.filter((o) => !o.o.piso).sort((a, b) => a.y + (a.o.orden || 0) - b.y - (b.o.orden || 0)).forEach((o) => ASSETS.dibujar(g, o.id, o.x, o.y, 0, o.o));
    return { cv: cvb, firma: firma(x0, y0, x1, y1) };
  }
  // dibuja las baldosas del nivel que tocan la vista; hornea a lo sumo una que falte o haya cambiado por cuadro.
  // Devuelve si quedó alguna sin hornear.
  function baldosas(nv, x0, y0, x1, y1, soloPiso) {
    let horneada = false,
      falta = false;
    const tx0 = Math.max(0, Math.floor(x0 / nv.T)),
      tx1 = Math.min(Math.ceil(W.ANCHO / nv.T) - 1, Math.floor(x1 / nv.T)),
      ty0 = Math.max(0, Math.floor(y0 / nv.T)),
      ty1 = Math.min(Math.ceil(W.ALTO / nv.T) - 1, Math.floor(y1 / nv.T));
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const k = tx + "," + ty + (soloPiso ? "p" + Math.round(cam.g * 100) : "") + (sinBosque() ? "b" : "");
        let b = nv.m.get(k);
        const vieja = b && b.firma !== firma(tx * nv.T, ty * nv.T, (tx + 1) * nv.T, (ty + 1) * nv.T);
        if ((!b || vieja) && !horneada) {
          b = hornear(nv, tx, ty, soloPiso);
          nv.m.delete(k);
          nv.m.set(k, b);
          if (nv.m.size > 64) nv.m.delete(nv.m.keys().next().value); // las que hace más que no se ven
          horneada = true;
        } else if (!b || vieja) falta = true;
        if (b) c.drawImage(b.cv, tx * nv.T, ty * nv.T, nv.T + 1, nv.T + 1);
        else if (croquis.complete && croquis.naturalWidth) {
          const sx = croquis.naturalWidth / W.ANCHO;
          c.drawImage(croquis, tx * nv.T * sx, ty * nv.T * sx, nv.T * sx, nv.T * sx, tx * nv.T, ty * nv.T, nv.T, nv.T);
        }
      }
    return falta;
  }
  // solo se redibuja cuando algo cambia (o cada tanto, por lo que se anima)
  let sucio = true,
    ultimo = 0,
    faltan = false;
  const pedir = () => (sucio = true);
  ["pointermove", "pointerdown", "pointerup", "wheel", "keydown", "keyup", "input", "change", "click", "resize"].forEach((ev) => addEventListener(ev, pedir, { capture: true, passive: true }));

  let tPrev = performance.now(),
    tt = 0;
  // la cámara del editor es la de los volúmenes mientras se dibuja el mapa (las miniaturas de la lista van de frente)
  function dibujar() {
    VOL.cam.g = cam.g;
    try {
      dibujarMapa();
    } finally {
      VOL.cam.g = 0;
    }
  }
  function dibujarMapa() {
    const ahoraT = performance.now(),
      moviendo = Object.keys(teclas).some((k) => teclas[k]);
    if (!sucio && !faltan && !moviendo && ahoraT - ultimo < (cam.z >= LIVIANO ? 120 : 1000)) return requestAnimationFrame(dibujar);
    sucio = false;
    ultimo = ahoraT;
    const ahora = performance.now();
    tt += Math.min(0.1, (ahora - tPrev) / 1000);
    tPrev = ahora;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#1E2C1B";
    c.fillRect(0, 0, cw, ch);
    const vw = cw / cam.z,
      vh = ch / cam.z,
      xv0 = cam.x - vw / 2,
      yv0 = cam.y - vh / 2,
      rr = Math.hypot(vw, vh / VOL.K) / 2,
      // con la cámara girada, lo que se ve del mundo es el círculo que toca las cuatro esquinas
      x0 = cam.g ? cam.x - rr : xv0,
      y0 = cam.g ? cam.y - rr : yv0,
      x1 = cam.g ? cam.x + rr : xv0 + vw,
      y1 = cam.g ? cam.y + rr : yv0 + vh;
    // dos maneras de dibujar: vistaT para lo que está parado (ya pasado por V) y pisoT para lo que va en el piso
    const vistaT = () => c.setTransform(cam.z, 0, 0, cam.z, -xv0 * cam.z, -yv0 * cam.z);
    const pisoT = () => {
      vistaT();
      if (!cam.g) return;
      VOL.piso(c, cam.x, cam.y, cam.g);
    };
    pisoT();
    const lejos = cam.z < 0.07,
      horno = cam.z < HORNO,
      // girada y no tan lejos: las baldosas llevan solo el piso y los objetos se dibujan parados encima
      soloPiso = horno && cam.g && cam.z >= 0.25;
    if (horno) faltan = baldosas(NIVELES[lejos ? 3 : cam.z < 0.16 ? 2 : cam.z < 0.3 ? 1 : 0], x0, y0, x1, y1, soloPiso);
    else {
      faltan = false;
      // el piso cacheado a dos resoluciones fijas, para no repintarlo en cada zoom
      W.dibujarPiso(c, x0, y0, x1, y1, cam.z < 0.5 ? 0.2 : 0.5);
    }
    // los caminos ya van en el piso (W.CAMINOS, ver aplicarCaminos); acá solo el que se está trazando
    if (camino && cursor) {
      const tr = Object.assign({}, camino, { p: camino.p.concat([[cursor.x, cursor.y]]) });
      SENDAS.pintar(c, tr, 999, x0, y0, x1, y1, null, W.CAMINOS);
      if (SENDAS.pintarPuentes) SENDAS.pintarPuentes(c, W.CAMINOS, x0, y0, x1, y1, tr);
    }
    if (caminoElegido()) {
      const cm0 = caminoElegido(),
        cm = sel && sel.vertice != null ? Object.assign({}, cm0, { p: sel.p }) : cm0;
      if (sel && sel.vertice != null) {
        const otros = W.CAMINOS.map((o) => (o === cm0 ? cm : o));
        SENDAS.pintar(c, cm, cm.sem || 0, x0, y0, x1, y1, null, otros);
        if (SENDAS.pintarPuentes) SENDAS.pintarPuentes(c, otros, x0, y0, x1, y1, cm);
      }
      // el tramo elegido, resaltado
      if (tramoSel != null && cm.p[tramoSel + 1]) {
        c.save();
        c.strokeStyle = "rgba(115,213,219,0.85)";
        c.lineWidth = Math.max(8 / cam.z, cm.w * 0.25);
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(cm.p[tramoSel][0], cm.p[tramoSel][1]);
        c.lineTo(cm.p[tramoSel + 1][0], cm.p[tramoSel + 1][1]);
        c.stroke();
        c.restore();
      }
      // sus puntos, para moverlos (y entre punto y punto, dónde se le agrega uno)
      cm.p.forEach(([x, y], k) => {
        c.fillStyle = "#111111";
        c.beginPath();
        c.arc(x, y, 9 / cam.z, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#FFD98A";
        c.beginPath();
        c.arc(x, y, 6 / cam.z, 0, Math.PI * 2);
        c.fill();
        if (!k) return;
        const mx = (x + cm.p[k - 1][0]) / 2,
          my = (y + cm.p[k - 1][1]) / 2,
          r = 5 / cam.z;
        c.strokeStyle = "#FFD98A";
        c.lineWidth = 2 / cam.z;
        c.beginPath();
        c.moveTo(mx - r, my);
        c.lineTo(mx + r, my);
        c.moveTo(mx, my - r);
        c.lineTo(mx, my + r);
        c.stroke();
      });
      c.save();
      c.strokeStyle = "#FFD98A";
      c.lineWidth = 3 / cam.z;
      c.setLineDash([12 / cam.z, 8 / cam.z]);
      c.beginPath();
      cm.p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
      c.restore();
    }
    if (cortando && cursor) {
      const cm = caminoElegido(),
        m = cm && marcaEn(cm, cursor.x, cursor.y);
      cortando.marcas.concat(m ? [m] : []).forEach((q) => {
        c.strokeStyle = "#C8402D";
        c.lineWidth = 5 / cam.z;
        c.beginPath();
        c.arc(q.q[0], q.q[1], 12 / cam.z, 0, Math.PI * 2);
        c.stroke();
      });
    }
    dibujarAgua();
    // la cuadrícula en metros (1 m ≈ 30 unidades): cada 10 m de cerca, cada 100 m de lejos
    if ($("grilla").checked) {
      const paso = cam.z > 0.15 ? 300 : 3000;
      c.save();
      c.strokeStyle = "rgba(242,236,236,0.14)";
      c.lineWidth = 1 / cam.z;
      c.beginPath();
      for (let gx = Math.floor(x0 / paso) * paso; gx <= x1; gx += paso) (c.moveTo(gx, y0), c.lineTo(gx, y1));
      for (let gy = Math.floor(y0 / paso) * paso; gy <= y1; gy += paso) (c.moveTo(x0, gy), c.lineTo(x1, gy));
      c.stroke();
      c.restore();
    }
    if (camino) {
      c.fillStyle = "#FFD98A";
      camino.p.forEach(([x, y]) => {
        c.beginPath();
        c.arc(x, y, 6 / cam.z, 0, Math.PI * 2);
        c.fill();
      });
    }
    if (!lejos) {
      // horneado: lo de base ya está en las baldosas, en vivo solo lo cambiado (agregado o movido)
      const lista = visibles(x0, y0, x1, y1)
        .filter((d) => (horno && !soloPiso ? d.agregado != null || d.movido != null : cam.z >= LIVIANO || !chico(d)))
        .map(enVista);
      vistaT();
      pisoT();
      lista.filter((d) => d.piso && !d.enPiso).forEach((d) => ASSETS.dibujar(c, d.id, (d.mundo || d).x, (d.mundo || d).y, tt, (d.mundo || d).o));
      vistaT();
      lista.filter((d) => !d.piso).sort((a, b) => a.y + (a.o.orden || 0) - b.y - (b.o.orden || 0)).forEach((d) => {
        if (sel && sel.d && sel.d.agregado === d.agregado && sel.d.cosa === d.cosa) c.globalAlpha = 0.55;
        ASSETS.dibujar(c, d.id, d.x, d.y, tt, d.o);
        c.globalAlpha = 1;
      });
      if ($("choques").checked) {
        pisoT();
        c.lineWidth = 2 / cam.z;
        lista.forEach((d) => {
          if (!d.choque) return;
          d = d.mundo || d;
          c.strokeStyle = d.agregado != null ? "#FFD98A" : "rgba(242,236,236,0.6)";
          c.beginPath();
          if (d.choque.r) c.ellipse(d.x, d.y, d.choque.r, d.choque.r / 1.6, 0, 0, Math.PI * 2);
          else c.rect(d.x - d.choque.w / 2, d.y - d.choque.h, d.choque.w, d.choque.h);
          c.stroke();
        });
        vistaT();
      }
      // marca de lo agregado: un rombo dorado al pie
      est.poner.forEach((a) => {
        if (a.x < x0 || a.x > x1 || a.y < y0 || a.y > y1 + 200) return;
        const r = 9 / cam.z,
          [ax, ay] = V(a.x, a.y);
        c.fillStyle = "#FFD98A";
        c.beginPath();
        c.moveTo(ax, ay - r);
        c.lineTo(ax + r, ay);
        c.lineTo(ax, ay + r);
        c.lineTo(ax - r, ay);
        c.closePath();
        c.fill();
      });
    } else {
      // de lejos, cada agregado es un punto dorado y cada sacado una cruz
      pisoT();
      est.poner.forEach((a) => {
        c.fillStyle = "#FFD98A";
        c.beginPath();
        c.arc(a.x, a.y, 5 / cam.z, 0, Math.PI * 2);
        c.fill();
      });
    }
    // el mapa original de Eldervald encima, con su transparencia, para comparar con lo hecho
    pisoT();
    if ($("original").checked && croquis.complete && croquis.naturalWidth) {
      c.globalAlpha = +$("originalA").value;
      c.drawImage(croquis, 0, 0, W.ANCHO, (croquis.naturalHeight * W.ANCHO) / croquis.naturalWidth);
      c.globalAlpha = 1;
    }
    // lo de la historia: un rombo rúnico al pie; con el puntero encima, qué es
    vistaT();
    if (!lejos) {
      const lista2 = visibles(x0, y0, x1, y1).map(enVista);
      lista2.forEach((d) => {
        if (!nombradas.has(d.cosa) || (horno && cam.z < 0.1)) return;
        const r = 8 / cam.z;
        c.strokeStyle = "#73D5DB";
        c.lineWidth = 2.5 / cam.z;
        c.beginPath();
        c.moveTo(d.x, d.y - r);
        c.lineTo(d.x + r, d.y);
        c.lineTo(d.x, d.y + r);
        c.lineTo(d.x - r, d.y);
        c.closePath();
        c.stroke();
      });
      marcarElegida(lista2);
      const h = cursor && !arrastre && !sel ? (herr === "borrar" ? tocadoSacar(cursor.x, cursor.y) : tocado(cursor.x, cursor.y)) : null;
      if (h && h.deco) etiqueta(enVista({ id: h.deco.id, x: h.deco.x, y: h.deco.y, o: {} }));
      else if (h && (nombradas.has(h.cosa) || $("historia").checked)) etiqueta(enVista(h));
    }
    est.quitar.forEach((q) => {
      if (q.x < x0 || q.x > x1 || q.y < y0 || q.y > y1) return;
      const r = 10 / cam.z;
      q = { x: V(q.x, q.y)[0], y: V(q.x, q.y)[1] };
      c.strokeStyle = "#C8402D";
      c.lineWidth = 3 / cam.z;
      c.beginPath();
      c.moveTo(q.x - r, q.y - r);
      c.lineTo(q.x + r, q.y + r);
      c.moveTo(q.x + r, q.y - r);
      c.lineTo(q.x - r, q.y + r);
      c.stroke();
    });
    // las notas: un alfiler dorado con su número y, de cerca, el texto (verde si ya está hecha)
    if ($("verNotas").checked) est.notas.forEach((n, i) => {
      const k = 1 / cam.z;
      c.save();
      c.translate(...V(n.x, n.y));
      c.scale(k, k);
      c.fillStyle = "rgba(0,0,0,0.4)";
      c.beginPath();
      c.ellipse(0, 0, 7, 3, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = notaSel === i ? "#FFFFFF" : n.hecha ? "#7BC86C" : "#FFD98A";
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(-9, -18);
      c.arc(0, -22, 10, Math.PI * 0.8, Math.PI * 2.2);
      c.closePath();
      c.fill();
      c.fillStyle = "#111111";
      c.font = "bold 11px system-ui, sans-serif";
      c.textAlign = "center";
      c.fillText(String(i + 1), 0, -18);
      if (cam.z > 0.08 && n.texto) {
        c.font = "13px system-ui, sans-serif";
        c.textAlign = "left";
        const lineasN = partir(n.texto, 34).slice(0, 5),
          ancho = Math.max(...lineasN.map((l) => c.measureText(l).width)) + 16;
        c.fillStyle = "rgba(17,17,17,0.9)";
        c.fillRect(14, -40, ancho, lineasN.length * 17 + 10);
        c.fillStyle = "#FFD98A";
        c.fillRect(14, -40, 3, lineasN.length * 17 + 10);
        c.fillStyle = "#F2ECEC";
        lineasN.forEach((l, j) => c.fillText(l, 24, -24 + j * 17));
      }
      c.restore();
    });
    // el rectángulo para elegir, y la regla
    vistaT();
    if (arrastre && arrastre.caja) {
      const [ax, ay, bx, by] = cajaVista(arrastre);
      c.save();
      c.fillStyle = "rgba(255,217,138,0.08)";
      c.fillRect(ax, ay, bx - ax, by - ay);
      c.strokeStyle = "#FFD98A";
      c.lineWidth = 1.5 / cam.z;
      c.setLineDash([8 / cam.z, 5 / cam.z]);
      c.strokeRect(ax, ay, bx - ax, by - ay);
      c.restore();
    }
    if (medida && (herr === "medir" || arrastre === medida)) {
      const [ax, ay] = V(medida.x, medida.y),
        [bx, by] = V(medida.x2, medida.y2),
        m = Math.hypot(medida.x2 - medida.x, medida.y2 - medida.y) / 30;
      c.save();
      c.strokeStyle = "#73D5DB";
      c.lineWidth = 3 / cam.z;
      c.beginPath();
      c.moveTo(ax, ay);
      c.lineTo(bx, by);
      c.stroke();
      [[ax, ay], [bx, by]].forEach(([px, py]) => (c.beginPath(), c.arc(px, py, 5 / cam.z, 0, Math.PI * 2), c.fillStyle = "#73D5DB", c.fill()));
      c.translate((ax + bx) / 2, (ay + by) / 2);
      c.scale(1 / cam.z, 1 / cam.z);
      c.font = "bold 14px system-ui, sans-serif";
      const txt = t("ed.medida", [m < 10 ? m.toFixed(1) : Math.round(m)]),
        w = c.measureText(txt).width + 16;
      c.fillStyle = "rgba(17,17,17,0.9)";
      c.fillRect(-w / 2, -30, w, 24);
      c.fillStyle = "#73D5DB";
      c.textAlign = "center";
      c.fillText(txt, 0, -13);
      c.restore();
    }
    if (window.EDITOR_IA) EDITOR_IA.dibujar(c, cam, V, enVista, tt);
    if (window.EDITOR_MUNDO) EDITOR_MUNDO.dibujar(c, cam, V, cursor, tt);
    if (window.EDITOR_PINCEL) EDITOR_PINCEL.dibujar(c, cam, V, cursor, tt);
    if (window.EDITOR_HISTORIA) EDITOR_HISTORIA.dibujar(c, cam, V);
    if (window.EDITOR_ZONAS) EDITOR_ZONAS.dibujar(c, cam, V, tt);
    if (window.EDITOR_BOCETO) EDITOR_BOCETO.dibujar(c, cam, V, tt);
    if (ctrlAbajo) dibujarCopia(c, tt);
    if (window.EDITOR_IA && EDITOR_IA.dibujarVarias) EDITOR_IA.dibujarVarias(c, cam, V, tt);
    if (window.EDITOR_NPC) EDITOR_NPC.dibujar(c, cam, V, tt);
    // la vista previa de lo que se va a poner
    if (herr === "poner" && elegido && cursor && !lejos) {
      const o = opcionesDe({ id: elegido, o: nuevasOpciones(cursor.x, cursor.y) });
      if (arrastre && arrastre.dos) Object.assign(o, { x2: cursor.x, y2: cursor.y });
      const x = arrastre && arrastre.dos ? arrastre.x : cursor.x,
        y = arrastre && arrastre.dos ? arrastre.y : cursor.y;
      if (arrastre && arrastre.dos) o.x2 = cursor.x;
      const d = enVista({ id: elegido, x, y, o });
      c.globalAlpha = 0.6;
      ASSETS.dibujar(c, elegido, d.x, d.y, tt, d.o);
      c.globalAlpha = 1;
    }
    $("donde").textContent = cursor ? t("ed.donde", [Math.round(cursor.x / W.U), Math.round(cursor.y / W.U), cam.z.toFixed(2)]) + " · " + t("ed.donde_m", [Math.round(cursor.x / 30), Math.round(cursor.y / 30)]) : "";
    pintarMini();
    requestAnimationFrame(dibujar);
  }

  // el cartelito de lo que está bajo el puntero: su nombre y, si es de la historia, que tiene que estar
  function etiqueta(d) {
    const k = 1 / cam.z,
      nom = t("as." + d.id),
      hist = nombradas.get(d.cosa);
    const l1 = nom === "as." + d.id ? d.id : nom,
      l2 = hist ? t("ed.de_historia", [hist]) : t("ed.agregado_o_mundo");
    c.save();
    c.translate(d.x, d.y);
    c.scale(k, k);
    c.font = "bold 14px system-ui, sans-serif";
    const w1 = c.measureText(l1).width;
    c.font = "12px system-ui, sans-serif";
    const w = Math.max(w1, c.measureText(l2).width) + 20;
    c.fillStyle = "rgba(17,17,17,0.92)";
    c.fillRect(-w / 2, 14, w, 46);
    c.fillStyle = hist ? "#73D5DB" : "#E0B2B2";
    c.fillRect(-w / 2, 14, 3, 46);
    c.textAlign = "center";
    c.fillStyle = "#F2ECEC";
    c.font = "bold 14px system-ui, sans-serif";
    c.fillText(l1, 0, 33);
    c.fillStyle = hist ? "#73D5DB" : "#B5A5A0";
    c.font = "12px system-ui, sans-serif";
    c.fillText(l2, 0, 51);
    c.restore();
  }

  function partir(txt, n) {
    const out = [];
    txt.split("\n").forEach((par) => {
      let l = "";
      par.split(" ").forEach((w) => {
        if ((l + " " + w).trim().length > n && l) {
          out.push(l);
          l = w;
        } else l = (l + " " + w).trim();
      });
      out.push(l);
    });
    return out;
  }

  // ---------- elegir una estructura: tamaño, proporciones, espejado y cosas pegadas ----------
  // Con Mover, un clic sin arrastrar la elige. Lo agregado guarda sus opciones en su o; lo del mundo, en su entrada de
  // est.mover (o: { esc, ex, ey, esp }). Lo que se pone con «Agregarle algo» queda pegado (pegado: clave del padre) y
  // se mueve con ella.
  let elegida = null, // { a } (de est.poner) o { cosa } (del mundo)
    pegarA = null,
    grupo = []; // con Ctrl+clic: varios elegidos (cada uno { a } o { cosa }); se mueven y se agrandan juntos
  const mismo = (g, h) => (g.a ? g.a === h.a : !h.a && g.cosa === h.cosa);
  const delGrupo = (d) => grupo.find((g) => (g.a ? d.agregado != null && est.poner[d.agregado] === g.a : d.cosa === g.cosa));
  // la entrada de est.mover de una cosa del mundo (se crea si hace falta)
  function entradaDe(cosa, crear) {
    if (movidos.has(cosa)) return est.mover[movidos.get(cosa)];
    if (!crear) return null;
    est.mover.push({ id: cosa.id, x: r1(cosa.x), y: r1(cosa.y), nx: r1(cosa.x), ny: r1(cosa.y) });
    armarMovidos();
    return est.mover[est.mover.length - 1];
  }
  // dónde está cada uno del grupo, sus opciones y cómo se corre
  function datosDe(g) {
    if (g.a) {
      const a = g.a,
        o = a.o || (a.o = {});
      return { p: [a.x, a.y], o, fijar: (x, y) => ((a.x = r1(x)), (a.y = r1(y))), hijos: hijosDe(a.u || "-") };
    }
    const m = entradaDe(g.cosa, true),
      o = m.o || (m.o = {});
    // lo que va de punta a punta: su segunda punta queda anotada en la entrada para poder correrla
    if (g.cosa.o.x2 !== undefined && o.x2 === undefined) (o.x2 = r1(g.cosa.o.x2 + m.nx - g.cosa.x)), (o.y2 = r1(g.cosa.o.y2 + m.ny - g.cosa.y));
    return { p: [m.nx, m.ny], o, fijar: (x, y) => ((m.nx = r1(x)), (m.ny = r1(y))), hijos: hijosDe(claveDe(g.cosa)) };
  }
  function correrGrupo(dx, dy, salvo) {
    if (!dx && !dy) return;
    grupo.forEach((g) => {
      if (salvo && mismo(g, salvo)) return;
      const d = datosDe(g);
      d.fijar(d.p[0] + dx, d.p[1] + dy);
      if (d.o.x2 !== undefined) (d.o.x2 = r1(d.o.x2 + dx)), (d.o.y2 = r1(d.o.y2 + dy));
      correrHijos(d.hijos, dx, dy);
    });
  }
  // agranda todo el grupo desde su centro: cada uno crece y se aleja (o se acerca) del centro en la misma medida
  function agrandarGrupo(f) {
    const ds = grupo.map(datosDe),
      cx = ds.reduce((s, d) => s + d.p[0], 0) / ds.length,
      cy = ds.reduce((s, d) => s + d.p[1], 0) / ds.length;
    ds.forEach((d) => {
      const nx = cx + (d.p[0] - cx) * f,
        ny = cy + (d.p[1] - cy) * f;
      if (d.o.x2 !== undefined) (d.o.x2 = r1(cx + (d.o.x2 - cx) * f)), (d.o.y2 = r1(cy + (d.o.y2 - cy) * f));
      else d.o.esc = Math.round((d.o.esc || 1) * f * 1000) / 1000;
      correrHijos(d.hijos, r1(nx) - d.p[0], r1(ny) - d.p[1]);
      d.fijar(nx, ny);
    });
  }
  const uid = () => "a" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  function nuevo(a) {
    a.u = uid();
    enCapa(a);
    if (pegarA) a.pegado = pegarA;
    return a;
  }
  function claveDe(d) {
    if (d.agregado != null) {
      const a = est.poner[d.agregado];
      if (!a.u) a.u = uid();
      return a.u;
    }
    const cosa = d.cosa || d;
    return "m:" + cosa.id + "@" + Math.round(cosa.x) + "," + Math.round(cosa.y);
  }
  const hijosDe = (k) => est.poner.filter((a) => a.pegado === k);
  function correrHijos(l, dx, dy) {
    if (!dx && !dy) return;
    l.forEach((a) => {
      a.x = r1(a.x + dx);
      a.y = r1(a.y + dy);
      if (a.o && a.o.x2 !== undefined) (a.o.x2 = r1(a.o.x2 + dx)), (a.o.y2 = r1(a.o.y2 + dy));
    });
  }
  function elegir(d) {
    elegida = d.agregado != null ? { a: est.poner[d.agregado] } : { cosa: d.cosa };
    pintarElegida();
  }
  const elegidos = () => (grupo.length > 1 ? grupo : elegida ? [elegida] : []);
  function soltarElegida() {
    elegida = null;
    pegarA = null;
    grupo = [];
    $("selPanel").classList.add("oculto");
  }
  // la entrada de est.mover de lo del mundo elegido (se crea si hace falta)
  function entrada(crear) {
    const cosa = elegida.cosa;
    if (movidos.has(cosa)) return est.mover[movidos.get(cosa)];
    if (!crear) return null;
    est.mover.push({ id: cosa.id, x: r1(cosa.x), y: r1(cosa.y), nx: r1(cosa.x), ny: r1(cosa.y) });
    armarMovidos();
    return est.mover[est.mover.length - 1];
  }
  function opcionesElegida() {
    if (!elegida) return {};
    if (elegida.a) return elegida.a.o || (elegida.a.o = {});
    const m = entrada(false);
    return Object.assign({}, elegida.cosa.o, (m && m.o) || {});
  }
  function cambiarElegida(k, v, quieto) {
    if (!elegida) return;
    let o;
    if (elegida.a) o = elegida.a.o || (elegida.a.o = {});
    else {
      const m = entrada(true);
      o = m.o || (m.o = {});
    }
    if (quieto) delete o[k];
    else o[k] = v;
  }
  const deslizadores = [
    ["selEsc", "esc", 1],
    ["selEx", "ex", 1],
    ["selEy", "ey", 1],
    ["selRot", "rot", 0],
    ["selGiro", "giro", 0],
  ];
  function pintarElegida() {
    if (window.EDITOR_CAPAS) EDITOR_CAPAS.pintar();
    const panel = $("selPanel");
    if (!elegida) return panel.classList.add("oculto");
    panel.classList.remove("oculto");
    const id = elegida.a ? elegida.a.id : elegida.cosa.id,
      nom = t("as." + id),
      o = opcionesElegida(),
      hist = elegida.cosa && nombradas.get(elegida.cosa);
    $("selNombre").textContent = (nom === "as." + id ? id : nom) + (grupo.length > 1 ? " · " + t("ed.sel_grupo", [grupo.length]) : "");
    $("selOrdenV").textContent = Math.round((o.orden || 0) / ORDEN);
    $("selTipo").textContent = hist ? t("ed.de_historia", [hist]) : elegida.a ? t("ed.sel_agregado", [hijosDe(elegida.a.u || "-").length]) : t("ed.sel_mundo", [hijosDe(claveDe(elegida.cosa)).length]);
    const dos = o.x2 !== undefined;
    deslizadores.forEach(([el, k, base]) => {
      $(el).value = dos ? (k === "rot" ? anguloDos() : base) : o[k] || base;
      $(el + "V").textContent = k === "rot" || k === "giro" ? Math.round(+$(el).value) + "°" : (+$(el).value).toFixed(2);
      // lo que va de punta a punta: el tamaño es su largo y el giro lo da vuelta sobre su centro
      $(el).disabled = dos && (k === "ex" || k === "ey" || k === "giro");
    });
    escPrevio = 1;
    if (grupo.length > 1) $("selEsc").value = 1;
    $("selEscV").textContent = (+$("selEsc").value).toFixed(2);
    $("selEsp").checked = !!o.esp;
    $("selDos").classList.toggle("oculto", !dos);
    const ex = elegida.a ? elegida.a.x : elegida.cosa.x,
      ey = elegida.a ? elegida.a.y : elegida.cosa.y;
    const pl = window.INTERIORES && INTERIORES.plantillaDe(id, o, ex, ey);
    $("selInterior").classList.toggle("oculto", !pl);
    $("selInterior").onclick = () => window.EDITOR_CUARTOS && EDITOR_CUARTOS.abrir(pl);
  }
  deslizadores.forEach(([el, k, base]) => {
    $(el).addEventListener("pointerdown", () => recordar());
    $(el).addEventListener("keydown", () => recordar());
    $(el).addEventListener("input", () => {
      const v = +$(el).value;
      $(el + "V").textContent = k === "rot" || k === "giro" ? Math.round(v) + "°" : v.toFixed(2);
      if (grupo.length > 1 && k === "esc") {
        agrandarGrupo(v / escPrevio);
        escPrevio = v;
        return;
      }
      if (esDos() && k === "rot") return girarDos(v);
      if (esDos() && k === "esc") {
        estirarDos(v / escPrevio);
        escPrevio = v;
        return;
      }
      cambiarElegida(k, v, Math.abs(v - base) < 0.001);
    });
    $(el).addEventListener("change", guardar);
  });
  // lo que va de punta a punta (cercos, muralla, puentes): sus dos puntas, en lo agregado (x, y → o.x2, o.y2) o en su
  // entrada de est.mover (nx, ny → o.x2, o.y2, ya en su lugar final)
  let escPrevio = 1;
  const esDos = () => elegida && opcionesElegida().x2 !== undefined;
  function puntasDos() {
    if (elegida.a) {
      const a = elegida.a;
      return { a: [a.x, a.y], b: [a.o.x2, a.o.y2], fijar: (p, q) => ((a.x = r1(p[0])), (a.y = r1(p[1])), (a.o.x2 = r1(q[0])), (a.o.y2 = r1(q[1]))) };
    }
    const cosa = elegida.cosa,
      m = entrada(true),
      b = m.o && m.o.x2 !== undefined ? [m.o.x2, m.o.y2] : [cosa.o.x2 + m.nx - cosa.x, cosa.o.y2 + m.ny - cosa.y];
    return {
      a: [m.nx, m.ny],
      b,
      fijar: (p, q) => {
        correrHijos(hijosDe(claveDe(cosa)), r1(p[0]) - m.nx, r1(p[1]) - m.ny);
        m.nx = r1(p[0]);
        m.ny = r1(p[1]);
        m.o = Object.assign(m.o || {}, { x2: r1(q[0]), y2: r1(q[1]) });
      },
    };
  }
  function anguloDos() {
    const { a, b } = puntasDos();
    return Math.round((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI);
  }
  function girarDos(grados) {
    cambiarElegida("rot", 0, true); // el giro de un objeto suelto no va acá
    const { a, b, fijar } = puntasDos(),
      cx = (a[0] + b[0]) / 2,
      cy = (a[1] + b[1]) / 2,
      l = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2,
      ang = (grados * Math.PI) / 180,
      dx = Math.cos(ang) * l,
      dy = Math.sin(ang) * l;
    fijar([cx - dx, cy - dy], [cx + dx, cy + dy]);
  }
  function estirarDos(f) {
    const { a, b, fijar } = puntasDos(),
      cx = (a[0] + b[0]) / 2,
      cy = (a[1] + b[1]) / 2;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) * f < 20) return;
    fijar([cx + (a[0] - cx) * f, cy + (a[1] - cy) * f], [cx + (b[0] - cx) * f, cy + (b[1] - cy) * f]);
  }
  // adelante / atrás: corre la línea con la que se ordena el dibujo (o.orden, en unidades del mundo), sin moverlo
  const ORDEN = 40;
  function cambiarOrden(paso) {
    if (!elegida) return;
    recordar();
    (grupo.length > 1 ? grupo : [elegida]).forEach((g) => {
      const o = g.a ? g.a.o || (g.a.o = {}) : datosDe(g).o;
      o.orden = (o.orden || 0) + paso * ORDEN;
      if (!o.orden) delete o.orden;
    });
    guardar();
    pintarElegida();
  }
  $("selAtras").onclick = () => cambiarOrden(-1);
  $("selAdelante").onclick = () => cambiarOrden(1);
  $("selEsp").addEventListener("change", () => {
    recordar();
    cambiarElegida("esp", true, !$("selEsp").checked);
    guardar();
  });
  $("selComo").onclick = () => {
    if (!elegida) return;
    recordar();
    ["esc", "ex", "ey", "esp", "rot", "giro"].forEach((k) => cambiarElegida(k, 0, true));
    const m = elegida.cosa && entrada(false);
    if (m && m.o) delete m.o.x2, delete m.o.y2;
    guardar();
    pintarElegida();
  };
  $("selAgregar").onclick = () => {
    if (!elegida) return;
    pegarA = elegida.a ? elegida.a.u || (elegida.a.u = uid()) : claveDe(elegida.cosa);
    ponerHerr("poner");
    avisar(t("ed.sel_pegar", [$("selNombre").textContent]));
  };
  $("selSoltar").onclick = soltarElegida;
  // el recuadro de lo elegido y de lo que tiene pegado
  function marcarElegida(l) {
    if (!elegida) return;
    const k = elegida.a ? elegida.a.u : claveDe(elegida.cosa);
    l.forEach((d) => {
      const es = (elegida.a ? d.agregado != null && est.poner[d.agregado] === elegida.a : d.cosa === elegida.cosa) || !!delGrupo(d);
      const hijo = d.agregado != null && k && est.poner[d.agregado].pegado === k;
      if (!es && !hijo) return;
      if (d.o && d.o.x2 !== undefined) {
        // lo que va de punta a punta: una línea punteada de punta a punta, con un punto en cada una
        c.save();
        c.strokeStyle = c.fillStyle = es ? "#FFD98A" : "rgba(255,217,138,0.6)";
        c.lineWidth = (es ? 2.5 : 1.5) / cam.z;
        c.setLineDash([10 / cam.z, 6 / cam.z]);
        c.beginPath();
        c.moveTo(d.x, d.y + 12);
        c.lineTo(d.o.x2, d.o.y2 + 12);
        c.stroke();
        [[d.x, d.y], [d.o.x2, d.o.y2]].forEach(([x, y]) => {
          c.beginPath();
          c.arc(x, y + 12, 6 / cam.z, 0, Math.PI * 2);
          c.fill();
        });
        c.restore();
        return;
      }
      const w = d.choque ? (d.choque.w ? d.choque.w : d.choque.r * 2) + 30 : 70 * ((d.o && d.o.esc) || 1),
        h = Math.min(d.alto, 900) + 20;
      c.save();
      c.strokeStyle = es ? "#FFD98A" : "rgba(255,217,138,0.6)";
      c.lineWidth = (es ? 2.5 : 1.5) / cam.z;
      c.setLineDash([10 / cam.z, 6 / cam.z]);
      c.strokeRect(d.x - w / 2, d.y - h, w, h + 14);
      c.restore();
    });
  }

  // ---------- los caminos: clic en cada punto, doble clic, Enter o Esc lo termina; el ancho sale del tamaño ----------
  // Los de base (los del mundo, CAM0) se pueden sacar (est.quitarCaminos: su número) o cambiar de tipo
  // (est.estiloCaminos: [{ i, tipo, borde, fundir, w }]); los nuevos van en est.caminos. Todo se vuelca en W.CAMINOS,
  // que es lo que pinta el piso (SENDAS), y se repintan los trozos de lo que cambió.
  let camino = null;
  const CAM0 = W.CAMINOS.slice();
  CAM0.forEach((cm, i) => (cm.sem = cm.sem == null ? i : cm.sem));
  let firmasCam = new Map();
  function aplicarCaminos() {
    const lista = [];
    CAM0.forEach((cm, i) => {
      if (est.quitarCaminos.includes(i)) return;
      const e = est.estiloCaminos.find((q) => q.i === i);
      lista.push(e ? Object.assign({}, cm, { tipo: e.tipo, borde: e.borde, fundir: e.fundir, w: e.w || cm.w, p: e.p || cm.p, tramos: e.tramos, base: i }) : Object.assign(cm, { base: i }));
    });
    est.caminos.forEach((cm, i) => capaVe(cm) && lista.push(Object.assign({}, cm, { sem: 1000 + i, nuevo: i })));
    const nuevas = new Map(lista.map((cm) => [(cm.base != null ? "b" + cm.base : "n" + cm.nuevo), JSON.stringify([cm.p, cm.w, cm.tipo, cm.borde, cm.fundir, cm.tramos])]));
    const repintar = [];
    nuevas.forEach((f, k) => firmasCam.get(k) !== f && repintar.push(k));
    firmasCam.forEach((f, k) => !nuevas.has(k) && repintar.push(k));
    const viejos = W.CAMINOS.slice();
    W.CAMINOS.length = 0;
    lista.forEach((cm) => W.CAMINOS.push(cm));
    const todos = viejos.concat(lista);
    repintar.forEach((k) => {
      todos.filter((cm) => (cm.base != null ? "b" + cm.base : "n" + cm.nuevo) === k).forEach((cm) => {
        for (let i = 1; i < cm.p.length; i++) {
          const [ax, ay] = cm.p[i - 1],
            [bx, by] = cm.p[i],
            n = Math.ceil(Math.hypot(bx - ax, by - ay) / 400);
          for (let j = 0; j <= n; j++) W.invalidar(ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n);
        }
      });
    });
    firmasCam = nuevas;
  }
  // la firma de los caminos que pasan por un rectángulo (para las baldosas horneadas)
  function firmaCaminos(x0, y0, x1, y1) {
    return W.CAMINOS.filter((cm) => cm.p.some(([x, y]) => x > x0 - 1500 && x < x1 + 1500 && y > y0 - 1500 && y < y1 + 1500))
      .map((cm) => firmasCam.get(cm.base != null ? "b" + cm.base : "n" + cm.nuevo))
      .join("/") + est.quitarCaminos.join(",");
  }
  const opcionesCamino = () => ({ tipo: $("camTipo").value, borde: $("camBorde").value, fundir: $("camFundir").checked });
  function terminarCamino() {
    if (camino && camino.p.length >= 2) {
      recordar();
      // la última punta se pega a la punta de otro camino si cae encima
      const ult = camino.p[camino.p.length - 1],
        pt = puntaEn(ult[0], ult[1], camino.sigue && camino.sigue.cm);
      if (pt) camino.p[camino.p.length - 1] = pt.q.slice();
      if (camino.sigue) {
        // seguir un camino desde una de sus puntas: los puntos nuevos se le suman (mismo ancho, tipo y borde)
        const { cm, alInicio } = camino.sigue,
          nuevos = camino.p.slice(1);
        const p = puntosDe(cm);
        if (alInicio) {
          p.unshift(...nuevos.reverse());
          const tr = tramosDe(cm);
          if (tr.length) tr.unshift(...nuevos.map(() => null));
        }
        else p.push(...nuevos);
      } else est.caminos.push(enCapa(Object.assign({ p: camino.p, w: camino.w }, opcionesCamino())));
      guardar();
    }
    camino = null;
  }
  // la lista de puntos que se puede cambiar de un camino (los de base guardan su recorrido nuevo en est.estiloCaminos)
  function puntosDe(cm) {
    if (cm.nuevo != null) return est.caminos[cm.nuevo].p;
    let e = est.estiloCaminos.find((q) => q.i === cm.base);
    if (!e) est.estiloCaminos.push((e = { i: cm.base, tipo: cm.tipo || "tierra", borde: cm.borde || "", fundir: !!cm.fundir, w: cm.w }));
    if (!e.p) e.p = cm.p.map((q) => [r1(q[0]), r1(q[1])]);
    return e.p;
  }
  // la punta de un camino bajo (x, y): { cm, alInicio, q }
  function puntaEn(x, y, salvo) {
    let mejor = null,
      dm = Infinity;
    W.CAMINOS.forEach((cm) => {
      if (cm === salvo) return;
      [[cm.p[0], true], [cm.p[cm.p.length - 1], false]].forEach(([q, alInicio]) => {
        const d = Math.hypot(x - q[0], y - q[1]);
        if (d < Math.max(cm.w / 2, 14 / cam.z) && d < dm) (dm = d), (mejor = { cm, alInicio, q });
      });
    });
    return mejor;
  }
  // el punto del camino elegido bajo (x, y), o el tramo (para meterle uno nuevo)
  function verticeEn(cm, x, y) {
    const r = 12 / cam.z;
    for (let k = 0; k < cm.p.length; k++) if (Math.hypot(x - cm.p[k][0], y - cm.p[k][1]) < r) return { k };
    for (let k = 1; k < cm.p.length; k++) if (distSeg(x, y, cm.p[k - 1][0], cm.p[k - 1][1], cm.p[k][0], cm.p[k][1]) < cm.w / 2) return { k, nuevo: true };
    return null;
  }
  // el camino elegido (con Mover o con la herramienta Camino): { base } o { nuevo }
  let camElegido = null;
  function caminoElegido() {
    if (!camElegido) return null;
    return W.CAMINOS.find((cm) => (camElegido.base != null ? cm.base === camElegido.base : cm.nuevo === camElegido.nuevo)) || null;
  }
  // los tipos por tramo del camino (est.caminos[i].tramos, o los de base en est.estiloCaminos)
  function tramosDe(cm) {
    if (cm.nuevo != null) return est.caminos[cm.nuevo].tramos || (est.caminos[cm.nuevo].tramos = []);
    puntosDe(cm);
    const e = est.estiloCaminos.find((q) => q.i === cm.base);
    return e.tramos || (e.tramos = []);
  }
  let cortando = null; // Cortar: { marcas: [{ k, q, u }] }: k el tramo, q el punto, u la distancia desde el comienzo
  let tramoSel = null; // el tramo elegido del camino elegido (de p[k] a p[k + 1])
  function elegirCamino(cm) {
    tramoSel = null;
    if (cortando) (cortando = null), $("camCortar").classList.remove("activo");
    camElegido = cm ? (cm.base != null ? { base: cm.base } : { nuevo: cm.nuevo }) : null;
    pintarPanelCamino();
  }
  function pintarPanelCamino() {
    const cm = caminoElegido();
    $("camPanel").classList.toggle("oculto", herr !== "camino" && !cm);
    $("camElegido").classList.toggle("oculto", !cm);
    $("camTramo").classList.toggle("oculto", !cm || tramoSel == null || tramoSel >= cm.p.length - 1);
    if (cm && tramoSel != null) {
      $("camTramoN").textContent = t("ed.cam_tramo", [tramoSel + 1]);
      $("camTramoTipo").value = (cm.tramos && cm.tramos[tramoSel]) || "";
    }
    if (cm) {
      $("camTipo").value = cm.tipo || "tierra";
      $("camBorde").value = cm.borde || "";
      $("camFundir").checked = !!cm.fundir;
      $("camAncho").value = cm.w;
      $("camAnchoV").textContent = Math.round(cm.w);
      $("camTitulo").textContent = t(cm.base != null ? "ed.cam_de_base" : "ed.cam_nuevo");
    } else $("camTitulo").textContent = t("ed.cam_nuevo_titulo");
  }
  // cambiar el tipo, el borde, las puntas o el ancho del elegido
  function cambiarCamino() {
    const cm = caminoElegido();
    if (!cm) return;
    recordar();
    const o = Object.assign(opcionesCamino(), { w: +$("camAncho").value });
    if (cm.nuevo != null) Object.assign(est.caminos[cm.nuevo], o);
    else {
      const e = est.estiloCaminos.find((q) => q.i === cm.base);
      if (e) Object.assign(e, o);
      else est.estiloCaminos.push(Object.assign({ i: cm.base }, o));
    }
    guardar();
  }
  ["camTipo", "camBorde", "camFundir"].forEach((id) => $(id).addEventListener("change", cambiarCamino));
  $("camTramoTipo").addEventListener("change", () => {
    const cm = caminoElegido();
    if (!cm || tramoSel == null) return;
    recordar();
    const tr = tramosDe(cm);
    while (tr.length < cm.p.length - 1) tr.push(null);
    tr[tramoSel] = $("camTramoTipo").value || null;
    if (tr.every((q) => !q)) tr.length = 0;
    guardar();
  });
  $("camAncho").addEventListener("input", () => ($("camAnchoV").textContent = $("camAncho").value));
  $("camAncho").addEventListener("change", cambiarCamino);
  $("camSacar").onclick = () => {
    const cm = caminoElegido();
    if (!cm) return;
    sacarCamino(cm);
  };
  $("camSoltar").onclick = () => elegirCamino(null);
  // cortar: parte el camino elegido en dos y saca lo del medio (un tramo entero, o lo que quede entre dos clics)
  // a y b: { p, tramos } de cada pedazo que queda; uno con menos de dos puntos no queda
  function partirCamino(cm, a, b) {
    recordar();
    const estilo = { tipo: cm.tipo || "tierra", borde: cm.borde || "", fundir: !!cm.fundir, w: cm.w };
    const limpio = (tr) => (tr.some((q) => q) ? tr : undefined);
    if (cm.nuevo != null) {
      const c0 = est.caminos[cm.nuevo];
      if (a.p.length >= 2) Object.assign(c0, { p: a.p, tramos: limpio(a.tramos) });
      else est.caminos.splice(cm.nuevo, 1);
    } else if (a.p.length >= 2) {
      puntosDe(cm);
      Object.assign(est.estiloCaminos.find((q) => q.i === cm.base), { p: a.p, tramos: limpio(a.tramos) });
    } else {
      est.quitarCaminos.push(cm.base);
      est.estiloCaminos = est.estiloCaminos.filter((q) => q.i !== cm.base);
    }
    if (b.p.length >= 2) est.caminos.push(Object.assign({}, estilo, { p: b.p, tramos: limpio(b.tramos) }));
    camElegido = null;
    tramoSel = null;
    cortando = null;
    guardar();
    pintarPanelCamino();
  }
  const rp = (q) => [r1(q[0]), r1(q[1])];
  $("camTramoSacar").onclick = () => {
    const cm = caminoElegido();
    if (!cm || tramoSel == null) return;
    const tr = cm.tramos || [];
    partirCamino(cm, { p: cm.p.slice(0, tramoSel + 1).map(rp), tramos: tr.slice(0, tramoSel) }, { p: cm.p.slice(tramoSel + 1).map(rp), tramos: tr.slice(tramoSel + 1) });
  };
  // Cortar: dos clics sobre el camino elegido; lo que queda entre los dos se saca
  $("camCortar").onclick = () => {
    if (!caminoElegido()) return;
    cortando = cortando ? null : { marcas: [] };
    $("camCortar").classList.toggle("activo", !!cortando);
    if (cortando) avisar(t("ed.cam_cortar_ayuda"));
  };
  function marcaEn(cm, x, y) {
    let mejor = null,
      dm = Infinity,
      u = 0;
    for (let k = 1; k < cm.p.length; k++) {
      const [ax, ay] = cm.p[k - 1],
        [bx, by] = cm.p[k],
        dx = bx - ax,
        dy = by - ay,
        l = dx * dx + dy * dy,
        f = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0,
        q = [ax + dx * f, ay + dy * f],
        d = Math.hypot(x - q[0], y - q[1]);
      if (d < dm) (dm = d), (mejor = { k: k - 1, q, u: u + Math.sqrt(l) * f });
      u += Math.sqrt(l);
    }
    return dm < Math.max(cm.w / 2, 20 / cam.z) ? mejor : null;
  }
  function cortarEn(x, y) {
    const cm = caminoElegido();
    if (!cm) return (cortando = null);
    const m = marcaEn(cm, x, y);
    if (!m) return;
    cortando.marcas.push(m);
    if (cortando.marcas.length < 2) return;
    const [m1, m2] = cortando.marcas.sort((a, b) => a.u - b.u),
      tr = cm.tramos || [];
    $("camCortar").classList.remove("activo");
    partirCamino(
      cm,
      { p: cm.p.slice(0, m1.k + 1).map(rp).concat([rp(m1.q)]), tramos: tr.slice(0, m1.k + 1) },
      { p: [rp(m2.q)].concat(cm.p.slice(m2.k + 1).map(rp)), tramos: tr.slice(m2.k) },
    );
  }
  function sacarCamino(cm) {
    recordar();
    if (cm.nuevo != null) est.caminos.splice(cm.nuevo, 1);
    else {
      est.quitarCaminos.push(cm.base);
      est.estiloCaminos = est.estiloCaminos.filter((q) => q.i !== cm.base);
    }
    camElegido = null;
    guardar();
    pintarPanelCamino();
  }
  const distSeg = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax,
      dy = by - ay,
      l = dx * dx + dy * dy,
      k = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
    return Math.hypot(px - ax - dx * k, py - ay - dy * k);
  };
  function caminoEn(x, y) {
    for (let i = W.CAMINOS.length - 1; i >= 0; i--) {
      const cm = W.CAMINOS[i];
      if (cm.nuevo != null && capaTraba(est.caminos[cm.nuevo])) continue;
      for (let k = 1; k < cm.p.length; k++) if (distSeg(x, y, cm.p[k - 1][0], cm.p[k - 1][1], cm.p[k][0], cm.p[k][1]) < cm.w / 2 + 10 / cam.z) return cm;
    }
    return null;
  }
  cv.addEventListener("dblclick", (e) => {
    const cm = !camino && caminoElegido();
    if (cm && (herr === "camino" || herr === "mover")) {
      // doble clic en un punto del camino elegido lo saca (si le quedan dos o más)
      const [x, y] = aMundo(e.offsetX, e.offsetY),
        v = verticeEn(cm, x, y);
      if (v && !v.nuevo && cm.p.length > 2) {
        recordar();
        puntosDe(cm).splice(v.k, 1);
        // los dos tramos de ese punto quedan en uno (con el tipo del primero)
        const tr = tramosDe(cm);
        if (tr.length) tr.splice(v.k === 0 ? 0 : v.k, 1);
        tramoSel = null;
        guardar();
      }
      return;
    }
    if (herr === "camino") terminarCamino();
  });

  // ---------- el agua: ríos y lagunas ----------
  // Con Agua (6) se traza un río (clic en cada punto, doble clic, Enter o Esc lo termina; el ancho sale de su barra)
  // o se arrastra una laguna desde el centro. Con Mover un clic en el agua la elige (una laguna tuya también se
  // arrastra) y con Sacar se saca. Lo de base que se saca queda en est.quitarRios / est.quitarLagos (su número: el
  // mundo lo deja marcado seco, sin correr la lista); lo nuevo va en est.rios ({ p, w }) y est.lagos ({ x, y, rx, ry }).
  // Todo se vuelca en W.RIOS y W.LAGOS, que es lo que pinta el piso. En el juego lo que queda adentro del agua nueva
  // se saca y donde la cruza un camino queda un vado.
  // lo de base que se cambia (recorrido, ancho, anchos por tramo, laguna corrida) va en est.estiloRios /
  // est.estiloLagos por su número; p0, w0… es cómo era
  const RIOS0 = W.RIOS.filter((r) => !r.agregado),
    LAGOS0 = W.LAGOS.filter((l) => !l.agregado);
  RIOS0.forEach((r) => Object.assign(r, { p0: r.p, w0: r.w, an0: r.anchos }));
  LAGOS0.forEach((l) => Object.assign(l, { c0: l.p, rx0: l.rx, ry0: l.ry }));
  let rio = null, // el río que se está trazando: { p, w }
    aguaSel = null; // { rio | lago: índice en W.RIOS / W.LAGOS }
  const cajaRio = (r) => {
    const xs = r.p.map((q) => q[0]),
      ys = r.p.map((q) => q[1]),
      m = Math.max(r.w, ...(r.anchos || []).filter((v) => v)) / 2 + 120;
    return [Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) + m, Math.max(...ys) + m];
  };
  const cajaLago = (l) => [l.p[0] - l.rx - 120, l.p[1] - l.ry - 120, l.p[0] + l.rx + 120, l.p[1] + l.ry + 120];
  function invalidarCaja([a, b, cc, d]) {
    for (let y = b; y <= d + 400; y += 400) for (let x = a; x <= cc + 400; x += 400) W.invalidar(Math.min(x, cc), Math.min(y, d));
  }
  let firmasAgua = new Map();
  function aplicarAgua() {
    RIOS0.forEach((r, i) => (r.seco = !!est.lienzo || est.quitarRios.includes(i)));
    LAGOS0.forEach((l, i) => (l.seco = !!est.lienzo || est.quitarLagos.includes(i)));
    W.RIOS.length = 0;
    RIOS0.forEach((r, i) => {
      const e = est.estiloRios.find((q) => q.i === i);
      W.RIOS.push(Object.assign(r, { base: i, p: (e && e.p) || r.p0, w: (e && e.w) || r.w0, anchos: e ? e.anchos : r.an0 }));
    });
    est.rios.forEach((r, i) => W.RIOS.push({ p: r.p, w: r.w, anchos: r.anchos, agregado: true, nuevo: i, seco: !capaVe(r) }));
    W.LAGOS.length = 0;
    LAGOS0.forEach((l, i) => {
      const e = est.estiloLagos.find((q) => q.i === i);
      W.LAGOS.push(Object.assign(l, { base: i, p: e ? [e.x, e.y] : l.c0, rx: e ? e.rx : l.rx0, ry: e ? e.ry : l.ry0 }));
    });
    est.lagos.forEach((l, i) => W.LAGOS.push({ p: [l.x, l.y], rx: l.rx, ry: l.ry, agregado: true, nuevo: i, seco: !capaVe(l) }));
    // se repintan los trozos de lo que cambió
    const nuevas = new Map();
    W.RIOS.forEach((r) => !r.seco && nuevas.set(JSON.stringify([r.p, r.w, r.anchos]), cajaRio(r)));
    W.LAGOS.forEach((l) => !l.seco && nuevas.set(JSON.stringify([l.p, l.rx, l.ry]), cajaLago(l)));
    nuevas.forEach((cj, k) => !firmasAgua.has(k) && invalidarCaja(cj));
    firmasAgua.forEach((cj, k) => !nuevas.has(k) && invalidarCaja(cj));
    firmasAgua = nuevas;
  }
  // lo del agua que cambió y cae en un rectángulo (para las baldosas horneadas)
  function firmaAgua(x0, y0, x1, y1) {
    const toca = (cj) => cj[0] < x1 && cj[2] > x0 && cj[1] < y1 + 1200 && cj[3] > y0 - 300;
    let f = "";
    W.RIOS.forEach((r, i) => (r.agregado || r.seco || r.p !== r.p0 || r.anchos) && toca(cajaRio(r)) && (f += "r" + i + (r.seco ? "s" : JSON.stringify([r.p, r.w, r.anchos]))));
    W.LAGOS.forEach((l, i) => (l.agregado || l.seco || l.p !== l.c0 || l.rx !== l.rx0 || l.ry !== l.ry0) && toca(cajaLago(l)) && (f += "l" + i + (l.seco ? "s" : JSON.stringify([l.p, l.rx, l.ry]))));
    return f;
  }
  // ¿(x, y) cae en el agua? (con un margen de m)
  const enRio = (r, x, y, m = 0) => r.p.some((q, k) => k && distSeg(x, y, r.p[k - 1][0], r.p[k - 1][1], q[0], q[1]) < ((r.anchos && r.anchos[k - 1]) || r.w) / 2 + m);
  // dónde se guarda lo que se cambia de un río o una laguna (lo tuyo en est.rios / est.lagos; lo de base en su estilo)
  function estiloRio(r) {
    if (r.nuevo != null) return est.rios[r.nuevo];
    let e = est.estiloRios.find((q) => q.i === r.base);
    if (!e) est.estiloRios.push((e = { i: r.base, p: r.p.map((q) => [r1(q[0]), r1(q[1])]), w: r.w }));
    return e;
  }
  function estiloLago(l) {
    if (l.nuevo != null) return est.lagos[l.nuevo];
    let e = est.estiloLagos.find((q) => q.i === l.base);
    if (!e) est.estiloLagos.push((e = { i: l.base, x: r1(l.p[0]), y: r1(l.p[1]), rx: l.rx, ry: l.ry }));
    return e;
  }
  // el punto del río elegido bajo (x, y), o su tramo (para meterle uno o elegirlo)
  function verticeRio(r, x, y) {
    const rr = 12 / cam.z;
    for (let k = 0; k < r.p.length; k++) if (Math.hypot(x - r.p[k][0], y - r.p[k][1]) < rr) return { k };
    for (let k = 1; k < r.p.length; k++) if (distSeg(x, y, r.p[k - 1][0], r.p[k - 1][1], r.p[k][0], r.p[k][1]) < ((r.anchos && r.anchos[k - 1]) || r.w) / 2) return { k, nuevo: true };
    return null;
  }
  // la punta de un río bajo (x, y): { r, alInicio, q }
  function puntaRio(x, y) {
    let mejor = null,
      dm = Infinity;
    W.RIOS.forEach((r) => {
      if (r.seco) return;
      [[r.p[0], true], [r.p[r.p.length - 1], false]].forEach(([q, alInicio]) => {
        const d = Math.hypot(x - q[0], y - q[1]);
        if (d < Math.max(r.w / 2, 14 / cam.z) && d < dm) (dm = d), (mejor = { r, alInicio, q });
      });
    });
    return mejor;
  }
  let tramoRio = null; // el tramo elegido del río elegido
  const enLago = (l, x, y, m = 0) => Math.hypot((x - l.p[0]) / (l.rx + m), (y - l.p[1]) / (l.ry + m)) < 1;
  function aguaEn(x, y) {
    const m = 8 / cam.z;
    // lo de una capa trabada no se elige
    const libre = (a, lago) => !a.seco && !(a.agregado && capaTraba((lago ? est.lagos : est.rios)[a.nuevo]));
    for (let i = W.LAGOS.length - 1; i >= 0; i--) if (libre(W.LAGOS[i], true) && enLago(W.LAGOS[i], x, y, m)) return { lago: i };
    for (let i = W.RIOS.length - 1; i >= 0; i--) if (libre(W.RIOS[i]) && enRio(W.RIOS[i], x, y, m)) return { rio: i };
    return null;
  }
  // lo del mundo que quedó bajo el agua nueva no se ve (en el juego se saca), salvo lo de la historia
  const enAguaNueva = (x, y) => est.rios.some((r) => capaVe(r) && enRio(r, x, y)) || est.lagos.some((l) => capaVe(l) && enLago({ p: [l.x, l.y], rx: l.rx, ry: l.ry }, x, y));
  const ahogado = (o) =>
    (est.rios.length || est.lagos.length) &&
    !o.o.piso &&
    enAguaNueva(o.x, o.y) &&
    !nombradas.has(o) &&
    !W.CAMINOS.some((cm) => cm.p.some((q, k) => k && distSeg(o.x, o.y, cm.p[k - 1][0], cm.p[k - 1][1], q[0], q[1]) < cm.w / 2));
  const aguaElegida = () => (!aguaSel ? null : aguaSel.rio != null ? W.RIOS[aguaSel.rio] : W.LAGOS[aguaSel.lago]) || null;
  function elegirAgua(a) {
    if (!a || !aguaSel || a.rio !== aguaSel.rio) tramoRio = null;
    aguaSel = a;
    pintarPanelAgua();
  }
  function pintarPanelAgua() {
    const a = aguaElegida(),
      esLago = a && aguaSel.lago != null;
    $("aguaPanel").classList.toggle("oculto", herr !== "agua" && !a);
    $("aguaNueva").classList.toggle("oculto", !!a);
    $("aguaElegida").classList.toggle("oculto", !a);
    $("aguaTramo").classList.add("oculto");
    $("aguaFilaAncho").classList.toggle("oculto", esLago || (!a && $("aguaForma").value !== "rio"));
    $("aguaFilasLago").classList.toggle("oculto", !esLago);
    if (!a) return ($("aguaTitulo").textContent = t("ed.agua_nueva"));
    $("aguaTitulo").textContent = t((esLago ? "ed.agua_lago" : "ed.agua_rio") + (a.agregado ? "_tuyo" : "_base"));
    if (esLago) {
      $("aguaRx").value = a.rx;
      $("aguaRxV").textContent = Math.round(a.rx);
      $("aguaRy").value = a.ry;
      $("aguaRyV").textContent = Math.round(a.ry);
    } else {
      $("aguaAncho").value = a.w;
      $("aguaAnchoV").textContent = Math.round(a.w);
    }
    const conTramo = !esLago && tramoRio != null && tramoRio < a.p.length - 1;
    $("aguaTramo").classList.toggle("oculto", !conTramo);
    if (conTramo) {
      $("aguaTramoN").textContent = t("ed.cam_tramo", [tramoRio + 1]);
      $("aguaTramoAncho").value = (a.anchos && a.anchos[tramoRio]) || a.w;
      $("aguaTramoV").textContent = Math.round(+$("aguaTramoAncho").value);
    }
  }
  function cambiarAgua() {
    const a = aguaElegida();
    if (!a) return;
    recordar();
    if (aguaSel.lago != null) Object.assign(estiloLago(a), { rx: +$("aguaRx").value, ry: +$("aguaRy").value });
    else estiloRio(a).w = +$("aguaAncho").value;
    guardar();
  }
  // el ancho de un tramo solo
  $("aguaTramoAncho").addEventListener("input", () => ($("aguaTramoV").textContent = $("aguaTramoAncho").value));
  const anchoTramo = (v) => {
    const a = aguaElegida();
    if (!a || tramoRio == null) return;
    recordar();
    const e = estiloRio(a),
      an = e.anchos || (e.anchos = []);
    while (an.length < a.p.length - 1) an.push(null);
    an[tramoRio] = v;
    if (an.every((q) => !q)) delete e.anchos;
    guardar();
    pintarPanelAgua();
  };
  $("aguaTramoAncho").addEventListener("change", () => anchoTramo(+$("aguaTramoAncho").value));
  $("aguaTramoComo").onclick = () => anchoTramo(null);
  [["aguaAncho", "aguaAnchoV"], ["aguaRx", "aguaRxV"], ["aguaRy", "aguaRyV"]].forEach(([id, v]) => {
    $(id).addEventListener("input", () => ($(v).textContent = $(id).value));
    $(id).addEventListener("change", () => (aguaElegida() ? cambiarAgua() : 0));
  });
  $("aguaForma").addEventListener("change", () => {
    if (rio) terminarRio();
    pintarPanelAgua();
  });
  function sacarAgua(a) {
    const w = a.rio != null ? W.RIOS[a.rio] : W.LAGOS[a.lago];
    if (!w) return;
    recordar();
    if (a.rio != null) w.agregado ? est.rios.splice(w.nuevo, 1) : est.quitarRios.push(w.base);
    else w.agregado ? est.lagos.splice(w.nuevo, 1) : est.quitarLagos.push(w.base);
    aguaSel = null;
    guardar();
    pintarPanelAgua();
    if (!w.agregado) avisar(t("ed.agua_seca"));
  }
  $("aguaSacar").onclick = () => aguaSel && sacarAgua(aguaSel);
  $("aguaSoltar").onclick = () => elegirAgua(null);
  function terminarRio() {
    if (rio && rio.p.length >= 2) {
      recordar();
      if (rio.sigue) {
        // seguir un río desde una punta: los puntos nuevos se le suman, con su mismo ancho
        const e = estiloRio(rio.sigue.r),
          nuevos = rio.p.slice(1);
        if (rio.sigue.alInicio) {
          e.p.unshift(...nuevos.reverse());
          if (e.anchos) e.anchos.unshift(...nuevos.map(() => null));
        } else e.p.push(...nuevos);
      } else est.rios.push(enCapa({ p: rio.p, w: rio.w }));
      guardar();
    }
    rio = null;
  }
  cv.addEventListener("dblclick", (e) => {
    const a = !rio && aguaSel && aguaSel.rio != null && aguaElegida();
    if (a && (herr === "agua" || herr === "mover")) {
      // doble clic en un punto del río elegido lo saca (si le quedan dos o más)
      const [x, y] = aMundo(e.offsetX, e.offsetY),
        v = verticeRio(a, x, y);
      if (v && !v.nuevo && a.p.length > 2) {
        recordar();
        const st = estiloRio(a);
        st.p.splice(v.k, 1);
        if (st.anchos) st.anchos.splice(v.k, 1);
        tramoRio = null;
        guardar();
        pintarPanelAgua();
      }
      return;
    }
    if (herr === "agua") terminarRio();
  });
  // el río a medio trazar, la laguna que se arrastra y el contorno de lo elegido
  function pintaRio(p, w, alfa) {
    c.save();
    c.globalAlpha = alfa;
    [[w + 70, "#2E3324"], [w + 30, "#4A4A3A"], [w, "#2A4C56"], [w * 0.55, "#30586A"]].forEach(([g, col]) => {
      c.beginPath();
      p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.strokeStyle = col;
      c.lineWidth = g;
      c.lineJoin = c.lineCap = "round";
      c.stroke();
    });
    c.restore();
  }
  function pintaLago(x, y, rx, ry, alfa) {
    c.save();
    c.globalAlpha = alfa;
    [[60, 50, "#2E3324"], [24, 20, "#4A4A3A"], [0, 0, "#2A4C56"]].forEach(([mx, my, col]) => {
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(x, y, rx + mx, ry + my, 0, 0, Math.PI * 2);
      c.fill();
    });
    c.restore();
  }
  function dibujarAgua() {
    if (rio && cursor) pintaRio(rio.p.concat([[cursor.x, cursor.y]]), rio.w, 0.75);
    if (rio) {
      c.fillStyle = "#73D5DB";
      rio.p.forEach(([x, y]) => {
        c.beginPath();
        c.arc(x, y, 6 / cam.z, 0, Math.PI * 2);
        c.fill();
      });
    }
    if (arrastre && arrastre.lago && cursor) {
      const [rx, ry] = medidaLago(arrastre, cursor);
      pintaLago(arrastre.x, arrastre.y, rx, ry, 0.75);
    }
    const a0 = aguaElegida();
    if (!a0) return;
    const a = sel && sel.rioV != null ? Object.assign({}, a0, { p: sel.p, anchos: sel.anchos }) : a0;
    if (sel && sel.rioV != null) W.tramosAgua(a).forEach((tr) => pintaRio(tr.p, tr.w, 0.85));
    if (aguaSel.rio != null) {
      if (tramoRio != null && a.p[tramoRio + 1]) {
        c.save();
        c.strokeStyle = "rgba(255,217,138,0.8)";
        c.lineWidth = Math.max(8 / cam.z, a.w * 0.2);
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(a.p[tramoRio][0], a.p[tramoRio][1]);
        c.lineTo(a.p[tramoRio + 1][0], a.p[tramoRio + 1][1]);
        c.stroke();
        c.restore();
      }
      a.p.forEach(([x, y], k) => {
        c.fillStyle = "#111111";
        c.beginPath();
        c.arc(x, y, 9 / cam.z, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#73D5DB";
        c.beginPath();
        c.arc(x, y, 6 / cam.z, 0, Math.PI * 2);
        c.fill();
        if (!k) return;
        const mx = (x + a.p[k - 1][0]) / 2,
          my = (y + a.p[k - 1][1]) / 2,
          r = 5 / cam.z;
        c.strokeStyle = "#73D5DB";
        c.lineWidth = 2 / cam.z;
        c.beginPath();
        c.moveTo(mx - r, my);
        c.lineTo(mx + r, my);
        c.moveTo(mx, my - r);
        c.lineTo(mx, my + r);
        c.stroke();
      });
    }
    let lx = a.p[0],
      ly = a.p[1];
    if (sel && sel.lago != null && sel.movio) (lx = cursor.x - sel.dx), (ly = cursor.y - sel.dy);
    if (sel && sel.lago != null && sel.movio) pintaLago(lx, ly, a.rx, a.ry, 0.6);
    c.save();
    c.strokeStyle = "#73D5DB";
    c.lineWidth = 3 / cam.z;
    c.setLineDash([12 / cam.z, 8 / cam.z]);
    c.beginPath();
    if (aguaSel.lago != null) c.ellipse(lx, ly, a.rx, a.ry, 0, 0, Math.PI * 2);
    else a.p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
    c.restore();
  }
  // una laguna se arrastra desde el centro; un clic solo la pone de un tamaño mediano
  const medidaLago = (a, p) => {
    const dx = Math.abs(p.x - a.x),
      dy = Math.abs(p.y - a.y);
    return dx < 40 / cam.z && dy < 40 / cam.z ? [600, 400] : [Math.max(150, r1(dx)), Math.max(100, r1(dy))];
  };

  // ---------- las notas (para Claude: qué hacer en ese lugar) ----------
  let notaSel = -1;
  const caja = $("notaCaja"),
    area = $("notaTexto");
  function notaEn(x, y) {
    if (!$("verNotas").checked) return -1;
    let mejor = -1,
      dm = 26 / cam.z;
    const [vx, vy] = V(x, y);
    est.notas.forEach((n, i) => {
      const [nx, ny] = V(n.x, n.y),
        d = Math.hypot(vx - nx, vy - (ny - 20 / cam.z));
      if (d < dm) {
        dm = d;
        mejor = i;
      }
    });
    return mejor;
  }
  function abrirNota(i) {
    notaSel = i;
    area.value = est.notas[i].texto || "";
    $("notaHecha").checked = !!est.notas[i].hecha;
    $("notaNum").textContent = t("ed.nota_n", [i + 1]);
    caja.classList.add("ver");
    setTimeout(() => area.focus(), 0);
  }
  function cerrarNota() {
    if (notaSel >= 0 && est.notas[notaSel]) {
      const v = area.value.trim();
      const hecha = $("notaHecha").checked;
      if (v !== (est.notas[notaSel].texto || "") || hecha !== !!est.notas[notaSel].hecha) recordar();
      if (hecha) est.notas[notaSel].hecha = true;
      else delete est.notas[notaSel].hecha;
      if (v) est.notas[notaSel].texto = v;
      else est.notas.splice(notaSel, 1);
      guardar();
    }
    notaSel = -1;
    caja.classList.remove("ver");
    cv.focus();
  }
  $("notaListo").onclick = cerrarNota;
  $("notaBorrar").onclick = () => {
    if (notaSel >= 0) {
      recordar();
      est.notas.splice(notaSel, 1);
      notaSel = -1;
      guardar();
    }
    caja.classList.remove("ver");
  };
  area.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      cerrarNota();
    }
    e.stopPropagation();
  });

  // ---------- la lista de objetos ----------
  let elegido = null;
  const lista = $("lista");
  const fichas = [];
  // favoritos (la estrella de cada ficha) y los últimos usados: arriba de todo cuando no se busca nada
  const leerL = (k) => {
    try {
      return JSON.parse(localStorage.getItem(CLAVE + k) || "[]") || [];
    } catch (e) {
      return [];
    }
  };
  let favs = leerL("-favs"),
    recs = leerL("-recientes");
  const guardarL = (k, v) => {
    try {
      localStorage.setItem(CLAVE + k, JSON.stringify(v));
    } catch (e) {}
  };
  function recientes(id) {
    recs = [id].concat(recs.filter((x) => x !== id)).slice(0, 10);
    guardarL("-recientes", recs);
  }
  function ficha(a) {
    const b = document.createElement("button");
    b.className = "obj" + (a.id === elegido ? " elegido" : "");
    b.type = "button";
    b.dataset.id = a.id;
    b.draggable = true;
    b.title = a.nom;
    const m = document.createElement("canvas");
    m.width = 300;
    m.height = 140;
    const s2 = document.createElement("span");
    s2.textContent = a.nom;
    const st = document.createElement("i");
    st.className = "estrella" + (favs.includes(a.id) ? " si" : "");
    st.textContent = favs.includes(a.id) ? "★" : "☆";
    st.title = t("ed.favorito");
    st.addEventListener("click", (e) => {
      e.stopPropagation();
      favs = favs.includes(a.id) ? favs.filter((x) => x !== a.id) : favs.concat([a.id]);
      guardarL("-favs", favs);
      armarLista();
    });
    b.append(m, s2, st);
    b.addEventListener("click", () => {
      elegido = a.id;
      variando = null;
      ponerHerr("poner");
      lista.querySelectorAll(".obj").forEach((x) => x.classList.toggle("elegido", x.dataset.id === a.id));
      if (dosPuntos(a.id)) avisar(t("ed.dos_puntos"));
    });
    b.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/eromash-asset", a.id));
    lista.appendChild(b);
    fichas.push({ m, a });
  }
  function armarLista() {
    lista.innerHTML = "";
    fichas.length = 0;
    const q = $("buscar").value.trim().toLowerCase();
    const porGrupo = {},
      todos = {};
    ASSETS.catalogo().forEach((a) => {
      const nom = t("as." + a.id);
      todos[a.id] = Object.assign({ nom }, a);
      if (q && !nom.toLowerCase().includes(q) && !a.id.toLowerCase().includes(q)) return;
      (porGrupo[a.grupo] = porGrupo[a.grupo] || []).push(todos[a.id]);
    });
    const titulo = (txt) => {
      const h = document.createElement("div");
      h.className = "grupo";
      h.textContent = txt;
      lista.appendChild(h);
    };
    if (!q) {
      const f = favs.filter((id) => todos[id]),
        r = recs.filter((id) => todos[id]);
      if (f.length) (titulo(t("ed.favoritos")), f.forEach((id) => ficha(todos[id])));
      if (r.length) (titulo(t("ed.recientes")), r.forEach((id) => ficha(todos[id])));
    }
    Object.keys(porGrupo).forEach((g) => {
      titulo(t("as.grupo." + g));
      porGrupo[g].forEach(ficha);
    });
    pintarFichas();
  }
  // las miniaturas se pintan de a poco para no trabar la página
  let colaFichas = 0;
  function pintarFichas() {
    const mio = ++colaFichas;
    let i = 0;
    const paso = () => {
      if (mio !== colaFichas) return;
      for (let k = 0; k < 12 && i < fichas.length; k++, i++) {
        const { m, a } = fichas[i],
          x = m.getContext("2d");
        x.fillStyle = "#3B3222";
        x.fillRect(0, 0, m.width, m.height);
        const esc = Math.min(1.6, (m.height - 24) / Math.max(40, a.alto)),
          o = Object.assign({ s: esc, sem: 3 }, a.ejemplo);
        if (o.x2 !== undefined) (o.x2 = m.width / 2 + o.x2 * esc), (o.y2 = m.height - 14 + (o.y2 || 0) * esc);
        try {
          ASSETS.dibujar(x, a.id, m.width / 2, m.height - 14, 1, o);
        } catch (e) {}
      }
      if (i < fichas.length) requestAnimationFrame(paso);
    };
    paso();
  }
  $("buscar").addEventListener("input", armarLista);

  // ---------- herramientas ----------
  let herr = "poner";
  const BOTON_HERR = { poner: "hPoner", mover: "hMover", borrar: "hBorrar", camino: "hCamino", nota: "hNota", agua: "hAgua", medir: "hMedir", region: "hRegion", pincel: "hPincel" };
  function ponerHerr(h) {
    if (h !== "camino" && camino) terminarCamino();
    if (h !== "agua" && rio) terminarRio();
    herr = h;
    $("hAgua").classList.toggle("activo", h === "agua");
    if (h !== "agua" && h !== "mover") aguaSel = null;
    pintarPanelAgua();
    $("hCamino").classList.toggle("activo", h === "camino");
    if (h !== "camino" && h !== "mover") camElegido = null;
    pintarPanelCamino();
    Object.keys(BOTON_HERR).forEach((k) => $(BOTON_HERR[k]).classList.toggle("activo", h === k));
    $("pincelPanel").classList.toggle("oculto", h !== "pincel");
    // las opciones de cómo sale lo puesto solo importan al poner
    $("ponerOpc").classList.toggle("apagado", h !== "poner" && h !== "pincel");
    $("hIA").classList.toggle("activo", !!window.EDITOR_IA && EDITOR_IA.abierta());
    cv.style.cursor = h === "poner" ? "crosshair" : h === "mover" ? "grab" : h === "nota" ? "copy" : h === "camino" || h === "agua" || h === "medir" || h === "region" ? "cell" : h === "pincel" ? "none" : "not-allowed";
    alCambiarHerr.forEach((f) => f(h));
    usar("h_" + h);
  }
  const alCambiarHerr = [];
  Object.keys(BOTON_HERR).forEach((k) => ($(BOTON_HERR[k]).onclick = () => ponerHerr(k)));
  $("hIA").onclick = () => window.EDITOR_IA && EDITOR_IA.alternar();
  // el mapa original: prendido o no y su transparencia quedan recordados en este navegador
  try {
    const o = JSON.parse(localStorage.getItem(CLAVE + "-original") || "null");
    if (o) ($("original").checked = !!o.ver), ($("originalA").value = o.a);
  } catch (e) {}
  const pintarOriginal = () => {
    $("originalV").textContent = Math.round(+$("originalA").value * 100) + "%";
    try {
      localStorage.setItem(CLAVE + "-original", JSON.stringify({ ver: $("original").checked, a: +$("originalA").value }));
    } catch (e) {}
  };
  $("original").addEventListener("change", pintarOriginal);
  $("originalA").addEventListener("input", () => {
    if (!$("original").checked) $("original").checked = true;
    pintarOriginal();
  });
  pintarOriginal();
  // «Vista y capas» queda abierto o cerrado como se dejó
  try {
    $("vistaOpc").open = localStorage.getItem(CLAVE + "-vista") === "1";
  } catch (e) {}
  $("vistaOpc").addEventListener("toggle", () => {
    try {
      localStorage.setItem(CLAVE + "-vista", $("vistaOpc").open ? "1" : "0");
    } catch (e) {}
  });
  $("escala").addEventListener("input", () => ($("escalaV").textContent = (+$("escala").value).toFixed(2)));
  const dosPuntos = (id) => (ASSETS.EJEMPLO[id] || {}).x2 !== undefined;
  let variando = null; // la variación que toca al próximo que se pone (la vista previa ya la muestra)
  function nuevasOpciones() {
    const o = { sem: +$("variante").value || 0, v: +$("variante").value || 0 };
    if (+$("escala").value !== 1) o.esc = +$("escala").value;
    if ($("espejo").checked) o.esp = true;
    // variar: cada uno sale un poco distinto (variante, tamaño y para qué lado mira), como el follaje de los editores
    if ($("variar").checked && !variando) {
      variando = { sem: Math.floor(Math.random() * 12), esp: Math.random() < 0.5, esc: 0.85 + Math.random() * 0.3 };
    }
    if ($("variar").checked && variando) {
      o.sem = o.v = variando.sem;
      if (variando.esp) o.esp = !o.esp;
      o.esc = Math.round((o.esc || 1) * variando.esc * 100) / 100;
    }
    const ej = ASSETS.EJEMPLO[elegido] || {};
    Object.keys(ej).forEach((k) => {
      if (k !== "x2" && k !== "y2" && o[k] === undefined) o[k] = ej[k];
    });
    return o;
  }
  // el objeto bajo el puntero: el más cercano a su pie, o a la mitad de su altura
  function tocado(x, y) {
    const vw = cw / cam.z,
      vh = ch / cam.z,
      rr = cam.g ? Math.hypot(vw, vh / VOL.K) / 2 : 0;
    const l = cam.g ? visibles(cam.x - rr, cam.y - rr, cam.x + rr, cam.y + rr) : visibles(cam.x - vw / 2, cam.y - vh / 2, cam.x + vw / 2, cam.y + vh / 2);
    let mejor = null,
      dm = Infinity;
    // con la cámara girada todo se compara en la vista, donde los objetos están parados
    [x, y] = V(x, y);
    l.forEach((d0) => {
      if (trabado(d0)) return;
      const d = enVista(d0);
      // lo que va de punta a punta se toca en todo su largo
      if (d.o && d.o.x2 !== undefined) {
        // lo que va en el piso (un canal, una zanja) se toca en todo su ancho y gana a lo alto que tenga cerca
        const sube = d.piso ? 0 : 30,
          dist = distSeg(x, y, d.x, d.y - sube, d.o.x2, d.o.y2 - sube) - (d.agregado != null ? 30 : 0) - (d.piso ? (d.o.ancho || 46) + 14 : 0);
        if (dist < 70 && dist < dm) (dm = dist), (mejor = d0);
        return;
      }
      const s = (d.o && d.o.s) || 1,
        ancho = d.choque ? (d.choque.w ? d.choque.w / 2 : d.choque.r) + 20 : 40 * s,
        alto = Math.min(d.alto, 400);
      if (Math.abs(x - d.x) > ancho + 30 || y > d.y + 40 || y < d.y - alto - 20) return;
      const dist = Math.hypot(x - d.x, (y - (d.y - alto * 0.3)) * 0.6) - (d.agregado != null ? 30 : 0);
      if (dist < dm) {
        dm = dist;
        mejor = d0;
      }
    });
    return mejor;
  }

  // ---------- el puntero ----------
  let cursor = null,
    ctrlAbajo = false,
    arrastre = null,
    sel = null,
    medida = null, // la última regla tirada con Medir
    espacio = false;
  cv.addEventListener("contextmenu", (e) => e.preventDefault());
  cv.addEventListener("pointermove", (e) => {
    const [x, y] = aMundo(e.offsetX, e.offsetY);
    cursor = { x, y };
    if (window.EDITOR_PINCEL && EDITOR_PINCEL.mover(x, y, e)) return;
    if (arrastre && arrastre.pan) {
      const [dx, dy] = giroInverso(((e.offsetX - arrastre.sx) * dpr) / cam.z, ((e.offsetY - arrastre.sy) * dpr) / cam.z);
      cam.x = arrastre.cx - dx;
      cam.y = arrastre.cy - dy;
    } else if (arrastre && (arrastre.caja || arrastre.medir)) {
      arrastre.x2 = x;
      arrastre.y2 = y;
    } else if (sel && sel.rioV != null) {
      if (Math.hypot(x - sel.x0, y - sel.y0) > 5 / cam.z) sel.movio = true;
      if (sel.movio) sel.p[sel.rioV] = [r1(x), r1(y)];
    } else if (sel && sel.vertice != null) {
      if (Math.hypot(x - sel.x0, y - sel.y0) > 5 / cam.z) sel.movio = true;
      if (sel.movio) sel.p[sel.vertice] = [r1(x), r1(y)];
    } else if (sel && sel.lago != null) {
      if (Math.hypot(x - sel.x0, y - sel.y0) > 6 / cam.z) sel.movio = true;
    } else if (sel && sel.nota != null) {
      const n = est.notas[sel.nota];
      if (Math.hypot(x - sel.x0, y - sel.y0) > 6 / cam.z) sel.movio = true;
      n.x = r1(x - sel.dx);
      n.y = r1(y - sel.dy);
    } else if (sel && sel.mueve && sel.d.movido != null) {
      const m = est.mover[sel.d.movido];
      if (Math.hypot(x - sel.x0, y - sel.y0) > 5 / cam.z) sel.movio = true;
      if (!sel.movio) return;
      const nx = r1(x - sel.dx),
        ny = r1(y - sel.dy);
      correrHijos(sel.hijos, nx - m.nx, ny - m.ny);
      if (m.o && m.o.x2 !== undefined) (m.o.x2 += nx - m.nx), (m.o.y2 += ny - m.ny);
      correrGrupo(nx - m.nx, ny - m.ny, elegida);
      m.nx = nx;
      m.ny = ny;
    } else if (sel && sel.mueve) {
      if (Math.hypot(x - sel.x0, y - sel.y0) > 5 / cam.z) sel.movio = true;
      if (!sel.movio) return;
      if (sel.d.agregado != null) {
        const a = est.poner[sel.d.agregado];
        correrHijos(sel.hijos, r1(x - sel.dx) - a.x, r1(y - sel.dy) - a.y);
      }
      sel.d.x = x - sel.dx;
      sel.d.y = y - sel.dy;
      if (sel.d.agregado != null) {
        const a = est.poner[sel.d.agregado];
        const ddx = x - sel.dx - a.x,
          ddy = y - sel.dy - a.y,
          ax = a.x,
          ay = a.y;
        a.x = r1(a.x + ddx);
        a.y = r1(a.y + ddy);
        correrGrupo(a.x - ax, a.y - ay, elegida);
        if (a.o && a.o.x2 !== undefined) (a.o.x2 = r1(a.o.x2 + ddx)), (a.o.y2 = r1(a.o.y2 + ddy));
      }
    }
  });
  cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture(e.pointerId);
    const [x, y] = aMundo(e.offsetX, e.offsetY);
    if (e.button === 1 || e.button === 2 || espacio) {
      arrastre = { pan: true, sx: e.offsetX, sy: e.offsetY, cx: cam.x, cy: cam.y };
      cv.style.cursor = "grabbing";
      return;
    }
    if (caja.classList.contains("ver")) cerrarNota();
    if (cortando) return cortarEn(x, y);
    if (probando) return probarEn(x, y);
    if (herr === "medir") {
      medida = arrastre = { medir: true, x, y, x2: x, y2: y };
      return;
    }
    if (window.EDITOR_NPC && EDITOR_NPC.clic(x, y, e)) return;
    if (window.EDITOR_ZONAS && EDITOR_ZONAS.clic(x, y, e)) return;
    if (window.EDITOR_MUNDO && EDITOR_MUNDO.clic(x, y, e)) return;
    if (window.EDITOR_PINCEL && EDITOR_PINCEL.clic(x, y, e)) return;
    // una nota se toca (para editarla) o se arrastra con cualquier herramienta menos sacar
    const ni = herr !== "borrar" ? notaEn(x, y) : -1;
    if (ni >= 0) {
      recordar();
      sel = { nota: ni, dx: x - est.notas[ni].x, dy: y - est.notas[ni].y, x0: x, y0: y };
      return;
    }
    if (herr === "nota") {
      recordar();
      est.notas.push({ x: r1(x), y: r1(y), texto: "" });
      guardar();
      abrirNota(est.notas.length - 1);
      return;
    }
    if (herr === "borrar" && notaEn(x, y) >= 0) {
      recordar();
      est.notas.splice(notaEn(x, y), 1);
      guardar();
      return;
    }
    // el camino elegido: arrastrar uno de sus puntos, o tocar un tramo para agregarle uno y arrastrarlo
    if ((herr === "camino" || herr === "mover") && !camino && caminoElegido()) {
      const cm = caminoElegido(),
        v = verticeEn(cm, x, y),
        punta = v && !v.nuevo && (v.k === 0 || v.k === cm.p.length - 1);
      // con Camino, la punta no se arrastra: desde ahí se sigue el camino
      if (v && !(punta && herr === "camino")) {
        const p = cm.p.map((q) => q.slice());
        if (v.nuevo) p.splice(v.k, 0, [r1(x), r1(y)]);
        sel = { vertice: v.k, p, cm, x0: x, y0: y, seg: v.nuevo ? v.k - 1 : null };
        return;
      }
    }
    if (herr === "camino") {
      const p = [r1(x), r1(y)];
      if (!camino && camElegido) elegirCamino(null);
      // tocar la punta de un camino lo sigue desde ahí, con su mismo ancho, tipo y borde
      const pt = !camino && puntaEn(x, y);
      if (pt)
        camino = { p: [pt.q.slice()], w: pt.cm.w, tipo: pt.cm.tipo || "tierra", borde: pt.cm.borde || "", fundir: !!pt.cm.fundir, sigue: { cm: pt.cm, alInicio: pt.alInicio } };
      else if (!camino) camino = Object.assign({ p: [p], w: r1(110 * +$("escala").value) }, opcionesCamino());
      else {
        const u = camino.p[camino.p.length - 1];
        if (Math.hypot(u[0] - p[0], u[1] - p[1]) > 8 / cam.z) camino.p.push(p);
      }
      return;
    }
    // el río elegido: arrastrar sus puntos, agregarle uno desde un tramo, o elegir un tramo (para su ancho)
    if ((herr === "agua" || herr === "mover") && !rio && aguaSel && aguaSel.rio != null && aguaElegida()) {
      const r = aguaElegida(),
        v = verticeRio(r, x, y),
        punta = v && !v.nuevo && (v.k === 0 || v.k === r.p.length - 1);
      if (v && !(punta && herr === "agua")) {
        const p = r.p.map((q) => q.slice()),
          anchos = r.anchos ? r.anchos.slice() : null;
        if (v.nuevo) {
          p.splice(v.k, 0, [r1(x), r1(y)]);
          if (anchos) anchos.splice(v.k, 0, anchos[v.k - 1] || null);
        }
        sel = { rioV: v.k, p, anchos, r, x0: x, y0: y, seg: v.nuevo ? v.k - 1 : null };
        return;
      }
    }
    if (herr === "agua") {
      if (aguaSel) elegirAgua(null);
      // tocar la punta de un río lo sigue desde ahí, con su mismo ancho
      const pr = !rio && $("aguaForma").value === "rio" && puntaRio(x, y);
      if (pr) return (rio = { p: [pr.q.slice()], w: pr.r.w, sigue: { r: pr.r, alInicio: pr.alInicio } });
      if ($("aguaForma").value === "laguna") return (arrastre = { lago: true, x, y });
      const p = [r1(x), r1(y)];
      if (!rio) rio = { p: [p], w: +$("aguaAncho").value };
      else {
        const u = rio.p[rio.p.length - 1];
        if (Math.hypot(u[0] - p[0], u[1] - p[1]) > 8 / cam.z) rio.p.push(p);
      }
      return;
    }
    // el agua se saca o se elige solo si no hay nada encima (un objeto, un camino)
    if ((herr === "borrar" || herr === "mover") && !tocadoSacar(x, y) && !caminoEn(x, y) && aguaEn(x, y)) {
      const a = aguaEn(x, y);
      if (herr === "borrar") return sacarAgua(a);
      soltarElegida();
      elegirCamino(null);
      elegirAgua(a);
      const l = a.lago != null && W.LAGOS[a.lago];
      if (l) sel = { lago: a.lago, dx: x - l.p[0], dy: y - l.p[1], x0: x, y0: y };
      return;
    }
    if (herr === "borrar" && caminoEn(x, y) && !tocadoSacar(x, y)) {
      sacarCamino(caminoEn(x, y));
      return;
    }
    // con Mover, un clic en un camino (sin nada encima) lo elige para cambiarle el tipo, el borde o sacarlo
    if (herr === "mover" && !tocado(x, y) && caminoEn(x, y)) {
      soltarElegida();
      elegirAgua(null);
      elegirCamino(caminoEn(x, y));
      return;
    }
    if (herr === "poner") {
      if (!elegido) return avisar(t("ed.elegi"));
      if (cam.z < 0.07) {
        cam.x = x;
        cam.y = y;
        cam.z = 0.3;
        return;
      }
      arrastre = { x, y, dos: dosPuntos(elegido) };
      if (!arrastre.dos) {
        recordar();
        est.poner.push(nuevo({ id: elegido, x: r1(x), y: r1(y), o: nuevasOpciones() }));
        variando = null;
        guardar();
        recientes(elegido);
        usar("colocar");
        arrastre = null;
      }
    } else if (herr === "mover") {
      const d = tocado(x, y);
      // en un lugar vacío (o con Shift) se arrastra un rectángulo para elegir todo lo que queda adentro
      if (!d || e.shiftKey) {
        arrastre = { caja: true, x, y, x2: x, y2: y, suma: e.shiftKey || e.ctrlKey || e.metaKey };
        return;
      }
      const g = d.agregado != null ? { a: est.poner[d.agregado] } : { cosa: d.cosa };
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+clic: lo suma al grupo o lo saca
        if (!grupo.length && elegida) grupo.push(elegida);
        const i = grupo.findIndex((h) => mismo(h, g));
        if (i >= 0) grupo.splice(i, 1);
        else grupo.push(g);
        if (!grupo.length) soltarElegida();
        else {
          elegida = grupo[grupo.length - 1];
          if (grupo.length === 1) grupo = [];
          pintarElegida();
        }
        return;
      }
      if (!delGrupo(d)) grupo = [];
      recordar();
      elegir(d);
      // al elegirlo puede haber quedado anotado ya (lo que va de punta a punta): se usa esa entrada
      if (d.agregado == null && d.movido == null && movidos.has(d.cosa)) d.movido = movidos.get(d.cosa);
      const creado = d.agregado == null && d.movido == null;
      if (creado) {
        // mover algo del mundo (también lo de la historia): queda anotado dónde estaba y adónde va, y el juego lo
        // corre en el lugar (con la gente y los objetivos que tiene al lado)
        est.mover.push({ id: d.id, x: r1(d.cosa.x), y: r1(d.cosa.y), nx: r1(d.x), ny: r1(d.y) });
        d.movido = est.mover.length - 1;
        movidos.set(d.cosa, d.movido);
      }
      sel = { d, dx: x - d.x, dy: y - d.y, mueve: true, x0: x, y0: y, creado, hijos: hijosDe(claveDe(d)) };
      cv.style.cursor = "grabbing";
    } else if (herr === "borrar") {
      const d = tocadoSacar(x, y);
      if (!d || d.deco) {
        const dd = d && d.deco;
        if (!dd) return;
        recordar();
        est.quitarDeco.push({ id: dd.id, x: r1(dd.x), y: r1(dd.y) });
        guardar();
        return;
      }
      if (d.agregado != null) {
        recordar();
        est.poner.splice(d.agregado, 1);
      } else {
        if (nombradas.has(d.cosa)) return avisar(t("ed.no_se_saca"));
        recordar();
        if (d.movido != null) est.mover.splice(d.movido, 1);
        est.quitar.push({ id: d.id, x: r1(d.cosa.x), y: r1(d.cosa.y) });
      }
      guardar();
    }
  });
  cv.addEventListener("pointerup", (e) => {
    const [x, y] = aMundo(e.offsetX, e.offsetY);
    if (window.EDITOR_PINCEL && EDITOR_PINCEL.soltar(x, y, e)) return;
    if (arrastre && arrastre.dos && herr === "poner") {
      recordar();
      const o = nuevasOpciones();
      o.x2 = r1(x);
      o.y2 = r1(y);
      est.poner.push(nuevo({ id: elegido, x: r1(arrastre.x), y: r1(arrastre.y), o }));
      guardar();
    }
    if (arrastre && arrastre.caja) elegirEnCaja(arrastre);
    if (arrastre && arrastre.lago) {
      const [rx, ry] = medidaLago(arrastre, { x, y });
      recordar();
      est.lagos.push(enCapa({ x: r1(arrastre.x), y: r1(arrastre.y), rx, ry }));
      guardar();
    }
    if (sel && sel.rioV != null) {
      if (sel.movio) {
        recordar();
        const e = estiloRio(sel.r);
        e.p = sel.p;
        if (sel.anchos) e.anchos = sel.anchos;
        guardar();
      } else if (sel.seg != null) {
        tramoRio = tramoRio === sel.seg ? null : sel.seg;
        pintarPanelAgua();
      }
    } else if (sel && sel.vertice != null) {
      if (sel.movio) {
        recordar();
        const p = puntosDe(sel.cm);
        // un punto nuevo parte un tramo en dos, y los dos quedan del tipo que tenía
        if (sel.seg != null) {
          const tr = tramosDe(sel.cm);
          if (tr.length > sel.seg) tr.splice(sel.seg + 1, 0, tr[sel.seg] || null);
        }
        p.length = 0;
        sel.p.forEach((q) => p.push(q));
        guardar();
      } else if (sel.seg != null) {
        // un clic en un tramo (sin arrastrar) lo elige, para cambiarle el tipo solo a él
        tramoSel = tramoSel === sel.seg ? null : sel.seg;
        pintarPanelCamino();
      }
    } else if (sel && sel.lago != null) {
      if (sel.movio) {
        recordar();
        Object.assign(estiloLago(W.LAGOS[sel.lago]), { x: r1(x - sel.dx), y: r1(y - sel.dy) });
        guardar();
      }
    } else if (sel && sel.nota != null) {
      if (sel.movio) guardar();
      else {
        historial.pop();
        abrirNota(sel.nota);
      }
    } else if (sel && sel.mueve && !sel.movio) {
      // un clic sin arrastrar solo lo elige
      historial.pop();
      if (sel.creado && sel.d.movido != null) {
        est.mover.splice(sel.d.movido, 1);
        armarMovidos();
      }
    } else if (sel) guardar();
    arrastre = null;
    sel = null;
    ponerHerr(herr);
  });

  // ---------- elegir con un rectángulo (y todos los iguales) ----------
  // El rectángulo se arrastra en la pantalla (con la cámara girada también): entra lo que tiene el pie adentro.
  let ultimaCaja = null; // [x0, y0, x1, y1] del mundo: la zona de lo último elegido con el rectángulo (la usa la IA)
  const gDe = (d) => (d.agregado != null ? { a: est.poner[d.agregado] } : { cosa: d.cosa });
  function cajaVista(a) {
    const p = V(a.x, a.y),
      q = V(a.x2, a.y2);
    return [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])];
  }
  function cajaMundo(a) {
    const [vx0, vy0, vx1, vy1] = cajaVista(a),
      pts = [desdeVista(vx0, vy0), desdeVista(vx1, vy0), desdeVista(vx0, vy1), desdeVista(vx1, vy1)];
    return [Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1]))];
  }
  function elegirEnCaja(a) {
    const [vx0, vy0, vx1, vy1] = cajaVista(a);
    if (vx1 - vx0 < 8 / cam.z && vy1 - vy0 < 8 / cam.z) {
      // un clic en lo vacío suelta lo elegido
      if (!a.suma) soltarElegida();
      return;
    }
    const [x0, y0, x1, y1] = cajaMundo(a);
    ultimaCaja = [r1(x0), r1(y0), r1(x1), r1(y1)];
    const dentro = visibles(x0 - 50, y0 - 50, x1 + 50, y1 + 50)
      .filter((d) => !trabado(d))
      .filter((d) => {
        const [x, y] = V(d.x, d.y);
        return x >= vx0 && x <= vx1 && y >= vy0 && y <= vy1;
      })
      .slice(0, 600);
    if (!a.suma) grupo = [];
    else if (!grupo.length && elegida) grupo.push(elegida);
    dentro.forEach((d) => {
      const g = gDe(d);
      if (!grupo.some((h) => mismo(h, g))) grupo.push(g);
    });
    if (!grupo.length) {
      soltarElegida();
      return avisar(t("ed.caja_vacia"));
    }
    elegida = grupo[grupo.length - 1];
    if (grupo.length === 1) grupo = [];
    pintarElegida();
    avisar(t("ed.caja_elegidos", [Math.max(1, grupo.length)]));
    usar("caja");
  }
  // todos los que son el mismo objeto que lo elegido, en lo que se ve
  function elegirIguales() {
    if (!elegida) return;
    const id = elegida.a ? elegida.a.id : elegida.cosa.id,
      vw = cw / cam.z,
      vh = ch / cam.z,
      rr = Math.hypot(vw, vh / VOL.K) / 2;
    const l = visibles(cam.x - rr, cam.y - rr, cam.x + rr, cam.y + rr).filter((d) => d.id === id && !trabado(d));
    grupo = [];
    l.forEach((d) => {
      const g = gDe(d);
      if (!grupo.some((h) => mismo(h, g))) grupo.push(g);
    });
    if (!grupo.some((h) => mismo(h, elegida))) grupo.push(elegida);
    if (grupo.length === 1) grupo = [];
    pintarElegida();
    avisar(t("ed.caja_elegidos", [Math.max(1, grupo.length)]));
    usar("iguales");
  }
  $("selIguales").onclick = elegirIguales;
  $("selDuplicar").onclick = () => duplicar();
  $("selCopiar").onclick = () => copiar();
  $("selPegar").onclick = () => pegarAca();
  $("selSacar").onclick = () => sacarElegidos();
  $("hComandos").onclick = () => window.EDITOR_COMANDOS && EDITOR_COMANDOS.abrir();
  $("hInteriores").onclick = () => window.EDITOR_CUARTOS && EDITOR_CUARTOS.abrir();
  $("hEikholt").onclick = () => window.EDITOR_EIKHOLT && EDITOR_EIKHOLT.abrir();

  // ---------- copiar, pegar y duplicar (Ctrl+C, Ctrl+V, Ctrl+D) ----------
  // Lo copiado queda en este navegador, así se pega también en otra zona o después de recargar.
  let copia = null;
  try {
    copia = JSON.parse(localStorage.getItem(CLAVE + "-copia") || "null");
  } catch (e) {}
  function copiar() {
    const l = elegidos();
    if (!l.length) return avisar(t("ed.nada_elegido")), false;
    const items = l.map((g) => {
      if (g.a) return { id: g.a.id, x: g.a.x, y: g.a.y, o: JSON.parse(JSON.stringify(g.a.o || {})) };
      const m = movidos.has(g.cosa) ? est.mover[movidos.get(g.cosa)] : null,
        o = JSON.parse(JSON.stringify(Object.assign({}, g.cosa.o, (m && m.o) || {}))),
        x = m ? m.nx : g.cosa.x,
        y = m ? m.ny : g.cosa.y;
      if (o.x2 !== undefined && m && !(m.o && m.o.x2 !== undefined)) (o.x2 += m.nx - g.cosa.x), (o.y2 += m.ny - g.cosa.y);
      // las casas del mundo ya traen su escala de casa: al pegarlas como agregado se la vuelve a poner
      const k = W.ESCALA_CASA[g.cosa.id];
      if (k && o.s) o.s = Math.round((o.s / k) * 1000) / 1000;
      return { id: g.cosa.id, x, y, o };
    });
    const cx = items.reduce((s2, it) => s2 + it.x, 0) / items.length,
      cy = items.reduce((s2, it) => s2 + it.y, 0) / items.length;
    copia = items.map((it) => {
      const o = it.o;
      delete o.pegado;
      if (o.x2 !== undefined) (o.x2 -= cx), (o.y2 -= cy);
      return { id: it.id, dx: r1(it.x - cx), dy: r1(it.y - cy), o };
    });
    try {
      localStorage.setItem(CLAVE + "-copia", JSON.stringify(copia));
    } catch (e) {}
    avisar(t("ed.copiados", [copia.length]));
    usar("copiar");
    return true;
  }
  function pegar(x, y) {
    if (!copia || !copia.length) return avisar(t("ed.nada_copiado"));
    recordar();
    const nuevos = copia.map((it) => {
      const o = JSON.parse(JSON.stringify(it.o));
      if (o.x2 !== undefined) (o.x2 = r1(o.x2 + x)), (o.y2 = r1(o.y2 + y));
      const a = enCapa({ id: it.id, x: r1(x + it.dx), y: r1(y + it.dy), o, u: uid() });
      est.poner.push(a);
      return a;
    });
    guardar();
    ponerHerr("mover");
    grupo = nuevos.length > 1 ? nuevos.map((a) => ({ a })) : [];
    elegida = { a: nuevos[nuevos.length - 1] };
    pintarElegida();
    usar("pegar");
  }
  function duplicar() {
    const l = elegidos();
    if (!l.length || !copiar()) return;
    const ps = l.map((g) => datosDe(g).p);
    usar("duplicar");
    pegar(ps.reduce((s2, q) => s2 + q[0], 0) / ps.length + 60, ps.reduce((s2, q) => s2 + q[1], 0) / ps.length + 40);
  }

  const pegarAca = () => (cursor ? pegar(cursor.x, cursor.y) : pegar(cam.x, cam.y));
  // con Ctrl apretado, lo copiado se ve transparente bajo el puntero: ahí cae con Ctrl+V
  function dibujarCopia(c, tt) {
    if (!copia || !copia.length || !cursor) return;
    window.EDITOR.fantasmas(
      c,
      copia.map((it) => {
        const o = JSON.parse(JSON.stringify(it.o || {}));
        if (o.x2 !== undefined) (o.x2 += cursor.x), (o.y2 += cursor.y);
        return { id: it.id, x: cursor.x + it.dx, y: cursor.y + it.dy, o };
      }),
      tt,
      0.45,
    );
  }
  function darVuelta() {
    if (!elegida) return;
    recordar();
    cambiarElegida("esp", true, !!opcionesElegida().esp);
    guardar();
    pintarElegida();
    usar("vuelta");
  }
  function alternarVariar() {
    $("variar").checked = !$("variar").checked;
    variando = null;
    avisar(t($("variar").checked ? "ed.variar_si" : "ed.variar_no"));
  }
  // Esc: deja de hacer lo que se esté haciendo (trazos, modos y ventanas) y suelta lo elegido
  function soltarTodo(trazando) {
    if (probando) (probando = false), $("bProbar").classList.remove("activo");
    if (cortando) (cortando = null), $("camCortar").classList.remove("activo");
    $("atajos").classList.add("oculto");
    $("revision").classList.add("oculto");
    medida = null;
    if (trazando) return camino && terminarCamino();
    elegirAgua(null);
    elegido = null;
    pegarA = null;
    soltarElegida();
    lista.querySelectorAll(".obj").forEach((x) => x.classList.remove("elegido"));
    pedir();
  }

  // ---------- marcadores de cámara: Ctrl+Shift+número guarda la vista, Shift+número vuelve ----------
  let marcas = {};
  try {
    marcas = JSON.parse(localStorage.getItem(CLAVE + "-marcas") || "{}") || {};
  } catch (e) {}
  function marcador(n, guardarla) {
    if (guardarla) {
      marcas[n] = { x: r1(cam.x), y: r1(cam.y), z: cam.z, g: Math.round((giroMeta * 180) / Math.PI) };
      try {
        localStorage.setItem(CLAVE + "-marcas", JSON.stringify(marcas));
      } catch (e) {}
      return avisar(t("ed.marca_guardada", [n]));
    }
    const m = marcas[n];
    if (!m) return avisar(t("ed.marca_vacia", [n]));
    cam.x = m.x;
    cam.y = m.y;
    cam.z = m.z;
    girarCamara(m.g || 0, true);
  }

  // ---------- modo foco (Tab): solo el mapa ----------
  function foco() {
    document.body.classList.toggle("foco");
    setTimeout(medir, 0);
  }

  // ---------- revisar: avisos de cosas que pueden estar mal antes de subir ----------
  function revisar() {
    const problemas = [],
      distCam = (x, y) => W.CAMINOS.some((cm) => cm.p.some((q, k) => k && distSeg(x, y, cm.p[k - 1][0], cm.p[k - 1][1], q[0], q[1]) < cm.w / 2 - 12));
    est.poner.forEach((a) => {
      const def = ASSETS.LISTA[a.id];
      if (!def) return problemas.push({ x: a.x, y: a.y, txt: t("ed.rev_no_existe", [a.id]) });
      const nom = t("as." + a.id);
      if (a.x < 0 || a.y < 0 || a.x > W.ANCHO || a.y > W.ALTO) problemas.push({ x: a.x, y: a.y, txt: t("ed.rev_afuera", [nom]) });
      const md = ASSETS.medidas(a.id, opcionesDe(a));
      if (md.choque && !def.piso && a.o.x2 === undefined && distCam(a.x, a.y)) problemas.push({ x: a.x, y: a.y, txt: t("ed.rev_camino", [nom]) });
      if (md.choque && !def.piso && enAguaNueva(a.x, a.y)) problemas.push({ x: a.x, y: a.y, txt: t("ed.rev_agua", [nom]) });
      if (a.pegado && !est.poner.some((b) => b.u === a.pegado) && !a.pegado.startsWith("m:")) problemas.push({ x: a.x, y: a.y, txt: t("ed.rev_suelto", [nom]) });
    });
    // dos agregados que chocan uno dentro del otro
    for (let i = 0; i < est.poner.length && problemas.length < 300; i++)
      for (let j = i + 1; j < est.poner.length; j++) {
        const a = est.poner[i],
          b = est.poner[j];
        if (Math.abs(a.x - b.x) > 200 || Math.abs(a.y - b.y) > 200) continue;
        const ma = ASSETS.LISTA[a.id] && ASSETS.medidas(a.id, opcionesDe(a)),
          mb = ASSETS.LISTA[b.id] && ASSETS.medidas(b.id, opcionesDe(b));
        if (!ma || !mb || !ma.choque || !mb.choque || !ma.choque.r || !mb.choque.r) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) < (ma.choque.r + mb.choque.r) * 0.5) problemas.push({ x: a.x, y: a.y, txt: t("ed.rev_encima", [t("as." + a.id), t("as." + b.id)]) });
      }
    est.notas.forEach((n, i) => !n.hecha && problemas.push({ x: n.x, y: n.y, txt: t("ed.rev_nota", [i + 1, corto(n.texto || "…")]) }));
    const ul = $("revLista");
    ul.innerHTML = "";
    if (!problemas.length) {
      const li = document.createElement("li");
      li.textContent = t("ed.rev_ok");
      ul.appendChild(li);
    }
    problemas.forEach((q) => {
      const li = document.createElement("li"),
        b = document.createElement("button");
      b.type = "button";
      b.textContent = q.txt;
      b.onclick = () => {
        cam.x = q.x;
        cam.y = q.y;
        cam.z = Math.max(cam.z, 0.5);
      };
      li.appendChild(b);
      ul.appendChild(li);
    });
    $("revTitulo").textContent = t("ed.rev_titulo", [problemas.length]);
    $("revision").classList.remove("oculto");
  }
  $("bRevisar").onclick = revisar;
  $("revCerrar").onclick = () => $("revision").classList.add("oculto");

  // ---------- borradores con nombre ----------
  const leerBorradores = () => {
    try {
      return JSON.parse(localStorage.getItem(CLAVE + "-borradores") || "{}") || {};
    } catch (e) {
      return {};
    }
  };
  function armarBorradores() {
    const b = leerBorradores();
    $("borradores").innerHTML = `<option value="">${t("ed.borradores")}</option>` + Object.keys(b).sort().map((k) => `<option value="${encodeURIComponent(k)}">${k.replace(/</g, "&lt;")} · ${b[k].fecha || ""}</option>`).join("");
  }
  // guarda lo de ahora como borrador con ese nombre (sin preguntar)
  function guardarBorrador(nom, callado) {
    const b = leerBorradores(),
      h = new Date();
    b[nom] = { est: JSON.parse(JSON.stringify(est)), fecha: h.toLocaleDateString() + " " + String(h.getHours()).padStart(2, "0") + ":" + String(h.getMinutes()).padStart(2, "0") };
    try {
      localStorage.setItem(CLAVE + "-borradores", JSON.stringify(b));
      if (!callado) avisar(t("ed.borrador_ok", [nom]));
    } catch (e) {
      avisar(t("ed.borrador_mal"));
    }
    armarBorradores();
  }
  $("bBorrador").onclick = () => {
    const nom = (prompt(t("ed.borrador_nombre"), est.nombre || "") || "").trim();
    if (!nom) return;
    if (est.nombre !== nom) {
      recordar();
      est.nombre = nom;
      guardar();
    }
    guardarBorrador(nom);
  };
  $("borradores").addEventListener("change", () => {
    const k = decodeURIComponent($("borradores").value);
    $("borradores").value = "";
    const b = leerBorradores()[k];
    if (!b || !confirm(t("ed.borrador_abrir", [k]))) return;
    recordar();
    est = JSON.parse(JSON.stringify(b.est));
    completar(est);
    soltarElegida();
    guardar();
  });
  armarBorradores();

  // ---------- el plano en el que se trabaja: su nombre a la vista, duplicar, copiar y pegar ----------
  // Arriba del panel se ve (y se cambia escribiendo) el nombre de lo que se está armando. Duplicar guarda el plano como
  // borrador con su nombre y sigue en una copia con otro («Eldervald 2»), para probar variaciones sin perder la
  // original. Copiar lo deja en el portapapeles como texto; Pegar abre un plano copiado (de otro navegador o de otra
  // persona) y lo de ahora queda en Deshacer.
  const nombrePlano = () => est.nombre || t("ed.plano_sin_nombre");
  const otroPlano = (n) => {
    const usados = new Set(Object.keys(leerBorradores()).concat([est.nombre]));
    const base = String(n).replace(/ \d+$/, "");
    for (let i = 2; ; i++) if (!usados.has(base + " " + i)) return base + " " + i;
  };
  window.EDITOR_PLANO = () => {
    if (document.activeElement !== $("planoNombre")) $("planoNombre").value = est.nombre || "";
    document.title = nombrePlano() + " · " + t("ed.titulo");
  };
  $("planoNombre").placeholder = t("ed.plano_sin_nombre");
  $("planoNombre").title = t("ed.plano_titulo");
  $("planoNombre").addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") $("planoNombre").blur();
    if (e.key === "Escape") ($("planoNombre").value = est.nombre || ""), $("planoNombre").blur();
  });
  $("planoNombre").addEventListener("change", () => {
    const v = $("planoNombre").value.trim().slice(0, 60);
    recordar();
    if (v) est.nombre = v;
    else delete est.nombre;
    guardar();
    avisar(t("ed.plano_nombre_ok", [nombrePlano()]));
  });
  $("planoDup").onclick = () => {
    const viejo = nombrePlano();
    guardarBorrador(viejo, true);
    recordar();
    est.nombre = otroPlano(viejo);
    guardar();
    guardarBorrador(est.nombre, true);
    avisar(t("ed.plano_dup_ok", [viejo, est.nombre]));
  };
  $("planoCopiar").onclick = () => {
    const txt = JSON.stringify({ eromashPlano: 1, est });
    const manual = () => prompt(t("ed.plano_copiar_manual"), txt);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => avisar(t("ed.plano_copiado", [nombrePlano()])), manual);
    else manual();
  };
  $("planoPegar").onclick = async () => {
    let txt = "";
    try {
      txt = await navigator.clipboard.readText();
    } catch (e) {}
    if (!/eromashPlano/.test(txt || "")) txt = prompt(t("ed.plano_pegar_manual")) || "";
    if (!txt.trim()) return;
    let j = null;
    try {
      j = JSON.parse(txt);
    } catch (e) {}
    const nuevo = j && (j.est || j);
    if (!nuevo || !Array.isArray(nuevo.poner)) return avisar(t("ed.plano_pegar_mal"));
    if (!confirm(t("ed.plano_pegar_seguro", [nuevo.nombre || t("ed.plano_sin_nombre")]))) return;
    recordar();
    est = JSON.parse(JSON.stringify(nuevo));
    completar(est);
    if (est.nombre && Object.prototype.hasOwnProperty.call(leerBorradores(), est.nombre)) est.nombre = otroPlano(est.nombre);
    soltarElegida();
    guardar();
    avisar(t("ed.plano_pegado", [nombrePlano()]));
  };

  // ---------- minimapa: dónde estás; un clic (o arrastrar) lleva la cámara ahí ----------
  const mini = $("mini"),
    mc = mini.getContext("2d");
  function pintarMini() {
    const w = mini.width,
      h = mini.height,
      k = w / W.ANCHO;
    mc.fillStyle = "#1E2C1B";
    mc.fillRect(0, 0, w, h);
    if (croquis.complete && croquis.naturalWidth) mc.drawImage(croquis, 0, 0, w, (croquis.naturalHeight * w) / croquis.naturalWidth);
    // un mapa de cero no tiene croquis: se ven su agua y sus caminos
    if (est.lienzo) {
      const linea = (l, col, an) => {
        mc.strokeStyle = col;
        mc.lineWidth = an;
        mc.beginPath();
        l.p.forEach(([x, y], i) => (i ? mc.lineTo(x * k, y * k) : mc.moveTo(x * k, y * k)));
        mc.stroke();
      };
      mc.fillStyle = "#2A4C56";
      est.lagos.forEach((l) => (mc.beginPath(), mc.ellipse(l.x * k, l.y * k, Math.max(1, l.rx * k), Math.max(1, l.ry * k), 0, 0, Math.PI * 2), mc.fill()));
      est.rios.forEach((r) => linea(r, "#2A4C56", Math.max(1, r.w * k)));
      est.caminos.forEach((cm) => linea(cm, "#5C4A32", Math.max(1, cm.w * k)));
    }
    mc.fillStyle = "#FFD98A";
    est.poner.forEach((a) => mc.fillRect(a.x * k - 1, a.y * k - 1, 2, 2));
    est.notas.forEach((n) => {
      mc.fillStyle = n.hecha ? "#7BC86C" : "#FFD98A";
      mc.beginPath();
      mc.arc(n.x * k, n.y * k, 3, 0, Math.PI * 2);
      mc.fill();
    });
    // la vista (girada, si la cámara lo está)
    const vw = cw / cam.z,
      vh = ch / cam.z;
    mc.strokeStyle = "#F2ECEC";
    mc.lineWidth = 1.5;
    mc.beginPath();
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy], i) => {
      const [x, y] = desdeVista(cam.x + (sx * vw) / 2, cam.y + (sy * vh) / 2);
      i ? mc.lineTo(x * k, y * k) : mc.moveTo(x * k, y * k);
    });
    mc.closePath();
    mc.stroke();
  }
  let miniArrastre = false;
  const miniIr = (e) => {
    const r = mini.getBoundingClientRect();
    cam.x = ((e.clientX - r.left) / r.width) * W.ANCHO;
    cam.y = ((e.clientY - r.top) / r.width) * W.ANCHO;
    pedir();
  };
  mini.addEventListener("pointerdown", (e) => {
    mini.setPointerCapture(e.pointerId);
    miniArrastre = true;
    miniIr(e);
  });
  mini.addEventListener("pointermove", (e) => miniArrastre && miniIr(e));
  mini.addEventListener("pointerup", () => (miniArrastre = false));

  // ---------- arrastrar un objeto de la lista al mapa ----------
  cv.addEventListener("dragover", (e) => e.preventDefault());
  cv.addEventListener("drop", (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/eromash-asset");
    if (!id || !ASSETS.LISTA[id]) return;
    const [x, y] = aMundo(e.offsetX, e.offsetY);
    elegido = id;
    recordar();
    const o = nuevasOpciones();
    if (o.x2 !== undefined || dosPuntos(id)) {
      const ej = ASSETS.EJEMPLO[id] || {};
      o.x2 = r1(x + (ej.x2 || 160));
      o.y2 = r1(y + (ej.y2 || 0));
    }
    est.poner.push(nuevo({ id, x: r1(x), y: r1(y), o }));
    variando = null;
    guardar();
    recientes(id);
    ponerHerr("poner");
    lista.querySelectorAll(".obj").forEach((b) => b.classList.toggle("elegido", b.dataset.id === id));
  });

  // ---------- la hoja de atajos (?) ----------
  $("bAtajos").onclick = () => $("atajos").classList.toggle("oculto");
  $("atajosCerrar").onclick = () => $("atajos").classList.add("oculto");
  cv.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const [x, y] = aMundo(e.offsetX, e.offsetY);
      zoom(e.deltaY < 0 ? 1.18 : 1 / 1.18, x, y);
    },
    { passive: false },
  );
  function zoom(f, x, y) {
    const z = Math.max(0.035, Math.min(1.6, cam.z * f));
    if (x != null) {
      cam.x = x - (x - cam.x) * (cam.z / z);
      cam.y = y - (y - cam.y) * (cam.z / z);
    }
    cam.z = z;
  }
  // teclado: mover la vista, zoom, herramientas, deshacer
  const teclas = {};
  // Ctrl (o Cmd) apretado: muestra dónde caería lo copiado
  addEventListener("keydown", (e) => (e.key === "Control" || e.key === "Meta") && !ctrlAbajo && ((ctrlAbajo = true), pedir()));
  addEventListener("keyup", (e) => (e.key === "Control" || e.key === "Meta") && ((ctrlAbajo = false), pedir()));
  addEventListener("blur", () => (ctrlAbajo = false));
  addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" && e.target.type !== "checkbox" && e.target.type !== "range") return;
    if (e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
    if (window.EDITOR_COMANDOS && EDITOR_COMANDOS.abierta()) return;
    const ctrl = e.ctrlKey || e.metaKey;
    // con los interiores abiertos, las teclas son de ellos (menos deshacer y rehacer)
    if (window.EDITOR_CUARTOS && EDITOR_CUARTOS.abierta()) {
      if (ctrl && e.key.toLowerCase() === "z") return e.preventDefault(), e.shiftKey ? rehacer() : deshacer();
      if (ctrl && e.key.toLowerCase() === "y") return e.preventDefault(), rehacer();
      return EDITOR_CUARTOS.tecla(e);
    }
    // con las zonas abiertas, lo mismo
    if (window.EDITOR_ZONAS && EDITOR_ZONAS.abierta()) {
      if (ctrl && e.key.toLowerCase() === "z") return e.preventDefault(), e.shiftKey ? rehacer() : deshacer();
      if (ctrl && e.key.toLowerCase() === "y") return e.preventDefault(), rehacer();
      return EDITOR_ZONAS.tecla(e);
    }
    // con Eikholt abierta, lo mismo
    if (window.EDITOR_EIKHOLT && EDITOR_EIKHOLT.abierta()) {
      if (ctrl && e.key.toLowerCase() === "z") return e.preventDefault(), e.shiftKey ? rehacer() : deshacer();
      if (ctrl && e.key.toLowerCase() === "y") return e.preventDefault(), rehacer();
      return EDITOR_EIKHOLT.tecla(e);
    }
    // las teclas que no llaman a una acción con nombre también enseñan qué se usa después de qué
    const k = e.key.toLowerCase(),
      regionAbierta = window.EDITOR_MUNDO && EDITOR_MUNDO.trazando(),
      tk = k.length === 1 && "qert".includes(k) && elegida ? "girar" : e.key === "Enter" ? (regionAbierta ? "cerrarReg" : "terminar") : e.key === "Backspace" && (camino || rio || regionAbierta) ? "atras" : e.key === "[" || e.key === "]" ? "tam" : e.key === "{" || e.key === "}" ? "densidad" : e.key === "Escape" ? "soltar" : null;
    if (tk && !ctrl) usar(tk);
    if (window.EDITOR_MUNDO && EDITOR_MUNDO.tecla(e)) return e.preventDefault();
    if (window.EDITOR_PINCEL && EDITOR_PINCEL.tecla(e)) return e.preventDefault();
    if (window.EDITOR_TEXTURAS && EDITOR_TEXTURAS.tecla(e)) return e.preventDefault();
    if (window.EDITOR_BOCETO && EDITOR_BOCETO.tecla(e)) return e.preventDefault();
    if (window.EDITOR_CAPAS && EDITOR_CAPAS.tecla(e)) return e.preventDefault();
    if ((e.key === "m" || e.key === "M") && !ctrl) return window.EDITOR_ZONAS && EDITOR_ZONAS.abrir();
    if ((e.key === "j" || e.key === "J") && !ctrl) return window.EDITOR_EIKHOLT && EDITOR_EIKHOLT.abrir();
    if ((e.key === "n" || e.key === "N") && !ctrl) return window.EDITOR_NPC && EDITOR_NPC.alternar();
    if (e.key === "9" && !ctrl) return window.EDITOR_CUARTOS && EDITOR_CUARTOS.abrir(elegida && window.INTERIORES ? INTERIORES.plantillaDe(elegida.a ? elegida.a.id : elegida.cosa.id, opcionesElegida(), (elegida.a || elegida.cosa).x, (elegida.a || elegida.cosa).y) : null);
    // marcadores: Shift+número vuelve, Ctrl+Shift+número guarda
    if (e.shiftKey && /^Digit[1-9]$/.test(e.code)) {
      e.preventDefault();
      return marcador(e.code.slice(5), ctrl);
    }
    if (ctrl && e.key.toLowerCase() === "k") {
      e.preventDefault();
      return window.EDITOR_COMANDOS && EDITOR_COMANDOS.abrir();
    }
    if (ctrl && e.key.toLowerCase() === "c") return copiar();
    if (ctrl && e.key.toLowerCase() === "v") {
      e.preventDefault();
      return pegarAca();
    }
    if (ctrl && e.key.toLowerCase() === "d") {
      e.preventDefault();
      return duplicar();
    }
    if (ctrl && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
      e.preventDefault();
      return rehacer();
    }
    if (e.key === "Tab" && !ctrl) {
      e.preventDefault();
      return foco();
    }
    if (e.key === "?") return $("atajos").classList.toggle("oculto");
    if (e.key === "7") ponerHerr("medir");
    if (e.key === "8") window.EDITOR_IA && EDITOR_IA.alternar();
    if (e.key === "g" || e.key === "G") $("grilla").checked = !$("grilla").checked;
    if (e.key === "h" || e.key === "H") $("verBosque").checked = !$("verBosque").checked;
    if (e.code === "Space") {
      espacio = true;
      e.preventDefault();
    }
    teclas[e.code] = true;
    if (e.key === "+" || e.key === "=") zoom(1.2);
    if (!e.ctrlKey && !e.metaKey && (e.key === "z" || e.key === "x" || e.key === "Z" || e.key === "X")) girarCamara(e.key.toLowerCase() === "x" ? 15 : -15);
    if (e.key === "-") zoom(1 / 1.2);
    if (e.key === "1") ponerHerr("poner");
    if (e.key === "2") ponerHerr("mover");
    if (e.key === "3") ponerHerr("borrar");
    if (elegida && (e.key === "f" || e.key === "F")) darVuelta();
    if (!ctrl && (e.key === "v" || e.key === "V")) alternarVariar();
    if (!ctrl && (e.key === "p" || e.key === "P")) $("bProbar").click();
    if (ctrl && e.key.toLowerCase() === "s") return e.preventDefault(), $("bDescargar").click();
    // R y T: girarlo sobre el piso
    if (elegida && !esDos() && (e.key === "r" || e.key === "t" || e.key === "R" || e.key === "T")) {
      recordar();
      let g = (opcionesElegida().giro || 0) + (e.key.toLowerCase() === "t" ? 15 : -15);
      g = ((((g + 180) % 360) + 360) % 360) - 180;
      cambiarElegida("giro", g, g === 0);
      guardar();
      pintarElegida();
    }
    if (elegida && esDos() && (e.key === "q" || e.key === "e" || e.key === "Q" || e.key === "E")) {
      recordar();
      girarDos(anguloDos() + (e.key.toLowerCase() === "e" ? 15 : -15));
      guardar();
      pintarElegida();
    } else if (elegida && (e.key === "q" || e.key === "e" || e.key === "Q" || e.key === "E")) {
      recordar();
      let r = (opcionesElegida().rot || 0) + (e.key.toLowerCase() === "e" ? 15 : -15);
      r = ((((r + 180) % 360) + 360) % 360) - 180;
      cambiarElegida("rot", r, r === 0);
      guardar();
      pintarElegida();
    }
    if (e.key === "4") ponerHerr("camino");
    if (e.key === "5") ponerHerr("nota");
    if (e.key === "6") ponerHerr("agua");
    const trazando = camino || rio;
    if ((e.key === "Enter" || e.key === "Escape") && rio) terminarRio();
    else if (e.key === "Enter" && camino) terminarCamino();
    if (e.key === "Escape") soltarTodo(trazando);
    if (ctrl && !e.shiftKey && e.key.toLowerCase() === "z") deshacer();
    if ((e.key === "Delete" || e.key === "Backspace") && rio) {
      rio.p.pop();
      if (!rio.p.length) rio = null;
    } else if ((e.key === "Delete" || e.key === "Backspace") && aguaSel) sacarAgua(aguaSel);
    else if ((e.key === "Delete" || e.key === "Backspace") && camino) {
      camino.p.pop();
      if (!camino.p.length) camino = null;
    } else if ((e.key === "Delete" || e.key === "Backspace") && (elegida || grupo.length)) sacarElegidos();
    else if (e.key === "Delete" || e.key === "Backspace") ponerHerr("borrar");
  });
  addEventListener("keyup", (e) => {
    if (e.code === "Space") espacio = false;
    teclas[e.code] = false;
  });
  setInterval(() => {
    const v = 14 / cam.z;
    let mx = 0,
      my = 0;
    if (teclas.KeyW || teclas.ArrowUp) my -= v;
    if (teclas.KeyS || teclas.ArrowDown) my += v;
    if (teclas.KeyA || teclas.ArrowLeft) mx -= v;
    if (teclas.KeyD || teclas.ArrowRight) mx += v;
    // arriba es arriba de la pantalla, gire como gire la cámara
    const [dx, dy] = giroInverso(mx, my);
    cam.x += dx;
    cam.y += dy;
    // la cámara gira despacio hasta el ángulo pedido
    if (Math.abs(giroMeta - cam.g) > 1e-4) {
      cam.g += (giroMeta - cam.g) * 0.25;
      if (Math.abs(giroMeta - cam.g) < 0.002) cam.g = giroMeta;
      if (Math.abs(cam.g) < 1e-4) cam.g = giroMeta = 0;
      pedir();
    } else if (W.girarVista) W.girarVista(cam.g); // ya quieta: el barro, el musgo y los helechos se repintan enderezados
  }, 16);
  // girar la cámara: de a 15°, siempre entre -180° y 180°
  function girarCamara(grados, absoluto) {
    let g = absoluto ? grados : Math.round((giroMeta * 180) / Math.PI) + grados;
    while (g > 180) g -= 360;
    while (g < -180) g += 360;
    // que dé la vuelta por el lado corto
    let meta = (g * Math.PI) / 180;
    while (meta - cam.g > Math.PI) cam.g += Math.PI * 2;
    while (cam.g - meta > Math.PI) cam.g -= Math.PI * 2;
    giroMeta = meta;
    $("camara").value = g;
    $("camaraV").textContent = g + "°";
  }
  $("camara").addEventListener("input", () => girarCamara(+$("camara").value, true));
  $("norte").addEventListener("click", () => girarCamara(0, true));
  // Supr con algo elegido: saca todo lo elegido (lo de la historia no se saca)
  function sacarElegidos() {
    const l = elegidos();
    if (!l.length) return;
    recordar();
    let quedan = 0;
    l.forEach((g) => {
      if (g.a) {
        const i = est.poner.indexOf(g.a);
        if (i >= 0) est.poner.splice(i, 1);
        return;
      }
      if (nombradas.has(g.cosa)) return quedan++;
      const i = movidos.has(g.cosa) ? movidos.get(g.cosa) : -1;
      if (i >= 0) est.mover.splice(i, 1), armarMovidos();
      est.quitar.push({ id: g.cosa.id, x: r1(g.cosa.x), y: r1(g.cosa.y) });
    });
    soltarElegida();
    guardar();
    usar("sacar");
    if (quedan) avisar(t("ed.no_se_saca"));
  }
  function rehacer() {
    const s = rehechos.pop();
    if (!s) return;
    historial.push(JSON.stringify(est));
    est = JSON.parse(s);
    soltarElegida();
    camElegido = null;
    aguaSel = null;
    guardar();
  }
  $("bRehacer").onclick = rehacer;
  function deshacer() {
    const s = historial.pop();
    if (!s) return;
    rehechos.push(JSON.stringify(est));
    est = JSON.parse(s);
    usar("deshacer");
    soltarElegida();
    camElegido = null;
    aguaSel = null;
    guardar();
  }
  $("bDeshacer").onclick = deshacer;

  // ---------- ir a un lugar ----------
  const ir = $("ir");
  const corto = (s) => (s.length > 40 ? s.slice(0, 39) + "…" : s);
  function armarIr() {
    const notas = est.notas.length ? `<optgroup label="${t("ed.notas")}">` + est.notas.map((n, i) => `<option value="nota${i}">${n.hecha ? "✓ " : ""}${i + 1}. ${corto(n.texto || "…").replace(/</g, "&lt;")}</option>`).join("") + "</optgroup>" : "";
    const hist =
      `<optgroup label="${t("ed.historia_grupo")}">` +
      [...nombradas.keys()]
        .map((o, i) => ({ o, i, n: t("as." + o.id) }))
        .sort((a, b) => a.n.localeCompare(b.n))
        .map((h) => `<option value="hist${h.i}">${h.n} · ${nombradas.get(h.o)}</option>`)
        .join("") +
      "</optgroup>";
    ir.innerHTML = `<option value="">${t("ed.ir")}</option>` + notas + `<option value="ciudad">${t("av.lugar_eikholt")}</option>` + Object.keys(W.LUGARES).filter((k) => t("av.lugar_" + k) !== "av.lugar_" + k).map((k) => `<option value="${k}">${t("av.lugar_" + k)}</option>`).join("") + hist;
  }
  ir.addEventListener("change", () => {
    const k = ir.value;
    if (!k) return;
    let n = k.startsWith("nota") ? est.notas[+k.slice(4)] : null;
    if (k.startsWith("hist")) {
      const o = [...nombradas.keys()][+k.slice(4)],
        m = movidos.has(o) ? est.mover[movidos.get(o)] : null;
      n = m ? { x: m.nx, y: m.ny } : o;
    }
    const p = n ? [n.x, n.y] : k === "ciudad" ? W.CIUDAD.c : W.LUGARES[k].p;
    cam.x = p[0];
    cam.y = p[1];
    cam.z = n ? Math.max(cam.z, 0.25) : k === "ciudad" ? 0.12 : 0.3;
    ir.value = "";
    cv.focus();
  });

  // ---------- archivo ----------
  function texto() {
    const lineas = (l) => (l.length ? "\n    " + l.map((a) => JSON.stringify(a)).join(",\n    ") + ",\n  " : "");
    return (
      (est.lienzo
        ? "// Un mapa de cero hecho con el editor de mapas (repo map-generator): va en aventura/js/mundo/mapas/" + archivoMapa() + "\n" +
          "// y se juega con index.html?mapa=" + est.mapaId + "&jugar=9. El mundo de base no se arma: solo lo de este archivo.\n"
        : "// Lo que se agregó o se sacó del mundo con el editor de Eldervald (repo map-generator). Este archivo lo escribe el editor\n" +
          "// con «Descargar agregados.js»: se guarda acá, en aventura/js/mundo/, y el mundo lo aplica al armarse.\n") +
      "window.AGREGADOS = {\n  nombre: " + JSON.stringify(est.nombre || "") + ",\n" + (est.lienzo ? "  lienzo: true,\n  mapaId: " + JSON.stringify(est.mapaId) + ",\n" : "") + "  poner: [" + lineas(est.poner) + "],\n  quitar: [" + lineas(est.quitar) + "],\n  mover: [" + lineas(est.mover) + "],\n  quitarDeco: [" + lineas(est.quitarDeco) + "],\n  caminos: [" + lineas(est.caminos) + "],\n  quitarCaminos: [" + est.quitarCaminos.join(", ") + "],\n  estiloCaminos: [" + lineas(est.estiloCaminos) + "],\n  rios: [" + lineas(est.rios) + "],\n  lagos: [" + lineas(est.lagos) + "],\n  quitarRios: [" + est.quitarRios.join(", ") + "],\n  quitarLagos: [" + est.quitarLagos.join(", ") + "],\n  estiloRios: [" + lineas(est.estiloRios) + "],\n  estiloLagos: [" + lineas(est.estiloLagos) + "],\n  // los interiores cambiados (pestaña Interiores): plantilla → pared, ventana, cambios por mueble y muebles puestos\n  cuartos: " + JSON.stringify(est.cuartos || {}) + ",\n  // casas de varios cuartos (generador de casas): cuartos, uniones y pasadizos; cada cuarto es la plantilla plano:<id>:<n>\n  casas: " + JSON.stringify(est.casas || {}) + ",\n  // zonas fuera del mapa (sección Zonas): mazmorras oscuras y tierras con islas, cada una con su entrada en el bosque\n  zonas: " + JSON.stringify(est.zonas || {}) + ",\n  // Eikholt cambiada (pestaña Eikholt): cosas del plano sacadas o movidas y assets puestos (ciudad/agregados.js)\n  eikholt: " + JSON.stringify(est.eikholt || {}) + ",\n  // gente propia (Importar NPC): nombre, diálogo, lugar y sus dibujos por vista (imágenes achicadas)\n  npcs: [" + lineas(est.npcs || []) + "],\n  // imágenes importadas (estructuras, pinturas de pared y calcos en el piso): cada una es el asset im_<id>\n  imagenes: " + JSON.stringify(est.imagenes || {}) + ",\n  // regiones con nombre (el juego lo muestra al entrar) y piezas guardadas para reusar en el editor\n  regiones: [" + lineas(est.regiones || []) + "],\n  piezas: " + JSON.stringify(est.piezas || {}) + ",\n  // texturas hechas en el editor (generador de texturas): cada una es un asset tx_<id> (parche) o txb_<id> (bloque)\n  texturas: " + JSON.stringify(est.texturas || {}) + ",\n  // capas propias del editor (el juego las dibuja todas): id, nombre, prendida, trabada\n  capas: " + JSON.stringify(est.capas || []) + ",\n  capaSuelta: " + JSON.stringify(est.capaSuelta || {}) + ",\n  capaActiva: " + JSON.stringify(est.capaActiva || "") + ",\n  // notas para Claude: qué hacer en ese lugar (el juego no las usa)\n  notas: [" + lineas(est.notas) + "],\n};\n" +
      (est.lienzo ? "" : "// ?borrador=1: el juego usa lo que está armado en el editor de este navegador, sin descargar nada\n" +
      "try {\n  if (/[?&]borrador=1/.test(location.search)) {\n    const b = JSON.parse(localStorage.getItem(\"" + CLAVE + "\") || \"null\");\n    if (b && b.poner) window.AGREGADOS = b;\n  }\n} catch (e) {}\n")
    );
  }
  // un mapa de cero se baja con su nombre (mapas/<mapaId>.js); el de Eldervald es agregados.js
  const archivoMapa = () => (est.lienzo ? est.mapaId + ".js" : "agregados.js");
  $("bGuardarJuego").onclick = () => window.EDITOR_GITHUB && EDITOR_GITHUB.abrir();
  $("bDescargar").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([texto()], { type: "text/javascript" }));
    a.download = archivoMapa();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    bajado = huella();
    try {
      localStorage.setItem(CLAVE + "-bajado", bajado);
    } catch (e) {}
    pintarPendiente();
    usar("descargar");
  };
  $("bCopiar").onclick = () => {
    const s = texto();
    const ok = () => avisar(t("ed.copiado"));
    try {
      navigator.clipboard.writeText(s).then(ok, () => copiarViejo(s, ok));
    } catch (e) {
      copiarViejo(s, ok);
    }
  };
  function copiarViejo(s, ok) {
    const ta = document.createElement("textarea");
    ta.value = s;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      ok();
    } catch (e) {}
    ta.remove();
  }
  $("bCargar").onclick = () => $("archivo").click();
  $("archivo").addEventListener("change", () => {
    const f = $("archivo").files[0];
    if (!f) return;
    f.text().then((s) => {
      try {
        const i = s.indexOf("{", s.indexOf("AGREGADOS")),
          j = s.indexOf("\n};", i);
        const cuerpo = s.slice(i, j + 2).replace(/^(\s*)([A-Za-z_]\w*):/gm, '$1"$2":').replace(/(\w+):/g, (m, k) => (k === "poner" || k === "quitar" || k === "mover" || k === "quitarDeco" || k === "caminos" || k === "quitarCaminos" || k === "estiloCaminos" || k === "rios" || k === "lagos" || k === "quitarRios" || k === "quitarLagos" || k === "estiloRios" || k === "estiloLagos" || k === "notas" || k === "p" || k === "w" ? '"' + k + '":' : m)).replace(/\n\s*\/\/[^\n]*/g, "").replace(/,(\s*[\]}])/g, "$1");
        const nuevo = JSON.parse(cuerpo);
        if (!nuevo.poner) throw 0;
        if (!nuevo.notas) nuevo.notas = [];
        if (!nuevo.caminos) nuevo.caminos = [];
        if (!nuevo.quitarCaminos) nuevo.quitarCaminos = [];
        if (!nuevo.estiloCaminos) nuevo.estiloCaminos = [];
        if (!nuevo.mover) nuevo.mover = [];
        if (!nuevo.quitarDeco) nuevo.quitarDeco = [];
        completar(nuevo);
        recordar();
        est = nuevo;
        guardar();
        avisar(t("ed.archivo_ok"));
      } catch (e) {
        avisar(t("ed.archivo_mal"));
      }
      $("archivo").value = "";
    });
  });
  // Probar en el juego: primero se elige en el mapa dónde aparece Eromash (otro clic en el botón: el centro de la vista)
  let probando = false;
  function probarEn(x, y) {
    probando = false;
    $("bProbar").classList.remove("activo");
    guardar();
    // la ranura 9 es la de prueba: no pisa las partidas de verdad (1 a 3)
    open("index.html?borrador=1&jugar=9&en=" + r1(x) + "," + r1(y) + (window.EDITOR_HISTORIA ? EDITOR_HISTORIA.consulta() : "") + (params.get("lang") ? "&lang=" + params.get("lang") : ""), "_blank");
  }
  $("bProbar").onclick = () => {
    if (probando) return probarEn(cam.x, cam.y);
    probando = true;
    $("bProbar").classList.add("activo");
    avisar(t("ed.probar_donde"));
  };
  $("bLimpiar").onclick = () => {
    if (!confirm(t("ed.limpiar_seguro"))) return;
    recordar();
    // las piezas son la biblioteca de este navegador: limpiar el mapa no las borra
    est = { poner: [], quitar: [], mover: [], quitarDeco: [], caminos: [], quitarCaminos: [], estiloCaminos: [], rios: [], lagos: [], quitarRios: [], quitarLagos: [], estiloRios: [], estiloLagos: [], notas: [], piezas: est.piezas || {}, texturas: est.texturas || {}, casas: est.casas || {}, zonas: est.zonas || {}, eikholt: est.eikholt, npcs: est.npcs || [], imagenes: est.imagenes || {}, nombre: est.nombre, lienzo: est.lienzo, mapaId: est.mapaId };
    guardar();
  };

  let avisoT = 0;
  function avisar(s) {
    const a = $("aviso");
    a.textContent = s;
    a.classList.add("ver");
    clearTimeout(avisoT);
    avisoT = setTimeout(() => a.classList.remove("ver"), 2600);
  }

  armarLista();
  guardar();
  requestAnimationFrame(dibujar);
  // lo que usan la paleta de comandos (comandos.js) y la IA (ia.js)
  window.EDITOR = {
    est: () => est,
    herr: () => herr,
    enVista: (d) => enVista(d),
    copiarElegido: () => (copiar() ? copia : null),
    pegarEn: (items, x, y) => {
      copia = items;
      pegar(x, y);
    },
    // un cambio con su paso de Deshacer (lo usan los módulos, como el de interiores)
    cambiar: (fn) => {
      recordar();
      fn(est);
      guardar();
    },
    cam,
    W,
    t,
    avisar,
    // del puntero (offsetX, offsetY del mapa) al mundo
    aMundo: (sx, sy) => aMundo(sx, sy),
    ponerHerr,
    girarCamara,
    elegido: () => elegido,
    // lo elegido en el mapa (para darle un plano a una casa) y cambiar una opción suya con su paso de Deshacer
    casaElegida: () => (elegida ? { id: elegida.a ? elegida.a.id : elegida.cosa.id, x: (elegida.a || elegida.cosa).x, y: (elegida.a || elegida.cosa).y, o: opcionesElegida() } : null),
    cambiarElegida: (k, v) => {
      if (!elegida) return;
      recordar();
      cambiarElegida(k, v);
      guardar();
      pintarElegida();
    },
    elegir: (id) => {
      elegido = id;
      variando = null;
      ponerHerr("poner");
      lista.querySelectorAll(".obj").forEach((x) => x.classList.toggle("elegido", x.dataset.id === id));
    },
    // el texto de agregados.js tal cual se descarga (lo sube «Guardar en el juego») y marcarlo como ya bajado
    textoAgregados: () => texto(),
    // un proyecto de cero (proyectos.js): el mundo de base no está y se guarda en mapas/<mapaId>.js
    lienzo: () => !!est.lienzo,
    archivoMapa: () => archivoMapa(),
    marcarBajado: () => {
      bajado = huella();
      try {
        localStorage.setItem(CLAVE + "-bajado", bajado);
      } catch (e) {}
      pintarPendiente();
    },
    acciones: {
      deshacer: () => deshacer(),
      rehacer: () => rehacer(),
      copiar: () => copiar(),
      pegar: () => pegarAca(),
      duplicar: () => duplicar(),
      iguales: () => elegirIguales(),
      sacar: () => sacarElegidos(),
      revisar: () => revisar(),
      foco: () => foco(),
      grilla: () => ($("grilla").checked = !$("grilla").checked),
      bosque: () => ($("verBosque").checked = !$("verBosque").checked),
      bloquear: () => ($("bloquear").checked = !$("bloquear").checked),
      notas: () => ($("verNotas").checked = !$("verNotas").checked),
      norte: () => girarCamara(0, true),
      probar: () => $("bProbar").click(),
      descargar: () => $("bDescargar").click(),
      atajos: () => $("atajos").classList.toggle("oculto"),
      borrador: () => $("bBorrador").click(),
      pieza: () => $("bPieza").click(),
      exportar: () => $("bExportar").click(),
      texturas: () => window.EDITOR_TEXTURAS && EDITOR_TEXTURAS.abrir(),
      // las que usa la barra de menús
      soltar: () => soltarTodo(false),
      vuelta: () => darVuelta(),
      acercar: () => zoom(1.2),
      alejar: () => zoom(1 / 1.2),
      variar: () => alternarVariar(),
      choques: () => ($("choques").checked = !$("choques").checked),
      nombres: () => ($("historia").checked = !$("historia").checked),
    },
    // ---------- capas propias (las usa js/editor/capas.js) ----------
    capas: {
      lista: () => est.capas,
      suelta: () => est.capaSuelta,
      activa: () => (est.capaActiva && est.capas.some((c) => c.id === est.capaActiva) ? est.capaActiva : ""),
      // cuánto tiene cada capa ("" = sueltos): objetos, caminos y agua
      cuantos: () => {
        const n = { "": 0 };
        est.capas.forEach((c) => (n[c.id] = 0));
        [est.poner, est.caminos, est.rios, est.lagos].forEach((l) => l.forEach((a) => (n[a.capa in n ? a.capa : ""] += 1)));
        return n;
      },
      // la capa de lo elegido (para resaltarla en el panel)
      deElegida: () => (elegida && elegida.a ? (elegida.a.capa && est.capas.some((c) => c.id === elegida.a.capa) ? elegida.a.capa : "") : null),
      nueva: (nom, sinActivar, sinPaso) => {
        if (!sinPaso) recordar();
        const id = "c" + uid().slice(1);
        est.capas.unshift({ id, nom: nom || t("ed.cp_nueva_nom", [est.capas.length + 1]), ver: true, lock: false });
        if (!sinActivar) est.capaActiva = id;
        guardar();
        return id;
      },
      activar: (id) => {
        est.capaActiva = id || "";
        guardar();
      },
      // ver y trabar no son un paso de Deshacer (como en Photoshop); el nombre sí
      cambiar: (id, k, v) => {
        const c = id ? est.capas.find((q) => q.id === id) : est.capaSuelta;
        if (!c) return;
        if (k === "nom") recordar();
        c[k] = v;
        if (k === "lock" && v) soltarElegida(), elegirAgua(null);
        guardar();
      },
      mover: (id, d) => {
        const i = est.capas.findIndex((c) => c.id === id),
          j = i + d;
        if (i < 0 || j < 0 || j >= est.capas.length) return;
        recordar();
        est.capas.splice(j, 0, est.capas.splice(i, 1)[0]);
        guardar();
      },
      // borrar una capa: con todo lo que tiene, o pasándolo a sueltos
      borrar: (id, conTodo) => {
        recordar();
        est.capas = est.capas.filter((c) => c.id !== id);
        ["poner", "caminos", "rios", "lagos"].forEach((k) => {
          if (conTodo) est[k] = est[k].filter((a) => a.capa !== id);
          else est[k].forEach((a) => a.capa === id && delete a.capa);
        });
        if (est.capaActiva === id) est.capaActiva = "";
        soltarElegida(), elegirAgua(null);
        guardar();
      },
      // pasar lo elegido (objetos, el camino o el agua elegidos) a otra capa; devuelve cuántos
      pasar: (id) => {
        const l = elegidos().filter((g) => g.a).map((g) => g.a),
          cm = caminoElegido(),
          ag = aguaElegida();
        if (cm && cm.nuevo != null) l.push(est.caminos[cm.nuevo]);
        if (ag && ag.agregado) l.push((ag.rx !== undefined ? est.lagos : est.rios)[ag.nuevo]);
        if (!l.length) return 0;
        recordar();
        l.forEach((a) => enCapa(a, id));
        guardar();
        pintarElegida();
        return l.length;
      },
      // elegir todo lo puesto de una capa (para copiarlo, moverlo o pasarlo); devuelve cuántos
      elegirTodo: (id) => {
        const c = capaPorId(id);
        if (c.lock || c.ver === false) return 0;
        const l = est.poner.filter((a) => (a.capa && est.capas.some((c) => c.id === a.capa) ? a.capa : "") === (id || ""));
        if (!l.length) return 0;
        ponerHerr("mover");
        grupo = l.length > 1 ? l.map((a) => ({ a })) : [];
        elegida = { a: l[l.length - 1] };
        pintarElegida();
        pedir();
        return l.length;
      },
    },
    // los lugares de «Ir a…»: [{ nom, x, y }]
    lugares: () => [{ nom: t("av.lugar_eikholt"), x: W.CIUDAD.c[0], y: W.CIUDAD.c[1] }].concat(Object.keys(W.LUGARES).filter((k) => t("av.lugar_" + k) !== "av.lugar_" + k).map((k) => ({ nom: t("av.lugar_" + k), x: W.LUGARES[k].p[0], y: W.LUGARES[k].p[1] }))).concat([...nombradas.keys()].map((o) => ({ nom: t("as." + o.id) + " · " + nombradas.get(o), x: o.x, y: o.y }))),
    ir: (x, y, z) => ((cam.x = x), (cam.y = y), (cam.z = z || Math.max(cam.z, 0.3)), pedir()),
    // la zona para la IA: lo último elegido con el rectángulo o, si no, lo que se ve
    zona: () => {
      if (ultimaCaja) return { caja: ultimaCaja.slice(), deRect: true };
      const vw = cw / cam.z,
        vh = ch / cam.z;
      return { caja: [r1(cam.x - vw / 2), r1(cam.y - vh / 2), r1(cam.x + vw / 2), r1(cam.y + vh / 2)], deRect: false };
    },
    olvidarZona: () => (ultimaCaja = null),
    cosasEn: (x0, y0, x1, y1) => visibles(x0, y0, x1, y1).filter((d) => d.x >= x0 && d.x <= x1 && d.y >= y0 && d.y <= y1).map((d) => ({ id: d.id, x: r1(d.x), y: r1(d.y), historia: !!(d.cosa && nombradas.has(d.cosa)), agregado: d.agregado != null, u: d.agregado != null ? (est.poner[d.agregado] || {}).u : undefined, natural: esNatural(d.id) })),
    caminosEn: (x0, y0, x1, y1) => W.CAMINOS.filter((cm) => cm.p.some(([x, y]) => x > x0 - 300 && x < x1 + 300 && y > y0 - 300 && y < y1 + 300)).map((cm) => ({ p: cm.p.map(rp), w: cm.w, tipo: cm.tipo || "tierra" })),
    // aplica lo que propuso la IA: { poner: [{ id, x, y, o }], caminos: [{ p, w, tipo, borde }], quitar: [{ id, x, y }] }
    // opc.capa: a qué capa va (si no, a la activa); opc.sinPaso: va en el mismo paso de Deshacer que lo anterior
    aplicar: (ops, opc) => {
      opc = opc || {};
      if (!opc.sinPaso) recordar();
      const nuevos = [],
        cc = (a) => enCapa(a, opc.capa);
      (ops.poner || []).forEach((a) => {
        const n = cc({ id: a.id, x: r1(a.x), y: r1(a.y), o: a.o || {}, u: uid() });
        est.poner.push(n);
        nuevos.push(n);
      });
      (ops.caminos || []).forEach((cm) => est.caminos.push(cc({ p: cm.p.map(rp), w: r1(cm.w || 110), tipo: cm.tipo || "tierra", borde: cm.borde || "pasto", fundir: !!cm.fundir, tramos: Array.isArray(cm.tramos) ? cm.tramos : undefined })));
      // agua nueva (el boceto): ríos { p, w } y lagunas { x, y, rx, ry }
      (ops.rios || []).forEach((rr) => est.rios.push(cc({ p: rr.p.map(rp), w: r1(rr.w || 300) })));
      (ops.lagos || []).forEach((l) => est.lagos.push(cc({ x: r1(l.x), y: r1(l.y), rx: r1(l.rx), ry: r1(l.ry) })));
      (ops.quitar || []).forEach((q) => {
        if (q.u) {
          const i = est.poner.findIndex((a) => a.u === q.u);
          if (i >= 0) est.poner.splice(i, 1);
          return;
        }
        const cosa = W.COSAS.find((o) => o.id === q.id && Math.abs(o.x - q.x) < 8 && Math.abs(o.y - q.y) < 8);
        if (cosa && !nombradas.has(cosa)) est.quitar.push({ id: cosa.id, x: r1(cosa.x), y: r1(cosa.y) });
      });
      guardar();
      if (nuevos.length && !opc.sinElegir) {
        ponerHerr("mover");
        grupo = nuevos.length > 1 ? nuevos.map((a) => ({ a })) : [];
        elegida = { a: nuevos[nuevos.length - 1] };
        pintarElegida();
      }
    },
    pedir: () => pedir(),
    // elegir todo lo agregado con estos ids (texturas: «elegir lo puesto»); devuelve cuántos
    elegirIds: (ids) => {
      const l = est.poner.filter((a) => ids.includes(a.id));
      if (!l.length) return 0;
      ponerHerr("mover");
      grupo = l.length > 1 ? l.map((a) => ({ a })) : [];
      elegida = { a: l[l.length - 1] };
      pintarElegida();
      const ps = l.map((a) => [a.x, a.y]);
      cam.x = ps.reduce((q, p) => q + p[0], 0) / ps.length;
      cam.y = ps.reduce((q, p) => q + p[1], 0) / ps.length;
      pedir();
      return l.length;
    },
    // cambiarle el asset a lo elegido que es agregado (fn(id viejo) → id nuevo o null); devuelve cuántos cambió
    reemplazarElegidos: (fn) => {
      const l = elegidos().filter((g) => g.a);
      let n = 0;
      if (!l.length) return 0;
      recordar();
      l.forEach((g) => {
        const nid = fn(g.a.id);
        if (nid && nid !== g.a.id) (g.a.id = nid), n++;
      });
      if (!n) historial.pop();
      guardar();
      pintarElegida();
      return n;
    },
    // vista previa de objetos que todavía no están (pieza, IA, pincel): transparentes y de atrás para adelante
    fantasmas: (c, items, tt, alfa) => {
      c.save();
      c.globalAlpha = alfa;
      items
        .slice()
        .sort((p, q) => p.y - q.y)
        .forEach((a) => {
          const o = JSON.parse(JSON.stringify(a.o || {})),
            k = W.ESCALA_CASA[a.id];
          if (k) o.s = (o.s || 1) * k;
          const d = enVista({ id: a.id, x: a.x, y: a.y, o });
          try {
            ASSETS.dibujar(c, a.id, d.x, d.y, tt, d.o);
          } catch (er) {}
        });
      c.restore();
    },
    usar,
    sugeridos,
    alCambiarHerr: (f) => alCambiarHerr.push(f),
  };
  setInterval(pintarSiguiente, 200);
})();
