# Residual UX Violations — Post P0/P1

작성일: 2026-04-28
대상: P2 사이클 후보
감사방식: grep 기반 패턴 매칭 + 파일 직접 검증
참고: P0/P1 처리 완료 파일 (app/layout, globals, login, citizen, worker shell, AppBar 등) 은 카운트 제외

---

## 통계

- **총 잔여: 약 220건** (10px=159 / [9px]=24 / [11px]=37, 슬레이트 대비 위반은 거의 없음)
- 파일별 분포 (text-[10px] + text-[9px] + text-[11px] 합산):

| 파일 | 10px | 9px | 11px | 합계 |
|---|---|---|---|---|
| `app/(admin)/users/_users-client.tsx` | 25 | 17 | 16 | **58** |
| `app/(admin)/performance/_performance-client.tsx` | 22 | 0 | 4 | **26** |
| `app/(admin)/safety/_weather-alert.tsx` | 6 | 0 | 4 | **10** |
| `app/(admin)/attendance/_attendance-client.tsx` | 4 | 0 | 3 | **7** |
| `app/(admin)/reports/daily-treatment/_daily-treatment-tab.tsx` | 4 | 0 | 0 | **4** |
| `app/worker/leave/_leave-client.tsx` | 0 | 1 | 0 | **1** |
| `app/worker/punch/_punch-client.tsx` | 0 | 0 | 0 | **0** ✓ |
| `app/worker/complaint/_complaint-client.tsx` | 0 | 0 | 0 | **0** ✓ |
| `app/worker/performance/_performance-client.tsx` | 0 | 0 | 0 | **0** ✓ |
| `app/worker/route/_worker-route-client.tsx` | 0 | 0 | 0 | **0** ✓ |

> ✓ = P1에서 이미 처리 완료. 잔여 0건 — P2 대상 아님.

기타 잔여 패턴:
- `text-slate-300` / `text-slate-400` (미지정·플레이스홀더 회색): performance 1, recycling-intake 비고 1, users(이력) 1 — 의미상 placeholder 라 WCAG 비대상
- `text-slate-200`: 0건 ✓
- `text-xs` 사용처 약 380건 (정보 밀도 표 셀 다수 — 12px=text-xs 는 **WCAG AA 준수 하한선**으로 P2 대상 아님)

---

## P2 후보 (우선순위)

### 🔴 P2-1. `app/(admin)/users/_users-client.tsx` — **58건** (최대)

가장 큰 부채. 5탭 거대 컴포넌트 (1,400+ 라인) — 폰트 사이즈 일관성 & 가독성 모두 P2 핵심.

**대표 위반 (line:패턴):**
- L365 `text-[10px]` "직책 미지정" placeholder
- L369 `text-[10px]` 사번 표시
- L375-376 `text-[10px]` 지자체 region/name (필터 결과 표) — **사용자가 자주 보는 정보 → 12px+ 권장**
- L383 `text-[9px]` 서명 ref 뱃지
- L539, L563, L569 `text-[10px]` 섹션 그룹 라벨 (uppercase)
- L796 `text-[9px]` 서명 ref 표시
- L879 `text-[9px]` 결재자 role
- L1038-1056 `text-[10px]`/`[9px]` 직원별 연차 카드 (부여/사용/잔여 + 권장·근속)
- L1083, L1090, L1098-1102 `text-[10px]` 사번/필드/서명 url
- L1188 `text-[11px]` 범례 카드
- L1208, L1229 `text-[11px]` 캘린더 요일 헤더 / 일자
- L1235-1251 `text-[10px]`/`[9px]` 캘린더 셀의 이름 chip / +N 더 / 카운터
- L1285-1286 `text-[10px]` 월별 신청 리스트 사번 / 유형 뱃지
- L912-915 `text-[11px]` 비활성화/등록 액션 라벨

**수정 가이드:**
- 폼 라벨/섹션 헤더 (L539, L563, L569 등 uppercase): `text-[10px]` → `text-xs` (12px)
- 캘린더 셀 이름 chip (L1237): `text-[10px]` → `text-[11px]` 또는 `text-xs` (대신 chip 패딩 축소)
- 서명 ref · audit 메타: `text-[9px]` → `text-[10px]` (정보 밀도 우선이면 그대로 유지하되, font-mono 글리프는 가독성 더 양호)
- 카운트 chip (`text-[9px] font-mono` ✓X N 등 L1249-1251): 그대로 두되 `font-extrabold` 유지

---

### 🟠 P2-2. `app/(admin)/performance/_performance-client.tsx` — **26건**

대부분 폼 라벨 (L149, L155, L294, L300, L434, L439, L444, L452, L459, L464, L472, L518, L523).

**대표 위반:**
- L149, L155, L294, L300 등 `text-[10px] font-mono font-extrabold text-slate-600` — **"기준일", "조회", "시작일", "종료일" 폼 라벨 다수**
- L213-214 `text-[10px]` 표 셀 "기록자" — recorderName (recorderRole)
- L239, L243, L244 `text-[10px]` 월별 표 헤더 (일자/성상/실적/기록자)
- L357 `text-[10px]` 성상 카테고리 뱃지 (반입실적 표)
- L363 `text-[10px]` 기록자 셀
- L602, L624 `text-[10px]`/`[11px]` 출력일시·KCard label

