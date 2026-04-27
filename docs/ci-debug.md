# CI / E2E 디버깅 가이드

> **Workflow**: [.github/workflows/e2e.yml](../.github/workflows/e2e.yml)
> **Plan**: [e2e-ci-integration.plan.md](./01-plan/features/e2e-ci-integration.plan.md)
> **Design**: [e2e-ci-integration.design.md](./02-design/features/e2e-ci-integration.design.md)

---

## 1. 워크플로 구조

PR/main push 시 2-job 병렬 실행:

| Job | 검증 대상 | 시간 |
|---|---|---|
| `functional` | mobile-responsive (36) + tab-modal + login-flow + a11y | ~3분 |
| `visual` (depends on functional) | visual-regression 36 baseline 비교 | ~2분 |

각 job은 자체 PostgreSQL service + prisma migrate + seed + next build → next start (background) → playwright test 순서로 실행됩니다.

## 2. PR Checks 해석

| 표시 | 의미 | 액션 |
|---|---|---|
| ✅ functional + ✅ visual | 회귀 없음 | 머지 가능 |
| ❌ functional + ✅ visual | 코드 회귀 (가로 오버플로우 / 로그인 / a11y) | 코드 수정 |
| ✅ functional + ❌ visual | 시각 변경 (의도적 또는 false positive) | 아래 §4 절차 |
| ❌ functional + skipped visual | functional 실패로 visual 미실행 | functional 먼저 해결 |

## 3. 실패 시 디버깅 절차

### 3.1 artifact 다운로드

PR 페이지 → Checks → e2e → 해당 job → Summary 하단의 **Artifacts** 섹션:

- `playwright-report-functional` / `playwright-report-visual` — HTML 리포트 (실패 케이스 + 스크린샷 + trace)
- `test-results-functional` — 실패 케이스 trace.zip
- `visual-diffs` — `*-actual.png`, `*-expected.png`, `*-diff.png` (visual job 실패 시)

### 3.2 로컬 재현

```bash
# 동일 환경 재현 (Docker 사용)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# functional 회귀 재현
npm run e2e:mobile
npm run e2e:tab-modal
npm run e2e:login-flow
npm run e2e:a11y

# visual 회귀 재현
npm run e2e:visual

# UI 모드로 디버깅 (스텝 단위 실행)
npm run e2e:ui
```

### 3.3 trace 분석

```bash
npx playwright show-trace test-results/<test-name>/trace.zip
```

## 4. 시각 회귀 베이스라인 갱신 절차 (FR-10)

CI에서 visual job이 실패하지만 **의도된 디자인 변경**일 때:

### 4.1 결정

먼저 다음을 확인:

- [ ] artifact의 `*-diff.png`로 변화 부분 확인
- [ ] 변화가 의도적인가? (디자인 시스템 변경 / 새 컴포넌트 / 색상 토큰 갱신)
- [ ] false positive 가능성? (폰트 렌더링 / 시간 표시 / 무작위 데이터)
  - false positive면 → spec에 `mask:` 영역 추가 (visual-regression.spec.ts)

### 4.2 갱신 PR 생성

```bash
# 1. 별도 브랜치 생성
git checkout -b chore/visual-baseline-update-YYYYMMDD

# 2. 로컬에서 베이스라인 재생성
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
npm run e2e:update

# 3. 변경 확인
git status e2e/visual-regression.spec.ts-snapshots/
git diff --stat e2e/visual-regression.spec.ts-snapshots/

# 4. 커밋 + PR
git add e2e/visual-regression.spec.ts-snapshots/
git commit -m "chore(e2e): update visual baselines for <변경 사유>"
git push -u origin chore/visual-baseline-update-YYYYMMDD
gh pr create --title "chore(e2e): update visual baselines" --body "$(cat <<'EOF'
## 갱신 사유

- [ ] 디자인 변경 (색상/타이포/레이아웃)
- [ ] 신규 컴포넌트 추가
- [ ] 의도적 UI 리팩터링

## 변경된 페이지

- {페이지 목록}

## 검증

- [ ] CI visual job 통과 확인
- [ ] reviewer 승인 1건 이상
EOF
)"
```

### 4.3 리뷰 정책

- 베이스라인 갱신 PR은 **반드시 reviewer 1명 이상 승인** 필요
- diff PNG를 PR description에 첨부 또는 artifact 링크 명시
- 머지 전 `visual` job 통과 확인

## 5. 자주 발생하는 이슈

### 5.1 `App did not start in time` (functional/visual job)

원인: postgres 부팅 지연 또는 next build 캐시 문제.

확인:
1. job 로그에서 `pg_isready` 실패 확인
2. `NODE_ENV=production`에서 `next start`가 PORT=3000 binding 됐는지 확인

### 5.2 시각 diff false positive 빈발

원인: 시간 표시(`time` 태그), 무작위 데이터, 폰트 안티앨리어싱.

해결:
- `visual-regression.spec.ts`의 `mask:` 영역 확장
- `playwright.config.ts`의 `expect.toHaveScreenshot.maxDiffPixelRatio` 상향 조정 (0.01 → 0.02)

### 5.3 a11y critical 위반 PR 차단

원인: 신규 form 입력에 label 누락 등.

해결:
- `<input>` 에 `<label>` 또는 `aria-label` 추가
- `<select>` 에 accessible name 부여
- 임시 차단 회피가 필요하면 spec에서 `BLOCKING_IMPACTS` 일시 조정 (권장 안 함 — 별도 PDCA로 처리)

### 5.4 npm ci 실패 (legacy-peer-deps)

본 프로젝트는 `npm ci --legacy-peer-deps` 옵션 필수.
워크플로의 npm ci 단계에 이미 적용되어 있음. 로컬에서도 동일하게 사용.

## 6. 워크플로 변경 시

`.github/workflows/e2e.yml` 수정 후:

```bash
# 로컬에서 actionlint 검증 (설치 1회)
curl -sSfL https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash | bash
./actionlint .github/workflows/e2e.yml
```

검증 결과 0 출력 = 오류 없음.

## 7. 관련 명령어 요약

| 명령 | 용도 |
|---|---|
| `npm run e2e` | 모든 spec 실행 (4 device × 5 spec) |
| `npm run e2e:mobile` | 가로 오버플로우만 (36건) |
| `npm run e2e:visual` | 시각 회귀만 (36건) |
| `npm run e2e:tab-modal` | 탭/모달 시나리오 |
| `npm run e2e:login-flow` | 로그인 흐름 (375만) |
| `npm run e2e:a11y` | a11y critical (375만) |
| `npm run e2e:update` | **시각 베이스라인 갱신** (별도 PR 권장) |
| `npm run e2e:ui` | Playwright UI 인터랙티브 모드 |
| `npm run e2e:report` | HTML 리포트 열기 |

## 8. 관련 문서

- [e2e-ci-integration Plan](./01-plan/features/e2e-ci-integration.plan.md) — 도입 배경 + 요구사항
- [e2e-ci-integration Design](./02-design/features/e2e-ci-integration.design.md) — 아키텍처 + 모듈 분할
- [mobile-issues.md](./mobile-issues.md) — 본 CI가 막는 회귀의 출발점
