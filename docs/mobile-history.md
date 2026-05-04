# 모바일 대응 일대기 (Mobile Responsive History)

> **출처**: [개발_기록.md](../개발_기록.md) Phase 14·16·17·18·19·20·21·25 + 4 PDCA Reports + [mobile-issues.md](./mobile-issues.md) 통합
> **기간**: 2026-04-26 ~ 2026-04-27 (2일에 13개 단계)
> **결과**: WORKER 전용 → admin **풀 모바일 지원** + WCAG 2.1 AA + e2e CI 자동화

---

## 📊 한눈에

| 항목 | Before (2026-04-25 이전) | After (2026-04-27 현재) |
|---|---|---|
| 모바일 지원 사용자 | WORKER 전용 (`/worker` PWA) | **모든 admin role + WORKER** |
| Admin 셸 | 데스크탑 전용 240px 사이드바 | **반응형** (md+ 사이드바 / mobile 햄버거 드로어) |
| 모바일 랜딩 | (admin은 데스크탑 강제) | mobile UA 감지 → `/dashboard` 자동 redirect |
| 가로 오버플로우 | 17개 테이블 깨짐 | 모두 `overflow-x-auto + tabIndex` |
| 모바일 사진 | 1.2MB / 단일 / 모바일 카메라 인식 어려움 | **3MB / 멀티(최대 3장) / image/* 정규식** |
| 지도 | GPS ready 시만 렌더 | **항상 렌더 + 핀 드래그**(GPS 권한 없어도 OK) |
| PWA 갱신 | 사용자가 재로딩 | SW network-first + 30분 백그라운드 + `/reset` 응급 |
| WCAG 2.1 AA | 미준수 (form label / contrast 누락) | **critical+serious 0건** (10/10 a11y PASS) |
| 회귀 차단 | 없음 (수동 실측) | **GHA + Playwright 5 spec 97/97 자동** |

---

## 📅 13단계 타임라인

### Phase 14 — UI/도메인 보정 (2026-04-26)
첫 모바일 친화 시작점:
- 로그아웃 버튼 박스 → 텍스트 링크 (모바일 footprint 절감)
- 로그인 페이지: 비밀번호 토글 + "개발 계정 안내" 박스 삭제 + PWA 설치 버튼 단순화
- **개인정보 동의 강제 흐름** 도입 — `/consent` 페이지 추가, 미들웨어가 미동의 사용자 차단
- **민원 등록 고도화** — LocationPickerMap + MultiPhotoUploader (모바일 카메라 직촬 + 1024px 자동 리사이즈) + Nominatim 역지오코딩
- 출퇴근 룰: 지각 08:30 → 06:00 (환경미화 새벽 근무 도메인)
- 안전 탭 보호자 카드, 내 프로필 자동 포매팅
- 공유 컴포넌트화: `_location-picker-map.tsx` → `components/LocationPickerMap.tsx` (admin·worker 공유)

### Phase 15 — 운영 배포 자동화 (2026-04-26)
모바일 검증 인프라 준비. Docker 재빌드 절차 표준화.

---

### Phase 16 — 모바일 반응형 admin 셸 ⭐ (2026-04-26)
**핵심 전환점** — admin이 모바일에서도 사용 가능해진 시점.

| 항목 | 변경 |
|---|---|
| `app/(admin)/_admin-shell.tsx` 신규 | 햄버거 드로어 + 사이드바 분리 (client) |
| `app/(admin)/layout.tsx` 슬림화 | 데이터 조회만, UI는 AdminShell에 위임 (server) |
| 분기 | md+ ≥768px: 240px 사이드바 고정 / mobile <768px: ☰ 햄버거 → 슬라이드 드로어 + 어두운 오버레이 |
| 라우트 변경 시 | 드로어 자동 닫힘 (usePathname useEffect) |
| 드로어 열림 시 | body 스크롤 잠금 |
| 헤더 NowStamp | lg+ 만 표시 |
| 헤더 타이틀 | pathname 자동 매칭 |
| `tailwind.config.ts` | `slide-in` keyframes + animation |
| `app/layout.tsx` viewport | `viewportFit: 'cover'` (iOS 노치) |

### Phase 17 — 랜딩 페이지 + 메뉴 정비 (2026-04-26)
- 비-WORKER 사용자 로그인 후 **`/complaints`** 자동 진입 (이전 `/dashboard`)
- 사이드바 OVERVIEW 그룹 삭제, CORE MODULES 첫 항목으로 **민원관리** 배치
- 로그인 우선순위:
  ```
  1. URL ?next=...
  2. 서버 redirectTo (WORKER → /worker, 그 외 → /complaints)
  3. fallback /complaints
  ```
- consent 페이지도 동일 분기, /dashboard는 직접 접근 시 보존

### Phase 18 — 모바일 사진/지도 버그 수정 (2026-04-26)
사용자 보고 → 4가지 원인 모두 해결:

| 원인 | 해결 |
|---|---|
| A. PWA 캐시 | SW 자동 갱신 강화 (Phase 19로 분리) |
| B. 모바일 카메라 MIME 다양성 | 정규식 완화 (`image/*` 만족 시 시도) |
| C. 사진 한도 1.2MB | **3MB**로 상향 (모바일 카메라 직촬 여유) |
| D. 지도가 `gps.kind === 'ready'`일 때만 | **항상 렌더**, GPS 미확인 시 기본 좌표(서울시청 37.5665, 126.9780) |

worker/complaint + admin/complaints **양쪽 동일 패턴**. 핀 드래그로 GPS 권한 없이도 위치 지정 가능.

### Phase 19 — PWA 자동 갱신 인프라 (2026-04-26)
**별도 조작 없이 새 코드 받도록**:
- `app/_sw-register.tsx`: 페이지 로드마다 `registration.update()` + `controllerchange` → `reload()` (1회) + 30분 백그라운드 update
- `public/sw.js`: `CACHE_NAME = 'cleanerp-v3-2026-04-26'` 강제 무효화 / `install` 시 `skipWaiting()` / `activate` 시 `clients.claim()` / HTML **network-first** / 정적 자산만 SWR
- **응급 초기화 페이지** `/reset`: SW unregister + CacheStorage 전체 삭제 / 미들웨어 공개 경로 / 로그인 페이지 하단 텍스트 링크 / 시나리오: 모바일 화면 갱신 안 될 때

### Phase 20 — 시민 민원 등록 고도화 (2026-04-26)
**`/citizen/new`**도 worker/admin과 동일 수준:
- 단일 사진 1.5MB → **MultiPhotoUploader 최대 3장**
- 텍스트 좌표 → **OSM 지도 220px + 빨간 핀** (드래그·클릭)
- 직접 주소 입력 → **OSM Nominatim 역지오코딩 자동**
- GPS 미확인 시 기본 좌표 + "핀을 드래그해주세요" 안내
- `POST /api/citizen/complaints` 스키마에 `requestImages: array(string).max(5)`
- admin/complaints + worker/complaint + **citizen/new** 3채널 공유

### Phase 21 — 보호자 안전 카드 (2026-04-26)
"위탁업체/110" → "보호자/[이름]" — 본인 등록 emergencyPhone 활용. 2줄 가운데 정렬, 미등록 시 `/worker/profile`로 이동.

---

### Phase 25 — 로그인 화면 상용 SaaS 톤 (2026-04-27)
- `/consent`, `/reset`: 다크 그라데이션 + 다크 변형 로고로 일관 톤
- PWA 설치 버튼 보조 액션(white + border)으로 강등

---

## 🔬 PDCA 4 Cycle (2026-04-27)

회귀 차단 자동화 + a11y AA + 디자인 시스템 정합성 — 모두 단일 session에서.

### Cycle #1 — e2e-ci-integration (Match Rate 98.5%)

| 항목 | 산출 |
|---|---|
| Match Rate | 98.5% (Plan SC 9/10) |
| Files Added | 10 (workflow + 5 spec + helper + 3 doc) |
| Visual Baselines | 36 PNG (3.2MB) |
| Workflow | GHA 2-Job (functional + visual), `e2e.yml` |
| Plan/Design/Report | 모두 `docs/01-plan/02-design/04-report/features/` |

**핵심 산출물**:
- `.github/workflows/e2e.yml` — 2-job (functional + visual)
- `playwright.config.ts` — 4 모바일 디바이스 프로필 (375 iPhone-SE / 393 Pixel7 / 360 GalaxyS / 768 iPad)
- `e2e/{global.setup,mobile-responsive,visual-regression,tab-modal,login-flow,a11y}.spec.ts`
- `e2e/visual-regression.spec.ts-snapshots/*.png` (36 PNG)
- `docs/ci-debug.md` — 디버깅 가이드 + 베이스라인 갱신 절차

**Top 5 모바일 수정 (선행 작업)**:
1. `/attendance` `grid-cols-6` → 반응형 (`grid-cols-2 sm:grid-cols-3 md:grid-cols-6`)
2. `/users` `grid-cols-4` → 반응형 (`grid-cols-2 sm:grid-cols-4`)
3. **17개 테이블 `overflow-x-auto + min-w-[640px]` 래핑** (8 페이지)
4. `/safety` 날씨 알림 3개 그리드 반응형
5. tsc + Docker 재빌드 + 4 디바이스 UA HTTP 검증

### Cycle #2 — a11y-form-labels (100%)

| 항목 | 산출 |
|---|---|
| Plan SC | 8/8 = 100% |
| Files Modified | 6 (~15 lines) |
| Visual Δ | 0 (시각 변화 없음) |
| 이전 발견 | 4 critical a11y form-label + 1 tab-modal 셀렉터 |

**변경**:
- `/attendance` `<input type=date>` → `aria-label="기준일"`
- `/users` `<select>` 2건 → `aria-label="권한 필터"` / `"상태 필터"`
- `/bulky-waste` `<input>` 5건 → `aria-label` (ID/PW/시각2/행정동)
- `/performance` `<input type=date>` 3건 → `aria-label`
- `/safety` 날씨 알림 헤더 → `role="button" tabIndex aria-expanded onKeyDown`
- `e2e/tab-modal.spec.ts` 셀렉터 → `getByRole('button', { name: /기상악화/ })`

### Cycle #3 — a11y-serious-fix (100%, 8 iterations)

| 항목 | 산출 |
|---|---|
| Plan SC | 8/8 = 100% |
| a11y violations | 35+ → 0 (100% 감소) |
| Docker rebuilds | **8회** (점진 검증) |
| Visual baselines | 36개 재캡처 |

**8 iteration 학습** (자세한 내용은 [a11y-serious-fix.report.md](./04-report/a11y-serious-fix.report.md)):
1. tailwind page bg `#94a3b8 → #e2e8f0` (1줄로 7 페이지 contrast 해결 시도)
2. `text-slate-500 → 600` (109건 sed 일괄)
3. `text-slate-400 → 500` (61건) + `surface-alt #e2e8f0 → #f8fafc`
4. components/* slate 정리 (path 한정 sed의 위험 학습)
5. 전역 `opacity-80` 제거 (11건 — KPI 라벨 contrast)
6. 전역 `opacity-70` 제거 (4건)
7. bulky-waste/vehicles/performance 잔존 3 nodes 개별 색상 (cyan-900 / emerald-700 / emerald-800)
8. `--force-recreate`로 캐시된 컨테이너 무력화

**핵심 학습**:
- Cascade 효과 5단계: token → slate-* (step1) → slate-* (step2) → opacity → 개별 색상
- `path 한정 sed` 위험: `app/`만 처리하면 `components/` 누락
- `opacity`는 contrast의 multiplier — 별도 점검 필수
- docker `--force-recreate` 필수

### Cycle #4 — field-label-refactor (94%)

| 항목 | 산출 |
|---|---|
| Plan SC | 8/9 fully + 1 partial (users 의도적 예외) |
| Field 통합 | 10 중복 → 1 공용 (`components/Field.tsx`) |
| 138 인스턴스 | 모두 typecheck + e2e 통과 |

**핵심 산출물**:
- `components/Field.tsx` 신규 — `useId` + `Children.map` + `cloneElement`로 첫 form element에 `id` 자동 주입, `<label htmlFor>` 시맨틱 association
- 9 페이지 thin alias로 대체 (`labelClassName` 보존으로 시각 변화 0)
- 1 페이지(users) 의도적 예외 (canvas/file pointer events 이유 — 코드 주석)
- bulky-waste 5건 우회 `aria-label` 제거 (시맨틱 라벨로 자동 association)

---

### mobile-admin-landing (2026-04-27 — 단순 변경, PDCA 외)

`app/(auth)/login/page.tsx`:
- 모바일 UA 감지(`max-width: 767px`) + admin role 검사
- → admin 4종(SUPER/CONTRACTOR/INTERNAL/MUNI)이 모바일에서 로그인 시 `/dashboard`로 redirect
- 데스크톱은 기존 `/complaints` 유지

---

## 🐛 mobile-issues.md (2026-04-26 점검)

코드 기반 자동 분석으로 **36건 발견**, Top 5 1시간 작업으로 80% 개선:

| 카테고리 | 발견 건수 | 처리 |
|---|---:|---|
| 테이블 가로 스크롤 미적용 | **8건** (17 테이블) | ✅ Top 5 #003~#010 |
| 그리드 컬럼 모바일 분기 누락 | **15건** | ✅ #001/#002/#011 (3건만 우선), 나머지는 reports 인쇄 전용 Skip |
| 큰 텍스트(2xl/3xl) 분기 누락 | 8건 | OK 판단 (로고/이모지/모달 X) |
| 고정 너비 컴포넌트 | 5건 | max-w라 보통 OK |

📄 상세: [mobile-issues.md](./mobile-issues.md)

---

## 🧪 회귀 차단 게이트 — 5종 spec / 4 디바이스

| Spec | 어셔션 | 평균 시간 |
|---|---|---|
| `mobile-responsive` | 36 (4 device × 9 page) — 가로 오버플로우 | ~24초 |
| `visual-regression` | 36 (toHaveScreenshot baseline) | ~24초 |
| `tab-modal` | 9 (휴가관리 탭 + 날씨 알림 토글) | ~8초 |
| `login-flow` | 4 (redirect / 로그인 / 오류) | ~4초 |
| `a11y` | 10 (axe critical+serious 9 페이지) | ~10초 |
| **합계** | **97 어셔션 / 70초** | — |

**디바이스 프로파일** (Chromium emulate, WebKit 호환성 회피):
- 375 iPhone SE / 393 Pixel 7 / 360 Galaxy S / 768 iPad

---

## 📁 디렉터리·파일 인벤토리

```
app/
├── (admin)/
│   ├── _admin-shell.tsx              # Phase 16 — 햄버거 드로어 + 사이드바
│   └── layout.tsx                     # Phase 16 — server slim
├── (auth)/
│   ├── login/page.tsx                 # Phase 14·17·25 + mobile-admin-landing
│   ├── consent/_consent-client.tsx    # Phase 14 + a11y tabIndex (Cycle #3 후속)
│   └── reset/                         # Phase 19 — 응급 SW 초기화
├── citizen/new/                       # Phase 20 — 시민 민원
└── _sw-register.tsx                   # Phase 19 — SW 자동 갱신

components/
├── BottomSheet.tsx                    # Cycle #6 — 모바일 bottom sheet + 데스크탑 fallback
├── FilterToggle.tsx                   # Cycle #6 — 모바일 collapsible filter
├── Field.tsx                          # Cycle #4 — 공용 Field
├── LocationPickerMap.tsx              # Phase 14 — admin·worker 공유
├── MultiPhotoUploader.tsx             # Phase 14·18 — 3MB·3장
└── FacilitySelect.tsx                 # Phase 27 (super-admin 연계)

public/
└── sw.js                              # Phase 19 — network-first SW

e2e/                                   # Cycle #1 — Playwright
├── global.setup.ts
├── mobile-responsive.spec.ts
├── visual-regression.spec.ts
├── tab-modal.spec.ts
├── login-flow.spec.ts
├── a11y.spec.ts
├── helpers/pages.ts
└── visual-regression.spec.ts-snapshots/  # 36 PNG baseline

.github/workflows/
└── e2e.yml                            # Cycle #1 — 2-job functional+visual

docs/
├── mobile-issues.md                   # 36건 이슈 트래커
├── ci-debug.md                        # CI 디버깅 가이드
├── 01-plan/features/
│   ├── e2e-ci-integration.plan.md
│   ├── a11y-form-labels.plan.md
│   ├── a11y-serious-fix.plan.md
│   └── field-label-refactor.plan.md
├── 02-design/features/                # 4 design.md
├── 03-analysis/                       # e2e-ci-integration analysis
└── 04-report/                         # 4 report.md
```

---

## 🎯 핵심 지표 변화 (2026-04-25 → 2026-04-27)

| 지표 | Before | After | Δ |
|---|---:|---:|:---:|
| 모바일 지원 admin role | 0 | 4 (SUPER/CONTRACTOR/INTERNAL/MUNI) | +4 |
| 모바일 친화 페이지 | 1 (`/worker`) | 9 admin + 1 citizen + 1 worker = 11 | +10 |
| 가로 오버플로우 위반 | 17 테이블 | 0 | -17 |
| WCAG 2.1 AA 위반 | 35+ (critical 4 + serious 30+) | 0 | -35+ |
| Form 라벨 시맨틱 | 138 (div 라벨) | 138 (label htmlFor) | 100% |
| Field 컴포넌트 정의 | 10 중복 | 1 공용 + 1 의도적 예외 | -8 |
| e2e 회귀 차단 | 없음 | **97 어셔션 / 70초 / GHA 자동** | NEW |
| 사진 업로드 | 1.2MB / 단일 | 3MB / 3장 | +2.5x |
| 지도 렌더 조건 | GPS ready 시만 | 항상 + 핀 드래그 | NEW |
| PWA 갱신 | 수동 reload | network-first + 30분 자동 + `/reset` | NEW |

---

## 📝 다음 단계 후보

1. ~~**/complaints 모바일 대응**~~ ✅ **Cycle #6 완료** — BottomSheet + FilterToggle 적용
2. ~~**/super-admin 모바일 대응**~~ ✅ **Cycle #6 완료** — 4개 모달 BottomSheet 적용
3. **다른 admin 페이지 BottomSheet 통합** (/users, /safety 등) — `bottom-sheet-rollout` PDCA
4. **a11y moderate 임계값** — 점진 강화 다음 단계 (현재 critical+serious까지 완료)
5. **Tailwind 의미 토큰** — slate scale → text-primary/muted (`a11y-serious-fix.report.md` Outstanding)
6. **/safety 시각 mask 영역 확장** — 날씨 데이터 드리프트 방지 (`field-label-refactor.report.md` Outstanding)
7. **users 페이지 Field 통합** — canvas/file 우회법 연구 후 (우선순위 낮음)

