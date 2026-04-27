# Super Admin Console Phase 1 — Component Scaffold Guide

> **대상 작업**: P1-3 (Tab 1), P1-4 (Tab 2), P1-5/6/7 (Tab 4)
> **기준 파일**: `app/(admin)/super-admin/_super-admin-client.tsx` (1136 lines)
> **작성일**: 2026-04-28
> **작성 주체**: Frontend Architect Agent

---

## 0. 전제 및 분리 전략

### 0.1 `_super-admin-client.tsx` 분리 전략

**결정: 탭별 추출 (점진적 분리)**

전체 리팩터를 한 번에 하지 않는다. Phase 1 대상 3개 탭만 하위 컴포넌트로 추출하고 나머지는 현행 유지.

```
분리 방식 비교

| 방식             | 장점                        | 단점                             | 결정    |
|------------------|-----------------------------|----------------------------------|---------|
| 전체 분리        | 코드 품질 일괄 개선         | 12개 섹션 동시 회귀 위험         | X       |
| 탭별 추출 (선택) | 변경 범위 최소화, revert 용이 | 중간 상태 파일 공존             | O (채택) |
```

**파일 레이아웃 (Phase 1 완료 후)**

```
app/(admin)/super-admin/
  _super-admin-client.tsx          ← 탭 스위처 + 탭 3·5·GIS (기존 유지)
  _tab1-municipalities.tsx         ← 신규 추출 (Tab 1 아코디언)
  _tab2-policies.tsx               ← 신규 추출 (Tab 2 권한 매트릭스)
  _tab4-aggregate.tsx              ← 신규 추출 (Tab 4 거래처 조회)
  facilities/
    _facilities-tab.tsx            ← 기존 유지
```

**규칙**
- 파일명은 `_` 접두어 유지 (Next.js App Router private convention)
- 각 탭 파일은 `'use client'` 선언
- 공유 타입(`MuniRow`, `Muni`, `Aggregate`)은 `_super-admin-client.tsx` 상단에 유지하되 각 탭 파일에서 `import type` 사용

---

## 1. Tab 1 — 광역-기초 아코디언 (P1-3, 6h)

### 1.1 컴포넌트 시그니처

```typescript
// app/(admin)/super-admin/_tab1-municipalities.tsx

/** 기존 MuniRow 타입 그대로 재사용 */
export type MuniRow = {
  id: string;
  name: string;
  code: string;
  region: string | null;   // 이미 존재. NULL → "미분류" 슬롯
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  contractorCount: number;
  adminCount: number;
};

/**
 * 광역 단위 아코디언 그룹 컴포넌트
 * - region 이름 + 기초자치단체 수 요약을 헤더로 표시
 * - open/close 는 부모가 관리 (모두 열기/닫기 제어 용이)
 */
export type RegionAccordionProps = {
  region: string;                    // "서울특별시" | "미분류"
  items: MuniRow[];                  // 해당 광역의 기초 목록
  isOpen: boolean;
  onToggle: () => void;
  onRowClick: (muni: MuniRow) => void;
  onEdit: (muni: MuniRow) => void;
  onToggleStatus: (muni: MuniRow) => void;
  onDelete: (muni: MuniRow) => void;
};

export function RegionAccordion(props: RegionAccordionProps): JSX.Element;

/**
 * Tab 1 루트. 기존 MunicipalitiesTab을 대체.
 * 검색·필터 + 17 광역 아코디언 + 기초 상세 BottomSheet
 */
export function MunicipalitiesTab(): JSX.Element;
```

### 1.2 내부 상태 구조

```typescript
// MunicipalitiesTab 내부
const [items, setItems] = useState<MuniRow[]>([]);
const [regions, setRegions] = useState<string[]>([]);     // API 응답 그대로
const [openRegions, setOpenRegions] = useState<Set<string>>(new Set()); // 펼침 상태
const [detailMuni, setDetailMuni] = useState<MuniRow | null>(null);     // BottomSheet 대상
const [editing, setEditing] = useState<MuniRow | null>(null);
const [creating, setCreating] = useState(false);
const [q, setQ] = useState('');
const [filterRegion, setFilterRegion] = useState('');
const [filterStatus, setFilterStatus] = useState('');

// 광역별 그룹핑 (useMemo)
const grouped = useMemo<Map<string, MuniRow[]>>(() => {
  const map = new Map<string, MuniRow[]>();
  for (const item of items) {
    const key = item.region ?? '미분류';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}, [items]);

// 모두 열기/닫기
function expandAll() { setOpenRegions(new Set(grouped.keys())); }
function collapseAll() { setOpenRegions(new Set()); }
```

### 1.3 RegionAccordion 마크업 구조

