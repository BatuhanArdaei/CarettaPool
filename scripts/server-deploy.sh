#!/usr/bin/env bash
# Sunucuda, `caretta` kullanıcısıyla, yeni açılmış bir sürüm klasörünün içinden çalışır.
# deploy.sh (elle) ve .github/workflows/deploy.yml (otomatik) tarafından çağrılır.
#
# Kullanım: bash scripts/server-deploy.sh <sürüm-klasörü>
set -euo pipefail

APP_DIR=/var/www/caretta-pool
APP_NAME=caretta-pool
PORT=3001
KEEP=3
RELEASE_DIR="$APP_DIR/releases/$1"

cd "$RELEASE_DIR"
ln -sfn "$APP_DIR/shared/.env.production" .env.production

echo "→ bağımlılıklar"
npm ci --no-audit --no-fund --loglevel=error
echo "→ derleme"
npm run build

# Derleme başarılı: siteyi yeni sürüme geçir
ln -sfn "$RELEASE_DIR" "$APP_DIR/current"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$APP_NAME" --update-env
else
  pm2 start npm --name "$APP_NAME" --cwd "$APP_DIR/current" -- start -- -p "$PORT" -H 127.0.0.1
fi
pm2 save >/dev/null

# Site yanıt veriyor mu
for i in $(seq 1 15); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/tr"; then break; fi
  if [ "$i" = 15 ]; then echo "✗ Site yanıt vermiyor"; pm2 logs "$APP_NAME" --lines 30 --nostream; exit 1; fi
  sleep 2
done

# Eski sürümleri temizle (son $KEEP kalır)
ls -1dt "$APP_DIR"/releases/* | tail -n +$((KEEP + 1)) | xargs -r rm -rf
echo "✓ Yayında: $1"
