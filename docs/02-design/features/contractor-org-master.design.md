# contractor-org-master Design Document

> **Summary**: `ContractorPosition` + `ContractorRank` 업체별 모델 신설, API 4개, `_org-settings-tab.tsx` 신규 탭 파일, `/users` 탭 연결, 마이그레이션.
>
> **Project**: waste-erp
> **Version**: 0.1.0-alpha.1
> **Author**: 4365won@gmail.com
> **Date**: 2026-05-04
> **Status**: Draft
> **Selected Architecture**: Option C — Pragmatic (별도 탭 파일 + /users 연결)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 전역 `Position`으로 업체 간 직책 공유 버그 + `rank` 자유문자열로 직급 커스터마이징 불가 |
| **WHO** | CONTRACTOR_ADMIN(자사 CRUD), SUPER_ADMIN(?contractorId 전체 관리) |
| **RISK** | User.positionId 마이그레이션(전역 Position FK → ContractorPosition FK) + User.rank String enum → rankId FK + 전역 Position/ApprovalPolicy 의존 코드 무변경 유지 |
| **SUCCESS** | admin 자사 직책 추가 → 사용자 편집 즉시 반영 + 타 업체 403 + 사용 중 비활성화 409 + tsc 오류 없음 |
| **SCOPE** | ContractorPosition + ContractorRank 모델 + API 4개 + `_org-settings-tab.tsx` + /users 탭 연결 + 사용자 편집 모달 교체 + 온보딩 seed + 마이그레이션 |

---

## 1. Overview

### 1.1 Selected Architecture

**Option C — Pragmatic**: `_org-settings-tab.tsx` 별도 파일로 직책·직급 관리 UI 격리. `_users-client.tsx`는 탭 연결 15줄만 추가. API는 기존 `/api/contractor/` 패턴 하위에 신설.

---

## 2. Data Model

### 2.1 ContractorPosition

```prisma
// Design Ref: §2.1 — 업체별 직책 마스터. 전역 Position과 독립 운영.
// Plan SC: FR-01
model ContractorPosition {
  id           BigInt   @id @default(autoincrement())
  contractorId BigInt   @map("contractor_id")
  name         String   @db.VarChar(50)
  category     String   @db.VarChar(10)  // MANAGER | FIELD | ADMIN
  sortOrder    Int      @default(0)       @map("sort_order")
  active       Boolean  @default(true)
  createdBy    BigInt?  @map("created_by")
  createdAt    DateTime @default(now())   @map("created_at")
  updatedAt    DateTime @updatedAt        @map("updated_at")

  contractor Contractor @relation(fields: [contractorId], references: [id])
  creator    User?      @relation("ContractorPositionCreator", fields: [createdBy], references: [id])
  users      User[]     @relation("UserContractorPosition")

  @@unique([contractorId, name])
  @@index([contractorId, active])
  @@map("contractor_positions")
}
```

### 2.2 ContractorRank

```prisma
// Plan SC: FR-02
model ContractorRank {
  id           BigInt   @id @default(autoincrement())
  contractorId BigInt   @map("contractor_id")
  name         String   @db.VarChar(50)
  level        Int      @default(99)     // 낮을수록 상위 (1=최고)
  sortOrder    Int      @default(0)       @map("sort_order")
  active       Boolean  @default(true)
  createdBy    BigInt?  @map("created_by")
  createdAt    DateTime @default(now())   @map("created_at")
  updatedAt    DateTime @updatedAt        @map("updated_at")

  contractor Contractor @relation(fields: [contractorId], references: [id])
  creator    User?      @relation("ContractorRankCreator", fields: [createdBy], references: [id])
  users      User[]     @relation("UserContractorRank")

  @@unique([contractorId, name])
  @@index([contractorId, active])
  @@map("contractor_ranks")
}
```

### 2.3 User 모델 변경 (신규 FK 추가)

```prisma
// 기존 positionId(전역 Position) + rank(String) 유지 — 병행
contractorPositionId  BigInt?  @map("contractor_position_id")  // 신규 nullable FK
rankId                BigInt?  @map("rank_id")                  // 신규 nullable FK

contractorPosition  ContractorPosition? @relation("UserContractorPosition", fields: [contractorPositionId], references: [id])
contractorRank      ContractorRank?     @relation("UserContractorRank", fields: [rankId], references: [id])
```

### 2.4 Contractor 역관계 추가

```prisma
contractorPositions ContractorPosition[]
contractorRanks     ContractorRank[]
```

### 2.5 마이그레이션 전략

**기존 데이터 이전 로직** (DB push 후 별도 스크립트):

```
1. 각 contractor의 기존 User.positionId → Position.label 조회
2. ContractorPosition(contractor_id, name=label) upsert
3. User.contractorPositionId = 생성된 ContractorPosition.id
4. User.rank(String) → ContractorRank(name=rank) upsert
5. User.rankId = 생성된 ContractorRank.id
```

매핑 실패 시 NULL 허용 (기존 positionId/rank 유지).

---

## 3. 기본 직책·직급 시드 상수

