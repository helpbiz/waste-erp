'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Config = {
  id: string;
  ppaegiUsername: string | null;
  hasPassword: boolean;
  lastLoginAt: string | null;
  lastLoginOk: boolean | null;
  lastLoginMessage: string | null;
  importTimeKst: string;
  resolveTimeKst: string;
  autoEnabled: boolean;
  adminDongCodes: string | null;
  lastImportAt: string | null;
  lastImportCount: number;
  lastResolveAt: string | null;
  lastResolveCount: number;
};

type ImportRow = {
  id: string;
  triggerType: string;
  resultStatus: string;
  fetched: number;
  created: number;
  resolved: number;
  errorMessage: string | null;
  createdAt: string;
};

type ComplaintRow = {
  id: string;
  status: string;
  citizenName: string | null;
  citizenPhone: string | null;
  locationAddress: string | null;
  description: string | null;
  reportedAt: string;
  resolvedAt: string | null;
};

const CSTATUS: Record<string, string> = {
  RECEIVED: '접수', ASSIGNED: '배정', IN_PROGRESS: '처리중', COMPLETED: '완료', REJECTED: '반려',
};

export default function BulkyWasteClient({
  canManage, config, recentImports, recentComplaints,
}: {
  canManage: boolean;
  config: Config | null;
  recentImports: ImportRow[];
  recentComplaints: ComplaintRow[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    ppaegiUsername: config?.ppaegiUsername ?? '',
    ppaegiPassword: '',
    importTimeKst: config?.importTimeKst ?? '03:00',
    resolveTimeKst: config?.resolveTimeKst ?? '17:00',
    autoEnabled: config?.autoEnabled ?? true,
    adminDongCodes: config?.adminDongCodes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [running, setRunning] = useState<'import' | 'resolve' | 'both' | null>(null);
  const [runResult, setRunResult] = useState<unknown>(null);

  async function save() {
    setSaving(true);
    const payload: Record<string, unknown> = {
      ppaegiUsername: form.ppaegiUsername || null,
      importTimeKst: form.importTimeKst,
      resolveTimeKst: form.resolveTimeKst,
      autoEnabled: form.autoEnabled,
      adminDongCodes: form.adminDongCodes || null,
    };
    if (form.ppaegiPassword) payload.ppaegiPassword = form.ppaegiPassword;
    const res = await fetch('/api/bulky-waste/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) { alert('저장됨'); setForm({ ...form, ppaegiPassword: '' }); router.refresh(); }
    else alert('실패: ' + (await res.json().catch(() => ({}))).error);
  }

  async function test() {
    if (!form.ppaegiUsername || !form.ppaegiPassword) {
      alert('아이디/비밀번호를 입력하세요.');
      return;
    }
    setTesting(true);
    setTestResult(null);
    const res = await fetch('/api/bulky-waste/test-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: form.ppaegiUsername, password: form.ppaegiPassword }),
    });
    const data = await res.json();
    setTesting(false);
    setTestResult({ ok: data.ok, message: data.message });
  }

  async function runManual(mode: 'import' | 'resolve' | 'both') {
    if (!confirm(`${mode === 'import' ? '자동반영(import)' : mode === 'resolve' ? '처리완료(resolve)' : '전체 (import+resolve)'} 즉시 실행하시겠습니까?`)) return;
    setRunning(mode);
    setRunResult(null);
    const res = await fetch('/api/bulky-waste/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    const data = await res.json();
    setRunning(null);
    setRunResult(data);
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-extrabold text-ink">대형폐기물 설정</h2>
        <span className="text-xs font-mono font-bold text-slate-600">공유 App(bbegi.com) 앱 연동</span>
        <a href="https://bbegi.com/login" target="_blank" rel="noopener noreferrer"
          className="ml-auto text-[11px] font-bold text-cyan-900 hover:underline">
          🔗 공유 App 로그인 페이지 (bbegi.com/login) ↗
        </a>
      </div>

      {/* 설정 폼 */}
      <div className="bg-surface border border-line rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-100 border-b border-line">
          <span className="text-sm font-extrabold text-ink">⚙ 공유 App 인증 정보 + 자동화 설정</span>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          <Field label="공유 App 아이디">
            <input value={form.ppaegiUsername} onChange={(e) => setForm({ ...form, ppaegiUsername: e.target.value })}
              disabled={!canManage}
              className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold disabled:bg-slate-50" />
          </Field>
          <Field label="공유 App 비밀번호 (변경 시만 입력)">
            <input type="password" value={form.ppaegiPassword} onChange={(e) => setForm({ ...form, ppaegiPassword: e.target.value })}
              disabled={!canManage}
              placeholder={config?.hasPassword ? '••••••••• (저장됨, 변경 시 입력)' : '비밀번호'}
              className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold disabled:bg-slate-50" />
          </Field>

          <div className="col-span-2 flex items-center gap-2">
            <button onClick={test} disabled={testing || !canManage || !form.ppaegiUsername || !form.ppaegiPassword}
              className="px-4 py-1.5 rounded text-xs font-extrabold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {testing ? '테스트 중…' : '🔑 로그인 테스트'}
            </button>
            {testResult && (
              <span className={`text-xs font-extrabold px-2 py-1 rounded border-2 ${
                testResult.ok ? 'bg-emerald-100 text-emerald-800 border-emerald-500' : 'bg-red-100 text-red-800 border-red-500'
              }`}>
                {testResult.ok ? '✓ 성공' : '✗ 실패'} — {testResult.message}
              </span>
            )}
            {!testResult && config?.lastLoginAt && (
              <span className={`text-[11px] font-mono ${config.lastLoginOk ? 'text-emerald-700' : 'text-red-600'}`}>
                마지막 시도: {new Date(config.lastLoginAt).toLocaleString('ko-KR')} {config.lastLoginOk ? '✓' : '✗'} {config.lastLoginMessage}
              </span>
            )}
          </div>

          <Field label="자동 import 시각 (KST)">
            <input type="time" value={form.importTimeKst} onChange={(e) => setForm({ ...form, importTimeKst: e.target.value })}
              disabled={!canManage}
              className="px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-extrabold disabled:bg-slate-50" />
          </Field>
          <Field label="자동 처리완료 시각 (KST)">
            <input type="time" value={form.resolveTimeKst} onChange={(e) => setForm({ ...form, resolveTimeKst: e.target.value })}
              disabled={!canManage}
              className="px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-extrabold disabled:bg-slate-50" />
          </Field>

          <Field label="대상 행정동 코드 (CSV — 미입력 시 시안 기본 2개)" colSpan={2}>
            <input value={form.adminDongCodes} onChange={(e) => setForm({ ...form, adminDongCodes: e.target.value })}
              disabled={!canManage}
              placeholder="예: 1168010100,1168010200,1168010300"
              className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono disabled:bg-slate-50" />
          </Field>

          <div className="col-span-2 flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={form.autoEnabled} onChange={(e) => setForm({ ...form, autoEnabled: e.target.checked })}
                disabled={!canManage} />
              자동 cron 활성화 (꺼두면 수동만)
            </label>
          </div>
        </div>
        {canManage && (
          <div className="px-5 py-3 border-t border-line bg-slate-50 flex justify-end gap-2">
            <button disabled={saving} onClick={save}
              className="px-5 py-1.5 rounded text-sm font-extrabold bg-accent text-white hover:bg-accent-strong disabled:opacity-50">
              {saving ? '저장 중…' : '설정 저장'}
            </button>
          </div>
        )}
      </div>

      {/* 자동반영 + 처리완료 트리거 */}
      {canManage && config?.hasPassword && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-4">
          <div className="text-sm font-extrabold text-emerald-900 mb-2">🚀 자동반영 / 처리완료 즉시 실행 (수동)</div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => runManual('import')} disabled={running !== null}
              className="px-4 py-2 rounded text-sm font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
              {running === 'import' ? '실행 중…' : '📥 자동반영 확인 (import 즉시 실행)'}
            </button>
            <button onClick={() => runManual('resolve')} disabled={running !== null}
              className="px-4 py-2 rounded text-sm font-extrabold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {running === 'resolve' ? '실행 중…' : '✓ 처리완료 (resolve 즉시 실행)'}
            </button>
            <button onClick={() => runManual('both')} disabled={running !== null}
              className="px-4 py-2 rounded text-sm font-extrabold bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50">
              {running === 'both' ? '실행 중…' : '🔁 둘 다 실행'}
            </button>
          </div>
          {runResult != null && (
            <div className="mt-3 px-3 py-2 rounded bg-white border border-line text-[11px] font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(runResult, null, 2)}
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white border border-line rounded p-2">
              <div className="font-bold text-emerald-700">마지막 import</div>
              <div className="font-mono">{config.lastImportAt ? new Date(config.lastImportAt).toLocaleString('ko-KR') : '—'}</div>
              <div className="font-mono">생성: {config.lastImportCount}건</div>
            </div>
            <div className="bg-white border border-line rounded p-2">
              <div className="font-bold text-blue-700">마지막 resolve</div>
              <div className="font-mono">{config.lastResolveAt ? new Date(config.lastResolveAt).toLocaleString('ko-KR') : '—'}</div>
              <div className="font-mono">완료 처리: {config.lastResolveCount}건</div>
            </div>
          </div>
        </div>
      )}

      {/* 실행 이력 */}
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-100 border-b border-line text-sm font-extrabold text-ink">실행 이력 (최근 20)</div>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="실행 이력 표">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-[10px] font-mono font-extrabold text-slate-700 uppercase">
            <tr>
              <th className="px-3 py-1.5 text-left">시각</th>
              <th className="px-3 py-1.5 text-left">유형</th>
              <th className="px-3 py-1.5 text-left">결과</th>
              <th className="px-3 py-1.5 text-right">조회</th>
              <th className="px-3 py-1.5 text-right">생성</th>
              <th className="px-3 py-1.5 text-right">완료</th>
              <th className="px-3 py-1.5 text-left">에러</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {recentImports.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">실행 이력이 없습니다.</td></tr>
            )}
            {recentImports.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-1.5 font-mono text-[11px]">{new Date(r.createdAt).toLocaleString('ko-KR')}</td>
                <td className="px-3 py-1.5 text-xs font-bold">{r.triggerType === 'cron' ? 'CRON' : '수동'}</td>
                <td className="px-3 py-1.5">
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${
                    r.resultStatus === 'ok' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-red-100 text-red-800 border-red-300'
                  }`}>{r.resultStatus.toUpperCase()}</span>
                </td>
                <td className="px-3 py-1.5 text-right font-mono">{r.fetched}</td>
                <td className="px-3 py-1.5 text-right font-mono font-extrabold text-emerald-700">{r.created}</td>
                <td className="px-3 py-1.5 text-right font-mono font-extrabold text-blue-700">{r.resolved}</td>
                <td className="px-3 py-1.5 text-[10px] text-red-600 max-w-[200px] truncate" title={r.errorMessage ?? ''}>
                  {r.errorMessage ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* 자동 등록된 BULKY_WASTE 민원 */}
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-100 border-b border-line text-sm font-extrabold text-ink">
          자동 등록된 대형폐기물 민원 (최근 30)
        </div>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="자동 등록 민원 표">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-[10px] font-mono font-extrabold text-slate-700 uppercase">
            <tr>
              <th className="px-3 py-1.5 text-left">신고일</th>
              <th className="px-3 py-1.5 text-left">시민</th>
              <th className="px-3 py-1.5 text-left">주소</th>
              <th className="px-3 py-1.5 text-left">품목·내용</th>
              <th className="px-3 py-1.5 text-left">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {recentComplaints.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">등록된 대형폐기물 민원이 없습니다.</td></tr>
            )}
            {recentComplaints.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-3 py-1.5 font-mono text-[11px]">{new Date(c.reportedAt).toLocaleString('ko-KR')}</td>
                <td className="px-3 py-1.5 text-xs">{c.citizenName ?? '—'}</td>
                <td className="px-3 py-1.5 text-xs max-w-[180px] truncate" title={c.locationAddress ?? ''}>{c.locationAddress ?? '—'}</td>
                <td className="px-3 py-1.5 text-xs max-w-[300px] truncate" title={c.description ?? ''}>{c.description ?? '—'}</td>
                <td className="px-3 py-1.5">
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${
                    c.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                    c.status === 'REJECTED' ? 'bg-red-100 text-red-800 border-red-300' :
                    'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>{CSTATUS[c.status] ?? c.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <div className="text-[11px] font-mono text-slate-600 px-4 py-2 bg-slate-50 rounded">
        💡 <strong>Cron 호출 안내</strong>: 외부 cron(Vercel/K8s/GitHub Actions)에서 매일 03시·17시 KST에<br />
        <code>POST /api/cron/bulky-waste-import</code> / <code>POST /api/cron/bulky-waste-resolve</code>를<br />
        Bearer 토큰(<code>CRON_SECRET</code>)과 함께 호출. importTimeKst±10분 윈도우 내 config만 자동 처리.
      </div>
    </div>
  );
}

// Design Ref: field-label-refactor §2 — shared Field로 통합 (colSpan 호환)
import { Field as BaseField } from '@/components/Field';
type FieldArgs = React.ComponentProps<typeof BaseField>;
function Field(props: FieldArgs) {
  return <BaseField {...props} labelClassName={props.labelClassName ?? 'block text-[11px] font-mono font-extrabold text-slate-600 mb-1'} />;
}
