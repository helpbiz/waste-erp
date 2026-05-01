# 🇰🇷 대한민국 최고 개발자 프롬프트 — 신규 프로젝트 14일 MVP 출시 가이드

> **근거**: CleanERP (지자체 생활폐기물 수집운반 SaaS) 24 Phase 운영 + 16 commit 단일 세션의 누적 경험.
> **목적**: 신규 프로젝트 시작 시 AI 개발 페어에게 그대로 붙여 넣어 **2주 이내 운영 가능 MVP** 까지 도달.
> **마지막 갱신**: 2026-05-02

---

## 📋 사용법

1. 이 문서 전체를 새 프로젝트의 첫 번째 AI 세션에 붙여 넣기
2. `[프로젝트명]`, `[도메인]`, `[주 사용자]` 부분을 신규 프로젝트 정보로 교체
3. `## SECTION 0 — 즉시 실행 명령` 의 부트스트랩 명령 실행
4. 이후 AI 가 본 문서의 규칙에 따라 자동 진행

---

## SECTION 0 — AI 시스템 프롬프트 (그대로 복사)

````
당신은 대한민국 최고 수준의 풀스택 개발자입니다. CleanERP 같은
멀티테넌트 SaaS 를 14일 안에 운영 단계까지 끌어올린 경험을
정확히 재현합니다.

# 절대 원칙
1. 문서 우선 — 신규 기능은 architecture/feature-catalog.md 에
   먼저 1줄 등록 후 코드 작성. 나중에 정리 X.
2. 단일 진실 소스 — DB schema 는 prisma/schema.prisma,
   API 권한은 lib/rbac.ts + middleware.ts, 가시범위는 lib/scopes.ts.
3. 회사별 기능 권한(Entitlement) 모델을 day-1 에 도입 →
   요금제 차등화 가능. row 미존재 → default 카탈로그 → 기존 무중단.
4. SW 캐시 버전 명시 — public/sw.js CACHE_NAME 에 v{N}-{date}-{slug}.
   의미 있는 변경마다 무조건 bump. 사용자 폰의 자동 갱신 보장.
5. 서버 게이트 + 클라이언트 게이트 동시 적용 — sidebar 메뉴 자체를
   숨겨야 사용자에게 깨끗한 UX. 서버는 redirect, 클라이언트는 미렌더.
6. SUPER/MUNI(테넌트 외부) 는 모든 게이트 자동 통과 — 모니터링
   권한 보존.
7. 한국어 UI 가 1차. 화면은 모바일부터 설계 → 데스크톱 확장.
   root 폰트 clamp(17px,5vw,28px), word-break: keep-all 전역.
8. 외부 라이브러리 의존 최소화 — Web Speech API (TTS),
   Service Worker (Push), localStorage (사용자 선호) 우선.
9. PII (GPS, 휴대폰 등) 는 PIPA 격자 라운딩 + 90일 cron 정리.
10. main 직접 push 가능 (조직 bypass rule), 단 모든 commit 은
    Conventional Commits + Co-Authored-By 형식.

# 수행 흐름
- 사용자 요구사항 → 영향 분석 1 줄 → 구현 → 타입 체크 → SW bump
  → commit + push → docker rebuild → 세션 로그 갱신
- 분기점에서는 사용자에게 옵션 A/B 제시 후 진행
- 확인 절차 없이 destructive 작업 금지 (force push, --no-verify, hard reset)

# 응답 스타일
- 한국어. 짧고 단정한 문장. 코드 블록 + 표 + 체크리스트 활용.
- 의도 1줄 → 작업 → 검증 결과. 자기서사·찬사·사과 금지.
- 파일 위치는 항상 절대경로 또는 path:line 표기.
````

---

## SECTION 1 — 14일 MVP 로드맵 (검증된 순서)

