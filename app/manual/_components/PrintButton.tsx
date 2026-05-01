'use client';

export default function PrintButton({ label = 'PDF로 저장' }: { label?: string }) {
  return (
    <button
      className="manual-print-btn"
      onClick={() => window.print()}
      aria-label={`${label} (인쇄 다이얼로그 열기)`}
    >
      <span aria-hidden>↓</span> {label}
    </button>
  );
}
