# 슈퍼관리자 콘솔 — 통합 이력

> **출처**: [개발_기록.md](../개발_기록.md) 산재 내용 정리 (2026-04-27 기준)
> **경로**: `app/(admin)/super-admin/_super-admin-client.tsx`
> **계정**: `super` / `changeme1234!` (SUPER_ADMIN — 전체 시스템 + 모든 지자체·업체 데이터)

---

## 📊 현재 상태 한눈에

| 항목 | 값 |
|---|---|
| **탭 수** | **5** (일반 / 지자체 권한 / 위탁업체 / 회사정보·차고지 / **처리시설 마스터**) |
| **모듈 정의** | 12. 슈퍼관리자 콘솔 (지자체 권한 정책 + 차고지 관리) |
| **권한** | SUPER_ADMIN (5단계 RBAC 최상위) |
| **진행 중 PDCA** | F-02 일일 처리실적 일보 PDF (Module 1·4·5 완료, M2/3/6/7/8 남음) |
| **관련 문서** | [개발규격서 05](./specs/05_지자체_모니터링_확장_개발규격서.md), [F-02 Plan](./01-plan/features/f02-daily-treatment-report.plan.md), [F-02 Design](./02-design/features/f02-daily-treatment-report.design.md) |

---

## 🗂 5개 탭 구성

| # | 탭 | 핵심 기능 | 도입 |
|:-:|---|---|---|
| 1 | 일반 | 콘솔 진입/요약 | Phase 6 |
| 2 | 지자체 권한 정책 | 지자체별 관리자 권한 매트릭스 지정 | Phase 6 |
| 3 | 위탁업체 집계 | 위탁업체 데이터 일괄 보기 | Phase 6 |
| 4 | 회사정보·차고지 | Nominatim 지오코딩(OSM 무료)으로 차고지 등록·관리 | Phase 6 |
| 5 | **처리시설 마스터** ✨ | facility CRUD (소각장/위탁/매립/자원순환/기타) | **Phase 27 (2026-04-27)** |

---

## 📅 도입·확장 타임라인

### Phase 6 — 최초 도입
**PWA + 슈퍼관리자 콘솔**
- 로그인 화면에 PWA 앱 설치 버튼
- **지자체 관리자 권한 정책** 지정 기능
- **위탁업체 일괄 집계** 기능

### Phase 26 — 확장 PDCA 착수 (2026-04-27)
**지자체 모니터링 확장**
- **개발 규격서** [`05_지자체_모니터링_확장_개발규격서.md`](./specs/05_지자체_모니터링_확장_개발규격서.md) 신규 작성:
  - 슈퍼관리자 콘솔 현재 상태 vs Gemini 제안 13개 항목 매트릭스 → **이미 70% 구현 확인**
  - 표준 보고 양식 카탈로그 **18종** (F-01~F-18 / 일·월·분기·연·이벤트 단위)
  - 신규 입력 폼 **8종** (FORM-01~FORM-08)
  - 출력 양식 빌더 옵션 A/B/C 비교 → **Plan §5.1 ReportTemplate + spec JSON** 채택
- **F-02 일일 처리실적 일보 PDF 출력** PDCA 시작:
  - Plan: 11 FR + 6 NFR + Context Anchor + Impact Analysis
  - Design: **Option B (Clean Architecture)** 채택, 8 모듈 / 5 세션 / 9일 추정
  - design-validator 6개 이슈 패치 (Critical 3 + Warning 3): FR-08 UI 시안, spec↔API 매핑, Visual Regression, `facility_not_configured` 에러, enum 모순, MUNI_ADMIN RBAC
  - 사용자 결정 4건: 처리시설 마스터 신규 도입 / 진입점 2곳 / 2인 서명란 / 계근 데이터 제외 / Option B 채택 / PDF 우선

### Phase 27 — F-02 Module 1·4·5 구현 (2026-04-27)

#### Module 1 — Schema (Session 1)
- `lib/facility.ts` — `FACILITY_TYPES` const tuple (소각장 / 위탁처리장 / 매립시설 / 자원순환센터 / 기타) + 검증 함수
- `prisma/schema.prisma`:
  - `WasteTreatmentFacility` 모델 신규 (contractor 단위 마스터, type=VARCHAR로 enum 마이그레이션 회피)
  - `RecyclingCenterIntake.facilityId` 컬럼 추가 (NULL 허용 — backward-compat) + `@@index([facilityId, intakeDate])`
  - `ReportTemplate` 모델 신규 (JSON spec 컬럼, code/version/active, F-07/F-09 재사용 전제)
  - `Municipality.reportTemplates`, `Contractor.{treatmentFacilities,reportTemplates}` 역참조
- `prisma/seeds/report-templates/F-02.json` — Design §3.4 spec JSON 그대로 시드 (table.columns 7종)
- `prisma/seed.ts` — facility 4건 + F-02 ReportTemplate 1건 추가
- `npx prisma db push` (마이그레이션 폴더 없는 프로젝트 패턴) + `db seed` 통과

