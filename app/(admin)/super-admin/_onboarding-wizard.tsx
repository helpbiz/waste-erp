'use client';

/**
 * 신규 위탁업체 개설 마법사 — 5단계 모달.
 * Design Ref: docs/specs/08_역할권한_설계서.md §7.2 처방 1 + Phase 1 P1-3.
 *
 * 흐름: [1 회사정보] → [2 지자체] → [3 권한정책] → [4 CONTRACTOR_ADMIN] → [5 직원CSV(생략 가능)] → [완료]
 *
 * API 재사용: POST /api/contractors → POST /api/users → POST /api/super-admin/muni-policies
 */
import { useEffect, useMemo, useState } from 'react';
import { PRESETS, type PresetKey } from '@/lib/permission-presets';
import { formatKoreanPhone } from '@/lib/phone';

type Muni = { id: string; name: string; code: string; region: string | null };

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

  /* Step 2 진입 시 지자체 목록 로드 */
  useEffect(() => {
    if (step !== 2 || munis.length > 0) return;
    fetch('/api/super-admin/municipalities?status=ACTIVE&limit=500')
      .then((r) => r.json())
      .then((j) => setMunis(j.items ?? []))
      .catch(() => setError('지자체 목록 로드 실패'));
  }, [step, munis.length]);

  const filteredMunis = useMemo(() => {
    const q = muniQuery.trim();
    if (!q) return munis.slice(0, 20);
    return munis.filter((m) => m.name.includes(q) || m.code.includes(q) || (m.region ?? '').includes(q)).slice(0, 50);
  }, [munis, muniQuery]);

  function setField<K extends keyof WizardData>(k: K, v: WizardData[K]) {
    setData((d) => ({ ...d, [k]: v }));
    setError(null);
  }

  function validate(s: Step): string | null {
    if (s === 1) {
      if (!data.companyName.trim()) return '회사명 필수';
      if (!/^\d{3}-?\d{2}-?\d{5}$/.test(data.businessNo.trim())) return '사업자번호 10자리 (000-00-00000)';
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
              <Field label="사업자번호 *">
                <Input value={data.businessNo} onChange={(v) => setField('businessNo', v)} placeholder="000-00-00000" />
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
              <p className="text-xs text-slate-600">사전 등록된 226개 시군구 중 선택. 1개만 선택 가능.</p>
              <Input value={muniQuery} onChange={setMuniQuery} placeholder="🔍 지자체명/코드 검색 (예: 강남구)" />
              <div className="border border-line rounded-md max-h-64 overflow-y-auto">
                {filteredMunis.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-slate-500">
                    {munis.length === 0 ? '로딩 중…' : '검색 결과 없음'}
                  </div>
                )}
                {filteredMunis.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => setField('municipalityId', m.id)}
                    className={`w-full px-3 py-2 text-left text-sm border-b border-line last:border-b-0 transition ${
                      data.municipalityId === m.id ? 'bg-accent text-white font-extrabold' : 'hover:bg-slate-50'
                    }`}
                  >
                    {m.name}
                    <span className={`ml-2 text-[0.625rem] font-mono ${data.municipalityId === m.id ? 'text-cyan-100' : 'text-slate-500'}`}>
                      {m.region ?? ''} · {m.code}
                    </span>
                  </button>
                ))}
              </div>
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
                Phase 1 P1-3 범위 — CSV 업로드는 다음 작업(P1-5)에서 추가됩니다.
                <br />
                지금은 [건너뛰고 완료] 후 사용자 관리에서 개별 등록하거나, CONTRACTOR_ADMIN이 직접 추가하면 됩니다.
              </p>
              <div className="bg-amber-50 border border-amber-300 rounded-md px-3 py-2 text-xs text-amber-900 font-semibold">
                💡 다음 단계 [완료]를 누르면 위탁업체 + 권한 정책 + CONTRACTOR_ADMIN 계정이 모두 생성됩니다.
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
              <div className="bg-slate-50 border border-line rounded-md px-3 py-3 space-y-1.5 text-sm font-mono">
                <div><b className="text-slate-700">접속 URL:</b> <span className="text-accent">https://wci.helpbiz.kr/login</span></div>
                <div><b className="text-slate-700">아이디:</b> {data.adminUsername}</div>
                <div><b className="text-slate-700">임시 PW:</b> <code className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">{data.adminPassword}</code></div>
                <div><b className="text-slate-700">회사:</b> {data.companyName} ({data.businessNo})</div>
                <div><b className="text-slate-700">계약 상태:</b> SETUP</div>
              </div>
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
