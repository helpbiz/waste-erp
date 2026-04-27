# wci.helpbiz.kr — 멀티테넌트 SaaS 운영 검토 보고서

> **목적**: 1인 운영자가 전국 위탁업체 대상 ERP를 안정적으로 SaaS화 가능한지 다각도 검토
> **검토일**: 2026-04-28
> **검토 방식**: 4개 전문 에이전트 병렬 분석 (enterprise-expert / security-architect / pm-strategy / code-analyzer)
> **대상 코드 베이스**: 14개 PR 머지 상태 (지자체→업체→facility 계층 + F-02 보고서 + 모바일 워커앱)

---

## 1. Executive Summary

| Perspective | Content |
|---|---|
| **현재 상태** | 13개 도메인 모델 + 4-tier RBAC + 슈퍼관리자 콘솔 + 모바일 워커앱 + F-02 PDF 모듈 완성. 단일 DB · 단일 코드베이스 · 단일 도메인 |
| **멀티테넌트 준비도** | **80%** — 논리적 격리(`contractorId` FK)는 잘 잡혀있음. **DB-level enforcement 부재**가 가장 큰 갭 |
| **1인 운영 적합성** | **양호** — 단일 코드베이스가 1인에게 최선. 단, 롤백·카나리·백업 자동화 미비 |
| **상업화 가능성** | **3개월 내 진입 가능** — 폐기물 수집운반 특화 SaaS는 국내 사실상 무경쟁. Per-vehicle 월 89~390K 구독 모델 권장 |

**핵심 한 줄**: 현 구조는 1인 운영 SaaS로 **타당**하나, **P0 5건**(JWT secret · cross-tenant scoping · GPS 보호 · audit log contractorId · 백업 자동화)은 **첫 외부 업체 onboarding 전 필수 조치**.

---

## 2. 멀티테넌트 아키텍처 평가 (enterprise-expert)

### 2.1 현재 모델 적합성

- **모델**: 단일 DB + 단일 스키마 + 논리적 테넌시 (`contractor_id` 외래키 분리)
- **격리 수준**: ORM 레벨은 깔끔, **DB 레벨 격리 거의 없음** — PostgreSQL Row-Level Security(RLS) 미적용, app_user 단일 계정으로 모든 테넌트 row 접근 가능
- **위험 요소**: 어플리케이션 코드의 `where: { contractorId }` 누락이 곧 데이터 leak. 1인 운영자가 모든 검증 책임 — 실수 1회 = 전 업체 노출
- **격리 강도**: URL 분리 / 도메인 분리 / 브랜딩 = **0%** (단일 도메인 wci.helpbiz.kr, 단일 로고)

