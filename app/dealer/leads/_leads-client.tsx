'use client';

/**
 * 딜러 리드 등록/조회. Design §5.4 Page UI Checklist.
 * 딜러는 잠재고객명·연락처·메모로 가볍게 리드를 먼저 등록하고, 상담이 구매의사 단계로
 * 넘어가면(예: 예비고객의 "테스트해보고 싶다" 요청 시점) 회사정보를 이어서 입력할 수 있다.
 * 실제 지자체/위탁업체 계정 생성은 SUPER_ADMIN 승인 후 자동 처리된다(딜러는 직접 생성 불가).
 * 관리자 초기 비밀번호는 절대 여기서 입력받지 않음 — 승인 시 시스템이 자동생성.
 * 2026-07-06 승인플로우 간소화.
 */
import { useEffect, useState } from 'react';

type LeadStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type Lead = {
  id: string;
  prospectName: string;
  prospectContact: string | null;
  referralCode: string;
  status: LeadStatus;
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

type CompanyFields = {
  municipalityName: string;
  municipalityCode: string;
  municipalityRegion: string;
  contractorName: string;
  contractorBusinessNo: string;
  adminUsername: string;
  adminName: string;
};

const EMPTY_COMPANY: CompanyFields = {
  municipalityName: '', municipalityCode: '', municipalityRegion: '',
  contractorName: '', contractorBusinessNo: '', adminUsername: '', adminName: '',
};

const COMPANY_FIELD_LABELS: [keyof CompanyFields, string][] = [
  ['municipalityName', '지자체명'], ['municipalityCode', '지자체 코드'], ['municipalityRegion', '광역(선택)'],
  ['contractorName', '위탁업체명'], ['contractorBusinessNo', '사업자번호'],
  ['adminUsername', '관리자 아이디'], ['adminName', '관리자 이름'],
];

const STATUS_LABEL: Record<LeadStatus, { text: string; className: string }> = {
  PENDING: { text: '승인대기', className: 'bg-amber-100 text-amber-900 border-amber-200' },
  APPROVED: { text: '승인완료', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  REJECTED: { text: '반려', className: 'bg-red-100 text-red-800 border-red-200' },
};

function leadHasCompanyInfo(lead: Lead): boolean {
  return !!(lead.municipalityCode || lead.contractorBusinessNo);
}

export default function LeadsClient() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prospectName, setProspectName] = useState('');
  const [prospectContact, setProspectContact] = useState('');
  const [memo, setMemo] = useState('');
  const [showCompanyFields, setShowCompanyFields] = useState(false);
  const [company, setCompany] = useState<CompanyFields>(EMPTY_COMPANY);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CompanyFields>(EMPTY_COMPANY);
  const [editSubmitting, setEditSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/dealer/leads');
    if (res.ok) {
      const data = await res.json();
      setLeads(data.items);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!prospectName.trim()) {
      setError('예상 고객사명을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    const res = await fetch('/api/dealer/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prospectName,
        prospectContact: prospectContact || null,
        memo: memo || null,
        ...(showCompanyFields ? company : {}),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error ?? '리드 등록에 실패했습니다.');
      return;
    }
    setProspectName('');
    setProspectContact('');
    setMemo('');
    setCompany(EMPTY_COMPANY);
    setShowCompanyFields(false);
    await load();
  }

  function startEdit(lead: Lead) {
    setEditingLeadId(lead.id);
    setEditForm({
      municipalityName: lead.municipalityName ?? '',
      municipalityCode: lead.municipalityCode ?? '',
      municipalityRegion: lead.municipalityRegion ?? '',
      contractorName: lead.contractorName ?? lead.prospectName,
      contractorBusinessNo: lead.contractorBusinessNo ?? '',
      adminUsername: lead.adminUsername ?? '',
      adminName: lead.adminName ?? '',
    });
  }

  async function submitEdit(leadId: string) {
    setEditSubmitting(true);
    const res = await fetch(`/api/dealer/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setEditSubmitting(false);
    if (res.ok) {
      setEditingLeadId(null);
      await load();
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-bold">리드 등록</h1>
      <p className="mb-4 text-sm text-ink-muted">
        먼저 시스템을 소개하고, 예비고객이 &ldquo;테스트해보고 싶다&rdquo;고 하면 아래 회사정보를 입력해 주세요
        (지금 몰라도 나중에 리드 목록에서 &ldquo;정보 입력&rdquo;으로 이어서 채울 수 있습니다).
      </p>

      <form onSubmit={onSubmit} className="mb-8 space-y-3 rounded-lg border border-slate-200 p-4">
        <div>
          <label className="mb-1 block text-sm font-medium">예상 고객사명</label>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={prospectName}
            onChange={(e) => setProspectName(e.target.value)}
            placeholder="예: OO시 환경과"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">연락처 (선택)</label>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={prospectContact}
            onChange={(e) => setProspectContact(e.target.value)}
            placeholder="010-0000-0000"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">메모 (선택)</label>
          <textarea
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
          />
        </div>

        <button
          type="button"
          onClick={() => setShowCompanyFields((v) => !v)}
          className="text-sm text-blue-700 underline"
        >
          {showCompanyFields ? '회사정보 접기' : '+ 테스트 요청 받음 — 회사정보 지금 입력'}
        </button>

        {showCompanyFields && (
          <div className="space-y-3 rounded border border-slate-100 bg-slate-50 p-3">
            {COMPANY_FIELD_LABELS.map(([key, label]) => (
              <div key={key}>
                <label className="mb-1 block text-sm font-medium">{label}</label>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={company[key]}
                  onChange={(e) => setCompany((c) => ({ ...c, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? '등록 중…' : '리드 등록'}
        </button>
      </form>

      <h2 className="mb-3 text-lg font-semibold">내 리드 목록</h2>
      {loading ? (
        <p className="text-sm text-ink-muted">불러오는 중…</p>
      ) : leads.length === 0 ? (
        <p className="text-sm text-ink-muted">등록된 리드가 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {leads.map((lead) => (
            <li key={lead.id} className="rounded border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{lead.prospectName}</p>
                  <p className="text-xs text-ink-muted">
                    {lead.referralCode} · {new Date(lead.createdAt).toLocaleDateString('ko-KR')}
                    {!leadHasCompanyInfo(lead) && lead.status === 'PENDING' && ' · 회사정보 미입력'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {lead.status === 'PENDING' && (
                    <button onClick={() => startEdit(lead)} className="text-xs text-blue-700 underline">
                      정보 입력
                    </button>
                  )}
                  <span className={`rounded-full border px-2 py-1 text-xs ${STATUS_LABEL[lead.status].className}`}>
                    {STATUS_LABEL[lead.status].text}
                  </span>
                </div>
              </div>

              {editingLeadId === lead.id && (
                <div className="mt-3 space-y-3 rounded border border-slate-100 bg-slate-50 p-3">
                  {COMPANY_FIELD_LABELS.map(([key, label]) => (
                    <div key={key}>
                      <label className="mb-1 block text-sm font-medium">{label}</label>
                      <input
                        className="w-full rounded border border-slate-300 px-3 py-2"
                        value={editForm[key]}
                        onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingLeadId(null)} className="rounded border border-slate-300 px-3 py-1 text-sm">취소</button>
                    <button
                      onClick={() => submitEdit(lead.id)}
                      disabled={editSubmitting}
                      className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                    >
                      {editSubmitting ? '저장 중…' : '저장'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
