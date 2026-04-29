'use client';

export default function PrintActions() {
  return (
    <div className="actions no-print">
      <button onClick={() => window.print()}>🖨 인쇄 / PDF 저장</button>
      <a href="/super-admin" style={{ padding: '6px 12px', border: '1px solid #999', borderRadius: 4, textDecoration: 'none', color: '#333', fontWeight: 700 }}>← 콘솔로 돌아가기</a>
    </div>
  );
}
