'use client';

/**
 * dealer-channel Design §5.4 — SUPER_ADMIN 리드 승인 탭.
 * PENDING 리드를 검토해 승인(실계정 프로비저닝) 또는 반려한다.
 *
 * 2026-07-06 승인플로우 간소화: 딜러가 등록/보강한 회사정보를 그대로 검토 폼에 채워서 보여주고,
 * SUPER_ADMIN은 필요 시 정정 후 승인 버튼만 누르면 된다(값을 처음부터 타이핑할 필요 없음).
 * adminPassword는 입력 필드 자체가 없음 — 승인 시 시스템이 자동생성해 1회 표시.
 */
import { useEffect, useState } from 'react';

type Lead = {
  id: string;
  dealerId: string;
  prospectName: string;
  prospectContact: string | null;
  referralCode: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  memo: string | null;
  createdAt: string;
  municipalityName: string | null;
  municipalityCode: string | null;
  municipalityRegion: string | null;
  contractorName: string | null;
  contractorBusinessNo: string | null;
  adminUsername: string | null;
  adminName: string | null;
};

type ReviewForm = {
  municipalityName: string;
  municipalityCode: string;
  municipalityRegion: string;
  contractorName: string;
  contractorBusinessNo: string;
  adminUsername: string;
  adminName: string;
};

const REQUIRED_KEYS: (keyof ReviewForm)[] = [
  'municipalityName', 'municipalityCode', 'contractorName', 'contractorBusinessNo', 'adminUsername', 'adminName',
];

const FIELD_LABELS: [keyof ReviewForm, string][] = [
  ['municipalityName', '지자체명'], ['municipalityCode', '지자체 코드'], ['municipalityRegion', '광역(선택)'],
  ['contractorName', '위탁업체명'], ['contractorBusinessNo', '사업자번호'],
  ['adminUsername', '관리자 아이디'], ['adminName', '관리자 이름'],
];

function leadToForm(lead: Lead): ReviewForm {
  return {
    municipalityName: lead.municipalityName ?? '',
    municipalityCode: lead.municipalityCode ?? '',
    municipalityRegion: lead.municipalityRegion ?? '',
    contractorName: lead.contractorName ?? lead.prospectName,
    contractorBusinessNo: lead.contractorBusinessNo ?? '',
    adminUsername: lead.adminUsername ?? '',
    adminName: lead.adminName ?? '',
  };
}

export default function LeadsTab() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<Lead | null>(null);
  const [form, setForm] = useState<ReviewForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [approvedResult, setApprovedResult] = useState<{ adminUsername: string; adminPassword?: string } | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/super-admin/leads?status=PENDING');
    if (res.ok) {
      const data = await res.json();
      setLeads(data.items);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startApprove(lead: Lead) {
    setApproving(lead);
    setForm(leadToForm(lead));
    setError(null);
    setApprovedResult(null);
  }

  const missing = form ? REQUIRED_KEYS.filter((k) => !form[k].trim()) : [];

  async function submitApprove() {
    if (!approving || !form) return;
    setError(null);
    setSubmitting(true);
    const res = await fetch(`/api/super-admin/leads/${approving.id}/approve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, municipalityRegion: form.municipalityRegion || undefined }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(
        body?.error === 'lead_incomplete'
          ? `필수 항목 누락: ${(body.missing ?? []).join(', ')}`
          : (body?.error ?? '승인에 실패했습니다.'),
      );
      return;
    }
    const data = await res.json();
    setApprovedResult({ adminUsername: data.adminUsername, adminPassword: data.adminPassword });
    setLeads((prev) => prev.filter((l) => l.id !== approving.id));
  }

  async function reject(lead: Lead) {
    const res = await fetch(`/api/super-admin/leads/${lead.id}/reject`, { method: 'PATCH' });
    if (res.ok) setLeads((prev) => prev.filter((l) => l.id !== lead.id));
  }

  return (
    <div className="p-4">
      <h2 className="mb-4 text-lg font-semibold">딜러 리드 승인</h2>

      {loading ? (
        <p className="text-sm text-ink-muted">불러오는 중…</p>
      ) : leads.length === 0 ? (
        <p className="text-sm text-ink-muted">대기 중인 리드가 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {leads.map((lead) => (
            <li key={lead.id} className="rounded border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{lead.prospectName}</p>
                  <p className="text-xs text-ink-muted">{lead.referralCode} · 딜러ID {lead.dealerId}</p>
                  {!lead.municipalityCode || !lead.contractorBusinessNo ? (
                    <p className="text-xs text-amber-700">⚠ 회사정보 일부 미입력 — 승인 전 딜러 보강 필요할 수 있음</p>
                  ) : null}
                </div>
                <div className="space-x-2">
                  <button onClick={() => startApprove(lead)} className="rounded bg-blue-600 px-3 py-1 text-sm text-white">검토</button>
                  <button onClick={() => reject(lead)} className="rounded border border-red-300 px-3 py-1 text-sm text-red-700">반려</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {approving && form && !approvedResult && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg space-y-3 rounded-lg bg-white p-6">
            <h3 className="text-lg font-semibold">{approving.prospectName} — 검토 후 승인</h3>
            <p className="text-xs text-ink-muted">딜러가 입력한 값입니다. 필요하면 정정 후 승인하세요. 관리자 초기 비밀번호는 승인 시 자동 생성됩니다.</p>
            {FIELD_LABELS.map(([key, label]) => (
              <div key={key}>
                <label className="mb-1 block text-sm font-medium">
                  {label}{REQUIRED_KEYS.includes(key) && <span className="text-red-600"> *</span>}
                </label>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={form[key]}
                  onChange={(e) => setForm((f) => f && ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setApproving(null)} className="rounded border border-slate-300 px-3 py-2 text-sm">취소</button>
              <button
                onClick={submitApprove}
                disabled={submitting || missing.length > 0}
                title={missing.length > 0 ? `누락: ${missing.join(', ')}` : undefined}
                className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {submitting ? '처리 중…' : '승인 확정'}
              </button>
            </div>
          </div>
        </div>
      )}

      {approving && approvedResult && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg space-y-3 rounded-lg bg-emerald-50 border border-emerald-200 p-6">
            <h3 className="text-lg font-semibold">승인 완료 — 아래 계정을 고객에게 전달하세요</h3>
            <p className="text-sm">아이디: <span className="font-mono">{approvedResult.adminUsername}</span></p>
            <p className="text-sm">초기 비밀번호: <span className="font-mono">{approvedResult.adminPassword}</span></p>
            <p className="text-xs text-ink-muted">이 화면을 벗어나면 비밀번호를 다시 볼 수 없습니다.</p>
            <div className="flex justify-end pt-2">
              <button onClick={() => { setApproving(null); setApprovedResult(null); }} className="rounded bg-blue-600 px-3 py-2 text-sm text-white">
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
