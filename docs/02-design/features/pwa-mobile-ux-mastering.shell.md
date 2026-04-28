# CleanERP PWA — App Shell Architecture

> 기준일: 2026-04-28 | Wave 4 결과물 기반 통합 설계

---

## 1. 설계 원칙

1. **단일 Shell 컴포넌트 + role 주입**: `UnifiedShell`이 role을 prop으로 받아 nav 구성만 분기. 레이아웃 코드 중복 제거.
2. **모바일 First**: 기본 렌더 = 모바일 Bottom Tab 패턴. `md:` 분기로 사이드바 추가.
3. **길 잃지 않는 구조**: 현재 위치 항상 AppBar 타이틀 + Bottom Tab 활성 표시. 깊이 3단계 이상 금지.
4. **로그아웃 항상 보임**: 헤더 우상단에 고정. AAA 대비. 44px 터치 타겟.

---

## 2. 반응형 분기 정책

```
< 768px  (모바일 · 환경미화원 메인 환경)
  → AppBar (상단 고정, 54px) + Bottom Tab (하단 고정, 64px + safe-area)
  → 드로어/햄버거 없음 (Wave 4 결정 — 복잡도 제거)

≥ 768px  (데스크탑 · 관리자 사무 환경)
  → 좌측 사이드바 (240px 고정) + 상단 Header (54px)
  → Bottom Tab 숨김
```

---

## 3. 4-Role 셸 구성

### 3.1 역할별 네비게이션 정의

#### company (위탁대행사 관리자)
```
Bottom Tab 5:
  [홈] [직원] [실적] [차량] [더보기→profile]

Sidebar Groups:
  대시보드: 홈
  인력관리: 직원목록, 직책관리, 근태현황
  실적관리: 일일실적, 월별리포트
  차량관리: 차량현황, 배차계획
  시스템: 계정설정
```

#### manager (현장팀장)
```
Bottom Tab 5:
  [홈] [출퇴근] [민원] [안전] [실적]

Sidebar Groups:
  대시보드: 홈
  팀관리: 팀원현황, 출퇴근확인
  업무: 민원접수, 안전점검
  실적: 팀실적, 개인실적
```

#### muni (지자체 담당자)
```
Bottom Tab 5:
  [현황] [민원] [실적] [보고서] [더보기]

Sidebar Groups:
  모니터링: 실시간현황, 차량위치
  민원: 민원접수현황, 처리현황
  보고: 월간보고, 연간통계
  관리: 계약관리, super-admin
```

#### worker (환경미화원) — Wave 4 결정 유지
```
Bottom Tab 5 (고정):
  [홈] [출퇴근] [민원] [안전] [실적]

홈 그리드 (자주 쓰지 않는 기능):
  - 내 정보 / 급여 / 공지사항 / ...
  - RAPID 역할일 때: [최적경로계산] 카드 추가 노출

헤더 아바타: 프로필·로그아웃 진입점
```

### 3.2 role → 라우트 매트릭스

| role | 로그인 후 redirect | 셸 타입 |
|---|---|---|
| `COMPANY` | `/admin` | AdminShell (사이드바) |
| `MANAGER` | `/admin` | AdminShell (사이드바) |
| `MUNI` | `/admin/super-admin` | AdminShell (사이드바) |
| `WORKER` (일반) | `/worker` | WorkerShell (Bottom Tab) |
| `WORKER` (RAPID) | `/worker` | WorkerShell + 홈 그리드 최적경로 카드 |

---

## 4. AppBar 컴포넌트 사양 (모바일)

```
높이: 54px + safe-area-inset-top
배경: --bg-surface (#ffffff)
테두리 하단: 1px solid --line

[좌] 뒤로가기 버튼 (44×44px) — 루트 페이지에서 숨김
[중] 페이지 타이틀 (type-subheading 18px / font-bold / --ink)
     + 역할 뱃지 (type-caption 14px / --brand / background --brand-soft)
[우] 아바타 버튼 (44×44px) → Drawer Sheet 오픈
     └ Sheet 내용: 프로필, 로그아웃(AAA 표준)
```

---

## 5. Header 컴포넌트 사양 (데스크탑 md+)

```
높이: 54px
배경: --bg-surface
테두리 하단: 2px solid --line

[좌] 페이지 타이틀 (type-subheading 18px bold)
[중] 빈 공간 (flex-1)
[우] 현재시각 (type-mono 14px) — lg+만 표시
     역할 뱃지 (type-mono 14px)
     구분선
     [LogoutButton AAA 표준 — 44px, 16px, 빨간 배경]
```

---

## 6. LogoutButton 표준 사양 (AAA)

