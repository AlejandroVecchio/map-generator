// ---------- editar Eikholt (tecla J o Crear → Eikholt): la capital en 2.5D, como en el juego ----------
// La ciudad es otro mapa (aventura/js/ciudad/, PLANO25 en unidades de 60 por metro). Se ve con VISTA25, la misma vista
// del juego, y se eligen las cosas del plano con un clic: se arrastran, se giran (Q / E), se agrandan las que son
// assets, se sacan o vuelven a como eran; de la lista se ponen assets nuevos. Todo va a AGREGADOS.eikholt
// ({ quitar, mover, poner }, con Deshacer) y el juego lo aplica al armar la ciudad (ciudad/agregados.js).
window.EDITOR_EIKHOLT = (function () {
  "use strict";
  const E = window.EDITOR,
    t = E.t,
    $ = (id) => document.getElementById(id);
  const P = window.PLANO25,
    VI = window.VISTA25;
  if (!P || !P.armarBase || !VI) return { abrir() {}, cerrar() {}, abierta: () => false, tecla() {}, alternar() {} };
  const caja = $("eikholt"),
    cv = $("ekLienzo"),
    c = cv.getContext("2d");
  const cam = { x: 0, y: 0, g: -0.49, k: 0.55, esc: 0.3 };
  let plano = null,
    firma = "",
    elegido = null,
    poniendo = null,
    arrastre = null,
    giroMeta = cam.g,
    escMeta = cam.esc,
    cw = 0,
    ch = 0,
    tt = 0,
    t0 = 0,
    corre = false;
  const nombre = (id) => (t("as." + id) === "as." + id ? id : t("as." + id));
  const ek = () => E.est().eikholt || {};
  const cuenta = () => ["quitar", "mover", "poner"].reduce((n, k) => n + (ek()[k] || []).length, 0);

  // ---------- el plano: el de la ciudad con lo del editor encima ----------
  function armar(forzar) {
    const f = JSON.stringify(ek());
    if (!forzar && f === firma && plano) return;
    firma = f;
    const viejo = elegido;
    plano = P.aplicarAgregados(P.armarBase(), JSON.parse(f));
    VI.iniciar(plano);
    if (window.ENSERES25) ENSERES25.noche = 0;
    // lo elegido sigue elegido después de cambiarlo (se lo busca por su clave o por su lugar en lo puesto)
    elegido = viejo ? plano.cosas.find((o) => (viejo.pn !== undefined ? o.pn === viejo.pn : claveDe(o) === claveDe(viejo))) || null : null;
    pintarPanel();
  }
  const claveDe = (o) => o.clave0 || P.clave(o);
  // los lugares para saltar, los mismos de la muestra de la ciudad
  function lugares() {
    const L = plano.lugares,
      A = plano.anclas;
    return {
      plaza: [L.ting[0] + 900, L.ting[1] + 300],
      ting: [L.ting[0], L.ting[1] + 200],
      sur: A.puerta_sur,
      oficios: [L.herreria[0] + 400, L.herreria[1] + 900],
      lindes: [L.lindes[0] + 300, L.lindes[1] + 500],
      hongo: [L.hongo[0], L.hongo[1] + 900],
      guardia: [L.entrenamiento[0] + 300, L.entrenamiento[1] + 700],
      caravanas: [L.forasteros[0] + 600, L.forasteros[1] + 1200],
      sanacion: [L.sanacion[0] + 600, L.sanacion[1] + 700],
      muelle: [A.muelle[0] + 300, A.muelle[1] + 500],
      lejos: [0, 600],
    };
  }

  // ---------- cambiar lo guardado (con Deshacer) ----------
  function cambiar(fn) {
    E.cambiar((est) => {
      const g = (est.eikholt = est.eikholt || {});
      ["quitar", "mover", "poner"].forEach((k) => (g[k] = g[k] || []));
      fn(g);
      if (!g.quitar.length && !g.mover.length && !g.poner.length) delete est.eikholt;
    });
    armar();
  }
  // la entrada de mover de una cosa del plano (la crea si hace falta)
  function entrada(g, o) {
    const cl = claveDe(o);
    let e = g.mover.find((m) => m.c === cl);
    if (!e) g.mover.push((e = { c: cl, x0: Math.round(o.x0 ?? o.x), y0: Math.round(o.y0 ?? o.y) }));
    return e;
  }
  // mover, girar o agrandar lo elegido: lo puesto cambia su entrada de poner; lo del plano, su entrada de mover
  function ajustar(o, cambio) {
    cambiar((g) => {
      if (o.pn !== undefined) {
        const p = g.poner[o.pn];
        if (!p) return;
        if (cambio.x !== undefined) (p.x = Math.round(cambio.x)), (p.y = Math.round(cambio.y));
        p.o = p.o || {};
        if (cambio.giro !== undefined) p.o.giro = cambio.giro;
        if (cambio.esc !== undefined) p.o.esc = cambio.esc;
        return;
      }
      const e = entrada(g, o);
      if (cambio.x !== undefined) (e.x = Math.round(cambio.x)), (e.y = Math.round(cambio.y));
      if (cambio.ry !== undefined) e.ry = +cambio.ry.toFixed(4);
      if (cambio.giro !== undefined) e.giro = cambio.giro;
      if (cambio.esc !== undefined) e.esc = cambio.esc;
    });
  }
  function girar(paso) {
    const o = elegido;
    if (!o) return;
    if (o.tipo === "casa") ajustar(o, { ry: o.ry + (paso * Math.PI) / 12 });
    else ajustar(o, { giro: ((((o.o && o.o.giro) || 0) + paso * 15) % 360 + 360) % 360 });
  }
  function escalar(f) {
    const o = elegido;
    if (!o || o.tipo === "casa") return;
    ajustar(o, { esc: +Math.max(0.3, Math.min(3, ((o.o && o.o.esc) || 1) * f)).toFixed(2) });
  }
  function sacar() {
    const o = elegido;
    if (!o) return;
    elegido = null;
    cambiar((g) => {
      if (o.pn !== undefined) return g.poner.splice(o.pn, 1);
      const cl = claveDe(o);
      g.mover = g.mover.filter((m) => m.c !== cl);
      g.quitar.push({ c: cl, x0: Math.round(o.x0 ?? o.x), y0: Math.round(o.y0 ?? o.y) });
    });
  }
  function comoEra() {
    const o = elegido;
    if (!o || o.pn !== undefined) return;
    const cl = claveDe(o);
    cambiar((g) => (g.mover = g.mover.filter((m) => m.c !== cl)));
  }
  function devolverSacados() {
    cambiar((g) => (g.quitar = []));
  }
  function poner(id, x, y) {
    cambiar((g) => g.poner.push({ id, x: Math.round(x), y: Math.round(y), o: {} }));
    elegido = plano.cosas.find((o) => o.pn === ek().poner.length - 1) || null;
    pintarPanel();
    E.usar("eikholtPoner");
  }

  // ---------- de la pantalla al piso y elegir ----------
  const V = () => VI.proyector(cam);
  function aPiso(px, py) {
    return V().inversa(cam.x + (px - cw / 2) / cam.esc, cam.y + (py - ch / 2) / cam.esc);
  }
  function aPantalla(x, y) {
    const [vx, vy] = V()(x, y);
    return [cw / 2 + (vx - cam.x) * cam.esc, ch / 2 + (vy - cam.y) * cam.esc];
  }
  // lo que está bajo el puntero: la caja de cada cosa en la pantalla (su ancho y su alto parado); gana la más chica
  function cosaEn(px, py) {
    let mejor = null,
      md = Infinity;
    for (const o of plano.cosas) {
      if (o.tipo === "patio") continue;
      const [sx, sy] = aPantalla(o.x, o.y);
      const r = (o.tipo === "casa" ? Math.max(60, (o.radio || 300) - 200) : Math.max(40, (o.alto || 100) * 0.35)) * cam.esc,
        alto = (o.tipo === "casa" ? o.casa.alto || o.alto || 200 : o.alto || 100) * cam.esc;
      if (Math.abs(px - sx) > r || py < sy - alto - 10 || py > sy + r * cam.k + 10) continue;
      const d = r + Math.abs(px - sx) * 0.2;
      if (d < md) (md = d), (mejor = o);
    }
    return mejor;
  }

  // ---------- dibujar ----------
  function medir() {
    const r = cv.getBoundingClientRect();
    if (cv.width !== Math.round(r.width) || cv.height !== Math.round(r.height)) {
      cv.width = Math.round(r.width);
      cv.height = Math.round(r.height);
    }
    cw = cv.width;
    ch = cv.height;
  }
  function cuadro(ahora) {
    if (!abierta()) return (corre = false);
    corre = true;
    const dt = Math.min(0.05, (ahora - (t0 || ahora)) / 1000);
    t0 = ahora;
    tt += dt;
    medir();
    armar(); // si Deshacer cambió lo guardado, el plano se vuelve a armar
    cam.g += (giroMeta - cam.g) * Math.min(1, dt * 8);
    cam.esc += (escMeta - cam.esc) * Math.min(1, dt * 8);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#2E3A26";
    c.fillRect(0, 0, cw, ch);
    try {
      VI.dibujar(c, cam, cw, ch, tt, [], (cx) => marcas(cx));
    } catch (e) {
      console.error(e);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (poniendo && ultimo) {
      // lo que se va a poner, transparente bajo el puntero
      const [x, y] = aPiso(ultimo[0], ultimo[1]),
        [sx, sy] = aPantalla(x, y);
      c.save();
      c.globalAlpha = 0.6;
      c.translate(sx, sy);
      c.scale(cam.esc, cam.esc);
      ASSETS.dibujar(c, poniendo, 0, 0, tt, {});
      c.restore();
    }
    requestAnimationFrame(cuadro);
  }
  // en el piso: el anillo de lo elegido y una marca en lo movido o puesto
  function marcas(cx) {
    const g = ek(),
      movidos = new Set((g.mover || []).map((m) => m.c));
    cx.save();
    cx.lineWidth = 2 / cam.esc;
    for (const o of plano.cosas) {
      if (o.pn === undefined && !movidos.has(o.clave0)) continue;
      cx.strokeStyle = o.pn !== undefined ? "rgba(123,200,108,0.8)" : "rgba(255,217,138,0.7)";
      cx.beginPath();
      cx.arc(o.x, o.y, 70, 0, Math.PI * 2);
      cx.stroke();
    }
    for (const q of g.quitar || []) {
      cx.strokeStyle = "rgba(200,64,45,0.8)";
      cx.beginPath();
      cx.moveTo(q.x0 - 60, q.y0 - 60);
      cx.lineTo(q.x0 + 60, q.y0 + 60);
      cx.moveTo(q.x0 + 60, q.y0 - 60);
      cx.lineTo(q.x0 - 60, q.y0 + 60);
      cx.stroke();
    }
    if (elegido) {
      const r = elegido.tipo === "casa" ? Math.max(120, (elegido.radio || 300) - 220) : Math.max(80, (elegido.alto || 100) * 0.45);
      cx.strokeStyle = "#73D5DB";
      cx.lineWidth = 4 / cam.esc;
      cx.setLineDash([24 / cam.esc, 14 / cam.esc]);
      cx.beginPath();
      cx.arc(elegido.x, elegido.y, r, 0, Math.PI * 2);
      cx.stroke();
    }
    cx.restore();
  }

  // ---------- el puntero: elegir, arrastrar, mover la vista, poner ----------
  let ultimo = null;
  const punto = (e) => {
    const r = cv.getBoundingClientRect();
    return [((e.clientX - r.left) * cw) / r.width, ((e.clientY - r.top) * ch) / r.height];
  };
  cv.addEventListener("pointerdown", (e) => {
    const [px, py] = punto(e);
    cv.setPointerCapture(e.pointerId);
    if (poniendo) {
      const [x, y] = aPiso(px, py);
      return poner(poniendo, x, y);
    }
    const o = cosaEn(px, py);
    if (o) {
      elegido = o;
      pintarPanel();
      arrastre = { o, px, py, x: o.x, y: o.y, movio: false };
    } else {
      elegido = null;
      pintarPanel();
      arrastre = { vista: true, px, py, cx: cam.x, cy: cam.y };
    }
  });
  cv.addEventListener("pointermove", (e) => {
    const [px, py] = (ultimo = punto(e));
    if (!arrastre) return;
    if (arrastre.vista) {
      // la vista se corre con el piso: lo que se agarró queda bajo el puntero
      const V0 = V();
      const [vx, vy] = V0(arrastre.cx, arrastre.cy);
      const a = V0.inversa(vx - (px - arrastre.px) / cam.esc, vy - (py - arrastre.py) / cam.esc);
      cam.x = a[0];
      cam.y = a[1];
      return;
    }
    const a = aPiso(arrastre.px, arrastre.py),
      b = aPiso(px, py);
    if (!arrastre.movio && Math.hypot(px - arrastre.px, py - arrastre.py) < 4) return;
    arrastre.movio = true;
    arrastre.o.x = arrastre.x + b[0] - a[0];
    arrastre.o.y = arrastre.y + b[1] - a[1];
  });
  const soltar = () => {
    const a = arrastre;
    arrastre = null;
    if (a && a.o && a.movio) {
      const x = a.o.x,
        y = a.o.y;
      a.o.x = a.x;
      a.o.y = a.y;
      ajustar(a.o, { x, y });
    }
  };
  cv.addEventListener("pointerup", soltar);
  cv.addEventListener("pointercancel", soltar);
  cv.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      acercar(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    },
    { passive: false }
  );
  const acercar = (f) => (escMeta = Math.max(0.05, Math.min(1.2, escMeta * f)));

  // ---------- el panel ----------
  $("ekCerrar").onclick = () => cerrar();
  $("ekProbar").onclick = () => {
    const lang = new URLSearchParams(location.search).get("lang");
    open("index.html?borrador=1&jugar=9&eikholt=1" + (lang ? "&lang=" + lang : ""), "_blank");
  };
  $("ekGiroIzq").onclick = () => girar(-1);
  $("ekGiroDer").onclick = () => girar(1);
  $("ekMenos").onclick = () => escalar(1 / 1.1);
  $("ekMas").onclick = () => escalar(1.1);
  $("ekSacar").onclick = () => sacar();
  $("ekComo").onclick = () => comoEra();
  $("ekDevolver").onclick = () => devolverSacados();
  $("ekTodo").onclick = () => {
    if (cuenta() && confirm(t("ed.ek_todo_seguro"))) cambiar((g) => ((g.quitar = []), (g.mover = []), (g.poner = [])));
  };
  $("ekCamIzq").onclick = () => (giroMeta -= Math.PI / 6);
  $("ekCamDer").onclick = () => (giroMeta += Math.PI / 6);
  $("ekAcercar").onclick = () => acercar(1.3);
  $("ekAlejar").onclick = () => acercar(1 / 1.3);
  $("ekBuscar").addEventListener("input", () => pintarLista());
  $("ekBuscar").addEventListener("keydown", (e) => e.stopPropagation());
  $("ekGrupo").addEventListener("change", () => pintarLista());
  function pintarPanel() {
    $("ekCuenta").textContent = t("ed.ek_cuenta", [(ek().mover || []).length, (ek().quitar || []).length, (ek().poner || []).length]);
    const o = elegido;
    $("ekSel").classList.toggle("oculto", !o);
    if (!o) return;
    const id = o.id || (o.nombre || "").replace(/[-\d_]+[a-z]?[-_]*$/, "");
    $("ekSelNombre").textContent = o.tipo === "asset" ? nombre(o.id) : t("ed.ek_n_" + id) === "ed.ek_n_" + id ? nombre(id) : t("ed.ek_n_" + id);
    $("ekSelTipo").textContent = o.pn !== undefined ? t("ed.ek_tipo_puesto") : o.tipo === "casa" ? t("ed.ek_tipo_casa") : t("ed.ek_tipo_asset");
    $("ekMenos").disabled = $("ekMas").disabled = o.tipo === "casa";
    $("ekComo").disabled = o.pn !== undefined || !(ek().mover || []).some((m) => m.c === claveDe(o));
  }
  function pintarSaltos() {
    const l = $("ekLugares");
    l.innerHTML = "";
    const L = lugares();
    for (const k in L) {
      const b = document.createElement("button");
      b.textContent = t("ci.lugar_" + k);
      b.onclick = () => {
        cam.x = L[k][0];
        cam.y = L[k][1];
        escMeta = k === "lejos" ? 0.06 : 0.3;
      };
      l.appendChild(b);
    }
  }
  function pintarLista() {
    const q = $("ekBuscar").value.trim().toLowerCase(),
      gr = $("ekGrupo").value,
      l = $("ekLista");
    l.innerHTML = "";
    ASSETS.catalogo()
      .filter((a) => (!gr || a.grupo === gr) && !/^(tx_|txb_|im_)/.test(a.id) && (!q || a.id.toLowerCase().includes(q) || nombre(a.id).toLowerCase().includes(q)))
      .slice(0, 120)
      .forEach((a) => {
        const b = document.createElement("button");
        b.className = "ekObj" + (poniendo === a.id ? " elegido" : "");
        b.textContent = nombre(a.id);
        b.onclick = () => {
          poniendo = poniendo === a.id ? null : a.id;
          pintarLista();
          if (poniendo) E.avisar(t("ed.ek_poner_aviso", [nombre(a.id)]));
        };
        l.appendChild(b);
      });
  }
  function llenarGrupos() {
    const gs = [...new Set(ASSETS.catalogo().map((a) => a.grupo).filter(Boolean))].sort();
    $("ekGrupo").innerHTML = `<option value="">${t("ed.ek_todos")}</option>` + gs.map((g) => `<option value="${g}">${g}</option>`).join("");
    $("ekGrupo").value = gs.includes("ciudad") ? "ciudad" : "";
  }

  // ---------- teclas ----------
  function tecla(e) {
    const kk = e.key;
    if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return;
    if (kk === "Escape") {
      e.preventDefault();
      if (poniendo || elegido) {
        poniendo = null;
        elegido = null;
        pintarLista();
        return pintarPanel();
      }
      return cerrar();
    }
    if (kk === "j" || kk === "J") return cerrar();
    if (kk === "Delete" || kk === "Backspace") return e.preventDefault(), sacar();
    if (kk === "q" || kk === "Q") return girar(-1);
    if (kk === "e" || kk === "E") return girar(1);
    if (kk === "+" || kk === "=") return escalar(1.1);
    if (kk === "-") return escalar(1 / 1.1);
    if (!e.ctrlKey && !e.metaKey && (kk === "z" || kk === "Z")) return (giroMeta -= Math.PI / 6);
    if (!e.ctrlKey && !e.metaKey && (kk === "x" || kk === "X")) return (giroMeta += Math.PI / 6);
    const paso = (e.shiftKey ? 300 : 60),
      fl = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[kk];
    if (fl && elegido) {
      e.preventDefault();
      // las flechas mueven en la pantalla: se pasan al piso con el giro de la cámara
      const [x0, y0] = aPantalla(elegido.x, elegido.y),
        [x, y] = aPiso(x0 + fl[0] * cam.esc, y0 + fl[1] * cam.esc * cam.k);
      ajustar(elegido, { x, y });
    }
  }

  // ---------- abrir y cerrar ----------
  const abierta = () => !caja.classList.contains("oculto");
  let primera = true;
  function abrir() {
    E.usar("eikholt");
    caja.classList.remove("oculto");
    armar(true);
    if (primera) {
      primera = false;
      const L = lugares();
      cam.x = L.plaza[0];
      cam.y = L.plaza[1];
      llenarGrupos();
      pintarSaltos();
      pintarLista();
    }
    if (!corre) requestAnimationFrame(cuadro);
  }
  function cerrar() {
    caja.classList.add("oculto");
    arrastre = null;
    poniendo = null;
    E.pedir();
  }
  return { abrir, cerrar, abierta, tecla, alternar: () => (abierta() ? cerrar() : abrir()), plano: () => plano, cam, elegir: (o) => ((elegido = o), pintarPanel()), elegido: () => elegido, aPantalla, armar };
})();
