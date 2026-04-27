# 운영 Runbook — 1인 운영자 가이드

> 베타 (2 업체 + 2 지자체) 운영을 위한 일일/주간/장애 대응 매뉴얼.
> Date: 2026-04-28.

## 1. 배포 — One-time 셋업

### 1.1 시크릿 생성
```bash
# 32+자 hex 생성 (각각 별도 값)
openssl rand -hex 32  # → JWT_SECRET 용
openssl rand -hex 32  # → KMS_LOCAL_KEY 용
```

### 1.2 .env.prod 갱신
```bash
JWT_SECRET=<위에서 생성한 hex 64자>
KMS_LOCAL_KEY=<위에서 생성한 hex 64자>
SEED_PASSWORD=<운영용 강력한 비밀번호>
NODE_ENV=production
DATABASE_URL=postgresql://cleanerp:<DB_PASSWORD>@postgres:5432/cleanerp_prod
```

### 1.3 Docker 재빌드
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml build app
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

> ⚠ JWT_SECRET 누락 또는 32자 미만 시 **부팅 실패** (의도된 안전장치)

### 1.4 베타 시드 (2 업체 + 2 지자체)
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T app sh -c '
  cd /app && npx prisma db push && npx tsx prisma/seed.ts && npx tsx prisma/seeds/beta-onboarding.ts
'
```

**결과 — 7개 계정 생성** (비밀번호: SEED_PASSWORD):
- `super` — 슈퍼관리자
- `muni1` — 강남구 환경과 (MUNI_ADMIN, GET-only)
- `muni2` — 파주시 환경과 (MUNI_ADMIN, GET-only)
- `company1` — (주)한국청소서비스 관리자
- `company2` — (주)파주환경 관리자
- `worker1a` — 강남 작업자 (RAPID 기동반)
- `worker1b` — 강남 작업자
- `worker2a` — 파주 작업자

### 1.5 백업 cron
```bash
crontab -e
# 추가
0 18 * * * cd /home/user/my-pjt/wci-mvp/waste-erp && /bin/bash scripts/backup-db.sh >> /var/log/wci-backup.log 2>&1
```

### 1.6 DNS + TLS

#### Cloudflare 사용 (권장 — 무료)
1. helpbiz.kr DNS 영역 → A 레코드 `wci` → 서버 IP
2. Cloudflare Proxy 활성 (오렌지 구름) → 자동 TLS
3. SSL/TLS → Full (Strict) 모드

#### Let's Encrypt 직접 (Caddy 권장)
```caddyfile
# /etc/caddy/Caddyfile
wci.helpbiz.kr {
  reverse_proxy localhost:3001
  encode gzip
}
```

### 1.7 모니터링

#### UptimeRobot (무료)
1. https://uptimerobot.com 가입
2. New Monitor → HTTP(s) → `https://wci.helpbiz.kr/api/health`
3. 5분 간격, 알림: 이메일 + 슬랙 webhook

---

## 2. 일일 운영 체크리스트

### 매일 09:00
- [ ] UptimeRobot 알림 점검 (다운 이벤트 X)
- [ ] 백업 로그: `tail -1 ~/wci-backups/backup.log`
- [ ] AuditLog 점검 (슈퍼관리자 콘솔):
  - 로그인 실패 폭주? → brute force 의심
  - SUPER_ADMIN cross-tenant 조회? → 본인 작업 외 알림
  - DELETE 액션? → 의도성 확인

### 매일 17:00
- [ ] 슬랙/카톡 베타 채널 응답 (4시간 SLA)
- [ ] 신규 민원/사고 유무 (MUNI_ADMIN 콘솔에서)

### 주 1회 (월요일)
- [ ] 사용성 인터뷰 1건 (각 업체 격주 30분)
- [ ] 사용량 점검 (사용자 / 차량 / 민원 / PDF 출력 수)
- [ ] 백업 복구 테스트 (월 1회):
  ```bash
  # 최신 백업으로 staging DB 복구 검증
  gunzip -c ~/wci-backups/latest.sql.gz | psql postgresql://staging-url
  ```
- [ ] P0 잔여 처리 1건 (GPS / SUPER mutate / Prisma extension / audit contractorId 중)

---

## 3. 신규 위탁업체 onboarding

### 3.1 슈퍼관리자 콘솔에서
1. **지자체 관리** 탭 → `+ 지자체 신규 등록` (이미 등록된 경우 skip)
2. **회사정보·차고지** 탭 → 지자체 선택 → `+ 신규 등록` → 업체 등록
3. **회사정보·차고지** 탭 → 차고지 주소·좌표 입력 → 저장
4. **처리시설** 탭 → 지자체 선택 → 처리시설 등록
5. **권한설정** 탭 → 지자체 정책 선택 → 허용 화면·보고서 체크
6. **사용자관리** 메뉴 → `+ 신규 사용자` → CONTRACTOR_ADMIN 1계정

### 3.2 신규 업체 demo (30분)
- 첫 로그인 + 비밀번호 변경 안내
- 차량/직원 등록 시연
- 출퇴근 / 민원 등록 / F-02 보고서 시연
- 슬랙/카톡 베타 채널 초대

---

## 4. 장애 대응

### 4.1 다운 알림 받았을 때
```bash
# 1. 컨테이너 상태
docker compose --env-file .env.prod -f docker-compose.prod.yml ps

# 2. 로그 확인
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=200 app

# 3. 헬스체크
curl https://wci.helpbiz.kr/api/health

# 4. 재시작 (안전)
docker compose --env-file .env.prod -f docker-compose.prod.yml restart app
```

### 4.2 데이터 사고 (의심 cross-tenant 노출)
1. **즉시 콘솔 접근 차단**: Cloudflare Access 또는 Docker stop
2. AuditLog 분석 (SUPER_ADMIN 콘솔 또는 직접 SQL):
   ```sql
   SELECT * FROM audit_logs
    WHERE created_at > NOW() - INTERVAL '1 day'
    ORDER BY created_at DESC LIMIT 100;
   ```
3. 고객 안내 (PIPA §34 — 사고 인지 후 72시간 내 신고)
4. 패치 적용 + 재시작

### 4.3 DB 복구
```bash
# 최신 백업으로 복구 (운영 DB 덮어쓰기)
gunzip -c ~/wci-backups/latest.sql.gz | docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres psql -U cleanerp -d cleanerp_prod
```

### 4.4 코드 롤백
```bash
git log --oneline -20  # 안정 커밋 찾기
git checkout <hash>
docker compose --env-file .env.prod -f docker-compose.prod.yml build app
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

---

## 5. SLA — 베타 기간

| 항목 | 약정 |
|---|---|
| Uptime | Best effort (99% 목표, 보장 X) |
| 응답 시간 | 평일 09:00~18:00 4시간 내, 야간 다음 영업일 |
| 데이터 보관 | 운영 DB + 14일 백업 |
| 가격 | **무료 베타 2주** → 그 후 Standard 189K/월 의향 확인 |
| 환불 | 장애로 운영 불가 시 일할 환불 |

---

## 6. 비상 연락처

| 역할 | 담당 |
|---|---|
| 1인 운영자 | 4365won@gmail.com |
| 호스팅 (Cloudflare) | dash.cloudflare.com |
| 호스팅 (Docker 서버) | (서버 ssh 접근 정보 별도) |
| DB 호스팅 | 자체 PostgreSQL 16 (Docker) |

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 0.1 | 2026-04-28 | 초안 — 베타 onboarding runbook |