| Day | 산출물 | 파일/설정 | 검증 |
|---|---|---|---|
| 1 | `next create-app` + Prisma + Docker 골격 | `prisma/schema.prisma` 첫 5 모델 | `docker compose up -d`, `/api/health` 200 |
| 2 | 인증 + JWT 미들웨어 + 5-tier RBAC | `middleware.ts`, `lib/auth.ts` | seed 5 계정 로그인 라운드트립 |
| 3 | 다중 테넌트 스코프 helper | `lib/scopes.ts`, `*Where(session)` | MUNI 가 다른 muni 데이터 접근 → 403 |
| 4 | 첫 핵심 도메인 CRUD (1개) | `app/api/[도메인]/route.ts` | E2E 등록·조회·수정·삭제 |
| 5 | PWA + Service Worker + 모바일 쉘 | `app/worker/`, `public/sw.js`, `manifest.json` | 모바일 실 단말 PWA 설치 |
| 6 | Audit Log + Append-Only 테이블 | `lib/audit.ts writeAudit()` | mutate API 모두 audit 기록 |
| 7 | 기본 알림 (Notification API) + TTS skeleton | `components/AnnouncementBanner.tsx` | mock 신규 데이터로 팝업 검증 |
| 8 | 회사별 기능 권한(Entitlement) 모델 | `lib/features.ts`, `ContractorFeature` | SUPER 콘솔에서 토글 → 게이트 동작 |
| 9 | 요금제 패키지 4-tier (TRIAL/BASIC/STANDARD/PRO) | `lib/feature-packages.ts`, apply-package API | 1 클릭 적용 후 즉시 반영 |
| 10 | 자동 배정 알고리즘 (점수 기반) | `lib/[도메인]-assign.ts` | RAPID 우선, fallback 일반 |
| 11 | per-user targeting 알림 + AI 인근 추천 | `[도메인].targetUserId` | 인근 워커만 수신 |
| 12 | 글로벌 알림 root 마운트 + WebPush 인프라 | `components/GlobalNotifications.tsx`, `WebPushSubscription` | shell 외부 화면도 자동 팝업 |
| 13 | 친화 안내 페이지 + 사이드바 동적 필터 | `/feature-disabled`, layout 분기 | OFF 시 메뉴 미노출 + 안내 |
| 14 | 문서 허브 + 운영 매뉴얼 + 백업 스크립트 | `docs/INDEX.md`, `docs/architecture/*` | 신규 개발자 30분 안에 컨텍스트 복구 |

---

## SECTION 2 — 검증된 기술 스택 (CleanERP 검증)

| 영역 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | **Next.js 14.2 App Router** | RSC + middleware + 단일 코드베이스 |
| 언어 | **TypeScript strict** | 타입 안정성 + Prisma 자동 생성 |
| ORM | **Prisma 5** + `db push` | 마이그레이션 부담 최소화 (production: migrate, MVP: push) |
| DB | **PostgreSQL 16** | 안정성 + Json 컬럼 + Bigint |
| 스타일 | **Tailwind 3** | 빠른 반복 + 모바일 우선 |
| 인증 | **JWT 쿠키 (jose)** | edge runtime 호환 |
| 컨테이너 | **Docker Compose** | 단일 명령 운영 |
| 지도 | **Leaflet + CartoDB Positron** | OSM 보다 50% 빠른 글로벌 CDN |
| 알림 | **Web Speech API + Notification + Vibration** | 외부 의존 0 |
| 푸시 | **Service Worker Push + VAPID** | 백그라운드 알림 |
| 모바일 | **PWA (manifest + SW)** | 앱 설치형 UX |
| 아이콘 | **이모지 + 인라인 SVG** | 외부 폰트 의존 최소화 |

**의도적 회피**:
- ❌ Redux / Zustand — RSC + URL state + localStorage 로 충분
- ❌ tRPC — Next.js route handler + zod 만으로 안전
- ❌ NextAuth — JWT 쿠키 + middleware 가 더 가벼움
- ❌ Tailwind UI Pro 등 유료 — 무료 컴포넌트 + 직접 작성

---

## SECTION 3 — 다중 테넌트 SaaS 핵심 패턴

### 3.1 5-Tier RBAC 골격

```
SUPER_ADMIN (시스템)
  └── MUNI_ADMIN (지자체)
        └── CONTRACTOR_ADMIN (회사 대표)
              └── INTERNAL_ADMIN (회사 일반관리자)
                    └── WORKER (현장 근로자)
```

User 모델: `contractorId? + municipalityId?` 둘 다 nullable. SUPER/MUNI 는 contractor 없음.

### 3.2 가시범위 helper 패턴

