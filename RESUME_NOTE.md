# 세션 재개 노트 — 2026-05-02 (final)

> 이 문서는 다음 세션 시작 시 빠르게 컨텍스트를 복구하기 위한 메모입니다.
> 본 세션 종료 commit: `3ab64b8` (docs: 세션 로그 commit#15 SHA 채움)
> 이전 세션 노트(2026-04-28)는 §부록 으로 보존.

---

## 본 세션(2026-05-02) 주요 결과 요약

상세는 `docs/04-report/2026-05-02-session-log.md` 참조 — **15 feature commits + 4 docs commits**.

### ✅ 완료 + 운영 반영

1. **워커 민원 처리 UI** (InboxPanel)
   - `lib/complaints.ts` WORKER 가시범위 OR(reportedBy, assignedTo)
   - `/worker/complaint` 탭 구조 (📥 내 민원 / ✏ 신규 등록), CompleteModal
   - 등록 폼 라벨: "처리 내용" → "신고 내용"
   - 기본 탭 → `register` (지도 즉시 가시 회귀 수정)
   - 📥 내 민원 탭에 활성 N건 뱃지 (mount 시 1회 fetch)

2. **공지/민원 음성 알림 (TTS)**
   - Web Speech API 기반, 외부 서비스 의존성 없음
   - reporter/author role 기반 메시지 자동 분기 (회사 / 지자체)
   - `lib/voice-settings.ts` + `VoiceSettingsModal` 사용자 선호(localStorage)
   - `AnnouncementBanner` + `ComplaintBanner` → root layout 마운트(모든 화면 자동 팝업)
   - 미리듣기 4종 (공지·민원 × 회사·지자체)

3. **민원 자동 배정 + AI 인근 워커 추천 (per-user targeting)**
   - `lib/complaint-assign.ts` — 점수(부하·거리·zone 일치) 기반 best 1명 배정
   - 기동반(RAPID) 우선 → fallback 일반 WORKER
   - AI 인근 추천: AttendanceRecord GPS Haversine ≤2km OR 동(洞) 매칭
   - **per-user targeting**: `Announcement.targetUserId` 컬럼 추가 — 인근 워커 N명 개별 알림
   - 다른 워커는 자기에게 targeted 된 게 아니면 안 보임 (진짜 인근만 수신)

4. **공지 audience 정책 (role-based)**
   - `lib/announcement-audience.ts` — 5 audiences × 4 roles 매핑
   - CONTRACTOR/INTERNAL: ADMIN/WORKER/ALL (지자체 차단)
   - MUNI_ADMIN: OWNER/ADMIN/ALL (작성권 부여)
   - SUPER: 전체 5종 + 시스템 공지(둘 다 null)
   - 지자체 broadcast scope 추가 (산하 회사 범위)

5. **회사별 기능 권한(엔타이틀먼트) ⭐ 새 시스템**
   - `ContractorFeature` 모델 (prisma db push 완료)
   - 8개 기능 카탈로그
   - 슈퍼관리자 콘솔 🎛 탭 + 회사 × 기능 매트릭스
   - row 미존재 → default(true) → 기존 contractor 무중단 호환

6. **요금제 패키지 4-tier**
   - 🆓 TRIAL / 🟢 BASIC / 🔵 STANDARD / ⭐ PRO
   - `POST /api/super-admin/contractor-features/apply-package` 1클릭 적용
   - `detectPackage()` 자동 감지 → 매트릭스에 현재 패키지 표시

7. **회사별 기능 게이트 점진 적용 (서버 + 클라이언트)**
   - `lib/feature-guard.ts` — `requireFeature(session, key)` 페이지 server component 진입 시 호출
   - `/feature-disabled` 친화 안내 페이지
   - 적용: `/worker/route`, `/(admin)/live-vehicles`, `/(admin)/payroll`, attendance check-in/out
   - sidebar 메뉴 동적 필터 (admin + worker layout 모두)
   - `/api/me/features` — 본인 기능 상태 JSON

8. **WebPush 인프라 (MVP-lite)**
   - `WebPushSubscription` 모델 (prisma db push 완료)
   - `POST/DELETE /api/webpush/subscribe`
   - `PushSubscriber` 컴포넌트 + SW `push`/`notificationclick` 핸들러
   - 활성화: VAPID 키 발급 + `web-push` 패키지 설치 + `sendPushToUser()` 작성 (다음 세션)

### Service Worker 캐시 버전
v50 → v61 (12회 bump, 모두 본 세션 내)
- v61 final: `cleanerp-v61-2026-05-02-gates-webpush-inbox-badge`

### Commits (시간순 — feature 15 + docs 4)
| # | SHA | 영역 |
|---|---|---|
| 1 | `55dfbf8` | feat(worker): InboxPanel + WORKER scope 버그 수정 |
| 2 | `df3d5c1` | fix(worker): 라벨 '처리 내용' → '신고 내용' |
| 3 | `dc423f7` | feat(announcements): TTS + 남/여 voice 설정 |
| 4 | `27c62c8` | feat(complaint): 민원 TTS + 자동배정 + AI 인근 추천 |
| 5 | `6f903b9` | feat(super-admin): 회사별 기능 권한 + 세션 로그 |
| 6 | `23b5f40` | fix(worker): 기본 탭 → register (지도 회귀 수정) |
| 7 | `37dd841` | docs: 본 세션 종료 기록 — 세션 로그 + RESUME_NOTE 갱신 |
| 8 | `f59c340` | feat(notifications): 공지/민원 자동 팝업 — 모든 화면 글로벌 마운트 |
| 9 | `249d7fe` | feat(announcements): role 기반 audience + MUNI 작성권 + OWNER |
| 10 | `f8f4486` | docs: 세션 로그 commit#9 SHA 채움 |
| 11 | `865dd69` | feat(complaint): AI 인근 추천 per-user targeting |
| 12 | `35257db` | docs: 세션 로그 commit#11 SHA 채움 |
| 13 | `e0fdd5b` | feat(super-admin): 요금제 패키지 4-tier + 1클릭 적용 |
| 14 | `d102e3b` | docs: 세션 로그 commit#13 SHA 채움 |
| 15 | `7d11b04` | feat: 회사별 기능 게이트 점진 적용 + WebPush 인프라 + inbox 뱃지 |
| 16 | `3ab64b8` | docs: 세션 로그 commit#15 SHA 채움 |

---

## 다음 세션 우선 처리 후보

본 세션에서 RESUME_NOTE 의 1~6 후보 모두 처리 완료. 새 후보:

1. **WebPush 실제 발송 활성화** (인프라는 본 세션에 준비 완료)
   - `npx web-push generate-vapid-keys` → `.env.prod` 에 `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`
   - `npm i web-push`
   - `lib/webpush-send.ts` — `sendPushToUser(userId, payload)` (deadlettr 시 subscription 정리)
   - 트리거: `POST /api/announcements`, `autoAssignComplaint` 의 per-user 알림 시점
   - 만료된 endpoint(410 Gone) 자동 cleanup cron

2. **신규 위탁업체 개설 마법사에 요금제 패키지 통합**
   - 마지막 단계에 4 패키지 카드 + 선택
   - 생성 직후 `apply-package` 자동 호출
   - 프리셋 패키지 별 영업가 표시(`monthlyHint` 활용)

3. **TTS 메시지 분기 정밀화**
   - 일반 공지 vs AI 인근 dispatch 알림 메시지 분리
   - "회사에서 새 민원이 인근에 발생했습니다" 별도 발화

4. **announcement audit 페이지**
   - `/super-admin?tab=audit` 에 `CONTRACTOR_PACKAGE_APPLY` / `CONTRACTOR_FEATURE_TOGGLE` 필터
   - 패키지 변경 이력 시각화 (회사별 변경 그래프)

5. **세션 페이로드에 contractor.municipalityId 캐시**
   - 현재 announcement GET 필터에서 매번 Contractor 조회 → 세션 cookie 에 미리 저장하여 1쿼리 절감

6. **이전 세션 미해결 이슈 복귀**
   - HTTPS 인증서 (Cloudflare 또는 Let's Encrypt)
   - 워커 로그아웃 버튼 위치 재검토
   - 회사/슈퍼/매니저 데스크톱 UI 품질 개선

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
