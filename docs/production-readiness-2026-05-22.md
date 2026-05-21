# CleanERP 상용 서비스 전 점검 보고서

**점검일**: 2026-05-22  
**목표 서비스 오픈**: 2026-06-01  
**점검 범위**: 보안(security-architect) / 인프라·운영(infra-expert) / 코드 품질(code-analyzer) 전 영역

---

## 종합 결론

> **상용 배포 조건부 가능** — P0 이슈 6건 해결 후 오픈. P1은 오픈 후 1주 내 완료.  
> 앱 코드 베이스라인은 양호(Zod 검증 일관, RBAC scope 헬퍼 재사용, audit logging 풍부).  
> 차단 요인은 대부분 **인프라·설정** 측면.

---

## P0 — 배포 차단 (오픈 전 필수)

### 1. `COOKIE_SECURE=false` → 세션 쿠키 Secure 플래그 누락

- **위치**: `.env.prod:24`, `lib/auth.ts:49`
- **영향**: HTTPS 사이트지만 HTTP 평문 요청이 한 번이라도 발생하면 JWT 세션 쿠키가 평문 전송 → MITM으로 세션 탈취 가능. httpOnly+sameSite=strict이어도 Secure 없으면 방어 불완전.
- **수정**:
  ```bash
  # .env.prod 에서 해당 라인 삭제 (또는 true로 변경)
  # COOKIE_SECURE=false  ← 이 줄 삭제
  ```
  삭제 시 `lib/auth.ts`의 fallback이 `NODE_ENV=production`이면 자동으로 `secure: true` 적용.

---

### 2. DB·Redis·MinIO 포트 인터넷 노출

- **위치**: `docker-compose.prod.yml` ports 매핑 + iptables 미설정
- **현재 상태**: `0.0.0.0:5433`, `0.0.0.0:5434` (PostgreSQL), `0.0.0.0:6379` (Redis), `0.0.0.0:9000-9001` (MinIO) 모두 인터넷 바인딩
- **영향**: `.env.prod`의 DB 비밀번호로 외부에서 직접 DB 접속 가능 → 데이터 탈취/백도어
- **수정**:
  ```bash
  # iptables 즉시 차단 (재시작 후 apply-iptables-cost.sh에도 추가)
  iptables -I INPUT -p tcp -m multiport --dports 5433,5434,6379,9000,9001 \
    ! -s 127.0.0.1 -j DROP
  ```
  docker-compose.prod.yml에서 `ports` 매핑을 `127.0.0.1:PORT:PORT` 형식으로 변경:
  ```yaml
  ports:
    - "127.0.0.1:5434:5432"
  ```

---

### 3. 시민 민원 IDOR

- **위치**: `app/api/citizen/complaints/route.ts:164-196` GET
- **현상**: `?phone=010-XXXX-YYYY` 파라미터만으로 타인의 민원 전체(주소·사진·코멘트) 조회 가능. 인증 없음. 전화번호 enumeration으로 대량 수집 가능.
- **수정 (단기)**:
  - POST 시 응답에 단기 lookup_token 발급
  - GET은 phone+token 조합으로만 허용
  - IP별 분당 5회 + phone별 분당 3회 rate limit

---

### 4. KMS_LOCAL_KEY ↔ MASTER_KEY_BASE64 환경변수 불일치

- **위치**: `lib/env.ts:13` ↔ `lib/kms.ts:39`
- **현상**: `env.ts`는 `KMS_LOCAL_KEY`를 32자 이상 강제하지만, `LocalKmsProvider`는 `process.env.MASTER_KEY_BASE64`를 읽음. 두 이름이 달라 실제 암호화 키가 `JWT_SECRET` 파생값으로 동작 중.
- **영향**: JWT_SECRET 노출 시 PII(건강기록 등) 복호화 가능
- **수정**:
  ```ts
  // lib/kms.ts LocalKmsProvider
  const b64 = process.env.KMS_LOCAL_KEY ?? process.env.MASTER_KEY_BASE64;
  ```
  추가로 `lib/env.ts`의 `getEnv()` 함수가 어디서도 호출되지 않음 → `instrumentation.ts` 또는 앱 최상위에서 1회 호출하여 부팅 시 환경변수 검증 활성화 필요.

---

### 5. BigInt 변환 미보호 → 잘못된 URL에서 500 + stack trace 노출

