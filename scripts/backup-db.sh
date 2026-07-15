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
#   DATABASE_URL   — postgres 연결 (없으면 cleanerp-postgres 컨테이너에 docker exec 시도)
#
# 2026-07-15: docker compose exec 방식은 이 호스트의 실제 cleanerp-postgres 컨테이너가
# docker-compose.prod.yml이 정의하는 "postgres" 서비스와 매칭되지 않아(컨테이너가 compose
# 라벨 없이 별도 생성됨 — docker-compose.yml의 "db" 서비스도 다른 컨테이너) 항상 실패했다.
# cleanerp-app이 실제로 연결하는 컨테이너 이름(DATABASE_URL 호스트명)을 그대로 사용한다.

set -euo pipefail

# cron은 스크립트 파일 위치가 아니라 $HOME 등 임의 cwd에서 실행하므로,
# 아래 .env.prod/docker-compose.prod.yml 상대경로가 깨지지 않도록 항상 프로젝트 루트로 이동한다.
# (2026-07-07 이후 9일간 이 문제로 백업이 전부 빈 파일로 실패했던 원인)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

BACKUP_DIR="${BACKUP_DIR:-$HOME/wci-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
KST_DATE="$(TZ=Asia/Seoul date +%Y-%m-%d)"

mkdir -p "$BACKUP_DIR"

OUT="${BACKUP_DIR}/wci_${TIMESTAMP}.sql.gz"
LOG="${BACKUP_DIR}/backup.log"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] backup start → $OUT" | tee -a "$LOG"

DB_CONTAINER="${DB_CONTAINER:-cleanerp-postgres}"

if [ -n "${DATABASE_URL:-}" ]; then
  pg_dump --no-owner --no-acl --clean --if-exists "$DATABASE_URL" | gzip > "$OUT"
else
  docker exec "$DB_CONTAINER" \
    sh -c 'pg_dump --no-owner --no-acl --clean --if-exists -U "$POSTGRES_USER" "$POSTGRES_DB"' \
    | gzip > "$OUT"
fi

# 빈 덤프(예: pg_dump/docker exec 조용히 실패해 gzip이 빈 스트림만 받은 경우)를
# 정상 백업으로 착각하지 않도록 무결성 + 최소 크기 검증 후에만 성공 처리한다.
if ! gzip -t "$OUT" 2>/dev/null; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] backup FAILED — corrupt gzip → $OUT" | tee -a "$LOG"
  rm -f "$OUT"
  exit 1
fi
BYTES="$(zcat "$OUT" | wc -c)"
if [ "$BYTES" -lt 1000 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] backup FAILED — dump too small (${BYTES} bytes), pg_dump likely failed silently → $OUT" | tee -a "$LOG"
  rm -f "$OUT"
  exit 1
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
