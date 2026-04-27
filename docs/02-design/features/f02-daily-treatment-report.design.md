---
template: design
version: 1.7.0
feature: f02-daily-treatment-report
date: 2026-04-27
author: 4365won@gmail.com
project: waste-erp (Clean ERP)
plan_ref: docs/01-plan/features/f02-daily-treatment-report.plan.md
selected_architecture: "Option B — Clean Architecture (출력 양식 빌더 인프라 동시 도입)"
---

# F-02 일일 처리실적 일보 PDF 출력 — Design Document

> **Selected Architecture**: Option B — Clean Architecture (`ReportTemplate` + JSON spec + Puppeteer 렌더러 분리)
> **Plan Reference**: [f02-daily-treatment-report.plan.md](../../01-plan/features/f02-daily-treatment-report.plan.md)
> **Spec Reference**: [05_지자체_모니터링_확장_개발규격서.md §3.1, §5](../../specs/05_지자체_모니터링_확장_개발규격서.md)
> **Status**: Draft

---

## Context Anchor

> Inherited from Plan document.

| Key | Value |
|-----|-------|
| **WHY** | 일일 처리실적 일보 작성·제출이 위탁업체의 일상 행정 부담이며 지자체 모니터링 신뢰도의 기반 |
| **WHO** | (1차) 위탁업체 사무직, (2차) 지자체 환경과 담당 공무원 |
| **RISK** | 처리시설 마스터 신규 도입 → 기존 입력 화면 동시 수정 → 회귀 + Option B 인프라 도입 과잉 가능성 |
| **SUCCESS** | 임의 일자 선택 → 5초 내 PDF 다운로드 + 모든 반입 레코드 포함 + 처리시설 정보 표시 |
| **SCOPE** | F-02 단일 양식 + Option B 빌더 인프라 (다음 양식 재사용 전제) |

---

## 1. Overview

### 1.1 Design Goals

1. **재사용 가능한 PDF 렌더링 인프라** 구축 — F-07/F-09 등 후속 양식이 같은 파이프라인 사용
2. **JSON spec 기반 양식 정의** — 코드 변경 없이 양식 레이아웃·필드 매핑 변경 가능
3. **F-02 양식을 첫 번째 reference implementation**으로 검증
4. 기존 워크플로우(`/performance` 입력) 회귀 0
5. PDF 생성 5초 이내, 한글 폰트 깨짐 0

### 1.2 Design Principles

- **Separation of concerns**: 양식 정의(JSON) ↔ 데이터 조회 ↔ 렌더링(Puppeteer)을 명확히 분리
- **Convention over configuration**: spec JSON은 합리적 기본값 제공, 양식별 차이만 명시
- **Backward compatibility**: 기존 `RecyclingCenterIntake` 데이터의 `facilityId=NULL` 케이스 안전 처리
- **No premature abstraction**: spec 스키마는 F-02·F-07·F-09까지의 공통점만 추상화. F-12 평가표 같은 비정형 양식은 v2에서

---

## 2. Architecture Options (v1.7.0)

### 2.0 Architecture Comparison

| Option | Approach | Effort | Maintainability | Reusability | Risk |
|--------|----------|--------|----------------|-------------|------|
| A — Minimal | F-02용 PDF 단일 컴포넌트 하드코딩 | 3~4일 | Low | Low | Low |
| **B — Clean (선택)** | **ReportTemplate + spec JSON + 렌더러 분리** | **8~10일** | **High** | **High** | **Medium** |
| C — Pragmatic | 컴포넌트 분리는 하되 spec JSON 도입 보류 | 5~6일 | Medium | Medium | Low |

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser (Admin)                         │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐  │
│  │ /performance         │  │ /reports                         │  │
│  │  - 반입 입력 폼       │  │  - 일일 처리실적 일보 탭          │  │
│  │  - facility 드롭다운  │  │  - 날짜 picker + 미리보기 iframe │  │
│  │  - PDF 출력 버튼      │  │  - 다운로드 버튼                 │  │
│  └─────────────────────┘  └─────────────────────────────────┘  │
└──────────┬──────────────────────────────────┬───────────────────┘
           │                                  │
           ▼                                  ▼
┌─────────────────────────┐  ┌──────────────────────────────────┐
│ /api/super-admin/        │  │ /api/reports/daily-treatment      │
│   facilities             │  │   ├── GET → JSON (미리보기용)     │
│   (CRUD)                 │  │   └── /pdf → application/pdf      │
└──────────┬──────────────┘  └──────────────┬───────────────────┘
           │                                  │
           │                                  ▼
           │                 ┌────────────────────────────────────┐
           │                 │ lib/report/                          │
           │                 │  ├─ template-loader.ts               │
           │                 │  │   (DB의 ReportTemplate.spec 로드)  │
           │                 │  ├─ data-resolver.ts                 │
           │                 │  │   (spec.table.source 기반 Prisma) │
           │                 │  ├─ html-renderer.tsx                │
           │                 │  │   (React renderToStaticMarkup)    │
           │                 │  └─ pdf-renderer.ts                  │
           │                 │      (Puppeteer 인스턴스 풀 + HTML→PDF)│
           │                 └────────────────────────────────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                          PostgreSQL (Prisma)                      │
│  WasteTreatmentFacility (신규)  RecyclingCenterIntake (수정)       │
│  ReportTemplate (신규)          AuditLog (기존)                    │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