```ts
// lib/org-defaults.ts (신규)
export const DEFAULT_POSITIONS = [
  { name: '대표', category: 'ADMIN', sortOrder: 1 },
  { name: '이사', category: 'ADMIN', sortOrder: 2 },
  { name: '팀장', category: 'MANAGER', sortOrder: 3 },
  { name: '반장', category: 'MANAGER', sortOrder: 4 },
  { name: '기사', category: 'FIELD', sortOrder: 5 },
  { name: '환경미화원', category: 'FIELD', sortOrder: 6 },
  { name: '사무원', category: 'ADMIN', sortOrder: 7 },
  { name: '현장소장', category: 'MANAGER', sortOrder: 8 },
] as const;

export const DEFAULT_RANKS = [
  { name: '1급', level: 1, sortOrder: 1 },
  { name: '2급', level: 2, sortOrder: 2 },
  { name: '3급', level: 3, sortOrder: 3 },
  { name: '4급', level: 4, sortOrder: 4 },
  { name: '5급', level: 5, sortOrder: 5 },
] as const;
```

---

## 4. API 설계

### 4.1 GET/POST `/api/contractor/positions`

**권한**: CONTRACTOR_ADMIN(자사), SUPER_ADMIN(?contractorId)

**GET Query**: `?active=true|all` (기본 active=true)

**GET Response**:
```ts
{ positions: PositionRow[] }
type PositionRow = {
  id: string; name: string; category: string;
  sortOrder: number; active: boolean; userCount: number;
}
```

**POST Body (Zod)**:
```ts
z.object({
  name: z.string().min(1).max(50),
  category: z.enum(['MANAGER', 'FIELD', 'ADMIN']),
  sortOrder: z.number().int().min(0).max(999).default(900),
})
```

**POST 동작**:
- 같은 contractor 내 name 중복 시 409
- `writeAudit({ action: 'contractor_position_create', resourceType: 'contractor_position' })`

---

### 4.2 PATCH `/api/contractor/positions/[id]`

**권한**: CONTRACTOR_ADMIN(자사 소유 확인), SUPER_ADMIN

**PATCH Body**:
```ts
z.object({
  name: z.string().min(1).max(50).optional(),
  category: z.enum(['MANAGER', 'FIELD', 'ADMIN']).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  active: z.boolean().optional(),
})
```

**비활성화 제약**: `active: false` 요청 시 `User.contractorPositionId` 참조 수 확인 → 1명 이상이면 409 반환 (`{ error: 'in_use', userCount: N }`)

---

### 4.3 GET/POST `/api/contractor/ranks`

구조 동일 (`ContractorRank` 대상). POST Body에 `level: number` 추가.

```ts
z.object({
  name: z.string().min(1).max(50),
  level: z.number().int().min(1).max(99).default(99),
  sortOrder: z.number().int().min(0).max(999).default(900),
})
```

---

### 4.4 PATCH `/api/contractor/ranks/[id]`

구조 동일. 비활성화 시 `User.rankId` 참조 수 확인 → 409.

---

### 4.5 POST `/api/contractor/positions/seed` (온보딩 전용)

**권한**: SUPER_ADMIN, CONTRACTOR_ADMIN (신규 업체 자동 호출용)

**Body**: `{ contractorId?: string }` (SUPER_ADMIN 전용 override)

**동작**: `DEFAULT_POSITIONS` + `DEFAULT_RANKS`를 해당 contractor에 upsert.

---

### 4.6 `PUT /api/users/[id]` 확장

기존 `positionCode` 파라미터 유지 + 신규 파라미터 추가:
```ts
contractorPositionId: z.string().nullable().optional(),
rankId: z.string().nullable().optional(),
```

---

## 5. 파일 구조

```
app/(admin)/users/
  _users-client.tsx              ← 수정: 탭 타입 + 버튼 + 렌더 +15줄
  _org-settings-tab.tsx          ← 신규 ~300줄

app/api/contractor/
  info/route.ts                  ← 기존 (변경 없음)
  positions/
    route.ts                     ← 신규 GET+POST
    [id]/route.ts                ← 신규 PATCH
    seed/route.ts                ← 신규 POST (온보딩)
  ranks/
    route.ts                     ← 신규 GET+POST
    [id]/route.ts                ← 신규 PATCH

lib/
  org-defaults.ts                ← 신규 상수

prisma/schema.prisma             ← 수정: 2 모델 추가 + User FK 2개 + Contractor 역관계
app/(admin)/super-admin/
  _onboarding-wizard.tsx         ← 수정: 완료 시 seed API 호출
```

---

## 6. UI 설계 — `_org-settings-tab.tsx`

```
OrgSettingsTab
  └─ 2 서브탭: [직책 관리] [직급 관리]
  
  직책 관리 서브탭:
    [+직책 추가] 버튼 → 인라인 폼 (name, category, sortOrder)
    테이블: 이름 | 구분 | 순서 | 사용자수 | 상태 | [수정] [비활성화]
    
  직급 관리 서브탭:
    [+직급 추가] 버튼 → 인라인 폼 (name, level, sortOrder)
    테이블: 이름 | 급수(level) | 순서 | 사용자수 | 상태 | [수정] [비활성화]
```

