# 세션 재개 노트 — 2026-05-02

> 이 문서는 다음 세션 시작 시 빠르게 컨텍스트를 복구하기 위한 메모입니다.
> 본 세션 종료 commit: `23b5f40` (worker complaint default tab → register)
> 이전 세션 노트(2026-04-28)는 §부록 으로 보존.

---

## 본 세션(2026-05-02) 주요 결과 요약

상세는 `docs/04-report/2026-05-02-session-log.md` 참조 — 6 commits.

### ✅ 완료 + 운영 반영

1. **워커 민원 처리 UI** (InboxPanel)
   - `lib/complaints.ts` WORKER 가시범위 OR(reportedBy, assignedTo)
   - `/worker/complaint` 탭 구조 (📥 내 민원 / ✏ 신규 등록), CompleteModal
   - 등록 폼 라벨: "처리 내용" → "신고 내용"
   - 기본 탭 → `register` (지도 즉시 가시 회귀 수정)

2. **공지/민원 음성 알림 (TTS)**
   - Web Speech API 기반, 외부 서비스 의존성 없음
   - reporter/author role 기반 메시지 자동 분기 (회사 / 지자체)
   - `lib/voice-settings.ts` + `VoiceSettingsModal` 사용자 선호(localStorage)
   - `AnnouncementBanner` + `ComplaintBanner` (admin/worker shell 양쪽 마운트)
   - 미리듣기 4종 (공지·민원 × 회사·지자체)

3. **민원 자동 배정 + AI 인근 워커 추천**
   - `lib/complaint-assign.ts` — 점수(부하·거리·zone 일치) 기반 best 1명 배정
   - 기동반(RAPID) 우선 → fallback 일반 WORKER
   - AI 인근 추천: AttendanceRecord GPS Haversine ≤2km OR 동(洞) 매칭
   - 인근 워커 broadcast Announcement (6시간 expire)
   - 회사별 기능 권한 게이트 적용 (autoAssign / aiNearbyDispatch)

4. **회사별 기능 권한(엔타이틀먼트)** ⭐ 새 시스템
   - `ContractorFeature` 모델 (prisma db push 완료)
   - 8개 기능 카탈로그 (announcements, voiceTts, complaintAutoAssign,
     aiNearbyDispatch, recommendedRoute, costCalculation, vehicleTracking, attendanceGps)
   - 슈퍼관리자 콘솔 신규 탭: 🎛 회사별 기능 권한
   - row 미존재 → 카탈로그 default(true) → 기존 contractor 무중단 호환
   - 1차 게이트: announcements / complaintAutoAssign / aiNearbyDispatch

### Service Worker 캐시 버전
v50 → v56 (7회 cache bust, 모두 본 세션 내)
- v56 final: `cleanerp-v56-2026-05-02-worker-complaint-default-register`

### Commits (시간순)
| # | SHA | 영역 |
|---|---|---|
| 1 | `55dfbf8` | feat(worker): InboxPanel + WORKER scope 버그 수정 |
| 2 | `df3d5c1` | fix(worker): 라벨 '처리 내용' → '신고 내용' |
| 3 | `dc423f7` | feat(announcements): TTS + 남/여 voice 설정 |
| 4 | `27c62c8` | feat(complaint): 민원 TTS + 자동배정 + AI 인근 추천 |
| 5 | `6f903b9` | feat(super-admin): 회사별 기능 권한 + 세션 로그 |
| 6 | `23b5f40` | fix(worker): 기본 탭 → register (지도 회귀 수정) |

---

## 다음 세션 우선 처리 후보

(우선순위 순)

1. **회사별 기능 게이트 점진 적용**
   - recommendedRoute (`/worker/route` 진입 차단)
   - vehicleTracking (`/live-vehicles` 진입 차단)
   - costCalculation, attendanceGps
   - 기능 비활성 시 사용자 친화 안내 페이지(403 raw 대신)

2. **클라이언트 사이드 기능 게이트**
   - `/api/me/features` 엔드포인트 (현재 사용자 contractor 의 활성 기능)
   - sidebar 메뉴 항목 자체 숨김 (현재는 클릭 후 403)
   - 슈퍼/지자체 사용자(contractorId 없음)는 모든 기능 ON

3. **요금제 패키지(Template) 기능**
   - 슈퍼관리자 — 기본/프로/엔터프라이즈 같은 사전 정의 세트
   - 신규 위탁업체 개설 마법사 마지막 단계에 패키지 선택

4. **AI 인근 추천 정밀화**
   - Announcement 모델에 `targetUserId` 추가 → per-user notification
   - 현재는 audience='WORKER' 회사 한정 broadcast(인근 아닌 워커도 알림 받음)