**수정 가이드:**
- **폼 라벨 13개**: `text-[10px]` → `text-xs` (12px) 또는 `text-[13px]` 일괄 — 필드 라벨은 WCAG 준수 하한 12px+ 필수
- 표 헤더 `text-[10px]` (L239, L243): `text-[11px]` 유지하되 column 폭 충분히 확보
- 표 셀 "기록자" `text-[10px]`: `text-xs` (12px)

---

### 🟠 P2-3. `app/(admin)/safety/_weather-alert.tsx` — **10건**

- L126 `text-[10px]` 위험기상 뱃지 (font-mono font-extrabold) — 강조용이라 OK
- L206 `text-[10px]` 체크 아이콘 (의미 없음 → ✓ 표시)
- L228, L242 `text-[11px]` 섹션 라벨 (📢 [기상 안전 알림] / 전송 요약)
- L236 `text-[10px]` 메시지 글자 수 카운터
- L244-245, L250, L254 `text-[13px]` 발송요약 dl — **양호 (13px ≥ 12px)**
- L268 `text-[10px]` provider= 뱃지

**수정 가이드:**
- L228 "📢 [기상 안전 알림 내용]" 라벨: `text-[11px]` → `text-xs font-bold` (12px)
- L236 글자수 카운터: `text-[10px]` → `text-[11px]` (의미 있는 정보)
- L242 "전송 요약" 헤더: `text-[11px]` → `text-xs`
- 나머지 (체크 ✓, provider 뱃지): 그대로 유지 가능

---

### 🟡 P2-4. `app/(admin)/attendance/_attendance-client.tsx` — **7건**

- L69 `text-[11px]` 표 헤더 (uppercase tracking-wider) — **양호**
- L89 `text-[10px]` 사번 (employeeNo)
- L103 `text-[11px]` 상태 뱃지 (font-extrabold) — **양호**
- L109 `text-[10px]` "미기록" placeholder
- L138 `text-[13px]` KPI 라벨 — **양호**

**수정 가이드:**
- L89 사번 `text-[10px]` → `text-[11px]` 또는 `text-xs`
- 나머지 11px 강조 뱃지/헤더는 P2 대상 아님

---

### 🟡 P2-5. `app/(admin)/reports/daily-treatment/_daily-treatment-tab.tsx` — **4건**

- L107 `text-[10px]` "대상 일자" 라벨
- L118 `text-[10px]` "위탁업체" 라벨
- L193 `text-[10px]` 합계 카드 라벨
- L194, L199 `text-[10px]` `t` 단위 (장식)
- L198 `text-[10px]` "합계" 라벨
- L247 `text-[10px]` 생성·생성자 메타

**수정 가이드:**
- 폼 라벨 2개 (L107, L118): `text-[10px]` → `text-xs` (12px)
- 합계 카드 라벨 (L193, L198): `text-[10px]` → `text-[11px]` 또는 `text-xs`
- 단위 글자 (`t` L194, L199): font-bold 라 시각상 OK — 그대로 유지 가능
- 메타 푸터 (L247): 그대로 유지 가능 (보조 정보)

---

### 🟢 P2-6. `app/worker/leave/_leave-client.tsx` — **1건**

- L300 `text-[9px]` StatusBadge "신청/결재중/완료/반려" 뱃지

**수정 가이드:**
- `text-[9px]` → `text-[10px]` 또는 `text-xs` (모바일 워커앱 — 가독성 우선)

---

## 권장 마이그레이션 순서 (P2 사이클)

1. **users-client.tsx 분할 + 정리** (58건) — **최우선**. 1,400라인 단일 파일이라 가독성·유지보수 모두 큰 부채. 5개 탭을 별도 컴포넌트 파일로 분할 (`_register-tab.tsx`, `_profile-tab.tsx`, `_leave-tab.tsx`, `_calendar-tab.tsx`, `_org-tab.tsx`) 후 각 탭에서 텍스트 사이즈 정리. 이때 폼 라벨은 일괄 `text-xs font-mono font-extrabold` (12px) 통일.

2. **performance(admin) 폼 라벨 일괄 치환** (26건) — `text-[10px] font-mono font-extrabold text-slate-600` 패턴 13곳을 단일 `<FieldLabel>` 컴포넌트로 추출 → `text-xs` 적용. 이후 표 셀 정리.

3. **weather-alert 가독성 정리** (10건) — 알림톡 전송 화면은 안전·법적 컴플라이언스 영역이므로 글자수 카운터·라벨 가독성 정상화 (P2-3 수정 가이드).

4. **attendance + daily-treatment** (11건) — 폼 라벨 일괄 12px, 사번·메타 정보 11px 으로 정렬.

5. **worker/leave StatusBadge** (1건) — 단순 1개. 모바일 워커앱 일관성 (`text-[10px]` 또는 `text-xs`).

---

## 추가 제안 (P2 사이클 외)

- **공용 컴포넌트화**: `<FieldLabel>`, `<TableHeaderCell>`, `<MetaText>` 3개 컴포넌트 도입 시 잔여 220건 중 ~150건 자동 표준화. design-tokens 단계와 연계 권장.
- **Tailwind preset 추가**: `text-form-label`(=12px ext-bold mono slate-600), `text-table-meta`(=11px mono slate-600) 등 시맨틱 토큰화. shadcn/ui 의 `Label` 컴포넌트 사용 검토.
- **ESLint 룰**: `text-[1[0-3]px\]` 패턴 금지 룰 (admin 한정) 추가 시 신규 위반 차단 가능.
