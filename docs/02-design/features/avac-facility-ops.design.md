# avac-facility-ops Design Document

> **Summary**: Prisma `FacilityDailyOps` 모델 추가 + API 2파일 + `_super-admin-client.tsx` 인라인 탭으로 Streamlit 07 AVAC 운전기록 기능을 PWA에 이식한다.
>
> **Project**: waste-erp
> **Version**: 0.1.0-alpha.1
> **Author**: 4365won@gmail.com
> **Date**: 2026-05-04
> **Status**: Draft
> **Selected Architecture**: Option A — Minimal (인라인)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | Streamlit `07_시설운영.py`의 AVAC 일일운전기록이 PWA에 없어 두 앱 병행 운영 중 — Streamlit 07 폐기 조건 충족이 목표 |
| **WHO** | SUPER_ADMIN(전체 조회·입력), CONTRACTOR_ADMIN(자기 업체 시설만) |
| **RISK** | Prisma 마이그레이션 → DB 적용 필수 / `WasteTreatmentFacility`에 relation 1개 추가 (기존 컬럼 불변) / `_super-admin-client.tsx` 2500줄 이상 증가 허용 |
| **SUCCESS** | upsert 왕복 + 기간 조회 + Excel 다운로드 + 403 권한 차단 + tsc 오류 없음 + e2e 회귀 없음 |
| **SCOPE** | Prisma 1모델 + API route 2파일 + `_super-admin-client.tsx` 인라인 탭(3 서브탭) |

---

## 1. Overview

### 1.1 Purpose

`FacilityDailyOps` Prisma 모델로 AVAC 운전기록을 PWA DB에 저장하고, super-admin 콘솔 `facility-ops` 탭에서 입력·조회·Excel 출력까지 완결한다.

### 1.2 Selected Architecture

**Option A — Minimal**: 탭 UI 코드를 `_super-admin-client.tsx`에 인라인으로 추가. API 라우트 2파일은 신규 생성.

| 파일 | 변경 |
|---|---|
| `prisma/schema.prisma` | `FacilityDailyOps` 모델 + `WasteTreatmentFacility` relation 추가 |
| `prisma/migrations/` | 자동 생성 |
| `app/api/super-admin/facility-ops/route.ts` | 신규 — GET + POST |
| `app/api/super-admin/facility-ops/export/route.ts` | 신규 — GET → .xlsx |
| `app/(admin)/super-admin/_super-admin-client.tsx` | `SuperTab` 확장 + 탭 버튼 + 탭 렌더 + `FacilityOpsTab` 함수 인라인 추가 |

---

## 2. Data Model

### 2.1 FacilityDailyOps Prisma 모델

```prisma
model FacilityDailyOps {
  id                 BigInt   @id @default(autoincrement())
  facilityId         BigInt   @map("facility_id")
  opsDate            DateTime @map("ops_date") @db.Date
  generalOpHours     Decimal  @default(0) @map("general_op_hours")     @db.Decimal(5,2)
  foodOpHours        Decimal  @default(0) @map("food_op_hours")        @db.Decimal(5,2)
  downtimeHours      Decimal  @default(0) @map("downtime_hours")       @db.Decimal(5,2)
  downtimeReason     String?  @map("downtime_reason")                  @db.VarChar(200)
  generalWasteTon    Decimal  @default(0) @map("general_waste_ton")    @db.Decimal(8,3)
  foodWasteTon       Decimal  @default(0) @map("food_waste_ton")       @db.Decimal(8,3)
  generalCollectTon  Decimal  @default(0) @map("general_collect_ton")  @db.Decimal(8,3)
  foodCollectTon     Decimal  @default(0) @map("food_collect_ton")     @db.Decimal(8,3)
  generalTransferTon Decimal  @default(0) @map("general_transfer_ton") @db.Decimal(8,3)
  foodTransferTon    Decimal  @default(0) @map("food_transfer_ton")    @db.Decimal(8,3)
  prevDayPowerKwh    Decimal  @default(0) @map("prev_day_power_kwh")   @db.Decimal(10,2)
  notes              String?  @db.Text
  createdBy          BigInt?  @map("created_by")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  facility WasteTreatmentFacility @relation(fields: [facilityId], references: [id])
  creator  User?                  @relation("FacilityOpsCreator", fields: [createdBy], references: [id])

  @@unique([facilityId, opsDate])
  @@index([opsDate])
  @@map("facility_daily_ops")
}
```

