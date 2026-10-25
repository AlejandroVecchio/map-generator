// ---------- importar cosas propias: estructuras, pinturas, calcos y texturas (panel Importar, tecla N) ----------
// El mismo panel que la gente propia (npcs.js): arriba se elige qué se importa. Una estructura, una pintura de pared
// o un calco en el piso es una imagen que se vuelve un asset más (im_<id>, mundo/imagenes.js): sale en la lista de
// objetos («Tus importados»; las pinturas en «interiores», así también se cuelgan adentro de las casas) y se pone,
// se mueve, se agranda y se gira como cualquier otro. Las texturas ya tienen su generador (Y), que también sube
// imágenes: el botón lo abre.
window.EDITOR_IMPORTAR = (function () {
  "use strict";
  const E = window.EDITOR,
    t = E.t,
    N = window.EDITOR_NPC,
    $ = (id) => document.getElementById(id);
  const CLASES = ["gente", "estructura", "pintura", "suelo", "textura"];
  const ALTO = { estructura: 220, pintura: 120, suelo: 300 };
  let clase = "gente",
    elegida = null;
  try {
    clase = localStorage.getItem("eromash-editor-importar") || "gente";
  } catch (e) {}
  if (!CLASES.includes(clase)) clase = "gente";
  $("imClase").innerHTML = CLASES.map((c) => `<option value="${c}">${t("ed.im_clase_" + c)}</option>`).join("");
  const tabla = () => E.est().imagenes || {};
  const deClase = () => Object.keys(tabla()).filter((id) => (tabla()[id].clase || "estructura") === clase);
  const nombreDe = (id) => {
    const n = tabla()[id].nombre || {};
    return n[I18N.lang] || n.es || n.en || id;
  };
  function cambiar(fn) {
    const id = elegida;
    E.cambiar((est) => est.imagenes[id] && fn(est.imagenes[id]));
    pintar();
  }
  function pintar() {
    $("imClase").value = clase;
    $("imIntro").textContent = t("ed.im_intro_" + clase);
    $("imGente").classList.toggle("oculto", clase !== "gente");
    $("imCosa").classList.toggle("oculto", clase === "gente" || clase === "textura");
    $("imTextura").classList.toggle("oculto", clase !== "textura");
    if (clase === "gente" || clase === "textura") return;
    const ids = deClase();
    if (elegida && !ids.includes(elegida)) elegida = null;
    if (!elegida && ids.length) elegida = ids[0];
    $("imLista").innerHTML = ids.length ? ids.map((id) => `<option value="${id}">${nombreDe(id).replace(/</g, "&lt;")}</option>`).join("") : `<option value="">${t("ed.im_ninguna")}</option>`;
    if (elegida) $("imLista").value = elegida;
    document.querySelectorAll("#npcs .conIm").forEach((f) => f.classList.toggle("oculto", !elegida));
    if (!elegida) return;
    const d = tabla()[elegida];
    $("imNombreEs").value = (d.nombre && d.nombre.es) || "";
    $("imNombreEn").value = (d.nombre && d.nombre.en) || "";
    $("imAlto").value = d.alto || ALTO[clase];
    $("imAltoV").textContent = t("ed.np_metros", [((d.alto || ALTO[clase]) / 30).toFixed(1)]);
    $("imChoque").checked = !!d.choque;
    document.querySelectorAll("#npcs .soloEstructura").forEach((f) => f.classList.toggle("oculto", clase !== "estructura"));
    N.miniatura($("imVista").querySelector("canvas"), d.src);
    $("imVista").querySelector("button").classList.toggle("oculto", !d.src);
    $("imPoner").disabled = !d.src;
    $("imPeso").textContent = t("ed.np_peso", [Math.round(((d.src || "").length * 0.75) / 1024)]);
  }
  $("imClase").addEventListener("change", () => {
    clase = $("imClase").value;
    elegida = null;
    try {
      localStorage.setItem("eromash-editor-importar", clase);
    } catch (e) {}
    pintar();
  });
  $("imLista").addEventListener("change", () => ((elegida = $("imLista").value || null), pintar()));
  $("imNueva").onclick = () => {
    let k = 1;
    while (tabla()["im" + k]) k++;
    const id = "im" + k;
    E.cambiar((est) => (est.imagenes[id] = { clase, nombre: { es: t("ed.im_nueva_es_" + clase), en: t("ed.im_nueva_en_" + clase) }, alto: ALTO[clase] }));
    elegida = id;
    pintar();
    pedirImagen();
  };
  const entrada = document.createElement("input");
  entrada.type = "file";
  entrada.accept = "image/*";
  const pedirImagen = () => entrada.click();
  async function cargar(file) {
    if (!elegida) return;
    try {
      const src = await N.preparar(file, $("imFondo").checked);
      cambiar((d) => (d.src = src));
      E.avisar(t("ed.np_imagen_lista", [Math.round((src.length * 0.75) / 1024)]));
    } catch (e) {
      E.avisar(e.message || String(e));
    }
  }
  entrada.addEventListener("change", () => {
    if (entrada.files[0]) cargar(entrada.files[0]);
    entrada.value = "";
  });
  const slot = $("imVista");
  slot.querySelector("canvas").onclick = pedirImagen;
  slot.querySelector("button").onclick = () => cambiar((d) => delete d.src);
  slot.addEventListener("dragover", (e) => (e.preventDefault(), slot.classList.add("sobre")));
  slot.addEventListener("dragleave", () => slot.classList.remove("sobre"));
  slot.addEventListener("drop", (e) => {
    e.preventDefault();
    slot.classList.remove("sobre");
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) cargar(f);
  });
  const texto = (id) => $(id).value.trim().slice(0, 40);
  $("imNombreEs").addEventListener("change", () => cambiar((d) => (d.nombre = Object.assign({}, d.nombre, { es: texto("imNombreEs") }))));
  $("imNombreEn").addEventListener("change", () => cambiar((d) => (d.nombre = Object.assign({}, d.nombre, { en: texto("imNombreEn") }))));
  $("imAlto").addEventListener("input", () => ($("imAltoV").textContent = t("ed.np_metros", [(+$("imAlto").value / 30).toFixed(1)])));
  $("imAlto").addEventListener("change", () => cambiar((d) => (d.alto = +$("imAlto").value)));
  $("imChoque").addEventListener("change", () => cambiar((d) => ($("imChoque").checked ? (d.choque = true) : delete d.choque)));
  // ponerla: queda elegida en la lista de objetos y el próximo clic en el mapa la pone
  $("imPoner").onclick = () => {
    if (!elegida || !ASSETS.LISTA["im_" + elegida]) return;
    E.elegir("im_" + elegida);
    E.avisar(t("ed.im_poner_aviso"));
  };
  $("imBorrar").onclick = () => {
    if (!elegida || !confirm(t("ed.im_borrar_seguro", [nombreDe(elegida)]))) return;
    const id = elegida,
      k = "im_" + id;
    E.cambiar((est) => {
      delete est.imagenes[id];
      // lo ya puesto en el mapa se va con ella
      est.poner = est.poner.filter((a) => a.id !== k);
    });
    elegida = null;
    pintar();
  };
  $("imAbrirTex").onclick = () => {
    N.cerrar();
    if (window.EDITOR_TEXTURAS && EDITOR_TEXTURAS.abrir) EDITOR_TEXTURAS.abrir();
    else $("hTexturas").click();
  };
  // también se pega una imagen copiada
  addEventListener("paste", (e) => {
    if (!N.abierta() || clase === "gente" || !elegida || /INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName)) return;
    const it = [...(e.clipboardData ? e.clipboardData.items : [])].find((i) => i.type.startsWith("image/"));
    if (it) e.preventDefault(), cargar(it.getAsFile());
  });
  return { pintar, clase: () => clase };
})();
