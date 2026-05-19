'use client';

import { useEffect, useState } from 'react';

type ContractorInfo = {
  id: string;
  companyName: string;
  businessNo: string;
  municipalityName: string;
  ceoName: string | null;
  phoneMain: string | null;
  emailMain: string | null;
  garageAddress: string | null;
  garageLat: number | null;
  garageLng: number | null;
  contractStart: string | null;
  contractEnd: string | null;
  status: string;
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '정상',
  INACTIVE: '비활성',
  SUSPENDED: '정지',
  DELETED: '삭제',
};

export default function ContractorInfoSettingsPage() {
  const [info, setInfo] = useState<ContractorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    ceoName: '',
    phoneMain: '',
    emailMain: '',
    garageAddress: '',
  });

  async function load() {
    setLoading(true);
    const r = await fetch('/api/contractor/info');
    const j = await r.json();
    const c: ContractorInfo = j.contractor;
    if (c) {
      setInfo(c);
      setForm({
        ceoName: c.ceoName ?? '',
        phoneMain: c.phoneMain ?? '',
        emailMain: c.emailMain ?? '',
        garageAddress: c.garageAddress ?? '',
      });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    const r = await fetch('/api/contractor/info', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ceoName: form.ceoName.trim() || null,
        phoneMain: form.phoneMain.trim() || null,
        emailMain: form.emailMain.trim() || null,
        garageAddress: form.garageAddress.trim() || null,
      }),
    });
    setSaving(false);
    if (r.ok) {
      setSuccess(true);
      load();
      setTimeout(() => setSuccess(false), 3000);
    } else {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? '저장 실패');
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-ink-muted">로딩 중…</div>;
  }

  if (!info) {
    return (
      <div className="py-16 text-center text-sm text-ink-muted font-bold">
        회사 정보를 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-black text-ink tracking-tight">회사 정보 설정</h2>
        <p className="text-sm text-ink-muted mt-1">
          위탁업체 기본 정보를 관리합니다. 회사명·사업자번호·계약기간은 지자체 담당자가 설정합니다.
        </p>
      </div>

      {/* 읽기 전용 정보 */}
      <div className="bg-surface-soft border border-line rounded-xl p-5 space-y-3">
        <div className="text-xs font-extrabold text-ink-muted uppercase tracking-wide mb-1">기본 정보 (읽기 전용)</div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-xs font-bold text-ink-muted">회사명</dt>
            <dd className="font-extrabold text-ink mt-0.5">{info.companyName}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-ink-muted">사업자등록번호</dt>
            <dd className="font-mono font-bold text-ink mt-0.5">{info.businessNo}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-ink-muted">관할 지자체</dt>
            <dd className="font-bold text-ink mt-0.5">{info.municipalityName}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-ink-muted">계약 상태</dt>
            <dd className="mt-0.5">
              <span className={`px-2 py-0.5 rounded-full text-[0.625rem] font-extrabold ${
                info.status === 'ACTIVE'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {STATUS_LABEL[info.status] ?? info.status}
              </span>
            </dd>
          </div>
          {info.contractStart && (
            <div>
              <dt className="text-xs font-bold text-ink-muted">계약 시작</dt>
              <dd className="font-mono text-sm text-ink mt-0.5">{info.contractStart}</dd>
            </div>
          )}
          {info.contractEnd && (
            <div>
              <dt className="text-xs font-bold text-ink-muted">계약 종료</dt>
              <dd className="font-mono text-sm text-ink mt-0.5">{info.contractEnd}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* 편집 가능 정보 */}
      <div className="bg-surface border border-line rounded-xl p-5 space-y-4">
        <div className="text-xs font-extrabold text-ink-muted uppercase tracking-wide mb-1">편집 가능 정보</div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-bold text-ink-muted mb-1">대표자명</label>
            <input
              type="text"
              value={form.ceoName}
              onChange={(e) => setForm({ ...form, ceoName: e.target.value })}
              placeholder="홍길동"
              maxLength={50}
              className="w-full px-3 py-2 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-bold text-ink-muted mb-1">대표 전화</label>
            <input
              type="tel"
              value={form.phoneMain}
              onChange={(e) => setForm({ ...form, phoneMain: e.target.value })}
              placeholder="02-1234-5678"
              maxLength={20}
              className="w-full px-3 py-2 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-ink-muted mb-1">대표 이메일</label>
            <input
              type="email"
              value={form.emailMain}
              onChange={(e) => setForm({ ...form, emailMain: e.target.value })}
              placeholder="info@company.co.kr"
              maxLength={100}
              className="w-full px-3 py-2 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-ink-muted mb-1">차고지 주소</label>
            <input
              type="text"
              value={form.garageAddress}
              onChange={(e) => setForm({ ...form, garageAddress: e.target.value })}
              placeholder="예: 서울시 종로구 세종로 1"
              maxLength={255}
              className="w-full px-3 py-2 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {error && (
          <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 font-bold">
            {error}
          </div>
        )}
        {success && (
          <div className="px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 font-bold">
            저장되었습니다.
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="px-6 py-2 rounded-lg bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 disabled:opacity-50"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>

      {/* 바로가기 */}
      <div className="bg-surface border border-line rounded-xl p-5">
        <div className="text-xs font-extrabold text-ink-muted uppercase tracking-wide mb-3">관련 설정</div>
        <div className="space-y-2">
          <a
            href="/settings/zones"
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-surface-soft transition"
          >
            <span className="text-lg">🗺</span>
            <div>
              <div className="text-sm font-extrabold text-ink">담당구역 관리</div>
              <div className="text-xs text-ink-muted">수거구역 및 담당 행정동 등록·관리</div>
            </div>
            <span className="ml-auto text-ink-faint text-sm">→</span>
          </a>
          <a
            href="/settings/disposal-sites"
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-surface-soft transition"
          >
            <span className="text-lg">🏭</span>
            <div>
              <div className="text-sm font-extrabold text-ink">반입장소 설정</div>
              <div className="text-xs text-ink-muted">차량일지 작업내역에서 선택할 반입장소 목록</div>
            </div>
            <span className="ml-auto text-ink-faint text-sm">→</span>
          </a>
        </div>
      </div>
    </div>
  );
}
