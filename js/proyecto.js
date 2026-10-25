// ---------- el proyecto abierto, antes de armar el mundo: si es un mapa de cero, Eldervald se arma vacío ----------
// Corre justo antes de eldervald.js (lo pone cargar.js). El proyecto abierto vive en la misma clave que lee el juego
// con ?borrador=1; si dice lienzo, el mundo de base no se arma (ELDERVALD.LIENZO) y quedan solo el borde y lo tuyo.
(function () {
  "use strict";
  try {
    const b = JSON.parse(localStorage.getItem("eromash-aventura-editor") || "null");
    if (b && b.lienzo) window.AGREGADOS = { lienzo: true };
  } catch (e) {}
})();