- **위치**: 28개 라우트 (`app/api/departments/[id]`, `app/api/complaints/[id]` 등)
- **현상**: `BigInt("abc")` → `SyntaxError` 미처리 → 500 응답 + stack trace 노출
- **수정**: `lib/audit.ts`에 `toBigIntOrNull` 이미 존재 — export하여 일괄 적용
  ```ts
  // lib/ids.ts (신규 or lib/audit.ts에서 re-export)
  export function parseId(v: unknown): bigint | null {
    try { return BigInt(String(v)); } catch { return null; }
  }
  // 각 [id] 라우트
  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  ```

---

### 6. DB 백업 cron 미등록

- **현상**: `scripts/backup-db.sh`, `backup-to-wci-worm.sh` 스크립트가 존재하지만 crontab에 등록되지 않음. 데이터 손실 시 복구 불가.
- **수정**:
  ```bash
  # crontab -e 에 추가
  30 3 * * * bash /home/user/my-pjt/wci-mvp/waste-erp/scripts/backup-db.sh >> /tmp/wci-cron-logs/cleanerp-backup.log 2>&1
  # 로그 디렉터리 생성
  mkdir -p /tmp/wci-cron-logs
  ```

---

## P1 — 출시 후 1주 내 완료

### 7. Math.random() 임시 비밀번호 생성 → crypto.randomInt()

- **위치**: `app/api/super-admin/users/[id]/reset-pw/route.ts:16`
- **수정**:
  ```ts
  import { randomInt } from 'node:crypto';
  // Math.random() 대신 randomInt(chars.length) 사용
  ```

### 8. SEED_PASSWORD 운영 잔존 확인

- `.env.prod`의 `SEED_PASSWORD=changeme1234!` 계정(super/muni/company/manager/worker)이 아직 초기 비밀번호를 사용 중이면 즉시 변경. 운영 entrypoint에서 `prisma db seed` 재실행 차단.

### 9. 스왑 91% 사용 (3.6/4.0 GB) — 개발 도구 분리 필요

- **원인**: Streamlit 대시보드 (~2.9GB), 개발용 VS Code Remote SSH TypeScript 서버 (~0.8GB) 등 개발 프로세스가 상시 실행 중
- **ERP 컨테이너 자체는 이상 없음** (cleanerp-app 72MB, cleanerp-postgres 80MB)
- **조치**: 상용 오픈 전 서버에서 개발용 프로세스 분리/중지. `swapoff -a && swapon -a`로 캐시 flush.
- **docker-compose.prod.yml 메모리 limit 추가 완료** (infra agent가 적용):
  - postgres: `memory: 512m`
  - app: `memory: 1g`

### 10. Docker 로그 rotation 설정 — 완료

- **infra agent가 docker-compose.prod.yml에 적용 완료**:
  - postgres: `max-size: 10m, max-file: 5`
  - app: `max-size: 20m, max-file: 10`
- 적용하려면 `docker compose -f docker-compose.prod.yml up -d` 재실행 필요 (컨테이너 재생성)

### 11. 개인 네트워크 유동 IP 리스크

- **위험**: ISP가 IP를 변경하면 DNS 불일치로 서비스 단절 및 SSL 인증서 갱신 실패
- **완화**:
  ```bash
  # Cloudflare DDNS 5분 주기 갱신 cron 추가
  */5 * * * * /home/user/scripts/ddns-update.sh >> /tmp/ddns.log 2>&1
  ```
- **ISP 포트 차단 대비**: VPS 터널(frp/Cloudflare Tunnel) 플랜B 준비 권장
- acme.sh가 Next.js 미들웨어 내부에서 ACME challenge 처리 → DDNS TTL 60초 설정 시 IP 변경 후 SSL 자동 갱신도 정상 작동

### 12. Weather API 인증 누락

- **위치**: `app/api/weather/current/route.ts` — `readSession()` 없음
- **영향**: 누구나 무제한 호출 → KMA API quota 소진 가능
- **수정**: `readSession()` 추가 또는 rate limit 적용

### 13. NOC 장기 토큰 취소 메커니즘 부재

- **위치**: `app/api/auth/noc-issue/route.ts` — 최대 365일 JWT 발급, 취소 불가
- **수정**: `jti` 클레임 + `revoked_tokens` 테이블 추가

---

## P2 — 다음 스프린트 (백로그)

