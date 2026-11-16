#!/usr/bin/env bash
# Emite audio PCM s16le 44.1 kHz estéreo por stdout, sin fin.
# SIN -re a propósito: llena el FIFO por adelantado y ffmpeg tira al ritmo que necesita.
# Con -re el audio llega justo a tiempo real, ffmpeg frena x11grab para esperarlo y el video cae a ~20 fps.
# Recorre MUSIC_DIR en orden aleatorio; relee la carpeta en cada vuelta,
# así que añadir o quitar canciones no requiere reiniciar nada.
MUSIC_DIR="${MUSIC_DIR:-/srv/tgstream/music}"
MUSIC_LUFS="${MUSIC_LUFS:--16}"   # -14 más alto, -20 más bajo

pcm() { ffmpeg -nostdin -hide_banner -loglevel error "$@" -vn -f s16le -ar 44100 -ac 2 pipe:1; }

cd /tmp 2>/dev/null || true   # evita avisos de find si el cwd no es legible

while true; do
  mapfile -t files < <(find "$MUSIC_DIR" -maxdepth 2 -type f \( \
      -iname '*.mp3' -o -iname '*.m4a' -o -iname '*.aac' -o -iname '*.wav' \
      -o -iname '*.flac' -o -iname '*.ogg' -o -iname '*.opus' \) | shuf)

  if [ ${#files[@]} -eq 0 ]; then
    echo "music: carpeta vacía ($MUSIC_DIR), silencio 10s" >&2
    pcm -f lavfi -i anullsrc=r=44100:cl=stereo -t 10
    continue
  fi

  for f in "${files[@]}"; do
    [ -f "$f" ] || continue
    dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" 2>/dev/null | cut -d. -f1)
    af="loudnorm=I=${MUSIC_LUFS}:TP=-1.5:LRA=11,afade=t=in:d=2"
    if [ -n "$dur" ] && [ "$dur" -gt 10 ]; then
      af="$af,afade=t=out:st=$((dur - 3)):d=3"
    fi
    echo "music: ▶ $(basename "$f")" >&2
    pcm -i "$f" -af "$af" || { echo "music: falló $(basename "$f")" >&2; sleep 1; }
  done
done
