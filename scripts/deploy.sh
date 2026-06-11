#!/usr/bin/env bash
# CleanERP 배포 스크립트 — P2-4: 마이그레이션 자동화
#
# 사용법: bash scripts/deploy.sh
#
# 수행 순서:
#  1) DB 마이그레이션 (prisma migrate deploy)
#  2) Docker 이미지 빌드
#  3) 컨테이너 교체 (무중단은 보장하지 않음 — 재시작 시간 5~15초)
#
# 전제: waste-erp 디렉터리에서 실행, .env 파일 존재, cleanerp-postgres 컨테이너 실행 중

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

log() { echo "[$(date '+%H:%M:%S')] $*"; }
err() { echo "[ERROR] $*" >&2; exit 1; }

cd "$PROJECT_DIR"

# ── 0. 외부 Docker 네트워크 보장 ────────────────────────────────────────────
log "0/3 외부 네트워크 확인 중..."
docker network inspect wci_cost_bridge >/dev/null 2>&1 \
  || { docker network create wci_cost_bridge; log "  wci_cost_bridge 네트워크 생성 완료"; }

# ── 1. DB 마이그레이션 ──────────────────────────────────────────────────────
log "1/3 DB 마이그레이션 확인 중..."
# 대기 중인 마이그레이션 수 확인
PENDING=$(npx prisma migrate status 2>&1 | grep "Following migration" | wc -l || true)
if [ "$PENDING" -gt 0 ] 2>/dev/null || npx prisma migrate status 2>&1 | grep -q "Database schema is not up to date"; then
  log "  마이그레이션 실행 중..."
  npx prisma migrate deploy
  log "  마이그레이션 완료"
else
  log "  마이그레이션 최신 상태 — 스킵"
fi

# ── 2. Docker 이미지 빌드 ────────────────────────────────────────────────────
log "2/3 Docker 이미지 빌드 중..."
# P2-8: BuildKit secret 전달 — ENV에 구운 스텁 값 대신 /run/secrets 마운트 사용
#   .env 에 실제 값이 있으면 사용, 없으면 stub fallback (Dockerfile 내 default 사용)
JWT_SECRET_VAL=$(grep -E '^JWT_SECRET=' .env 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"'"'")
KMS_KEY_VAL=$(grep -E '^KMS_LOCAL_KEY=' .env 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"'"'")

BUILD_OPTS=""
if [ -n "$JWT_SECRET_VAL" ]; then
  BUILD_OPTS="$BUILD_OPTS --secret id=jwt_secret,env=JWT_SECRET"
  export JWT_SECRET="$JWT_SECRET_VAL"
fi
if [ -n "$KMS_KEY_VAL" ]; then
  BUILD_OPTS="$BUILD_OPTS --secret id=kms_local_key,env=KMS_LOCAL_KEY"
  export KMS_LOCAL_KEY="$KMS_KEY_VAL"
fi

# shellcheck disable=SC2086
DOCKER_BUILDKIT=1 docker build -t cleanerp-app:latest $BUILD_OPTS . 2>&1 | tail -5
log "  빌드 완료"

# ── 3. 컨테이너 교체 ────────────────────────────────────────────────────────
log "3/3 컨테이너 재시작 중..."
docker stop cleanerp-app 2>/dev/null || true
docker rm   cleanerp-app 2>/dev/null || true
docker compose up -d app

# 헬스체크 대기 (최대 60초)
log "  헬스체크 대기 중..."
for i in $(seq 1 12); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' cleanerp-app 2>/dev/null || echo "unknown")
  if [ "$STATUS" = "healthy" ]; then
    log "  컨테이너 정상 기동 (${i}×5초)"
    break
  fi
  if [ "$i" -eq 12 ]; then
    err "컨테이너가 60초 내 healthy 상태가 되지 않았습니다. 로그: docker logs cleanerp-app"
  fi
  sleep 5
done

log "배포 완료 ✓"
