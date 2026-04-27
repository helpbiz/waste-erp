#!/usr/bin/env bash
# wci-erp DB 일일 백업 — pg_dump + gzip
# Plan SC: deploy-readiness P0 — 첫 외부 업체 운영 전 백업 자동화
#
# 사용법:
#   1. crontab 등록 (KST 03:00):  0 18 * * * /path/to/scripts/backup-db.sh
#   2. 수동 실행:                  ./scripts/backup-db.sh
#
# 환경변수:
#   BACKUP_DIR     — 저장 경로 (기본: $HOME/wci-backups)
#   RETENTION_DAYS — 보관 일수 (기본: 14)
#   DATABASE_URL   — postgres 연결 (없으면 docker compose exec 시도)

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/wci-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
KST_DATE="$(TZ=Asia/Seoul date +%Y-%m-%d)"

mkdir -p "$BACKUP_DIR"

OUT="${BACKUP_DIR}/wci_${TIMESTAMP}.sql.gz"
LOG="${BACKUP_DIR}/backup.log"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] backup start → $OUT" | tee -a "$LOG"

if [ -n "${DATABASE_URL:-}" ]; then
  pg_dump --no-owner --no-acl --clean --if-exists "$DATABASE_URL" | gzip > "$OUT"
else
  # docker compose 시도 — cleanerp-postgres 컨테이너 가정
  docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres \
    sh -c 'pg_dump --no-owner --no-acl --clean --if-exists -U "$POSTGRES_USER" "$POSTGRES_DB"' \
    | gzip > "$OUT"
fi

SIZE="$(du -h "$OUT" | cut -f1)"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] backup ok → $OUT ($SIZE)" | tee -a "$LOG"

# 오래된 백업 정리 — RETENTION_DAYS 초과
find "$BACKUP_DIR" -name 'wci_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
echo "[$(date '+%Y-%m-%d %H:%M:%S')] cleanup: > $RETENTION_DAYS days deleted" | tee -a "$LOG"

# 가장 최근 5개만 남기는 sym-link (운영 편의)
LATEST_LINK="${BACKUP_DIR}/latest.sql.gz"
ln -sfn "$OUT" "$LATEST_LINK"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] done — KST $KST_DATE — latest: $LATEST_LINK" | tee -a "$LOG"
