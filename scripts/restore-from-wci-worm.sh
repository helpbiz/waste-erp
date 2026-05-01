#!/usr/bin/env bash
# CleanERP 복원 — 192.168.1.25 백업본에서 DB / 코드 복구.
#
# 사용:
#   bash scripts/restore-from-wci-worm.sh list                    # 백업 목록
#   bash scripts/restore-from-wci-worm.sh db <backup-tag>         # DB 복원만
#   bash scripts/restore-from-wci-worm.sh full <backup-tag>       # DB + code bundle
#
# ⚠️ DB 복원은 현재 DB 를 완전히 덮어쓴다 — 사용 전 별도 백업 필수!

set -euo pipefail

BACKUP_HOST="${BACKUP_HOST:-192.168.1.25}"
BACKUP_USER="${BACKUP_USER:-user}"
BACKUP_BASE="${BACKUP_BASE:-/home/user/cleanerp-backup}"
DB_CONTAINER="${DB_CONTAINER:-cleanerp-postgres}"
DB_NAME="${DB_NAME:-cleanerp_prod}"
DB_USER="${DB_USER:-cleanerp}"
SSH_OPTS="${SSH_OPTS:--o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new}"

CMD="${1:-list}"
TAG="${2:-}"

log() { echo "[$(date +'%F %T')] $*"; }

case "$CMD" in
  list)
    log "원격 백업 목록 (192.168.1.25)"
    echo "=== daily ==="
    ssh $SSH_OPTS "$BACKUP_USER@$BACKUP_HOST" "ls -lh $BACKUP_BASE/daily 2>/dev/null | tail -50"
    echo "=== weekly ==="
    ssh $SSH_OPTS "$BACKUP_USER@$BACKUP_HOST" "ls $BACKUP_BASE/weekly 2>/dev/null"
    ;;

  db)
    [[ -z "$TAG" ]] && { echo "Usage: $0 db <YYYYMMDD-HHMM>"; exit 1; }
    REMOTE_FILE="$BACKUP_BASE/daily/cleanerp-db-${TAG}.sql.gz"
    log "▶ 원격에서 DB 덤프 가져오기: $REMOTE_FILE"

    LOCAL_TMP="$(mktemp -d)"
    trap 'rm -rf "$LOCAL_TMP"' EXIT

    rsync -avz -e "ssh $SSH_OPTS" \
      "$BACKUP_USER@$BACKUP_HOST:$REMOTE_FILE" \
      "$LOCAL_TMP/"

    log "▶ 안전 백업 — 현재 DB → /tmp/cleanerp-pre-restore-$(date +%s).sql.gz"
    docker exec -i "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" \
      | gzip > "/tmp/cleanerp-pre-restore-$(date +%s).sql.gz"

    read -p "현재 DB 를 ${TAG} 백업으로 덮어씁니다. 진행? [yes/NO]: " CONFIRM
    [[ "$CONFIRM" != "yes" ]] && { log "취소됨"; exit 0; }

    log "▶ DB 복원 시작"
    gunzip -c "$LOCAL_TMP/cleanerp-db-${TAG}.sql.gz" \
      | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"

    log "✅ DB 복원 완료"
    ;;

  full)
    [[ -z "$TAG" ]] && { echo "Usage: $0 full <YYYYMMDD-HHMM>"; exit 1; }
    log "⚠ 풀 복원은 코드까지 영향. git fetch + reset --hard 필요."
    log "수동 절차로 진행하세요:"
    cat <<EOF

  1) 백업 디렉터리에서 bundle 가져오기:
     scp $BACKUP_USER@$BACKUP_HOST:$BACKUP_BASE/daily/cleanerp-code-${TAG}.bundle /tmp/

  2) 새 워크디렉토리에 클론:
     git clone /tmp/cleanerp-code-${TAG}.bundle ~/cleanerp-restored

  3) DB 복원:
     bash $0 db ${TAG}

  4) 컨테이너 재시작:
     cd ~/cleanerp-restored
     docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build app

EOF
    ;;

  *)
    echo "Usage: $0 {list|db <tag>|full <tag>}"
    exit 1
    ;;
esac
