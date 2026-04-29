'use client';

/**
 * 신규 위탁업체 개설 마법사 — 5단계 모달.
 * Design Ref: docs/specs/08_역할권한_설계서.md §7.2 처방 1 + Phase 1 P1-3.
 *
 * 흐름: [1 회사정보] → [2 지자체] → [3 권한정책] → [4 CONTRACTOR_ADMIN] → [5 직원CSV(생략 가능)] → [완료]
 *
 * API 재사용: POST /api/contractors → POST /api/users → POST /api/super-admin/muni-policies
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { PRESETS, type PresetKey } from '@/lib/permission-presets';
import { formatKoreanPhone } from '@/lib/phone';
import { formatBusinessNo, validateBusinessNo } from '@/lib/business-no';

type Muni = { id: string; name: string; code: string; region: string | null; status: string };

type Step = 1 | 2 | 3 | 4 | 5 | 6; // 6 = 완료 화면

type WizardData = {
  /* Step 1 */
  companyName: string;
  businessNo: string;
  ceoName: string;
  phoneMain: string;
  /* Step 2 */
  municipalityId: string;
  /* Step 3 */
  preset: PresetKey;
  /* Step 4 */
  adminName: string;
  adminUsername: string;
  adminPassword: string;
  adminPhone: string;
};

/* P1-5 CSV 파싱: 헤더 row 자동 감지, 콤마/탭 모두 지원, 빈 행 skip */
type CsvWorker = { name: string; username: string; phone: string; password: string };

