import type { ReactNode } from 'react';

/** 입력 필드/정보 행 1줄 — 라벨 + 값(또는 placeholder) 표시. */
export default function FormRowMock({
  label,
  value,
  placeholder,
  type = 'value',
}: {
  label: string;
  value?: ReactNode;
  placeholder?: string;
  type?: 'value' | 'input' | 'header';
}) {
  return (
    <div className="mock-row" data-type={type}>
      <span className="mock-row-label">{label}</span>
      {type === 'input' ? (
        <span className="mock-row-input">{value ?? <span className="mock-row-placeholder">{placeholder}</span>}</span>
      ) : (
        <span className="mock-row-value">{value}</span>
      )}
    </div>
  );
}
