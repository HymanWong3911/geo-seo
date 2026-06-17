#!/usr/bin/env bash
# 数据库恢复脚本
# 用法: ./scripts/restore.sh /path/to/backup.sql.gz
set -euo pipefail

BACKUP_FILE="${1:-}"
if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: $0 <backup.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -lh ./backups/geo_seo_*.sql.gz 2>/dev/null || echo "  (no backups found)"
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "WARNING: This will REPLACE the current database!"
echo "Backup file: ${BACKUP_FILE}"
read -p "Continue? (yes/no): " CONFIRM
if [ "${CONFIRM}" != "yes" ]; then
  echo "Aborted"
  exit 1
fi

echo "==> Restoring ${BACKUP_FILE}"
gunzip -c "${BACKUP_FILE}" | docker compose exec -T postgres psql -U geo_seo -d geo_seo

echo "==> Done"
