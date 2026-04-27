# 🚛 CleanERP — 지자체 생활폐기물 수집운반 통합관리시스템

> 환경미화의 디지털 전환을 14일 안에. 멀티테넌트 SaaS형 ERP로 시민·작업자·관리자·지자체·슈퍼관리자가 한 시스템에서 협업.

**현재 버전**: v0.1.0-alpha · **Phase 1A ~ Phase 24 완료** · **마지막 갱신**: 2026-04-26

---

## 📚 문서 가이드 — 5종 + 명세서

| # | 문서 | 대상 | 내용 |
|---|---|---|---|
| 1 | **[사용자_설명서.md](./사용자_설명서.md)** | 일반 사용자 | 유치원생도 보는 친근한 사용법 |
| 2 | **[개발_기록.md](./개발_기록.md)** | 개발자·인수자 | Phase 1~24 변경 이력 + **테스트 계정** |
| 3 | **[유지보수_메뉴얼.md](./유지보수_메뉴얼.md)** | 운영 담당자 | 일일·주간·월간·분기·장애·DR (1366줄) |
| 4 | **[서비스_개설_절차.md](./서비스_개설_절차.md)** | 영업·도입팀 | 신청부터 14일 운영 전환 + **요금제 + SLA** |
| 5 | **[DEPLOY.md](./DEPLOY.md)** | 배포 담당자 | 초기 배포 가이드 |

### 기능 명세서 (`docs/specs/`)

| # | 명세서 | 우선순위 |
|---|---|---|
| 01 | **[신청 페이지 (`/apply`)](./docs/specs/01_신청페이지_명세서.md)** | 🔥 High |
| 02 | **[견적 자동화 도구](./docs/specs/02_견적자동화_명세서.md)** | 🔥 High |
| 03 | **[도입 진행률 대시보드](./docs/specs/03_도입진행률_대시보드_명세서.md)** | 🟡 Medium |
| 04 | **[SLA 자동 측정 + 월간 리포트](./docs/specs/04_SLA_자동화_명세서.md)** | 🟡 Medium |

### PDCA 산출물

- **Plan**: `docs/01-plan/waste-erp-mvp.plan.md`
- **Design**: `docs/02-design/`
- **기획서 원본**: `지자체 생활폐기물 수집운반 ERP 기획서 *.md`

### CI/E2E 가이드

- **CI 디버깅 + 베이스라인 갱신 절차**: [docs/ci-debug.md](./docs/ci-debug.md)
- **e2e 워크플로**: [.github/workflows/e2e.yml](./.github/workflows/e2e.yml) — PR/main push 시 자동 실행 (functional + visual)
- **모바일 회귀 트래커**: [docs/mobile-issues.md](./docs/mobile-issues.md)

---

## 🚀 빠른 시작 (개발 환경)

```bash
# 1) 의존성 설치
npm install --legacy-peer-deps

# 2) 환경변수
cp .env.example .env

# 3) 로컬 PostgreSQL (Docker)
docker run -d --name cleanerp-pg -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=cleanerp_dev -p 5433:5432 postgres:16-alpine

# 4) 스키마 + 시드
DATABASE_URL=postgresql://postgres:dev@localhost:5433/cleanerp_dev npx prisma db push
DATABASE_URL=... npx tsx prisma/seed.ts
DATABASE_URL=... npx tsx prisma/seeds/positions.ts
DATABASE_URL=... npx tsx prisma/seeds/departments.ts
DATABASE_URL=... npx tsx prisma/seeds/approval-policies.ts
DATABASE_URL=... npx tsx prisma/seeds/municipalities.ts   # 전국 226개 시군구

# 5) 개발 서버
npm run dev
# → http://localhost:3000
```

## 🏭 운영 배포 (Docker Compose)

자세한 배포는 [DEPLOY.md](./DEPLOY.md) 참조.

```bash
# 빌드 + 기동 + 헬스체크
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build app
curl http://localhost:3001/api/health   # → 200
```

| 환경 | 주소 |
|---|---|
| 운영 (예정) | `https://wci.helpbiz.kr` |
| LAN | `http://192.168.1.20:3001` |
| Tailscale | `http://100.87.145.25:3001` |
| 응급 캐시 초기화 | `https://wci.helpbiz.kr/reset` |

---

## 🔐 시드 계정 (개발/QA)

> ⚠️ **운영 진입 전 모두 비밀번호 강제 변경 또는 삭제 필수**

| username | role | 첫 로그인 후 |
|---|---|---|
| `super` | SUPER_ADMIN | `/consent` → `/super-admin` |
| `muni` | MUNI_ADMIN | `/consent` → `/complaints` (자기 지자체) |
| `company` | CONTRACTOR_ADMIN | `/consent` → `/complaints` |
| `manager` | INTERNAL_ADMIN | `/consent` → `/complaints` |
| `worker` | WORKER | `/consent` → `/worker` 모바일 UI |
| `test` | INTERNAL_ADMIN | 빠른 테스트 (PW: `test`) |

비밀번호: 모두 `changeme1234!` (test 계정만 `test`)

---

## 🏗️ 아키텍처 한눈에

```
[시민]    [작업자]   [관리자]   [지자체]   [슈퍼관리자]
   │         │          │          │           │
   ▼         ▼          ▼          ▼           ▼
 /citizen /worker  /complaints,  (R/O)   /super-admin
 (인증X)  (PWA)    /users 등               (전 권한)
   │         │          │          │           │
   └─────────┴──────────┴──────────┴───────────┘
                       ▼
            Next.js 14 + JWT + RBAC 미들웨어
                       ▼
            PostgreSQL 16 (멀티테넌트 격리)
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
    OSRM 도로 라우팅  OSM 지오코딩  빼기 앱 cron
```