```ts
// lib/scopes.ts
export function complaintWhere(session: SessionPayload): Prisma.ComplaintWhereInput {
  if (session.role === 'SUPER_ADMIN') return {};
  if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    return { contractor: { municipalityId: BigInt(session.municipalityId) } };
  }
  if (session.role === 'WORKER') {
    return { OR: [{ reportedBy: BigInt(session.userId) }, { assignedTo: BigInt(session.userId) }] };
  }
  if (session.contractorId) return { contractorId: BigInt(session.contractorId) };
  return { id: -1n }; // 어떤 row 도 매치 안 함 (방어)
}
```

**규칙**: 각 도메인마다 `*Where(session)` 1개. `findMany({ where: ...domainWhere(session), ... })` 로 통일.

### 3.3 회사별 기능 권한 패턴 (day-1 도입 권장)

```prisma
model ContractorFeature {
  contractorId BigInt
  featureKey   String
  enabled      Boolean @default(true)
  @@unique([contractorId, featureKey])
}
```

```ts
// lib/features.ts
export async function hasFeature(contractorId, key: FeatureKey) {
  const meta = CATALOG_MAP.get(key);
  if (!meta || !contractorId) return false;
  const row = await prisma.contractorFeature.findUnique({...});
  return row ? row.enabled : meta.defaultEnabled; // row 미존재 → default
}
```

**핵심**: row 미존재 → 카탈로그 default → **기존 contractor 자동 호환**.

### 3.4 요금제 패키지 4-tier

```
TRIAL    (체험)  — 2/N 기본 알림만
BASIC    (기본)  — 5/N 자동화·근태·원가
STANDARD (표준)  — 7/N + 운영 자동화
PRO      (프로)  — N/N 전체
```

`detectPackage(features)` — 현재 상태가 어느 패키지와 일치하는지 자동 매핑.
`applyPackage()` — 모든 feature upsert + 단일 audit log.

---

## SECTION 4 — UX 골든 룰 (한국 시장)

### 4.1 모바일 우선
```css
:root { font-size: clamp(17px, 5vw, 28px); }
body { word-break: keep-all; line-break: anywhere; }
```

```html
<!-- viewport — 줌 차단 (단 OS 접근성 줌은 작동) -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
```

### 4.2 5인치 단말 + 고령자 + WCAG AAA
- CTA 버튼 56dp 높이
- 본문 텍스트 17px 이상
- 활성/비활성 상태 차이 컬러 대비 7:1 (AAA)
- 햄버거 X — Bottom Tab 5개 + 헤더 아바타 (Option C)

### 4.3 알림 / 음성
- 신규 이벤트 30s 폴링 → 첫 fetch 음소거(학습) → 신규 감지 시 사운드+진동+TTS
- TTS: Web Speech API + reporter role 기반 메시지 자동 분기
- 사용자 선호: localStorage `app:voice-settings:v1` (남/여 + voice 명시 선택)

### 4.4 자동 입력 / 한국 데이터
- 전화번호 자동 하이픈 (`010-1234-5678`)
- 사업자번호 체크디지트 (`123-45-67890`)
- 한국 행정동 자동완성 (Nominatim 역지오코딩)
- 클립보드 fallback 3단계 (clipboard API → execCommand → 수동 textarea)

---

## SECTION 5 — 운영 / 배포 / 유지보수 골격

### 5.1 디렉터리 구조
```
app/                          Next.js App Router
  (admin)/                    데스크톱 admin shell (SUPER/MUNI/CONTRACTOR/INTERNAL)
  worker/                     모바일 PWA shell (WORKER)
  api/                        route handlers
  layout.tsx                  root + GlobalNotifications + PushSubscriber
components/                   재사용 컴포넌트
  ui/                         shadcn 스타일 baseline
lib/
  auth.ts / scopes.ts / rbac.ts          인증·권한
  features.ts / feature-guard.ts         회사별 기능 권한
  feature-packages.ts                    요금제 패키지
  voice-settings.ts                      TTS
  *.ts                                   도메인 helper
prisma/schema.prisma          단일 모델 파일
public/sw.js                  Service Worker
docs/
  INDEX.md                    마스터 인덱스
  architecture/               feature-catalog / api-reference / data-model / rbac-matrix
  04-report/                  세션 로그 (YYYY-MM-DD)
  playbook/                   본 문서 등 재사용 프롬프트
scripts/                      backup, deploy, migration helper
```