기존 `_logout-button.tsx` 교체 대상.

```
크기: min-width 80px, height 44px (터치 타겟)
배경: --danger (#b91c1c)
텍스트: #ffffff (21:1 대비) / 16px / font-semibold
테두리: none (배경색으로 충분)
radius: 8px
padding: 0 16px

상태:
  - hover (마우스): background → #991b1b (더 어둡게)
  - active: scale(0.97) 150ms
  - busy: opacity 0.7 + "처리중..." 텍스트

확인 다이얼로그:
  - window.confirm 대신 AccessibleConfirmDialog 컴포넌트 사용
  - 제목: "로그아웃 하시겠습니까?" (18px bold)
  - 설명: "저장하지 않은 내용은 사라집니다." (16px)
  - [취소 버튼] outlined (--ink 테두리) / [로그아웃 버튼] --danger 채움
  - 각 버튼 56px 높이 (PrimaryCTA 규격)
```

---

## 7. Bottom Tab 사양 (모바일)

Wave 4 `WorkerLayoutShell` 결과물 기준 — 4 role 공통 적용.

```
높이: 64px + env(safe-area-inset-bottom)
배경: --bg-surface
상단선: 1px solid --line + shadow-nav
아이콘: 24×24px (Heroicons / Lucide)
라벨: 12px / font-semibold / --ink-faint (비활성) / --brand (활성)
터치 영역: 각 탭 flex-1, 최소 44px height

활성 상태:
  - 아이콘: --brand-light (#06b6d4)
  - 라벨: --brand (#0e7490) / font-bold
  - 상단 인디케이터: 3px 선 (--brand) / border-radius 0 0 3px 3px
  - 배경: --brand-soft 10% (subtle fill)

전환 애니메이션: color 150ms ease
```

---

## 8. Sidebar 사양 (데스크탑)

기존 `_admin-shell.tsx` → SidebarBody 개선.

```
너비: 240px (고정, flex-shrink-0)
배경: --sidebar-bg (#0f172a)
색상 컨텍스트: 다크

[로고 영역]: 높이 72px, 패딩 16px 24px
[프로필 블록]: 아바타(40×40 / border-radius-full) + 이름(14px bold / #e2e8f0) + 역할(12px / #94a3b8)
[Nav Groups]:
  그룹 헤더: 10px / font-mono / #94a3b8 / tracking-widest
  Nav Item:
    높이: 44px (AAA 터치 타겟, 마우스 환경에도 동일)
    패딩: 0 20px
    텍스트: 15px / font-medium / #e2e8f0
    활성: border-left 3px solid #06b6d4 / background rgba(6,182,212,0.12) / 텍스트 #67e8f9 / font-bold
    hover: background rgba(255,255,255,0.05)
[하단 로그아웃 영역]: 패딩 16px, border-top rgba(255,255,255,0.1)
  LogoutButton (AAA) — 사이드바 다크 컨텍스트에서도 red background 유지
```

---

## 9. 파일 구조 제안

```
app/
├── layout.tsx                  # viewport maximumScale 추가, Pretendard 로딩
├── (admin)/
│   ├── _admin-shell.tsx        # AdminShell — Header + Sidebar + role-aware nav
│   ├── _logout-button.tsx      # AAA 표준으로 교체
│   └── layout.tsx
├── worker/
│   ├── _layout-shell.tsx       # WorkerLayoutShell (Wave 4) — 유지
│   ├── _tab-link.tsx           # TabLink — 유지
│   └── layout.tsx
└── login/
    └── page.tsx                # UnifiedLogin (4-role 공용)

components/
├── shell/
│   ├── AppBar.tsx              # 모바일 상단 AppBar (worker + 미래 공용)
│   ├── LogoutButton.tsx        # AAA 표준 (admin + worker 공용)
│   └── AccessibleConfirmDialog.tsx
├── worker/
│   └── AppBar.tsx              # 기존 유지 (shell/AppBar로 점진 통합)
└── ui/
    ├── Toast.tsx               # 기존 유지
    └── ...
```

---

## 10. viewport 수정 (layout.tsx)

현재 `maximumScale` 미설정 → 아래로 교체:

```typescript
export const viewport: Viewport = {
  themeColor: '#0e7490',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,        // 추가: PWA 자동 줌 방지
  userScalable: true,     // 확정 요구사항: 사용자 수동 줌 허용
  viewportFit: 'cover',
};
```

> `maximumScale=1` + `userScalable=yes` 조합: 브라우저 자동 줌(더블탭) 방지 + 핀치 줌 허용.
> iOS Safari에서 `userScalable: false`는 접근성 위반 — 이 조합이 최적해.
