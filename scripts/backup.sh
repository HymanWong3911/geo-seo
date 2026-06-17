#!/usr/bin/env bash
# 数据库备份脚本
# 用法: ./scripts/backup.sh [/path/to/backups]
set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/geo_seo_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "==> Backing up PostgreSQL to ${BACKUP_FILE}"
docker compose exec -T postgres pg_dump -U geo_seo geo_seo | gzip > "${BACKUP_FILE}"

echo "==> Backup size: $(du -h "${BACKUP_FILE}" | cut -f1)"

# 保留 30 天内的备份
echo "==> Cleaning backups older than 30 days"
find "${BACKUP_DIR}" -name "geo_seo_*.sql.gz" -mtime +30 -delete

echo "==> Done"
