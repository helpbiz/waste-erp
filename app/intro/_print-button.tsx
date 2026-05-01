'use client';

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} aria-label="PDF 저장 (인쇄 다이얼로그 열기)">
      PDF 저장
    </button>
  );
}
