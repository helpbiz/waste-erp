'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SignaturePad from '@/components/SignaturePad';
import ProfilePhotoUploader from '@/components/ProfilePhotoUploader';
/* PWA Mobile UX Mastering 2026-04-28: 로그아웃은 AppBar 우상단(default LogoutButton compact)으로 이동.
   이 페이지 하단 로그아웃 카드는 중복이 되어 제거. */

type UserData = {
  id: string;
  name: string;
  employeeNo: string | null;
  phone: string | null;
  birthDate: string | null;
  hireDate: string | null;
  address: string | null;
  bankName: string | null;
  bankAccount: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  positionLabel: string | null;
  positionCategory: string | null;
  departmentName: string | null;
  profilePhotoUrl: string | null;
  activeSignatureRef: string | null;
  activeSignatureUrl: string | null;
};

export default function ProfileClient({ user }: { user: UserData }) {
  const router = useRouter();
  const [photo, setPhoto] = useState<string | null>(user.profilePhotoUrl);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [consentPII, setConsentPII] = useState(true);
  const [signature, setSignature] = useState<string | null>(null);
  const [signatureChanged, setSignatureChanged] = useState(false);

  const [form, setForm] = useState({
    /* 전화번호는 숫자만 저장 (하이픈 제거) — 표시할 때만 자동 포매팅 */
    phone: stripDigits(user.phone),
    address: user.address ?? '',
    bankName: user.bankName ?? '',
    bankAccount: user.bankAccount ?? '',
    emergencyContact: user.emergencyContact ?? '',
    emergencyPhone: stripDigits(user.emergencyPhone),
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (photoChanged && photo && !consentPII) {
      alert('사진 등록 시 개인정보 동의가 필요합니다.');
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = { ...form };
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
    if (photoChanged) {
      payload.profilePhoto = photo;
      if (photo) payload.consentPII = consentPII;
    }
    /* 서명은 미등록 상태에서만 1회 전송 — 이미 등록된 경우 변경 불가 */
    if (signatureChanged && !user.activeSignatureUrl) payload.signature = signature;

    const res = await fetch('/api/worker/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      alert('저장되었습니다.');
      setPhotoChanged(false);
      setSignatureChanged(false);
      router.refresh();
    } else {
      alert('실패: ' + (await res.json().catch(() => ({}))).error);
    }
  }

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="flex items-center gap-3 px-1">
        <Link href="/worker" className="text-accent text-2xl font-extrabold">←</Link>
        <h1 className="text-xl font-black text-ink tracking-tight">내 프로필</h1>
      </div>

      {/* 헤더 카드 — 사진 + 이름 + 직책 */}
      <div className="bg-gradient-to-br from-accent to-cyan-700 rounded-2xl p-5 text-white shadow-card flex items-center gap-4">
        <div className="rounded-full bg-white/20 border-2 border-white/40 overflow-hidden flex items-center justify-center w-[72px] h-[72px] shrink-0">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="profile" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-black">{user.name.charAt(0)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-black truncate">{user.name}</div>
          <div className="text-xs font-mono font-bold text-cyan-100 mt-0.5">사번 {user.employeeNo ?? '—'}</div>
          <div className="text-xs font-bold text-cyan-100 mt-1">
            {user.positionLabel ?? '직책 미지정'} · {user.departmentName ?? '부서 미지정'}
          </div>
        </div>
      </div>

      {/* 사진 등록 */}
      <Section title="프로필 사진">
        <ProfilePhotoUploader
          initialDataUrl={photo}
          onChange={(d) => { setPhoto(d); setPhotoChanged(true); }}
          size={88}
        />
        {photoChanged && photo && (
          <label className="flex items-center gap-2 mt-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded px-2 py-1.5">
            <input type="checkbox" checked={consentPII} onChange={(e) => setConsentPII(e.target.checked)} />
            개인정보(사진) 수집·이용 동의 (필수)
          </label>
        )}
      </Section>

      {/* 서명 — 등록된 경우 잠금 표시, 미등록 시 1회 등록 */}
      <Section title="서명">
        {user.activeSignatureUrl ? (
          <div>
            <div className="bg-white border-2 border-line rounded-lg p-3 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={user.activeSignatureUrl} alt="signature" className="max-h-[120px]" />
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-extrabold text-emerald-700">
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              등록 완료 — 수정 불가
            </div>
            <div className="text-xs font-mono text-emerald-700/70 mt-0.5">ref: {user.activeSignatureRef}</div>
            <div className="text-xs text-amber-700 mt-2 leading-relaxed">
              ⚠️ 서명은 한 번 등록하면 본인이 직접 수정할 수 없습니다. 변경이 필요하면 <strong>관리자</strong>에게 문의하세요.
            </div>
          </div>
        ) : (
          <>
            <div className="text-xs font-mono font-extrabold text-slate-600 mb-1">
              서명 등록 (1회 등록 · 등록 후 수정 불가)
            </div>
            <SignaturePad
              onChange={(d) => { setSignature(d); setSignatureChanged(true); }}
              height={160}
            />
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-300 rounded px-2.5 py-1.5 mt-2 font-bold leading-relaxed">
              ⚠️ 서명은 <strong className="font-extrabold">한 번 등록하면 본인이 수정할 수 없습니다.</strong> 신중하게 작성하세요.
            </div>
          </>
        )}
      </Section>

      {/* 연락처 */}
      <Section title="연락처">
        <div className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded px-2.5 py-1.5 -mt-1">
          💡 전화번호는 <strong className="font-extrabold">숫자만</strong> 입력하세요. 하이픈(-)은 자동으로 표시됩니다.
        </div>
        <Field label="휴대전화">
          <PhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="01012345678" />
        </Field>
        <Field label="비상연락 이름">
          <Input value={form.emergencyContact} onChange={(v) => setForm({ ...form, emergencyContact: v })} />
        </Field>
        <Field label="비상연락 전화">
          <PhoneInput value={form.emergencyPhone} onChange={(v) => setForm({ ...form, emergencyPhone: v })} placeholder="01012345678" />
        </Field>
      </Section>

      {/* PII 자율 갱신 (주소·계좌) */}
      <Section title="주소·계좌 (암호화 보관)">
        <Field label="주소">
          <Input value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
        </Field>
        <Field label="은행명">
          <Input value={form.bankName} onChange={(v) => setForm({ ...form, bankName: v })} />
        </Field>
        <Field label="계좌번호">
          <Input value={form.bankAccount} onChange={(v) => setForm({ ...form, bankAccount: v })} />
        </Field>
      </Section>

      <button onClick={save} disabled={saving}
        className="w-full py-3.5 rounded-xl bg-accent text-white text-base font-extrabold shadow-card active:scale-[0.99] transition disabled:opacity-50">
        {saving ? '저장 중…' : '저장'}
      </button>

      {/* 로그아웃은 AppBar 우상단으로 이동 (PWA Mobile UX Mastering 2026-04-28).
          하단 카드 제거 사유: 모든 worker 화면 우상단에 항상 보이므로 프로필 페이지에 별도 표시 중복. */}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-line rounded-xl shadow-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-line bg-surface-soft text-[0.75rem] font-extrabold text-ink tracking-tight">{title}</div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

// Design Ref: field-label-refactor §2 — shared Field로 통합
import { Field as BaseField } from '@/components/Field';
type FieldArgs = React.ComponentProps<typeof BaseField>;
function Field(props: FieldArgs) {
  return <BaseField {...props} labelClassName={props.labelClassName ?? 'block text-xs font-mono font-extrabold text-slate-600 mb-1'} />;
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 rounded-lg border border-line bg-white text-sm font-bold"
    />
  );
}

/* 휴대전화 입력기 — 숫자만 저장하고 화면에는 000-000-0000 자동 포매팅 */
function PhoneInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (digitsOnly: string) => void;
  placeholder?: string;
}) {
  const digits = stripDigits(value);
  const formatted = formatPhone(digits);
  return (
    <input
      value={formatted}
      onChange={(e) => onChange(stripDigits(e.target.value).slice(0, 11))}
      placeholder={placeholder}
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      maxLength={13}  /* 010-1234-5678 = 13자 */
      className="w-full px-3 py-2.5 rounded-lg border border-line bg-white text-sm font-mono font-bold tracking-wide"
    />
  );
}

/* 숫자만 추출 (null·undefined 안전) */
function stripDigits(v: string | null | undefined): string {
  return (v ?? '').replace(/[^\d]/g, '');
}

/* 입력된 숫자열 → 한국 휴대전화 표기 (010-1234-5678 / 02-123-4567 등) */
function formatPhone(d: string): string {
  if (!d) return '';
  /* 02 (서울) 지역번호: 2자리 */
  if (d.startsWith('02')) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }
  /* 그 외 (010, 070, 031 등) — 3자리 */
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
}