**PDF 생성 플로우 (`GET /api/reports/daily-treatment/pdf?date=2026-04-27`)**

```
1. Auth guard (readSession)
   → contractorId / role 추출
2. template-loader.ts
   → ReportTemplate where code='F-02', municipalityId=null OR matches → spec JSON
3. data-resolver.ts
   → spec.table.source = 'RecyclingCenterIntake'
   → Prisma findMany({ where: { contractorId, intakeDate: date }, include: { vehicle, facility } })
   → spec.summary 계산 (성상별 sum)
4. html-renderer.tsx
   → renderToStaticMarkup(<ReportPage spec={spec} data={data} />)
   → 결과 HTML 문자열
5. pdf-renderer.ts
   → puppeteer page.setContent(html)
   → page.pdf({ format: 'A4', landscape: true })
   → Buffer
6. AuditLog.create({ action: 'report_download', entity: 'f02', entityId: date })
7. Response
   → Content-Type: application/pdf
   → Content-Disposition: attachment; filename="f02-{date}.pdf"
```

### 2.3 Dependencies

| Package | Purpose | Reason |
|---------|---------|--------|
| `puppeteer-core@^23` | Headless Chromium 제어 | full puppeteer는 150MB Chromium 번들 — `puppeteer-core` + 시스템 Chromium 사용 |
| `@sparticuz/chromium` (선택) | 서버리스 환경 Chromium binary | Vercel/Lambda 배포 시 필요. 현재 Docker는 시스템 Chrome 설치로 대체 가능 |
| (기존) `@prisma/client` | DB ORM | — |
| (기존) `react-dom/server` | renderToStaticMarkup | Next.js에 이미 포함 |

---

## 3. Data Model

### 3.1 Entity Definition

#### 3.1.1 `WasteTreatmentFacility` (신규)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| `id` | BigInt | PK, autoincrement | — |
| `contractorId` | BigInt | FK → Contractor | 위탁업체별 마스터 |
| `type` | String VARCHAR(20) | not null | TypeScript 상수 enum로 검증, DB는 VARCHAR. 값: INCINERATOR/OUTSOURCED/LANDFILL/RECYCLING_CENTER/OTHER. **VARCHAR 채택 사유**: Plan §5 Risk — 향후 type 추가 시 DB 마이그레이션 없이 코드 상수만 갱신하기 위함 |
| `name` | String VARCHAR(100) | not null | 시설명 |
| `address` | String VARCHAR(255) | nullable | 주소 |
| `active` | Boolean | default true | 비활성화 가능 (history 보존) |
| `createdAt` | DateTime | default now | — |
| `updatedAt` | DateTime | updatedAt | — |

#### 3.1.2 `RecyclingCenterIntake` (수정)

| Change | Field | Detail |
|--------|-------|--------|
| ADD | `facilityId` | BigInt? @map("facility_id") + FK → WasteTreatmentFacility (NULL 허용 — 기존 row 보존) |
| ADD | index | `@@index([facilityId, intakeDate])` (보고서 조회 최적화) |

#### 3.1.3 `ReportTemplate` (신규)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| `id` | BigInt | PK | — |
| `contractorId` | BigInt | FK → Contractor | 위탁업체별 양식 |
| `municipalityId` | BigInt? | FK → Municipality | NULL = 표준 양식, value = 지자체 커스텀 |
| `code` | String VARCHAR(20) | not null | F-02, F-07, ... |
| `name` | String VARCHAR(100) | not null | "일일 처리실적 일보" |
| `spec` | Json | not null | 양식 정의 JSON (아래 §3.4 참조) |
| `outputFormats` | String VARCHAR(50) | default "pdf" | "pdf" / "pdf,xlsx" |
| `version` | Int | default 1 | 버전 관리 |
| `active` | Boolean | default true | — |
| (audit) | createdAt, updatedAt | — | — |

UNIQUE: `(contractorId, municipalityId, code, version)`

### 3.2 Entity Relationships

```
Contractor
  ├── 1:N → WasteTreatmentFacility
  └── 1:N → ReportTemplate ─── N:1 → Municipality (optional)

WasteTreatmentFacility
  └── 1:N → RecyclingCenterIntake

RecyclingCenterIntake
  └── N:1 → Vehicle
```

### 3.3 Database Schema (Prisma)

```prisma
// Note: Prisma enum 사용하지 않음 — Plan §5 Risk 결정에 따라 VARCHAR 채택.
// TypeScript 측에서는 lib/types/facility.ts의 const tuple로 검증:
//   export const FACILITY_TYPES = ['INCINERATOR','OUTSOURCED','LANDFILL','RECYCLING_CENTER','OTHER'] as const;
//   export type FacilityType = (typeof FACILITY_TYPES)[number];

model WasteTreatmentFacility {
  id            BigInt    @id @default(autoincrement())
  contractorId  BigInt    @map("contractor_id")
  type          String    @db.VarChar(20)  // FacilityType union (TS 측 검증)
  name          String    @db.VarChar(100)
  address       String?   @db.VarChar(255)
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  contractor    Contractor              @relation(fields: [contractorId], references: [id])
  intakes       RecyclingCenterIntake[]

  @@index([contractorId, active])
  @@map("waste_treatment_facilities")
}

// RecyclingCenterIntake — 추가 컬럼만
model RecyclingCenterIntake {
  // ... existing fields ...
  facilityId    BigInt?   @map("facility_id")        // 신규
  facility      WasteTreatmentFacility? @relation(fields: [facilityId], references: [id])  // 신규

  @@index([facilityId, intakeDate])  // 신규
}

model ReportTemplate {
  id              BigInt    @id @default(autoincrement())
  contractorId    BigInt    @map("contractor_id")
  municipalityId  BigInt?   @map("municipality_id")
  code            String    @db.VarChar(20)
  name            String    @db.VarChar(100)
  spec            Json
  outputFormats   String    @default("pdf") @map("output_formats") @db.VarChar(50)
  version         Int       @default(1)
  active          Boolean   @default(true)
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  contractor      Contractor    @relation(fields: [contractorId], references: [id])
  municipality    Municipality? @relation(fields: [municipalityId], references: [id])

  @@unique([contractorId, municipalityId, code, version])
  @@index([contractorId, code, active])
  @@map("report_templates")
}
```

