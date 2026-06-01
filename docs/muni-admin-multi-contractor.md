# 지자체 관리자(MUNI_ADMIN) 멀티업체 통합 관리

> 작성일: 2026-06-01 | Phase 1 구현 완료

## 배경 및 목적

지자체는 산하에 2~20여 개의 위탁업체를 운용한다. 기존 시스템은 데이터 격리(municipalityId 자동 필터)는 완성되어 있었으나, 지자체 관리자가 **업체를 통합적으로 모니터링**하거나 **업체별 비교 현황**을 한눈에 볼 수 있는 UI가 부재했다.

---

## Phase 1 구현 내용 (2026-06-01)

### 1. 위탁업체 통합 현황판 (대시보드)

**파일**: `app/(admin)/dashboard/_muni-aggregate-panel.tsx`  
**진입점**: `app/(admin)/dashboard/page.tsx` — `MUNI_ADMIN` 역할일 때만 렌더링

#### 기능
- **업체 탭 필터**: 전체 통합 보기 / 개별 업체 선택
- **KPI 요약 카드** (전체 선택 시 상단 표시)
  - 총 인원 / 오늘 출근(출근율) / 미처리 민원 / 운행 차량 / 안전 보고
- **업체별 비교 테이블**
  - 컬럼: 업체명 / 총 인원 / 오늘 출근 / 출근율 / 미처리 민원 / 운행 차량 / 안전 보고
  - 출근율: 80% 이상 녹색, 60% 이상 황색, 미만 적색
  - 미처리 민원 / 안전 보고 > 0 시 황색 강조
  - 하단 합계 행 (전체 보기 시)
- **바로가기 링크**: 통합 보고서 / 관제모드 / 민원관리

#### 데이터 흐름
```
MuniAggregatePanel (client component)
  → GET /api/super-admin/contractors-aggregate?from=TODAY&to=TODAY
  → 업체별 KPI 집계 반환
  → 테이블 렌더링
```

---

### 2. 관제모드(Wall) MUNI_ADMIN 접근 허용

**파일**: `app/api/dashboard/wall/route.ts`

#### 변경 전
```javascript
if (session.role !== 'SUPER_ADMIN') {
  if (!session.contractorId) {
    return NextResponse.json({ error: 'no_scope' }, { status: 403 });
  }
  // nocAccess 기능 검증 ...
}
```

#### 변경 후
```javascript
// MUNI_ADMIN은 nocAccess 없이 바로 허용 (municipalityId 기반 자동 필터 적용)
if (session.role !== 'SUPER_ADMIN' && session.role !== 'MUNI_ADMIN') {
  if (!session.contractorId) {
    return NextResponse.json({ error: 'no_scope' }, { status: 403 });
  }
  // nocAccess 기능 검증 ...
}
```

기존 `facilityWhere.municipalityId` 분기가 이미 구현되어 있어 MUNI_ADMIN의 관할 시설만 자동으로 필터링된다.

---

### 3. contractors-aggregate API — pendingComplaints 추가

**파일**: `app/api/super-admin/contractors-aggregate/route.ts`

업체별 **미처리 민원 수**(RECEIVED / ASSIGNED / IN_PROGRESS 상태)를 별도 집계하여 응답에 포함.

```typescript
// 추가된 쿼리
prisma.complaint.groupBy({
  by: ['contractorId'],
  where: {
    contractorId: { in: cIds },
    status: { in: ['RECEIVED', 'ASSIGNED', 'IN_PROGRESS'] },
  },
  _count: true,
}),

// 응답 필드 추가
pendingComplaints: pendingComplaints.find(...)._count ?? 0,
```

---

## 기존에 이미 구현된 기능 (Phase 1 확인)

| 기능 | 파일 | 비고 |
|---|---|---|
| 보고서 업체 선택기 | `_reports-client.tsx` | contractorId 선택 드롭다운 이미 구현 |
| 전체 업체 통합 API | `/api/super-admin/contractors-aggregate` | MUNI_ADMIN 권한 이미 지원 |
| 데이터 격리 | `lib/scopes.ts`, `lib/complaints.ts` 등 | municipalityId 자동 필터 |
| MUNI_ADMIN 읽기 전용 | `middleware.ts` | POST/PUT/PATCH/DELETE 403 |

---

## Phase 2 계획 (다음 단계)

| 기능 | 설명 | 의존성 |
|---|---|---|
| 차트 시각화 | recharts 도입, 민원 추이·출근율 비교 차트 | `npm install recharts` |
| 월별 추이 | 업체별 월간 KPI 변화 라인 차트 | recharts |
| 통합 Excel 출력 | 전체 업체 시트 + 업체별 시트 구조 | ExcelJS (기존 활용) |
| 통합 PDF 보고서 | 월간 KPI 요약 자동 생성 | Puppeteer (기존 활용) |
| 근태 다중 업체 | `/api/attendance/month` 복수 contractorId 지원 | API 확장 |

---

## 아키텍처 참고

```
Municipality (1)
  └── Contractor (N) ── 각 업체별 데이터 (complaints, attendance, vehicles, safety...)
        ↑
   MUNI_ADMIN 세션의 municipalityId로 자동 범위 격리
```

- **MUNI_ADMIN 세션**: `{ role: 'MUNI_ADMIN', municipalityId: string, contractorId: null }`
- **권한 레벨**: ROLE_RANK 80 (SUPER_ADMIN=100, CONTRACTOR_ADMIN=60)
- **쓰기 제한**: middleware에서 전 API 읽기 전용 강제 (일부 화이트리스트 제외)
