#!/usr/bin/env bash
# Actualiza la web en el VPS SIN compilar aquí:  npm run actualizar
#   1) baja el código nuevo (git pull)
#   2) instala librerías solo si han cambiado
#   3) descarga la versión ya compilada por GitHub (rama "build") y la cambia de golpe
#   4) reinicia la web con pm2
# Si GitHub aún no ha terminado de compilar, espera hasta 5 minutos; si no está, compila aquí.
set -euo pipefail
cd "$(dirname "$0")/.."

APP="${PM2_APP:-}"
if [ -z "$APP" ]; then
  APP="$(pm2 jlist 2>/dev/null | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const l=JSON.parse(d);const p=l.find(x=>require("path").resolve(x.pm2_env.pm_cwd||"")===process.cwd());console.log(p?p.name:"")}catch{console.log("")}})' || true)"
  APP="${APP:-eureka-web}"
fi
paso() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }

paso "Bajando el código nuevo"
git pull --ff-only
SHA="$(git rev-parse HEAD)"
echo "  versión $(git log -1 --format='%h · %cd' --date=format:'%d/%m/%Y %H:%M')"

paso "Librerías"
# Se instala si cambió package-lock.json desde la última instalación hecha por este script
LOCK="$(sha1sum package-lock.json | cut -d' ' -f1)"
if [ "$(cat node_modules/.eureka-lock 2>/dev/null)" != "$LOCK" ]; then
  npm ci --include=dev --no-audit --no-fund
  echo "$LOCK" > node_modules/.eureka-lock
else
  echo "  sin cambios, no hace falta instalar nada"
fi

paso "Descargando la versión compilada por GitHub"
LISTA=0
for i in $(seq 1 30); do
  if git fetch -q origin build 2>/dev/null && [ "$(git show origin/build:COMMIT 2>/dev/null | tr -d '[:space:]')" = "$SHA" ]; then LISTA=1; break; fi
  [ "$i" = 1 ] && echo "  GitHub todavía está compilando esta versión; espero (máx. 5 min)…"
  sleep 10
done

if [ "$LISTA" = 1 ]; then
  rm -rf .next-nueva && mkdir .next-nueva
  git archive origin/build .next | tar -x -C .next-nueva --strip-components=1
  [ -f .next-nueva/BUILD_ID ] || { echo "  ✗ la descarga está incompleta"; exit 1; }
  rm -rf .next-vieja
  [ -d .next ] && mv .next .next-vieja
  mv .next-nueva .next
  rm -rf .next-vieja
  echo "  ✓ lista (no se ha compilado nada en el servidor)"
else
  echo "  ✗ GitHub no tiene esta versión compilada (¿falló la compilación? mira la pestaña Actions del repositorio)."
  echo "  Compilo aquí con el modo de poca memoria; puede tardar unos minutos."
  npm run build
fi

paso "Reiniciando la web ($APP)"
pm2 restart "$APP" --update-env
pm2 save >/dev/null 2>&1 || true
echo
echo "✓ Web actualizada a $(git log -1 --format=%h)."