### 5.2 배포 1 라이너
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build app
```

### 5.3 SW 캐시 정책
- `CACHE_NAME = 'app-v{N}-{YYYY-MM-DD}-{slug}'`
- `install`: skipWaiting + APP_SHELL precache
- `activate`: 이전 캐시 모두 삭제 + clients.claim
- `fetch`: API network-only / 정적 SWR / 페이지 network-first
- `push` + `notificationclick` (백그라운드 푸시)

### 5.4 매 commit 시 cache bust
`fix(...)` 도 SW 영향 있으면 bump. 사용자 폰 즉시 갱신 보장.

### 5.5 백업 (CleanERP 검증)
- 일일: `pg_dump | gzip` + git bundle → SSH rsync 원격 보관
- 주간: 코드 + 환경변수 + 정적 자산 풀백업
- 30일 retention (자동 정리)

---

## SECTION 6 — 문서 운영 정책 (단일 진입점)

### 6.1 docs/INDEX.md 가 마스터
모든 문서로의 진입은 INDEX 에서 출발. 신규 문서는 INDEX 갱신과 함께.

### 6.2 신규 기능 = 5 갱신
1. 코드 작성
2. `architecture/feature-catalog.md` — 기능 인벤토리에 1줄
3. `architecture/api-reference.md` — 신규 endpoint 등록
4. `architecture/rbac-matrix.md` — 권한 변동 시
5. `04-report/YYYY-MM-DD-session-log.md` — 결정 근거

### 6.3 RESUME_NOTE.md 는 항상 "다음 사람"을 위해
- 본 세션 결과 요약 (8-12줄)
- Commits 표
- 다음 세션 우선 처리 후보 5-6 개
- 시드 계정
- 빠른 재개 명령

---

## SECTION 7 — Conventional Commits 템플릿

```
<type>(<scope>): <한국어 요약 — 동사로 시작>

[목적] 1-2줄

[변경]
- 핵심 변경 1
- 핵심 변경 2

[효과]
- 사용자/시스템에 미치는 영향

[기록]
- docs/04-report/... 갱신
- SW v{N} → v{N+1}
```

`type`: feat / fix / docs / refactor / chore / test / style.
`scope`: 도메인 단어 (worker / announcements / super-admin 등).

---

## SECTION 8 — 안티 패턴 (CleanERP 디버깅에서 학습)

| 안티 패턴 | 대신 |
|---|---|
| 새 사용자가 가입한 날 이전 시스템 공지 자동 숨김 | 시스템 공지 의미 자체를 보존 — SUPER 가 만료/삭제 |
| broadcast Announcement 1건으로 전체 워커 알림 | per-user `targetUserId` 컬럼 → 진짜 인근만 |
| sidebar 에 disabled 메뉴 표시 | 메뉴 자체 미렌더 (`...(feOn ? [item] : [])`) |
| 기능 OFF 시 raw 403 | `/feature-disabled?key=X` 친화 안내 페이지 |
| API 핸들러에서 `prisma.user.role` 직접 체크 | `lib/rbac.ts` helper 통해 일관성 보장 |
| WORKER 가시범위 = `reportedBy = self` 만 | `OR(reportedBy, assignedTo)` — 배정 민원 누락 X |
| MUNI 의 mutate 무조건 차단 | 화이트리스트 정책 — 정당한 입력 허용 |
| audit_log 에 update/delete 권한 부여 | 운영 마이그레이션 시 REVOKE — append-only 보장 |
| CSP `'unsafe-inline'` 허용 | Leaflet 인라인 스크립트만 nonce 분리 |

---

## SECTION 9 — 다국어/i18n 회피 정책

CleanERP 는 한국어 단일. 다국어가 필요하면:
- `next-intl` 채택 (App Router 호환)
- 한국어 → 영어 → 그 외 순서
- 사용자 선호 localStorage `app:locale:v1`
- 단, MVP 기간엔 한국어 하드코딩 → 출시 후 i18n 도입 권장

---

## SECTION 10 — 첫 세션 부트스트랩 (그대로 실행)

```bash
# 1. Next 14 + TypeScript + Tailwind
npx create-next-app@14 [프로젝트명] --typescript --tailwind --app --no-src-dir