### 기술 스택

- **Frontend**: Next.js 14.2.5 (App Router) + React 18.3.1 + TypeScript + Tailwind
- **Backend**: Next.js API Routes (Node runtime) + Prisma 5.22 + Zod
- **DB**: PostgreSQL 16
- **인증**: bcryptjs + jose(JWT), HttpOnly 쿠키, 8h TTL
- **지도**: react-leaflet 4.2.1 + OSRM + OSM Nominatim
- **PWA**: Service Worker (auto-update + /reset 응급)
- **배포**: Docker Compose (standalone build)

### 핵심 모듈 12종

1. 사용자 관리 (직책 12종, 부서, 사진/서명)
2. 근태 관리 (GPS + 06:00 새벽 도메인)
3. 휴가 관리 (11종 + 2단계 결재)
4. 결재 정책 (직책별 매트릭스)
5. 안전관리 (TBM 서명 + SOS)
6. 실적 관리 (생활/자원순환/대형)
7. 민원 관리 (admin/worker/citizen 통합)
8. 차량 관리 (운행일지 + 점검)
9. 실시간 차량조회 (TSP + OSRM 도로 스냅 + 7가지 지도 타일)
10. 통계·보고서 (서명 워터마크)
11. PWA (앱처럼 설치)
12. 슈퍼관리자 콘솔 (5개 탭: 지자체관리/권한/집계/회사정보/GIS)

---

## 🔒 보안

- 비밀번호: bcrypt cost 12
- JWT: HS256, 8h TTL, httpOnly + sameSite=strict
- PII 암호화: AES-256-GCM (`lib/crypto.ts`, KMS abstraction)
- **개인정보 동의** 강제 (`/consent` 페이지 7개 섹션, 개인정보보호법 §15·22)
- 모든 인증 이벤트 audit_log 기록 (5년 보존, 산안법 §165)
- 테넌트 격리: 모든 쿼리에 `municipalityId`/`contractorId` 자동 필터
- MUNI_ADMIN: GET-only 강제 (Plan §7-3)

자세한 보안 점검: [유지보수_메뉴얼.md §8](./유지보수_메뉴얼.md)

---

## 📊 현재 상태 + 다음 단계

### ✅ 완료 (Phase 1~24)

- 인증·RBAC (5 Role)
- 사용자·근태·휴가·결재 풀스택
- 안전관리 (TBM·SOS·일일점검)
- 차량 운행일지 + 실적 관리
- 민원 관리 (admin/worker/citizen 3채널)
- 실시간 차량조회 (TSP + OSRM)
- 통계/보고서 + 서명 워터마크
- PWA (auto-update + /reset)
- 슈퍼관리자 콘솔 + 전국 267개 지자체 시드
- 개인정보 동의 강제 흐름
- 모바일 반응형 admin 셸 (햄버거 드로어)
- Docker Compose 운영 배포

### 🔄 다음 (명세 완료, 구현 대기)

- 신청 페이지 `/apply` ([명세](./docs/specs/01_신청페이지_명세서.md))
- 견적 자동화 ([명세](./docs/specs/02_견적자동화_명세서.md))
- 도입 진행률 대시보드 ([명세](./docs/specs/03_도입진행률_대시보드_명세서.md))
- SLA 자동 측정 + 월간 리포트 ([명세](./docs/specs/04_SLA_자동화_명세서.md))

### 🔮 장기 (Phase B+)

- 지자체별 브랜딩 (로고·약칭·색상)
- 지자체별 도메인 (`gangnam.cleanerp.kr`)
- SMS OTP 인증 (시민 본인 확인)
- 자체 호스팅 OSRM (외부 의존성 제거)
- 인보이스 자동 차감 (SLA 위반 크레딧)
- Status 페이지 공개

---

## 🆘 문제 해결

| 증상 | 해결 |
|---|---|
| 모바일에서 화면이 갱신 안 됨 | `https://wci.helpbiz.kr/reset` 직접 방문 |
| 로그인 후 즉시 `/consent`로 이동 | **정상** — 첫 로그인 시 동의 강제 |
| `MUNI_ADMIN`이 mutate API 호출 시 403 | **정상** — Plan §7-3 GET-only |
| 빌드 실패 | `npm install --legacy-peer-deps` |
| CI e2e 실패 (functional/visual) | [docs/ci-debug.md](./docs/ci-debug.md) — artifact 다운로드 + 로컬 재현 |
| 시각 회귀 베이스라인 갱신 필요 | `npm run e2e:update` 후 별도 PR ([docs/ci-debug.md §4](./docs/ci-debug.md)) |
| react-leaflet 5.0 사용 시 에러 | 4.2.1 사용 (React 18 호환) |
| OSRM 응답 느림 | `lib/ors.ts` rawFetch IPv4 사용 중 — fallback 자동 동작 |

자세한 장애 대응: [유지보수_메뉴얼.md §9](./유지보수_메뉴얼.md)

---

## 📞 문의

- 운영팀: `cleanerp@helpbiz.kr`
- 긴급: 1588-XXXX
- 신청: `https://wci.helpbiz.kr/apply` (Phase 1A 구현 대기)

---

**CleanERP — 환경미화의 디지털 전환을 가장 빠르게.**
