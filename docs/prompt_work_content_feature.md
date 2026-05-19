# 차량일지 작업내역 추가 구현 프롬프트

## 요청 요약

`app/worker/vehicle-log/_vehicle-log-client.tsx` 의 기존 차량일지 폼에 아래 변경을 적용한다.

1. **삭제**: Card 2 "주유 / 요소수"에서 요소수(L), 요소수금액(원) 필드 제거 → 카드 제목을 "주유" 로 변경
2. **삭제**: Card 3 "공공봉투 사용" 카드 전체 제거 (bags30L / bags50L / bags75L 필드 포함)
3. **추가**: 삭제된 위치(Card 2 주유 다음)에 아래 작업내역 3개 카드를 순서대로 삽입

---

## 사전 조건: 관리자 반입장소 설정

작업자가 입력하는 **반입장소** 옵션은 회사(CONTRACTOR_ADMIN)가 미리 설정한 목록만 사용할 수 있다.
관리자가 설정하지 않은 경우 작업자 폼에서 반입장소 선택이 비활성화되고
"관리자에게 반입장소 설정을 요청하세요." 안내문을 표시한다.

### 1) Prisma schema 추가

```prisma
// prisma/schema.prisma 에 추가

/// 반입장소 마스터 — CONTRACTOR_ADMIN이 사전 등록
model DisposalSite {
  id           BigInt     @id @default(autoincrement())
  contractorId BigInt     @map("contractor_id")
  name         String     @db.VarChar(50)   // 예: "매립지", "처리장", "소각장", "압축기", "연계작업"
  isActive     Boolean    @default(true) @map("is_active")
  sortOrder    Int        @default(0) @map("sort_order")

  contractor Contractor @relation(fields: [contractorId], references: [id], onDelete: Cascade)

  @@unique([contractorId, name])
  @@map("disposal_sites")
}
```

`Contractor` 모델에 역관계 추가:
```prisma
disposalSites DisposalSite[]
```

마이그레이션:
```bash
npx prisma migrate dev --name add_disposal_sites
```

### 2) 관리자 API (app/api/admin/disposal-sites/route.ts)

- `GET`  `/api/admin/disposal-sites` — 본인 contractorId 의 반입장소 목록 반환
- `POST` `/api/admin/disposal-sites` — 반입장소 추가 `{ name, sortOrder? }`
- `PATCH`/`DELETE` `/api/admin/disposal-sites/[id]` — 수정 / 삭제

접근 권한: `CONTRACTOR_ADMIN`, `INTERNAL_ADMIN`, `SUPER_ADMIN`

### 3) 관리자 UI

`app/(admin)/settings/disposal-sites/page.tsx` 신규 생성.
기존 admin 레이아웃 패턴을 그대로 따른다.
반입장소 목록 관리(추가·수정·삭제·정렬순서 변경) 화면.
초기 기본값으로 ["매립지", "처리장", "소각장", "압축기", "연계작업"] 5개를 제안 버튼으로 제공.

---

## 작업자 폼 변경 상세

### 파일: `app/worker/vehicle-log/page.tsx`

서버 컴포넌트에서 반입장소 목록 추가 조회 후 `VehicleLogClient` 에 prop으로 전달:

```ts
const disposalSites = await prisma.disposalSite.findMany({
  where: { contractorId: BigInt(session.contractorId), isActive: true },
  orderBy: { sortOrder: 'asc' },
  select: { id: true, name: true },
});
```

`VehicleLogClient` 에 `disposalSites: { id: string; name: string }[]` prop 추가.

---

### 파일: `app/worker/vehicle-log/_vehicle-log-client.tsx`

#### A) FormState 타입 변경

`ureaUsed`, `ureaCost`, `bags30L`, `bags50L`, `bags75L` 제거.

아래 타입 추가:

```ts
// 작업내역 1: 중량제봉투 및 음식물용기, 재활·자원 (단위: kg)
type BagWorkRow = {
  general: string;      // 일반
  food: string;         // 음식물류
  recycle: string;      // 재활·자원용
  disposalSiteId: string; // 반입장소 ID (DisposalSite.id)
};

// 작업내역 2: 중량계 및 봉투 수거량 기계 (단위: L)
type BagMachineWork = {
  food_1L: string;   food_2L: string;   food_3L: string;
  food_5L: string;   food_10L: string;
  living_5L: string; living_10L: string; living_20L: string;
  living_30L: string; living_50L: string; living_75L: string;
  reuse_10L: string; reuse_20L: string;
  illegal_20: string; // 무단투기 20기준
  special: string;    // 비고: 특수
  deadAnimal: string; // 비고: 동물사채(마대)
};

// 작업내역 3: 대형폐기물 (단위: 점)
type LargeWasteWork = {
  furniture: string;   // 가구류
  chair: string;       // 의자류
  sofa: string;        // 쇼파류
  bed: string;         // 침대류
  appliance: string;   // 가전제품
  extinguisher: string;// 소화기
  household: string;   // 생활용품
  other: string;       // 기타
  illegalTotal: string;// 무단투기물 수거량(총)
};
```

`FormState` 에 추가:
```ts
bagWork: [BagWorkRow, BagWorkRow, BagWorkRow]; // 1회·2회·3회
bagMachineWork: BagMachineWork;
largeWasteWork: LargeWasteWork;
```