---

## 📝 변경 이력

| Phase / Cycle | 날짜 | 핵심 |
|:---:|---|---|
| 14 | 2026-04-26 | 로그아웃·로그인·동의·민원 등록 고도화 |
| 15 | 2026-04-26 | 운영 배포 자동화 |
| **16** | 2026-04-26 | **모바일 반응형 admin 셸 (햄버거 드로어)** ⭐ |
| 17 | 2026-04-26 | 랜딩 페이지 정비 (`/complaints`로 redirect) |
| 18 | 2026-04-26 | 모바일 사진/지도 버그 4건 |
| 19 | 2026-04-26 | PWA 자동 갱신 + `/reset` |
| 20 | 2026-04-26 | 시민 민원 등록 고도화 |
| 21 | 2026-04-26 | 보호자 안전 카드 |
| 25 | 2026-04-27 | 로그인 화면 상용 SaaS 톤 |
| **#1** | 2026-04-27 | **e2e-ci-integration (98.5%)** — GHA + Playwright + baseline |
| **#2** | 2026-04-27 | **a11y-form-labels (100%)** — 9 form aria-label |
| **#3** | 2026-04-27 | **a11y-serious-fix (100%, 8 iter)** — page bg + slate token + opacity |
| **#4** | 2026-04-27 | **field-label-refactor (94%)** — Field 통합 + 138 인스턴스 |
| (단순) | 2026-04-27 | mobile-admin-landing — 모바일 admin → /dashboard redirect |
| **#5** | 2026-04-28 | **pwa-mobile-ux-mastering (100%)** — viewport 잠금 + LogoutButton AAA + 4-role 통합 + AccessibleConfirmDialog ⭐ |
| **#6** | 2026-04-28 | **mobile-admin-landings (100%)** — BottomSheet + FilterToggle 공용 컴포넌트 + /complaints·/super-admin 적용 ⭐ |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-27 | 개발_기록.md Phase 14·16~21·25 + 4 PDCA Reports + mobile-issues.md 통합 | 4365won@gmail.com |
| 0.2 | 2026-04-28 | Cycle #6 mobile-admin-landings — BottomSheet/FilterToggle 신규 + 변경 이력 추가 | 4365won@gmail.com |
