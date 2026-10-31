#!/usr/bin/env bash
# Caretta Pool — Hetzner sunucusuna elle yayın.
# Normalde gerekmez: main'e push edilen her commit GitHub Actions ile otomatik yayınlanır
# (.github/workflows/deploy.yml). Bu betik Actions çalışmadığında yedek yoldur.
#
# Kullanım (Git Bash):  bash scripts/deploy.sh
#
# Son commit'i (HEAD) gönderir; commit edilmemiş değişiklikler gönderilmez.
# Önceki sürüme dönmek için:
#   ssh caretta@2.31.118.229 "ls /var/www/caretta-pool/releases"
#   ssh caretta@2.31.118.229 "ln -sfn /var/www/caretta-pool/releases/<sürüm> /var/www/caretta-pool/current && pm2 reload caretta-pool"
set -euo pipefail

TARGET="${DEPLOY_TARGET:-caretta@2.31.118.229}"
RELEASE="$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Uyarı: commit edilmemiş değişiklikler var; yalnızca son commit gönderilecek."
fi

echo "→ $RELEASE gönderiliyor"
git archive --format=tar HEAD | ssh "$TARGET" "mkdir -p /var/www/caretta-pool/releases/$RELEASE && tar -x -C /var/www/caretta-pool/releases/$RELEASE"
ssh "$TARGET" "bash /var/www/caretta-pool/releases/$RELEASE/scripts/server-deploy.sh $RELEASE"
