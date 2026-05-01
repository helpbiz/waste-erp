/* CleanERP 사용자 매뉴얼 — 메타·역할·라우트 정의.
   가변 데이터(브랜드명, 도메인 등)는 /app/intro/_config.ts (BRAND) 재사용.

   변경 시: 매뉴얼 버전·갱신일·역할 라벨/카드 카피 수정 가능. */

import { BRAND } from '../intro/_config';

export const MANUAL_META = {
  title: 'CleanERP 사용자 매뉴얼',
  brand: BRAND.company,
  domain: BRAND.serviceUrl,
  version: 'v1.0',
  lastUpdated: '2026-05-02',
  /** 푸터·표지에 보이는 한 줄 슬로건. */
  motto: '처음 쓰는 분도 막힘없이 — 공비Lab의 배려.',
} as const;

export const ROLES = [
  {
    key: 'worker',
    label: '근로자',
    subtitle: '운전원·수거원·기동반',
    /** 카드 아이콘 자리 (모노 텍스트). */
    glyph: 'W',
    tone: 'cyan' as const,
    route: '/manual/worker',
    pdfName: '근로자_사용설명서.pdf',
    /** 카드에 노출되는 핵심 사용 영역 3개. */
    bullets: [
      '모바일로 출근 도장 찍기',
      '오늘의 작업·민원 처리',
      '휴가 신청·TBM 서명',
    ],
    /** "내 역할은?" 가이드에서 매칭 키워드. */
    keywords: ['운전원', '수거원', '기동반', '환경공무직', '청소원', '현장 직원'],
  },
  {
    key: 'contractor',
    label: '회사관리자',
    subtitle: '대표 · 팀장 · 안전관리자',
    glyph: 'C',
    tone: 'teal' as const,
    route: '/manual/contractor',
    pdfName: '회사관리자_사용설명서.pdf',
    bullets: [
      '직원·차량·결재라인 관리',
      '민원 배정·휴가 결재·실적 보고',
      '안전점검 검토·지자체 보고서 출력',
    ],
    keywords: ['대표', '사장', '팀장', '실장', '관리자', '회사 운영', '결재', '배차'],
  },
  {
    key: 'muni',
    label: '지자체관리자',
    subtitle: '시·군·구 환경과 직원',
    glyph: 'M',
    tone: 'navy' as const,
    route: '/manual/muni',
    pdfName: '지자체관리자_사용설명서.pdf',
    bullets: [
      '관할 위탁업체 모니터링',
      '민원·안전 보고 조회',
      '월간 보고서 다운로드',
    ],
    keywords: ['지자체', '시청', '구청', '환경과', '관할', '감독'],
  },
] as const;

export type RoleKey = (typeof ROLES)[number]['key'];

/** 한 역할의 정의를 키로 가져오기. */
export function getRole(key: RoleKey) {
  const role = ROLES.find((r) => r.key === key);
  if (!role) throw new Error(`Unknown role: ${key}`);
  return role;
}
