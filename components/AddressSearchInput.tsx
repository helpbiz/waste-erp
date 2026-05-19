'use client';

import { useCallback, useEffect } from 'react';

declare global {
  interface Window {
    daum?: {
      Postcode: new (config: {
        oncomplete: (data: DaumPostcodeResult) => void;
        onclose?: () => void;
        width?: number;
        height?: number;
      }) => { open: () => void };
    };
  }
}

type DaumPostcodeResult = {
  zonecode: string;        // 우편번호
  address: string;         // 도로명 주소
  jibunAddress: string;    // 지번 주소
  bname: string;           // 법정동명
  buildingName: string;    // 건물명
  apartment: string;       // 아파트 여부 ('Y'|'N')
};

type Props = {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

const SCRIPT_URL =
  'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

export function AddressSearchInput({
  value,
  onChange,
  placeholder = '주소를 검색하세요',
  className = '',
  disabled = false,
}: Props) {
  // 스크립트 사전 로드 (마운트 시)
  useEffect(() => {
    if (document.querySelector(`script[src="${SCRIPT_URL}"]`)) return;
    const s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    document.head.appendChild(s);
  }, []);

  const openSearch = useCallback(() => {
    const open = () => {
      new window.daum!.Postcode({
        oncomplete(data) {
          // 도로명 우선, 없으면 지번
          const addr = data.address || data.jibunAddress;
          const building = data.buildingName
            ? ` (${data.buildingName})`
            : '';
          onChange(addr + building);
        },
      }).open();
    };

    if (window.daum?.Postcode) {
      open();
    } else {
      // 스크립트 로드 대기
      const s = document.querySelector<HTMLScriptElement>(
        `script[src="${SCRIPT_URL}"]`
      );
      if (s) {
        s.addEventListener('load', open, { once: true });
      } else {
        const el = document.createElement('script');
        el.src = SCRIPT_URL;
        el.async = true;
        el.addEventListener('load', open, { once: true });
        document.head.appendChild(el);
      }
    }
  }, [onChange]);

  return (
    <div className={`flex gap-2 ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 min-w-0 px-3 py-2 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent disabled:opacity-50"
      />
      <button
        type="button"
        onClick={openSearch}
        disabled={disabled}
        className="shrink-0 px-3 py-2 rounded-lg border-2 border-line text-sm font-bold text-ink hover:bg-surface-soft transition disabled:opacity-50 whitespace-nowrap"
      >
        주소 검색
      </button>
    </div>
  );
}
