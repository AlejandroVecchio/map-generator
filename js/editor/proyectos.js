// ---------- proyectos: varios mapas en el mismo editor, de cero o sobre Eldervald (Archivo → Proyectos) ----------
// El proyecto abierto vive en la clave de siempre (la que el juego lee con ?borrador=1); los demás quedan guardados
// aparte en este navegador. Un mapa de cero (lienzo) no tiene el mundo de base: solo el borde y lo que se pone, con
// todos los assets del juego; se baja como mapas/<id>.js y el juego lo juega con index.html?mapa=<id>. Abrir otro
// proyecto recarga la página, porque el mundo se arma una vez al cargar. «Mapa nuevo en una capa» arma un mapa
// dentro del proyecto abierto: una capa nueva sola, con las demás apagadas.
window.EDITOR_PROYECTOS = (function () {
  "use strict";
  const E = window.EDITOR,
    t = E.t,
    $ = (id) => document.getElementById(id);
  const CLAVE = "eromash-aventura-editor",
    REG = "eromash-editor-proyectos",
    DE = (id) => "eromash-editor-proyecto-" + id;
  const leer = (k) => {
    try {
      return JSON.parse(localStorage.getItem(k) || "null");
    } catch (e) {
      return null;
    }
  };
  // guarda o avisa que no entra (el navegador da unos 5 MB por página: las imágenes importadas pesan)
  const escribir = (k, v) => {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
      return true;
    } catch (e) {
      E.avisar(t("ed.pr_lleno"));
      return false;
    }
  };

  // ---------- la lista ----------
  let reg = leer(REG);
  if (!reg || !Array.isArray(reg.lista) || !reg.lista.some((p) => p.id === reg.activo)) {
    const b = leer(CLAVE) || {};
    reg = { activo: b.lienzo ? b.mapaId || "mapa" : "eldervald", lista: [] };
    reg.lista.push({ id: reg.activo, nombre: b.nombre || "", lienzo: !!b.lienzo, cuando: Date.now() });
    escribir(REG, reg);
  }
  const activo = () => reg.lista.find((p) => p.id === reg.activo);
  const datos = (id) => (id === reg.activo ? leer(CLAVE) : leer(DE(id))) || {};
  const nombreDe = (p) => p.nombre || (p.lienzo ? t("ed.pr_sin_nombre") : t("ed.pr_eldervald"));
  // al nombre del abierto lo lleva el editor (el nombre del plano)
  function refrescar() {
    const p = activo(),
      b = leer(CLAVE) || {};
    p.nombre = b.nombre || "";
    p.lienzo = !!b.lienzo;
    escribir(REG, reg);
  }
  // un id para el archivo del mapa: el nombre en minúsculas y sin tildes, distinto de los que ya hay
  function nuevoId(nom) {
    const base =
      (nom || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "mapa";
    let id = base,
      n = 2;
    while (id === "eldervald" || reg.lista.some((p) => p.id === id)) id = base + "-" + n++;
    return id;
  }
  // pasar al otro proyecto: el abierto se guarda aparte, el elegido pasa a la clave de siempre y se recarga
  function abrir(id) {
    if (id === reg.activo || !reg.lista.some((p) => p.id === id)) return;
    refrescar();
    const actual = localStorage.getItem(CLAVE),
      bajado = localStorage.getItem(CLAVE + "-bajado");
    if (!escribir(DE(reg.activo), actual || "{}")) return;
    escribir(DE(reg.activo) + "-bajado", bajado);
    escribir(CLAVE, localStorage.getItem(DE(id)) || "{}");
    escribir(CLAVE + "-bajado", localStorage.getItem(DE(id) + "-bajado"));
    escribir(DE(id), null);
    escribir(DE(id) + "-bajado", null);
    reg.activo = id;
    escribir(REG, reg);
    location.reload();
  }
  const VACIO = () => ({ poner: [], quitar: [], mover: [], quitarDeco: [], caminos: [], quitarCaminos: [], estiloCaminos: [], rios: [], lagos: [], quitarRios: [], quitarLagos: [], estiloRios: [], estiloLagos: [], notas: [] });
  // uno nuevo: de cero (lienzo) o sobre el mundo de Eldervald, vacío de cambios; queda abierto
  function crear(lienzo, nom) {
    nom = (nom || "").trim().slice(0, 60) || t(lienzo ? "ed.pr_nuevo_nom" : "ed.pr_nuevo_nom_el", [reg.lista.length + 1]);
    const id = nuevoId(nom),
      b = Object.assign(VACIO(), { nombre: nom });
    if (lienzo) Object.assign(b, { lienzo: true, mapaId: id });
    if (!escribir(DE(id), b)) return;
    reg.lista.push({ id, nombre: nom, lienzo: !!lienzo, cuando: Date.now() });
    escribir(REG, reg);
    E.usar("proyecto");
    abrir(id);
  }
  function duplicar(id) {
    refrescar();
    const p = reg.lista.find((q) => q.id === id),
      b = datos(id),
      nom = t("ed.pr_copia", [nombreDe(p)]).slice(0, 60),
      nid = nuevoId(nom);
    b.nombre = nom;
    if (b.lienzo) b.mapaId = nid;
    if (!escribir(DE(nid), b)) return;
    reg.lista.push({ id: nid, nombre: nom, lienzo: !!b.lienzo, cuando: Date.now() });
    escribir(REG, reg);
    pintar();
  }
  function borrar(id) {
    const p = reg.lista.find((q) => q.id === id);
    if (!p || id === reg.activo || !confirm(t("ed.pr_borrar_seguro", [nombreDe(p)]))) return;
    escribir(DE(id), null);
    escribir(DE(id) + "-bajado", null);
    reg.lista = reg.lista.filter((q) => q.id !== id);
    escribir(REG, reg);
    pintar();
  }
  function renombrar(id) {
    const p = reg.lista.find((q) => q.id === id);
    const v = prompt(t("ed.pr_renombrar"), p.nombre || "");
    if (v == null) return;
    const nom = v.trim().slice(0, 60);
    if (id === reg.activo) {
      // el abierto: por el nombre del plano, así lo guarda el editor (y su paso de Deshacer)
      $("planoNombre").value = nom;
      $("planoNombre").dispatchEvent(new Event("change"));
    } else {
      const b = datos(id);
      b.nombre = nom;
      if (!escribir(DE(id), b)) return;
    }
    p.nombre = nom;
    escribir(REG, reg);
    pintar();
  }

  // ---------- un mapa nuevo dentro del proyecto abierto: una capa sola ----------
  function enCapa() {
    const C = E.capas,
      n = C.lista().filter((c) => c.mapa).length + 1,
      id = C.nueva(t("ed.pr_capa_nom", [n]));
    C.lista().forEach((c) => c.id !== id && c.ver !== false && C.cambiar(c.id, "ver", false));
    C.cambiar(id, "mapa", true);
    if (C.suelta().ver !== false) C.cambiar("", "ver", false);
    // sobre Eldervald, el bosque de base se apaga para ver el mapa nuevo solo (el juego lo sigue teniendo)
    if (!E.lienzo() && $("verBosque").checked) {
      $("verBosque").checked = false;
      $("verBosque").dispatchEvent(new Event("change"));
    }
    if (window.EDITOR_CAPAS) EDITOR_CAPAS.verPestana("capas");
    E.avisar(t("ed.pr_capa_lista"));
    E.usar("capaMapa");
    E.pedir();
  }

  // ---------- el panel ----------
  const panel = document.createElement("div");
  panel.id = "prPanel";
  panel.className = "oculto";
  panel.innerHTML =
    '<div class="cab"><b></b><button class="cerrar"></button></div>' +
    "<small class='ayuda'></small>" +
    '<label><span class="lNom"></span><input id="prNombre" type="text" maxlength="60" /></label>' +
    '<div class="botones"><button id="prBlanco" class="listo"></button><button id="prSobre"></button><button id="prCapa"></button></div>' +
    '<b class="lLista"></b><div id="prLista"></div>';
  document.body.appendChild(panel);
  panel.querySelector(".cab b").textContent = t("ed.pr_titulo");
  panel.querySelector(".cerrar").textContent = t("ed.cerrar");
  panel.querySelector(".ayuda").textContent = t("ed.pr_ayuda");
  panel.querySelector(".lNom").textContent = t("ed.pr_nombre");
  panel.querySelector(".lLista").textContent = t("ed.pr_lista");
  $("prNombre").placeholder = t("ed.pr_nombre_ph");
  $("prBlanco").textContent = t("ed.pr_blanco");
  $("prBlanco").title = t("ed.pr_blanco_t");
  $("prSobre").textContent = t("ed.pr_sobre");
  $("prSobre").title = t("ed.pr_sobre_t");
  $("prCapa").textContent = t("ed.pr_capa");
  $("prCapa").title = t("ed.pr_capa_t");
  $("prNombre").addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") crear(true, $("prNombre").value);
  });
  panel.querySelector(".cerrar").onclick = () => cerrar();
  $("prBlanco").onclick = () => crear(true, $("prNombre").value);
  $("prSobre").onclick = () => crear(false, $("prNombre").value);
  $("prCapa").onclick = () => (cerrar(), enCapa());
  const boton = (txt, fn, clase) => {
    const b = document.createElement("button");
    b.textContent = txt;
    if (clase) b.className = clase;
    b.onclick = fn;
    return b;
  };
  function pintar() {
    refrescar();
    const caja = $("prLista");
    caja.innerHTML = "";
    reg.lista
      .slice()
      .sort((a, b) => (a.id === reg.activo ? -1 : b.id === reg.activo ? 1 : b.cuando - a.cuando))
      .forEach((p) => {
        const b = datos(p.id),
          f = document.createElement("div");
        f.className = "prFila" + (p.id === reg.activo ? " abierto" : "");
        const txt = document.createElement("div");
        const nom = document.createElement("b");
        nom.textContent = nombreDe(p);
        const det = document.createElement("small");
        det.textContent = (p.lienzo ? t("ed.pr_tipo_blanco") : t("ed.pr_tipo_el")) + " · " + t("ed.pr_cuenta", [(b.poner || []).length, (b.caminos || []).length + (b.rios || []).length + (b.lagos || []).length, (b.capas || []).length]);
        txt.append(nom, det);
        const bs = document.createElement("div");
        bs.className = "prBotones";
        if (p.id === reg.activo) bs.append(Object.assign(document.createElement("span"), { textContent: t("ed.pr_abierto") }));
        else bs.append(boton(t("ed.pr_abrir"), () => abrir(p.id), "listo"));
        bs.append(boton(t("ed.pr_renombrar_b"), () => renombrar(p.id)), boton(t("ed.pr_duplicar"), () => duplicar(p.id)));
        if (p.id !== reg.activo) bs.append(boton(t("ed.pr_borrar"), () => borrar(p.id)));
        f.append(txt, bs);
        caja.appendChild(f);
      });
  }
  function abrirPanel(nuevo) {
    pintar();
    panel.classList.remove("oculto");
    if (nuevo) setTimeout(() => $("prNombre").focus(), 0);
  }
  function cerrar() {
    panel.classList.add("oculto");
  }
  refrescar();
  // en un mapa de cero, el botón dice el archivo que baja
  if (E.lienzo()) $("bDescargar").textContent = t("ed.pr_descargar", [E.archivoMapa()]);
  return { abrir: abrirPanel, cerrar, abierta: () => !panel.classList.contains("oculto"), crear, abrirProyecto: abrir, enCapa, lista: () => reg.lista, activo: () => reg.activo };
})();