`WasteTreatmentFacility` 모델에 역관계 1줄 추가:

```prisma
dailyOps FacilityDailyOps[]
```

`User` 모델에 역관계 1줄 추가:

```prisma
facilityOpsCreated FacilityDailyOps[] @relation("FacilityOpsCreator")
```

### 2.2 Streamlit 컬럼 매핑

| Streamlit(`FacilityDailyOpsORM`) | Prisma 필드 | Excel 헤더 |
|---|---|---|
| `general_op_hours` | `generalOpHours` | 일반가동(h) |
| `food_op_hours` | `foodOpHours` | 음식가동(h) |
| `downtime_hours` | `downtimeHours` | 비가동(h) |
| `general_waste_ton` | `generalWasteTon` | 일반처리(t) |
| `food_waste_ton` | `foodWasteTon` | 음식처리(t) |
| `general_collect_ton` | `generalCollectTon` | 일반수거(t) |
| `food_collect_ton` | `foodCollectTon` | 음식수거(t) |
| `general_transfer_ton` | `generalTransferTon` | 일반반출(t) |
| `food_transfer_ton` | `foodTransferTon` | 음식반출(t) |
| `prev_day_power_kwh` | `prevDayPowerKwh` | 전일전력(kWh) |

---

## 3. API 설계

### 3.1 GET `/api/super-admin/facility-ops`

**권한**: SUPER_ADMIN, CONTRACTOR_ADMIN

**Query params**:
| 파라미터 | 타입 | 설명 |
|---|---|---|
| `facilityId` | string (optional) | 특정 시설 필터 |
| `from` | string `YYYY-MM-DD` | 조회 시작일 (required) |
| `to` | string `YYYY-MM-DD` | 조회 종료일 (required) |

**Response**:
```ts
{
  items: OpsRow[];
  total: number;
}
type OpsRow = {
  id: string;
  facilityId: string;
  facilityName: string;
  opsDate: string;        // YYYY-MM-DD
  generalOpHours: string; // Decimal → string (JSON serialization)
  foodOpHours: string;
  downtimeHours: string;
  downtimeReason: string | null;
  generalWasteTon: string;
  foodWasteTon: string;
  generalCollectTon: string;
  foodCollectTon: string;
  generalTransferTon: string;
  foodTransferTon: string;
  prevDayPowerKwh: string;
  notes: string | null;
  updatedAt: string;
}
```

**권한 분기**:
- SUPER_ADMIN: `facilityId` 없으면 지자체 내 전체 시설 (쿼리 없으면 첫 번째 시설)
- CONTRACTOR_ADMIN: session.contractorId로 municipalityId 조회 → 해당 지자체 시설만

**기간 제한**: `to - from > 90일`이면 400

---

### 3.2 POST `/api/super-admin/facility-ops`

**권한**: SUPER_ADMIN, CONTRACTOR_ADMIN

**Body (Zod schema)**:
```ts
const UpsertBody = z.object({
  facilityId: z.string(),
  opsDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generalOpHours: z.number().min(0).max(24).default(0),
  foodOpHours: z.number().min(0).max(24).default(0),
  downtimeHours: z.number().min(0).max(24).default(0),
  downtimeReason: z.string().max(200).optional(),
  generalWasteTon: z.number().min(0).default(0),
  foodWasteTon: z.number().min(0).default(0),
  generalCollectTon: z.number().min(0).default(0),
  foodCollectTon: z.number().min(0).default(0),
  generalTransferTon: z.number().min(0).default(0),
  foodTransferTon: z.number().min(0).default(0),
  prevDayPowerKwh: z.number().min(0).default(0),
  notes: z.string().max(1000).optional(),
});
```

**동작**: `prisma.facilityDailyOps.upsert({ where: { facilityId_opsDate }, update: {...}, create: {...} })`

**감사 로그**: `writeAudit(req, session, { action: 'facility_ops_upsert', targetId: facilityId, note: opsDate })`

**Response**: `{ item: OpsRow }`

**CONTRACTOR_ADMIN 접근 제어**: facilityId의 municipality가 session contractor의 municipality와 다르면 403

---

### 3.3 GET `/api/super-admin/facility-ops/export`

**권한**: SUPER_ADMIN, CONTRACTOR_ADMIN

**Query params**: `facilityId?`, `from`, `to` (GET과 동일, 90일 제한)

