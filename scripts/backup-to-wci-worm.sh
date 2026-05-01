#!/usr/bin/env bash
# CleanERP 백업 — 192.168.1.25 (wci-worm) 로 SSH/rsync 전송.
#
# 실행:
#   bash scripts/backup-to-wci-worm.sh         # 일반 (db + code)
#   bash scripts/backup-to-wci-worm.sh full    # 풀 (db + code + .env + uploads)
#   bash scripts/backup-to-wci-worm.sh --dry   # 전송 없이 압축만
#
# 권장 cron (lab3 서버 user crontab):
#   30 3  * * *  bash /home/user/my-pjt/wci-mvp/waste-erp/scripts/backup-to-wci-worm.sh         >> /var/log/cleanerp-backup.log 2>&1
#   30 4  * * 0  bash /home/user/my-pjt/wci-mvp/waste-erp/scripts/backup-to-wci-worm.sh full    >> /var/log/cleanerp-backup.log 2>&1

set -euo pipefail

# ─── 설정 ──────────────────────────────────────────────────────────────────
BACKUP_HOST="${BACKUP_HOST:-192.168.1.25}"
BACKUP_USER="${BACKUP_USER:-user}"
BACKUP_BASE="${BACKUP_BASE:-/home/user/cleanerp-backup}"
PROJECT_DIR="${PROJECT_DIR:-/home/user/my-pjt/wci-mvp/waste-erp}"
DB_CONTAINER="${DB_CONTAINER:-cleanerp-postgres}"
DB_NAME="${DB_NAME:-cleanerp_prod}"
DB_USER="${DB_USER:-cleanerp}"
RETENTION_DAILY=30   # 30일치 보관
RETENTION_WEEKLY=12  # 풀백업 12주 보관
SSH_OPTS="${SSH_OPTS:--o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new}"

MODE="${1:-daily}"
DRY="${2:-}"
[[ "$MODE" == "--dry" ]] && { DRY="--dry"; MODE="daily"; }

DATE_TAG="$(date +%Y%m%d-%H%M)"
WEEK_TAG="$(date +%Y-W%V)"
TMP_DIR="$(mktemp -d /tmp/cleanerp-backup.XXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

log() { echo "[$(date +'%F %T')] $*"; }

# ─── 1. DB 덤프 ────────────────────────────────────────────────────────────
log "▶ DB dump ($DB_NAME)"
DB_DUMP="$TMP_DIR/cleanerp-db-${DATE_TAG}.sql.gz"
docker exec -i "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --clean --if-exists \
    | gzip -9 > "$DB_DUMP"
DB_SIZE=$(du -h "$DB_DUMP" | cut -f1)
log "  ✓ $DB_DUMP ($DB_SIZE)"

# ─── 2. 코드 git bundle ────────────────────────────────────────────────────
log "▶ Code git bundle"
CODE_BUNDLE="$TMP_DIR/cleanerp-code-${DATE_TAG}.bundle"
git -C "$PROJECT_DIR" bundle create "$CODE_BUNDLE" --all 2>/dev/null
CODE_SIZE=$(du -h "$CODE_BUNDLE" | cut -f1)
log "  ✓ $CODE_BUNDLE ($CODE_SIZE)"

# ─── 3. 풀 모드 — .env / uploads 추가 ──────────────────────────────────────
if [[ "$MODE" == "full" ]]; then
  log "▶ Full mode — .env + uploads"
  ENV_TAR="$TMP_DIR/cleanerp-env-${DATE_TAG}.tar.gz"
  tar -czf "$ENV_TAR" \
      -C "$PROJECT_DIR" \
      --ignore-failed-read \
      .env .env.prod .env.local 2>/dev/null || true

  # uploads / static asset 백업 (있을 때만)
  if [[ -d "$PROJECT_DIR/uploads" ]]; then
    UPLOADS_TAR="$TMP_DIR/cleanerp-uploads-${DATE_TAG}.tar.gz"
    tar -czf "$UPLOADS_TAR" -C "$PROJECT_DIR" uploads
    log "  ✓ $UPLOADS_TAR"
  fi
fi

# ─── 4. 메니페스트 ─────────────────────────────────────────────────────────
MANIFEST="$TMP_DIR/MANIFEST-${DATE_TAG}.txt"
cat > "$MANIFEST" <<EOF
CleanERP Backup — $(date +'%F %T %Z')
mode: $MODE
host: $(hostname)
git_head: $(git -C "$PROJECT_DIR" rev-parse HEAD 2>/dev/null || echo 'n/a')
git_branch: $(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'n/a')
db_container: $DB_CONTAINER
db_size: $DB_SIZE
code_size: $CODE_SIZE
files:
$(ls -lh "$TMP_DIR" | tail -n +2 | awk '{print "  - "$NF" ("$5")"}')
EOF
cat "$MANIFEST"

# ─── 5. 원격 전송 ──────────────────────────────────────────────────────────
if [[ "$DRY" == "--dry" ]]; then
  log "▶ DRY RUN — 전송 skip. 로컬 보관: $TMP_DIR"
  trap - EXIT
  exit 0
fi

REMOTE_PATH="$BACKUP_BASE/$([[ "$MODE" == "full" ]] && echo weekly/$WEEK_TAG || echo daily)"
log "▶ rsync → $BACKUP_USER@$BACKUP_HOST:$REMOTE_PATH"

ssh $SSH_OPTS "$BACKUP_USER@$BACKUP_HOST" "mkdir -p '$REMOTE_PATH'"
rsync -avz --partial -e "ssh $SSH_OPTS" \
  "$TMP_DIR"/ \
  "$BACKUP_USER@$BACKUP_HOST:$REMOTE_PATH/"

log "  ✓ 원격 전송 완료"

# ─── 6. 원격 retention 정리 ────────────────────────────────────────────────
log "▶ Retention 정리 (daily $RETENTION_DAILY 일, weekly $RETENTION_WEEKLY 주)"
ssh $SSH_OPTS "$BACKUP_USER@$BACKUP_HOST" bash -s <<EOF
set -e
cd "$BACKUP_BASE/daily" 2>/dev/null && find . -maxdepth 1 -type f -mtime +$RETENTION_DAILY -delete || true
cd "$BACKUP_BASE/weekly" 2>/dev/null && \
  ls -dt */ 2>/dev/null | tail -n +\$((RETENTION_WEEKLY + 1)) | xargs -r rm -rf || true
EOF

log "✅ 백업 완료 (mode=$MODE, tag=$DATE_TAG)"