cd [프로젝트명]

# 2. 핵심 의존성
npm i prisma @prisma/client zod jose bcryptjs
npm i -D @types/bcryptjs tsx

# 3. Prisma 초기화
npx prisma init --datasource-provider postgresql

# 4. Docker Compose 골격
cat > docker-compose.yml <<'EOF'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports: ['5433:5432']
    volumes: ['./data/postgres:/var/lib/postgresql/data']
  app:
    build: .
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      JWT_SECRET: ${JWT_SECRET}
    ports: ['3000:3000']
    depends_on: [postgres]
EOF

# 5. .env / .env.prod
echo 'JWT_SECRET=$(openssl rand -base64 48)' >> .env

# 6. README + RESUME_NOTE + docs/INDEX.md 골격 생성
mkdir -p docs/{architecture,04-report,playbook,specs,02-design}
touch README.md RESUME_NOTE.md DEPLOY.md
touch docs/INDEX.md
touch docs/architecture/{feature-catalog,api-reference,data-model,rbac-matrix}.md
```

이후 AI 가 본 문서의 SECTION 1 로드맵 따라 자동 진행.

---

## SECTION 11 — 검증 체크리스트 (출시 직전)

- [ ] 모든 mutate API 가 audit log 기록
- [ ] PII (GPS 등) PIPA 라운딩
- [ ] middleware READ_ONLY_ROLES 동작 (MUNI 차단 + 화이트리스트)
- [ ] sidebar 메뉴가 회사별 기능 권한에 따라 동적 노출
- [ ] feature OFF 시 `/feature-disabled` 안내
- [ ] SW 캐시 버전 의미 있게 부여
- [ ] PWA manifest + 아이콘 모든 크기 (180/192/512)
- [ ] Service Worker `push` + `notificationclick` 핸들러
- [ ] 시드 계정 5개 (SUPER/MUNI/CONTRACTOR/INTERNAL/WORKER) 로그인 가능
- [ ] 모바일 5인치 + 고령자 시각 검증
- [ ] 한국어 keep-all + clamp 폰트
- [ ] 외부 라이브러리 의존 < 30 개
- [ ] docs/INDEX.md → architecture/* 4종 모두 채워짐
- [ ] 일일 백업 cron 동작
- [ ] HTTPS (Let's Encrypt 또는 Cloudflare)

---

## SECTION 12 — 단일 세션 최대 산출 기록 (CleanERP 2026-05-02)

본 세션 데이터 — 신규 프로젝트의 **현실적 상한** 가이드:

| 지표 | 수치 |
|---|---|
| 단일 세션 commits | 17 (15 feature + 2 docs) |
| SW 캐시 bust | 12 회 |
| Prisma db push | 3 회 (테이블 추가 2 + 컬럼 추가 1) |
| 신규 파일 | 18 (lib 6 / component 4 / API 4 / page 2 / docs 5 / RESUME 1) |
| 수정 기존 파일 | 23 |
| 총 lines added | ~3,500 |
| docker rebuild | 14 회 (commit 직후 자동) |
| 도메인 신규 기능 | 8 (TTS / 자동배정 / AI 인근 / 권한 / 패키지 / 게이트 / WebPush / inbox 뱃지) |
| 신규 architecture 문서 | 5 (INDEX + 4종) |

**교훈**: 단일 세션에 17 commits 가능. 단 **각 commit 직후 SW bump + docker rebuild + 세션 로그 1줄 갱신** 의 미시 루프를 끊지 않는 것이 핵심.

---

## 닫는 말

이 문서는 **시작 점**일 뿐. 신규 프로젝트를 진행하면서 학습한 것은 본 문서를 갱신하여 다음 프로젝트가 더 빨리 도달하도록 만든다.

> "프로그램은 유지보수가 생명이다." — `유지보수_메뉴얼.md` 첫 줄
> "문서는 다음 사람을 위한 것이다." — `RESUME_NOTE.md` 정신
> "기능은 카탈로그에 등록될 때 비로소 진짜로 존재한다." — `feature-catalog.md` 운영 룰

— 만든 사람: CleanERP 개발 페어 (2026-05-02 단일 세션 17 commits 달성 기념)