**동작**:
1. GET과 동일한 데이터 쿼리
2. `exceljs.Workbook` 생성
3. 시트명: `운전기록_YYYY-MM-DD_~_YYYY-MM-DD`
4. 1행: 헤더 (집하장 / 운영일자 / 일반가동(h) / 음식가동(h) / 비가동(h) / 일반처리(t) / 음식처리(t) / 일반수거(t) / 음식수거(t) / 일반반출(t) / 음식반출(t) / 전일전력(kWh))
5. 2행~: 데이터 행 (Decimal → Number 변환)
6. `workbook.xlsx.writeBuffer()` → `Buffer`

**Response Headers**:
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="facility_ops_YYYYMMDD.xlsx"
```

---

## 4. UI 설계

### 4.1 탭 추가 위치

`_super-admin-client.tsx` 수정 3개 포인트:

**① `SuperTab` 타입 확장**:
```ts
type SuperTab = ... | 'facility-ops';
```

**② 탭 버튼** (`facilities` 탭 바로 다음):
```tsx
<Tab active={tab === 'facility-ops'} onClick={() => setTab('facility-ops')}>🏭 시설 운전기록</Tab>
```

**③ 탭 렌더**:
```tsx
{tab === 'facility-ops' && <FacilityOpsTab />}
```

---

### 4.2 FacilityOpsTab 구조

파일 하단 (기존 탭 함수들 다음)에 인라인 추가:

```
FacilityOpsTab()
  └─ 3 서브탭 버튼 (운전기록 입력 | 집계 현황 | 출력)
  └─ subTab === 'record'   → <RecordSubtab />
  └─ subTab === 'summary'  → <SummarySubtab />
  └─ subTab === 'export'   → <ExportSubtab />
```

**내부 서브탭 컴포넌트** (모두 `FacilityOpsTab` 스코프 내 중첩 함수로 정의):

#### RecordSubtab — 운전기록 입력

```
[시설 선택 ▼] [날짜 <input type=date>] [조회] 버튼
─────────────────────────────────────────
수치 입력 폼 (grid 2열):
  일반가동(h) | 음식가동(h)
  비가동(h)   | 비가동 사유
  일반처리(t) | 음식처리(t)
  일반수거(t) | 음식수거(t)
  일반반출(t) | 음식반출(t)
  전일전력(kWh) | 비고
[저장] 버튼
─────────────────────────────────────────
최근 7일 이력 테이블 (조회만)
```

동작:
- 날짜 변경 시 `GET .../facility-ops?facilityId=X&from=date&to=date` 자동 조회 → 폼 pre-fill
- 저장 → `POST .../facility-ops` → 7일 이력 갱신

#### SummarySubtab — 집계 현황

```
[기간 from] ~ [기간 to]  [조회]
─────────────────────────────────────────
KPI 카드 5개 (grid):
  일반처리 합계(t) | 음식처리 합계(t) | 총 가동시간(h) | 전력 합계(kWh) | 기록 건수
─────────────────────────────────────────
상세 테이블 (날짜 오름차순):
  날짜 | 시설 | 일반처리 | 음식처리 | 가동시간 | 전력
