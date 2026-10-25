// ---------- las capas del editor (pestaña Capas, L) ----------
// Como en Photoshop: capas propias (las que arma Alejandro) con ojo, candado, nombre y cuántas cosas tienen, la activa
// (adonde va lo nuevo y lo pegado) y las capas del mundo (bosque, notas, zonas, regiones, mapa original), que prenden
// y apagan las casillas de siempre. Lo de las capas propias vive en editor.js (EDITOR.capas).
window.EDITOR_CAPAS = (function () {
  "use strict";
  const E = window.EDITOR,
    C = E.capas,
    t = E.t,
    $ = (id) => document.getElementById(id);
  // ---------- las pestañas del costado ----------
  let pestana = "objetos";
  try {
    if (localStorage.getItem("eromash-editor-pestana") === "capas") pestana = "capas";
  } catch (e) {}
  function verPestana(p) {
    pestana = p;
    $("pObjetos").classList.toggle("activa", p === "objetos");
    $("pCapas").classList.toggle("activa", p === "capas");
    $("ladoObjetos").classList.toggle("oculto", p !== "objetos");
    $("ladoCapas").classList.toggle("oculto", p !== "capas");
    try {
      localStorage.setItem("eromash-editor-pestana", p);
    } catch (e) {}
    if (p === "capas") pintar();
  }
  $("pObjetos").onclick = () => verPestana("objetos");
  $("pCapas").onclick = () => verPestana("capas");
  const alternar = () => verPestana(pestana === "capas" ? "objetos" : "capas");

  // ---------- las capas del mundo: cada una prende o apaga su casilla ----------
  const BASE = [
    ["verNotas", "ed.ver_notas"],
    ["verRegiones", "ed.ver_regiones"],
    ["verZonas", "ed.ver_zonas"],
    ["verBosque", "ed.cp_bosque", "bloquear"],
    ["original", "ed.cp_original"],
  ];
  function pintarBase() {
    const caja = $("cpBase");
    caja.innerHTML = "";
    BASE.forEach(([id, k, trabar]) => {
      const f = document.createElement("div");
      f.className = "cpFila" + ($(id).checked ? "" : " oculta");
      const ojo = boton($(id).checked ? "◉" : "◌", t("ed.cp_ver"), () => {
        $(id).checked = !$(id).checked;
        $(id).dispatchEvent(new Event("change"));
        pintarBase();
        E.pedir();
      });
      if (!$(id).checked) ojo.classList.add("apagado");
      const cand = trabar
        ? boton($(trabar).checked ? "🔒" : "🔓", t("ed.cp_trabar_base"), () => {
            $(trabar).checked = !$(trabar).checked;
            pintarBase();
          })
        : document.createElement("span");
      if (trabar && $(trabar).checked) cand.classList.add("on");
      else if (trabar) cand.classList.add("apagado");
      const nom = document.createElement("span");
      nom.className = "cpNom";
      nom.textContent = t(k);
      f.append(ojo, cand, nom, document.createElement("span"), document.createElement("span"));
      caja.appendChild(f);
    });
  }
  function boton(txt, titulo, fn) {
    const b = document.createElement("button");
    b.textContent = txt;
    b.title = titulo;
    b.setAttribute("aria-label", titulo);
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      fn();
    });
    return b;
  }

  // ---------- las capas propias ----------
  let abierta = null, // la capa con sus acciones a la vista
    renombrando = null;
  function filaCapa(c, n, activa, deEleg) {
    const id = c.id || "",
      f = document.createElement("div");
    f.className = "cpFila" + (id === activa ? " activa" : "") + (c.ver === false ? " oculta" : "") + (deEleg === id ? " conElegido" : "");
    const ojo = boton(c.ver === false ? "◌" : "◉", t("ed.cp_ver"), () => (C.cambiar(id, "ver", c.ver === false), E.pedir()));
    if (c.ver === false) ojo.classList.add("apagado");
    const cand = boton(c.lock ? "🔒" : "🔓", t("ed.cp_trabar"), () => C.cambiar(id, "lock", !c.lock));
    cand.classList.add(c.lock ? "on" : "apagado");
    let nom;
    if (renombrando === id && id) {
      nom = document.createElement("input");
      nom.value = c.nom;
      const listo = () => {
        renombrando = null;
        const v = nom.value.trim();
        if (v && v !== c.nom) C.cambiar(id, "nom", v);
        else pintar();
      };
      nom.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") nom.blur();
        if (e.key === "Escape") (nom.value = c.nom), nom.blur();
      });
      nom.addEventListener("blur", listo);
      setTimeout(() => (nom.focus(), nom.select()), 0);
    } else {
      // tocar el nombre la hace activa; tocarla otra vez muestra sus acciones
      nom = document.createElement("button");
      nom.className = "cpNom";
      nom.textContent = id ? c.nom : t("ed.cp_sueltos");
      nom.title = t("ed.cp_activar");
      nom.addEventListener("click", () => {
        if (id === activa) abierta = abierta === id ? null : id;
        else (abierta = null), C.activar(id);
        pintar();
      });
      if (id) nom.addEventListener("dblclick", () => ((renombrando = id), pintar()));
    }
    const cuantos = document.createElement("span");
    cuantos.className = "cpN";
    cuantos.textContent = n[id] || 0;
    const mas = boton(abierta === id ? "▴" : "▾", t("ed.cp_acciones"), () => ((abierta = abierta === id ? null : id), pintar()));
    f.append(ojo, cand, nom, cuantos, mas);
    const out = [f];
    if (abierta === id) {
      const acc = document.createElement("div");
      acc.className = "cpAcciones";
      const a = (k, fn) => acc.appendChild(boton(t(k), t(k), fn));
      a("ed.cp_elegir_todo", () => {
        const k = C.elegirTodo(id);
        E.avisar(k ? t("ed.cp_elegidos", [k]) : t("ed.cp_vacia"));
      });
      a("ed.cp_pasar_aca", () => {
        const k = C.pasar(id);
        E.avisar(k ? t("ed.cp_pasados", [k, id ? c.nom : t("ed.cp_sueltos")]) : t("ed.nada_elegido"));
      });
      if (id) {
        a("ed.cp_renombrar", () => ((renombrando = id), pintar()));
        a("ed.cp_subir", () => C.mover(id, -1));
        a("ed.cp_bajar", () => C.mover(id, 1));
        a("ed.cp_borrar", () => {
          if (!n[id]) return C.borrar(id, false);
          // con cosas adentro: borrar todo o dejarlo en sueltos
          if (confirm(t("ed.cp_borrar_todo", [c.nom, n[id]]))) C.borrar(id, true);
          else if (confirm(t("ed.cp_borrar_solo", [c.nom]))) C.borrar(id, false);
        });
      }
      out.push(acc);
    }
    return out;
  }
  function pintar() {
    const activa = C.activa(),
      lista = C.lista(),
      n = C.cuantos(),
      deEleg = C.deElegida();
    const ca = lista.find((c) => c.id === activa);
    $("pCapaActiva").textContent = "· " + (ca ? ca.nom : t("ed.cp_sueltos"));
    if (window.EDITOR_MENU) EDITOR_MENU.pintarDer();
    if (pestana !== "capas") return;
    const caja = $("cpLista");
    caja.innerHTML = "";
    lista.forEach((c) => filaCapa(c, n, activa, deEleg).forEach((el) => caja.appendChild(el)));
    filaCapa(Object.assign({ id: "" }, C.suelta()), n, activa, deEleg).forEach((el) => caja.appendChild(el));
    pintarBase();
  }
  $("cpNueva").onclick = () => {
    C.nueva();
    abierta = null;
    renombrando = C.activa();
    pintar();
  };
  ["verNotas", "verRegiones", "verZonas", "verBosque", "original", "bloquear"].forEach((id) => $(id).addEventListener("change", () => pestana === "capas" && pintarBase()));
  // L: la pestaña de capas; Ctrl+Shift+N: capa nueva
  function tecla(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl && (e.key === "l" || e.key === "L")) return alternar(), true;
    if (ctrl && e.shiftKey && (e.key === "n" || e.key === "N")) return verPestana("capas"), $("cpNueva").click(), true;
    return false;
  }
  verPestana(pestana);
  pintar();
  return { pintar, tecla, verPestana, alternar, nueva: () => (verPestana("capas"), $("cpNueva").click()) };
})();
