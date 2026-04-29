/**
 * P1-2: 권한 매트릭스 인쇄용 페이지.
 * /super-admin/permission-print — 운영자 책상 비치용 단일 페이지 (Ctrl+P → PDF).
 *
 * Design Ref: docs/specs/08_역할권한_설계서.md §4 권한 매트릭스 + Phase 1 P1-2.
 * 권한: SUPER_ADMIN 전용 (admin layout 에서 검증).
 */
import { readSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PrintActions from './_print-actions';

export const dynamic = 'force-dynamic';

type Row = { task: string; super: string; muni: string; contractor: string; internal: string; worker: string; group: string };

const ROWS: Row[] = [
  { group: '회사 마스터',  task: '회사(거래처) 등록',     super: '✅', muni: '❌', contractor: '❌',         internal: '❌',         worker: '❌' },
  { group: '회사 마스터',  task: '회사 정보 수정',        super: '✅', muni: '❌', contractor: '✅ 자기회사', internal: '❌',         worker: '❌' },
  { group: '회사 마스터',  task: '회사 삭제 (soft)',      super: '✅', muni: '❌', contractor: '❌',         internal: '❌',         worker: '❌' },
  { group: '회사 마스터',  task: '지자체 등록',           super: '✅', muni: '❌', contractor: '❌',         internal: '❌',         worker: '❌' },
  { group: '권한',        task: '권한 매트릭스 변경',     super: '✅', muni: '❌', contractor: '❌',         internal: '❌',         worker: '❌' },
  { group: '권한',        task: 'MUNI_ADMIN 발급',        super: '✅', muni: '❌', contractor: '❌',         internal: '❌',         worker: '❌' },
  { group: '권한',        task: 'CONTRACTOR_ADMIN 발급',  super: '✅', muni: '❌', contractor: '❌',         internal: '❌',         worker: '❌' },
  { group: '권한',        task: 'INTERNAL_ADMIN 발급',    super: '✅', muni: '❌', contractor: '✅ 자기회사', internal: '❌',         worker: '❌' },
  { group: '권한',        task: 'WORKER 발급',            super: '✅', muni: '❌', contractor: '✅ 자기회사', internal: '✅ 자기회사', worker: '❌' },
  { group: '권한',        task: 'PW 재설정 (전체)',       super: '✅', muni: '❌', contractor: '❌',         internal: '❌',         worker: '❌' },
  { group: '권한',        task: 'PW 재설정 (자기회사)',   super: '✅', muni: '❌', contractor: '✅',         internal: '✅',         worker: '❌' },
  { group: '운영',        task: '차량 등록·수정',         super: '✅', muni: '❌', contractor: '✅ 자기회사', internal: '✅ 자기회사', worker: '❌' },
  { group: '운영',        task: '결재 라인 변경',         super: '✅', muni: '❌', contractor: '✅ 자기회사', internal: '❌',         worker: '❌' },
  { group: '운영',        task: '휴가 1차 결재',          super: '—',  muni: '—',  contractor: '✅',          internal: '✅',         worker: '❌' },
  { group: '운영',        task: '휴가 2차 결재',          super: '—',  muni: '—',  contractor: '✅',          internal: '❌',         worker: '❌' },
  { group: '운영',        task: '민원 배정',              super: '✅', muni: '❌', contractor: '✅ 자기회사', internal: '✅ 자기회사', worker: '❌' },
  { group: '워커',        task: '민원 처리',              super: '—',  muni: '—',  contractor: '—',           internal: '—',          worker: '✅ 배정건' },
  { group: '워커',        task: '출퇴근 기록',            super: '—',  muni: '—',  contractor: '—',           internal: '—',          worker: '✅ 본인' },
  { group: '워커',        task: 'TBM 서명',               super: '—',  muni: '—',  contractor: '—',           internal: '—',          worker: '✅ 본인' },
  { group: '모니터링',    task: '출퇴근 모니터링',        super: '✅', muni: '조회', contractor: '✅ 자기회사', internal: '✅ 자기회사', worker: '❌' },
  { group: '모니터링',    task: '통계/보고서 출력',       super: '✅', muni: '✅ 조회·DL', contractor: '✅', internal: '✅',         worker: '❌' },
  { group: '모니터링',    task: '감사 로그 조회',         super: '✅', muni: '❌', contractor: '❌',         internal: '❌',         worker: '❌' },
  { group: '모니터링',    task: '시스템 모니터링',        super: '✅', muni: '❌', contractor: '❌',         internal: '❌',         worker: '❌' },
  { group: '모니터링',    task: '요금제·청구',            super: '✅', muni: '❌', contractor: '조회만',     internal: '❌',         worker: '❌' },
];

export default async function PermissionPrintPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  if (session.role !== 'SUPER_ADMIN') redirect('/');

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="permission-print-root">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 14mm 12mm; }
          body { background: white !important; }
          .permission-print-root { color: #000; }
          .no-print { display: none !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
        .permission-print-root { background: white; padding: 24px; max-width: 900px; margin: 0 auto; color: #111; }
        .permission-print-root h1 { font-size: 20px; font-weight: 900; margin: 0 0 4px; }
        .permission-print-root .meta { font-size: 11px; color: #555; margin-bottom: 12px; }
        .permission-print-root table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .permission-print-root th, .permission-print-root td { border: 1px solid #555; padding: 4px 6px; text-align: left; vertical-align: middle; }
        .permission-print-root th { background: #f1f5f9; font-weight: 800; font-size: 10px; text-align: center; }
        .permission-print-root td.center { text-align: center; }
        .permission-print-root td.group { background: #fafafa; font-weight: 700; font-size: 10px; color: #444; width: 60px; }
        .permission-print-root .role-h { font-size: 9px; font-weight: 700; color: #6b21a8; }
        .permission-print-root .legend { margin-top: 10px; font-size: 10px; color: #444; }
        .permission-print-root .footer { margin-top: 12px; font-size: 9px; color: #888; text-align: right; border-top: 1px solid #ddd; padding-top: 6px; }
        .permission-print-root .actions { margin-bottom: 14px; display: flex; gap: 8px; }
        .permission-print-root .actions button { padding: 6px 12px; border: 1px solid #6b21a8; background: #faf5ff; color: #6b21a8; font-weight: 700; cursor: pointer; border-radius: 4px; }
        .permission-print-root .actions button:hover { background: #6b21a8; color: white; }
      `}</style>

      <PrintActions />

      <h1>CleanERP 역할 · 권한 매트릭스 (v1.0)</h1>
      <div className="meta">출력일: {today} · 본 자료는 docs/specs/08_역할권한_설계서.md §4 권한 매트릭스 기준입니다.</div>

      <table>
        <thead>
          <tr>
            <th style={{ width: 60 }}>분류</th>
            <th style={{ minWidth: 180 }}>작업</th>
            <th style={{ width: 60 }}>SUPER<div className="role-h">시스템</div></th>
            <th style={{ width: 60 }}>MUNI<div className="role-h">지자체</div></th>
            <th style={{ width: 90 }}>CONTRACTOR<div className="role-h">회사</div></th>
            <th style={{ width: 90 }}>INTERNAL<div className="role-h">팀장</div></th>
            <th style={{ width: 80 }}>WORKER<div className="role-h">근로자</div></th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r, i) => (
            <tr key={i}>
              <td className="group">{r.group}</td>
              <td>{r.task}</td>
              <td className="center">{r.super}</td>
              <td className="center">{r.muni}</td>
              <td className="center">{r.contractor}</td>
              <td className="center">{r.internal}</td>
              <td className="center">{r.worker}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="legend">
        <b>범례</b>: ✅ 가능 · ❌ 불가 · — 해당없음 · &quot;자기회사&quot; = 본인 소속 회사 한정 · &quot;조회&quot; = 읽기만 (수정 불가)
      </div>

      <div className="footer">
        CleanERP — Multi-tenant 안전 격리: 모든 데이터는 contractor_id + municipality_id 로 자동 태그됨.<br />
        문의: 헬프비즈 운영팀 (4365won@gmail.com)
      </div>
    </div>
  );
}