`defaultForm()` 에서 초기값:
```ts
bagWork: [
  { general: '', food: '', recycle: '', disposalSiteId: '' },
  { general: '', food: '', recycle: '', disposalSiteId: '' },
  { general: '', food: '', recycle: '', disposalSiteId: '' },
],
bagMachineWork: {
  food_1L:'', food_2L:'', food_3L:'', food_5L:'', food_10L:'',
  living_5L:'', living_10L:'', living_20L:'', living_30L:'', living_50L:'', living_75L:'',
  reuse_10L:'', reuse_20L:'',
  illegal_20:'', special:'', deadAnimal:'',
},
largeWasteWork: {
  furniture:'', chair:'', sofa:'', bed:'', appliance:'',
  extinguisher:'', household:'', other:'', illegalTotal:'',
},
```

#### B) routeDetail JSON 에 저장

`submit()` 함수의 `routeDetail` JSON 에서 `ureaUsed`, `ureaCost`, `bags30L/50L/75L` 제거 후
아래 항목 추가:

```ts
bagWork: form.bagWork.map((row) => ({
  general: Number(row.general) || 0,
  food: Number(row.food) || 0,
  recycle: Number(row.recycle) || 0,
  disposalSiteId: row.disposalSiteId || null,
})),
bagMachineWork: Object.fromEntries(
  Object.entries(form.bagMachineWork).map(([k, v]) => [k, Number(v) || 0])
),
largeWasteWork: Object.fromEntries(
  Object.entries(form.largeWasteWork).map(([k, v]) => [k, Number(v) || 0])
),
```

---

#### C) UI 카드 배치 (Card 2 주유 다음, Card 4 차량점검 전)

---

**Card A: 작업내역 — 중량제봉투 및 음식물용기, 재활·자원 (단위: kg)**

표 형태로 3행(1회·2회·3회) + 합계행 렌더링.

| 회차 | 일반(kg) | 음식물류(kg) | 재활·자원용(kg) | 반입장소 |
|------|---------|------------|--------------|---------|
| 1회  | input   | input      | input        | select  |
| 2회  | input   | input      | input        | select  |
| 3회  | input   | input      | input        | select  |
| 계   | 자동합계 | 자동합계    | 자동합계      | —       |

- `일반`, `음식물류`, `재활·자원용`: `type="number" inputMode="numeric"` 정수 입력
- `반입장소`: `disposalSites` prop 이 비어있으면 disabled + "관리자 설정 필요" 표시
- `반입장소` select는 `<select>` 또는 바텀시트 picker 중 기존 폼 패턴에 맞춰 선택
- 합계행: `bagWork.reduce((s, r) => s + (Number(r.general)||0), 0)` 등으로 자동 계산
- 하단 주석: "※ 매회 처리 시 처리장 계근전표 기준으로 작성."

---

**Card B: 작업내역 — 중량계 및 봉투 수거량 기계 (단위: L)**

두 개 행 그룹 + 수거량 입력행:

**음식물종량제** (1 / 2 / 3 / 5 / 10L)
**생활폐기물 종량제** (5 / 10 / 20 / 30 / 50 / 75L)
**재사용** (10 / 20L)
**무단투기** (20기준)
**비고** — 특수 / 동물사채(마대) : 각각 숫자 입력

레이아웃: 용량 레이블을 상단, 수거량 입력을 하단으로 2행 배치.
모바일에서 가로 스크롤이 필요할 수 있으므로 `overflow-x-auto` 적용.

```
음식물종량제  |  1L  |  2L  |  3L  |  5L  | 10L  |
수거량(장)    | [ ]  | [ ]  | [ ]  | [ ]  | [ ]  |

생활폐기물    |  5L  | 10L  | 20L  | 30L  | 50L  | 75L  |
수거량(장)    | [ ]  | [ ]  | [ ]  | [ ]  | [ ]  | [ ]  |

재사용        | 10L  | 20L  |
수거량(장)    | [ ]  | [ ]  |

무단투기      | 20기준 |
수거량        |  [ ]   |

비고          | 특수 | 동물사채(마대) |
수량          | [ ]  |    [ ]        |
```

---

**Card C: 작업내역 — 대형폐기물 (단위: 점)**

그리드 입력:

| 가구류 | 의자류 | 쇼파류 | 침대류 | 가전제품 | 소화기 | 생활용품 | 기타 |
|-------|-------|-------|-------|---------|-------|---------|-----|
| [ ]   | [ ]   | [ ]   | [ ]   | [ ]     | [ ]   | [ ]     | [ ] |

하단: "무단투기물 수거량 (총): [ ] 점 (가구류 기준)"

모바일 `grid-cols-4 gap-2` 로 2행 배치.

---

## 요약 체크리스트

- [ ] `prisma/schema.prisma` — `DisposalSite` 모델 추가, `Contractor` 역관계 추가
- [ ] `npx prisma migrate dev --name add_disposal_sites`
- [ ] `app/api/admin/disposal-sites/route.ts` — CRUD API
- [ ] `app/(admin)/settings/disposal-sites/page.tsx` — 관리자 반입장소 설정 UI
- [ ] `app/worker/vehicle-log/page.tsx` — `disposalSites` 조회 및 prop 전달
- [ ] `_vehicle-log-client.tsx` — 타입, defaultForm, UI 카드 A·B·C, routeDetail 수정
  - 요소수(L/원) 필드 제거, Card 2 제목 "주유"로 변경
  - Card 3 "공공봉투 사용" 전체 제거
  - Card A·B·C 삽입 (기존 Card 4 차량점검 앞)