| 항목 | 상태 | priority |
|---|---|---|
| `@@index([contractorId])` 패턴 적용 | ✅ 거의 모든 도메인 테이블 | [P2] |
| `lib/db.ts` tenant-scoped Prisma extension | ❌ 미적용 — `findMany`가 스코프 누락 시 cross-tenant 조회됨 | **[P0]** |
| `WasteTreatmentFacility` muni 단위 공유 | ✅ 의도된 설계 (PR #10) | [P1] 정책 문서화 |

### 2.2 확장성 (50~200 업체 운영 시)

추정 연간 데이터:
- 900 contractor × 평균 (직원 30 + 차량 10 + 일일 attendance 30 + 월 1000 complaint)
- attendance ~1000만 row, complaint ~1000만, **audit_log 폭발 위험**

| 영역 | 상태 | priority |
|---|---|---|
| 단일 테넌트 조회 (`(contractorId, date)` 복합 인덱스) | ✅ 잘 잡혀있음 | — |
| SUPER_ADMIN 콘솔 "전 업체 통합 뷰" | ⚠ Seq Scan 위험 | [P2] |
| `audit_log` 단일 테이블 | ⚠ 1년 후 GB 단위 | [P2] partition |
| Redis 캐시 / Materialized View | ❌ 전무 | [P2] |
| Prisma N+1 (`include` 깊은 join) | ⚠ 위험 코드 다수 | [P2] |

**권고**:
- `audit_log` / `attendance_records` / `complaints` → **월 단위 partition** [P2]
- `MonthlyAttendanceSummary` 패턴을 cost·waste·complaint 에 확대 [P2]
- Read replica 1대 분리 + Vercel/Cloudflare edge cache [P3]

### 2.3 1인 운영자 유지보수성

- **단일 코드베이스 + 단일 DB는 1인의 최선**: deploy 1번 / migration 1번 / monitoring 1개 dashboard
- **롤백 안전망 부재**: `prisma migrate deploy` destructive change 시 즉각 전 업체 다운
- **정책 모델은 잘 갖춰짐**: `MuniAccessPolicy` (지자체별 화면 토글) + `BulkyWasteConfig` / `LiveTrackingConfig` (contractor별 feature config) 활용도 높음

**FeatureFlag 일반화 권고 [P1]**:
```prisma
model FeatureFlag {
  id           BigInt @id
  contractorId BigInt? // null = 글로벌
  key          String
  value        Json
  @@unique([contractorId, key])
}
```
→ 모든 신기능을 flag 뒤에 출시 → 카나리/A-B/업체별 베타 토글이 한 번에 해결

### 2.4 리스크 (Top 5)

| # | 리스크 | priority |
|---|---|---|
| 1 | **Cross-tenant data leak** — RLS/extension 미적용은 시한폭탄 | **[P0]** |
| 2 | **Noisy neighbor** — PDF 대량 출력이 전 업체 응답시간 저하. PDF 생성 worker queue 분리 필요 | [P1] |
| 3 | **PIPA 격리 의무** — KMS + per-contractor DEK 미도입. 1건 사고 = 전 업체 PIPA 위반 | [P1] |
| 4 | **Audit log 무결성** — `audit_log.contractorId` 컬럼 부재, forensic 불가. WORM 정책 필요 | **[P0]** |
| 5 | **단일 JWT secret** — 유출 시 전사 세션 탈취. rotating key + `kid` claim | [P2] |

---

## 3. 보안 평가 (security-architect)

### 3.1 즉시 조치 Top 3 (운영 진입 전 필수)

#### **[P0-1] JWT_SECRET fallback 제거** (1일)
- `lib/auth.ts:14-15` + `middleware.ts:13-14` 의 `?? 'dev-secret-change-me-please-32-bytes-minimum-required'` **즉시 제거**
- 운영 env 미설정 시 default secret 으로 토큰 발급되어 누구나 위조 가능
- `lib/env.ts` 에 zod 로 prod 환경 필수 검증 추가 → 미설정 시 부팅 실패

#### **[P0-2] GPS 좌표 보호** (3~5일)
- AttendanceRecord / Complaint / SafetyReport 의 `lat/lng` **평문 저장**
- 작업자 거주지·이동패턴 추론 가능, 보유기간 정책 부재로 무기한 보관
- 조치:
  - (a) 서버측 그리드 라운딩 (소수 4자리 = ~10m) 또는 암호화 저장
  - (b) 90일 후 NULL 화 cron
  - (c) 개인정보처리방침에 위치정보 항목 명시

#### **[P0-3] SUPER_ADMIN mutate 차단 + cross-tenant 가시성 감사** (1주)
- 미들웨어 `READ_ONLY_ROLES` 에 SUPER_ADMIN 추가 또는 `SUPER_OBSERVER` 신설
- SUPER_ADMIN 의 cross-tenant 쿼리 (export·bulk 조회) → AuditLog 에 `metadata.contractorIds` 기록
- 운영자 단말 IP allowlist 또는 2FA 강제

### 3.2 개인정보 / 민감정보

| 필드 | 현재 상태 | priority |
|---|---|---|
| `User.bankAccount` / `User.address` | ✅ `encryptField()` 적용 | — |
| `HealthRecord` | ✅ AES-256 적용 | — |
| `phone` / `emergencyPhone` / `birthDate` / `employeeNo` / `Complaint.citizenPhone` | ❌ **평문** | [P1] |
| GPS lat/lng | ❌ **평문** | **[P0]** |
| `User.gender` / `birthDate` | ⚠ 민감정보 분류 검토 | [P2] |

### 3.3 인증·세션

| 항목 | 상태 | priority |
|---|---|---|
| JWT_SECRET fallback | ❌ 운영 위험 | **[P0]** |
| JWT 8h TTL · refresh/blacklist | ❌ 로그아웃 시 토큰 자체 유효 | [P1] |
| `clearSession()` 서버측 무효화 | ❌ 부재 | [P1] |
| `COOKIE_SECURE=false` 운영 검증 | ⚠ env 검증 미흡 | [P1] |
| PWA 디바이스별 세션 관리 | ❌ 단일 쿠키 | [P2] |
| `consentedAt` JWT payload 박힘 | ⚠ 동의 철회 후에도 만료까지 우회 | [P2] |

### 3.4 추가 권고 (1~2주차)

- `next.config.js` 보안헤더 추가 (HSTS / X-Frame-Options / CSP / X-Content-Type-Options)
- `Complaint.requestImage` `db.Text` base64 저장 → MediaAsset 통일 (DB 부풀림 + DoS 위험)
- `BulkyWasteConfig.ppaegiPasswordEnc` / `LiveTrackingConfig.apiKeyEnc` 키 회전 정책
- `/api/auth/login` rate limiting (현재 brute force 가능)

---

## 4. 비즈니스 전략 (pm-strategy)

### 4.1 Value Proposition

| 축 | 내용 | 설득력 |
|---|---|---|
| **규제 준수 자동화** | F-02 보고서 + 올바로 시스템 연계. 보고 누락 = 계약 해지 리스크. 월 20~40h 절약 | ★★★★★ |
| **운영 가시성** | 차량 배차·민원·안전사고 통합. 작업자 PWA 까지 연결 | ★★★★ |
| **지자체 신뢰** | 슈퍼관리자 모니터링 = 지자체 실시간 검증. B2G 전환 근거 | ★★★ |

**경쟁 차별점**:
- 국내 생활폐기물 수집운반 위탁업체 특화 SaaS **사실상 부재**
- 더존 iCUBE 등 범용 ERP는 폐기물 법령 보고 모듈 없음 (커스터마이징 비용 > 도입비)

### 4.2 Beachhead 세그먼트

| 항목 | 추천 |
|---|---|
| **규모** | 직원 10~30인, 차량 5~20대, 1~3개 지자체 계약 |
| **지역** | 수도권 외곽 (경기 동부·남부) + 중소 광역시 (대전·광주·전주) |
| **특성** | 2세대 경영 (40대 자녀 승계), 인하우스 IT 부재, 지자체 재계약 앞둔 업체 |
| **즉시 페인** | "올바로 입력 실수로 과태료" — 영업 첫 마디로 활용 |

**1주 내 액션**: 환경부 공공데이터포털에서 경기 남부 10~30인 규모 50개 업체 리스트업 → 콜드콜 스크립트.

### 4.3 Pricing 모델 (Per-Vehicle 구독)

| Tier | 구성 | 월 요금 | 자동화 |
|---|---|---|---|
| **Starter** | 차량 5대 이하, 관리자 2인 | **89,000원** | Stripe/토스 자동결제 |
| **Standard** | 차량 6~15대, 관리자 5인 | **189,000원** | 자동결제 (가장 많은 세그먼트) |
| **Pro** | 차량 16대 이상, 무제한 사용자 | **390,000원** | 온보딩 콜 1회 포함 |

**중기 B2G 전환**: 지자체가 위탁업체 관리 도구로 ERP 비용 예산 편입 → ARPU 3~5배 상승. 슈퍼관리자 레이어가 이 논리 근거.

### 4.4 GTM 전략 (1인 운영 가능)

| 우선순위 | 채널 | 1주 내 액션 |
|---|---|---|
| 1 | 한국폐기물협회 / 환경업체 협의회 (오프라인 고밀도) | kwaste.or.kr 사무국에 "폐기물 수집운반 디지털화 세미나 발표" 이메일 |
| 2 | 유튜브/블로그 SEO ("올바로 시스템 실수 방지", "F-02 작성법") | 롱테일 키워드 빠른 선점 |
| 3 | 지자체 RFP 연계 (B2G 전환 6~12개월) | 환경부 자원순환정책과 제도 건의 |

**채널 비중**: 오프라인 60 / 디지털 40 (초기 도메인 신뢰 부재 → 대면 데모 전환율 10배)

### 4.5 운영 리스크 (1인 운영자 보호)

| 리스크 | 대응 원칙 |
|---|---|
| **데이터 마이그레이션** | CSV 임포트 템플릿만 제공. **고객이 준비, 시스템이 임포트.** 마이그레이션 대행 = 유료 옵션 (1회 30만원) |
| **커스터마이징** | **3개 업체 이상 동일 요청** 시에만 표준 기능으로 편입. 단일 업체 특수 = 거절 + "로드맵 검토 중" |
| **SLA** | 99.9% uptime 약정 X. **"4시간 내 응답 + 일할 환불"** 서비스 정책으로 대체. UptimeRobot 무료 플랜 알림 |

---

## 5. 통합 개선 로드맵

### 5.1 P0 (운영 진입 전 필수, 1주)

| # | 항목 | 출처 | 공수 |
|---|---|---|---|
| **P0-1** | JWT_SECRET fallback 제거 + zod env 검증 | security | 1일 |
| **P0-2** | GPS 좌표 보호 (라운딩 + 90일 NULL cron + 개인정보처리방침) | security | 3~5일 |
| **P0-3** | SUPER_ADMIN mutate 차단 + cross-tenant 감사 | security | 1주 |
| **P0-4** | tenant-scoped Prisma extension (모든 query 에 contractorId 강제) | enterprise | 2~3일 |
| **P0-5** | `audit_log` 에 `contractorId` 컬럼 + WORM 정책 | enterprise | 1일 |
| **P0-6** | DB backup 자동화 (RDS automated snapshot 7일 또는 pg_dump cron) | enterprise | 1일 |

### 5.2 P1 (1개월 내 — 첫 외부 업체 운영 안정화)

| # | 항목 | 출처 |
|---|---|---|
| **P1-1** | `FeatureFlag(contractorId, key, value)` 모델 + 카나리/베타 토글 인프라 | enterprise |
| **P1-2** | KMS + per-contractor DEK envelope encryption (PIPA 준수) | enterprise |
| **P1-3** | PDF/이미지 처리를 worker queue 로 분리 (BullMQ/SQS) | enterprise |
| **P1-4** | next.config.js 보안헤더 + rate limiting (`/api/auth/login` brute force 차단) | security |
| **P1-5** | 평문 PII 필드 (phone/emergencyPhone/employeeNo) 암호화 | security |
| **P1-6** | JWT refresh + blacklist 모델 | security |
| **P1-7** | Stripe 또는 토스페이먼츠 정기결제 + 자동 테넌트 활성화 | strategy |

### 5.3 P2 (1분기 — 50개 업체 운영 가능)

| # | 항목 | 출처 |
|---|---|---|
| **P2-1** | `Contractor.plan` (FREE/STANDARD/PREMIUM) + 사용량 측정 (`UsageMetric`) | enterprise |
| **P2-2** | `audit_log` / `attendance_records` 월별 partition | enterprise |
| **P2-3** | `MonthlyAttendanceSummary` 패턴을 cost·waste·complaint 확대 | enterprise |
| **P2-4** | rotating JWT key + `kid` claim | security |
| **P2-5** | 디바이스별 세션 관리 + 분실 단말 강제 로그아웃 | security |
| **P2-6** | 협회 세미나 발표 + 유튜브 SEO 콘텐츠 시작 | strategy |

### 5.4 P3 (반기 이상 — 200개+ 업체 운영)

| # | 항목 | 출처 |
|---|---|---|
| **P3-1** | 전용 도메인 옵션 (`Contractor.customDomain` + Vercel Domain API) | enterprise |
| **P3-2** | DB 분리 옵션 (Premium 플랜만 schema-per-tenant) — `Contractor.dbSchemaName` 활용 | enterprise |
| **P3-3** | PITR + 업체별 export 셀프서비스 | enterprise |
| **P3-4** | Read replica + edge cache | enterprise |
| **P3-5** | 지자체 B2G 전환 영업 (RFP 가점 항목 로비) | strategy |

---

## 6. 즉시 실행 권고 (이번 주 5일)

### Day 1 — 보안 P0 즉시 패치
- JWT_SECRET fallback 제거 + `lib/env.ts` zod 검증
- next.config.js 보안헤더 추가
- audit_log 에 contractorId 컬럼 마이그레이션

### Day 2 — Tenant 격리 강화
- Prisma `$extends` 로 contractorId 자동 주입 wrapper
- 기존 라우트 grep — userScope 누락 라우트 fix

### Day 3~4 — GPS 보호
- AttendanceRecord/Complaint/SafetyReport lat/lng 라운딩 함수 적용
- 개인정보처리방침 페이지에 위치정보 항목 추가
- 90일 후 NULL 처리 cron 작성

### Day 5 — 비즈니스 검증
- kwaste.or.kr 협회 사무국에 발표 제안 이메일 발송
- 시드 업체 ((주)한국청소서비스) 에 인터뷰 1회: "F-02 보고서 월 몇 시간 소요? 월 189K 지불 의향?"
- UptimeRobot 무료 플랜 wci.helpbiz.kr 모니터링 설정

---

## 7. 검토 자료

### 7.1 분석 에이전트
- `bkit:enterprise-expert` — 멀티테넌트 아키텍처 + 1인 운영자 유지보수성
- `bkit:security-architect` — 데이터 격리 + 권한 분리 + PIPA 준수
- `bkit:pm-strategy` — B2B SaaS 비즈니스 모델 + GTM
- `bkit:code-analyzer` — 코드 정적 분석 (부분 완료)

### 7.2 검토 파일
- `prisma/schema.prisma`
- `lib/auth.ts`
- `middleware.ts`
- `lib/users.ts` (userScope)
- `app/api/users/route.ts`
- 14개 머지 PR

### 7.3 관련 외부 자료
- [한국폐기물협회](http://www.kwaste.or.kr/)
- [공공데이터포털 전국폐기물처리업소 표준데이터](https://www.data.go.kr/data/15114147/standard.do)
- [자원순환정보시스템](https://www.recycling-info.or.kr/)
- [올바로 시스템](https://www.allbaro.or.kr/)

---

## 8. 의사결정 필요사항 (사용자 확인)

| # | 결정 사항 | 권장 답 | 영향 |
|---|---|---|---|
| 1 | P0 6건을 첫 외부 업체 onboarding 전에 모두 처리할 것인가? | **Yes** | 일정 1주 추가 (현 14개 PR 후 안정화 sprint) |
| 2 | Pricing 모델: Per-Vehicle 89/189/390K 채택? | **Yes** | 자동결제 인프라 구축 P1 진입 |
| 3 | B2C 직접 영업 vs 협회 채널 vs B2G 우선순위? | **협회 1, 직접 영업 2, B2G 3** | GTM 우선순위 확정 |
| 4 | 멀티테넌트 격리 방식: 단일 DB + RLS vs schema-per-tenant Premium 플랜? | **단일 DB + RLS (1인 운영 부담 최소)** | 향후 Premium 옵션으로 확장 |
| 5 | 협회 세미나 발표 + 시드 업체 인터뷰 이번 주 진행? | **Yes** | 5 Day 액션 실행 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-28 | 초안 — 4 에이전트 병렬 분석 통합 | 4365won@gmail.com (CleanERP Dev) |
