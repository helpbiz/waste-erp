'use client';
/**
 * 관제 모드 설정 폼 — 회사 admin 자율 운영 (Phase 2A).
 *
 * 셋팅 항목:
 *  1. 모니터 크기 (32"/40"/50"/auto) → 폰트 스케일
 *  2. 표시 위젯 토글 (민원/운영/시설/최근민원)
 *  3. 새로고침 주기 (15s/30s/60s/5min)
 *  4. 표시 이름 (기본: 회사명)
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';

type WallSettings = {
  monitorSize: '32' | '40' | '50' | 'auto';
  showComplaintsKpi: boolean;
  showOpsKpi: boolean;
  showFacilities: boolean;
  showRecentComplaints: boolean;
  refreshInterval: 15 | 30 | 60 | 300;
  displayName: string | null;
};

const DEFAULTS: WallSettings = {
  monitorSize: '32',
  showComplaintsKpi: true,
  showOpsKpi: true,
  showFacilities: true,
  showRecentComplaints: true,
  refreshInterval: 30,
  displayName: null,
};

export default function WallSettingsClient({ sessionRole }: { sessionRole: string }) {
  const [settings, setSettings] = useState<WallSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dashboard/wall/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.settings) setSettings(j.settings);
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch('/api/dashboard/wall/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (res.ok) {
      setSavedAt(new Date());
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? '저장 실패');
    }
  }

  function update<K extends keyof WallSettings>(key: K, value: WallSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">로딩 중…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-ink">🛠 관제 모드 설정</h1>
          <p className="text-sm text-ink-muted mt-1">자기 회사의 풀스크린 관제 화면을 직접 셋팅합니다.</p>
        </div>
        <Link href="/dashboard/wall" target="_blank"
          className="px-3 py-1.5 rounded text-sm font-bold bg-cyan-600 text-white hover:bg-cyan-700">
          🖥 미리보기
        </Link>
      </header>

      {/* 모니터 크기 */}
      <Section title="① 모니터 크기" hint="3~5m 거리에서 가독성 확보를 위해 모니터 크기에 맞게 폰트 스케일이 자동 조정됩니다.">
        <RadioGroup
          value={settings.monitorSize}
          options={[
            { v: '32', label: '32" (사무실 데스크 옆)' },
            { v: '40', label: '40" (회의실)' },
            { v: '50', label: '50" (벽걸이 TV)' },
            { v: 'auto', label: '자동 (브라우저 크기 기반)' },
          ]}
          onChange={(v) => update('monitorSize', v as WallSettings['monitorSize'])}
        />
      </Section>

      {/* 표시 위젯 */}
      <Section title="② 표시 위젯" hint="화면에 표시할 KPI/패널을 선택합니다.">
        <div className="space-y-2">
          <Toggle label="민원 KPI (4종)" checked={settings.showComplaintsKpi}
            onChange={(v) => update('showComplaintsKpi', v)} />
          <Toggle label="운영 KPI — 처리시설·인원배치·출근율 (3종)" checked={settings.showOpsKpi}
            onChange={(v) => update('showOpsKpi', v)} />
          <Toggle label="시설별 운영 현황 패널" checked={settings.showFacilities}
            onChange={(v) => update('showFacilities', v)} />
          <Toggle label="최근 민원 목록" checked={settings.showRecentComplaints}
            onChange={(v) => update('showRecentComplaints', v)} />
        </div>
      </Section>

      {/* 새로고침 주기 */}
      <Section title="③ 새로고침 주기" hint="너무 짧으면 서버 부하, 너무 길면 데이터 stale.">
        <RadioGroup
          value={String(settings.refreshInterval)}
          options={[
            { v: '15', label: '15초' },
            { v: '30', label: '30초 (권장)' },
            { v: '60', label: '1분' },
            { v: '300', label: '5분' },
          ]}
          onChange={(v) => update('refreshInterval', Number(v) as WallSettings['refreshInterval'])}
        />
      </Section>

      {/* 표시 이름 */}
      <Section title="④ 표시 이름" hint="비워 두면 회사명을 사용합니다.">
        <input type="text"
          value={settings.displayName ?? ''}
          onChange={(e) => update('displayName', e.target.value || null)}
          placeholder="예: 브니엘네이처 운정관제센터"
          className="w-full px-3 py-2 rounded border border-line bg-white text-sm" />
      </Section>

      {/* 저장 */}
      <div className="bg-surface border border-line rounded-lg p-4 flex items-center justify-between">
        <div className="text-sm">
          {saving && <span className="text-slate-500">저장 중…</span>}
          {!saving && savedAt && <span className="text-emerald-700 font-bold">✅ 저장됨 ({savedAt.toLocaleTimeString('ko-KR')})</span>}
          {error && <span className="text-rose-700 font-bold">❌ {error}</span>}
        </div>
        <button onClick={save} disabled={saving}
          className="px-5 py-2 rounded bg-purple-600 text-white text-sm font-extrabold hover:bg-purple-700 disabled:opacity-50">
          저장
        </button>
      </div>

      <div className="text-xs text-ink-muted text-center pt-4 border-t border-line">
        설정은 자기 회사에만 적용됩니다 · {sessionRole}
      </div>
    </div>
  );
}

/* ─────────── 컴포넌트 ─────────── */

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-line rounded-lg p-4 space-y-3">
      <div>
        <h3 className="text-base font-extrabold text-ink">{title}</h3>
        {hint && <p className="text-xs text-ink-muted mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function RadioGroup({ value, options, onChange }: {
  value: string; options: { v: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      {options.map((o) => (
        <label key={o.v} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer">
          <input type="radio" checked={value === o.v} onChange={() => onChange(o.v)} />
          <span className="text-sm">{o.label}</span>
        </label>
      ))}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm">{label}</span>
    </label>
  );
}
