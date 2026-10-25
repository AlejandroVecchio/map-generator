# Eromash · Editor de mapas

El editor de Eldervald, el mundo de la aventura 2.5D de Eromash. Dibuja con el mismo código del juego, así lo que ves acá es lo que se ve jugando.

## Cómo se usa

1. Bajá el repo **con el juego adentro**: en GitHub Desktop, *Clone repository* ya trae el submódulo; por consola, `git clone --recurse-submodules https://github.com/AlejandroVecchio/map-generator`.
2. Serví la carpeta (los navegadores no dejan leer archivos sueltos): `python3 -m http.server 8000` o `npx serve`, y abrí `http://localhost:8000/`.
3. Armá el mapa. Para pasarlo al juego: **Archivo → Guardar en el juego (PR)** (abre un PR en el repo del juego con `agregados.js`) o **Descargar agregados.js** y copiarlo a `aventura/js/mundo/` del juego.

## Conectado con el juego

El repo del juego (`eromash-aventura-web`) está enganchado en `aventura-web/`. El editor lee de ahí todos los assets, el mundo, los interiores y las zonas. Cuando el juego cambia, `bash herramientas/actualizar-juego.sh` lo trae al día.
