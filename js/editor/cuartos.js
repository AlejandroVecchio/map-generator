// ---------- editar los interiores (tecla 9 o «Editar su interior» con una casa elegida) ----------
// Cada cuarto se edita como plantilla: las cinco casas de la gente, la Casa de las Lindes, la herrería, Sanación, el
// Hongo Dorado y las seis clases de sótano. Se ve como en el juego (1600 × 900, de frente) y se arrastran los muebles
// y la gente, se cambian de tamaño, se dan vuelta, se sacan o se ponen nuevos de la lista; también la pared, la
// ventana, el estandarte y la repisa. Todo va a AGREGADOS.cuartos (el mismo agregados.js, con Deshacer y borradores)
// y interiores.js lo aplica al armar cada cuarto.
window.EDITOR_CUARTOS = (function () {
  "use strict";
  const E = window.EDITOR,
    t = E.t,
    I = window.INTERIORES,
    $ = (id) => document.getElementById(id);
  if (!I || !I.vista) return { abrir() {}, abierta: () => false, tecla() {}, alternar() {} };
  const RW = I.RW,
    RH = I.RH,
    FONDO = I.FONDO;
  const caja = $("cuartos"),
    cv = $("cuartoLienzo"),
    c = cv.getContext("2d");
  let pl = "casa_0",
    cuarto = null,
    firma = "",
    elegido = null, // { clave } de un mueble o { gente: id }
    poniendo = null, // id del mueble que se pone con el próximo clic
    arrastre = null,
    luz = true,
    giro = 0, // la vista del cuarto gira con Z y X (todo girable); se acerca a giroMeta de a poco
    giroMeta = 0,
    k = 1,
    ox = 0,
    oy = 0;
  const nombre = (id) => (t("as." + id) === "as." + id ? id : t("as." + id));
  const cf = () => (E.est().cuartos || {})[pl];
  // cambiar lo guardado (con Deshacer): fn recibe la plantilla, creada si hace falta
  function cambiar(fn) {
    E.cambiar((est) => {
      est.cuartos = est.cuartos || {};
      const p = (est.cuartos[pl] = est.cuartos[pl] || { cambios: {}, poner: [] });
      p.cambios = p.cambios || {};
      p.poner = p.poner || [];
      fn(p);
      if (!Object.keys(p.cambios).length && !p.poner.length && ["pared", "ventana", "estandarte", "repisa", "nombre"].every((x) => p[x] === undefined)) delete est.cuartos[pl];
    });
    firma = "";
  }
  function armar() {
    const f = pl + JSON.stringify(cf() || null) + JSON.stringify(E.est().casas || {});
    if (f === firma && cuarto) return;
    firma = f;
    cuarto = I.vista(pl, E.est().cuartos || {}, E.est().casas || {});
    llenarPlantillas();
    pintarPanel();
  }

  // ---------- el panel ----------
  $("cuPared").innerHTML = I.PAREDES.map((p) => `<option value="${p}">${t("ed.cu_pared_" + p)}</option>`).join("");
  $("cuPlantilla").addEventListener("change", () => elegirPlantilla($("cuPlantilla").value));
  $("cuPared").addEventListener("change", () => cambiar((p) => (p.pared = $("cuPared").value)));
  $("cuVentana").addEventListener("change", () => cambiar((p) => (p.ventana = +$("cuVentana").value)));
  $("cuEstandarte").addEventListener("change", () => cambiar((p) => (p.estandarte = +$("cuEstandarte").value || null)));
  $("cuRepisa").addEventListener("change", () => cambiar((p) => (p.repisa = $("cuRepisa").checked)));
  $("cuLuz").addEventListener("change", () => (luz = $("cuLuz").checked));
  $("cuCerrar").onclick = () => cerrar();
  $("cuProbar").onclick = () => {
    const lang = new URLSearchParams(location.search).get("lang");
    open("index.html?borrador=1&jugar=9&cuarto=" + pl + (window.EDITOR_HISTORIA ? EDITOR_HISTORIA.consulta() : "") + (lang ? "&lang=" + lang : ""), "_blank");
  };
  $("cuComoEra").onclick = () => {
    if (cf() && confirm(t("ed.cu_como_era_seguro"))) cambiar((p) => Object.keys(p).forEach((x) => delete p[x]));
  };
  $("cuSelEsc").addEventListener("input", () => escalar(+$("cuSelEsc").value, true));
  $("cuSelEsc").addEventListener("change", () => escalar(+$("cuSelEsc").value));
  $("cuSelEsp").onclick = () => darVuelta();
  $("cuSelSacar").onclick = () => sacar();
  $("cuSelComo").onclick = () => comoEra();
  function pintarPanel() {
    if (!cuarto) return;
    $("cuPlantilla").value = pl;
    pintarCabeza();
    const sot = pl.startsWith("sot_") || cuarto.pared === "sotano";
    $("cuPared").value = cuarto.pared;
    // los sótanos tienen su propia piedra y sus vigas: sin pared, ventana ni estandarte para elegir
    document.querySelectorAll("#cuartos .soloCuarto").forEach((f) => f.classList.toggle("oculto", sot));
    $("cuVentana").value = cuarto.ventana || 0;
    $("cuEstandarte").value = cuarto.estandarte || 0;
    $("cuRepisa").checked = !!cuarto.repisa;
    const n = cf() ? Object.keys(cf().cambios || {}).length + (cf().poner || []).length : 0;
    $("cuCuenta").textContent = t("ed.cu_cuenta", [n]);
    const q = actual();
    $("cuSel").classList.toggle("oculto", !q);
    if (!q) return;
    $("cuSelNombre").textContent = q.gente ? t("av.nombre_" + q.n.id) : nombre(q.m.id);
    $("cuSelTipo").textContent = q.gente ? t("ed.cu_persona") : q.m.puesto ? t("ed.cu_puesto") : q.m.fn ? t("ed.cu_hace", [t(q.m.accion)]) : t("ed.cu_adorno");
    $("cuSelEsc").disabled = !!q.gente;
    $("cuSelEsc").value = q.gente ? 1 : q.m.o.s || 1;
    $("cuSelEscV").textContent = (+$("cuSelEsc").value).toFixed(2);
    $("cuSelEsp").disabled = !!q.gente;
    $("cuSelComo").disabled = !!(q.m && q.m.puesto);
  }
  // la lista de muebles para poner (los de la pestaña interiores del catálogo)
  function armarLista() {
    const l = $("cuLista");
    l.innerHTML = "";
    ASSETS.catalogo()
      .filter((a) => a.grupo === "interiores")
      .forEach((a) => {
        const b = document.createElement("button");
        b.className = "obj";
        b.dataset.id = a.id;
        const m = document.createElement("canvas");
        m.width = 140;
        m.height = 90;
        const g = m.getContext("2d"),
          kk = Math.min(80 / (a.alto || 200), 0.45);
        g.translate(70, 84);
        g.scale(kk, kk);
        try {
          ASSETS.dibujar(g, a.id, 0, 0, 0, Object.assign({ s: 1 }, a.ejemplo));
        } catch (e) {}
        const s = document.createElement("span");
        s.textContent = nombre(a.id);
        b.append(m, s);
        b.onclick = () => {
          poniendo = poniendo === a.id ? null : a.id;
          l.querySelectorAll(".obj").forEach((x) => x.classList.toggle("elegido", x.dataset.id === poniendo));
          if (poniendo) E.avisar(t("ed.cu_poner_aviso", [nombre(a.id)]));
        };
        l.appendChild(b);
      });
  }

  // ---------- elegir, mover, poner ----------
  function actual() {
    if (!elegido || !cuarto) return null;
    if (elegido.gente) {
      const n = cuarto.gente.find((g) => g.id === elegido.gente);
      return n ? { gente: true, n } : null;
    }
    const m = cuarto.muebles.find((q) => q.clave === elegido.clave);
    return m ? { m } : null;
  }
  const alto = (q) => (ASSETS.LISTA[q.id] ? ASSETS.LISTA[q.id].alto : 200) * (q.o.s || 1);
  const ancho = (q) => Math.max(50, q.r || alto(q) * 0.4);
  // (x, y) en la vista (girada o no): lo que está ahí, lo de más adelante primero
  function tocado(x, y) {
    let mejor = null;
    cuarto.gente.forEach((n) => {
      const [vx, vy, kk] = I.aVista(n.x, n.y);
      if (Math.abs(x - vx) < 60 * kk && y > vy - 190 * kk && y < vy + 15 * kk && (!mejor || vy > mejor.y)) mejor = { gente: n.id, y: vy };
    });
    cuarto.muebles.forEach((q) => {
      const [vx, vy, kk] = I.aVista(q.x, q.y);
      if (Math.abs(x - vx) > ancho(q) * kk || y > vy + 30 * kk || y < vy - alto(q) * kk) return;
      const yy = q.piso ? vy - 2000 : vy;
      if (!mejor || yy > mejor.y) mejor = { clave: q.clave, y: yy };
    });
    return mejor;
  }
  // el puntero en la vista, y en el piso del cuarto
  const enVista = (e) => {
    const r = cv.getBoundingClientRect(),
      px = (e.clientX - r.left) * (cv.width / r.width),
      py = (e.clientY - r.top) * (cv.height / r.height);
    return [(px - ox) / k, (py - oy) / k];
  };
  const enCuarto = (e) => I.deVista(...enVista(e));
  const piso = (y) => Math.max(FONDO + 4, Math.min(RH - 10, y));
  cv.addEventListener("pointerdown", (e) => {
    if (!cuarto) return;
    const [x, y] = enCuarto(e);
    if (poniendo) {
      const id = poniendo,
        r = Math.round(ancho({ id, o: { s: 1 } }));
      cambiar((p) => p.poner.push({ id, x: Math.round(x), y: Math.round(piso(y)), o: { s: 1 }, r }));
      armar();
      elegido = { clave: "+" + ((cf().poner || []).length - 1) };
      if (!e.shiftKey) {
        poniendo = null;
        $("cuLista").querySelectorAll(".obj").forEach((x) => x.classList.remove("elegido"));
      }
      return pintarPanel();
    }
    const h = tocado(...enVista(e));
    elegido = h ? (h.gente ? { gente: h.gente } : { clave: h.clave }) : null;
    pintarPanel();
    const q = actual();
    if (!q) return;
    const o = q.gente ? q.n : q.m;
    arrastre = { dx: x - o.x, dy: y - o.y, x0: o.x, y0: o.y, o };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener("pointermove", (e) => {
    if (!cuarto) return;
    const [x, y] = enCuarto(e);
    if (arrastre) {
      // mientras se arrastra se mueve en la vista; al soltar se guarda (un paso de Deshacer)
      arrastre.o.x = Math.round(Math.max(40, Math.min(RW - 40, x - arrastre.dx)));
      arrastre.o.y = Math.round(piso(y - arrastre.dy));
    } else cv.style.cursor = poniendo ? "copy" : tocado(...enVista(e)) ? "grab" : "default";
  });
  cv.addEventListener("pointerup", () => {
    if (!arrastre) return;
    const a = arrastre;
    arrastre = null;
    if (a.o.x === a.x0 && a.o.y === a.y0) return;
    guardarCambio({ x: a.o.x, y: a.o.y });
  });
  // guardar un cambio del elegido: en lo puesto con el editor se cambia el mueble, en lo del código su «cambio»
  function guardarCambio(v) {
    const q = actual();
    if (!q) return;
    cambiar((p) => {
      if (q.m && q.m.puesto) {
        const a = p.poner[+q.m.clave.slice(1)];
        if (!a) return;
        if (v.x !== undefined) (a.x = v.x), (a.y = v.y);
        if (v.s !== undefined) (a.o.s = v.s), (a.r = Math.round(ancho({ id: a.id, o: { s: v.s } })));
        if (v.esp !== undefined) a.o.esp = v.esp;
        return;
      }
      const kk = q.gente ? "gente:" + q.n.id : q.m.clave;
      p.cambios[kk] = Object.assign(p.cambios[kk] || {}, v);
    });
  }
  function escalar(s, vivo) {
    const q = actual();
    if (!q || q.gente) return;
    $("cuSelEscV").textContent = s.toFixed(2);
    if (vivo) return (q.m.o.s = s);
    guardarCambio({ s: Math.round(s * 100) / 100 });
  }
  function darVuelta() {
    const q = actual();
    if (q && !q.gente) guardarCambio({ esp: !q.m.o.esp });
  }
  function sacar() {
    const q = actual();
    if (!q) return;
    if (q.m && q.m.puesto) cambiar((p) => p.poner.splice(+q.m.clave.slice(1), 1));
    else guardarCambio({ quitar: true });
    elegido = null;
    pintarPanel();
  }
  function comoEra() {
    const q = actual();
    if (!q || (q.m && q.m.puesto)) return;
    cambiar((p) => delete p.cambios[q.gente ? "gente:" + q.n.id : q.m.clave]);
  }
  function mover(dx, dy) {
    const q = actual();
    if (!q) return;
    const o = q.gente ? q.n : q.m;
    guardarCambio({ x: o.x + dx, y: piso(o.y + dy) });
  }
  function tecla(e) {
    const kk = e.key;
    if (e.target.tagName === "SELECT" || (e.target.tagName === "INPUT" && e.target.type === "number")) return;
    if (kk === "Escape") {
      e.preventDefault();
      if (poniendo || elegido) {
        poniendo = null;
        elegido = null;
        $("cuLista").querySelectorAll(".obj").forEach((x) => x.classList.remove("elegido"));
        return pintarPanel();
      }
      return cerrar();
    }
    if (kk === "Delete" || kk === "Backspace") return e.preventDefault(), sacar();
    if (kk === "f" || kk === "F") return darVuelta();
    if (kk === "l" || kk === "L") return ($("cuLuz").checked = luz = !luz);
    if (kk === "9") return cerrar();
    // Z y X giran la vista del cuarto de a 30°, como en el mapa; dos vueltas completas vuelven a cero
    if (!e.ctrlKey && !e.metaKey && (kk === "z" || kk === "Z" || kk === "x" || kk === "X")) {
      giroMeta += ((kk.toLowerCase() === "z" ? -1 : 1) * Math.PI) / 6;
      if (Math.abs(Math.sin(giroMeta)) < 1e-6 && Math.cos(giroMeta) > 0) (giroMeta = 0), (giro = Math.atan2(Math.sin(giro), Math.cos(giro)));
      return;
    }
    const paso = e.shiftKey ? 40 : 8,
      fl = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[kk];
    if (fl && actual()) return e.preventDefault(), mover(...fl);
    if ((kk === "+" || kk === "-") && actual() && !actual().gente) {
      const q = actual().m;
      escalar(Math.max(0.3, Math.min(2.5, (q.o.s || 1) + (kk === "+" ? 0.05 : -0.05))));
    }
  }

  // ---------- dibujar ----------
  function marco(q, col) {
    const [vx, vy, kk] = I.aVista(q.x, q.y),
      a = alto(q) * kk,
      w = ancho(q) * kk;
    c.save();
    c.strokeStyle = col;
    c.lineWidth = 3;
    c.setLineDash([12, 8]);
    c.strokeRect(vx - w, vy - a, w * 2, a + 24 * kk);
    c.restore();
  }
  function cuadro(ts) {
    if (!abierta()) return;
    requestAnimationFrame(cuadro);
    armar();
    if (giro !== giroMeta) giro = Math.abs(giroMeta - giro) < 0.003 ? giroMeta : giro + (giroMeta - giro) * 0.25;
    I.ponerGiro(giro);
    const r = cv.getBoundingClientRect();
    if (cv.width !== Math.round(r.width) || cv.height !== Math.round(r.height)) (cv.width = Math.round(r.width)), (cv.height = Math.round(r.height));
    k = Math.min(cv.width / RW, cv.height / RH);
    ox = (cv.width - RW * k) / 2;
    oy = (cv.height - RH * k) / 2;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#0A0606";
    c.fillRect(0, 0, cv.width, cv.height);
    c.setTransform(k, 0, 0, k, ox, oy);
    c.save();
    c.beginPath();
    c.rect(0, 0, RW, RH);
    c.clip();
    try {
      I.dibujarVista(c, cuarto, ts / 1000, luz, giro);
    } catch (e) {
      console.error(e);
    }
    // lo del editor: lo puesto con borde dorado, lo elegido con borde celeste, la puerta de salida
    cuarto.muebles.forEach((q) => q.puesto && marco(q, "rgba(255,217,138,0.45)"));
    const q = actual();
    if (q) q.gente ? marco({ id: "", x: q.n.x, y: q.n.y, o: {}, r: 60 }, "#73D5DB") : marco(q.m, "#73D5DB");
    if (!cuarto.sotano && !cuarto.sinSalida && !giro) {
      c.strokeStyle = "rgba(242,236,236,0.25)";
      c.setLineDash([6, 6]);
      c.lineWidth = 2;
      c.strokeRect(130, RH - 30, 190, 30);
    }
    c.restore();
    I.ponerGiro(0);
  }
  // ---------- los planos: nombre a la vista, duplicar, copiar y pegar, casas de varios cuartos ----------
  // Cada plantilla y cada casa de varios cuartos tiene un nombre que se ve arriba y se cambia escribiendo. Duplicar arma
  // una variación (de una plantilla: una casa nueva de un cuarto con lo mismo; de una casa: otra casa igual); Copiar y
  // Pegar pasan lo cambiado de un cuarto a otro. Las casas que el juego arma solas (auto_x_y) se guardan al tocarlas.
  const esPlano = (p) => (p || pl).startsWith("plano:");
  const partes = (p) => {
    const [, id, n] = (p || pl).split(":");
    return { id, n: +n || 0 };
  };
  const planoDe = (p) => (E.est().casas || {})[partes(p).id] || I.plano(partes(p).id);
  // un plano que el juego arma solo pasa a lo guardado la primera vez que se cambia
  const asegurarPlano = (est, id) => {
    est.casas = est.casas || {};
    if (!est.casas[id]) est.casas[id] = JSON.parse(JSON.stringify(I.plano(id)));
    return est.casas[id];
  };
  const nombrePlantilla = (p) => {
    if (esPlano(p)) {
      const pd = planoDe(p);
      return pd ? pd.nombre || partes(p).id : p;
    }
    const n = ((E.est().cuartos || {})[p] || {}).nombre;
    return n || t("ed.cu_" + p);
  };
  const nombreCuarto = (pd, n) => (n + 1) + ". " + t("in.clase_" + ((pd.cuartos[n] || {}).clase || "sala"));
  let firmaLista = "";
  function llenarPlantillas() {
    const casas = E.est().casas || {},
      extra = esPlano() && !casas[partes().id] ? { [partes().id]: I.plano(partes().id) } : {};
    const todas = Object.assign({}, casas, extra);
    const f = JSON.stringify([Object.keys(todas).map((k) => [k, todas[k] && todas[k].nombre, todas[k] && todas[k].cuartos.map((c) => c.clase)]), Object.keys(E.est().cuartos || {}).map((k) => (E.est().cuartos[k] || {}).nombre || ""), I18N.lang]);
    if (f === firmaLista) return;
    firmaLista = f;
    const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    let h = `<optgroup label="${esc(t("ed.cu_plantillas"))}">` + I.PLANTILLAS.map((p) => `<option value="${p}">${esc(nombrePlantilla(p))}</option>`).join("") + "</optgroup>";
    Object.keys(todas).forEach((id) => {
      const pd = todas[id];
      if (!pd) return;
      h += `<optgroup label="${esc(pd.nombre || id)}">` + pd.cuartos.map((c, n) => `<option value="plano:${id}:${n}">${esc((pd.nombre || id) + " · " + nombreCuarto(pd, n))}</option>`).join("") + "</optgroup>";
    });
    $("cuPlantilla").innerHTML = h;
    $("cuPlantilla").value = pl;
  }
  function pintarCabeza() {
    const pd = esPlano() && planoDe();
    if (document.activeElement !== $("cuNombre")) $("cuNombre").value = nombrePlantilla(pl);
    $("cuQue").textContent = pd ? t("ed.cu_que_plano", [nombreCuarto(pd, partes().n), pd.cuartos.length]) : pl.startsWith("sot_") ? t("ed.cu_que_sotano") : t("ed.cu_que_plantilla");
    $("cuPlano").classList.toggle("oculto", !pd);
    document.querySelectorAll("#cuartos .soloPlano").forEach((f) => f.classList.toggle("oculto", !pd));
    $("cuGenOtra").disabled = !pd;
    if (pd) dibujarPlano(pd);
  }
  $("cuNombre").addEventListener("change", () => {
    const v = $("cuNombre").value.trim().slice(0, 60);
    if (esPlano()) {
      const id = partes().id;
      E.cambiar((est) => (asegurarPlano(est, id).nombre = v || t("in.plano_nombre", [planoDe().cuartos.length])));
    } else cambiar((p) => (v && v !== t("ed.cu_" + pl) ? (p.nombre = v) : delete p.nombre));
    firma = "";
    firmaLista = "";
    E.avisar(t("ed.cu_nombre_ok", [nombrePlantilla(pl)]));
  });
  $("cuNombre").addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") $("cuNombre").blur();
    if (e.key === "Escape") ($("cuNombre").value = nombrePlantilla(pl)), $("cuNombre").blur();
  });
  const nuevoId = () => "c" + Date.now().toString(36) + Math.floor(Math.random() * 36 * 36).toString(36);
  // «Casa del herrero» → «Casa del herrero 2» (o el número que siga libre)
  const otroNombre = (n) => {
    const usados = new Set(Object.values(E.est().casas || {}).map((c) => c.nombre));
    const base = String(n).replace(/ \d+$/, "");
    for (let i = 2; ; i++) if (!usados.has(base + " " + i)) return base + " " + i;
  };
  $("cuDuplicar").onclick = () => {
    const id = nuevoId();
    E.cambiar((est) => {
      est.casas = est.casas || {};
      est.cuartos = est.cuartos || {};
      if (esPlano()) {
        const viejo = partes().id,
          pd = JSON.parse(JSON.stringify(planoDe()));
        pd.nombre = otroNombre(pd.nombre || viejo);
        delete pd.en;
        est.casas[id] = pd;
        pd.cuartos.forEach((c, n) => est.cuartos["plano:" + viejo + ":" + n] && (est.cuartos["plano:" + id + ":" + n] = JSON.parse(JSON.stringify(est.cuartos["plano:" + viejo + ":" + n]))));
      } else {
        // una plantilla duplicada es una casa nueva de un cuarto, con lo mismo y sin seguir los cambios de la plantilla
        est.casas[id] = { nombre: otroNombre(nombrePlantilla(pl)), sem: 0.01, cuartos: [{ clase: pl.startsWith("sot_") ? "secreto" : "entrada", pared: cuarto.pared, sem: 0.01, base: pl, propio: true }], uniones: [] };
        if (est.cuartos[pl]) {
          const copia = JSON.parse(JSON.stringify(est.cuartos[pl]));
          delete copia.nombre;
          est.cuartos["plano:" + id + ":0"] = copia;
        }
      }
    });
    elegirPlantilla("plano:" + id + ":" + (esPlano() ? partes().n : 0));
    E.avisar(t("ed.cu_duplicado", [nombrePlantilla(pl)]));
  };
  // copiar y pegar lo cambiado de un cuarto (queda en el navegador para pegarlo también en otra pestaña)
  const CLAVE_COPIA = "eromash-editor-cuarto-copia";
  $("cuCopiar").onclick = () => {
    const v = JSON.parse(JSON.stringify(cf() || { cambios: {}, poner: [] }));
    delete v.nombre;
    try {
      localStorage.setItem(CLAVE_COPIA, JSON.stringify({ de: nombrePlantilla(pl), v }));
    } catch (e) {}
    E.avisar(t("ed.cu_copiado", [nombrePlantilla(pl)]));
  };
  $("cuPegar").onclick = () => {
    let c0 = null;
    try {
      c0 = JSON.parse(localStorage.getItem(CLAVE_COPIA) || "null");
    } catch (e) {}
    if (!c0) return E.avisar(t("ed.cu_nada_copiado"));
    cambiar((p) => {
      const nom = p.nombre;
      Object.keys(p).forEach((x) => delete p[x]);
      Object.assign(p, JSON.parse(JSON.stringify(c0.v)), { cambios: c0.v.cambios || {}, poner: c0.v.poner || [] });
      if (nom) p.nombre = nom;
    });
    elegido = null;
    E.avisar(t("ed.cu_pegado", [c0.de, nombrePlantilla(pl)]));
  };
  $("cuAsignar").onclick = () => {
    const casa = E.casaElegida && E.casaElegida();
    if (!casa || !(casa.id === "casaNordica" || casa.id === "casaEikholt")) return E.avisar(t("ed.cu_asignar_no"));
    const id = partes().id;
    E.cambiar((est) => asegurarPlano(est, id));
    if (casa.id === "casaNordica" && !casa.o.entra) E.cambiarElegida("entra", true);
    E.cambiarElegida("plano", id);
    E.avisar(t("ed.cu_asignado", [nombrePlantilla(pl)]));
  };
  $("cuPonerCasa").onclick = () => {
    const id = partes().id;
    E.cambiar((est) => asegurarPlano(est, id));
    E.aplicar({ poner: [{ id: "casaNordica", x: Math.round(E.cam.x), y: Math.round(E.cam.y), o: { entra: true, plano: id, sem: Math.round(Math.random() * 1000) / 1000 } }] });
    cerrar();
    E.avisar(t("ed.cu_casa_puesta", [nombrePlantilla(pl)]));
  };
  $("cuBorrarPlano").onclick = () => {
    const id = partes().id;
    if (!(E.est().casas || {})[id] || !confirm(t("ed.cu_borrar_seguro", [nombrePlantilla(pl)]))) return;
    E.cambiar((est) => {
      delete est.casas[id];
      Object.keys(est.cuartos || {}).forEach((k) => k.startsWith("plano:" + id + ":") && delete est.cuartos[k]);
    });
    elegirPlantilla("casa_0");
  };

  // ---------- el dibujo del plano: un cuadro por cuarto, las puertas en dorado y los pasadizos en celeste ----------
  let cajas = [];
  function dibujarPlano(pd) {
    const cvp = $("cuPlano"),
      g = cvp.getContext("2d"),
      W0 = cvp.width,
      H0 = cvp.height;
    // por niveles desde la entrada
    const nivel = pd.cuartos.map(() => -1);
    nivel[0] = 0;
    for (let vuelta = 0; vuelta < pd.cuartos.length; vuelta++)
      (pd.uniones || []).forEach((u) => {
        if (nivel[u.a] >= 0 && nivel[u.b] < 0) nivel[u.b] = nivel[u.a] + 1;
        if (nivel[u.b] >= 0 && nivel[u.a] < 0) nivel[u.a] = nivel[u.b] + 1;
      });
    const filas = {};
    nivel.forEach((l, i) => (filas[Math.max(0, l)] = filas[Math.max(0, l)] || []).push(i));
    const nf = Object.keys(filas).length,
      bw = Math.min(190, (W0 - 40) / Math.max(1, nf) - 24),
      bh = 64;
    cajas = [];
    Object.keys(filas).forEach((l) => {
      const f = filas[l];
      f.forEach((i, k) => {
        const x = 20 + l * ((W0 - 40 - bw) / Math.max(1, nf - 1 || 1)),
          y = (H0 / (f.length + 1)) * (k + 1) - bh / 2;
        cajas[i] = { x: nf === 1 ? W0 / 2 - bw / 2 : x, y, w: bw, h: bh };
      });
    });
    g.fillStyle = "#141010";
    g.fillRect(0, 0, W0, H0);
    (pd.uniones || []).forEach((u) => {
      const a = cajas[u.a],
        b = cajas[u.b];
      if (!a || !b) return;
      g.save();
      g.strokeStyle = u.secreto ? "#73D5DB" : "#C9A45A";
      g.lineWidth = 4;
      if (u.secreto) g.setLineDash([10, 8]);
      g.beginPath();
      g.moveTo(a.x + a.w / 2, a.y + a.h / 2);
      g.lineTo(b.x + b.w / 2, b.y + b.h / 2);
      g.stroke();
      g.restore();
    });
    const actual0 = partes().n;
    pd.cuartos.forEach((c, i) => {
      const b = cajas[i];
      if (!b) return;
      g.fillStyle = i === actual0 ? "#9C2315" : c.clase === "secreto" ? "#1E2A2C" : "#2A1E1A";
      g.fillRect(b.x, b.y, b.w, b.h);
      g.strokeStyle = i === actual0 ? "#FFD98A" : c.clase === "secreto" ? "#73D5DB" : "#4A3630";
      g.lineWidth = 2;
      g.strokeRect(b.x, b.y, b.w, b.h);
      g.fillStyle = "#F2ECEC";
      g.textAlign = "center";
      g.textBaseline = "middle";
      // el nombre corto, achicado hasta que entre en su cuadro
      const txt = (i + 1) + ". " + t("in.clase_" + c.clase).replace(/^(la|el|los|las|the)\s+/i, "");
      let fs = 26;
      do g.font = "600 " + fs + "px system-ui, sans-serif";
      while (g.measureText(txt).width > b.w - 10 && --fs > 13);
      g.fillText(txt, b.x + b.w / 2, b.y + b.h / 2);
      if (i === 0) {
        g.fillStyle = "#E8DCA8";
        g.fillRect(b.x + 6, b.y + b.h - 6, 30, 4);
      }
    });
  }
  $("cuPlano").addEventListener("pointerdown", (e) => {
    const r = $("cuPlano").getBoundingClientRect(),
      x = ((e.clientX - r.left) * $("cuPlano").width) / r.width,
      y = ((e.clientY - r.top) * $("cuPlano").height) / r.height;
    const i = cajas.findIndex((b) => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (i >= 0) elegirPlantilla("plano:" + partes().id + ":" + i);
  });

  // ---------- el generador de casas: texto o controles → un plano nuevo ----------
  $("cuGenComo").innerHTML = `<option value="">${t("ed.cu_gen_como_cualquiera")}</option>` + I.COMO.map((c) => `<option value="${c}">${t("ed.cu_gen_como_" + c)}</option>`).join("");
  $("cuGenPared").innerHTML = `<option value="">${t("ed.cu_gen_pared_cualquiera")}</option>` + I.PAREDES.map((p) => `<option value="${p}">${t("ed.cu_pared_" + p)}</option>`).join("");
  ["cuGenN", "cuGenS"].forEach((k) => $(k).addEventListener("input", () => ($(k + "V").textContent = $(k).value)));
  $("cuGenTexto").addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) $("cuGenOk").click();
  });
  // leer el pedido escrito sin IA: números, cuartos por nombre, pasadizos y cómo se esconden
  const NUM = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
  const PALABRAS = {
    dormitorio: /dormitor|cama|bedroom|alcoba|dormir/,
    cocina: /cocina|kitchen|fogón|fogon/,
    sala: /\bsala\b|salón|salon|\bhall\b|living/,
    taller: /taller|workshop|forja|telar/,
    estudio: /estudio|biblioteca|library|study|escritorio/,
    almacen: /dep[oó]sito|almac[eé]n|despensa|storage|storeroom|bodega/,
  };
  function leerPedido(txt) {
    const s0 = " " + txt.toLowerCase() + " ",
      op = {};
    const num = (w) => (/^\d+$/.test(w) ? +w : NUM[w]);
    const m1 = s0.match(/(\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|one|two|three|four|five|six|seven)\s+(habitaci|cuarto|ambiente|room|pieza)/);
    const m2 = s0.match(/(\d+|un|una|uno|dos|tres|one|two|three|a|an)\s+(pasadizo|pasaje|paso|cuarto secreto|cuarto escondido|habitaci[oó]n secreta|secret|hidden)/);
    const hay = /pasadizo|pasaje|secret|escondid|ocult|hidden/.test(s0);
    const sec = m2 ? num(m2[1]) : hay ? 1 : 0;
    if (m1) op.normales = num(m1[1]);
    op.secretos = sec;
    op.clases = Object.keys(PALABRAS).filter((k) => PALABRAS[k].test(s0));
    if (/estante|librer|shelf|biblioteca/.test(s0) && hay) op.como = "estante";
    else if (/tapiz|tapestry|cortina/.test(s0)) op.como = "tapiz";
    else if (/tablas|muro falso|pared falsa|planks|false wall/.test(s0)) op.como = "tablas";
    else if (/trampilla|alfombra|s[oó]tano|trapdoor|cellar|abajo/.test(s0)) op.como = "trampilla";
    if (/piedra|stone/.test(s0)) op.pared = "piedra";
    else if (/taberna|tavern/.test(s0)) op.pared = "taberna";
    const q = txt.match(/[«"“]([^»"”]{2,60})[»"”]/);
    if (q) op.nombre = q[1];
    return op;
  }
  function opcionesGen() {
    const txt = $("cuGenTexto").value.trim(),
      op = txt ? leerPedido(txt) : {};
    if (op.normales) $("cuGenN").value = Math.min(6, op.normales);
    if (txt) $("cuGenS").value = Math.min(3, op.secretos);
    if (op.como) $("cuGenComo").value = op.como;
    if (op.pared) $("cuGenPared").value = op.pared;
    ["cuGenN", "cuGenS"].forEach((k) => ($(k + "V").textContent = $(k).value));
    return { cuartos: +$("cuGenN").value + +$("cuGenS").value, secretos: +$("cuGenS").value, clases: op.clases || [], como: $("cuGenComo").value || undefined, pared: $("cuGenPared").value || undefined, nombre: op.nombre, pedido: txt || undefined };
  }
  function generar(op, id) {
    const nuevo = !id;
    id = id || nuevoId();
    const viejo = (E.est().casas || {})[id] || (id && I.plano(id));
    const pd = I.generarPlano(op, Math.random());
    pd.op = op;
    if (viejo && !op.nombre) pd.nombre = viejo.nombre;
    else if (op.nombre) pd.nombre = op.nombre;
    if (viejo && viejo.en) pd.en = viejo.en;
    E.cambiar((est) => {
      est.casas = est.casas || {};
      est.casas[id] = pd;
      // otra semilla: lo cambiado a mano en los cuartos viejos ya no calza
      Object.keys(est.cuartos || {}).forEach((k) => !nuevo && k.startsWith("plano:" + id + ":") && delete est.cuartos[k]);
    });
    elegirPlantilla("plano:" + id + ":0");
    E.avisar(t(nuevo ? "ed.cu_gen_listo" : "ed.cu_gen_otra_listo", [pd.nombre, pd.cuartos.length]));
  }
  $("cuGenOk").onclick = () => generar(opcionesGen());
  $("cuGenOtra").onclick = () => {
    if (!esPlano()) return;
    const pd = planoDe();
    generar(Object.assign({}, pd.op || { cuartos: pd.cuartos.length, secretos: pd.cuartos.filter((c) => c.clase === "secreto").length }, pd.cuartos[0].base ? { base: pd.cuartos[0].base } : {}), partes().id);
  };
  // con IA: el pedido libre pasa a las mismas opciones (y lo que no entiende queda en los controles)
  $("cuGenIA").onclick = async () => {
    const txt = $("cuGenTexto").value.trim();
    if (!txt) return E.avisar(t("ed.cu_gen_sin_texto"));
    const ia = window.EDITOR_IA && EDITOR_IA.paraTarea("generar");
    if (!ia) return E.avisar(t("ed.cu_gen_sin_clave"));
    const sistema =
      "Convertís el pedido de una casa vikinga de un juego en JSON, solo JSON, sin texto alrededor: " +
      '{"nombre": texto corto en el idioma del pedido, "cuartos": total de cuartos contando los secretos (1 a 7), "secretos": cuartos escondidos (0 a 3), ' +
      '"clases": lista de los cuartos normales pedidos, de estos: ' + I.CLASES.filter((c) => c !== "entrada" && c !== "secreto").join(", ") + ', "como": cómo se esconden los pasadizos, uno de ' + I.COMO.join(", ") + ' o null, "pared": uno de ' + I.PAREDES.join(", ") + " o null}.";
    $("cuGenIA").disabled = true;
    E.avisar(t("ed.cu_gen_pensando"));
    try {
      const r = (await EDITOR_IA.llamarTarea("generar", [{ role: "user", content: txt }], sistema)).txt;
      const js = JSON.parse((r.match(/\{[\s\S]*\}/) || ["{}"])[0]);
      const op = {
        cuartos: Math.max(1, Math.min(7, +js.cuartos || 3)),
        secretos: Math.max(0, Math.min(3, +js.secretos || 0)),
        clases: Array.isArray(js.clases) ? js.clases.filter((c) => I.CLASES.includes(c)) : [],
        como: I.COMO.includes(js.como) ? js.como : undefined,
        pared: I.PAREDES.includes(js.pared) ? js.pared : undefined,
        nombre: typeof js.nombre === "string" ? js.nombre.slice(0, 60) : undefined,
        pedido: txt,
      };
      $("cuGenN").value = Math.min(6, op.cuartos - op.secretos);
      $("cuGenS").value = op.secretos;
      ["cuGenN", "cuGenS"].forEach((k) => ($(k + "V").textContent = $(k).value));
      generar(op);
    } catch (e) {
      E.avisar(t("ed.cu_gen_error", [e.message || e]));
    } finally {
      $("cuGenIA").disabled = false;
    }
  };

  // ---------- abrir y cerrar ----------
  function elegirPlantilla(p) {
    if (I.PLANTILLAS.indexOf(p) < 0 && !(p.startsWith("plano:") && planoDe(p))) return;
    pl = p;
    elegido = null;
    firma = "";
    armar();
  }
  const abierta = () => !caja.classList.contains("oculto");
  let conLista = false;
  function abrir(p) {
    E.usar("interior");
    if (p) elegirPlantilla(p);
    if (!conLista) (armarLista(), (conLista = true));
    caja.classList.remove("oculto");
    firma = "";
    armar();
    requestAnimationFrame(cuadro);
  }
  function cerrar() {
    caja.classList.add("oculto");
    arrastre = null;
    E.pedir();
  }
  return { abrir, cerrar, abierta, tecla, alternar: () => (abierta() ? cerrar() : abrir()), plantilla: () => pl, generar: (op) => generar(op) };
})();
