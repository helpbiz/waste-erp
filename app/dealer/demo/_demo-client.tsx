'use client';

/**
 * 딜러 데모 셀프발급. Design §5.4 Page UI Checklist.
 * SUPER_ADMIN 승인 없이 즉시 발급되며, 발급된 계정은 CONTRACTOR_ADMIN 권한으로
 * 격리된 데모 위탁업체(60일 샘플 데이터 포함)에만 접근 가능하다. 14일 후 자동 만료·삭제.
 *
 * 2026-07-06 — 예비고객이 딜러 개입 없이 바로 접속할 수 있는 매직링크 추가.
 * 링크를 그대로 보내면 클릭만으로 로그인되며(비밀번호 불필요), 아이디/비밀번호는 보조 수단으로 유지.
 *
 * 2026-07-08 — 지자체 모드 그룹 데모 추가: 가상 지자체 1개 + 가상 위탁업체 3개를 함께 만들어
 * MUNI_ADMIN 통합관제 대시보드를 시연. 활성 데모 쿼터(3개)는 단독 회사 데모와 통합해서 카운트된다.
 */
import { useEffect, useState } from 'react';

type DemoItem = {
  contractorId: string;
  companyName: string;
  expiresAt: string | null;
  createdAt: string;
  accessToken: string | null;
};

type MunicipalityDemoItem = {
  municipalityId: string;
  municipalityName: string;
  companies: { contractorId: string; companyName: string }[];
  expiresAt: string | null;
  createdAt: string;
  accessToken: string | null;
};

type ProvisionResult = {
  contractorId: string;
  adminUsername: string;
  adminPassword?: string;
  expiresAt: string;
  accessToken: string | null;
};

type ProvisionMunicipalityResult = {
  municipalityId: string;
  contractorIds: string[];
  adminUsername: string;
  adminPassword?: string;
  expiresAt: string;
  accessToken: string | null;
};

