#!/usr/bin/env bash
# Desde tu computadora: sincroniza tu carpeta de música con el servidor.
# El stream toma los cambios solo, en la siguiente vuelta de la lista.
#   TGSTREAM_HOST=usuario@servidor ./scripts/sync-music.sh            # sube lo nuevo
#   TGSTREAM_HOST=usuario@servidor ./scripts/sync-music.sh --delete   # además borra allá lo que borraste aquí
set -euo pipefail

HOST="${TGSTREAM_HOST:?Define TGSTREAM_HOST=usuario@servidor}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${MUSIC_SRC:-$ROOT/music}"
DEST="/srv/tgstream/music"

[ -d "$SRC" ] || { echo "No existe $SRC (crea la carpeta o define MUSIC_SRC)" >&2; exit 1; }

# El rsync de macOS (openrsync) no tiene --chmod, así que los permisos se arreglan
# después por ssh. Es obligatorio: los archivos llegan 600 y tgstream no podría leerlos.
rsync -av --progress --exclude .DS_Store "$@" "$SRC/" "$HOST:$DEST/"
ssh "$HOST" "chmod 644 $DEST/* 2>/dev/null; ls $DEST | grep -ciE '\.(mp3|m4a|aac|wav|flac|ogg|opus)$' | xargs echo 'canciones en el servidor:'"
