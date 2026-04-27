'use client';

/**
 * ApprovalSignatureModal — 결재 시점 서명 캡처
 * Design Ref: §5.3
 *
 * 1) 본인 active 서명이 있으면 자동 노출 + "이 서명으로 승인" 버튼
 * 2) "재서명" 버튼 → 캔버스 펼쳐 즉석 등록
 * 3) onApprove(payload)로 상위에 전달:
 *      { signature?: dataUrl, useStoredSignature?: true, comment? }
 */
import { useEffect, useState } from 'react';
import SignaturePad from './SignaturePad';

export type ApprovalPayload = {
  signature?: string;
  useStoredSignature?: boolean;
  comment?: string;
};

export default function ApprovalSignatureModal({
  title,
  subtitle,
  preview,
  busy,
  onClose,
  onApprove,
  onReject,
  storedSignatureUrl,
  storedSignatureRef,
}: {
  title: string;
  subtitle?: string;
  preview?: React.ReactNode;
  busy?: boolean;
  onClose: () => void;
  onApprove: (payload: ApprovalPayload) => void | Promise<void>;
  onReject?: (payload: ApprovalPayload) => void | Promise<void>;
  storedSignatureUrl?: string | null;
  storedSignatureRef?: string | null;
}) {
  const [mode, setMode] = useState<'stored' | 'redraw'>(storedSignatureUrl ? 'stored' : 'redraw');
  const [drawn, setDrawn] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    setMode(storedSignatureUrl ? 'stored' : 'redraw');
  }, [storedSignatureUrl]);

  function approve() {
    if (mode === 'stored') {
      onApprove({ useStoredSignature: true, comment: comment || undefined });
    } else {
      if (!drawn) { alert('서명을 작성하세요.'); return; }
      onApprove({ signature: drawn, comment: comment || undefined });
    }
  }
  function reject() {
    if (!onReject) return;
    if (mode === 'stored') {
      onReject({ useStoredSignature: true, comment: comment || undefined });
    } else if (drawn) {
      onReject({ signature: drawn, comment: comment || undefined });
    } else {
      onReject({ comment: comment || undefined });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-[520px] max-w-[95vw] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-line flex items-center">
          <h3 className="font-extrabold text-ink">{title}</h3>
          {subtitle && <span className="ml-2 text-[11px] font-mono text-slate-600">{subtitle}</span>}
          <button onClick={onClose} className="ml-auto text-slate-600 hover:text-ink text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          {preview && <div className="bg-slate-50 border border-line rounded-md px-3 py-2 text-xs">{preview}</div>}

          {storedSignatureUrl && (
            <div>
              <label className="flex items-center gap-2 mb-2">
                <input type="radio" checked={mode === 'stored'} onChange={() => setMode('stored')} />
                <span className="text-xs font-extrabold text-ink">저장된 서명 사용</span>
                {storedSignatureRef && <span className="text-[10px] font-mono text-slate-600">ref: {storedSignatureRef}</span>}
              </label>
              {mode === 'stored' && (
                <div className="bg-white border-2 border-accent rounded-md p-2 flex items-center justify-center" style={{ height: 120 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={storedSignatureUrl} alt="signature" className="max-h-full max-w-full" />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 mb-2">
              <input type="radio" checked={mode === 'redraw'} onChange={() => setMode('redraw')} />
              <span className="text-xs font-extrabold text-ink">{storedSignatureUrl ? '재서명' : '서명 작성'}</span>
            </label>
            {mode === 'redraw' && <SignaturePad onChange={setDrawn} height={140} />}
          </div>

          <div>
            <div className="text-[10px] font-mono font-extrabold text-slate-600 mb-1">의견 (선택)</div>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="결재 의견"
              className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-line bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="px-4 py-1.5 rounded text-sm font-bold bg-white border border-line">
            취소
          </button>
          {onReject && (
            <button onClick={reject} disabled={busy}
              className="px-4 py-1.5 rounded text-sm font-extrabold bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 disabled:opacity-50">
              반려
            </button>
          )}
          <button onClick={approve} disabled={busy}
            className="px-5 py-1.5 rounded text-sm font-extrabold bg-accent text-white hover:bg-accent-strong disabled:opacity-50">
            {busy ? '처리 중…' : '승인 + 서명'}
          </button>
        </div>
      </div>
    </div>
  );
}