function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function buildLink(accessToken: string | null): string {
  if (!accessToken) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/api/demo-access/${accessToken}`;
}

export default function DemoClient() {
  const [items, setItems] = useState<DemoItem[]>([]);
  const [municipalityItems, setMunicipalityItems] = useState<MunicipalityDemoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [provisioningMuni, setProvisioningMuni] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<ProvisionResult | null>(null);
  const [justCreatedMuni, setJustCreatedMuni] = useState<ProvisionMunicipalityResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/dealer/demo');
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setMunicipalityItems(data.municipalityItems ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const activeBundleCount =
    items.filter((i) => (daysLeft(i.expiresAt) ?? 0) > 0).length +
    municipalityItems.filter((m) => (daysLeft(m.expiresAt) ?? 0) > 0).length;
  const quotaReached = activeBundleCount >= 3;

  async function onProvision() {
    setError(null);
    setJustCreated(null);
    setJustCreatedMuni(null);
    setProvisioning(true);
    const res = await fetch('/api/dealer/demo-provision', { method: 'POST' });
    setProvisioning(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error === 'demo_quota_exceeded' ? '활성 데모 개수가 상한(3개)에 도달했습니다.' : '데모 발급에 실패했습니다.');
      return;
    }
    const data: ProvisionResult = await res.json();
    setJustCreated(data);
    await load();
  }

  async function onProvisionMunicipality() {
    setError(null);
    setJustCreated(null);
    setJustCreatedMuni(null);
    setProvisioningMuni(true);
    const res = await fetch('/api/dealer/demo-provision-municipality', { method: 'POST' });
    setProvisioningMuni(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error === 'demo_quota_exceeded' ? '활성 데모 개수가 상한(3개)에 도달했습니다.' : '지자체 모드 데모 발급에 실패했습니다.');
      return;
    }
    const data: ProvisionMunicipalityResult = await res.json();
    setJustCreatedMuni(data);
    await load();
  }

  async function copyLink(id: string, link: string) {
    await navigator.clipboard.writeText(link).catch(() => null);
    setCopiedId(id);
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000);
  }

  async function regenerate(contractorId: string) {
    setRegenerating(contractorId);
    const res = await fetch(`/api/dealer/demo/${contractorId}/regenerate-link`, { method: 'POST' });
    setRegenerating(null);
    if (res.ok) await load();
  }

  async function regenerateMunicipality(municipalityId: string) {
    setRegenerating(municipalityId);
    const res = await fetch(`/api/dealer/demo/municipality/${municipalityId}/regenerate-link`, { method: 'POST' });
    setRegenerating(null);
    if (res.ok) await load();
  }

  async function deleteNow(contractorId: string) {
    if (!confirm('이 데모를 지금 바로 삭제할까요? 되돌릴 수 없습니다.')) return;
    setDeleting(contractorId);
    const res = await fetch(`/api/dealer/demo/${contractorId}`, { method: 'DELETE' });
    setDeleting(null);
    if (res.ok) await load();
  }

  async function deleteMunicipalityNow(municipalityId: string) {
    if (!confirm('이 지자체 모드 데모(회사 전부)를 지금 바로 삭제할까요? 되돌릴 수 없습니다.')) return;
    setDeleting(municipalityId);
    const res = await fetch(`/api/dealer/demo/municipality/${municipalityId}`, { method: 'DELETE' });
    setDeleting(null);
    if (res.ok) await load();
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-bold">영업 데모</h1>
      <p className="mb-4 text-sm text-ink-muted">
        발급 후 아래 링크를 예비고객에게 그대로 보내면, 비밀번호 없이 클릭만으로 데모에 접속합니다.
      </p>

      <div className="mb-2 flex flex-wrap gap-2">
        <button
          onClick={onProvision}
          disabled={provisioning || provisioningMuni || quotaReached}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {provisioning ? '발급 중…' : '데모 즉시 발급 (회사 1곳)'}
        </button>
        <button
          onClick={onProvisionMunicipality}
          disabled={provisioning || provisioningMuni || quotaReached}
          title="가상 지자체 1개 + 가상 위탁업체 3개를 만들어 지자체 통합관제 화면을 시연합니다"
          className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
        >
          {provisioningMuni ? '발급 중…' : '지자체 모드 데모 발급 (회사 3곳)'}
        </button>
      </div>
      {quotaReached && <p className="mb-4 text-sm text-amber-700">활성 데모 상한(3개)에 도달했습니다.</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {justCreated && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="mb-2 font-medium">데모 발급 완료</p>
          <label className="mb-1 block text-sm font-medium">예비고객 공유 링크 (클릭만으로 접속, 비밀번호 불필요)</label>
          <div className="flex gap-2">
            <input readOnly className="w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-sm" value={buildLink(justCreated.accessToken)} />
            <button onClick={() => copyLink(justCreated.contractorId, buildLink(justCreated.accessToken))} className="rounded bg-blue-600 px-3 py-2 text-sm text-white">
              {copiedId === justCreated.contractorId ? '복사됨' : '복사'}
            </button>
          </div>
          <p className="mt-3 text-xs text-ink-muted">직접 관리자로 로그인하려면: 아이디 <span className="font-mono">{justCreated.adminUsername}</span> / 비밀번호 <span className="font-mono">{justCreated.adminPassword}</span> (이 화면을 벗어나면 비밀번호는 다시 볼 수 없습니다)</p>
          <p className="mt-1 text-xs text-ink-muted">만료: {new Date(justCreated.expiresAt).toLocaleDateString('ko-KR')}</p>
        </div>
      )}

      {justCreatedMuni && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="mb-2 font-medium">지자체 모드 데모 발급 완료 (가상 회사 {justCreatedMuni.contractorIds.length}곳 포함)</p>
          <label className="mb-1 block text-sm font-medium">예비고객 공유 링크 (클릭만으로 접속, 비밀번호 불필요)</label>
          <div className="flex gap-2">
            <input readOnly className="w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-sm" value={buildLink(justCreatedMuni.accessToken)} />
            <button onClick={() => copyLink(justCreatedMuni.municipalityId, buildLink(justCreatedMuni.accessToken))} className="rounded bg-blue-600 px-3 py-2 text-sm text-white">
              {copiedId === justCreatedMuni.municipalityId ? '복사됨' : '복사'}
            </button>
          </div>
          <p className="mt-3 text-xs text-ink-muted">직접 관리자로 로그인하려면: 아이디 <span className="font-mono">{justCreatedMuni.adminUsername}</span> / 비밀번호 <span className="font-mono">{justCreatedMuni.adminPassword}</span> (이 화면을 벗어나면 비밀번호는 다시 볼 수 없습니다)</p>
          <p className="mt-1 text-xs text-ink-muted">만료: {new Date(justCreatedMuni.expiresAt).toLocaleDateString('ko-KR')}</p>
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold">활성 데모 목록</h2>
      {loading ? (
        <p className="text-sm text-ink-muted">불러오는 중…</p>
      ) : items.length === 0 && municipalityItems.length === 0 ? (
        <p className="text-sm text-ink-muted">발급된 데모가 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {municipalityItems.map((item) => {
            const left = daysLeft(item.expiresAt);
            const link = buildLink(item.accessToken);
            return (
              <li key={item.municipalityId} className="rounded border border-emerald-200 bg-emerald-50/40 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">🏛 {item.municipalityName} (지자체 모드)</p>
                    <p className="text-xs text-ink-muted">
                      {item.companies.map((c) => c.companyName).join(', ')} · {new Date(item.createdAt).toLocaleDateString('ko-KR')} 발급
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs">
                    {left != null ? `D-${left}` : '만료됨'}
                  </span>
                </div>
                {link && (
                  <div className="mt-2 flex gap-2">
                    <input readOnly className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs" value={link} />
                    <button onClick={() => copyLink(item.municipalityId, link)} className="whitespace-nowrap rounded border border-slate-300 px-2 py-1 text-xs">
                      {copiedId === item.municipalityId ? '복사됨' : '복사'}
                    </button>
                    <button
                      onClick={() => regenerateMunicipality(item.municipalityId)}
                      disabled={regenerating === item.municipalityId}
                      title="유출됐거나 재발급이 필요하면 클릭 — 기존 링크는 즉시 무효화됩니다"
                      className="whitespace-nowrap rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                    >
                      {regenerating === item.municipalityId ? '재발급 중…' : '링크 재발급'}
                    </button>
                    <button
                      onClick={() => deleteMunicipalityNow(item.municipalityId)}
                      disabled={deleting === item.municipalityId}
                      title="필요 없어졌으면 지금 바로 삭제해서 데모 슬롯을 회수합니다"
                      className="whitespace-nowrap rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
                    >
                      {deleting === item.municipalityId ? '삭제 중…' : '지금 삭제'}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
          {items.map((item) => {
            const left = daysLeft(item.expiresAt);
            const link = buildLink(item.accessToken);
            return (
              <li key={item.contractorId} className="rounded border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.companyName}</p>
                    <p className="text-xs text-ink-muted">{new Date(item.createdAt).toLocaleDateString('ko-KR')} 발급</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs">
                    {left != null ? `D-${left}` : '만료됨'}
                  </span>
                </div>
                {link && (
                  <div className="mt-2 flex gap-2">
                    <input readOnly className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs" value={link} />
                    <button onClick={() => copyLink(item.contractorId, link)} className="whitespace-nowrap rounded border border-slate-300 px-2 py-1 text-xs">
                      {copiedId === item.contractorId ? '복사됨' : '복사'}
                    </button>
                    <button
                      onClick={() => regenerate(item.contractorId)}
                      disabled={regenerating === item.contractorId}
                      title="유출됐거나 재발급이 필요하면 클릭 — 기존 링크는 즉시 무효화됩니다"
                      className="whitespace-nowrap rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                    >
                      {regenerating === item.contractorId ? '재발급 중…' : '링크 재발급'}
                    </button>
                    <button
                      onClick={() => deleteNow(item.contractorId)}
                      disabled={deleting === item.contractorId}
                      title="필요 없어졌으면 지금 바로 삭제해서 데모 슬롯을 회수합니다"
                      className="whitespace-nowrap rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
                    >
                      {deleting === item.contractorId ? '삭제 중…' : '지금 삭제'}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
