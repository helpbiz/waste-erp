<!--
PR을 생성하면 자동으로 이 템플릿이 채워집니다.
해당 없는 섹션은 그대로 두지 말고 삭제 또는 N/A로 표기해 주세요.
-->

## Summary

<!-- 변경한 내용을 1-3 bullet으로 요약. "왜" 변경했는지를 한 줄로. -->

- 
- 
- 

## Test plan

<!-- 검증 체크리스트. PR 생성 전 본인이 수행한 검증 + 리뷰어가 추가로 확인할 점. -->

- [ ] `npx tsc --noEmit` 무오류
- [ ] `npm run e2e:mobile` 37/37 PASS
- [ ] `npm run e2e:a11y` 10/10 PASS (critical+serious 차단 후)
- [ ] `npm run e2e:visual` 37/37 PASS (또는 baseline 갱신 안내)
- [ ] 기타: 

## Visual baseline 갱신 (해당 시)

<!--
디자인 토큰 / 색상 / 라벨 / 카드 레이아웃 등을 변경했다면 baseline 36개가 drift 됩니다.
아래 절차로 baseline을 자동 갱신하세요. (자세한 내용: docs/ci-debug.md §4)

1. 이 PR을 push한 후 visual job이 실패하는지 확인
2. https://github.com/helpbiz/waste-erp/actions/workflows/e2e.yml 접속
3. 우측 상단 "Run workflow" 드롭다운 → 본 PR branch 선택 → update_snapshots ✅ → Run workflow
4. github-actions[bot]이 새 baseline을 본 PR branch에 자동 commit
5. PR Checks 다시 통과 → merge 가능

해당 없으면 이 섹션은 삭제하세요.
-->

- [ ] 시각 변경 없음 — 본 섹션 N/A
- [ ] 시각 변경 있음 → workflow_dispatch로 baseline 재생성 완료 (commit: ____)

## Related PDCA / Issue

<!--
관련 PDCA 문서, mobile-issues.md 항목 번호, GitHub issue 등을 링크.
없으면 "N/A" 또는 삭제.
-->

- PDCA Plan: 
- PDCA Design: 
- Issue: #
- 관련 문서: 

## Checklist

- [ ] 코드 변경이 PR 제목 / Summary와 일치
- [ ] secret / `.env*` 파일이 staged 되지 않음 (`.env.example`만 OK)
- [ ] `package.json` 의존성 추가 시 사유를 Summary에 명시
- [ ] schema 변경 시 `prisma generate`로 client 갱신 + seed.ts 호환 확인

---

> 🤖 GitHub Actions가 자동으로 functional + visual e2e 검증을 실행합니다.  
> 두 check가 모두 ✅이어야 merge 가능합니다.
