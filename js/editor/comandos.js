// ---------- la paleta de comandos del editor (Ctrl+K) ----------
// Como en VS Code o Figma: se escribe y aparece todo lo que se puede hacer: herramientas, acciones, objetos para poner
// y lugares a donde ir. Flechas para elegir, Enter para hacerlo, Esc para cerrar.
window.EDITOR_COMANDOS = (function () {
  "use strict";
  const E = window.EDITOR,
    t = E.t,
    $ = (id) => document.getElementById(id);
  const caja = $("comandos"),
    entrada = $("comBuscar"),
    ul = $("comLista");
  entrada.placeholder = t("ed.com_ph");
  let items = [],
    vistos = [],
    activo = 0;
  // todo lo que se puede buscar; se arma al abrir (los objetos y lugares pueden haber cambiado)
  function armar() {
    const herr = [
      ["poner", "ed.poner", "1"],
      ["mover", "ed.mover", "2"],
      ["borrar", "ed.borrar", "3"],
      ["camino", "ed.camino", "4"],
      ["nota", "ed.nota", "5"],
      ["agua", "ed.agua", "6"],
      ["medir", "ed.medir", "7"],
      ["region", "ed.region", "0"],
      ["pincel", "ed.pincel", "B"],
    ].map(([h, k, tecla]) => ({ nom: t(k), tipo: t("ed.com_herramienta"), tecla, hacer: () => E.ponerHerr(h) }));
    const acc = [
      ["deshacer", "ed.deshacer", "Ctrl+Z"],
      ["rehacer", "ed.rehacer", "Ctrl+Shift+Z"],
      ["copiar", "ed.com_copiar", "Ctrl+C"],
      ["pegar", "ed.com_pegar", "Ctrl+V"],
      ["duplicar", "ed.sel_duplicar", "Ctrl+D"],
      ["iguales", "ed.sel_iguales", ""],
      ["sacar", "ed.sel_sacar", "Supr"],
      ["revisar", "ed.revisar", ""],
      ["foco", "ed.com_foco", "Tab"],
      ["grilla", "ed.grilla", "G"],
      ["bosque", "ed.ver_bosque", "H"],
      ["bloquear", "ed.bloquear", ""],
      ["notas", "ed.ver_notas", ""],
      ["norte", "ed.norte", ""],
      ["probar", "ed.probar", "P"],
      ["borrador", "ed.borrador_guardar", ""],
      ["descargar", "ed.descargar", "Ctrl+S"],
      ["pieza", "ed.pieza_guardar", ""],
      ["exportar", "ed.exportar", ""],
      ["texturas", "ed.tx_titulo", "Y"],
      ["atajos", "ed.atajos_titulo", "?"],
    ].map(([a, k, tecla]) => ({ nom: t(k), tipo: t("ed.com_accion"), tecla, hacer: E.acciones[a] }));
    acc.push({ nom: t("ed.ia_titulo"), tipo: t("ed.com_accion"), tecla: "8", hacer: () => window.EDITOR_IA && EDITOR_IA.abrir() });
    acc.push({ nom: t("ed.bo_titulo"), tipo: t("ed.com_accion"), tecla: "U", hacer: () => window.EDITOR_BOCETO && EDITOR_BOCETO.abrir() });
    if (window.INTERIORES && INTERIORES.PLANTILLAS)
      INTERIORES.PLANTILLAS.forEach((p) => acc.push({ nom: t("ed.cu_titulo") + " · " + t("ed.cu_" + p), tipo: t("ed.com_accion"), tecla: "9", hacer: () => window.EDITOR_CUARTOS && EDITOR_CUARTOS.abrir(p) }));
    const obj = ASSETS.catalogo().map((a) => ({ nom: t("as." + a.id) === "as." + a.id ? a.id : t("as." + a.id), extra: a.id, tipo: t("ed.com_objeto"), tecla: "", hacer: () => E.elegir(a.id) }));
    const lug = E.lugares().map((l) => ({ nom: l.nom, tipo: t("ed.com_lugar"), tecla: "", hacer: () => E.ir(l.x, l.y) }));
    items = herr.concat(acc, lug, obj);
  }
  // sin nada escrito: primero lo que tiene sentido ahora (en el orden que se suele usar) y lo último que se eligió acá
  let recientes = [];
  try {
    recientes = JSON.parse(localStorage.getItem("eromash-editor-comandos") || "[]") || [];
  } catch (e) {}
  function alPrincipio() {
    const ahora = E.sugeridos().map((it) => Object.assign(it, { tipo: t("ed.com_ahora") })),
      vistosN = new Set(ahora.map((it) => it.nom)),
      ult = recientes
        .map((n) => items.find((it) => it.nom === n))
        .filter((it) => it && !vistosN.has(it.nom))
        .map((it) => Object.assign({}, it, { tipo: t("ed.com_reciente") }));
    return ahora.concat(ult);
  }
  // sin tildes ni mayúsculas, y cada palabra buscada tiene que estar
  const llano = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  function filtrar() {
    const q = llano(entrada.value.trim()).split(/\s+/).filter(Boolean);
    vistos = items.filter((it) => {
      const s = llano(it.nom + " " + (it.extra || "") + " " + it.tipo);
      return q.every((w) => s.includes(w));
    });
    // primero lo que empieza con lo escrito
    if (q.length) vistos.sort((a, b) => (llano(b.nom).startsWith(q[0]) ? 1 : 0) - (llano(a.nom).startsWith(q[0]) ? 1 : 0));
    else {
      const arriba = alPrincipio(),
        ya = new Set(arriba.map((it) => it.nom));
      vistos = arriba.concat(vistos.filter((it) => !ya.has(it.nom)));
    }
    vistos = vistos.slice(0, 60);
    activo = 0;
    pintar();
  }
  function pintar() {
    ul.innerHTML = "";
    vistos.forEach((it, i) => {
      const li = document.createElement("li");
      li.className = i === activo ? "activo" : "";
      const a = document.createElement("span"),
        b = document.createElement("small");
      a.textContent = it.nom;
      b.textContent = it.tipo + (it.tecla ? " · " + it.tecla : "");
      li.append(a, b);
      li.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        hacer(i);
      });
      ul.appendChild(li);
    });
    const li = ul.children[activo];
    if (li) li.scrollIntoView({ block: "nearest" });
  }
  function hacer(i) {
    const it = vistos[i];
    cerrar();
    if (it && it.tipo !== t("ed.com_ahora")) {
      recientes = [it.nom].concat(recientes.filter((n) => n !== it.nom)).slice(0, 5);
      try {
        localStorage.setItem("eromash-editor-comandos", JSON.stringify(recientes));
      } catch (e) {}
    }
    if (it && it.hacer) it.hacer();
  }
  function abrir() {
    armar();
    entrada.value = "";
    caja.classList.remove("oculto");
    filtrar();
    setTimeout(() => entrada.focus(), 0);
  }
  function cerrar() {
    caja.classList.add("oculto");
    document.getElementById("mapa").focus();
  }
  entrada.addEventListener("input", filtrar);
  entrada.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") return cerrar();
    if (e.key === "ArrowDown") (activo = Math.min(vistos.length - 1, activo + 1)), pintar(), e.preventDefault();
    if (e.key === "ArrowUp") (activo = Math.max(0, activo - 1)), pintar(), e.preventDefault();
    if (e.key === "Enter") hacer(activo);
  });
  entrada.addEventListener("blur", () => setTimeout(cerrar, 120));
  return { abrir, cerrar, abierta: () => !caja.classList.contains("oculto") };
})();