| # | 항목 | 위치 | 조치 |
|---|------|------|------|
| 14 | NOC timing-safe 비교 | `app/api/auth/noc-issue/route.ts:36` | `!==` → `crypto.timingSafeEqual()` |
| 15 | CSP nonce 도입 | `app/layout.tsx:46` | `unsafe-eval, unsafe-inline` 제거 후 nonce 기반 강화 |
| 16 | 파일 업로드 크기 제한 | `app/api/import/parse/route.ts` | `content-length` 5MB 컷 + zip-bomb 방어 |
| 17 | N+1 개선 | 월 마감, 의료기록, 일괄 부여 API | `Promise.all` 또는 `$transaction` 배치 |
| 18 | cron 부분 실패 격리 | `app/api/cron/bulky-waste-import/route.ts:48` | 루프 내 try-catch 추가 |
| 19 | 날짜 문자열 검증 | `app/api/leave-requests/route.ts:89` | Zod `.regex(/^\d{4}-\d{2}-\d{2}$/)` |
| 20 | `npm audit` CI 게이트 | — | Dependabot/Renovate 설정 |
| 21 | Docker 빌드 캐시 정리 | — | `docker builder prune -f` (187GB 절약) |
| 22 | 시민 민원 read audit | `app/api/citizen/complaints` GET | `CITIZEN_COMPLAINT_READ` 로깅 추가 |

---

## 인프라 현황

| 항목 | 상태 | 비고 |
|------|------|------|
| SSL 인증서 | ✅ 유효 (만료 2026-08-16) | acme.sh 자동갱신 23:43 cron |
| 디스크 | ✅ 여유 (565GB/915GB) | Docker 빌드 캐시 187GB 정리 권장 |
| DB 크기 | ✅ 40MB | pg_dump 정상 동작 확인 |
| 컨테이너 상태 | ✅ healthy | cleanerp-app, cleanerp-postgres |
| 메모리 (컨테이너) | ✅ 정상 | app 72MB, postgres 80MB |
| 스왑 | ⚠️ 91% | 개발 도구가 원인, 분리 필요 |
| Docker 로그 rotation | ✅ 적용됨 | infra agent가 이번에 추가 |
| 컨테이너 메모리 limit | ✅ 적용됨 | infra agent가 이번에 추가 |
| DB 백업 | ❌ cron 미등록 | 스크립트 존재, crontab만 추가 필요 |
| 모니터링/알림 | ⚠️ netdata만 | Telegram/Slack 알람 연결 권장 |

---

## 강점 (계속 유지)

- JWT_SECRET 32자+ 강제, 부팅 실패 방어
- bcrypt cost 12, 계정 잠금 5회/10분
- RBAC scope 헬퍼 일관 적용 (`userScope`, `vehicleWhere`, `complaintWhere`)
- Zod 검증 전 라우트 일관 적용
- CSP/HSTS/X-Frame-Options/Referrer-Policy next.config.js 설정
- httpOnly + sameSite=strict 쿠키 (Secure 플래그만 보강하면 완전)
- audit_log 풍부 (LOGIN_*, USER_*, COMPLAINT_*, NOC_TOKEN_ISSUED 등)
- MUNI_ADMIN GET-only 강제 (middleware.ts:167-179)
- 멀티테넌시 스코프 일관성

---

## 체크리스트 (6월 1일 전)

- [ ] P0-1: `.env.prod` COOKIE_SECURE=false 라인 삭제 후 컨테이너 재시작
- [ ] P0-2: iptables 차단 추가 (5433,5434,6379,9000,9001) + docker-compose ports 127.0.0.1 한정 + apply-iptables-cost.sh 업데이트
- [ ] P0-3: 시민 민원 GET phone IDOR 수정
- [ ] P0-4: lib/kms.ts KMS_LOCAL_KEY 환경변수 이름 통일 + getEnv() 부팅 시 호출
- [ ] P0-5: parseId() 헬퍼 생성 후 28개 [id] 라우트 일괄 적용
- [ ] P0-6: DB 백업 cron 등록 (`crontab -e`)
- [ ] P1-7: Math.random() → crypto.randomInt() (reset-pw route)
- [ ] P1-8: SEED_PASSWORD 계정 비밀번호 변경 확인
- [ ] P1-9: 개발 프로세스 서버 분리, swapoff/swapon
- [ ] P1-10: `docker compose up -d` 재실행 (로그 rotation, 메모리 limit 적용)
- [ ] P1-11: DDNS 5분 cron 설정
- [ ] P1-12: weather API readSession 추가