5. **WebPush API 풀스택**
   - 백그라운드(앱 닫힘)에서도 공지/민원 푸시
   - 현재 OS Notification 은 페이지 열려 있을 때만

6. **/worker/complaint UX 후속**
   - 본인 배정 민원 N건 있으면 inbox 탭 우상단 뱃지(🔴 N) 표시
   - 첫 진입 시 inbox 카운트 fetch 후 N>0 이면 inbox 자동 진입(register 보다 우선)

---

## 시드 계정 (변동 없음)

비밀번호: `changeme1234!`

| 계정 | 역할 | 이름 | 특이사항 |
|---|---|---|---|
| super | SUPER_ADMIN | 슈퍼관리자 | 전체 관리, 🎛 기능 권한 탭 사용 |
| muni | MUNI_ADMIN | 지자체관리자 | GET-only |
| company | CONTRACTOR_ADMIN | 업체관리자 | 위탁업체 1 (강남) |
| manager | INTERNAL_ADMIN | 김관리 | 위탁업체 1 |
| worker | WORKER | 이철수 | 일반 |
| worker3 | WORKER | 최민준 | **RAPID 기동반** (추천경로·자동배정 대상) |
| muni1 / company1 | MUNI/CONTR | 강남구·강남업체 | 베타 |
| muni2 / company2 | MUNI/CONTR | 파주시·파주업체 | 베타 |

---

## 빠른 재개 가이드

### 1. 환경 확인
```bash
cd /home/user/my-pjt/wci-mvp/waste-erp
git fetch origin
git log --oneline -8   # 최신 commit이 23b5f40 또는 그 이후이면 정상
```

### 2. 운영 상태
```bash
docker ps | grep cleanerp
curl http://localhost:3001/api/health
```

### 3. 코드 변경 후 재배포
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build app
```

### 4. Prisma schema 변경 시
```bash
DATABASE_URL="postgresql://cleanerp:tV7FRpcWgD+G+1r+YqW5L85ajaX9OIFnFaIRsmZFaA8@localhost:5434/cleanerp_prod?schema=public" \
  npx prisma db push --skip-generate --accept-data-loss
npx prisma generate
```

---

## 주요 신규 파일 위치 (본 세션)

### 라이브러리
- `lib/voice-settings.ts` — TTS 설정 + 발화 helper (Web Speech API)
- `lib/complaint-assign.ts` — 자동배정 + AI 인근 추천 알고리즘
- `lib/features.ts` — 기능 카탈로그 + hasFeature/listContractorFeatures/setContractorFeature

### 컴포넌트
- `components/VoiceSettingsModal.tsx` — voice 선호 UI (남/여 토글, 미리듣기 4종)
- `components/ComplaintBanner.tsx` — 신규 민원 폴링 + TTS

### API
- `app/api/super-admin/contractor-features/route.ts` — 기능 GET/PATCH

### UI 페이지
- `app/(admin)/super-admin/_features-tab.tsx` — 회사 × 기능 매트릭스

### 문서
- `docs/04-report/2026-05-02-session-log.md` — 본 세션 상세 기록 (이 RESUME_NOTE 보다 자세함)

---

## 다음 세션 시작 시 추천 흐름

1. `docs/04-report/2026-05-02-session-log.md` 빠르게 훑기 (5분)
2. 사용자에게 가장 우선 처리할 항목 청취
   - 회사별 기능 게이트 점진 적용?
   - UI 다듬기?
   - 신규 기능?
3. PR 단위로 분리 (롤백 용이성)

> **중요 운영 원칙** (이전 세션부터 누적):
> - 사용자가 "다 보이게" / "지도가 안 올라와" 같은 의도/회귀 신호를 보이면
>   바로 코딩 들어가지 말고 **먼저 청취·진단·합의** 후 구현.
> - SW 캐시 버전은 의미 있는 변경마다 bump (이번 세션 7회).
> - 시드 계정 비밀번호 변경 금지 (운영 검증 일관성).

---

# 부록 — 이전 세션(2026-04-28) 컨텍스트

> 이전 세션 노트는 `git show 80fa51d:RESUME_NOTE.md` 로 참조 가능.
> 핵심 미해결 이슈는 본 세션에서 부분적으로 다뤄졌고, 나머지는 다음 세션 후보로 이관.

### 그 당시 미해결로 남았던 항목 (2026-05-02 세션 미진행)
- 워커 로그아웃 버튼 위치 재검토 (현재 `/worker/profile` 하단)
- 회사/슈퍼/매니저 데스크톱 화면 UI 품질 개선
- HTTPS 인증서(운영 SSL) — Cloudflare 프록시 또는 Let's Encrypt
- P1 보안 백로그 (rate limit, PII 암호화, JWT refresh)
