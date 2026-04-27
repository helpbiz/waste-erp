'use client';

/**
 * ProfilePhotoUploader — 파일 → data URL + 클라이언트 리사이즈
 * Design Ref: §3, NFR-01 (500KB 제한)
 *
 * - jpeg/png/webp 허용
 * - 최대 480px (리사이즈) — Avatar 용도
 * - JPEG 0.85 인코딩 → 보통 50~150KB
 */
import { useRef, useState } from 'react';

const MAX_DIM = 480;
const TARGET_KB = 500;

export default function ProfilePhotoUploader({
  initialDataUrl,
  onChange,
  size = 96,
}: {
  initialDataUrl?: string | null;
  onChange: (dataUrl: string | null) => void;
  size?: number;
}) {
  const [preview, setPreview] = useState<string | null>(initialDataUrl ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      setError('PNG/JPEG/WEBP 파일만 가능합니다.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const dataUrl = await resize(file, MAX_DIM);
      const sizeKb = Math.round((dataUrl.length * 0.75) / 1024);
      if (sizeKb > TARGET_KB) {
        setError(`리사이즈 후에도 ${sizeKb}KB로 ${TARGET_KB}KB 초과. 더 작은 이미지를 선택하세요.`);
        return;
      }
      setPreview(dataUrl);
      onChange(dataUrl);
    } catch (e) {
      setError('이미지 처리 실패: ' + (e instanceof Error ? e.message : 'unknown'));
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setPreview(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className="rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border-2 border-line shrink-0"
        style={{ width: size, height: size }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="profile" className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl text-slate-600">📷</span>
        )}
      </div>
      <div className="flex-1">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="block w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-accent file:text-white file:text-xs file:font-extrabold hover:file:bg-accent-strong file:cursor-pointer cursor-pointer"
        />
        <div className="flex items-center gap-2 mt-1.5">
          {loading && <span className="text-[10px] font-mono text-slate-600">처리 중…</span>}
          {preview && (
            <button type="button" onClick={clear} className="text-[10px] font-bold text-red-600 hover:underline">
              제거
            </button>
          )}
          <span className="text-[10px] font-mono text-slate-600 ml-auto">최대 480px · 500KB</span>
        </div>
        {error && <div className="text-[11px] font-bold text-red-600 mt-1">{error}</div>}
      </div>
    </div>
  );
}

async function resize(file: File, maxDim: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    /* JPEG로 통일하여 용량 압축 */
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
