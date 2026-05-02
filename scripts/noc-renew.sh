#!/bin/bash
# NOC 무인 단말 토큰 자동 갱신 (long-lived JWT 방식)
#
# 동작:
#   1. chromium 쿠키 DB의 wciSession 만료 시각 확인
#   2. 만료까지 RENEW_THRESHOLD_DAYS(기본 14일) 이내이면 신규 90일 토큰 발급
#   3. 발급 성공 시 쿠키 DB에 주입 + chromium 재시작
#   4. 만료까지 충분하면 아무것도 안 함 (no-op, 매일 cron 부담 0)
#
# 시크릿: ~/.noc-issue-secret (chmod 600)
# 로그:   ~/.noc-renew.log
# cron:   매일 04:30 KST (재부팅 5시 전 안전 시각)

set -euo pipefail

API_BASE="https://wci.helpbiz.kr"
USERNAME="super"
TTL_DAYS=90
RENEW_THRESHOLD_DAYS=14

SECRET_FILE="$HOME/.noc-issue-secret"
COOKIE_DB="$HOME/snap/chromium/common/chromium/Default/Cookies"
LOG="$HOME/.noc-renew.log"

log() { echo "$(date '+%F %T') $*" >> "$LOG"; }

if [ ! -r "$SECRET_FILE" ]; then
  log "ERR: 시크릿 파일 없음 ($SECRET_FILE)"
  exit 1
fi
SECRET=$(cat "$SECRET_FILE")

# 1. 현재 쿠키 만료 시각 (Unix epoch)
NOW_S=$(date +%s)
CUR_EXP_W=$(sqlite3 "$COOKIE_DB" \
  "SELECT expires_utc FROM cookies WHERE host_key='wci.helpbiz.kr' AND name='wciSession';" 2>/dev/null || echo "")

if [ -n "$CUR_EXP_W" ]; then
  CUR_EXP_S=$(( CUR_EXP_W / 1000000 - 11644473600 ))
  REMAIN_DAYS=$(( (CUR_EXP_S - NOW_S) / 86400 ))
  log "현재 토큰 만료까지 $REMAIN_DAYS일 (exp=$(date -d @$CUR_EXP_S '+%F %T'))"
  if [ "$REMAIN_DAYS" -gt "$RENEW_THRESHOLD_DAYS" ]; then
    log "갱신 불필요 (threshold=${RENEW_THRESHOLD_DAYS}일) — 종료"
    exit 0
  fi
else
  log "기존 토큰 없음 — 신규 발급"
fi

# 2. 신규 토큰 발급
log "토큰 발급 요청 (ttl=${TTL_DAYS}일)..."
RESP=$(curl -sk -X POST "$API_BASE/api/auth/noc-issue" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SECRET" \
  -d "{\"username\":\"$USERNAME\",\"ttlDays\":$TTL_DAYS}" \
  -m 15 -w "\n%{http_code}")
HTTP=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)

if [ "$HTTP" != "200" ]; then
  log "ERR: 발급 실패 HTTP=$HTTP body=$BODY"
  exit 2
fi

JWT=$(echo "$BODY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))")
if [ -z "$JWT" ] || [ ${#JWT} -lt 100 ]; then
  log "ERR: 응답에 토큰 없음 body=$BODY"
  exit 3
fi
log "발급 성공 (length=${#JWT})"

# 3. 시간 계산 (Chrome WebKit time)
NEW_NOW_S=$(date +%s)
NOW_W=$(( (NEW_NOW_S + 11644473600) * 1000000 ))
EXP_S=$(( NEW_NOW_S + TTL_DAYS * 86400 ))
EXP_W=$(( (EXP_S + 11644473600) * 1000000 ))

# 4. chromium 종료 (DB lock 해제)
DISPLAY=:1 XAUTHORITY=/run/user/1000/gdm/Xauthority pkill -f chromium 2>/dev/null || true
sleep 3

# 5. 쿠키 DB 주입
sqlite3 "$COOKIE_DB" <<SQL
DELETE FROM cookies WHERE host_key='wci.helpbiz.kr' AND name='wciSession';
INSERT INTO cookies VALUES (
  $NOW_W, 'wci.helpbiz.kr', '', 'wciSession', '$JWT',
  X'', '/', $EXP_W, 0, 1,
  $NOW_W, 1, 1, 1, 2,
  2, 443, $NOW_W, 0, 0
);
SQL
log "쿠키 주입 완료 (exp=$(date -d @$EXP_S '+%F %T'))"

# 6. chromium 재시작 (watchdog 호출)
"$HOME/bin/noc-watchdog.sh" 2>/dev/null || log "WARN: watchdog 호출 실패"

# 7. 검증
sleep 5
NEW_COUNT=$(ps aux | grep -i chromium | grep -v grep | wc -l)
log "chromium 프로세스: $NEW_COUNT (5 이상이면 OK)"
log "갱신 완료"
