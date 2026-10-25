// ---------- hablar con una IA adentro del editor ----------
// Se elige una zona (con Mover, arrastrando un rectángulo; si no, lo que se ve), se le pide algo («un claro con un
// campamento abandonado», «tres casas mirando al camino») y la IA devuelve qué poner, qué caminos trazar y qué sacar.
// Se ve primero como vista previa y recién se aplica con «Aplicar» (y se deshace con Ctrl+Z, como todo).
// Claude, ChatGPT y Gemini se llaman directo desde el navegador con la clave de cada uno, que se guarda solo en este
// navegador (nunca en un archivo). Con «Otra» (Cursor o cualquier chat) se copia el pedido y se pega la respuesta.
window.EDITOR_IA = (function () {
  "use strict";
  const E = window.EDITOR,
    t = E.t,
    $ = (id) => document.getElementById(id);
  const CLAVE = "eromash-aventura-editor-ia";
  const MODELOS = { claude: "claude-opus-5-5", chatgpt: "gpt-5", gemini: "gemini-2.5-pro", otra: "" };
  const NOMBRES = { claude: "Claude", chatgpt: "ChatGPT", gemini: "Gemini", otra: "?" };
  // ---------- qué IA hace cada tarea ----------
  // Se guardan las claves de las tres a la vez. Cada tarea tiene su orden de preferencia (la mejor para eso primero) y,
  // en automático, usa la primera que tenga clave; si esa falla, prueba con la siguiente. Se puede fijar una a mano.
  //   mapa: pedidos del mapa (este chat): JSON largo pensando en el espacio → Claude, ChatGPT, Gemini
  //   boceto: mirar una foto y leer un dibujo → Claude, Gemini, ChatGPT
  //   imagen: crear una imagen (texturas): Claude no hace imágenes → ChatGPT (gpt-image-1), Gemini
  //   receta: una receta corta de textura → Claude, ChatGPT, Gemini
  //   generar: casas y zonas desde un texto (JSON chico) → Claude, Gemini, ChatGPT
  const TAREAS = {
    mapa: ["claude", "chatgpt", "gemini"],
    boceto: ["claude", "gemini", "chatgpt"],
    imagen: ["chatgpt", "gemini"],
    receta: ["claude", "chatgpt", "gemini"],
    generar: ["claude", "gemini", "chatgpt"],
  };
  let conf = { quien: "auto", modelos: {}, claves: {}, tareas: {} };
  try {
    conf = Object.assign(conf, JSON.parse(localStorage.getItem(CLAVE) || "{}"));
  } catch (e) {}
  conf.tareas = conf.tareas || {};
  // lo de antes: la IA elegida para el chat era «quien»; ahora el chat es la tarea «mapa»
  if (conf.quien !== "otra" && conf.quien !== "auto" && !conf.tareas.mapa) conf.tareas.mapa = conf.quien;
  if (conf.quien !== "otra") conf.quien = "auto";
  const tiene = (q) => !!(conf.claves[q] || "").trim();
  const modeloDe = (q) => conf.modelos[q] || MODELOS[q];
  // las IA que van a hacer una tarea, en orden: la fijada a mano primero (si tiene clave), después las demás con clave
  function candidatas(tarea) {
    const orden = TAREAS[tarea] || TAREAS.mapa,
      fija = conf.tareas[tarea];
    const l = (fija && fija !== "auto" && orden.includes(fija) ? [fija].concat(orden.filter((q) => q !== fija)) : orden).filter(tiene);
    return fija && fija !== "auto" && tiene(fija) ? [fija] : l;
  }
  function paraTarea(tarea) {
    const q = candidatas(tarea)[0];
    return q ? { quien: q, modelo: modeloDe(q), clave: conf.claves[q], claves: conf.claves, nombre: NOMBRES[q] } : null;
  }
  // llamar a la IA de una tarea: mensajes puede ser una función (quien) → mensajes (cada una pide la imagen a su modo);
  // si una falla, se prueba con la siguiente. Devuelve { txt, quien }
  async function llamarTarea(tarea, mensajes, sistema, alProbar) {
    const l = candidatas(tarea);
    if (!l.length) throw new Error(t("ed.ia_sin_ninguna"));
    let error = null;
    for (const q of l) {
      if (alProbar) alProbar(NOMBRES[q]);
      try {
        const txt = await llamar(q, modeloDe(q), conf.claves[q], typeof mensajes === "function" ? mensajes(q) : mensajes, sistema);
        return { txt, quien: q, nombre: NOMBRES[q] };
      } catch (e) {
        error = e;
      }
    }
    throw error;
  }
  const guardarConf = () => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(conf));
    } catch (e) {}
  };
  const panel = $("iaPanel");
  let conv = [], // la conversación: [{ role: "user" | "assistant", content }]
    propuesta = null, // lo que propuso la IA, a la vista hasta aplicarlo o descartarlo
    pensando = false;

  // ---------- el panel ----------
  // «Tus IA»: modelo y clave de cada una; «Qué hace cada una»: por tarea, automática o fijada
  function pintarConf() {
    const otra = conf.quien === "otra";
    $("iaModo").value = otra ? "otra" : "auto";
    $("iaClaveAyuda").textContent = t(otra ? "ed.ia_otra_ayuda" : "ed.ia_clave_ayuda");
    $("iaOtra").classList.toggle("oculto", !otra);
    $("iaEnviar").classList.toggle("oculto", otra);
    ["claude", "chatgpt", "gemini"].forEach((q) => {
      $("iaModelo_" + q).value = modeloDe(q);
      $("iaClave_" + q).value = conf.claves[q] || "";
      $("iaEstado_" + q).textContent = tiene(q) ? "✓" : "—";
      $("iaEstado_" + q).className = tiene(q) ? "si" : "";
    });
    const tabla = $("iaTareas");
    tabla.innerHTML = "";
    Object.keys(TAREAS).forEach((tarea) => {
      const fila = document.createElement("label"),
        sel = document.createElement("select"),
        auto = paraTarea(tarea) && (conf.tareas[tarea] || "auto") === "auto" ? NOMBRES[candidatas(tarea)[0]] : null;
      fila.className = "iaTarea";
      fila.innerHTML = `<span>${t("ed.ia_t_" + tarea)}<small>${t("ed.ia_t_" + tarea + "_por")}</small></span>`;
      sel.innerHTML =
        `<option value="auto">${t("ed.ia_auto")}${auto ? " · " + auto : ""}</option>` +
        TAREAS[tarea].map((q) => `<option value="${q}">${NOMBRES[q]}${tiene(q) ? "" : " " + t("ed.ia_sin_clave_corto")}</option>`).join("");
      sel.value = conf.tareas[tarea] || "auto";
      sel.addEventListener("change", () => {
        conf.tareas[tarea] = sel.value;
        guardarConf();
        pintarConf();
      });
      fila.appendChild(sel);
      tabla.appendChild(fila);
    });
    const ning = !["claude", "chatgpt", "gemini"].some(tiene);
    $("iaTodas").disabled = otra || conClave().length < 2;
    $("iaTodas").title = t("ed.ia_todas_tit", [conClave().map((q) => NOMBRES[q]).join(", ") || "—"]);
    $("iaSinNinguna").classList.toggle("oculto", !ning || otra);
    if (ning) $("iaTus").open = true;
  }
  $("iaModo").addEventListener("change", () => {
    conf.quien = $("iaModo").value;
    guardarConf();
    pintarConf();
  });
  ["claude", "chatgpt", "gemini"].forEach((q) => {
    $("iaModelo_" + q).addEventListener("change", () => {
      conf.modelos[q] = $("iaModelo_" + q).value.trim();
      guardarConf();
    });
    $("iaClave_" + q).addEventListener("change", () => {
      conf.claves[q] = $("iaClave_" + q).value.trim();
      guardarConf();
      pintarConf();
    });
    ["iaModelo_" + q, "iaClave_" + q].forEach((id) => $(id).addEventListener("keydown", (e) => e.stopPropagation()));
  });
  ["iaPedido", "iaRespuesta"].forEach((id) => $(id).addEventListener("keydown", (e) => e.stopPropagation()));
  $("iaPedido").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviar();
  });
  function pintarZona() {
    const z = E.zona(),
      [x0, y0, x1, y1] = z.caja;
    $("iaZona").textContent = t(z.deRect ? "ed.ia_zona_rect" : "ed.ia_zona_vista_txt", [Math.round((x1 - x0) / 30), Math.round((y1 - y0) / 30)]);
  }
  function abrir() {
    E.usar("ia");
    panel.classList.remove("oculto");
    pintarConf();
    pintarZona();
    setTimeout(() => $("iaPedido").focus(), 0);
    E.pedir();
  }
  function cerrar() {
    panel.classList.add("oculto");
    E.pedir();
  }
  const abierta = () => !panel.classList.contains("oculto");
  $("iaCerrar").onclick = cerrar;
  $("iaZonaVista").onclick = () => {
    E.olvidarZona();
    pintarZona();
    E.pedir();
  };
  setInterval(() => abierta() && pintarZona(), 700);
  function decir(txt, clase) {
    const p = document.createElement("p");
    if (clase) p.className = clase;
    p.textContent = txt;
    $("iaChat").appendChild(p);
    $("iaChat").scrollTop = $("iaChat").scrollHeight;
    return p;
  }

  // ---------- el pedido: qué es el mundo, la zona, qué hay ahí y qué objetos existen ----------
  const SISTEMA = [
    "You are a level designer helping build Eldervald, the forest world of Eromash, a 2.5D Norse adventure game seen from above at an angle.",
    "Coordinates are world units: 30 units are about 1 meter. x grows to the east, y grows to the south (down the screen). An object's x, y is where its foot touches the ground.",
    "Only change things inside the zone the user selected. Use only asset ids from the catalog. Each catalog line is: id | name | group | height | footprint (r = round radius, w = width) | 'ends' when it goes from one end to another.",
    "Objects with 'ends' (fences, walls, bridges, canals) also need o.x2 and o.y2: the world position of their second end.",
    "Optional fields in o: esc (size, 0.5 to 2), esp (true flips it), giro (degrees it turns on the ground), sem (integer variant), orden (draw order offset, multiples of 40).",
    "Roads are { p: [[x, y], ...], w: width (60 to 300), tipo: 'tierra' | 'adoquin' | 'ladrillo', borde: 'pasto' | 'musgo' | 'agua' | 'tierra' | '' }. A road that ends on another road joins it.",
    "To remove existing world objects, list them in quitar with the exact id, x and y from the existing list. Never remove story objects (historia: true).",
    "Design like a real place: every object has a reason to be there, solid things keep at least 40 units apart and never sit on a road, paths lead somewhere. Prefer named, specific assets over filler.",
    "Answer in the user's language. First a short explanation for the user (two or three sentences), then exactly one JSON object in a ```json block:",
    '{"explicacion": string, "poner": [{"id": string, "x": number, "y": number, "o": object}], "caminos": [road], "quitar": [{"id": string, "x": number, "y": number}]}',
    "At most 300 objects. If the request is unclear, make the most reasonable choice and say what you chose.",
  ].join("\n");
  function catalogo() {
    return ASSETS.catalogo()
      .map((a) => {
        const nom = t("as." + a.id),
          md = ASSETS.medidas(a.id, Object.assign({}, a.ejemplo)),
          ch = md.choque ? (md.choque.r ? "r" + Math.round(md.choque.r) : "w" + Math.round(md.choque.w || 0)) : "-";
        return [a.id, nom === "as." + a.id ? a.id : nom, a.grupo, Math.round(a.alto || 0), ch].join(" | ") + (a.ejemplo && a.ejemplo.x2 !== undefined ? " | ends" : "");
      })
      .join("\n");
  }
  function contexto(pedido) {
    const z = E.zona(),
      [x0, y0, x1, y1] = z.caja,
      cosas = E.cosasEn(x0, y0, x1, y1),
      // si hay demasiado, lo más importante primero (lo de la historia y lo agregado), después lo demás
      orden = cosas.sort((a, b) => (b.historia ? 2 : b.agregado ? 1 : 0) - (a.historia ? 2 : a.agregado ? 1 : 0)).slice(0, 260);
    return (
      "Request: " + pedido + "\n\n" +
      "Zone: x " + x0 + " to " + x1 + ", y " + y0 + " to " + y1 + " (" + Math.round((x1 - x0) / 30) + " m by " + Math.round((y1 - y0) / 30) + " m).\n" +
      "Existing objects in the zone (" + cosas.length + (cosas.length > orden.length ? ", showing " + orden.length : "") + "):\n" + JSON.stringify(orden) + "\n\n" +
      "Roads near the zone:\n" + JSON.stringify(E.caminosEn(x0, y0, x1, y1)) + "\n\n" +
      "Asset catalog:\n" + catalogo()
    );
  }

  // ---------- llamar a cada IA ----------
  // sistema: las instrucciones (las del mapa si no se dice otra cosa; las texturas mandan las suyas)
  // el contenido de un mensaje para Gemini: texto, o una lista como la de Claude (texto e imágenes, como el boceto)
  const partes = (ct) => (Array.isArray(ct) ? ct.map((p) => (p.type === "image" ? { inline_data: { mime_type: p.source.media_type, data: p.source.data } } : { text: p.text || "" })) : [{ text: ct }]);
  async function llamar(quien, modelo, clave, mensajes, sistema = SISTEMA) {
    if (quien === "claude") {
      const conRespaldo = /^claude-(opus-5-5|opus-5|fable-5-1|sonnet-5-5)$/.test(modelo),
        cuerpo = { model: modelo, max_tokens: 16000, system: sistema, messages: mensajes, output_config: { effort: "medium" } };
      if (conRespaldo) cuerpo.fallbacks = "default";
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: Object.assign(
          { "content-type": "application/json", "x-api-key": clave, "anthropic-version": "2026-10-21", "anthropic-dangerous-direct-browser-access": "true" },
          conRespaldo ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {},
        ),
        body: JSON.stringify(cuerpo),
      });
      const j = await r.json();
      if (!r.ok) throw new Error((j.error && j.error.message) || r.status);
      if (j.stop_reason === "refusal") throw new Error(t("ed.ia_rechazo"));
      return (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    }
    if (quien === "chatgpt") {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + clave },
        body: JSON.stringify({ model: modelo, messages: [{ role: "system", content: sistema }].concat(mensajes) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error((j.error && j.error.message) || r.status);
      return j.choices[0].message.content;
    }
    if (quien === "gemini") {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(modelo) + ":generateContent", {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": clave },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] }, contents: mensajes.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: partes(m.content) })) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error((j.error && j.error.message) || r.status);
      return ((j.candidates && j.candidates[0] && j.candidates[0].content.parts) || []).map((p) => p.text || "").join("\n");
    }
    throw new Error("?");
  }

  // ---------- leer lo que contestó: el texto para Alejandro y el JSON con los cambios ----------
  function leer(txt) {
    let js = null;
    const m = txt.match(/```(?:json)?\s*([\s\S]*?)```/);
    const crudo = m ? m[1] : txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1);
    try {
      js = JSON.parse(crudo);
    } catch (e) {}
    const texto = (m ? txt.replace(m[0], "") : js ? txt.slice(0, txt.indexOf("{")) : txt).trim() || (js && js.explicacion) || "";
    if (!js) return { texto, ops: null };
    // solo lo que existe y cae en la zona (con un margen), y a lo sumo 300
    const [x0, y0, x1, y1] = E.zona().caja,
      mg = 200,
      adentro = (x, y) => isFinite(x) && isFinite(y) && x > x0 - mg && x < x1 + mg && y > y0 - mg && y < y1 + mg;
    const poner = (Array.isArray(js.poner) ? js.poner : [])
      .filter((a) => a && ASSETS.LISTA[a.id] && adentro(+a.x, +a.y))
      .slice(0, 300)
      .map((a) => {
        const o = a.o && typeof a.o === "object" ? a.o : {};
        if (ASSETS.EJEMPLO[a.id] && ASSETS.EJEMPLO[a.id].x2 !== undefined && (o.x2 === undefined || o.y2 === undefined)) (o.x2 = +a.x + 160), (o.y2 = +a.y);
        return { id: a.id, x: +a.x, y: +a.y, o };
      });
    const caminos = (Array.isArray(js.caminos) ? js.caminos : []).filter((c) => c && Array.isArray(c.p) && c.p.length >= 2 && c.p.every((q) => Array.isArray(q) && isFinite(q[0]) && isFinite(q[1]))).slice(0, 20);
    const quitar = (Array.isArray(js.quitar) ? js.quitar : []).filter((q) => q && q.id && adentro(+q.x, +q.y)).slice(0, 300);
    return { texto: texto || js.explicacion || "", ops: { poner, caminos, quitar } };
  }
  function mostrar(txt) {
    const { texto, ops } = leer(txt);
    if (texto) decir(texto);
    if (!ops || (!ops.poner.length && !ops.caminos.length && !ops.quitar.length)) {
      propuesta = null;
      $("iaPropuesta").classList.add("oculto");
      if (!ops) decir(t("ed.ia_sin_json"), "error");
      return;
    }
    propuesta = ops;
    $("iaResumen").textContent = t("ed.ia_resumen", [ops.poner.length, ops.caminos.length, ops.quitar.length]);
    $("iaPropuesta").classList.remove("oculto");
    E.pedir();
  }
  async function enviar() {
    const pedido = $("iaPedido").value.trim();
    if (!pedido || pensando) return;
    if (!paraTarea("mapa")) return decir(t("ed.ia_falta_clave"), "error");
    decir(pedido, "yo");
    $("iaPedido").value = "";
    conv.push({ role: "user", content: contexto(pedido) });
    conv = conv.slice(-8);
    pensando = true;
    const espera = decir(t("ed.ia_pensando", [paraTarea("mapa").nombre]));
    try {
      const { txt, nombre } = await llamarTarea("mapa", conv, SISTEMA, (n) => (espera.textContent = t("ed.ia_pensando", [n])));
      espera.remove();
      if (nombre !== paraTarea("mapa").nombre) decir(t("ed.ia_contesto", [nombre]));
      conv.push({ role: "assistant", content: txt });
      mostrar(txt);
    } catch (e) {
      espera.remove();
      conv.pop();
      decir(t("ed.ia_error", [String(e.message || e)]), "error");
    }
    pensando = false;
  }
  $("iaEnviar").onclick = enviar;

  // ---------- «Probar con todas»: el mismo pedido a cada IA con clave, los resultados lado a lado ----------
  // Cada uno con su color en el mapa; se ve o se oculta, se marca para usar y los elegidos van cada uno a una capa
  // nueva con el nombre de la IA («Claude · pedido»), así se comparan prendiendo y apagando capas.
  const COLOR = { claude: "#FF8D71", chatgpt: "#7BC86C", gemini: "#73D5DB" };
  const conClave = () => ["claude", "chatgpt", "gemini"].filter(tiene);
  let varias = null; // { pedido, res: [{ quien, nombre, ops, texto, txt, error, ver, usar, pensando }] }
  async function enviarTodas() {
    const pedido = $("iaPedido").value.trim();
    if (pensando) return;
    if (!pedido) return decir(t("ed.ia_falta_pedido"), "error");
    const qs = conClave();
    if (qs.length < 2) return decir(t("ed.ia_todas_falta"), "error");
    decir(pedido, "yo");
    decir(t("ed.ia_todas_pensando", [qs.map((q) => NOMBRES[q]).join(", ")]));
    $("iaPedido").value = "";
    propuesta = null;
    $("iaPropuesta").classList.add("oculto");
    const mensajes = conv.concat([{ role: "user", content: contexto(pedido) }]);
    const yo = { pedido, mensajes };
    const { res, listo } = pedirATodas(
      mensajes,
      SISTEMA,
      (txt) => {
        const l = leer(txt);
        return l.ops && (l.ops.poner.length || l.ops.caminos.length || l.ops.quitar.length) ? l : null;
      },
      () => varias === yo && (pintarVarias(), E.pedir()),
    );
    yo.res = res;
    varias = yo;
    pensando = true;
    pintarVarias();
    await listo;
    pensando = false;
  }
  function pintarVarias() {
    const caja = $("iaVarias");
    caja.classList.toggle("oculto", !varias);
    if (!varias) return;
    pintarLista($("iaVariasLista"), varias.res, pintarUsar);
  }
  // la lista de resultados (la usa también el boceto): cada IA con su color, «Ver en el mapa» y «Usar esta»
  function pintarLista(l, res, alCambiar, resumen) {
    l.innerHTML = "";
    res.forEach((r) => {
      const f = document.createElement("div");
      f.className = "iaVar" + (r.error ? " mal" : "");
      f.style.borderLeftColor = COLOR[r.quien];
      const cab = document.createElement("div");
      cab.className = "iaVarCab";
      const nom = document.createElement("b");
      nom.textContent = r.nombre;
      nom.style.color = COLOR[r.quien];
      const que = document.createElement("small");
      que.textContent = r.pensando ? t("ed.ia_todas_esperando") : r.error ? r.error : resumen ? resumen(r.ops) : t("ed.ia_resumen", [r.ops.poner.length, r.ops.caminos.length, r.ops.quitar.length]);
      cab.append(nom, que);
      f.appendChild(cab);
      if (!r.pensando && !r.error) {
        const fila = document.createElement("div");
        fila.className = "iaVarFila";
        const chk = (k, txt) => {
          const lb = document.createElement("label"),
            c = document.createElement("input");
          c.type = "checkbox";
          c.checked = !!r[k];
          c.addEventListener("change", () => ((r[k] = c.checked), alCambiar(), E.pedir()));
          lb.append(c, document.createTextNode(txt));
          return lb;
        };
        fila.append(chk("ver", t("ed.ia_todas_ver")), chk("usar", t("ed.ia_todas_usar")));
        f.appendChild(fila);
        if (r.texto) {
          const d = document.createElement("details"),
            sm = document.createElement("summary"),
            p = document.createElement("p");
          sm.textContent = t("ed.ia_todas_dice");
          p.textContent = r.texto;
          d.append(sm, p);
          f.appendChild(d);
        }
      }
      l.appendChild(f);
    });
    alCambiar();
  }
  function pintarUsar() {
    const n = varias ? varias.res.filter((r) => r.usar && r.ops).length : 0;
    $("iaVariasAplicar").disabled = !n;
    $("iaVariasAplicar").textContent = t("ed.ia_todas_aplicar", [n]);
  }
  $("iaTodas").onclick = enviarTodas;
  $("iaVariasDescartar").onclick = () => {
    varias = null;
    pintarVarias();
    E.pedir();
  };
  $("iaVariasAplicar").onclick = () => {
    if (!varias) return;
    const elegidas = varias.res.filter((r) => r.usar && r.ops);
    if (!elegidas.length) return;
    aplicarEnCapas(elegidas, varias.pedido);
    // la conversación sigue con lo que dijo la primera elegida
    conv = varias.mensajes.concat([{ role: "assistant", content: elegidas[0].txt }]).slice(-8);
    decir(t("ed.ia_todas_aplicado", [elegidas.map((r) => r.nombre).join(", ")]));
    varias = null;
    pintarVarias();
    if (window.EDITOR_CAPAS) EDITOR_CAPAS.verPestana("capas");
  };
  // cada resultado elegido a una capa nueva con el nombre de la IA; todo en un solo paso de Deshacer
  function aplicarEnCapas(elegidas, pedido) {
    const corto = pedido.length > 30 ? pedido.slice(0, 29) + "…" : pedido;
    elegidas.forEach((r, k) => {
      const id = E.capas.nueva(r.nombre + " · " + corto, true, k > 0);
      E.aplicar(r.ops, { capa: id, sinPaso: true, sinElegir: true });
    });
  }
  // el mismo pedido a cada IA con clave, a la vez: res = [{ quien, nombre, pensando, ver, usar }], se va llenando;
  // armar(txt) → { ops, texto } o null; alLlegar() repinta
  function pedirATodas(mensajes, sistema, armar, alLlegar) {
    const res = conClave().map((q) => ({ quien: q, nombre: NOMBRES[q], pensando: true, ver: true, usar: false }));
    const listo = Promise.allSettled(
      res.map(async (r) => {
        try {
          const txt = await llamar(r.quien, modeloDe(r.quien), conf.claves[r.quien], typeof mensajes === "function" ? mensajes(r.quien) : mensajes, sistema);
          const l = armar(txt);
          if (!l || !l.ops) throw new Error(t("ed.ia_sin_json"));
          Object.assign(r, { txt, texto: l.texto, ops: l.ops, pensando: false });
        } catch (e) {
          Object.assign(r, { pensando: false, error: String(e.message || e) });
        }
        alLlegar();
      }),
    );
    return { res, listo };
  }
  // en el mapa: lo de cada IA con su color (anillos en cada objeto, caminos y agua), encima de su vista previa
  function dibujarVarias(c, cam, V, tt) {
    if (!varias || !abierta()) return;
    dibujarRes(c, cam, V, tt, varias.res);
  }
  function dibujarRes(c, cam, V, tt, res) {
    res.forEach((r) => {
      if (!r.ver || !r.ops) return;
      E.fantasmas(c, r.ops.poner, tt, 0.4);
      c.save();
      c.strokeStyle = COLOR[r.quien];
      c.lineWidth = 5 / cam.z;
      c.setLineDash([16 / cam.z, 10 / cam.z]);
      r.ops.caminos.concat(r.ops.rios || []).forEach((cm) => {
        c.beginPath();
        cm.p.forEach(([x, y], i) => (i ? c.lineTo(...V(x, y)) : c.moveTo(...V(x, y))));
        c.stroke();
      });
      (r.ops.lagos || []).forEach((lg) => {
        c.beginPath();
        for (let k = 0; k <= 24; k++) {
          const a = (k / 24) * Math.PI * 2,
            q = V(lg.x + Math.cos(a) * lg.rx, lg.y + Math.sin(a) * lg.ry);
          k ? c.lineTo(...q) : c.moveTo(...q);
        }
        c.stroke();
      });
      c.setLineDash([]);
      c.lineWidth = 2.5 / cam.z;
      r.ops.poner.slice(0, 600).forEach((a) => {
        const [x, y] = V(a.x, a.y);
        c.beginPath();
        c.ellipse(x, y, 22 / cam.z, 11 / cam.z, 0, 0, Math.PI * 2);
        c.stroke();
      });
      c.globalAlpha = 0.35;
      r.ops.quitar.slice(0, 400).forEach((q) => {
        const [x, y] = V(q.x, q.y),
          d = 6 / cam.z;
        c.beginPath();
        c.moveTo(x - d, y - d);
        c.lineTo(x + d, y + d);
        c.moveTo(x + d, y - d);
        c.lineTo(x - d, y + d);
        c.stroke();
      });
      c.restore();
    });
  }
  const todasFoco = () => setTimeout(() => $("iaPedido").focus(), 0);
  // con Cursor u otro chat: se copia el pedido entero y después se pega lo que contestó
  $("iaCopiar").onclick = () => {
    const pedido = $("iaPedido").value.trim();
    if (!pedido) return decir(t("ed.ia_falta_pedido"), "error");
    const todo = SISTEMA + "\n\n" + contexto(pedido);
    const ok = () => decir(t("ed.ia_copiado"));
    try {
      navigator.clipboard.writeText(todo).then(ok, () => decir(t("ed.ia_no_copia"), "error"));
    } catch (e) {
      decir(t("ed.ia_no_copia"), "error");
    }
  };
  $("iaLeer").onclick = () => {
    const txt = $("iaRespuesta").value.trim();
    if (!txt) return;
    $("iaRespuesta").value = "";
    mostrar(txt);
  };
  $("iaAplicar").onclick = () => {
    if (!propuesta) return;
    E.aplicar(propuesta);
    propuesta = null;
    $("iaPropuesta").classList.add("oculto");
    decir(t("ed.ia_aplicado"));
  };
  $("iaDescartar").onclick = () => {
    propuesta = null;
    $("iaPropuesta").classList.add("oculto");
    E.pedir();
  };

  // ---------- en el mapa: la zona (celeste) y la vista previa de lo propuesto ----------
  function dibujar(c, cam, V, enVista, tt) {
    if (!abierta()) return;
    const [x0, y0, x1, y1] = E.zona().caja;
    c.save();
    c.strokeStyle = "#73D5DB";
    c.lineWidth = 2.5 / cam.z;
    c.setLineDash([14 / cam.z, 8 / cam.z]);
    c.beginPath();
    [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([x, y], i) => (i ? c.lineTo(...V(x, y)) : c.moveTo(...V(x, y))));
    c.closePath();
    c.stroke();
    c.restore();
    if (!propuesta) return;
    c.save();
    c.strokeStyle = "#FFD98A";
    c.lineWidth = 6 / cam.z;
    c.setLineDash([16 / cam.z, 10 / cam.z]);
    propuesta.caminos.forEach((cm) => {
      c.beginPath();
      cm.p.forEach(([x, y], i) => (i ? c.lineTo(...V(x, y)) : c.moveTo(...V(x, y))));
      c.stroke();
    });
    c.restore();
    E.fantasmas(c, propuesta.poner, tt, 0.65);
    c.strokeStyle = "#C8402D";
    c.lineWidth = 3 / cam.z;
    propuesta.quitar.forEach((q) => {
      const [x, y] = V(q.x, q.y),
        r = 10 / cam.z;
      c.beginPath();
      c.moveTo(x - r, y - r);
      c.lineTo(x + r, y + r);
      c.moveTo(x + r, y - r);
      c.lineTo(x - r, y + r);
      c.stroke();
    });
  }
  function alternar() {
    abierta() ? cerrar() : abrir();
  }
  pintarConf();
  // para otros módulos (texturas): la misma IA, modelo y clave que eligió acá
  // la que haría los pedidos del mapa (para lo viejo que todavía pregunta «cuál está elegida»)
  const elegida = () => paraTarea("mapa") || { quien: conf.quien === "otra" ? "otra" : "claude", modelo: "", clave: "", claves: conf.claves };
  return { abrir, cerrar, alternar, abierta, dibujar, dibujarVarias, todasFoco, conClave, pedirATodas, pintarLista, dibujarRes, aplicarEnCapas, llamar, llamarTarea, paraTarea, candidatas, elegida, catalogo, NOMBRES };
})();
