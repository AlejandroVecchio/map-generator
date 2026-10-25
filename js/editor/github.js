// ---------- «Guardar en el juego»: sube agregados.js al repo del juego como un pedido de cambios (PR) ----------
// En vez de descargar el archivo y copiarlo a mano: con una clave de GitHub (fine-grained, con permiso de
// Contents y Pull requests sobre el repo del juego) el editor hace una rama, guarda ahí aventura/js/mundo/agregados.js
// y abre el PR. La clave queda solo en el localStorage de este navegador, como las de las IA: nunca en un archivo.
window.EDITOR_GITHUB = (function () {
  "use strict";
  const E = window.EDITOR,
    t = E.t,
    $ = (id) => document.getElementById(id);
  const CLAVE = "eromash-editor-github",
    ARCHIVO = "aventura/js/mundo/agregados.js";
  let conf = { repo: "AlejandroVecchio/eromash-aventura-web", clave: "" };
  try {
    Object.assign(conf, JSON.parse(localStorage.getItem(CLAVE) || "{}"));
  } catch (e) {}
  const guardarConf = () => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(conf));
    } catch (e) {}
  };

  // ---------- el panel ----------
  const panel = document.createElement("div");
  panel.id = "ghPanel";
  panel.className = "oculto";
  panel.innerHTML =
    '<div class="cab"><b></b><button class="cerrar"></button></div>' +
    "<small class='ayuda'></small>" +
    '<label><span class="lRepo"></span><input id="ghRepo" type="text" spellcheck="false" /></label>' +
    '<label><span class="lClave"></span><input id="ghClave" type="password" autocomplete="off" spellcheck="false" /></label>' +
    '<label><span class="lMsj"></span><input id="ghMensaje" type="text" /></label>' +
    "<small id='ghEstado'></small>" +
    '<div class="botones"><button id="ghSubir" class="listo"></button></div>';
  document.body.appendChild(panel);
  panel.querySelector(".cab b").textContent = t("ed.gh_titulo");
  panel.querySelector(".cerrar").textContent = t("ed.cerrar");
  panel.querySelector(".ayuda").textContent = t("ed.gh_ayuda");
  panel.querySelector(".lRepo").textContent = t("ed.gh_repo");
  panel.querySelector(".lClave").textContent = t("ed.gh_clave");
  panel.querySelector(".lMsj").textContent = t("ed.gh_mensaje");
  $("ghSubir").textContent = t("ed.gh_subir");
  $("ghClave").placeholder = "github_pat_…";
  panel.querySelectorAll("input").forEach((el) => el.addEventListener("keydown", (e) => e.stopPropagation()));
  panel.querySelector(".cerrar").onclick = () => cerrar();
  $("ghRepo").addEventListener("change", () => ((conf.repo = $("ghRepo").value.trim()), guardarConf()));
  $("ghClave").addEventListener("change", () => ((conf.clave = $("ghClave").value.trim()), guardarConf()));
  const estado = (txt, clase) => {
    $("ghEstado").textContent = txt;
    $("ghEstado").className = clase || "";
  };
  function abrir() {
    $("ghRepo").value = conf.repo;
    $("ghClave").value = conf.clave;
    $("ghMensaje").value = $("ghMensaje").value || t("ed.gh_mensaje_def", [($("planoNombre") && $("planoNombre").value) || t("ed.gh_sin_nombre")]);
    estado("");
    panel.classList.remove("oculto");
    setTimeout(() => (conf.clave ? $("ghMensaje") : $("ghClave")).focus(), 0);
  }
  function cerrar() {
    panel.classList.add("oculto");
  }

  // ---------- la API de GitHub ----------
  async function api(ruta, op) {
    const r = await fetch("https://api.github.com/repos/" + conf.repo + ruta, {
      method: (op && op.method) || "GET",
      headers: { accept: "application/vnd.github+json", authorization: "Bearer " + conf.clave, "content-type": "application/json" },
      body: op && op.body ? JSON.stringify(op.body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j && j.message) || r.status);
    return j;
  }
  // texto a base64 (con tildes y eñes)
  const base64 = (s) => {
    const b = new TextEncoder().encode(s);
    let bin = "";
    for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  let subiendo = false;
  async function subir() {
    if (subiendo) return;
    conf.repo = $("ghRepo").value.trim();
    conf.clave = $("ghClave").value.trim();
    guardarConf();
    if (!conf.clave) return estado(t("ed.gh_falta_clave"), "error");
    const mensaje = $("ghMensaje").value.trim() || t("ed.gh_mensaje_def", [t("ed.gh_sin_nombre")]);
    subiendo = true;
    $("ghSubir").disabled = true;
    try {
      estado(t("ed.gh_paso_rama"));
      const repo = await api(""),
        base = repo.default_branch,
        ref = await api("/git/ref/heads/" + encodeURIComponent(base)),
        h = new Date(),
        dos = (n) => String(n).padStart(2, "0"),
        rama = "editor/" + h.getFullYear() + dos(h.getMonth() + 1) + dos(h.getDate()) + "-" + dos(h.getHours()) + dos(h.getMinutes()) + dos(h.getSeconds());
      await api("/git/refs", { method: "POST", body: { ref: "refs/heads/" + rama, sha: ref.object.sha } });
      estado(t("ed.gh_paso_archivo"));
      let sha;
      try {
        sha = (await api("/contents/" + ARCHIVO + "?ref=" + encodeURIComponent(rama))).sha;
      } catch (e) {}
      await api("/contents/" + ARCHIVO, { method: "PUT", body: { message: mensaje, content: base64(E.textoAgregados()), branch: rama, sha } });
      estado(t("ed.gh_paso_pr"));
      const pr = await api("/pulls", { method: "POST", body: { title: mensaje, head: rama, base, body: t("ed.gh_cuerpo") } });
      E.marcarBajado();
      estado("", "");
      const a = document.createElement("a");
      a.href = pr.html_url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = t("ed.gh_listo", [pr.number]);
      $("ghEstado").appendChild(a);
      E.avisar(t("ed.gh_listo", [pr.number]));
      E.usar("descargar");
    } catch (e) {
      estado(t("ed.gh_error", [String(e.message || e)]), "error");
    }
    subiendo = false;
    $("ghSubir").disabled = false;
  }
  $("ghSubir").onclick = subir;
  return { abrir, cerrar, abierta: () => !panel.classList.contains("oculto") };
})();
