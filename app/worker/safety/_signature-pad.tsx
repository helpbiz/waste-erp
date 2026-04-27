'use client';

import { useEffect, useRef, useState } from 'react';

export type SignaturePadHandle = {
  getDataUrl: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
};

/**
 * Touch + mouse signature pad
 *  - HTML5 Canvas
 *  - 흰 배경 + 검은 잉크 (PNG, ~10KB)
 *  - "지우기" 버튼 + 외부 핸들 (forwardRef 대신 콜백 prop)
 */
export default function SignaturePad({
  onChange,
  height = 160,
  disabled = false,
}: {
  onChange: (dataUrl: string | null) => void;
  height?: number;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const dirtyRef = useRef(false);
  const [showCleared, setShowCleared] = useState(true);

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
  }, []);

  function toLocal(e: PointerEvent | React.PointerEvent): { x: number; y: number } {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const ev = 'clientX' in e ? e : (e as PointerEvent);
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  function start(e: React.PointerEvent) {
    if (disabled) return;
    drawingRef.current = true;
    dirtyRef.current = true;
    setShowCleared(false);
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
    setShowCleared(true);
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
          className="border-2 border-line rounded-lg bg-surface"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        />
        {showCleared && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-ink-faint text-sm font-bold">
            ✍ 여기에 서명해 주세요
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          className="text-xs font-extrabold text-ink-muted hover:text-danger px-3 py-1.5 rounded-md border border-line hover:border-danger transition disabled:opacity-50"
        >
          지우기
        </button>
      </div>
    </div>
  );
}
