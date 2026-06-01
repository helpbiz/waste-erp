# 지자체 관리자(MUNI_ADMIN) 멀티업체 통합 관리

> 최초 작성: 2026-06-01 | 최종 업데이트: 2026-06-01 | Phase 1·2·P0·P1·P2 전체 완료

---

## 배경 및 목적

지자체는 산하에 2~20여 개의 위탁업체를 운용한다. 기존 시스템은 데이터 격리(municipalityId 자동 필터)는 완성되어 있었으나, 지자체 관리자가 **업체를 통합적으로 모니터링**하거나 **업체별 비교 현황**을 한눈에 볼 수 있는 UI와 출력 기능이 부재했다.

### 설계 원칙

> MUNI_ADMIN은 **"감독자 + 보고자"** 역할 — 직접 처리가 아닌 전체 현황 모니터링과 보고서 생성이 본질.

- 데이터 쓰기는 읽기 전용 기본 (`READ_ONLY_ROLES` in `lib/rbac.ts`)
- 예외 화이트리스트: 민원 등록, 공지 작성, 안전 보고서 검토, 본인 계정 관리
- 모든 데이터는 `municipalityId` 기반 자동 범위 격리

---

## 전체 구현 완료 목록

| 단계 | 기능 | 파일 | 커밋 |
|---|---|---|---|
| Phase 1 | 대시보드 위탁업체 통합 현황판 | `_muni-aggregate-panel.tsx` | `6f05f94` |
| Phase 1 | 관제모드 MUNI_ADMIN 접근 허용 | `api/dashboard/wall/route.ts` | `6f05f94` |
| Phase 1 | contractors-aggregate pendingComplaints 추가 | `api/super-admin/contractors-aggregate` | `6f05f94` |
| Phase 2 | 차트 시각화 4종 (recharts) | `_muni-charts-panel.tsx` | `e31d765` |
| P0 | 민원관리 업체 탭 필터 (전체/개별) | `_complaints-client.tsx` | `1b44d91` |
| P0 | 민원 Excel 출력 버튼 | `_complaints-client.tsx` | `1b44d91` |
| P0 | 보고서 민원 Excel / 출근대장 Excel | `_reports-client.tsx` | `1b44d91` |
| P1 | 산업안전 검토 권한 MUNI_ADMIN 허용 | `lib/safety.ts`, `middleware.ts` | `5816f14` |
| P1 | 근태관리 Excel 출력 버튼 | `_attendance-client.tsx` | `5816f14` |
| P2 | 안전 보고서 Excel 출력 신규 API | `api/safety/reports/export/route.ts` | `2797769` |
| P2 | 차량 운행일지 Excel 출력 버튼 | `_vehicles-client.tsx` | `2797769` |
| P2 | TBM 이력 MUNI_ADMIN 지원 | `api/tbm/history/route.ts`, `tbm-history/page.tsx` | `2797769` |

---

## 메뉴별 MUNI_ADMIN 기능 현황

### 대시보드 (`/dashboard`)

| 기능 | 상태 |
|---|---|
| 위탁업체 통합 현황판 | ✅ KPI 카드 + 업체별 비교 테이블 |
| 업체 탭 필터 (전체/개별) | ✅ |
| 차트 시각화 4종 | ✅ 출근율·인원·민원·추이 |
| 관제모드 바로가기 | ✅ |

**차트 상세**
- 업체별 오늘 출근율 BarChart
- 업체별 인원 분포 PieChart (도넛)
- 업체별 미처리 민원 BarChart
- 월별 민원 추이 LineChart (최근 6개월)

**데이터 소스**: `/api/super-admin/contractors-aggregate` + `/api/reports/master-stats`

---

### 관제모드 (`/dashboard/wall`)

| 기능 | 상태 |
|---|---|
| 실시간 KPI 조회 | ✅ MUNI_ADMIN 접근 허용 (nocAccess 불필요) |
| 시설별 운영 현황 | ✅ municipalityId 기반 자동 필터 |

---

### 민원관리 (`/complaints`)

| 기능 | 상태 |
|---|---|
| 전체 업체 민원 조회 | ✅ |
| 업체별 탭 필터 | ✅ 업체 2개 이상일 때 탭 자동 노출 |
| 민원 등록 | ✅ 업체 선택 필수 |
| 구역 필터 | ✅ 산하 업체 담당구역 |
| Excel 내보내기 | ✅ 업체 필터 반영, `민원대장_날짜.xlsx` |
| 상태 변경·처리·배정 | ❌ 위탁업체 담당 (설계 의도) |

**업체 탭 필터 동작**
```
[전체 업체 N건] [A업체 n건] [B업체 n건] ...
  → 클릭 시 해당 업체 민원만 클라이언트 필터링
  → Excel 출력 시 필터 상태 반영
```

