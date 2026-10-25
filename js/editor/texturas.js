// ---------- el generador de texturas (tecla Y) ----------
// Se arma una textura que se repite sin costura y se guarda como asset propio, con nombre, para ponerla en el mapa:
// un parche pintado en el piso, un bloque bajo (losa, plataforma) o los dos (mundo/texturas.js los dibuja).
// Tres formas de hacerla:
// - a mano: un tipo (pasto, tierra, adoquines, tablas, musgo, nieve, hojas, ceniza, runas, barro, arena, paja, hielo,
//   ladrillos), sus cuatro colores (con el muestrario del juego y botones de tono), tamaño, densidad y semilla, o una
//   de seis variantes, o «Sorprendeme»;
// - con la IA del panel 8 (Claude, ChatGPT o Gemini): se le describe y contesta una receta, que se dibuja con caras
//   planas como el resto del juego; «Afinar» le pide un cambio a la receta que se está viendo;
// - como imagen: ChatGPT (gpt-image-1) o Gemini la generan, o se sube, se arrastra o se pega una; se ajusta (brillo,
//   contraste, saturación, cuántos colores), se pasa a los colores del juego y se espeja en cuatro para que no tenga
//   costura. La original queda en memoria mientras el panel está abierto, así cada ajuste se rehace sobre ella.
// Además: cómo se ve en el mapa (forma del parche, escala de la textura, alto y fondo del bloque), vista en el piso,
// «Volver» a lo de antes, duplicar, bajar el PNG, cuántas veces está puesta, elegir todo lo puesto, cambiar lo elegido
// a esta textura y el modo «Textura» del pincel (B) que la pinta a trazos.
// Lo guardado va a AGREGADOS.texturas (y con eso al juego). Las claves de la IA siguen solo en este navegador.
window.EDITOR_TEXTURAS = (function () {
  "use strict";
  const E = window.EDITOR,
    T = window.TEXTURAS,
    t = E.t,
    $ = (id) => document.getElementById(id);
  const panel = $("txPanel"),
    vista = $("txVista"),
    cv = vista.getContext("2d");
  const MODELO_IMAGEN = { chatgpt: "gpt-image-1", gemini: "gemini-2.5-flash-image" };
  // actual: { receta } o { img, orig } (orig: la imagen sin procesar, solo en memoria)
  let actual = { receta: { tipo: "pasto", colores: T.COLORES.pasto.slice(), tam: 24, dens: 5, sem: 1 } },
    editando = null, // el id de la textura guardada que se está cambiando
    pensando = false,
    slot = 0; // el color que cambia el muestrario
  const antes = []; // «Volver»: lo que se estaba viendo antes de cada cambio grande
  const rnd = (n) => 1 + Math.floor(Math.random() * n);
  function recordar() {
    antes.push(JSON.stringify({ actual: Object.assign({}, actual, { orig: undefined }), forma: $("txForma").value, k: $("txK").value }));
    if (antes.length > 30) antes.shift();
  }

  // ---------- el panel ----------
  $("txTipo").innerHTML = T.TIPOS.map((k) => `<option value="${k}">${t("ed.tx_t_" + k)}</option>`).join("");
  const colores = () => [0, 1, 2, 3].map((i) => $("txC" + i).value.toUpperCase());
  function aReceta() {
    actual = { receta: { tipo: $("txTipo").value, colores: colores(), tam: +$("txTam").value, dens: +$("txDens").value, sem: (actual.receta && actual.receta.sem) || 1 } };
    pintar();
  }
  function aPanel() {
    const rc = actual.receta;
    $("txManual").classList.toggle("oculto", !rc);
    $("txImagen").classList.toggle("oculto", !!rc);
    $("txAfinar").disabled = !rc;
    if (rc) {
      $("txTipo").value = rc.tipo;
      rc.colores.forEach((h, i) => ($("txC" + i).value = h));
      $("txTam").value = rc.tam;
      $("txDens").value = rc.dens;
    }
    pintar();
  }
  // lo que se guarda con la textura además de la receta o la imagen
  const ajustes = () => ({ forma: $("txForma").value, k: +$("txK").value, h: +$("txAlto").value, d: +$("txFondo").value });
  // la vista: la textura dos por dos (se ve que no tiene costura), o puesta en el piso como parche o como bloque
  let pintarT = 0;
  function pintar() {
    clearTimeout(pintarT);
    const ver = $("txVer").value,
      W = vista.width,
      dibujar = () => {
        const l = T.lienzoDe(actual);
        cv.fillStyle = ver === "cuadro" ? "#111111" : "#34492A";
        cv.fillRect(0, 0, W, W);
        if (!l) return (pintarT = setTimeout(dibujar, 60));
        if (ver === "cuadro") {
          for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) cv.drawImage(l, (i * W) / 2, (j * W) / 2, W / 2, W / 2);
          return;
        }
        // el pasto del bosque de fondo, con algunas matas, y la textura como queda en el mapa (más chica)
        cv.fillStyle = "#3E5A2C";
        for (let i = 0; i < 9; i++) cv.fillRect(((i * 53) % W) - 4, ((i * 97) % W) - 2, 26, 5);
        const tx = Object.assign({ receta: actual.receta, img: actual.img }, ajustes());
        cv.save();
        cv.translate(W / 2, W * (ver === "bloque" ? 0.72 : 0.56));
        cv.scale(0.38, 0.38);
        T.dibujarCon(cv, tx, ver, 0, 0, performance.now() / 1000, {});
        cv.restore();
      };
    dibujar();
    $("txTamV").textContent = $("txTam").value;
    $("txDensV").textContent = $("txDens").value;
    $("txKV").textContent = (+$("txK").value).toFixed(1);
    $("txAltoV").textContent = $("txAlto").value;
    $("txFondoV").textContent = $("txFondo").value;
    $("txMedBloque").classList.toggle("oculto", $("txUso").value === "parche");
    // lo que pesa: una receta casi nada, una imagen lo que mide su PNG
    if (actual.img) estado(t("ed.tx_peso", [Math.round((actual.img.length * 0.75) / 1024)]));
  }
  $("txTipo").addEventListener("change", () => {
    recordar();
    T.COLORES[$("txTipo").value].forEach((h, i) => ($("txC" + i).value = h));
    aReceta();
  });
  ["txC0", "txC1", "txC2", "txC3", "txTam", "txDens"].forEach((id) => $(id).addEventListener("input", aReceta));
  ["txC0", "txC1", "txC2", "txC3"].forEach((id, i) => $(id).addEventListener("pointerdown", () => elegirSlot(i)));
  ["txVer", "txForma", "txK", "txAlto", "txFondo", "txUso"].forEach((id) => $(id).addEventListener("input", pintar));
  function elegirSlot(i) {
    slot = i;
    [0, 1, 2, 3].forEach((k) => $("txC" + k).classList.toggle("activo", k === i));
  }
  elegirSlot(0);
  $("txSemilla").onclick = () => {
    recordar();
    if (!actual.receta) aReceta();
    actual.receta.sem = rnd(9999);
    pintar();
  };
  // sorprendeme: un tipo al azar con sus colores apenas corridos, y tamaño y densidad al azar
  $("txSorpresa").onclick = () => {
    recordar();
    const tipo = T.TIPOS[Math.floor(Math.random() * T.TIPOS.length)],
      corr = (Math.random() - 0.5) * 0.3;
    actual = { receta: { tipo, colores: T.COLORES[tipo].map((h) => T.aclarar(h, corr + (Math.random() - 0.5) * 0.12).toUpperCase()), tam: 12 + rnd(36), dens: 2 + rnd(8), sem: rnd(9999) } };
    aPanel();
  };
  // el muestrario: los colores del juego; un toque cambia el color elegido (el que tiene el borde dorado)
  const hex = (p) => "#" + p.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  T.coloresDelJuego()
    .map(hex)
    .filter((h, i, l) => l.indexOf(h) === i)
    .slice(0, 56)
    .forEach((h) => {
      const b = document.createElement("button");
      b.style.background = h;
      b.title = h;
      b.onclick = () => {
        recordar();
        $("txC" + slot).value = h;
        aReceta();
        elegirSlot((slot + 1) % 4);
      };
      $("txMuestras").appendChild(b);
    });
  // tonos: los cuatro colores juntos, más claros, más oscuros, más cálidos o más fríos
  panel.querySelectorAll("[data-tono]").forEach((b) => {
    b.onclick = () => {
      recordar();
      const k = b.dataset.tono;
      colores().forEach((h, i) => {
        let n = h;
        if (k === "claro") n = T.aclarar(h, 0.12);
        else if (k === "oscuro") n = T.aclarar(h, -0.12);
        else {
          const v = parseInt(h.slice(1), 16),
            c = [(v >> 16) & 255, (v >> 8) & 255, v & 255],
            d = k === "calido" ? [14, 4, -12] : [-12, 2, 14];
          n = hex(c.map((x, j) => Math.max(0, Math.min(255, x + d[j]))));
        }
        $("txC" + i).value = n;
      });
      aReceta();
    };
  });
  // seis variantes de la misma receta con otra semilla: un toque la elige
  $("txVariantes").onclick = () => {
    if (!actual.receta) return;
    const l = $("txVariantesL");
    l.innerHTML = "";
    l.classList.remove("oculto");
    for (let i = 0; i < 6; i++) {
      const rc = Object.assign({}, actual.receta, { sem: rnd(9999) }),
        m = document.createElement("canvas");
      m.width = m.height = 64;
      m.getContext("2d").drawImage(T.generar(rc), 0, 0, 64, 64);
      m.onclick = () => {
        recordar();
        actual = { receta: rc };
        l.classList.add("oculto");
        aPanel();
      };
      l.appendChild(m);
    }
  };
  $("txVolver").onclick = () => {
    const s = antes.pop();
    if (!s) return;
    const v = JSON.parse(s);
    actual = v.actual;
    $("txForma").value = v.forma;
    $("txK").value = v.k;
    aPanel();
  };
  ["txNomEs", "txNomEn", "txPedido"].forEach((id) => $(id).addEventListener("keydown", (e) => e.stopPropagation()));
  // Enter en un nombre guarda
  ["txNomEs", "txNomEn"].forEach((id) => $(id).addEventListener("keydown", (e) => e.key === "Enter" && guardarla()));
  function estado(txt, error) {
    $("txEstado").textContent = txt || "";
    $("txEstado").classList.toggle("error", !!error);
  }

  // ---------- con IA ----------
  const SISTEMA_RECETA = () =>
    [
      "You design seamless ground textures for Eromash, a 2.5D Norse adventure game drawn with flat faces, no outlines, light from the upper right.",
      "A texture is a recipe drawn by the game: tipo is one of " + T.TIPOS.join(", ") + ".",
      "colores are four hex colors: background, tone 1, tone 2, and highlight (or glow, for runas and ceniza). Stay close to the game's palette: " + T.coloresDelJuego().slice(0, 60).map(hex).join(" ") + ".",
      "tam is the size of the shapes in pixels (6 to 80) and dens their density (1 to 12).",
      'Answer only with one JSON object: {"tipo": string, "colores": [4 hex], "tam": number, "dens": number, "nombre": {"es": string, "en": string}}. The names are short (two or three words), in Spanish and English.',
    ].join("\n");
  const PEDIDO_IMAGEN = (p) =>
    "A seamless tileable square texture, seen from straight above, of: " + p + ". Stylized for a Norse 2.5D game: flat low-poly shapes with hard edges, no outlines, no gradients, no text, no border, no perspective, soft light from the upper right, earthy muted forest palette with dark greens, browns and stone greys. The pattern fills the whole square evenly.";
  async function imagenDe(quien, clave, pedido) {
    if (quien === "chatgpt") {
      const r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + clave },
        body: JSON.stringify({ model: MODELO_IMAGEN.chatgpt, prompt: PEDIDO_IMAGEN(pedido), size: "1024x1024", n: 1 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error((j.error && j.error.message) || r.status);
      return "data:image/png;base64," + j.data[0].b64_json;
    }
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + MODELO_IMAGEN.gemini + ":generateContent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": clave },
      body: JSON.stringify({ contents: [{ parts: [{ text: PEDIDO_IMAGEN(pedido) }] }], generationConfig: { responseModalities: ["IMAGE"] } }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error((j.error && j.error.message) || r.status);
    const parte = ((j.candidates && j.candidates[0] && j.candidates[0].content.parts) || []).find((q) => q.inlineData);
    if (!parte) throw new Error(t("ed.tx_sin_imagen"));
    return "data:" + (parte.inlineData.mimeType || "image/png") + ";base64," + parte.inlineData.data;
  }
  const cargarImagen = (src) =>
    new Promise((ok, mal) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = () => mal(new Error(t("ed.tx_sin_imagen")));
      im.src = src;
    });
  const opcImagen = () => ({ paleta: $("txPaleta").checked, espejo: $("txEspejo").checked, colores: +$("txNColores").value, brillo: +$("txBrillo").value, contraste: +$("txContraste").value, saturacion: +$("txSaturacion").value, liviana: $("txLiviana").checked });
  async function desdeImagen(src) {
    recordar();
    const im = await cargarImagen(src);
    actual = { img: T.procesar(im, opcImagen()), orig: im };
    aPanel();
  }
  // cada ajuste se rehace sobre la imagen original (si ya no está, por ejemplo al abrir una guardada, se avisa)
  let ajusteT = 0;
  ["txPaleta", "txEspejo", "txNColores", "txBrillo", "txContraste", "txSaturacion", "txLiviana"].forEach((id) =>
    $(id).addEventListener("input", () => {
      if (actual.receta) return;
      if (!actual.orig) return estado(t("ed.tx_rehacer"));
      clearTimeout(ajusteT);
      ajusteT = setTimeout(() => {
        actual = { img: T.procesar(actual.orig, opcImagen()), orig: actual.orig };
        pintar();
      }, 120);
    }),
  );
  // la IA de cada fuente: la receta y la imagen las elige el panel IA (8) según la tarea; ChatGPT y Gemini, fijas
  function claveDe(fuente) {
    const IA = window.EDITOR_IA;
    if (fuente === "receta" || fuente === "imagen") {
      const k = IA && IA.paraTarea(fuente);
      if (!k) estado(t(fuente === "imagen" ? "ed.tx_falta_imagen" : "ed.ia_sin_ninguna"), true);
      return k;
    }
    const clave = IA && ((IA.paraTarea("mapa") || {}).claves || {})[fuente];
    if (!clave) {
      estado(t("ed.tx_falta_clave", [fuente === "chatgpt" ? "ChatGPT" : "Gemini"]), true);
      return null;
    }
    return { quien: fuente, clave };
  }
  // una imagen con la IA de la tarea «imagen»: si la primera falla, la siguiente
  async function imagenTarea(pedido) {
    const IA = window.EDITOR_IA,
      l = IA.candidatas("imagen"),
      claves = IA.paraTarea("imagen").claves;
    let error = null;
    for (const q of l) {
      try {
        estado(t("ed.tx_pensando_con", [IA.NOMBRES[q]]));
        return await imagenDe(q, claves[q], pedido);
      } catch (e) {
        error = e;
      }
    }
    throw error;
  }
  function leerReceta(txt) {
    const js = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1)),
      tipo = T.TIPOS.includes(js.tipo) ? js.tipo : "pasto",
      col = Array.isArray(js.colores) && js.colores.length === 4 && js.colores.every((h) => /^#[0-9a-f]{6}$/i.test(h)) ? js.colores.map((h) => h.toUpperCase()) : T.COLORES[tipo].slice();
    recordar();
    actual = { receta: { tipo, colores: col, tam: Math.max(6, Math.min(80, +js.tam || 24)), dens: Math.max(1, Math.min(12, +js.dens || 5)), sem: (actual.receta && actual.receta.sem) || rnd(9999) } };
    if (js.nombre && !$("txNomEs").value) ($("txNomEs").value = js.nombre.es || ""), ($("txNomEn").value = js.nombre.en || "");
    aPanel();
  }
  async function conIA(fn) {
    if (pensando) return;
    pensando = true;
    $("txGenerar").disabled = $("txAfinar").disabled = true;
    estado(t("ed.tx_pensando"));
    try {
      await fn();
      estado(t("ed.tx_lista"));
    } catch (e) {
      estado(t("ed.ia_error", [String(e.message || e)]), true);
    }
    pensando = false;
    $("txGenerar").disabled = false;
    $("txAfinar").disabled = !actual.receta;
  }
  function generar() {
    const pedido = $("txPedido").value.trim(),
      fuente = $("txFuente").value;
    if (!pedido) return estado(t("ed.ia_falta_pedido"), true);
    const k = claveDe(fuente);
    if (!k) return;
    E.usar("tx_generar");
    conIA(async () => {
      if (fuente === "receta") leerReceta((await EDITOR_IA.llamarTarea("receta", [{ role: "user", content: pedido }], SISTEMA_RECETA())).txt);
      else if (fuente === "imagen") await desdeImagen(await imagenTarea(pedido));
      else await desdeImagen(await imagenDe(fuente, k.clave, pedido));
    });
  }
  // afinar: la receta que se está viendo y el cambio pedido («más oscura», «piedras más grandes»)
  function afinar() {
    const pedido = $("txPedido").value.trim();
    if (!pedido || !actual.receta) return estado(t("ed.ia_falta_pedido"), true);
    const k = claveDe("receta");
    if (!k) return;
    E.usar("tx_afinar");
    conIA(async () => leerReceta((await EDITOR_IA.llamarTarea("receta", [{ role: "user", content: "Current recipe: " + JSON.stringify(actual.receta) + "\nChange it like this, keep the rest: " + pedido }], SISTEMA_RECETA())).txt));
  }
  $("txGenerar").onclick = generar;
  $("txAfinar").onclick = afinar;
  $("txPedido").addEventListener("keydown", (e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && generar());
  $("txSubir").onclick = () => $("txArchivo").click();
  function desdeArchivo(f) {
    if (!f || !/^image\//.test(f.type)) return;
    const lector = new FileReader();
    lector.onload = () => desdeImagen(lector.result).then(() => estado(t("ed.tx_lista")), (e) => estado(String(e.message || e), true));
    lector.readAsDataURL(f);
    if (!$("txNomEs").value && f.name) $("txNomEs").value = f.name.replace(/\.[^.]+$/, "");
  }
  $("txArchivo").addEventListener("change", () => {
    const f = $("txArchivo").files[0];
    $("txArchivo").value = "";
    desdeArchivo(f);
  });
  // arrastrar una imagen al panel, o pegarla (Ctrl+V) con el panel abierto
  panel.addEventListener("dragover", (e) => (e.preventDefault(), panel.classList.add("soltando")));
  panel.addEventListener("dragleave", () => panel.classList.remove("soltando"));
  panel.addEventListener("drop", (e) => {
    e.preventDefault();
    panel.classList.remove("soltando");
    desdeArchivo(e.dataTransfer.files[0]);
  });
  addEventListener("paste", (e) => {
    if (!abierta() || !e.clipboardData) return;
    const it = [...e.clipboardData.items].find((q) => /^image\//.test(q.type));
    if (!it) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    desdeArchivo(it.getAsFile());
  });
  // bajar el cuadro como PNG (para usarlo en otro lado)
  $("txBajar").onclick = () => {
    const l = T.lienzoDe(actual);
    if (!l) return;
    const a = document.createElement("a");
    a.href = l.toDataURL("image/png");
    a.download = (T.idDe($("txNomEs").value) || "textura") + ".png";
    a.click();
  };

  // ---------- guardar en los assets ----------
  function guardarla() {
    const es = $("txNomEs").value.trim();
    if (!es) return estado(t("ed.tx_falta_nombre"), true), $("txNomEs").focus();
    const en = $("txNomEn").value.trim() || es,
      tabla = E.est().texturas || {};
    let id = editando || T.idDe(es);
    if (!editando) for (let n = 2; tabla[id]; n++) id = T.idDe(es) + "_" + n;
    const tx = Object.assign({ nombre: { es, en }, uso: $("txUso").value }, ajustes());
    if (actual.receta) tx.receta = JSON.parse(JSON.stringify(actual.receta));
    else tx.img = actual.img;
    E.cambiar((est) => ((est.texturas = est.texturas || {})[id] = tx));
    editando = id;
    pintarLista();
    E.usar("tx_guardar");
    E.avisar(t("ed.tx_guardada", [es]));
    // lista para poner: el parche (o el bloque) queda elegido en la lista de objetos
    E.elegir((tx.uso === "bloque" ? "txb_" : "tx_") + id);
  }
  $("txGuardar").onclick = guardarla;
  $("txNueva").onclick = () => {
    recordar();
    editando = null;
    $("txNomEs").value = $("txNomEn").value = "";
    $("txUso").value = "parche";
    actual = { receta: { tipo: $("txTipo").value, colores: colores(), tam: +$("txTam").value, dens: +$("txDens").value, sem: rnd(9999) } };
    aPanel();
    pintarLista();
  };
  // duplicar: la misma, como una nueva (se guarda con otro nombre)
  $("txDuplicar").onclick = () => {
    editando = null;
    if ($("txNomEs").value) $("txNomEs").value = t("ed.tx_copia", [$("txNomEs").value]);
    if ($("txNomEn").value) $("txNomEn").value = I18N.lang === "en" ? t("ed.tx_copia", [$("txNomEn").value]) : $("txNomEn").value + " (copy)";
    pintarLista();
    estado(t("ed.tx_duplicada"));
  };
  const idsDe = (id) => ["tx_" + id, "txb_" + id];
  const usos = (id) => E.est().poner.filter((a) => idsDe(id).includes(a.id)).length;
  $("txElegirPuesto").onclick = () => {
    if (!editando) return estado(t("ed.tx_elegi_una"), true);
    const n = E.elegirIds(idsDe(editando));
    estado(n ? t("ed.caja_elegidos", [n]) : t("ed.tx_no_puesta"), !n);
  };
  // cambiar lo elegido en el mapa (parches o bloques de otra textura) a esta
  $("txReemplazar").onclick = () => {
    if (!editando) return estado(t("ed.tx_elegi_una"), true);
    const id = editando,
      n = E.reemplazarElegidos((viejo) => (/^txb_/.test(viejo) ? (ASSETS.LISTA["txb_" + id] ? "txb_" + id : null) : /^tx_/.test(viejo) ? (ASSETS.LISTA["tx_" + id] ? "tx_" + id : null) : null));
    estado(n ? t("ed.tx_reemplazados", [n]) : t("ed.tx_nada_reemplazo"), !n);
    pintarLista();
  };
  function pintarLista() {
    if (!abierta()) return;
    const tabla = E.est().texturas || {},
      ul = $("txLista");
    ul.innerHTML = "";
    $("txTuyas").classList.toggle("oculto", !Object.keys(tabla).length);
    Object.keys(tabla).forEach((id) => {
      const tx = tabla[id],
        li = document.createElement("button"),
        m = document.createElement("canvas");
      li.className = "txFicha" + (id === editando ? " elegido" : "");
      m.width = m.height = 48;
      const pintarMini = () => {
        const l = T.lienzo(id);
        if (!l) return setTimeout(pintarMini, 80);
        m.getContext("2d").drawImage(l, 0, 0, 48, 48);
      };
      pintarMini();
      const s = document.createElement("span"),
        n = usos(id);
      s.textContent = (tx.nombre && (tx.nombre[I18N.lang] || tx.nombre.es)) || id;
      const u = document.createElement("small");
      u.textContent = n ? "×" + n : "";
      const x = document.createElement("i");
      x.textContent = "×";
      x.title = t("ed.tx_sacar");
      li.append(m, s, u, x);
      li.onclick = (e) => {
        if (e.target === x) {
          if (!confirm(t("ed.tx_sacar_seguro", [s.textContent]))) return;
          E.cambiar((est) => delete est.texturas[id]);
          if (editando === id) editando = null;
          return pintarLista();
        }
        recordar();
        editando = id;
        $("txNomEs").value = tx.nombre.es || "";
        $("txNomEn").value = tx.nombre.en || "";
        $("txUso").value = tx.uso || "parche";
        $("txForma").value = tx.forma || "quebrado";
        $("txK").value = tx.k || 1;
        $("txAlto").value = tx.h || 26;
        $("txFondo").value = tx.d || 70;
        actual = tx.receta ? { receta: JSON.parse(JSON.stringify(tx.receta)) } : { img: tx.img };
        aPanel();
        pintarLista();
      };
      ul.appendChild(li);
    });
  }

  function abrir() {
    E.usar("texturas");
    panel.classList.remove("oculto");
    $("hTexturas").classList.add("activo");
    pintarLista();
    aPanel();
  }
  function cerrar() {
    panel.classList.add("oculto");
    $("hTexturas").classList.remove("activo");
    $("txVariantesL").classList.add("oculto");
  }
  const abierta = () => !panel.classList.contains("oculto");
  const alternar = () => (abierta() ? cerrar() : abrir());
  $("txCerrar").onclick = cerrar;
  $("hTexturas").onclick = alternar;
  // la vista en el piso late con lo que brilla solo (runas, brasas)
  setInterval(() => abierta() && $("txVer").value !== "cuadro" && actual.receta && T.BRILLAN[actual.receta.tipo] && pintar(), 120);
  function tecla(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (e.key === "y" || e.key === "Y") return alternar(), true;
    if (e.key === "Escape" && abierta()) return cerrar(), true;
    return false;
  }
  return { abrir, cerrar, alternar, abierta, tecla, pintarLista };
})();