```

클라이언트 집계: `GET .../facility-ops?from=X&to=Y` 응답 items에서 `reduce()`로 KPI 계산

#### ExportSubtab — Excel 출력

```
[시설 선택 ▼]  [from] ~ [to]
[Excel 다운로드 .xlsx] 버튼
```

다운로드: `window.open('/api/super-admin/facility-ops/export?...')` 또는 `<a href>` download 트리거

---

## 5. 권한 흐름

```
요청자 role      | GET 범위                          | POST 허용
─────────────────┼───────────────────────────────────┼──────────────
SUPER_ADMIN      | 전체 시설 (facilityId 없으면 전체) | ✅
CONTRACTOR_ADMIN | session contractor의 municipality  | ✅ (본인 시설만)
MUNI_ADMIN       | ❌ 403                             | ❌ 403
WORKER           | ❌ 403                             | ❌ 403
미인증            | ❌ 401                             | ❌ 401
```

---

## 6. 타입 정의

`_super-admin-client.tsx` 상단부에 타입 추가:

```ts
type OpsRecord = {
  id: string;
  facilityId: string;
  facilityName: string;
  opsDate: string;
  generalOpHours: string;
  foodOpHours: string;
  downtimeHours: string;
  downtimeReason: string | null;
  generalWasteTon: string;
  foodWasteTon: string;
  generalCollectTon: string;
  foodCollectTon: string;
  generalTransferTon: string;
  foodTransferTon: string;
  prevDayPowerKwh: string;
  notes: string | null;
  updatedAt: string;
};
```

---

## 7. 에러 처리

| 상황 | 처리 |
|---|---|
| 기간 90일 초과 | API 400 → UI에서 사전 체크 후 버튼 비활성 |
| CONTRACTOR_ADMIN 타 업체 시설 | API 403 → alert('접근 권한이 없습니다') |
| Excel 생성 실패 | API 500 → alert('Excel 생성 중 오류가 발생했습니다') |
| upsert 성공 | 토스트 메시지 '운전기록이 저장되었습니다' + 7일 이력 갱신 |

---

## 8. 테스트 계획

| 시나리오 | 검증 방법 |
|---|---|
| POST upsert 신규 | REST: 201 + DB 행 확인 |
| POST upsert 동일 facility+date | REST: 200 + DB 행 UPDATE 확인 |
| GET 기간 조회 | REST: 200 + items 배열 반환 |
| GET 90일 초과 | REST: 400 |
| CONTRACTOR_ADMIN 타 업체 시설 POST | REST: 403 |
| Excel 다운로드 | 브라우저에서 .xlsx 저장 확인 + 헤더 12개 검증 |
| tsc --noEmit | 오류 없음 |
| e2e 회귀 | `pnpm playwright test` 5 spec PASS |

---

## 9. 구현 순서 (단일 세션)

```
Module-1: Prisma 모델
  1. schema.prisma — FacilityDailyOps 모델 추가
  2. WasteTreatmentFacility + User 역관계 추가
  3. prisma migrate dev --name avac_facility_ops

Module-2: API
  4. app/api/super-admin/facility-ops/route.ts — GET + POST
  5. app/api/super-admin/facility-ops/export/route.ts — GET → .xlsx

Module-3: UI (인라인)
  6. _super-admin-client.tsx
     a. SuperTab 타입 확장 ('facility-ops' 추가)
     b. OpsRecord 타입 추가
     c. 탭 버튼 추가 (facilities 다음)
     d. 탭 렌더 추가
     e. FacilityOpsTab 함수 + 3 서브탭 인라인 추가

Module-4: 검증
  7. tsc --noEmit
  8. e2e 회귀 실행
```

---

## 10. 변경 라인 예측

| 파일 | 예상 줄수 |
|---|---|
| `prisma/schema.prisma` | +30 |
| `facility-ops/route.ts` (신규) | ~120 |
| `facility-ops/export/route.ts` (신규) | ~80 |
| `_super-admin-client.tsx` | +350~400 |
| **합계** | **~580~630 라인** |

> Plan 기준 ≤500 라인 대비 약 80~130줄 초과 예상. 인라인 방식의 트레이드오프. 허용 범위로 판단.

---

## 11. Implementation Guide

### 11.1 주요 패턴 참조

- 권한 체크: `facilities/route.ts`의 `visibleMunicipalityIds()` 패턴 동일하게 `visibleFacilityIds()` 구현
- Decimal 직렬화: `String(record.generalOpHours)` — Prisma Decimal은 JSON 직렬화 안 됨
- Excel: `exceljs.Workbook` → `sheet.addRow()` → `workbook.xlsx.writeBuffer()` → `Buffer` → `new Response(buffer, { headers })`
- 감사 로그: `writeAudit(req, session, { action: 'facility_ops_upsert', targetId: String(facilityId), note: opsDate })`

### 11.2 코드 주석 컨벤션

```ts
// Design Ref: §3.2 — facility_ops_upsert, CONTRACTOR_ADMIN 시설 접근 403
// Plan SC: FR-02 (upsert), FR-04 (권한 분기)
```

### 11.3 Session Guide

| Module | 예상 시간 | 의존성 |
|---|---|---|
| Module-1: Prisma 모델 | 10분 | 없음 |
| Module-2: API 2파일 | 30분 | Module-1 완료 후 |
| Module-3: UI 인라인 | 40분 | Module-2 완료 후 (타입 import) |
| Module-4: 검증 | 15분 | Module-3 완료 후 |

전체 1세션 (~95분) 완결 목표.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-05-04 | 초안 — Option A 선택, 인라인 구현 설계 | 4365won@gmail.com |