### 3.4 spec JSON 스키마 (F-02 시드 양식)

#### 3.4.0 spec 토큰 ↔ API 응답 매핑

`html-renderer.tsx`가 spec의 `{{...}}` 토큰을 §4.2 `GET /api/reports/daily-treatment` 응답으로 치환하기 위한 정확한 매핑 표:

| spec 토큰 | API 응답 path | Source 모델/필드 | 비고 |
|---|---|---|---|
| `{{contractor.companyName}}` | `data.header.contractor.companyName` | `Contractor.companyName` | — |
| `{{contractor.businessNo}}` | `data.header.contractor.businessNo` | `Contractor.businessNo` | — |
| `{{contractor.logoUrl}}` | `data.header.contractor.logoUrl` | `Contractor` (신규 컬럼 미존재 — fallback "") | 회사정보 탭에서 향후 추가 |
| `{{municipality.name}}` | `data.header.municipality.name` | `Municipality.name` | `Contractor.municipalityId` 조인 |
| `{{municipality.code}}` | `data.header.municipality.code` | `Municipality.code` | — |
| `{{date}}` | `data.header.date` (`YYYY-MM-DD`) | request param | — |
| `{{contractorId}}` | (서버 내부 사용 — JSON 비노출) | `readSession().contractorId` | filter 전용 |
| `{{now}}` | `data.meta.generatedAt` (ISO) | `new Date()` | footer.metadata.생성 시각 |
| `{{user.name}}` | `data.meta.generatedBy.name` | `User.name` (세션) | footer.metadata.생성자 |

API 응답 §4.2를 다음 구조로 확장 (header/rows에 추가):

```json
{
  "data": {
    "header": {
      "contractor": { "id": "1", "companyName": "○○환경", "businessNo": "123-45-67890", "logoUrl": null },
      "municipality": { "id": "10", "name": "○○구", "code": "MUNI-001" },
      "date": "2026-04-27"
    },
    "summary": [...],
    "rows": [...],
    "totals": { "weightTon": 27.6 },
    "meta": {
      "generatedAt": "2026-04-27T17:30:00+09:00",
      "generatedBy": { "id": "5", "name": "홍길동" }
    }
  }
}
```



```json
{
  "page": { "format": "A4", "orientation": "landscape", "margin": "10mm" },
  "header": {
    "left":  { "type": "logo", "src": "{{contractor.logoUrl}}", "width": 60 },
    "title": "일일 처리실적 일보",
    "meta":  [
      { "label": "위탁업체", "value": "{{contractor.companyName}}" },
      { "label": "지자체",   "value": "{{municipality.name}}" },
      { "label": "사업자번호", "value": "{{contractor.businessNo}}" },
      { "label": "날짜",     "value": "{{date | format('YYYY-MM-DD (ddd)')}}" }
    ]
  },
  "summary": {
    "type": "cards",
    "groupBy": "materialCategory",
    "metric": { "field": "weightTon", "agg": "sum", "unit": "t" },
    "labels": {
      "GENERAL": "생활",
      "FOOD": "음식물",
      "RECYCLING": "재활용",
      "WOOD": "대형폐기물"
    }
  },
  "table": {
    "source": "RecyclingCenterIntake",
    "filter": { "intakeDate": "{{date}}", "contractorId": "{{contractorId}}" },
    "orderBy": [{ "intakeTime": "asc" }],
    "include": { "vehicle": true, "facility": true },
    "columns": [
      { "label": "번호",     "type": "rowNumber",  "width": "5%" },
      { "label": "차량번호", "field": "vehicle.plateNumber", "width": "15%" },
      { "label": "반입시각", "field": "intakeTime", "width": "10%" },
      { "label": "처리시설", "field": "facility.name", "fallback": "(미지정)", "width": "25%" },
      { "label": "성상",     "field": "materialCategory", "labelMap": "summary.labels", "width": "12%" },
      { "label": "중량(t)",  "field": "weightTon", "format": "0.000", "align": "right", "width": "13%" },
      { "label": "비고",     "field": "note", "width": "20%" }
    ],
    "footer": { "label": "합계", "totals": [{ "field": "weightTon", "agg": "sum" }] }
  },
  "footer": {
    "signatures": [
      { "label": "현장책임자", "width": 200 },
      { "label": "지자체 담당", "width": 200 }
    ],
    "metadata": [
      { "label": "생성", "value": "{{now | format('YYYY-MM-DD HH:mm')}}" },
      { "label": "생성자", "value": "{{user.name}}" }
    ]
  }
}
```

---

## 4. API Specification

