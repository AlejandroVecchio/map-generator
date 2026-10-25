#!/usr/bin/env bash
# Trae lo último del juego (eromash-aventura-web, main) al submódulo aventura-web/ y lo deja listo para commitear.
set -e
cd "$(dirname "$0")/.."
git submodule update --init --remote aventura-web
git add aventura-web
echo "El juego quedó en: $(git -C aventura-web log --oneline -1)"
echo "Falta commitear y subir (git commit -m 'Trae lo último del juego' && git push)."
