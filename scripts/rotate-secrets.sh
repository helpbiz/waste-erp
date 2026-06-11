#!/usr/bin/env bash
# P1-6: 운영 시크릿 교체 절차
# 실행: bash scripts/rotate-secrets.sh
# 주의: 이 스크립트는 새 시크릿 값을 출력할 뿐이며 자동 적용하지 않는다.
#       관리자가 검토 후 .env.prod 에 수동 반영하고 컨테이너를 재시작해야 한다.
#
# ⚠️ JWT_SECRET 교체 시: 모든 사용자 세션이 만료(재로그인 필요)
# ⚠️ KMS_LOCAL_KEY 교체 시: 기존 암호화 데이터 복호화 불가 → 반드시 DB PII 재암호화 필요
#    재암호화 절차: npx tsx scripts/encrypt-pii.ts --rekey (미구현, 별도 작업 필요)

set -euo pipefail

echo "=============================="
echo " CleanERP 시크릿 생성기 (P1-6)"
echo "=============================="
echo ""
echo "# 다음 값을 .env.prod 에 반영하세요:"
echo ""

printf "JWT_SECRET=%s\n" "$(openssl rand -hex 32)"
printf "CRON_SECRET=%s\n" "$(openssl rand -hex 32)"
printf "NOC_ISSUE_SECRET=%s\n" "$(openssl rand -base64 48 | tr -d '\n')"
printf "KMS_LOCAL_KEY=%s\n" "$(openssl rand -base64 32)"

echo ""
echo "# ⚠️ KMS_LOCAL_KEY를 교체하면 기존 암호화 데이터 복호화 불가."
echo "#    신규 구축 시에만 KMS_LOCAL_KEY를 교체하세요."
echo "#    기존 운영 서버에서는 JWT_SECRET, CRON_SECRET만 교체 권장."
echo ""
echo "교체 후 컨테이너 재시작:"
echo "  docker compose stop app && docker compose up -d app"