### 4.1 Endpoint List

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET    | `/api/super-admin/facilities` | 처리시설 목록 | SUPER_ADMIN, INTERNAL_ADMIN, CONTRACTOR_ADMIN |
| POST   | `/api/super-admin/facilities` | 처리시설 등록 | SUPER_ADMIN, INTERNAL_ADMIN |
| PATCH  | `/api/super-admin/facilities/[id]` | 처리시설 수정 | SUPER_ADMIN, INTERNAL_ADMIN |
| GET    | `/api/reports/daily-treatment` | F-02 데이터 (JSON, 미리보기용) | 자사 + 권한 있는 지자체 |
| GET    | `/api/reports/daily-treatment/pdf` | F-02 PDF 스트림 | 자사 + 권한 있는 지자체 |

### 4.2 Detailed Specification

#### `GET /api/reports/daily-treatment?date=YYYY-MM-DD&contractorId={id}`

**Query Params**:
- `date` (required): YYYY-MM-DD
- `contractorId` (optional, SUPER_ADMIN만): 다른 위탁업체 조회

**Response 200** (JSON):
```json
{
  "data": {
    "header": { "contractor": {...}, "municipality": {...}, "date": "2026-04-27" },
    "summary": [
      { "category": "GENERAL", "label": "생활", "totalTon": 12.5 },
      { "category": "FOOD", "label": "음식물", "totalTon": 8.2 }
    ],
    "rows": [
      {
        "no": 1,
        "vehiclePlate": "12가1234",
        "intakeTime": "08:30",
        "facilityName": "자원순환센터",
        "materialCategory": "RECYCLING",
        "weightTon": 2.450,
        "note": null
      }
    ],
    "totals": { "weightTon": 27.6 }
  }
}
```

**Response 4xx**:
- 400 `invalid_date` — date 파라미터 형식 오류
- 401 `unauthorized` — 세션 없음
- 403 `forbidden` — 다른 contractor 조회 권한 없음

#### `GET /api/reports/daily-treatment/pdf?date=YYYY-MM-DD&contractorId={id}`

**Response 200**:
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="F-02_{contractor}_{date}.pdf"`
- Body: PDF binary

**Side effects**:
- AuditLog INSERT: `{ action: "report_download", entity: "f02", entityId: date, userId, ip }`

#### `GET /api/super-admin/facilities`

**Response 200**:
```json
{
  "data": [
    { "id": "1", "type": "RECYCLING_CENTER", "name": "○○구 자원순환센터", "address": "...", "active": true }
  ]
}
```

#### `POST /api/super-admin/facilities`

**Request body**:
```json
{ "type": "INCINERATOR", "name": "○○ 소각장", "address": "..." }
```

**Validation**:
- `type` ∈ enum
- `name` 1~100자
- 동일 contractor 내 (type, name) 중복 거부 → 400 `duplicate_facility`

---

## 5. UI/UX Design

### 5.1 Screen Layout

#### 5.1.1 처리시설 마스터 관리 (`/super-admin` 신규 탭)

```
┌──────────────────────────────────────────────────────────┐
│ [지자체관리] [권한매트릭스] [거래처조회] [회사정보] [GIS] [처리시설] │
├──────────────────────────────────────────────────────────┤
│  [+ 처리시설 등록]                                          │
│  ┌──────┬───────────────┬────────────────────┬──────┐    │
│  │ 분류  │ 시설명         │ 주소               │ 상태 │    │
│  ├──────┼───────────────┼────────────────────┼──────┤    │
│  │ 자원  │ ○○구 자원순환  │ 서울시 ○○구...     │ 활성 │    │
│  │ 소각  │ ○○ 소각장      │ ...                │ 활성 │    │
│  └──────┴───────────────┴────────────────────┴──────┘    │
└──────────────────────────────────────────────────────────┘
```

#### 5.1.2 반입 입력 폼 (`/performance` 수정)

기존 폼에 처리시설 드롭다운 1개 추가 — 다른 필드 변경 없음.

```
[일자: 2026-04-27]
[차량번호 ▼] [반입시각 __:__] [처리시설 ▼ 신규] [성상 ▼] [중량 _.___]  [+추가]
```

##### 일자별 카드 PDF 출력 버튼 (FR-08)

`/performance`의 일자별 집계 카드 우상단에 PDF 출력 버튼 통합 — 입력자가 작성 직후 즉시 출력 가능.

```
┌──────────────────────────────────────────────────────────┐
│ 2026-04-27 (월)              [📄 일보 PDF 출력] [📊 집계 ▾] │
├──────────────────────────────────────────────────────────┤
│ 생활 12.5t · 음식물 8.2t · 재활용 4.8t · 대형 2.1t          │
│ 반입 8건 · 차량 3대 · 처리시설 4곳                          │
└──────────────────────────────────────────────────────────┘
```

- 버튼 동작: `/api/reports/daily-treatment/pdf?date={cardDate}` 직접 호출 → 다운로드
- 버튼 비활성 조건: 해당 일자 반입 0건
- 버튼 비표시 조건: `MuniAccessPolicy.allowedReports`에 `f02` 미포함 (지자체 사용자) 또는 권한 부족

#### 5.1.3 보고서 화면 (`/reports` 신규 탭)

```
┌─────────────────────────────────────────────────┐
│ [통합][근태][민원][차량][일일 처리실적 일보 ★신규]   │
├─────────────────────────────────────────────────┤
│  날짜: [2026-04-27 ▼]   [미리보기] [PDF 다운로드]   │
│  ─────────────────────────────────────────────   │
│  ┌──────────────────────────────────────────┐    │
│  │  [iframe — html-renderer 결과 미리보기]    │    │
│  │  스크롤 가능, 인쇄 시 A4 가로 1페이지       │    │
│  └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

