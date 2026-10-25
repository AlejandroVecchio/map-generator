// ---------- la barra de menús del editor (Archivo, Editar, Ver, Herramientas, Crear, Mundo, IA, Ayuda) ----------
// Como en cualquier programa: todo lo que ya existe tiene su lugar, con su tecla al lado para aprenderla mirando.
// Se abre con clic o toque (con uno abierto, pasar a otro lo abre), con F10 desde el teclado; flechas, Enter y Esc
// adentro. Cada entrada llama a lo mismo que su botón o su tecla: no hay lógica nueva acá.
window.EDITOR_MENU = (function () {
  "use strict";
  const E = window.EDITOR,
    A = E.acciones,
    t = E.t,
    $ = (id) => document.getElementById(id);
  const clic = (id) => () => $(id) && $(id).click();
  const foco = (id) => () => {
    if (window.EDITOR_CAPAS && ["verHistoria", "camara"].includes(id)) EDITOR_CAPAS.verPestana("capas");
    if (["ir", "buscar", "planoNombre"].includes(id) && window.EDITOR_CAPAS) EDITOR_CAPAS.verPestana("objetos");
    setTimeout(() => $(id) && ($(id).focus(), $(id).scrollIntoView({ block: "nearest" })), 0);
  };
  const ia = (fn) => () => {
    if (window.EDITOR_IA && !EDITOR_IA.abierta()) EDITOR_IA.abrir();
    if (fn) setTimeout(fn, 0);
  };
  // las opciones de un <select> escondido, como submenú (borradores, piezas, misiones de la historia)
  const deSelect = (id, sinPrimera) => () =>
    [...$(id).options].slice(sinPrimera ? 1 : 0).map((o) => ({
      nom: o.textContent,
      marca: () => $(id).value === o.value && !!o.value,
      hacer: () => {
        $(id).value = o.value;
        $(id).dispatchEvent(new Event("change"));
      },
    }));
  const capas = () =>
    E.capas
      .lista()
      .map((c) => ({ id: c.id, nom: c.nom }))
      .concat([{ id: "", nom: t("ed.cp_sueltos") }]);
  // [clave de texto, tecla, qué hace | { sub }, marca?]; "-" separa
  const MENUS = [
    ["ed.mn_archivo", [
      ["ed.pr_menu_nuevo", "", () => window.EDITOR_PROYECTOS && EDITOR_PROYECTOS.abrir(true)],
      ["ed.pr_menu", "", () => window.EDITOR_PROYECTOS && EDITOR_PROYECTOS.abrir()],
      ["ed.pr_menu_abrir", "", { sub: () => (window.EDITOR_PROYECTOS ? EDITOR_PROYECTOS.lista().map((p) => ({ nom: (p.nombre || t(p.lienzo ? "ed.pr_sin_nombre" : "ed.pr_eldervald")) + (p.lienzo ? " · " + t("ed.pr_tipo_blanco") : ""), hacer: () => EDITOR_PROYECTOS.abrirProyecto(p.id), marca: () => p.id === EDITOR_PROYECTOS.activo() })) : []) }],
      ["ed.pr_capa", "", () => window.EDITOR_PROYECTOS && EDITOR_PROYECTOS.enCapa()],
      "-",
      ["ed.limpiar", "", clic("bLimpiar")],
      ["ed.cargar", "", clic("bCargar")],
      ["ed.mn_borradores", "", { sub: () => [{ nom: t("ed.borrador_guardar"), hacer: clic("bBorrador") }, "-"].concat(deSelect("borradores", true)()) }],
      "-",
      ["ed.descargar", "Ctrl+S", clic("bDescargar")],
      ["ed.gh_menu", "", () => window.EDITOR_GITHUB && EDITOR_GITHUB.abrir()],
      ["ed.exportar", "", clic("bExportar")],
      ["ed.copiar", "", clic("bCopiar")],
      "-",
      ["ed.im_titulo", "N", clic("hNpc")],
      ["ed.bo_titulo", "U", clic("hBoceto")],
      "-",
      ["ed.probar", "P", clic("bProbar")],
      ["ed.mn_probar_en", "", foco("probarMision")],
    ]],
    ["ed.mn_editar", [
      ["ed.deshacer", "Ctrl+Z", A.deshacer],
      ["ed.rehacer", "Ctrl+Y", A.rehacer],
      "-",
      ["ed.com_copiar", "Ctrl+C", A.copiar],
      ["ed.mn_pegar", "Ctrl+V", A.pegar],
      ["ed.sel_duplicar", "Ctrl+D", A.duplicar],
      ["ed.sel_sacar", "Supr", A.sacar],
      "-",
      ["ed.sel_iguales", "", A.iguales],
      ["ed.mn_elegir_capa", "", () => {
        const n = E.capas.elegirTodo(E.capas.activa());
        E.avisar(n ? t("ed.cp_elegidos", [n]) : t("ed.cp_vacia"));
      }],
      ["ed.sel_soltar", "Esc", A.soltar],
      "-",
      ["ed.mn_girar", "Q · E", null],
      ["ed.mn_vuelta", "F", A.vuelta],
      ["ed.mn_orden", "", { sub: () => [{ nom: t("ed.mn_adelante"), hacer: clic("selAdelante") }, { nom: t("ed.mn_atras"), hacer: clic("selAtras") }] }],
      ["ed.sel_agregar", "", clic("selAgregar")],
      ["ed.mn_cortar", "", clic("camCortar")],
      ["ed.mn_pasar", "", { sub: () => capas().map((c) => ({ nom: c.nom, marca: () => E.capas.deElegida() === c.id, hacer: () => {
        const n = E.capas.pasar(c.id);
        E.avisar(n ? t("ed.cp_pasados", [n, c.nom]) : t("ed.nada_elegido"));
      } })) }],
      "-",
      ["ed.pieza_guardar", "", clic("bPieza")],
    ]],
    ["ed.mn_ver", [
      ["ed.mn_acercar", "+", A.acercar],
      ["ed.mn_alejar", "−", A.alejar],
      ["ed.mn_girar_izq", "Z", () => E.girarCamara(-15)],
      ["ed.mn_girar_der", "X", () => E.girarCamara(15)],
      ["ed.norte", "", A.norte],
      "-",
      ["ed.cp_titulo", "L", () => window.EDITOR_CAPAS && EDITOR_CAPAS.alternar(), () => !$("ladoCapas").classList.contains("oculto")],
      ["ed.mn_grilla", "G", A.grilla, () => $("grilla").checked],
      ["ed.choques", "", A.choques, () => $("choques").checked],
      ["ed.mn_nombres", "", A.nombres, () => $("historia").checked],
      ["ed.mn_bosque", "H", A.bosque, () => $("verBosque").checked],
      ["ed.ver_notas", "", A.notas, () => $("verNotas").checked],
      ["ed.original", "", () => ($("original").checked = !$("original").checked, $("original").dispatchEvent(new Event("change"))), () => $("original").checked],
      "-",
      ["ed.mn_ir", "", foco("ir")],
      ["ed.mn_buscar", "", foco("buscar")],
      ["ed.com_foco", "Tab", A.foco],
    ]],
    ["ed.mn_herramientas", [
      ["ed.poner", "1", () => E.ponerHerr("poner"), () => E.herr() === "poner"],
      ["ed.mover", "2", () => E.ponerHerr("mover"), () => E.herr() === "mover"],
      ["ed.borrar", "3", () => E.ponerHerr("borrar"), () => E.herr() === "borrar"],
      ["ed.camino", "4", () => E.ponerHerr("camino"), () => E.herr() === "camino"],
      ["ed.nota", "5", () => E.ponerHerr("nota"), () => E.herr() === "nota"],
      ["ed.agua", "6", () => E.ponerHerr("agua"), () => E.herr() === "agua"],
      ["ed.medir", "7", () => E.ponerHerr("medir"), () => E.herr() === "medir"],
      ["ed.region", "0", () => E.ponerHerr("region"), () => E.herr() === "region"],
      ["ed.pincel", "B", () => E.ponerHerr("pincel"), () => E.herr() === "pincel"],
      "-",
      ["ed.mn_variar", "V", A.variar, () => $("variar").checked],
    ]],
    ["ed.mn_crear", [
      ["ed.cp_nueva_larga", "Ctrl+Shift+N", () => window.EDITOR_CAPAS && EDITOR_CAPAS.nueva()],
      "-",
      ["ed.cu_titulo", "9", clic("hInteriores")],
      ["ed.zn_titulo", "M", clic("hZonas")],
      ["ed.tx_titulo", "Y", clic("hTexturas")],
      ["ed.im_titulo", "N", clic("hNpc")],
      ["ed.mn_piezas", "", { sub: deSelect("piezas", true) }],
      "-",
      ["ed.bo_titulo", "U", clic("hBoceto")],
    ]],
    ["ed.mn_mundo", [
      ["ed.revisar", "", A.revisar],
      ["ed.mn_historia", "", { sub: deSelect("verHistoria") }],
      ["ed.mn_regiones", "0", () => E.ponerHerr("region")],
      "-",
      ["ed.mn_nombre", "", foco("planoNombre")],
      ["ed.mn_plano_dup", "", clic("planoDup")],
      ["ed.mn_plano_copiar", "", clic("planoCopiar")],
      ["ed.mn_plano_pegar", "", clic("planoPegar")],
    ]],
    ["ed.mn_ia", [
      ["ed.ia_titulo", "8", ia()],
      ["ed.mn_ia_todas", "", ia(() => window.EDITOR_IA && EDITOR_IA.todasFoco && EDITOR_IA.todasFoco())],
      "-",
      ["ed.mn_ia_zona", "", clic("hZonas")],
      ["ed.mn_ia_casa", "", clic("hInteriores")],
      ["ed.mn_ia_textura", "", clic("hTexturas")],
      ["ed.mn_ia_boceto", "", clic("hBoceto")],
      "-",
      ["ed.mn_ia_claves", "", ia(() => (($("iaTus").open = true), ($("iaCada").open = true)))],
    ]],
    ["ed.mn_ayuda", [
      ["ed.atajos_titulo", "?", A.atajos],
      ["ed.mn_paleta", "Ctrl+K", clic("hComandos")],
      ["ed.mn_leyenda", "", clic("hBoceto")],
      ["ed.mn_formato", "", () => window.open("https://github.com/alejandrovecchio/eromash-aventura-web/blob/main/docs/formato-mundo.md", "_blank", "noopener")],
    ]],
  ];

  // ---------- la barra ----------
  const bar = $("menubar");
  bar.setAttribute("aria-label", t("ed.mn_barra"));
  const marca = document.createElement("span");
  marca.className = "marca";
  marca.innerHTML = "<i></i>";
  marca.append(document.createTextNode("Eldervald"));
  bar.appendChild(marca);
  const tops = MENUS.map(([k], i) => {
    const b = document.createElement("button");
    b.className = "m";
    b.textContent = t(k);
    b.setAttribute("aria-haspopup", "menu");
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      abierto === i ? cerrar() : abrir(i);
    });
    // con un menú abierto, pasar a otro lo abre (como en todo programa; abrir siempre es con clic o toque)
    b.addEventListener("pointerenter", () => abierto !== null && abierto !== i && abrir(i));
    b.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") && (e.preventDefault(), abrir(i, true)));
    bar.appendChild(b);
    return b;
  });
  const der = document.createElement("span");
  der.className = "der";
  bar.appendChild(der);
  // a la derecha: el nombre del plano y la capa activa
  function pintarDer() {
    const c = E.capas.lista().find((q) => q.id === E.capas.activa());
    der.textContent = ($("planoNombre").value ? $("planoNombre").value + " · " : "") + (E.lienzo() ? t("ed.pr_tipo_blanco") + " · " : "") + t("ed.cp_capa") + ": " + (c ? c.nom : t("ed.cp_sueltos"));
  }

  // ---------- los desplegables ----------
  let abierto = null,
    pilas = []; // [{ caja, items, activo }] el menú y sus submenús abiertos
  function cerrar() {
    pilas.forEach((p) => p.caja.remove());
    pilas = [];
    tops.forEach((b) => b.classList.remove("abierto"));
    abierto = null;
  }
  function cerrarDesde(n) {
    while (pilas.length > n) pilas.pop().caja.remove();
  }
  const resolver = (it) => {
    if (it === "-") return it;
    if (!Array.isArray(it)) return it; // de un submenú: { nom, hacer, marca }
    const [k, tecla, que, marcaF] = it;
    return { nom: t(k), tecla, hacer: typeof que === "function" ? que : null, sub: que && que.sub, marca: marcaF, quieto: que === null };
  };
  function lista(items, x, y) {
    const caja = document.createElement("div");
    caja.className = "desp";
    caja.setAttribute("role", "menu");
    const nivel = pilas.length,
      p = { caja, items: [], activo: -1 };
    items.map(resolver).forEach((it) => {
      if (it === "-") {
        const s = document.createElement("div");
        s.className = "sep";
        return caja.appendChild(s);
      }
      const b = document.createElement("button");
      b.className = "it" + (it.sub ? " sub" : "");
      b.setAttribute("role", "menuitem");
      const ico = document.createElement("span");
      ico.className = "ico";
      ico.textContent = it.marca && it.marca() ? "✓" : "";
      const nom = document.createElement("span");
      nom.textContent = it.nom;
      const kbd = document.createElement("kbd");
      kbd.textContent = it.tecla || "";
      b.append(ico, nom, kbd);
      if (it.quieto) b.disabled = true;
      const idx = p.items.length;
      p.items.push({ b, it });
      b.addEventListener("pointerenter", () => marcar(p, idx, nivel));
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        usar(p, idx, nivel);
      });
      caja.appendChild(b);
    });
    document.body.appendChild(caja);
    // que no se salga de la pantalla
    const r = caja.getBoundingClientRect();
    caja.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + "px";
    caja.style.top = Math.max(38, Math.min(y, innerHeight - r.height - 4)) + "px";
    pilas.push(p);
    return p;
  }
  function marcar(p, i, nivel) {
    p.activo = i;
    p.items.forEach((q, k) => q.b.classList.toggle("activo", k === i));
    cerrarDesde(nivel + 1);
  }
  function usar(p, i, nivel) {
    const { it, b } = p.items[i];
    if (it.quieto) return;
    if (it.sub) {
      cerrarDesde(nivel + 1);
      const subs = it.sub();
      if (!subs.length) return;
      const r = b.getBoundingClientRect(),
        q = lista(subs, r.right - 2, r.top - 4);
      q.desde = b;
      return q;
    }
    cerrar();
    if (it.hacer) it.hacer();
    pintarDer();
    E.pedir();
  }
  function abrir(i, conTeclado) {
    cerrar();
    abierto = i;
    tops[i].classList.add("abierto");
    pintarDer();
    const r = tops[i].getBoundingClientRect(),
      p = lista(MENUS[i][1], r.left, r.bottom);
    if (conTeclado) marcar(p, 0, 0);
  }
  // fuera de los menús, un toque los cierra
  document.addEventListener("pointerdown", (e) => abierto !== null && !e.target.closest(".desp") && !e.target.closest("#menubar") && cerrar(), true);
  // teclado: F10 abre; con un menú abierto las flechas, Enter y Esc son del menú (no llegan al mapa)
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "F10") return e.preventDefault(), e.stopPropagation(), abierto === null ? abrir(0, true) : cerrar();
      if (abierto === null) return;
      e.stopPropagation();
      const p = pilas[pilas.length - 1],
        nivel = pilas.length - 1,
        n = p.items.length;
      const mover = (d) => {
        let i = p.activo;
        for (let k = 0; k < n; k++) {
          i = (i + d + n) % n;
          if (!p.items[i].it.quieto) break;
        }
        marcar(p, i, nivel);
      };
      if (e.key === "Escape") {
        e.preventDefault();
        if (pilas.length > 1) return cerrarDesde(pilas.length - 1);
        const i = abierto;
        cerrar();
        return tops[i].focus();
      }
      if (e.key === "ArrowDown") return e.preventDefault(), mover(1);
      if (e.key === "ArrowUp") return e.preventDefault(), mover(-1);
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (p.activo >= 0 && p.items[p.activo].it.sub) {
          const q = usar(p, p.activo, nivel);
          if (q) marcar(q, 0, nivel + 1);
          return;
        }
        return abrir((abierto + 1) % MENUS.length, true);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (pilas.length > 1) return cerrarDesde(pilas.length - 1);
        return abrir((abierto - 1 + MENUS.length) % MENUS.length, true);
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (p.activo < 0) return;
        const q = usar(p, p.activo, nivel);
        if (q) marcar(q, 0, nivel + 1);
      }
    },
    true,
  );
  $("planoNombre").addEventListener("input", pintarDer);
  pintarDer();
  return { abrir, cerrar, abierto: () => abierto !== null, pintarDer, MENUS };
})();