---

## 7. `_users-client.tsx` 변경 요점

**① 타입 확장**:
```ts
type UserTab = 'register' | 'profile' | 'leave' | 'calendar' | 'report' | 'org' | 'org-settings';
```

**② 탭 버튼** (`'org'` 탭 다음):
```tsx
{canManage && (
  <TabButton active={tab === 'org-settings'} onClick={() => setTab('org-settings')}>
    조직 설정
  </TabButton>
)}
```

**③ 탭 렌더**:
```tsx
{tab === 'org-settings' && <OrgSettingsTab />}
```

**④ 사용자 편집 모달** — `contractorPositionId` + `rankId` 선택 필드 추가 (기존 `positionCode` 선택 유지, 병행).

---

## 8. 권한 흐름

```
요청자 role        | GET 범위                    | POST/PATCH
──────────────────┼─────────────────────────────┼──────────────────
SUPER_ADMIN        | ?contractorId 또는 전체     | ✅ (contractorId override)
CONTRACTOR_ADMIN   | 본인 contractor만           | ✅ (본인만)
INTERNAL_ADMIN     | 본인 contractor (읽기)      | ❌ 403
MUNI_ADMIN/WORKER  | ❌ 403                      | ❌ 403
```

---

## 9. 테스트 계획

| 시나리오 | 검증 |
|---|---|
| POST 직책 추가 | 201 + DB 행 + contractor 격리 |
| POST 동일 이름 중복 | 409 |
| CONTRACTOR_ADMIN 타 업체 직책 접근 | 403 |
| 사용 중인 직책 비활성화 | 409 + userCount |
| 온보딩 seed | 8직책 + 5직급 생성 |
| 사용자 편집 → contractorPositionId 저장 | User 테이블 반영 |
| tsc --noEmit | 오류 없음 |
| e2e 회귀 | 115 passed |

---

## 10. 마이그레이션 스크립트 (`lib/migrate-org-data.ts`)

```ts
// 기존 User.positionId(전역) → contractorPositionId(업체별) 이전
export async function migrateOrgData() {
  const users = await prisma.user.findMany({
    where: { positionId: { not: null } },
    include: { position: true, contractor: { select: { id: true } } },
  });
  for (const u of users) {
    if (!u.position || !u.contractorId) continue;
    const cp = await prisma.contractorPosition.upsert({
      where: { contractorId_name: { contractorId: u.contractorId, name: u.position.label } },
      update: {},
      create: {
        contractorId: u.contractorId,
        name: u.position.label,
        category: u.position.category === 'OFFICE' ? 'ADMIN' : u.position.category,
        sortOrder: u.position.sortOrder,
      },
    });
    await prisma.user.update({
      where: { id: u.id },
      data: { contractorPositionId: cp.id },
    });
  }
  // User.rank(String) → rankId 이전
  const usersWithRank = await prisma.user.findMany({
    where: { rank: { not: null }, contractorId: { not: null } },
  });
  for (const u of usersWithRank) {
    if (!u.rank || !u.contractorId) continue;
    const cr = await prisma.contractorRank.upsert({
      where: { contractorId_name: { contractorId: u.contractorId, name: u.rank } },
      update: {},
      create: { contractorId: u.contractorId, name: u.rank, level: 99 },
    });
    await prisma.user.update({ where: { id: u.id }, data: { rankId: cr.id } });
  }
}
```

---

## 11. Implementation Guide

### 11.1 주요 패턴 참조

- 권한 체크: `/api/contractor/info/route.ts` — `session.contractorId` 기반 격리 패턴
- 비활성화 409: `prisma.user.count({ where: { contractorPositionId: id } })` 확인 후 조건 분기
- 감사 로그: `writeAudit(req, session, { action: 'contractor_position_create', resourceType: 'contractor_position', resourceId: String(id) })`

### 11.2 코드 주석 컨벤션

```ts
// Design Ref: §2.1 — ContractorPosition 업체별 격리, 전역 Position과 독립
// Plan SC: FR-01 (모델), FR-05 (비활성화 409)
```

### 11.3 Session Guide

| Module | 예상 시간 | 의존성 |
|---|---|---|
| Module-1: Prisma 모델 + db push | 15분 | 없음 |
| Module-2: `lib/org-defaults.ts` + API 6개 | 40분 | Module-1 완료 후 |
| Module-3: `_org-settings-tab.tsx` + `/users` 탭 연결 | 30분 | Module-2 완료 후 |
| Module-4: 사용자 편집 모달 contractorPositionId/rankId 추가 | 20분 | Module-2 완료 후 |
| Module-5: 온보딩 wizard seed + 마이그레이션 스크립트 | 20분 | Module-2 완료 후 |
| Module-6: 검증 (tsc + e2e) | 10분 | Module-3~5 완료 후 |

전체 1세션 (~135분) 완결 목표.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-05-04 | 초안 — Option C 선택, 업체별 직책·직급 설계 | 4365won@gmail.com |
