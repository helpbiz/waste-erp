'use client';

/**
 * SignaturePad — 공용 서명 캔버스 (touch + mouse)
 * Design Ref: §3 (TBM canvas 추출 + 일반화)
 *
 * 사용:
 *   <SignaturePad onChange={(dataUrl) => setSig(dataUrl)} height={160} />
 */
import { useEffect, useRef, useState } from 'react';

export default function SignaturePad({
  onChange,
  height = 160,
  disabled = false,
  initial,
}: {
  onChange: (dataUrl: string | null) => void;
  height?: number;
  disabled?: boolean;
  initial?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const dirtyRef = useRef(false);
  const [showHint, setShowHint] = useState(!initial);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.offsetWidth, c.offsetHeight);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';

    /* initial 이미지 로드 */
    if (initial) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, c.offsetWidth, c.offsetHeight);
        dirtyRef.current = true;
        setShowHint(false);
      };
      img.src = initial;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toLocal(e: React.PointerEvent): { x: number; y: number } {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function start(e: React.PointerEvent) {
    if (disabled) return;
    drawingRef.current = true;
    dirtyRef.current = true;
    setShowHint(false);
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = toLocal(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function move(e: React.PointerEvent) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = toLocal(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  function end() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(getDataUrl());
  }

  function clear() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.offsetWidth, c.offsetHeight);
    dirtyRef.current = false;
    setShowHint(true);
    onChange(null);
  }

  function getDataUrl(): string | null {
    if (!dirtyRef.current) return null;
    return canvasRef.current!.toDataURL('image/png');
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: `${height}px`, touchAction: 'none' }}
          className="border-2 border-line rounded-lg bg-white"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        />
        {showHint && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-ink-faint text-sm font-bold select-none">
            ✍ 여기에 서명해 주세요
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          className="text-sm font-extrabold text-ink-faint hover:text-red-600 px-3 py-1 rounded-md border border-line hover:border-red-300 transition disabled:opacity-50"
        >
          지우기
        </button>
      </div>
    </div>
  );
}