#### 5.1.4 PDF 인쇄 레이아웃 (Option C 시안 채택)

A4 가로 1페이지(반입 25건 기준):

```
┌──────────────────────────────────────────────────────────────┐
│ [logo] ○○환경    일일 처리실적 일보    [지자체: ○○구]            │
│        사업자: 123-45-67890     장·회수: 8회 · 27.6t           │
│ 날짜: 2026-04-27 (월)                                          │
├──────────────────────────────────────────────────────────────┤
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                  │
│ │ 생활   │ │ 음식물 │ │ 재활용 │ │ 대형폐 │                   │
│ │ 12.5t  │ │  8.2t  │ │  4.8t  │ │  2.1t  │                  │
│ └────────┘ └────────┘ └────────┘ └────────┘                  │
├──────┬─────────────┬───────┬────────────────────┬──────┬─────┤
│ 번호 │ 차량번호     │ 시각  │ 처리시설           │ 성상 │ 중량(t)│
├──────┼─────────────┼───────┼────────────────────┼──────┼─────┤
│  1   │ 12가 1234    │ 08:30 │ 자원순환센터        │ 재활용│ 2.450 │
│  2   │ 34나 5678    │ 09:15 │ 소각장             │ 생활 │ 1.820 │
│ ...                                                           │
├──────┴─────────────┴───────┴────────────────────┼──────┼─────┤
│ 합계                                              │      │27.6 │
├──────────────────────────────────────────────────────────────┤
│ 현장책임자: ____________      지자체 담당: ____________        │
│ 생성: 2026-04-27 17:30   생성자: 홍길동                        │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 User Flow

**일보 출력 flow** (행복 경로):
1. /reports 접속 → "일일 처리실적 일보" 탭
2. 날짜 picker에서 출력할 일자 선택 (default: 어제)
3. "미리보기" 클릭 → iframe에 HTML 렌더 (5초 이내)
4. 검토 후 "PDF 다운로드" 클릭
5. 브라우저 다운로드 시작 (5초 이내)
6. AuditLog 기록

### 5.3 Component List

| Component | Location | Purpose |
|-----------|----------|---------|
| `<DailyTreatmentTab>` | app/(admin)/reports/daily-treatment/_daily-treatment-tab.tsx | 보고서 화면 탭 컨테이너 |
| `<ReportPreview>` | 동상 | iframe 미리보기 + 다운로드 버튼 |
| `<ReportPage>` | lib/report/components/ReportPage.tsx | spec-driven PDF 페이지 (재사용) |
| `<ReportHeader>` | 동상 | spec.header 렌더 |
| `<ReportSummaryCards>` | 동상 | spec.summary 렌더 |
| `<ReportTable>` | 동상 | spec.table 렌더 |
| `<ReportFooter>` | 동상 | spec.footer 렌더 |
| `<FacilitySelect>` | components/forms/FacilitySelect.tsx | 처리시설 드롭다운 (재사용) |
| `<FacilitiesTab>` | app/(admin)/super-admin/facilities/_facilities-tab.tsx | 마스터 CRUD UI |

### 5.4 Page UI Checklist

#### `/reports` 일일 처리실적 일보 탭
- [ ] 날짜 picker 기본값: 어제 (KST 기준)
- [ ] 미리보기 버튼: 클릭 시 로딩 스피너 → iframe 갱신
- [ ] PDF 다운로드 버튼: 비활성 조건 = 데이터 없음
- [ ] 데이터 없음 상태: "선택하신 날짜에 반입 기록이 없습니다" 표시
- [ ] 권한 없음 상태: 탭 자체 비표시

#### `/performance` 반입 입력
- [ ] 처리시설 드롭다운: 활성 시설만 노출
- [ ] 시설 미설정 상태: 409 `facility_not_configured` 응답을 받아 "처리시설을 먼저 등록해 주세요 (슈퍼관리자)" + `/super-admin?tab=facilities` 링크 표시
- [ ] 기존 입력 row 수정 시 facilityId NULL → 드롭다운 placeholder "(미지정)"

#### `/super-admin` 처리시설 탭
- [ ] 등록 모달: type/name/address 검증
- [ ] 수정/비활성화 버튼
- [ ] 비활성화된 시설은 회색 표시 + 신규 입력 폼에 노출 안 됨

---

## 6. Error Handling

### 6.1 Error Code Definition

| Code | HTTP | Message | When |
|------|------|---------|------|
| `invalid_date` | 400 | 날짜 형식이 올바르지 않습니다 | date 파라미터 파싱 실패 |
| `unauthorized` | 401 | 로그인이 필요합니다 | 세션 없음 |
| `forbidden` | 403 | 접근 권한이 없습니다 | role/contractor 불일치 |
| `template_not_found` | 404 | 양식을 찾을 수 없습니다 | F-02 시드 미적재 |
| `no_data` | 200 (빈 응답) | (메시지 없이 빈 표) | 해당 일자 반입 0건 |
| `pdf_render_failed` | 500 | PDF 생성 중 오류가 발생했습니다 | Puppeteer 타임아웃·크래시 |
| `duplicate_facility` | 400 | 동일한 시설이 이미 등록되어 있습니다 | (contractor, type, name) UNIQUE 위반 |
| `facility_not_configured` | 409 | 처리시설이 등록되어 있지 않습니다. 슈퍼관리자에게 등록을 요청해 주세요. | 반입 입력 시 활성 facility 0건 (Plan §5 Risk 1 mitigation). 응답에 `linkTo: "/super-admin?tab=facilities"` 포함 |

### 6.2 Error Response Format

```json
{ "error": "invalid_date", "message": "날짜 형식이 올바르지 않습니다", "fieldErrors": { "date": "YYYY-MM-DD 형식이어야 합니다" } }
```

---

## 7. Security Considerations

- **Tenant isolation**: 모든 `/api/reports/*` 라우트는 `readSession()` → contractorId 추출 → Prisma where절에 강제 주입
- **SUPER_ADMIN 예외**: contractorId 쿼리 파라미터 허용 — 단 AuditLog에 `target_contractor_id` 기록
- **PDF binary 응답에서 sensitive data 노출 금지**: 비밀번호 hash, 주민번호 등은 spec 매핑 단계에서 차단 (allowlist 방식)
- **Server-side render**: spec JSON은 신뢰된 DB 출처만. 사용자가 임의 spec 주입 불가 (FORM-06 빌더 도입 시 spec validator 별도 구현)
- **AuditLog**: 모든 PDF 다운로드 기록 — 5년 보존
- **Puppeteer chromium**: `--no-sandbox` 플래그는 Docker 컨테이너 내부에서만 허용 (호스트 직접 실행 금지)

### 7.1 Role-based Access Control (FR-11)

| Role | `/api/reports/daily-treatment(.pdf)` | 조건 |
|---|---|---|
| `SUPER_ADMIN` | ✅ 전체 contractor | `contractorId` 쿼리 파라미터로 전환 가능 |
| `INTERNAL_ADMIN` | ✅ 자사 contractor만 | — |
| `CONTRACTOR_ADMIN` | ✅ 자사 contractor만 | — |
| `MUNI_ADMIN` | ⚠️ 조건부 | (1) 해당 지자체에 속한 contractor만 + (2) `MuniAccessPolicy.allowedReports`에 `f02` 코드 포함 + (3) `MuniAccessPolicy.exportEnabled = true` (PDF 출력 시) |
| `WORKER` | ❌ 거부 (403) | — |

**MuniAccessPolicy 정합성**:
- `MuniAccessPolicy.allowedReports`에 신규 코드 `f02` 추가 필요 (현재 `complaints,attendance,leave,waste,intake,safety,hr` 7종) → 슈퍼관리자 콘솔 §3.3 [`ALL_REPORTS`](../../../app/(admin)/super-admin/_super-admin-client.tsx) 상수에 `{ code: 'f02', label: 'F-02 일일 처리실적 일보' }` 항목 추가
- 지자체 권한 확인 흐름: `readSession()` → role=MUNI_ADMIN → `MuniAccessPolicy where municipalityId` → `allowedReports.split(',').includes('f02')` 검증 → 실패 시 403 `forbidden`

---

## 8. Test Plan (v2.3.0)

### 8.1 Test Scope

L1 API 5건 + L2 UI Action 3건 + L3 E2E 1건 + L3 Visual Regression 1건 = 10건

### 8.2 L1: API Test Scenarios

```bash
# 1. 행복 경로 — JSON
curl -H "Cookie: session=..." \
     "http://localhost:3000/api/reports/daily-treatment?date=2026-04-27" \
     # expect 200, data.rows[].length > 0

# 2. PDF 다운로드
curl -H "Cookie: session=..." \
     -I "http://localhost:3000/api/reports/daily-treatment/pdf?date=2026-04-27"
     # expect 200, Content-Type: application/pdf

# 3. 권한 거부 — 다른 contractorId
curl -H "Cookie: session=worker-A..." \
     "http://localhost:3000/api/reports/daily-treatment?date=2026-04-27&contractorId=999"
     # expect 403

# 4. 잘못된 날짜
curl "http://localhost:3000/api/reports/daily-treatment?date=invalid"
     # expect 400, error: invalid_date

# 5. 미인증
curl "http://localhost:3000/api/reports/daily-treatment?date=2026-04-27"
     # expect 401
```

### 8.3 L2: UI Action Test Scenarios

1. /reports 진입 → "일일 처리실적 일보" 탭 클릭 → API call detected: GET /api/reports/daily-treatment
2. 날짜 변경 → "미리보기" 클릭 → iframe src에 새 날짜 반영
3. "PDF 다운로드" 클릭 → 브라우저 다운로드 이벤트 트리거

### 8.4 L3: E2E Scenario Test Scenarios

**Scenario**: 신규 처리시설 등록부터 PDF 출력까지 — full journey
1. SUPER_ADMIN 로그인
2. /super-admin → 처리시설 탭 → "+등록" → 시설 1건 추가
3. CONTRACTOR_ADMIN 로그인 (다른 세션)
4. /performance → 오늘 반입 row 1건 추가 (facility 선택)
5. /reports → 일일 처리실적 일보 → 오늘 날짜 → "PDF 다운로드"
6. 다운로드된 PDF 파일이 0 byte 아님 확인

#### Visual Regression (PDF 인쇄 레이아웃 회귀 — Plan §4.2)

PDF 출력의 시각적 레이아웃 회귀를 잡기 위한 스크린샷 비교 테스트. spec JSON 변경 시 의도치 않은 레이아웃 변화 감지.

**도구**: Playwright + `pixelmatch` (또는 `toHaveScreenshot` with threshold 0.2)

**시나리오**:
1. seed 데이터(§8.5) 고정값으로 결정론적 PDF 생성
   - date: `2026-04-27`
   - 반입 row 8건 고정
2. PDF → PNG 변환 (`pdf-to-png-converter` 또는 puppeteer로 page.screenshot)
3. baseline 이미지(`tests/e2e/__screenshots__/f02-baseline.png`)와 비교
4. 임계값: pixelmatch threshold 0.2 (Plan §4.2 기준), maxDiffPixelRatio 0.01

**관리 룰**:
- 의도된 양식 변경 시: `npx playwright test --update-snapshots` 로 baseline 갱신
- 갱신 시 PR description에 Before/After 스크린샷 첨부 필수

```ts
test('F-02 PDF 시각 회귀', async ({ page }) => {
  // Given: 고정 seed 데이터, 결정론적 contractor/date
  await loginAs(page, 'CONTRACTOR_ADMIN');
  // When: PDF API 호출 → PDF → PNG 변환
  const pdf = await fetchPdf(page, '/api/reports/daily-treatment/pdf?date=2026-04-27');
  const png = await pdfFirstPageToPng(pdf);
  // Then: baseline 비교
  expect(png).toMatchSnapshot('f02-baseline.png', {
    threshold: 0.2,
    maxDiffPixelRatio: 0.01,
  });
});
```

### 8.5 Seed Data Requirements

- Contractor 1건 (`○○환경`)
- Municipality 1건 (`○○구`)
- WasteTreatmentFacility 4건 (각 type별 1개)
- Vehicle 3건
- RecyclingCenterIntake 8건 (오늘 날짜, facility 매핑)
- ReportTemplate F-02 표준 spec 1건
- User 3명 (SUPER_ADMIN, CONTRACTOR_ADMIN, MUNI_ADMIN)

---

## 9. Clean Architecture

### 9.1 Layer Structure

```
┌─────────────────────────────────────────────────────────┐
│ Presentation                                             │
│   app/(admin)/reports/daily-treatment/                  │
│   app/(admin)/super-admin/facilities/                   │
│   app/(admin)/performance/  (수정 — 드롭다운 추가)         │
└─────────────────────┬───────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│ API Layer                                                │
│   app/api/reports/daily-treatment/(route|pdf/route).ts  │
│   app/api/super-admin/facilities/route.ts               │
└─────────────────────┬───────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│ Domain (재사용 가능 인프라)                                │
│   lib/report/                                            │
│     ├─ template-loader.ts                                │
│     ├─ data-resolver.ts                                  │
│     ├─ html-renderer.tsx                                 │
│     ├─ pdf-renderer.ts (Puppeteer pool)                  │
│     └─ components/<Report*>.tsx                          │
└─────────────────────┬───────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│ Infrastructure                                            │
│   prisma/schema.prisma (3 신규/수정 모델)                 │
│   prisma/migrations/                                      │
└─────────────────────────────────────────────────────────┘
```

### 9.2 Dependency Rules

- Presentation → API → Domain → Infrastructure (단방향)
- Domain은 Infrastructure(Prisma client)는 직접 import 가능
- Presentation은 Domain의 React 컴포넌트를 import 가능 (미리보기 iframe 동일 마크업)

### 9.3 File Import Rules

```
✅ allowed
  app/api/reports/* → lib/report/*
  app/(admin)/* → components/*, lib/report/components/*
  lib/report/* → @prisma/client

❌ forbidden
  lib/report/* → app/* (역방향)
  app/(admin)/* → puppeteer (서버 코드 직접 import)
```

### 9.4 This Feature's Layer Assignment

| File | Layer |
|------|-------|
| `_daily-treatment-tab.tsx` | Presentation |
| `_facilities-tab.tsx` | Presentation |
| `app/api/reports/daily-treatment/route.ts` | API |
| `app/api/reports/daily-treatment/pdf/route.ts` | API (Puppeteer 호출 격리) |
| `lib/report/pdf-renderer.ts` | Domain (Puppeteer wrapper) |
| `lib/report/html-renderer.tsx` | Domain |
| `lib/report/components/Report*.tsx` | Domain |
| `prisma/schema.prisma` | Infrastructure |

---

## 10. Coding Convention Reference

### 10.1 Naming Conventions

- File: `_kebab-case.tsx` (private client components, 기존 패턴)
- Component: `PascalCase`
- API route: `route.ts` (Next.js 표준)
- DB column: `snake_case` (Prisma `@map`)
- spec JSON keys: `camelCase`

### 10.2 Import Order

(기존 프로젝트 ESLint 룰 따름 — react/next 우선, prisma·lib 다음, 상대경로 마지막)

### 10.3 Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PUPPETEER_EXECUTABLE_PATH` | (auto) | 시스템 Chromium 경로 (Docker용) |
| `PDF_RENDER_TIMEOUT_MS` | 10000 | Puppeteer page timeout |
| `PDF_BROWSER_POOL_SIZE` | 2 | 동시 인스턴스 풀 사이즈 |

### 10.4 This Feature's Conventions

- spec JSON 파일은 `prisma/seeds/report-templates/F-02.json`에 시드 보관
- React 컴포넌트는 모두 server-only (`"use server"` 지시어 또는 server component)
- iframe 미리보기는 `<iframe srcDoc={html}>` 패턴 (동일 출처 보안)

---

## 11. Implementation Guide

### 11.1 File Structure

```
prisma/
  schema.prisma                                [수정]
  seeds/report-templates/F-02.json              [신규]
  migrations/{ts}_add_treatment_facility/       [신규 자동 생성]

lib/report/                                     [신규 폴더]
  template-loader.ts
  data-resolver.ts
  html-renderer.tsx
  pdf-renderer.ts
  spec-types.ts
  components/
    ReportPage.tsx
    ReportHeader.tsx
    ReportSummaryCards.tsx
    ReportTable.tsx
    ReportFooter.tsx

components/forms/
  FacilitySelect.tsx                            [신규]

app/api/super-admin/facilities/
  route.ts                                      [신규]
  [id]/route.ts                                 [신규]

app/api/reports/daily-treatment/
  route.ts                                      [신규]
  pdf/route.ts                                  [신규]

app/(admin)/super-admin/
  _super-admin-client.tsx                       [수정 — 탭 추가]
  facilities/
    _facilities-tab.tsx                         [신규]

app/(admin)/reports/
  _reports-client.tsx                           [수정 — 탭 추가]
  daily-treatment/
    _daily-treatment-tab.tsx                    [신규]

app/(admin)/performance/
  _performance-client.tsx                       [수정 — 드롭다운 + PDF 버튼 추가]

tests/e2e/
  f02-daily-treatment.spec.ts                   [신규]
```

### 11.2 Implementation Order

1. Prisma 스키마 변경 + 마이그레이션 적용
2. `lib/report/spec-types.ts` 타입 정의 (spec JSON 인터페이스)
3. `lib/report/components/Report*.tsx` 5개 컴포넌트 (스토리북 없이 미리보기 페이지로 검증)
4. `lib/report/{template-loader, data-resolver, html-renderer, pdf-renderer}.ts`
5. `app/api/super-admin/facilities/route.ts` + `[id]/route.ts`
6. `app/(admin)/super-admin/facilities/_facilities-tab.tsx` + 슈퍼관리자 탭 등록
7. `components/forms/FacilitySelect.tsx`
8. `/performance` 폼에 FacilitySelect 통합 + 기존 회귀 확인
9. `prisma/seeds/report-templates/F-02.json` 시드 등록 + 시드 스크립트 실행
10. `app/api/reports/daily-treatment/route.ts` (JSON)
11. `app/api/reports/daily-treatment/pdf/route.ts` (PDF)
12. `app/(admin)/reports/daily-treatment/_daily-treatment-tab.tsx` + 보고서 탭 등록
13. `/performance` 일자별 카드에 PDF 출력 버튼 통합
14. AuditLog 기록 적용
15. E2E 테스트 작성 + 실행

### 11.3 Session Guide

#### Module Map

| Module Key | Description | Files | Estimated Effort |
|------------|-------------|-------|------------------|
| `module-1-schema` | Prisma 모델 + 마이그레이션 + seed | schema.prisma, migrations/, seeds/F-02.json | 0.5일 |
| `module-2-renderer-core` | lib/report (template-loader, data-resolver, html-renderer, pdf-renderer) + spec types | lib/report/*.ts | 2일 |
| `module-3-renderer-components` | lib/report/components/Report*.tsx 5개 | lib/report/components/* | 1.5일 |
| `module-4-facility-master` | 처리시설 마스터 API + UI + FacilitySelect | api/super-admin/facilities/, super-admin/facilities/, components/forms/FacilitySelect.tsx | 1.5일 |
| `module-5-performance-integration` | /performance 폼 통합 + PDF 버튼 | (admin)/performance/_performance-client.tsx | 0.5일 |
| `module-6-report-api` | F-02 JSON + PDF API | api/reports/daily-treatment/* | 1일 |
| `module-7-report-ui` | /reports 탭 + 미리보기 iframe | (admin)/reports/daily-treatment/* | 1일 |
| `module-8-audit-test` | AuditLog 기록 + E2E 테스트 | tests/e2e/f02-*.spec.ts | 1일 |

**Total**: 9일

#### Recommended Session Plan

| Session | Modules | Goal |
|---------|---------|------|
| Session 1 | module-1-schema | DB 스키마 안정화 — 후속 작업의 전제 |
| Session 2 | module-2-renderer-core, module-3-renderer-components | 재사용 인프라 완성 — 가장 큰 단위 |
| Session 3 | module-4-facility-master, module-5-performance-integration | 처리시설 마스터 통합 (회귀 테스트 포함) |
| Session 4 | module-6-report-api, module-7-report-ui | F-02 first reference implementation |
| Session 5 | module-8-audit-test | 감사로그 + E2E |

`/pdca do f02-daily-treatment-report --scope module-1-schema` 형태로 세션별 진행 권장.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-27 | 초안 — Option B 채택, ReportTemplate + spec JSON 인프라 도입 | 4365won@gmail.com |
| 0.2 | 2026-04-27 | design-validator 6개 이슈 패치: FR-08 UI 시안 추가(§5.1.2), spec↔API 매핑 표(§3.4.0), Visual Regression 시나리오(§8.4), `facility_not_configured` 에러(§6.1), enum 모순 해소(§3.1.1·§3.3), MUNI_ADMIN RBAC 명세(§7.1) | 4365won@gmail.com |