#### Module 4 — Facility Master (Session 3)
- `app/api/super-admin/facilities/route.ts` — GET 목록 + POST 등록, Zod 검증, `duplicate_facility` 409, AuditLog
- `app/api/super-admin/facilities/[id]/route.ts` — PATCH 수정/활성토글
- `components/FacilitySelect.tsx` — 재사용 드롭다운 + facility 0건 시 슈퍼관리자 등록 안내 (Design §6.1 mitigation)
- `app/(admin)/super-admin/facilities/_facilities-tab.tsx` — 마스터 CRUD UI (목록 + 등록 모달)
- `app/(admin)/super-admin/_super-admin-client.tsx` — **"처리시설 마스터" 5번째 탭** 추가 + URL `?tab=facilities` 진입점 + `ALL_REPORTS`에 `f02` 추가 (MUNI_ADMIN RBAC 전제)

#### Module 5 — Performance Integration (Session 3)
- `/api/recycling-intake` API — Body·Patch 스키마에 `facilityId` 추가, 응답에 `facilityName`/`facilityType`, 자사 facility 가시범위 검증
- `/performance` 반입 입력 모달 — `<FacilitySelect>` 통합 (선택 시 그 시설로 저장)
- 반입 표에 "처리시설" 컬럼 추가 (NULL인 기존 row는 "(미지정)" 표시)
- **FR-08 일자별 카드 PDF 출력 버튼** — 단일 일자 + 데이터 있을 때 녹색 "📄 일보 PDF 출력" 버튼 노출 → `/api/reports/daily-treatment/pdf?date={from}` (Module 6에서 활성화 예정)

#### 검증
- `npx tsc --noEmit` 0 에러
- API 라우트 등록 확인 (401 auth guard 정상)

#### 남은 모듈
| Module | 작업 | 추정 |
|---|---|:---:|
| M2 | renderer-core | 2일 |
| M3 | renderer-components | 1.5일 |
| M6 | report-api | 1일 |
| M7 | report-ui | 1일 |
| M8 | audit + E2E | 1일 |

---

## 🗂 디렉터리·파일 인벤토리

```
app/(admin)/super-admin/
├── _super-admin-client.tsx    # 5탭 통합 클라이언트 (Phase 6 + 27)
├── facilities/
│   └── _facilities-tab.tsx    # 처리시설 마스터 CRUD (Phase 27)
└── ... (기타 탭별 컴포넌트)

app/api/super-admin/
└── facilities/
    ├── route.ts               # GET 목록 + POST 등록 (Phase 27)
    └── [id]/route.ts          # PATCH 수정/활성토글 (Phase 27)

components/
└── FacilitySelect.tsx         # facility 재사용 드롭다운 (Phase 27)

prisma/
├── schema.prisma              # WasteTreatmentFacility / ReportTemplate
├── seed.ts                    # facility 4건 + F-02 template 시드
└── seeds/
    └── report-templates/
        └── F-02.json          # 일일 처리실적 일보 spec JSON

docs/
├── specs/
│   └── 05_지자체_모니터링_확장_개발규격서.md  # 18 보고양식 + 8 입력폼
├── 01-plan/features/
│   └── f02-daily-treatment-report.plan.md
└── 02-design/features/
    └── f02-daily-treatment-report.design.md
```

---

## 🔁 RBAC + 진입

| 사용자 | 진입 경로 |
|---|---|
| `INTERNAL_ADMIN` / `CONTRACTOR_ADMIN` / `MUNI_ADMIN` / **`SUPER_ADMIN`** | **`/complaints`** (이전 `/dashboard`에서 변경) |
| **`SUPER_ADMIN`** (모바일) | `/dashboard` (login page에서 모바일 UA 감지 시 — `mobile-admin-landing` 사이클) |
| 슈퍼관리자 콘솔 | `/super-admin` (햄버거 메뉴 또는 직접 URL) |
| 처리시설 마스터 | `/super-admin?tab=facilities` (Phase 27 신규 진입점) |

---

## 🎯 향후 계획

### F-02 완료까지 남은 작업
1. M2 — renderer-core (PDF 렌더링 코어)
2. M3 — renderer-components (table/header/footer 컴포넌트)
3. M6 — report-api (`/api/reports/daily-treatment/pdf`)
4. M7 — report-ui (보고서 목록 + 출력 UI)
5. M8 — audit + E2E

### F-02 이후 18종 보고양식 확장
- F-01 ~ F-18 중 F-02만 진행 중 → 17종은 **ReportTemplate spec JSON 추가**로 같은 renderer 재사용
- 신규 입력 폼 FORM-01 ~ FORM-08 도입

---

## 📝 변경 이력

| Phase | 날짜 | 변경 |
|:---:|---|---|
| 6 | (미정) | 최초 도입 — 권한 정책 + 위탁업체 + 차고지 |
| 26 | 2026-04-27 | 확장 규격서 + F-02 PDCA Plan/Design |
| 27 | 2026-04-27 | F-02 Module 1·4·5 구현 — 처리시설 마스터 탭 + DB 모델 + API + UI |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-27 | 개발_기록.md 산재 내용 통합 정리 | 4365won@gmail.com |