```tsx
// 접근성: role=button + aria-expanded + aria-controls
// 키보드: Enter/Space 토글

<div className="bg-surface border border-line rounded-lg overflow-hidden">
  {/* 광역 헤더 */}
  <button
    type="button"
    role="button"
    aria-expanded={isOpen}
    aria-controls={`region-panel-${region}`}
    onClick={onToggle}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); }}}
    className={`
      w-full flex items-center gap-3 px-4 py-3 text-left
      bg-surface-soft hover:bg-surface-alt transition-colors
      border-b border-line focus-visible:outline-none focus-visible:ring-2
      focus-visible:ring-accent focus-visible:ring-inset
    `}
  >
    {/* 펼침 인디케이터 — CSS transform, 라이브러리 없음 */}
    <span
      aria-hidden="true"
      className={`text-ink-muted transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
    >
      ▶
    </span>

    <span className="font-extrabold text-ink text-sm flex-1">{region}</span>

    {/* 요약 배지 */}
    <span className="text-[11px] font-mono text-ink-faint">{items.length}개 기초자치단체</span>
    <span className="text-[11px] font-mono text-info">
      위탁 {items.reduce((s, m) => s + m.contractorCount, 0)}개
    </span>
  </button>

  {/* 기초자치단체 행 목록 */}
  {isOpen && (
    <div
      id={`region-panel-${region}`}
      role="region"
      aria-label={`${region} 기초자치단체 목록`}
    >
      <table className="w-full text-xs min-w-[640px]">
        <tbody>
          {items.map((m) => (
            <tr
              key={m.id}
              className="border-b border-line hover:bg-surface-alt cursor-pointer"
              onClick={() => onRowClick(m)}
              // 키보드로도 클릭 가능
              onKeyDown={(e) => { if (e.key === 'Enter') onRowClick(m); }}
              tabIndex={0}
              role="button"
              aria-label={`${m.name} 상세 보기`}
            >
              {/* 들여쓰기로 계층 시각화 */}
              <td className="pl-10 pr-3 py-1.5 font-extrabold text-ink">{m.name}</td>
              <td className="px-3 py-1.5 font-mono text-[10px] text-ink-faint">{m.code}</td>
              <td className="px-3 py-1.5"><MuniStatusBadge status={m.contractorCount === 0 ? 'SUSPENDED' : m.status} /></td>
              <td className="px-3 py-1.5 text-right font-mono text-info">{m.contractorCount}</td>
              <td className="px-3 py-1.5 text-right">
                {/* 행 내 액션은 e.stopPropagation() 필수 */}
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => onEdit(m)} className="text-[10px] font-extrabold px-2 py-1 rounded border border-line hover:bg-surface-soft">편집</button>
                  <button onClick={() => onToggleStatus(m)} className="text-[10px] font-extrabold px-2 py-1 rounded border border-line hover:bg-surface-soft">
                    {m.status === 'ACTIVE' ? '비활성화' : '활성화'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>
```

### 1.4 기초 상세 BottomSheet (재사용)

기존 `MuniEditModal`은 편집 전용이므로, 클릭 시 **읽기 전용 상세** BottomSheet를 신규 추가한다.

```typescript
// 신규: 읽기 전용 상세
type MuniDetailSheetProps = {
  muni: MuniRow | null;
  onClose: () => void;
  onEdit: (muni: MuniRow) => void;
};

function MuniDetailSheet({ muni, onClose, onEdit }: MuniDetailSheetProps): JSX.Element | null;
// → BottomSheet 재사용. desktopMaxWidth="480px"
```

### 1.5 위치 및 의존성

| 항목 | 값 |
|------|----|
| **파일 위치** | `app/(admin)/super-admin/_tab1-municipalities.tsx` |
| **공유 컴포넌트** | `components/BottomSheet.tsx` (재사용) |
| **신규 컴포넌트** | `RegionAccordion` (파일 내 인라인) |
| **신규 utils** | 없음 (Map 그룹핑은 useMemo 인라인) |
| **외부 라이브러리** | 없음 |
| **API** | `GET /api/super-admin/municipalities?limit=500` (기존 그대로) |

### 1.6 회귀 위험

| 위험 | 심각도 | 대응 |
|------|--------|------|
| `region` 이 NULL인 기초자치단체 → "미분류" 그룹으로 fallback, 렌더링 깨짐 없음 | Low | `item.region ?? '미분류'` |
| 광역 순서 비결정 (Map 삽입 순) → 매 조회마다 순서 달라질 수 있음 | Low | API 응답 `regions` 배열 순서 기준으로 Map 정렬: `regions.forEach(r => map.set(r, []))` 후 채움 |
| 아코디언 전체 열기 시 DOM 행 500+ → 성능 | Low | `limit=500`은 현행 그대로. 필요 시 각 광역 내 가상화는 Phase 2 |
| `MuniEditModal` 동시 공존 (기존 코드 병행) — 분리 전 임시 | Medium | 탭 교체 후 기존 `MunicipalitiesTab` 참조 제거. 단일 commit에서 교체 |

---

## 2. Tab 2 — 계층 그룹 + 검색 + 콤팩트 + 권한 시각화 (P1-4, 5h)

### 2.1 컴포넌트 시그니처

```typescript
// app/(admin)/super-admin/_tab2-policies.tsx

/** P1-2 API 변경 후 region 필드 포함 */
export type MuniWithPolicy = {
  id: string;
  name: string;
  code: string;
  region: string | null;        // P1-2에서 API 응답에 추가
  status: string;
  contractorCount: number;
  policy: {
    allowedScreens: string[];
    allowedReports: string[];
    exportEnabled: boolean;
    bulkExportEnabled: boolean;
    note: string | null;
    updatedAt: string;
  } | null;
};

/** 권한 상태 분류 */
export type PolicyStatus = 'active' | 'partial' | 'unset';

/** 권한 상태 색칩 */
type PolicyStatusChipProps = {
  status: PolicyStatus;
  screensCount: number;
  totalScreens: number;
};
export function PolicyStatusChip(props: PolicyStatusChipProps): JSX.Element;

/** 광역 그룹 섹션 헤더 */
type PolicyGroupHeaderProps = {
  region: string;
  items: MuniWithPolicy[];
  isOpen: boolean;
  onToggle: () => void;
};
export function PolicyGroupHeader(props: PolicyGroupHeaderProps): JSX.Element;

/** Tab 2 루트. 기존 PoliciesTab을 대체 */
export function PoliciesTab(): JSX.Element;
```

### 2.2 권한 상태 분류 로직

```typescript
function getPolicyStatus(muni: MuniWithPolicy): PolicyStatus {
  if (!muni.policy) return 'unset';
  const total = ALL_SCREENS.length;
  const allowed = muni.policy.allowedScreens.length;
  if (allowed === total) return 'active';  // 전체 허용
  if (allowed > 0) return 'partial';       // 일부 허용
  return 'unset';                          // 0개
}
```

### 2.3 권한 상태 색칩 스펙

| status | 배경 | 텍스트 | 테두리 | 레이블 |
|--------|------|--------|--------|--------|
| `active` | `accent-soft` (`#cffafe`) | `accent` (`#0e7490`) | `accent` | "전체 허용" |
| `partial` | amber-100 | `warn` (`#b45309`) | amber-300 | "N/{total} 허용" |
| `unset` | red-50 | `danger` (`#b91c1c`) | red-200 | "미설정" |

```tsx
// 색칩 구현
export function PolicyStatusChip({ status, screensCount, totalScreens }: PolicyStatusChipProps) {
  const map: Record<PolicyStatus, { bg: string; text: string; border: string; label: string }> = {
    active:  { bg: 'bg-accent-soft', text: 'text-accent',   border: 'border-accent',   label: '전체 허용' },
    partial: { bg: 'bg-amber-100',   text: 'text-warn',     border: 'border-amber-300', label: `${screensCount}/${totalScreens} 허용` },
    unset:   { bg: 'bg-red-50',      text: 'text-danger',   border: 'border-red-200',  label: '미설정' },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center text-[10px] font-extrabold px-2 py-0.5 rounded border ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
}
```

### 2.4 검색 + debounce

```typescript
// 200ms debounce — 외부 라이브러리 없이 useRef 패턴
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

function handleSearchChange(value: string) {
  setSearchRaw(value);
  if (timerRef.current) clearTimeout(timerRef.current);
  timerRef.current = setTimeout(() => setQ(value), 200);
}

// 필터링은 클라이언트 사이드 (500건 이하)
const filteredGrouped = useMemo(() => {
  const lq = q.toLowerCase();
  const result = new Map<string, MuniWithPolicy[]>();
  for (const [region, items] of grouped) {
    const filtered = lq
      ? items.filter((m) => m.name.includes(lq) || m.code.includes(lq))
      : items;
    if (filtered.length > 0) result.set(region, filtered);
  }
  return result;
}, [grouped, q]);
```

### 2.5 콤팩트 행 스펙

기존 카드형 레이아웃(`div.border-2.rounded-lg`) → 테이블 행으로 전환.

```tsx
// 행 height: py-1.5 + text-xs = 약 36px (데스크탑 기준)
<tr className="border-b border-line hover:bg-surface-alt text-xs">
  {/* 상위 지자체 병기: 광역명 prefix (회색 텍스트) */}
  <td className="pl-4 pr-2 py-1.5">
    <span className="text-[10px] text-ink-faint font-mono mr-1.5">{region}</span>
    <span className="font-extrabold text-ink">{m.name}</span>
  </td>
  <td className="px-2 py-1.5 font-mono text-[10px] text-ink-faint">{m.code}</td>
  <td className="px-2 py-1.5">
    <PolicyStatusChip
      status={getPolicyStatus(m)}
      screensCount={m.policy?.allowedScreens.length ?? 0}
      totalScreens={ALL_SCREENS.length}
    />
  </td>
  <td className="px-2 py-1.5 text-right">
    <button onClick={() => setEditing(m)}
      className="text-[10px] font-extrabold px-2 py-1 rounded bg-purple-600 text-white hover:bg-purple-700">
      {m.policy ? '수정' : '+ 설정'}
    </button>
  </td>
</tr>
```

### 2.6 광역 그룹 헤더 — React state vs native `<details>` 결정

**권장: React state (이유 3가지)**

1. `<details>`/`<summary>` native는 모든 광역을 한 번에 열기/닫기 제어가 불가능 (JS로 `element.open = true`를 개별 호출해야 함)
2. 검색 결과 0건 시 해당 광역 그룹 자동 숨김 처리 — React 상태로 관리가 자연스러움
3. `aria-expanded` 수동 제어 가능 → WCAG 규격 충족 용이

```typescript
const [openRegions, setOpenRegions] = useState<Set<string>>(() => new Set(/* 초기 전체 열기 */));
```

### 2.7 위치 및 의존성

| 항목 | 값 |
|------|----|
| **파일 위치** | `app/(admin)/super-admin/_tab2-policies.tsx` |
| **공유 컴포넌트** | `components/BottomSheet.tsx` (PolicyEditModal 내부에서) |
| **신규 컴포넌트** | `PolicyStatusChip`, `PolicyGroupHeader` (파일 내 인라인) |
| **선행 의존** | **P1-2 완료 필수** (`/api/super-admin/muni-policies` 응답에 `region` 추가) |
| **외부 라이브러리** | 없음 |
| **API** | `GET /api/super-admin/muni-policies` (P1-2에서 `region` 필드 추가됨) |

### 2.8 회귀 위험

| 위험 | 심각도 | 대응 |
|------|--------|------|
| P1-2 API 변경 전 Tab 2 개발 시 `region` 필드 undefined → 전체 "미분류" 그룹 | Medium | P1-2 → P1-4 순서 강제. PR 의존 명시 |
| `PolicyEditModal` (기존 코드) — BottomSheet 내 저장 로직은 변경 없음 | Low | 기존 로직 그대로 이동, import 경로만 갱신 |
| 검색 debounce 중 컴포넌트 unmount → timer 미정리 | Low | `useEffect` cleanup: `return () => { if (timerRef.current) clearTimeout(timerRef.current); }` |

---

## 3. Tab 4 — SearchableSelect + DatePresets + 빈 화면 (P1-5/6/7, 4h)

### 3.1 컴포넌트 시그니처

```typescript
// app/(admin)/super-admin/_tab4-aggregate.tsx

// ── SearchableSelect ──────────────────────────────────────────────

/**
 * combobox 패턴 SearchableSelect
 * - aria-haspopup="listbox" + aria-expanded + aria-activedescendant
 * - 키보드: ↑↓ 네비게이션, Enter 선택, Escape 닫기
 * - 검색 0건 시 "결과 없음" 메시지 + 리스트 맨 아래 정렬
 */
export type SearchableSelectOption = {
  value: string;
  label: string;        // 표시 텍스트
  subLabel?: string;    // 보조 텍스트 (예: "(3개 거래처)")
};

export type SearchableSelectProps = {
  id: string;
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function SearchableSelect(props: SearchableSelectProps): JSX.Element;

// ── DateRangePresets ─────────────────────────────────────────────

export type DatePreset = 'today' | 'this-week' | 'this-month' | 'prev-quarter' | 'this-year';

export type DateRangePresetsProps = {
  from: string;   // ISO date "YYYY-MM-DD"
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  /** from > to 시 호출 */
  onValidationError?: (msg: string) => void;
};

export function DateRangePresets(props: DateRangePresetsProps): JSX.Element;

// ── RecentlyViewedEmpty ───────────────────────────────────────────

export type RecentAggregate = {
  muniId: string;
  muniName: string;
  from: string;
  to: string;
  viewedAt: string;  // ISO datetime
};

export type RecentlyViewedEmptyProps = {
  onSelect: (item: RecentAggregate) => void;
};

export function RecentlyViewedEmpty(props: RecentlyViewedEmptyProps): JSX.Element;

// ── Tab 4 루트 ────────────────────────────────────────────────────
export function AggregateTab(): JSX.Element;
```

### 3.2 SearchableSelect 구현 상세

```tsx
export function SearchableSelect({ id, options, value, onChange, placeholder = '선택', disabled }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!q) return options;
    const lq = q.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(lq) || (o.subLabel ?? '').toLowerCase().includes(lq));
  }, [options, q]);

  // 바깥 클릭 닫기
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); setActiveIdx(0); }
      return;
    }
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && activeIdx >= 0 && filtered[activeIdx]) {
      onChange(filtered[activeIdx].value);
      setOpen(false);
      setQ('');
    }
  }

  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder;
  const listboxId = `${id}-listbox`;

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      {/* Trigger */}
      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeIdx >= 0 ? `${id}-opt-${activeIdx}` : undefined}
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); if (!open) setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex items-center justify-between w-full px-3 py-1.5 rounded border border-line text-sm font-bold bg-white hover:border-accent focus:outline-none focus:border-accent min-w-[220px] disabled:opacity-50"
      >
        <span className="truncate">{selectedLabel}</span>
        <span aria-hidden="true" className={`ml-2 text-ink-faint transition-transform duration-100 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[220px] bg-white border border-line rounded-lg shadow-card max-h-64 flex flex-col">
          {/* 검색 입력 */}
          <div className="p-2 border-b border-line">
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={(e) => { setQ(e.target.value); setActiveIdx(0); }}
              placeholder="검색..."
              className="w-full px-2 py-1 text-xs border border-line rounded focus:outline-none focus:border-accent"
              aria-label="지자체 검색"
            />
          </div>

          {/* 옵션 목록 */}
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="지자체 목록"
            className="overflow-y-auto flex-1"
          >
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-ink-faint text-center">검색 결과 없음</li>
            )}
            {filtered.map((opt, i) => (
              <li
                key={opt.value}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={opt.value === value}
                className={`px-3 py-1.5 text-sm cursor-pointer flex items-center justify-between ${
                  i === activeIdx ? 'bg-accent-soft text-accent' : opt.value === value ? 'bg-surface-soft font-extrabold' : 'hover:bg-surface-alt'
                }`}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseDown={() => { onChange(opt.value); setOpen(false); setQ(''); }}
              >
                <span>{opt.label}</span>
                {opt.subLabel && <span className="text-[10px] text-ink-faint ml-2">{opt.subLabel}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

**0건 시 마지막 정렬**: `filtered.length === 0` 메시지는 목록 내 마지막 li로 표시됨 — 자연스럽게 "검색 결과 없음" 이 목록 하단에 위치.

### 3.3 DateRangePresets 구현 상세

```typescript
// 프리셋 계산 유틸 (파일 내 인라인)
function getPresetRange(preset: DatePreset): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  switch (preset) {
    case 'today':
      return { from: fmt(today), to: fmt(today) };

    case 'this-week': {
      const dow = today.getDay(); // 0=일
      const mon = new Date(today); mon.setDate(today.getDate() - ((dow + 6) % 7));
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { from: fmt(mon), to: fmt(sun) };
    }

    case 'this-month': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last  = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: fmt(first), to: fmt(last) };
    }

    case 'prev-quarter': {
      const q = Math.floor(today.getMonth() / 3);
      const pq = q === 0 ? 3 : q - 1;
      const yr = q === 0 ? today.getFullYear() - 1 : today.getFullYear();
      const first = new Date(yr, pq * 3, 1);
      const last  = new Date(yr, pq * 3 + 3, 0);
      return { from: fmt(first), to: fmt(last) };
    }

    case 'this-year': {
      const first = new Date(today.getFullYear(), 0, 1);
      const last  = new Date(today.getFullYear(), 11, 31);
      return { from: fmt(first), to: fmt(last) };
    }
  }
}
```

```tsx
const PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today',        label: '오늘' },
  { key: 'this-week',    label: '이번주' },
  { key: 'this-month',   label: '이번달' },
  { key: 'prev-quarter', label: '전분기' },
  { key: 'this-year',    label: '올해' },
];

export function DateRangePresets({ from, to, onFromChange, onToChange, onValidationError }: DateRangePresetsProps) {
  const [activePreset, setActivePreset] = useState<DatePreset | null>('this-year');

  function applyPreset(key: DatePreset) {
    const range = getPresetRange(key);
    setActivePreset(key);
    onFromChange(range.from);
    onToChange(range.to);
  }

  function handleFromChange(v: string) {
    setActivePreset(null);  // 직접 입력 시 프리셋 해제
    onFromChange(v);
    if (to && v > to) onValidationError?.('시작일이 종료일보다 늦습니다.');
  }

  function handleToChange(v: string) {
    setActivePreset(null);
    onToChange(v);
    if (from && v < from) onValidationError?.('종료일이 시작일보다 빠릅니다.');
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* 프리셋 버튼 그룹 */}
      <div className="flex items-center gap-1" role="group" aria-label="기간 프리셋">
        {PRESETS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => applyPreset(key)}
            aria-pressed={activePreset === key}
            className={`px-2.5 py-1 text-xs font-extrabold rounded border transition-colors ${
              activePreset === key
                ? 'bg-accent text-white border-accent'
                : 'bg-white text-ink-muted border-line hover:border-accent hover:text-accent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 날짜 직접 입력 */}
      <div className="flex items-center gap-2">
        <div>
          <div className="text-[10px] font-mono font-extrabold text-ink-faint mb-1">시작일</div>
          <input type="date" value={from} onChange={(e) => handleFromChange(e.target.value)}
            className="px-3 py-1.5 rounded border border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
        </div>
        <span className="text-ink-faint mt-4">~</span>
        <div>
          <div className="text-[10px] font-mono font-extrabold text-ink-faint mb-1">종료일</div>
          <input type="date" value={to} onChange={(e) => handleToChange(e.target.value)}
            className="px-3 py-1.5 rounded border border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
        </div>
      </div>
    </div>
  );
}
```

### 3.4 빈 화면 — 최근 조회 항목 (localStorage)

```typescript
const RECENTLY_VIEWED_KEY = 'recently-viewed-aggregates';
const MAX_RECENT = 5;

// 저장 유틸
export function saveRecentAggregate(item: RecentAggregate): void {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const list: RecentAggregate[] = raw ? JSON.parse(raw) : [];
    // 중복 제거 (같은 muniId + from + to)
    const deduped = list.filter(
      (r) => !(r.muniId === item.muniId && r.from === item.from && r.to === item.to)
    );
    const next = [{ ...item, viewedAt: new Date().toISOString() }, ...deduped].slice(0, MAX_RECENT);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {
    // localStorage 사용 불가 환경 (SSR 등) — 무시
  }
}

// 읽기 유틸
export function getRecentAggregates(): RecentAggregate[] {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
```

```tsx
export function RecentlyViewedEmpty({ onSelect }: RecentlyViewedEmptyProps) {
  const [recents, setRecents] = useState<RecentAggregate[]>([]);

  // CSR only (hydration mismatch 방지)
  useEffect(() => {
    setRecents(getRecentAggregates());
  }, []);

  if (recents.length === 0) {
    return (
      <div className="text-center py-16 text-ink-faint">
        <div className="text-4xl mb-3 select-none">📋</div>
        <div className="font-bold text-sm">지자체 선택 후 조회해 주세요</div>
        <div className="text-xs mt-1">조회 기록이 여기에 표시됩니다</div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="text-xs font-extrabold text-ink-faint mb-3 px-1">최근 조회</div>
      <ul className="space-y-1.5">
        {recents.map((r, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onSelect(r)}
              className="w-full text-left px-4 py-2.5 rounded-lg border border-line bg-surface hover:bg-surface-soft hover:border-accent transition-colors flex items-center justify-between"
            >
              <div>
                <div className="font-extrabold text-ink text-sm">{r.muniName}</div>
                <div className="text-[11px] font-mono text-ink-faint mt-0.5">{r.from} ~ {r.to}</div>
              </div>
              <span className="text-[10px] text-ink-faint">{new Date(r.viewedAt).toLocaleDateString('ko-KR')}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**AggregateTab 조회 완료 시 저장 호출 위치**:

```typescript
// load() 함수 성공 후
async function load() {
  if (!muniId) return;
  setLoading(true);
  try {
    const r = await fetch(`/api/super-admin/contractors-aggregate?municipalityId=${muniId}&from=${from}&to=${to}`);
    const d = await r.json();
    setData(d);
    // 최근 조회 저장
    const muni = munis.find((m) => m.id === muniId);
    if (muni) {
      saveRecentAggregate({ muniId, muniName: muni.name, from, to, viewedAt: new Date().toISOString() });
    }
  } finally {
    setLoading(false);
  }
}
```

### 3.5 위치 및 의존성

| 항목 | 값 |
|------|----|
| **파일 위치** | `app/(admin)/super-admin/_tab4-aggregate.tsx` |
| **공유 컴포넌트** | 없음 (BottomSheet 불필요) |
| **신규 컴포넌트** | `SearchableSelect`, `DateRangePresets`, `RecentlyViewedEmpty` (파일 내 인라인) |
| **신규 utils** | `saveRecentAggregate`, `getRecentAggregates`, `getPresetRange` (파일 내 인라인) |
| **외부 라이브러리** | 없음 |
| **API** | 기존 동일. `GET /api/super-admin/muni-policies` + `GET /api/super-admin/contractors-aggregate` |

### 3.6 회귀 위험

| 위험 | 심각도 | 대응 |
|------|--------|------|
| `onSelect` (최근 조회 클릭) 시 muniId 복원이 안 됨 — munis 로드 전 setMuniId 호출 | Low | `onSelect`에서 muniId 세팅 후 `load()` 직접 호출 (munis state 무관) |
| localStorage JSON 파싱 오류 | Low | try/catch 래핑 (위 유틸에 포함) |
| 전분기 계산 — 1월 시 전년도 4분기 처리 | Low | `q === 0 ? 3 : q - 1`, `yr = q === 0 ? year - 1 : year` 처리 포함 |
| SearchableSelect listbox — 스크린리더 `aria-activedescendant` 불일치 | Medium | `id={`${id}-opt-${i}`}` + `aria-activedescendant` 동기화 (위 구현에 포함) |
| SSR hydration mismatch (localStorage) | Low | `useEffect` 내에서만 읽기 (위 구현에 포함) |

---

## 4. 통합 Module Map (의존 그래프)

```
_super-admin-client.tsx
  ├── _tab1-municipalities.tsx  (Tab 1)
  │     └── BottomSheet.tsx         [공유]
  ├── _tab2-policies.tsx        (Tab 2)
  │     └── BottomSheet.tsx         [공유]
  │     (선행: P1-2 API region 필드 추가)
  ├── _tab4-aggregate.tsx       (Tab 4)
  │     (선행: 없음 — 독립 시작 가능)
  ├── facilities/_facilities-tab.tsx  [기존 유지]
  └── (Tab 3 GIS CompanyInfo 기존 유지)

components/
  └── BottomSheet.tsx           [Tab 1, Tab 2에서 공유]
```

**병렬 작업 순서**

```
Day 1-2:  P1-2 API 변경 (백엔드) ── 병렬 ──> P1-5/6/7 Tab 4 (프론트 독립)
Day 3-4:  P1-3 Tab 1 아코디언
Day 5:    P1-4 Tab 2 (P1-2 완료 후)
```

---

## 5. 디자인 토큰 매핑 표

| UI 요소 | 토큰 | 실제 값 | Tailwind 클래스 |
|---------|------|---------|----------------|
| 광역 헤더 배경 | `surface-soft` | `#f1f5f9` | `bg-surface-soft` |
| 광역 헤더 hover | `surface-alt` | `#f8fafc` | `hover:bg-surface-alt` |
| 기초 행 구분선 | `line` | `#cbd5e1` | `border-line` |
| 권한 활성 칩 | `accent-soft` / `accent` | `#cffafe` / `#0e7490` | `bg-accent-soft text-accent` |
| 권한 일부 칩 | amber-100 / `warn` | - / `#b45309` | `bg-amber-100 text-warn` |
| 권한 미설정 칩 | red-50 / `danger` | - / `#b91c1c` | `bg-red-50 text-danger` |
| 포커스 링 | `accent` | `#0e7490` | `focus-visible:ring-accent` |
| 검색 선택 활성 항목 | `accent-soft` / `accent` | `#cffafe` / `#0e7490` | `bg-accent-soft text-accent` |
| DatePreset 활성 버튼 | `accent` / white | `#0e7490` / `#fff` | `bg-accent text-white` |
| DatePreset 비활성 버튼 | white / `line` | `#fff` / `#cbd5e1` | `bg-white border-line` |
| 최근 조회 카드 hover | `surface-soft` / `accent` | `#f1f5f9` / `#0e7490` | `hover:bg-surface-soft hover:border-accent` |
| 콤팩트 행 높이 | - | py-1.5 + text-xs ≈ 36px | `py-1.5 text-xs` |
| 모달 그림자 | `modal` | `0 16px 48px rgba(15,23,42,0.25)` | `shadow-modal` |

---

## 6. 컴포넌트 재사용 매트릭스

| 컴포넌트 | Tab 1 | Tab 2 | Tab 4 | 비고 |
|---------|-------|-------|-------|------|
| `BottomSheet` | O (상세 + 편집 모달) | O (PolicyEditModal) | X | 기존 그대로 |
| `MuniStatusBadge` | O (기존 인라인) | — | — | Tab 1 파일로 이동 |
| `MuniEditModal` | O (기존 이동) | — | — | Tab 1 파일로 이동 |
| `PolicyEditModal` | — | O (기존 이동) | — | Tab 2 파일로 이동 |
| `RegionAccordion` | O (신규) | — | — | Tab 1 전용 |
| `PolicyStatusChip` | — | O (신규) | — | Tab 2 전용 |
| `PolicyGroupHeader` | — | O (신규) | — | Tab 2 전용 |
| `SearchableSelect` | — | — | O (신규) | Tab 4 전용 |
| `DateRangePresets` | — | — | O (신규) | Tab 4 전용 |
| `RecentlyViewedEmpty` | — | — | O (신규) | Tab 4 전용 |
| `FilterToggle` | — | — | — | 이 프로젝트 미존재 — 해당 없음 |

---

## 7. 회귀 위험 종합 분석

### 7.1 `_super-admin-client.tsx` 1136줄 분리 전략 — 최종 결정

**채택: 탭별 점진적 추출 (Strangler Fig 패턴)**

```
Before (1136줄 단일 파일):
  SuperAdminClient → [MunicipalitiesTab, PoliciesTab, AggregateTab, CompanyInfoTab, GisConfigTab, FacilitiesTab]

After Phase 1 (4개 파일):
  _super-admin-client.tsx   (탭 스위처 + CompanyInfoTab + GisConfigTab + 공유 상수/타입)
  _tab1-municipalities.tsx  (MunicipalitiesTab + RegionAccordion + MuniEditModal + MuniDetailSheet)
  _tab2-policies.tsx        (PoliciesTab + PolicyStatusChip + PolicyEditModal)
  _tab4-aggregate.tsx       (AggregateTab + SearchableSelect + DateRangePresets + RecentlyViewedEmpty)
```

### 7.2 공유 상수/타입 처리

`ALL_SCREENS`, `ALL_REPORTS`는 Tab 2, Tab 3에서 모두 사용. 분리 후에도 `_super-admin-client.tsx` 상단에 유지하고 각 탭 파일에서 `import`한다.

```typescript
// _super-admin-client.tsx 에서 export 추가
export const ALL_SCREENS = [ ... ];
export const ALL_REPORTS = [ ... ];
export type { MuniRow, Muni, Aggregate };  // 기존 타입 re-export
```

### 7.3 탭별 분리 커밋 순서 (회귀 최소화)

```
commit 1: feat(super-admin): extract Tab 4 AggregateTab to _tab4-aggregate.tsx
  → 가장 독립적. 다른 탭과 공유 타입 최소
commit 2: feat(super-admin): extract Tab 1 MunicipalitiesTab + accordion
  → BottomSheet 의존 추가. MuniRow 타입 이동
commit 3: feat(super-admin): extract Tab 2 PoliciesTab + policy chips
  → P1-2 API 변경 선행 필수. Muni 타입 이동
```

### 7.4 Playwright 검증 체크리스트

각 커밋 후 최소 검증:

```
viewport 1280px:
  - [ ] Tab 전환 (6개 탭 모두) 오류 없음
  - [ ] 해당 탭 기능 동작 확인
  - [ ] BottomSheet 열기/ESC 닫기

viewport 768px (태블릿):
  - [ ] 아코디언 터치 토글
  - [ ] SearchableSelect 드롭다운 overflow 없음
  - [ ] DatePresets 버튼 wrap 정상
```

---

## 8. 개발 진입 체크리스트

### P1-3 (Tab 1, 6h) — 선행 없음

- [ ] `_tab1-municipalities.tsx` 신규 생성
- [ ] `RegionAccordion` 컴포넌트 구현 (aria-expanded, 키보드)
- [ ] `MuniDetailSheet` (BottomSheet 재사용) 구현
- [ ] `MunicipalitiesTab` → 아코디언 레이아웃으로 교체
- [ ] `_super-admin-client.tsx` Tab 1 import 교체
- [ ] Playwright 1280 + 768 검증

### P1-4 (Tab 2, 5h) — P1-2 API 변경 선행 필수

- [ ] P1-2 완료 확인 (`/api/super-admin/muni-policies` 응답에 `region` 필드)
- [ ] `_tab2-policies.tsx` 신규 생성
- [ ] `PolicyStatusChip` 구현 (3가지 상태, 토큰 적용)
- [ ] `PolicyGroupHeader` 구현 (React state, aria-expanded)
- [ ] debounce 200ms 검색 구현 (useRef 패턴)
- [ ] 콤팩트 행 (text-xs + py-1.5) + 상위 지자체 병기
- [ ] `_super-admin-client.tsx` Tab 2 import 교체
- [ ] Playwright 검증

### P1-5/6/7 (Tab 4, 4h) — 선행 없음 (독립)

- [ ] `_tab4-aggregate.tsx` 신규 생성
- [ ] `SearchableSelect` 구현 (combobox a11y, 키보드 네비)
- [ ] `getPresetRange` 유틸 + `DateRangePresets` 구현
- [ ] `saveRecentAggregate` / `getRecentAggregates` 유틸 구현
- [ ] `RecentlyViewedEmpty` 구현 (SSR safe useEffect)
- [ ] 조회 성공 시 localStorage 저장 호출 연결
- [ ] `_super-admin-client.tsx` Tab 4 import 교체
- [ ] Playwright 검증