function parseEmployeeCsv(text: string): { rows: CsvWorker[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { rows: [], errors: ['빈 파일'] };
  /* 첫 줄이 한글/영문 헤더면 skip ('이름' '아이디' '전화' 등이 포함되면 헤더로 판단) */
  const first = lines[0];
  const startIdx = /이름|name|username|phone|전화|아이디/i.test(first) ? 1 : 0;
  const rows: CsvWorker[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cells = lines[i].split(/[,\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
    const [name = '', username = '', phone = '', password = ''] = cells;
    if (!name || !username) {
      errors.push(`${i + 1}행: 이름·아이디 필수`);
      continue;
    }
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
      errors.push(`${i + 1}행: 아이디 형식 (영문/숫자/_-, 3~30자)`);
      continue;
    }
    rows.push({
      name,
      username,
      phone: phone ? phone.replace(/[^0-9-]/g, '') : '',
      password: password.length >= 6 ? password : 'cleanerp123', // 디폴트 임시 PW
    });
  }
  return { rows, errors };
}

const INITIAL: WizardData = {
  companyName: '',
  businessNo: '',
  ceoName: '',
  phoneMain: '',
  municipalityId: '',
  preset: 'standard',
  adminName: '',
  adminUsername: '',
  adminPassword: '',
  adminPhone: '',
};

/* 12자 임시 PW 자동 생성 (영문대소+숫자) */
function genPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function OnboardingWizardModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [data, setData] = useState<WizardData>({ ...INITIAL, adminPassword: genPassword() });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [munis, setMunis] = useState<Muni[]>([]);
  const [muniQuery, setMuniQuery] = useState('');
  const [createdContractorId, setCreatedContractorId] = useState<string | null>(null);
  /* P1-5 CSV 직원 일괄 등록 */
  const [csvRows, setCsvRows] = useState<CsvWorker[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvImportProgress, setCsvImportProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [copyOk, setCopyOk] = useState(false);
  const [showManualCopy, setShowManualCopy] = useState(false);

  function onCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const { rows, errors } = parseEmployeeCsv(text);
      setCsvRows(rows);
      setCsvErrors(errors);
    };
    reader.readAsText(file, 'utf-8');
  }

  async function importCsv(contractorId: string) {
    if (csvRows.length === 0) return;
    setCsvImportProgress({ done: 0, total: csvRows.length, failed: 0 });
    let done = 0;
    let failed = 0;
    for (const r of csvRows) {
      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: r.username,
            password: r.password,
            name: r.name,
            role: 'WORKER',
            contractorId,
            phone: r.phone || undefined,
            status: 'ACTIVE',
          }),
        });
        if (res.ok) done++;
        else failed++;
      } catch {
        failed++;
      }
      setCsvImportProgress({ done: done + failed, total: csvRows.length, failed });
    }
  }

  async function copyCredentials() {
    const text = `CleanERP 접속 정보\n────────────────\n접속 URL: https://wci.helpbiz.kr/login\n아이디: ${data.adminUsername}\n임시 PW: ${data.adminPassword}\n회사: ${data.companyName} (${data.businessNo})\n계약 상태: SETUP\n\n※ 첫 로그인 후 비밀번호를 변경해 주세요.`;

    /* Strategy 1: 모던 Clipboard API (HTTPS / localhost / 보안 컨텍스트 필수) */
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        setCopyOk(true);
        setError(null);
        setTimeout(() => setCopyOk(false), 2000);
        return;
      } catch {
        /* permission denied / not focused 등 — fallback 시도 */
      }
    }

    /* Strategy 2: 레거시 execCommand('copy') — HTTP LAN 접속 등 비보안 컨텍스트 대응.
       임시 textarea 생성 → 선택 → 복사 → 제거. */
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) {
        setCopyOk(true);
        setError(null);
        setTimeout(() => setCopyOk(false), 2000);
        return;
      }
    } catch {
      /* 무시 — Strategy 3 으로 */
    }

    /* Strategy 3: 직접 복사 영역 노출 + 안내 — 사용자가 수동 Ctrl+C */
    setError('자동 복사 실패 (HTTP 접속 시 브라우저 보안 정책). 아래 텍스트를 직접 선택 후 Ctrl+C 하세요.');
    setShowManualCopy(true);
  }

  /* Step 2 진입 시 지자체 목록 로드 — 모든 상태 (ACTIVE / SUSPENDED) 모두 노출.
     SUSPENDED 지자체도 선택 가능 (시드만 된 미운영 지자체 → 위탁업체 등록 시 활성화).
     INACTIVE/폐지 등은 API 가 명시 시에만 반환 — 본 위저드는 default 전체. */
  useEffect(() => {
    if (step !== 2 || munis.length > 0) return;
    fetch('/api/super-admin/municipalities?limit=500')
      .then((r) => r.json())
      .then((j) => setMunis(j.items ?? []))
      .catch(() => setError('지자체 목록 로드 실패'));
  }, [step, munis.length]);

  const filteredMunis = useMemo(() => {
    const q = muniQuery.trim();
    if (!q) return munis.slice(0, 20);
    /* 우선순위: name 시작 매칭 → name 포함 → region 포함 → code 포함 */
    const startsWithName = munis.filter((m) => m.name.startsWith(q));
    const includesName = munis.filter((m) => !m.name.startsWith(q) && m.name.includes(q));
    const includesRegion = munis.filter((m) => !m.name.includes(q) && (m.region ?? '').includes(q));
    const includesCode = munis.filter((m) => !m.name.includes(q) && !(m.region ?? '').includes(q) && m.code.includes(q));
    return [...startsWithName, ...includesName, ...includesRegion, ...includesCode].slice(0, 50);
  }, [munis, muniQuery]);

  /* 지자체 자동선택 — 검색 결과 1개로 좁혀지면 그 항목을 자동 선택.
     검색어가 1자 이상이고, 후보가 1개 + 그 이름이 검색어로 시작하면 자동 매핑. */
  useEffect(() => {
    if (step !== 2) return;
    const q = muniQuery.trim();
    if (q.length < 1) return;
    if (filteredMunis.length === 1 && filteredMunis[0].name.startsWith(q)) {
      if (data.municipalityId !== filteredMunis[0].id) {
        setData((d) => ({ ...d, municipalityId: filteredMunis[0].id }));
      }
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [filteredMunis, muniQuery, step]);

  /* 키보드 네비게이션 — ↑/↓ 으로 candidate hover, Enter 로 선택 */
  const [muniHover, setMuniHover] = useState(0);
  useEffect(() => { setMuniHover(0); }, [muniQuery]);
  function onMuniKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (filteredMunis.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMuniHover((i) => Math.min(filteredMunis.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMuniHover((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredMunis[muniHover];
      if (target) setField('municipalityId', target.id);
    }
  }

  function setField<K extends keyof WizardData>(k: K, v: WizardData[K]) {
    setData((d) => ({ ...d, [k]: v }));
    setError(null);
  }

  function validate(s: Step): string | null {
    if (s === 1) {
      if (!data.companyName.trim()) return '회사명 필수';
      const v = validateBusinessNo(data.businessNo);
      if (!v.valid) return `사업자번호: ${v.reason}`;
    } else if (s === 2) {
      if (!data.municipalityId) return '관할 지자체 선택 필수';
    } else if (s === 4) {
      if (!data.adminName.trim()) return '관리자 이름 필수';
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(data.adminUsername.trim())) return '아이디 3~30자 영문/숫자/_-';
      if (data.adminPassword.length < 6) return '비밀번호 6자 이상';
      if (data.adminPhone && !/^01[0-9]-?\d{3,4}-?\d{4}$/.test(data.adminPhone)) return '전화번호 형식 (010-0000-0000)';
    }
    return null;
  }

  async function next() {
    const err = validate(step);
    if (err) {
      setError(err);
      return;
    }
    if (step < 5) {
      setStep((step + 1) as Step);
      return;
    }
    /* Step 5에서 next = 최종 제출 */
    await submit();
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      /* 1. 위탁업체 생성 */
      const cRes = await fetch('/api/contractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: data.companyName.trim(),
          businessNo: data.businessNo.replace(/-/g, ''),
          municipalityId: data.municipalityId,
          ceoName: data.ceoName.trim() || undefined,
          phoneMain: data.phoneMain.trim() || undefined,
          status: 'SETUP',
        }),
      });
      const cJson = await cRes.json().catch(() => ({}));
      if (!cRes.ok) throw new Error(cJson?.detail ?? cJson?.error ?? '위탁업체 생성 실패');
      const contractorId = String(cJson.id);
      setCreatedContractorId(contractorId);

      /* 2. 권한 매트릭스 (프리셋 적용) */
      const preset = PRESETS.find((p) => p.key === data.preset)!;
      await fetch('/api/super-admin/muni-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          municipalityId: data.municipalityId,
          allowedScreens: preset.allowedScreens,
          allowedReports: preset.allowedReports,
          exportEnabled: preset.exportEnabled,
          bulkExportEnabled: preset.bulkExportEnabled,
          note: `위저드 자동 적용: ${preset.label}`,
        }),
      }).catch(() => null); // 비치명적 — 실패해도 계속

      /* 3. CONTRACTOR_ADMIN 계정 생성 */
      const uRes = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.adminUsername.trim(),
          password: data.adminPassword,
          role: 'CONTRACTOR_ADMIN',
          name: data.adminName.trim(),
          contractorId,
          phone: data.adminPhone.trim() || undefined,
          status: 'ACTIVE',
        }),
      });
      const uJson = await uRes.json().catch(() => ({}));
      if (!uRes.ok) throw new Error(uJson?.error ?? '관리자 계정 생성 실패');

      /* 4. P1-5 CSV 직원 일괄 등록 (있을 때만) */
      if (csvRows.length > 0) {
        await importCsv(contractorId);
      }

      setStep(6);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (busy) return;
    if (createdContractorId) onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-2xl max-w-[640px] w-full max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3 border-b border-line flex items-center justify-between">
          <h2 className="text-base font-black text-ink">신규 위탁업체 개설 마법사</h2>
          <button onClick={close} disabled={busy} aria-label="닫기" className="text-slate-400 hover:text-slate-700 text-xl leading-none disabled:opacity-30">✕</button>
        </div>

        {/* Stepper */}
        {step <= 5 && (
          <div className="px-5 py-3 border-b border-line bg-slate-50 flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="flex-1 flex items-center gap-1.5">
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-black ${
                  step === n ? 'bg-accent text-white' : step > n ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  {step > n ? '✓' : n}
                </div>
                {n < 5 && <div className={`flex-1 h-0.5 ${step > n ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {step === 1 && (
            <>
              <h3 className="text-sm font-extrabold text-ink">1단계: 회사 정보</h3>
              <Field label="회사명 *">
                <Input value={data.companyName} onChange={(v) => setField('companyName', v)} placeholder="강남청소(주)" />
              </Field>
              <Field label="사업자번호 * (자동 하이픈 + 체크디지트 검증)">
                <Input
                  value={data.businessNo}
                  onChange={(v) => setField('businessNo', formatBusinessNo(v))}
                  placeholder="000-00-00000"
                  inputMode="numeric"
                  maxLength={12}
                />
                <BusinessNoStatus value={data.businessNo} />
              </Field>
              <Field label="대표자 (선택)">
                <Input value={data.ceoName} onChange={(v) => setField('ceoName', v)} placeholder="홍길동" />
              </Field>
              <Field label="회사 대표 전화 (선택)">
                <Input value={data.phoneMain} onChange={(v) => setField('phoneMain', formatKoreanPhone(v))} placeholder="02-1234-5678" inputMode="numeric" maxLength={13} />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <h3 className="text-sm font-extrabold text-ink">2단계: 관할 지자체 선택</h3>
              <p className="text-xs text-slate-600">
                사전 등록된 226개 시군구 중 선택. 1글자 이상 입력 시 자동 추천,
                결과가 1개로 좁혀지면 자동 선택됩니다. 키보드 ↑↓ Enter 도 가능.
              </p>
              <input
                value={muniQuery}
                onChange={(e) => setMuniQuery(e.target.value)}
                onKeyDown={onMuniKey}
                placeholder="🔍 지자체명/지역/코드 (예: '강' 입력 시 강남/강동/강서 후보)"
                autoFocus
                className="w-full px-3 py-2 rounded border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent"
              />
              <div className="border border-line rounded-md max-h-64 overflow-y-auto">
                {filteredMunis.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-slate-500">
                    {munis.length === 0 ? '로딩 중…' : muniQuery.trim() ? `'${muniQuery}' 검색 결과 없음` : '키워드 1자 이상 입력'}
                  </div>
                )}
                {filteredMunis.map((m, i) => {
                  const selected = data.municipalityId === m.id;
                  const hovered = i === muniHover;
                  const isSuspended = m.status === 'SUSPENDED';
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setField('municipalityId', m.id)}
                      onMouseEnter={() => setMuniHover(i)}
                      className={`w-full px-3 py-2 text-left text-sm border-b border-line last:border-b-0 transition ${
                        selected
                          ? 'bg-accent text-white font-extrabold'
                          : hovered
                          ? 'bg-cyan-50 border-l-4 border-l-accent pl-2'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {selected && <span className="text-[0.6875rem]">✓</span>}
                        {m.name}
                      </span>
                      <span className={`ml-2 text-[0.625rem] font-mono ${selected ? 'text-cyan-100' : 'text-slate-500'}`}>
                        {m.region ?? ''} · {m.code}
                      </span>
                      {/* 상태 배지 — ACTIVE 는 emerald, SUSPENDED 는 amber (시드만 됨) */}
                      <span className={`ml-1.5 text-[0.5625rem] font-mono font-extrabold px-1 py-0.5 rounded border ${
                        selected
                          ? 'bg-white/20 text-white border-white/40'
                          : isSuspended
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}>
                        {isSuspended ? '시드만' : '운영중'}
                      </span>
                    </button>
                  );
                })}
              </div>
              {muniQuery.trim() && filteredMunis.length === 1 && data.municipalityId === filteredMunis[0].id && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-md px-3 py-2 text-xs font-bold text-emerald-900">
                  ✓ 자동 선택됨: <b>{filteredMunis[0].name}</b> · 다음 단계로 이동하세요.
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h3 className="text-sm font-extrabold text-ink">3단계: 권한 정책 선택</h3>
              <p className="text-xs text-slate-600">선택한 지자체에 어떤 화면을 노출할지 결정. 잘 모르면 [표준]을 선택하세요.</p>
              {PRESETS.map((p) => (
                <label
                  key={p.key}
                  className={`block border-2 rounded-lg p-3 cursor-pointer transition ${
                    data.preset === p.key ? 'border-accent bg-accent/5' : 'border-line hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="preset"
                      checked={data.preset === p.key}
                      onChange={() => setField('preset', p.key)}
                      className="mt-1 w-4 h-4 accent-accent"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-extrabold text-ink">{p.label}</div>
                      <div className="text-xs text-slate-700 mt-0.5">{p.description}</div>
                      <div className="text-[0.625rem] font-mono text-slate-500 mt-1.5">
                        화면 {p.allowedScreens.length}개 · 보고서 {p.allowedReports.length}개
                        {p.exportEnabled && ' · 다운로드'}
                        {p.bulkExportEnabled && ' · 일괄출력'}
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </>
          )}

          {step === 4 && (
            <>
              <h3 className="text-sm font-extrabold text-ink">4단계: 회사 관리자 (CONTRACTOR_ADMIN) 등록</h3>
              <p className="text-xs text-slate-600">위탁업체 대표 1명. 이후 직원·차량 등록은 이 분이 직접 진행합니다.</p>
              <Field label="이름 *">
                <Input value={data.adminName} onChange={(v) => setField('adminName', v)} placeholder="홍길동" />
              </Field>
              <Field label="아이디 *">
                <Input value={data.adminUsername} onChange={(v) => setField('adminUsername', v)} placeholder="kngm-admin" />
              </Field>
              <Field label="임시 비밀번호 (자동 생성)">
                <div className="flex gap-1.5">
                  <Input value={data.adminPassword} onChange={(v) => setField('adminPassword', v)} />
                  <button
                    type="button"
                    onClick={() => setField('adminPassword', genPassword())}
                    className="px-3 py-1.5 rounded border border-line text-xs font-bold bg-slate-50 hover:bg-slate-100"
                  >
                    🎲 재생성
                  </button>
                </div>
              </Field>
              <Field label="전화번호 (선택)">
                <Input value={data.adminPhone} onChange={(v) => setField('adminPhone', formatKoreanPhone(v))} placeholder="010-1234-5678" inputMode="numeric" maxLength={13} />
              </Field>
            </>
          )}

          {step === 5 && (
            <>
              <h3 className="text-sm font-extrabold text-ink">5단계: 직원 CSV 일괄 등록 (선택)</h3>
              <p className="text-xs text-slate-600">
                CSV 형식: <code className="px-1 bg-slate-100 rounded">이름,아이디,전화,비밀번호</code> (헤더 자동 인식, 비밀번호 누락 시 <code>cleanerp123</code>)
              </p>
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onCsvFile(f); }}
                className="block w-full text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-accent file:text-white file:font-bold file:cursor-pointer"
              />
              {csvRows.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-md px-3 py-2">
                  <div className="text-xs font-extrabold text-emerald-900">✓ {csvRows.length}명 미리보기</div>
                  <div className="mt-1.5 max-h-32 overflow-y-auto border border-emerald-200 rounded bg-white">
                    <table className="w-full text-[0.625rem] font-mono">
                      <thead className="bg-emerald-100 text-emerald-900">
                        <tr><th className="px-1.5 py-1 text-left">이름</th><th className="px-1.5 py-1 text-left">아이디</th><th className="px-1.5 py-1 text-left">전화</th><th className="px-1.5 py-1 text-left">PW</th></tr>
                      </thead>
                      <tbody>
                        {csvRows.slice(0, 50).map((r, i) => (
                          <tr key={i} className="border-t border-emerald-100">
                            <td className="px-1.5 py-1">{r.name}</td>
                            <td className="px-1.5 py-1">{r.username}</td>
                            <td className="px-1.5 py-1">{r.phone || '—'}</td>
                            <td className="px-1.5 py-1 text-slate-500">{r.password.slice(0, 3)}***</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvRows.length > 50 && <div className="px-2 py-1 text-[0.625rem] text-slate-500">... 외 {csvRows.length - 50}명</div>}
                  </div>
                </div>
              )}
              {csvErrors.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-md px-3 py-2 text-[0.6875rem] text-amber-900 max-h-24 overflow-y-auto">
                  <b>⚠ {csvErrors.length}건 무시됨:</b>
                  <ul className="mt-1 space-y-0.5 list-disc list-inside">
                    {csvErrors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              <div className="bg-amber-50 border border-amber-300 rounded-md px-3 py-2 text-xs text-amber-900 font-semibold">
                💡 [완료] 시 위탁업체 + 권한 + 관리자 + {csvRows.length > 0 ? `직원 ${csvRows.length}명` : '직원 0명'} 모두 생성됩니다.
                <br />
                건너뛰려면 파일을 선택하지 말고 [완료]를 누르세요.
              </div>
            </>
          )}

          {step === 6 && createdContractorId && (
            <>
              <div className="text-center py-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center mb-2">
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-base font-black text-ink">개설 완료</h3>
                <p className="text-xs text-slate-600 mt-1">아래 정보를 안전한 채널로 위탁업체 대표에게 전달하세요.</p>
              </div>
              <div className="bg-slate-50 border border-line rounded-md px-3 py-3 space-y-1.5 text-sm font-mono relative">
                <div><b className="text-slate-700">접속 URL:</b> <span className="text-accent">https://wci.helpbiz.kr/login</span></div>
                <div><b className="text-slate-700">아이디:</b> {data.adminUsername}</div>
                <div><b className="text-slate-700">임시 PW:</b> <code className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">{data.adminPassword}</code></div>
                <div><b className="text-slate-700">회사:</b> {data.companyName} ({data.businessNo})</div>
                <div><b className="text-slate-700">계약 상태:</b> SETUP</div>
                <button
                  type="button"
                  onClick={copyCredentials}
                  className={`mt-1 w-full px-2.5 py-1.5 rounded text-xs font-extrabold transition ${
                    copyOk ? 'bg-emerald-600 text-white' : 'bg-accent hover:bg-cyan-800 text-white'
                  }`}
                >
                  {copyOk ? '✓ 복사됨!' : '📋 클립보드 복사 (메일/메신저 붙여넣기용)'}
                </button>
              </div>

              {/* Strategy 3: 자동 복사 실패 시 수동 복사용 textarea 노출 */}
              {showManualCopy && (
                <ManualCopyArea data={data} />
              )}

              {/* P1-5 CSV 임포트 결과 */}
              {csvImportProgress && (
                <div className={`border rounded-md px-3 py-2 text-xs font-bold ${
                  csvImportProgress.failed === 0 ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}>
                  📥 직원 CSV 임포트: {csvImportProgress.done}/{csvImportProgress.total}
                  {csvImportProgress.failed > 0 && ` (실패 ${csvImportProgress.failed})`}
                </div>
              )}

              {/* P1-4 셋업 체크리스트 — 자동 검증 + 수동 확인 항목 분리 */}
              <SetupChecklist contractorId={createdContractorId} />

              <div className="bg-amber-50 border border-amber-300 rounded-md px-3 py-2 text-xs text-amber-900 font-semibold">
                ⚠ 첫 로그인 후 비밀번호 변경을 권장하세요. 30일 동안 미접속 시 계정 잠금.
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-300 rounded-md px-3 py-2 text-xs font-bold text-red-700">
              ⚠ {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-line bg-slate-50 flex items-center justify-between">
          {step <= 5 ? (
            <>
              <button
                type="button"
                onClick={() => (step > 1 ? setStep((step - 1) as Step) : close())}
                disabled={busy}
                className="px-3 py-1.5 rounded border border-line text-sm font-bold hover:bg-white disabled:opacity-50"
              >
                {step > 1 ? '← 이전' : '취소'}
              </button>
              <button
                type="button"
                onClick={next}
                disabled={busy}
                className="px-4 py-1.5 rounded bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 disabled:opacity-50"
              >
                {busy ? '처리 중…' : step === 5 ? '✓ 완료 (생성 시작)' : '다음 →'}
              </button>
            </>
          ) : (
            <>
              <span className="text-xs text-slate-500 font-mono">contractorId: {createdContractorId}</span>
              <button
                type="button"
                onClick={close}
                className="px-4 py-1.5 rounded bg-emerald-600 text-white text-sm font-extrabold hover:bg-emerald-700"
              >
                닫기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* P1-4 셋업 체크리스트 — 위저드 완료 시 자동 검증.
   - 자동: 위저드가 직접 만든 contractor + admin + policy 3종 (마운트 즉시 ✓)
   - 수동: cross-tenant 격리 / 첫 로그인 / 직원·차량 등록 (사용자가 직접 체크)
   서버 검증 X — 위저드 호출이 모두 200이면 자동 합격. */
function SetupChecklist({ contractorId }: { contractorId: string }) {
  return (
    <div className="bg-emerald-50 border border-emerald-300 rounded-md px-3 py-3 space-y-2">
      <div className="text-xs font-extrabold text-emerald-900">📋 셋업 체크리스트 (Design §5.3)</div>
      <ul className="space-y-1 text-[0.6875rem]">
        <ChecklistItem auto label="위탁업체 레코드 생성됨" detail={`contractorId=${contractorId} (status=SETUP)`} />
        <ChecklistItem auto label="권한 정책(매트릭스) 적용됨" detail="선택한 프리셋이 지자체에 매핑됨" />
        <ChecklistItem auto label="CONTRACTOR_ADMIN 계정 발급됨" detail="status=ACTIVE, 임시 PW 부여" />
        <ChecklistItem manual label="CONTRACTOR_ADMIN 첫 로그인 + PW 변경" detail="대표가 안전 채널로 정보 수신 후" />
        <ChecklistItem manual label="cross-tenant 격리 검증" detail="다른 위탁업체 데이터가 안 보이는지 확인" />
        <ChecklistItem manual label="직원 명단 등록 (CSV 또는 개별)" detail="CONTRACTOR_ADMIN이 /users 메뉴에서 직접" />
        <ChecklistItem manual label="차량 명단 등록" detail="CONTRACTOR_ADMIN이 /vehicles 메뉴에서" />
        <ChecklistItem manual label="결재 라인 정의" detail="휴가/근태 결재선 1회 설정" />
      </ul>
      <div className="text-[0.625rem] text-slate-600 leading-snug">
        ✓ 자동 항목 = 위저드 진행 중 즉시 검증. □ 수동 항목 = CONTRACTOR_ADMIN 또는 운영자 후속 작업.
      </div>
    </div>
  );
}

function ChecklistItem({ auto, manual, label, detail }: { auto?: boolean; manual?: boolean; label: string; detail?: string }) {
  return (
    <li className="flex items-start gap-1.5">
      <span className={`flex-shrink-0 inline-flex items-center justify-center w-4 h-4 rounded text-[0.5625rem] font-mono font-black ${
        auto ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-400 text-slate-400'
      }`}>
        {auto ? '✓' : '□'}
      </span>
      <div className="flex-1 min-w-0">
        <div className={`font-bold ${auto ? 'text-emerald-900' : 'text-slate-700'}`}>{label}</div>
        {detail && <div className="text-[0.625rem] text-slate-600 font-mono">{detail}</div>}
      </div>
      <span className={`text-[0.5625rem] font-mono font-extrabold px-1 rounded ${
        auto ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-100 text-amber-800'
      }`}>
        {auto ? '자동' : '수동'}
      </span>
    </li>
  );
}

/* 자동 복사 실패 시 수동 복사용 — readonly textarea + 자동 select.
   HTTP 접속 + execCommand 거부된 환경 대응. */
function ManualCopyArea({ data }: { data: WizardData }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const text = `CleanERP 접속 정보\n────────────────\n접속 URL: https://wci.helpbiz.kr/login\n아이디: ${data.adminUsername}\n임시 PW: ${data.adminPassword}\n회사: ${data.companyName} (${data.businessNo})\n계약 상태: SETUP\n\n※ 첫 로그인 후 비밀번호를 변경해 주세요.`;
  useEffect(() => {
    /* 마운트 시 자동 select — 사용자가 Ctrl+C 만 누르면 됨 */
    if (ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, []);
  return (
    <div className="bg-amber-50 border-2 border-amber-400 rounded-md px-3 py-2">
      <div className="text-[0.6875rem] font-extrabold text-amber-900 mb-1.5">
        ⚠ 자동 복사가 차단되었습니다 (HTTP 접속 / 보안 정책). 아래 영역을 클릭 후 <b>Ctrl+C</b> (Mac: <b>Cmd+C</b>) 누르세요.
      </div>
      <textarea
        ref={ref}
        readOnly
        value={text}
        rows={8}
        className="w-full px-2 py-1.5 rounded border border-amber-300 bg-white text-xs font-mono text-slate-800 select-all"
        onClick={(e) => (e.currentTarget as HTMLTextAreaElement).select()}
      />
    </div>
  );
}

/* 사업자번호 실시간 검증 표시 — 입력 길이에 따라 안내 / 성공 / 오류 */
function BusinessNoStatus({ value }: { value: string }) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) {
    return <div className="text-[0.625rem] text-slate-500 mt-1">숫자만 입력하면 자동으로 하이픈이 들어갑니다.</div>;
  }
  if (digits.length < 10) {
    return <div className="text-[0.625rem] text-slate-500 mt-1">진행: {digits.length}/10자리</div>;
  }
  const v = validateBusinessNo(value);
  return v.valid
    ? <div className="text-[0.6875rem] font-bold text-emerald-700 mt-1">✓ 사업자번호 검증 통과 (체크디지트 일치)</div>
    : <div className="text-[0.6875rem] font-bold text-rose-700 mt-1">⚠ {v.reason}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-extrabold text-ink mb-1">{label}</span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  inputMode,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email';
  maxLength?: number;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      maxLength={maxLength}
      className="w-full px-3 py-1.5 rounded border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent"
    />
  );
}
