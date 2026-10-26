// ---------- carga del editor: primero el juego, después el editor ----------
// El juego está enganchado como submódulo en aventura-web/ y la página tiene <base href="aventura-web/aventura/">.
// La lista de scripts del juego sale de su catálogo (catalogo.html): ahí tiene que estar todo asset nuevo, así el
// editor ve siempre todos los assets sin que nadie mantenga una lista a mano. Se le suma lo del mundo que el
// catálogo no carga (Eldervald, caminos, guion, interiores, regiones, zonas) y al final los módulos del editor.
(function () {
  "use strict";
  const PROPIO = "../../"; // del juego a la raíz de este repo
  // si no se puede leer el catálogo (por ejemplo abriendo el archivo sin servidor), la última lista conocida
  const RESPALDO = [
    "../juego/js/comun/calidad.js",
    "../juego/js/comun/i18n.js",
    "js/textos/aventura.js",
    "js/textos/historia.js",
    "js/textos/interfaz.js",
    "js/textos/secretos.js",
    "js/textos/piedras.js",
    "js/textos/interiores.js",
    "js/textos/zonas.js",
    "js/textos/capital.js",
    "js/textos/etapas.js",
    "js/textos/norte.js",
    "js/textos/este.js",
    "js/textos/secundarias.js",
    "js/textos/goinn.js",
    "js/textos/claro.js",
    "js/textos/berkano.js",
    "../juego/js/comun/vikingos.js",
    "js/comun/dibujo.js",
    "js/comun/volumen.js",
    "js/comun/futhark.js",
    "js/mundo/assets.js",
    "js/mundo/assets-eikholt.js",
    "js/mundo/assets-capital.js",
    "js/mundo/assets-puesto.js",
    "js/mundo/assets-senda.js",
    "js/mundo/assets-norte.js",
    "js/mundo/assets-este.js",
    "js/mundo/assets-guaridas.js",
    "js/mundo/assets-claro.js",
    "js/mundo/assets-secretos.js",
    "js/mundo/assets-piedras.js",
    "js/mundo/assets-interiores.js",
    "js/mundo/assets-sotanos.js",
    "js/mundo/assets-casas.js",
    "js/mundo/assets-zonas.js",
    "js/mundo/assets-mazmorras.js",
    "js/mundo/assets-berkano.js",
    "js/historia/guion.js",
    "js/mundo/caminos.js",
    "js/personajes/vikingo.js",
    "js/personajes/gente.js",
    "js/mundo/eldervald.js",
    "js/mundo/agregados.js",
    "js/mundo/texturas.js",
    "js/mundo/imagenes.js",
    "js/motor/interiores.js",
    "js/motor/regiones.js",
    "js/motor/mazmorras.js",
    "js/motor/zonas.js",
  ];
  // lo que el editor necesita y el catálogo no carga, con antes de qué va
  const EXTRA = [
    ["../juego/js/comun/calidad.js", 0],
    ["js/textos/interfaz.js", "js/textos/aventura.js", 1],
    ["js/textos/etapas.js", "js/textos/aventura.js", 1],
    ["js/textos/eikholt.js", "js/textos/aventura.js", 1],
    ["js/historia/guion.js", "js/mundo/agregados.js"],
    ["js/mundo/caminos.js", "js/mundo/agregados.js"],
    ["js/mundo/eldervald.js", "js/mundo/agregados.js"],
  ];
  // Eikholt (la capital es otro mapa): el plano, sus piezas, lo del editor (ciudad/agregados.js) y la vista del juego
  const CIUDAD = ["casas", "puestos", "muralla", "roble", "ting", "enseres", "oficios", "porton", "plano", "agregados", "vista"].map((n) => "js/ciudad/" + n + ".js");
  const DESPUES = ["js/motor/interiores.js", "js/motor/regiones.js", "js/motor/mazmorras.js", "js/motor/zonas.js"].concat(CIUDAD);
  const EDITOR = ["editor", "comandos", "ia", "github", "proyectos", "cuartos", "mundo", "pincel", "historia", "texturas", "zonas", "eikholt", "npcs", "importar", "boceto", "capas", "menu"];
  function armar(lista) {
    lista = lista.filter((s) => s !== "js/catalogo.js");
    EXTRA.forEach(([s, antes, despues]) => {
      if (lista.includes(s)) return;
      if (antes === 0) return lista.unshift(s);
      const i = lista.indexOf(antes);
      if (i < 0) return lista.push(s);
      lista.splice(despues ? i + 1 : i, 0, s);
    });
    // el proyecto abierto, justo antes de armar el mundo: si es un mapa de cero, Eldervald se arma vacío
    lista.splice(lista.indexOf("js/mundo/eldervald.js"), 0, PROPIO + "js/proyecto.js");
    // los textos del editor van con los demás textos (antes que cualquier asset)
    const ultTexto = lista.reduce((k, s, i) => (s.startsWith("js/textos/") ? i : k), 0);
    lista.splice(ultTexto + 1, 0, PROPIO + "js/textos/editor.js");
    // editor.js arma window.EDITOR; los motores de interiores, regiones y zonas se apoyan en él y en el mundo
    const eds = EDITOR.map((n) => PROPIO + "js/editor/" + n + ".js");
    lista = lista.concat(eds.slice(0, 3), DESPUES.filter((s) => !lista.includes(s)), eds.slice(3));
    return [...new Set(lista)];
  }
  // todos a la vez pero en orden: async = false los baja en paralelo y los corre uno tras otro, así cada script puede
  // usar lo que dejaron los anteriores
  function cargar(lista) {
    lista.forEach((s) => {
      const el = document.createElement("script");
      el.src = s;
      el.async = false;
      el.onerror = () => console.error("No se pudo cargar " + s);
      document.body.appendChild(el);
    });
  }
  fetch("catalogo.html")
    .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
    .then((html) => [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((m) => m[1]))
    .catch(() => RESPALDO)
    .then((l) => cargar(armar(l)));
})();