---

### 산업안전보건 (`/safety`)

| 기능 | 상태 |
|---|---|
| 보고서 조회 | ✅ 산하 업체 전체 |
| 보고서 검토 (REVIEWED) | ✅ MUNI_ADMIN 허용 |
| 지자체 보고 완료 (MOL_REPORTED) | ✅ 정부 보고 역할 |
| 종결 (RESOLVED) | ✅ |
| 보고서 Excel 출력 | ✅ 연간 보고서, `안전보건보고서_날짜.xlsx` |
| TBM 이력 조회 | ✅ 산하 업체 전체 TBM 세션 |

**안전 검토 권한 변경**
```typescript
// lib/safety.ts
export function isSafetyManager(role: string): boolean {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'MUNI_ADMIN'].includes(role);
}
```

**미들웨어 화이트리스트 추가**
```typescript
// middleware.ts - isReadOnlyExempt()
if (method === 'POST' && /^\/api\/safety\/reports\/\d+\/review$/.test(path)) return true;
```

---

### 근태관리 (`/attendance`)

| 기능 | 상태 |
|---|---|
| 일별 출근 현황 조회 | ✅ 산하 업체 전체 |
| 실시간 자동 새로고침 | ✅ 60초 |
| Excel 출력 | ✅ 선택 월 기준 출근대장, `출근대장_YYYY-MM.xlsx` |
| 근태 수정·승인 | ❌ 읽기 전용 (설계 의도) |

---

### 차량 관리 (`/vehicles`)

| 기능 | 상태 |
|---|---|
| 차량 현황 조회 | ✅ 산하 업체 전체 |
| 운행일지 조회 | ✅ |
| 운행일지 Excel 출력 | ✅ 당월 기준, `차량운행일지_YYYY-MM.xlsx` |
| 차량 등록·수정 | ❌ 읽기 전용 (설계 의도) |

---

### 통합 보고서 (`/reports`)

| 기능 | 상태 |
|---|---|
| 통합 운영 보고서 | ✅ 전체/개별 업체 선택 |
| 업체 선택 드롭다운 | ✅ 이미 구현 (contractorId) |
| 일일 처리실적 일보 (F02) | ✅ |
| 민원 Excel 다운로드 | ✅ 기간+업체 반영 |
| 출근대장 Excel 다운로드 | ✅ 선택 월 기준 |
| 브라우저 인쇄 | ✅ |

---

## API 변경 내역

### 신규 API

| 엔드포인트 | 권한 | 설명 |
|---|---|---|
| `GET /api/safety/reports/export` | `isSafetyManager()` (MUNI_ADMIN 포함) | 안전 보고서 Excel 다운로드 |

### 수정된 API

| 엔드포인트 | 변경 내용 |
|---|---|
| `GET /api/dashboard/wall` | MUNI_ADMIN nocAccess 예외 처리 |
| `GET /api/super-admin/contractors-aggregate` | `pendingComplaints` 필드 추가 |
| `POST /api/safety/reports/[id]/review` | MUNI_ADMIN 미들웨어 화이트리스트 등록 |
| `GET /api/tbm/history` | MUNI_ADMIN 지원, municipalityId 기반 필터 |

---

## 기술 스택 추가

| 라이브러리 | 버전 | 용도 |
|---|---|---|
| `recharts` | 3.8.1 | 차트 시각화 (BarChart, PieChart, LineChart) |

---

## 아키텍처

```
Municipality (1)
  └── Contractor (N) ── complaints, attendance, vehicles, safety, tbm...
        ↑
   MUNI_ADMIN session.municipalityId → 자동 범위 격리

MUNI_ADMIN 세션: { role: 'MUNI_ADMIN', municipalityId: string, contractorId: null }
권한 레벨: ROLE_RANK 80 (SUPER=100, CONTRACTOR_ADMIN=60)

읽기 전용 예외 화이트리스트:
  - POST /api/complaints          (민원 등록)
  - POST /api/announcements       (공지 작성)
  - PATCH/DELETE /api/announcements/[id]
  - POST /api/safety/reports/[id]/review  ← P1 추가
  - /api/auth/*                   (인증)
  - /api/users/me/*               (본인 계정)
```

---

## 향후 개선 가능 항목 (미구현)

| 기능 | 설명 | 예상 공수 |
|---|---|---|
| 통합 PDF 보고서 | 월간 KPI 요약 자동 생성 (Puppeteer) | 2일 |
| 월별 업체 비교 차트 | recharts 추이 차트 확장 | 1일 |
| 근태 다중 업체 집계 | `/api/attendance/month` 복수 contractorId | 1일 |
| MuniAccessPolicy UI | 화면별 접근 권한 설정 (스키마 이미 존재) | 3일 |
