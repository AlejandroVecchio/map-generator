// ---------- importar gente propia (tecla N) ----------
// Pedido de Alejandro (24/10/2026): sumar un NPC específico con un dibujo propio. Se elige o se arrastra una imagen
// por vista (frente, espalda y costado; con el frente alcanza), se le da nombre y diálogo en los dos idiomas, se pone
// en el mapa con un clic y se mueve con Mover. Cada imagen se recorta a lo dibujado, se achica a 256 px de alto (puede
// sacarle el fondo liso) y queda dentro de agregados.js (AGREGADOS.npcs), que es público. El juego la dibuja tal cual
// con motor/importados.js.
window.EDITOR_NPC = (function () {
  "use strict";
  const E = window.EDITOR,
    t = E.t,
    $ = (id) => document.getElementById(id);
  const caja = $("npcs"),
    VISTAS = ["S", "N", "E"],
    ALTO = 84,
    MAX = 256;
  let elegido = null, // id
    poniendo = false,
    arrastre = null;
  const lista = () => E.est().npcs || [];
  const actual = () => lista().find((n) => n.id === elegido) || null;
  const nombreDe = (n) => (n.nombre && (n.nombre[I18N.lang] || n.nombre.es || n.nombre.en)) || n.id;
  function cambiar(fn) {
    const id = elegido;
    E.cambiar((est) => {
      const n = (est.npcs || []).find((q) => q.id === id);
      if (n) fn(n, est);
    });
    pintar();
  }

  // ---------- las imágenes: recortar, sacar el fondo liso y achicar ----------
  const imagenes = {}; // cache de Image por dataURL
  function imagen(src) {
    if (!src) return null;
    if (!imagenes[src]) {
      const im = new Image();
      im.onload = () => E.pedir();
      im.src = src;
      imagenes[src] = im;
    }
    const im = imagenes[src];
    return im.complete && im.naturalWidth ? im : null;
  }
  function preparar(file, sinFondo) {
    return new Promise((ok, mal) => {
      if (!file || !/^image\//.test(file.type)) return mal(new Error(t("ed.np_no_imagen")));
      const fr = new FileReader();
      fr.onerror = () => mal(fr.error);
      fr.onload = () => {
        const im = new Image();
        im.onerror = () => mal(new Error(t("ed.np_no_imagen")));
        im.onload = () => {
          // primero a un tamaño de trabajo, después se recorta a lo dibujado y se achica
          const k0 = Math.min(1, 900 / Math.max(im.width, im.height)),
            w0 = Math.max(1, Math.round(im.width * k0)),
            h0 = Math.max(1, Math.round(im.height * k0));
          const a = document.createElement("canvas");
          a.width = w0;
          a.height = h0;
          const g = a.getContext("2d");
          g.drawImage(im, 0, 0, w0, h0);
          const px = g.getImageData(0, 0, w0, h0),
            d = px.data;
          if (sinFondo) {
            // el color de las cuatro esquinas, si se parecen entre sí, es el fondo: se borra con borde suave
            const esq = [0, (w0 - 1) * 4, (h0 - 1) * w0 * 4, ((h0 - 1) * w0 + w0 - 1) * 4].map((i) => [d[i], d[i + 1], d[i + 2], d[i + 3]]);
            const prom = [0, 1, 2].map((j) => esq.reduce((s, q) => s + q[j], 0) / 4);
            const parecidas = esq.every((q) => Math.hypot(q[0] - prom[0], q[1] - prom[1], q[2] - prom[2]) < 40) && esq.every((q) => q[3] > 200);
            if (parecidas)
              for (let i = 0; i < d.length; i += 4) {
                const dist = Math.hypot(d[i] - prom[0], d[i + 1] - prom[1], d[i + 2] - prom[2]);
                if (dist < 46) d[i + 3] = 0;
                else if (dist < 72) d[i + 3] = Math.round((d[i + 3] * (dist - 46)) / 26);
              }
          }
          // recortar a lo que no es transparente (así los pies quedan abajo de todo)
          let x0 = w0,
            y0 = h0,
            x1 = -1,
            y1 = -1;
          for (let y = 0; y < h0; y++)
            for (let x = 0; x < w0; x++)
              if (d[(y * w0 + x) * 4 + 3] > 24) {
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
              }
          if (x1 < 0) return mal(new Error(t("ed.np_vacia")));
          g.putImageData(px, 0, 0);
          const cw = x1 - x0 + 1,
            ch = y1 - y0 + 1,
            k = Math.min(1, MAX / ch, MAX / cw);
          const b = document.createElement("canvas");
          b.width = Math.max(1, Math.round(cw * k));
          b.height = Math.max(1, Math.round(ch * k));
          const gb = b.getContext("2d");
          gb.imageSmoothingQuality = "high";
          gb.drawImage(a, x0, y0, cw, ch, 0, 0, b.width, b.height);
          ok(b.toDataURL("image/png"));
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  async function cargarVista(v, file) {
    if (!actual()) return;
    try {
      const src = await preparar(file, $("npFondo").checked);
      cambiar((n) => {
        n.img = n.img || {};
        n.img[v] = src;
      });
      E.avisar(t("ed.np_imagen_lista", [Math.round((src.length * 0.75) / 1024)]));
    } catch (e) {
      E.avisar(e.message || String(e));
    }
  }

  // ---------- el panel ----------
  const entrada = document.createElement("input");
  entrada.type = "file";
  entrada.accept = "image/*";
  let vistaPedida = "S";
  entrada.addEventListener("change", () => {
    if (entrada.files[0]) cargarVista(vistaPedida, entrada.files[0]);
    entrada.value = "";
  });
  document.querySelectorAll("#npcs .npVista").forEach((slot) => {
    const v = slot.dataset.v;
    slot.querySelector("canvas").onclick = () => {
      vistaPedida = v;
      entrada.click();
    };
    slot.querySelector("button").onclick = () => cambiar((n) => n.img && delete n.img[v]);
    slot.addEventListener("dragover", (e) => (e.preventDefault(), slot.classList.add("sobre")));
    slot.addEventListener("dragleave", () => slot.classList.remove("sobre"));
    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      slot.classList.remove("sobre");
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) cargarVista(v, f);
    });
  });
  // también se puede pegar una imagen copiada (va a la primera vista vacía)
  addEventListener("paste", (e) => {
    if (!abierta() || !actual() || (window.EDITOR_IMPORTAR && EDITOR_IMPORTAR.clase() !== "gente") || /INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName)) return;
    const it = [...(e.clipboardData ? e.clipboardData.items : [])].find((i) => i.type.startsWith("image/"));
    if (!it) return;
    e.preventDefault();
    const n = actual();
    cargarVista(VISTAS.find((v) => !(n.img && n.img[v])) || "S", it.getAsFile());
  });
  function miniatura(cvs, src) {
    const g = cvs.getContext("2d");
    g.clearRect(0, 0, cvs.width, cvs.height);
    g.fillStyle = "#141010";
    g.fillRect(0, 0, cvs.width, cvs.height);
    const im = imagen(src);
    if (!im) {
      g.fillStyle = "#6A5A54";
      g.font = "28px system-ui, sans-serif";
      g.textAlign = "center";
      g.fillText("+", cvs.width / 2, cvs.height / 2 + 10);
      if (src) setTimeout(() => miniatura(cvs, src), 120);
      return;
    }
    const k = Math.min((cvs.width - 12) / im.naturalWidth, (cvs.height - 12) / im.naturalHeight);
    const w = im.naturalWidth * k,
      h = im.naturalHeight * k;
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.beginPath();
    g.ellipse(cvs.width / 2, cvs.height - 7, w * 0.4, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.drawImage(im, (cvs.width - w) / 2, cvs.height - 6 - h, w, h);
  }
  function pintar() {
    const l = $("npLista"),
      ns = lista();
    if (elegido && !actual()) elegido = null;
    if (!elegido && ns.length) elegido = ns[0].id;
    l.innerHTML = ns.length ? ns.map((n) => `<option value="${n.id}">${nombreDe(n).replace(/</g, "&lt;")}${n.x == null ? " · " + t("ed.np_sin_lugar") : ""}</option>`).join("") : `<option value="">${t("ed.np_ninguno")}</option>`;
    if (elegido) l.value = elegido;
    const n = actual();
    document.querySelectorAll("#npcs .conNpc").forEach((f) => f.classList.toggle("oculto", !n));
    if (!n) return;
    $("npNombreEs").value = (n.nombre && n.nombre.es) || "";
    $("npNombreEn").value = (n.nombre && n.nombre.en) || "";
    $("npDialogoEs").value = ((n.dialogo && n.dialogo.es) || []).join("\n");
    $("npDialogoEn").value = ((n.dialogo && n.dialogo.en) || []).join("\n");
    $("npTam").value = n.s || 1;
    $("npTamV").textContent = t("ed.np_metros", [((ALTO * (n.s || 1)) / 30).toFixed(1)]);
    $("npAnda").value = n.anda || 0;
    $("npAndaV").textContent = n.anda ? t("ed.np_metros", [Math.round(n.anda / 30)]) : t("ed.np_quieto");
    document.querySelectorAll("#npcs .npVista").forEach((slot) => {
      const src = n.img && n.img[slot.dataset.v];
      miniatura(slot.querySelector("canvas"), src);
      slot.querySelector("button").classList.toggle("oculto", !src);
    });
    const peso = VISTAS.reduce((s, v) => s + ((n.img && n.img[v]) || "").length * 0.75, 0);
    $("npPeso").textContent = t("ed.np_peso", [Math.round(peso / 1024)]);
    $("npLugar").textContent = n.x == null ? t("ed.np_sin_lugar_largo") : t("ed.np_en", [Math.round(n.x), Math.round(n.y)]);
    $("npPoner").classList.toggle("listo", poniendo);
  }
  $("npLista").addEventListener("change", () => ((elegido = $("npLista").value || null), (poniendo = false), pintar()));
  $("npNuevo").onclick = () => {
    let k = 1;
    while (lista().some((n) => n.id === "np" + k)) k++;
    const id = "np" + k;
    E.cambiar((est) => est.npcs.push({ id, nombre: { es: t("ed.np_nuevo_es"), en: t("ed.np_nuevo_en") }, dialogo: { es: [], en: [] }, s: 1, anda: 0, img: {} }));
    elegido = id;
    poniendo = false;
    pintar();
    $("npNombreEs").focus();
    $("npNombreEs").select();
  };
  const texto = (id, max) => $(id).value.trim().slice(0, max);
  const lineas = (id) =>
    $(id)
      .value.split("\n")
      .map((s) => s.trim().slice(0, 240))
      .filter(Boolean)
      .slice(0, 30);
  $("npNombreEs").addEventListener("change", () => cambiar((n) => (n.nombre = Object.assign({}, n.nombre, { es: texto("npNombreEs", 40) }))));
  $("npNombreEn").addEventListener("change", () => cambiar((n) => (n.nombre = Object.assign({}, n.nombre, { en: texto("npNombreEn", 40) }))));
  $("npDialogoEs").addEventListener("change", () => cambiar((n) => (n.dialogo = Object.assign({}, n.dialogo, { es: lineas("npDialogoEs") }))));
  $("npDialogoEn").addEventListener("change", () => cambiar((n) => (n.dialogo = Object.assign({}, n.dialogo, { en: lineas("npDialogoEn") }))));
  $("npTam").addEventListener("input", () => ($("npTamV").textContent = t("ed.np_metros", [((ALTO * +$("npTam").value) / 30).toFixed(1)])));
  $("npTam").addEventListener("change", () => cambiar((n) => (n.s = +$("npTam").value)));
  $("npAnda").addEventListener("change", () => cambiar((n) => (+$("npAnda").value ? (n.anda = +$("npAnda").value) : delete n.anda)));
  $("npPoner").onclick = () => {
    poniendo = !poniendo;
    if (poniendo) E.avisar(t("ed.np_poner_aviso"));
    pintar();
  };
  $("npIr").onclick = () => {
    const n = actual();
    if (!n || n.x == null) return;
    E.cam.x = n.x;
    E.cam.y = n.y;
    E.cam.z = Math.max(E.cam.z, 0.7);
    E.pedir();
  };
  $("npProbar").onclick = () => {
    const n = actual();
    if (!n || n.x == null) return E.avisar(t("ed.np_sin_lugar_largo"));
    const lang = new URLSearchParams(location.search).get("lang");
    open("index.html?borrador=1&jugar=9&en=" + Math.round(n.x) + "," + Math.round(n.y + 160) + (lang ? "&lang=" + lang : ""), "_blank");
  };
  $("npBorrar").onclick = () => {
    const n = actual();
    if (!n || !confirm(t("ed.np_borrar_seguro", [nombreDe(n)]))) return;
    const id = n.id;
    E.cambiar((est) => (est.npcs = est.npcs.filter((q) => q.id !== id)));
    elegido = null;
    pintar();
  };
  $("npCerrar").onclick = () => cerrar();

  // ---------- en el mapa ----------
  function medidas(n) {
    const im = imagen(n.img && n.img.S),
      h = ALTO * (n.s || 1);
    return [im ? (h * im.naturalWidth) / im.naturalHeight : h * 0.5, h];
  }
  function dibujar(c, cam, V) {
    lista().forEach((n) => {
      if (n.x == null) return;
      const p = arrastre && arrastre.id === n.id ? arrastre : n;
      const [vx, vy] = V(p.x, p.y),
        [w, h] = medidas(n),
        im = imagen(n.img && n.img.S);
      c.save();
      c.fillStyle = "rgba(0,0,0,0.4)";
      c.beginPath();
      c.ellipse(vx, vy, Math.max(16, w * 0.38), 6 * (n.s || 1), 0, 0, Math.PI * 2);
      c.fill();
      if (im) c.drawImage(im, vx - w / 2, vy - h, w, h);
      else {
        c.fillStyle = "#4A3C34";
        c.fillRect(vx - w / 2, vy - h, w, h);
      }
      if (abierta() && n.id === elegido) {
        c.strokeStyle = "#73D5DB";
        c.lineWidth = 2 / cam.z;
        c.setLineDash([8 / cam.z, 6 / cam.z]);
        c.strokeRect(vx - w / 2 - 6, vy - h - 6, w + 12, h + 12);
        c.setLineDash([]);
      }
      c.translate(vx, vy - h - 10);
      c.scale(1 / cam.z, 1 / cam.z);
      c.font = "bold 13px system-ui, sans-serif";
      c.textAlign = "center";
      const txt = nombreDe(n),
        tw = c.measureText(txt).width + 14;
      c.fillStyle = "rgba(17,17,17,0.85)";
      c.fillRect(-tw / 2, -20, tw, 20);
      c.fillStyle = "#E0B2B2";
      c.fillText(txt, 0, -6);
      c.restore();
    });
  }
  function clic(x, y) {
    if (poniendo && actual()) {
      poniendo = false;
      cambiar((n) => ((n.x = Math.round(x)), (n.y = Math.round(y))));
      E.avisar(t("ed.np_puesto"));
      return true;
    }
    if (E.herr() !== "mover") return false;
    const n = lista().find((q) => {
      if (q.x == null) return false;
      const [w, h] = medidas(q);
      return Math.abs(x - q.x) < w / 2 + 10 && y < q.y + 12 && y > q.y - h - 10;
    });
    if (!n) return false;
    elegido = n.id;
    arrastre = { id: n.id, x: n.x, y: n.y, dx: x - n.x, dy: y - n.y };
    if (abierta()) pintar();
    return true;
  }
  $("mapa").addEventListener("pointermove", (ev) => {
    if (!arrastre) return;
    const [x, y] = E.aMundo(ev.offsetX, ev.offsetY);
    arrastre.x = Math.round(x - arrastre.dx);
    arrastre.y = Math.round(y - arrastre.dy);
    E.pedir();
  });
  addEventListener("pointerup", () => {
    if (!arrastre) return;
    const a = arrastre;
    arrastre = null;
    const n = lista().find((q) => q.id === a.id);
    if (!n || (n.x === a.x && n.y === a.y)) return E.pedir();
    E.cambiar((est) => {
      const q = est.npcs.find((o) => o.id === a.id);
      if (q) (q.x = a.x), (q.y = a.y);
    });
    if (abierta()) pintar();
  });

  // ---------- abrir y cerrar ----------
  const abierta = () => !caja.classList.contains("oculto");
  function abrir() {
    E.usar("npcs");
    caja.classList.remove("oculto");
    pintar();
    if (window.EDITOR_IMPORTAR) EDITOR_IMPORTAR.pintar();
  }
  function cerrar() {
    caja.classList.add("oculto");
    poniendo = false;
    E.pedir();
  }
  $("hNpc").onclick = () => (abierta() ? cerrar() : abrir());
  return { abrir, cerrar, abierta, alternar: () => (abierta() ? cerrar() : abrir()), dibujar, clic, poniendo: () => poniendo, preparar, miniatura };
})();
