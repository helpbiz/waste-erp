'use client';

// Design Ref: §5.3 — 처리시설 드롭다운 (재사용, 지자체 단위)
// Plan SC: /performance 반입 입력 폼에 처리시설 선택 가능

import { useEffect, useState } from 'react';
import { FACILITY_TYPE_LABELS, type FacilityType } from '@/lib/facility';

type Facility = {
  id: string;
  type: FacilityType;
  name: string;
  active: boolean;
};

export function FacilitySelect({
  value,
  onChange,
  className = '',
  ariaLabel = '처리시설 선택',
  required = false,
  municipalityId,
  /* 역호환 — 일부 caller 가 contractorId 로 전달하던 것 무시. 서버가 자동 scope 처리 */
  contractorId: _contractorId,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
  ariaLabel?: string;
  required?: boolean;
  municipalityId?: string;  // SUPER_ADMIN이 다른 지자체 facility 선택 시
  contractorId?: string;    // deprecated, server-side auto scope
}) {
  const [items, setItems] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const url = municipalityId
      ? `/api/super-admin/facilities?active=true&municipalityId=${municipalityId}`
      : '/api/super-admin/facilities?active=true';
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          setItems([]);
        } else {
          setItems(d.items ?? []);
          setError(null);
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [municipalityId]);

  // 안내 메시지 — 슈퍼관리자 콘솔 링크는 비-SUPER_ADMIN 에게 노출하지 않음
  if (!loading && !error && items.length === 0) {
    return (
      <div className={`text-[0.6875rem] font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded px-2.5 py-1.5 ${className}`}>
        ⚠ 처리시설이 등록되어 있지 않습니다. 슈퍼관리자에 등록을 요청하세요.
      </div>
    );
  }

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={loading}
      aria-label={ariaLabel}
      required={required}
      className={`px-3 py-1.5 rounded border border-line text-sm font-bold bg-white disabled:bg-slate-50 ${className}`}
    >
      <option value="">{required ? '— 처리시설 선택 —' : '(미지정)'}</option>
      {items.map((f) => (
        <option key={f.id} value={f.id}>
          [{FACILITY_TYPE_LABELS[f.type] ?? f.type}] {f.name}
        </option>
      ))}
    </select>
  );
}
