# Deploy Readiness — 첫 외부 업체 onboarding 체크리스트

> Plan SC: 2 업체 + 2 지자체 베타 운영 전 P0 안전장치 3건 처리.
> Date: 2026-04-28.

## 1. 환경변수 검증

`lib/env.ts` 가 부팅 시 다음을 강제. 누락 시 즉시 실패.

| Key | Required | Min Length | Note |
|---|---|---|---|
| `JWT_SECRET` | ✅ | 32자 | `openssl rand -hex 32` 권장 |
| `KMS_LOCAL_KEY` | ✅ | 32자 | `openssl rand -hex 32` |
| `DATABASE_URL` | ✅ | 10자+ | `postgresql://user:pass@host:5432/db` |
| `NODE_ENV` | optional | — | production / development / test |
| `COOKIE_SECURE` | optional | — | E2E http localhost 만 'false', 운영은 미설정 |

**확인**:
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml config | grep -E "JWT_SECRET|KMS_LOCAL_KEY"
```

## 2. DB 백업 cron

```bash
# crontab -e — 매일 KST 03:00 백업
0 18 * * * cd /home/user/my-pjt/wci-mvp/waste-erp && /bin/bash scripts/backup-db.sh >> /var/log/wci-backup.log 2>&1
```

- 보관: 14일 (`RETENTION_DAYS` env 로 조정)
- 저장 경로: `$HOME/wci-backups/wci_YYYYMMDD_HHMMSS.sql.gz`
- 가장 최근: `latest.sql.gz` 심볼릭

**복구 테스트**:
```bash
gunzip -c $HOME/wci-backups/latest.sql.gz | psql "$DATABASE_URL"
```

## 3. 보안 헤더

`next.config.js` 에 적용된 헤더:
- HSTS (1년 + includeSubDomains)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy (geolocation/camera self only)
- **CSP** (Content Security Policy) — Leaflet/Nominatim 도메인만 허용

검증:
```bash
curl -sI https://wci.helpbiz.kr/ | grep -i "strict-transport\|x-frame\|content-security"
```

## 4. Cross-tenant 격리 검증

- e2e: `tenant-isolation.spec.ts` (5 시나리오)
- CI step: "Run tenant-isolation"
- 시나리오:
  1. CONTRACTOR_ADMIN 자사 contractorId 만 노출
  2. 비-SUPER 의 `/api/super-admin/*` 호출 → 403
  3. CONTRACTOR_ADMIN 이 다른 contractorId 조회 시 차단
  4. 미인증 호출 → 401
  5. MUNI_ADMIN GET-only — mutate 차단

수동:
```bash
# 2 contractor 시드 후 (예: 강남구 + 파주시)
curl -b "wciSession=업체A_token" /api/users  # 업체A 사용자만
curl -b "wciSession=업체B_token" /api/users  # 업체B 사용자만 (상호 노출 X)
```

## 5. 배포 시퀀스 (이번 주)

### Day 1 — 안전장치 (지금 처리)
- [x] JWT env 검증
- [x] 백업 스크립트
- [x] CSP 헤더
- [x] 격리 e2e

### Day 2 — 시드 + 도메인
- [ ] 운영 .env.prod 에 JWT_SECRET / KMS_LOCAL_KEY 32+자 hex 설정
- [ ] crontab 등록
- [ ] DNS: wci.helpbiz.kr A 레코드
- [ ] TLS: Let's Encrypt 또는 Cloudflare proxy
- [ ] 슈퍼관리자 콘솔에서 지자체 2 + 위탁업체 2 + 행정동 + 처리시설 + 권한 정책 시드

### Day 3 — Onboarding
- [ ] 업체 A 관리자 demo (30분)
- [ ] 업체 B 관리자 demo (30분)
- [ ] 지자체 모니터링 계정 demo (30분 × 2)

### Day 4~5 — 모니터링 + 피드백
- [ ] UptimeRobot 무료 플랜 등록
- [ ] 슬랙/카톡방 (운영 1 + 업체 2 + 지자체 2)
- [ ] 매일 09:00 audit_log 점검
- [ ] 주 1회 사용성 인터뷰

## 6. 배포 후 우선순위 (첫 2주)

| 우선순위 | 항목 | 출처 |
|---|---|---|
| P0-잔여 | GPS 좌표 라운딩 + 90일 NULL cron | security |
| P0-잔여 | SUPER_ADMIN mutate 차단 | security |
| P0-잔여 | tenant-scoped Prisma extension | enterprise |
| P0-잔여 | audit_log.contractorId 컬럼 | enterprise |
| P1 | rate limiting (`/api/auth/login` brute force) | security |
| P1 | 평문 PII 암호화 (phone/employeeNo 등) | security |
| P1 | Stripe/토스페이먼츠 정기결제 | strategy |

## 7. 롤백 절차

문제 발생 시:
```bash
# 직전 안정 main 태그로 복구
git checkout v0.1.0  # 또는 직전 머지 커밋
docker compose --env-file .env.prod -f docker-compose.prod.yml build app
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d app

# DB 복구 (최후 수단)
gunzip -c $HOME/wci-backups/wci_YYYYMMDD_HHMMSS.sql.gz | psql "$DATABASE_URL"
```

## 8. 비상 연락처

- 1인 운영자 즉시 알림: `JWT_SECRET` / `KMS_LOCAL_KEY` 누락 시 부팅 실패 → 콘솔 로그
- UptimeRobot 알림: 다운 5분 후 이메일/슬랙
- DB 백업 실패 시: backup.log 의 stderr 모니터링

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 0.1 | 2026-04-28 | 초안 — Day 1 안전장치 3건 통합 |
