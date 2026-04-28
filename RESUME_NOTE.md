# 세션 재개 노트 — 2026-04-28

> 이 문서는 다음 세션 시작 시 빠르게 컨텍스트를 복구하기 위한 메모입니다.
> 세션 종료 태그: `session-2026-04-28-end` (commit `28f18b1`)
> 운영 라이브 buildId: `kv9cNNQz--NhdsiP23AJy`

---

## 현재 상태 (2026-04-28 세션 종료 시점)

### ✅ 완료 + 운영 반영
- **P0 잔여 보안 4건** (PR #17, #21) — GPS PIPA / audit forensic / 90일 cron / Tenant Prisma extension
- **Mobile UX Wave 1-4** (PR #20, #23, #24, #25, #27)
  - AppBar + Bottom Tab(5) + safe-area
  - Toast + Skeleton + 햅틱 + Pretendard + 56dp CTA
  - 홈 Bento + 출퇴근 sticky CTA + 폰트 정규화
  - 안전·민원 Toast + 햅틱
  - **햄버거 제거** (사용자 피드백 반영) — Tab 5 + 헤더 아바타
- **Dockerfile** 빌드 단계 JWT_SECRET ARG 수정
- **운영 배포 완료** — `wci.helpbiz.kr` 외부 응답 200 OK

### 🔴 사용자가 지적한 미해결 이슈 (다음 세션 우선 처리)

**대한민국 최고 UI/UX 전문가 답지 않은 부분 — 재검토 필요**:

1. **워커 로그아웃 버튼 문제**
   - 현재: `/worker/profile` 페이지 하단으로 이동 (Wave 4에서 햄버거 Drawer 제거하며 이전)
   - 사용자 불만 추정: 발견율 낮음 / 위치 어색함 / 디자인 미흡
   - 검토 필요: 헤더 아바타 클릭 시 메뉴/시트로 즉시 로그아웃 옵션? 또는 다른 패턴?

2. **회사(CONTRACTOR_ADMIN) UI/UX**
   - 대상: `/dashboard`, `/users`, `/vehicles`, `/complaints`, `/safety`, `/performance`, `/reports` 등
   - 데스크톱 위주이지만 모바일에서도 봐야 하는 페이지들
   - 사용자 불만: 품질 낮음 (구체 항목은 다음 세션에서 청취)

3. **슈퍼관리자 콘솔**
   - 대상: `/super-admin/*` (지자체 관리, 처리시설 마스터, 정책)
   - 사용자 불만: 품질 낮음

4. **매니저(INTERNAL_ADMIN) 화면**
   - 대상: 위탁업체 내부 관리자 화면
   - 사용자 불만: 품질 낮음

### 🟡 다음 세션 추가 백로그

- **HTTPS 인증서** (운영 SSL)
  - 현재 wci.helpbiz.kr는 HTTP만. 외부 라우팅이 lab3 → wci-worm(192.168.1.25) → cleanerp-app
  - wci-worm SSH 접근 + nginx 설정 + certbot 발급 필요
  - 또는 Cloudflare 프록시로 우회 (가장 빠름)
  - Let's Encrypt rate limit: 12:59 KST(2026-04-28) 이후 해제

- **P1 보안 백로그** (이전 multi-tenant SaaS review에서 식별)
  - P1-4 rate limiting + 보안헤더
  - P1-5 PII 평문 필드 암호화 (KMS DEK)
  - P1-6 JWT refresh + blacklist
  - P1-1 FeatureFlag 모델

- **Mobile UX Wave 3 추가** (시간 부족으로 보류)
  - 안전 페이지 BottomSheet 폼 (incident 보고)
  - 민원 페이지 BottomSheet 폼

---

## 빠른 재개 가이드

### 1. 환경 확인
```bash
cd /home/user/my-pjt/wci-mvp/waste-erp
git fetch origin
git log --oneline -5
# 최신 commit이 28f18b1 또는 그 이후이면 정상
```

### 2. 운영 상태 확인
```bash
# 컨테이너 상태
docker ps | grep cleanerp

# 헬스체크
curl http://localhost:3001/api/health

# 외부 응답 (NAT hairpin 회피)
curl -s -m 15 "https://allorigins.hexlet.app/get?url=http%3A%2F%2Fwci.helpbiz.kr%2F&_=$(date +%s)" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status'))"
```

### 3. 운영 재빌드 (코드 변경 후)
```bash
cd /home/user/my-pjt/wci-mvp/waste-erp
git pull origin main
export $(grep -v '^#' .env.prod | xargs)
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build app
```

### 4. 이 세션 종료점으로 되돌리기 (필요 시)
```bash
# 단순 확인
git log session-2026-04-28-end -1

# 강제 롤백 (위험 — 운영 영향)
git reset --hard session-2026-04-28-end
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build app
```

---

## 주요 파일 위치

### 모바일 UX
- `app/worker/layout.tsx` — 서버 컴포넌트 (인증 + shell 호출)
- `app/worker/_layout-shell.tsx` — Bottom Tab(5) + AppBar
- `app/worker/_tab-link.tsx` — 탭 링크 (active 인디케이터)
- `app/worker/page.tsx` — 홈 (그라데이션 카드 + 기타 메뉴 그리드)
- `components/worker/AppBar.tsx` — sticky AppBar + ProfileAvatar
- `components/ui/Toast.tsx` — 토스트 Provider/hook
- `components/ui/PrimaryButton.tsx` — 56dp CTA + StickyCtaBar
- `components/ui/Skeleton.tsx`
- `lib/haptics.ts` — Web Vibration API

### 디자인 문서 (재검토 시 참고)
- `docs/02-design/mobile-ux-overhaul.md` — frontend-architect 1168줄
- `docs/00-pm/mobile-ux-research.md` — pm-research 1900줄
- `docs/02-design/mobile-nav-revisit.md` — Option C 결정 문서
- `docs/00-pm/mobile-nav-pattern-research.md` — pm-research 햄버거 검토
- `docs/04-report/mobile-ux-overhaul.report.md` — 완료 보고서

### 백엔드 (P0 잔여 적용)
- `lib/audit.ts` — writeAudit() helper (tenant forensic)
- `lib/prisma-tenant.ts` — Prisma extension (defense in depth)
- `lib/geo.ts` — GPS roundCoord (PIPA 라운딩)
- `app/api/cron/gps-cleanup/route.ts` — 90일 cleanup
- `middleware.ts` — ACME challenge 처리 추가됨

---

## 시드 계정 (운영 검증용)

비밀번호: `changeme1234!`

| 계정 | 역할 | 이름 | 특이사항 |
|---|---|---|---|
| super | SUPER_ADMIN | 슈퍼관리자 | 전체 관리 |
| muni | MUNI_ADMIN | 지자체관리자 | GET-only |
| company | CONTRACTOR_ADMIN | 업체관리자 | 위탁업체 1 (강남) |
| manager | INTERNAL_ADMIN | 김관리 | 위탁업체 1 |
| worker | WORKER | 이철수 | 일반 |
| worker3 | WORKER | 최민준 | **RAPID 기동반** (추천경로 노출) |
| muni1 / company1 | MUNI/CONTR | 강남구·강남업체 | 베타 |
| muni2 / company2 | MUNI/CONTR | 파주시·파주업체 | 베타 |

---

## GitHub PR 누적 (오늘 세션, 모두 머지됨)

#17 #19 #20 #21 #22 #23 #24 #25 #26 #27 + chore(docker) `28f18b1`

---

## 다음 세션 시작 시 추천 흐름

1. 사용자에게 가장 거슬리는 화면 1개 짚어달라고 청취
2. **워커 로그아웃 버튼** 우선 재설계 (가장 명확한 이슈)
3. 회사/슈퍼관리자/매니저 화면 — 페이지 단위로 우선순위 청취 후 진행
4. 디자인 시안 또는 참고 앱이 있으면 그것 기준
5. 한 화면씩 PR 분리 (롤백 용이성)

> **중요**: 지난 세션의 자율 권한이 있어도 사용자가 "다 보이게" 같은 의도를 표명한 경우는 그 의도를 더 깊이 파고든 후 코딩하는 것이 더 좋았다. 다음 세션엔 청취 → 시안 합의 → 구현 순서.
