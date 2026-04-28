'use client';

/**
 * MultiPhotoUploader — 민원 현장 사진 (최대 3장, 카메라 직접 촬영 지원)
 *
 * - jpeg/png/webp 허용
 * - 1024px 리사이즈 + JPEG 0.85 인코딩 → 보통 200~400KB / 사진
 * - 모바일에서 카메라 직접 촬영(`capture="environment"`)
 * - 개별 삭제·미리보기 클릭 확대
 */
import { useRef, useState } from 'react';

const MAX_DIM = 1024;
const TARGET_KB = 3000; // 사진 1장당 3MB 한도 (모바일 카메라 직촬 여유)

export default function MultiPhotoUploader({
  initial,
  onChange,
  max = 3,
}: {
  initial?: string[];
  onChange: (photos: string[]) => void;
  max?: number;
}) {
  const [photos, setPhotos] = useState<string[]>(initial ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const camRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (photos.length + files.length > max) {
      setError(`최대 ${max}장까지 첨부할 수 있어요. 기존 사진을 제거하고 다시 선택하세요.`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const accepted: string[] = [];
      for (const f of Array.from(files)) {
        /* 일부 모바일은 type이 비어 있거나 image/heic 등을 반환 — image/* 면 일단 시도 */
        if (f.type && !/^image\//i.test(f.type)) {
          setError(`${f.name}: 이미지 파일이 아닙니다 (${f.type}).`);
          continue;
        }
        try {
          const dataUrl = await resize(f, MAX_DIM);
          const sizeKb = Math.round((dataUrl.length * 0.75) / 1024);
          if (sizeKb > TARGET_KB) {
            setError(`${f.name}: ${sizeKb}KB로 한도(${TARGET_KB}KB) 초과. 더 작은 사진을 사용하세요.`);
            continue;
          }
          accepted.push(dataUrl);
        } catch (err) {
          setError(`${f.name}: 처리 실패 — ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
        }
      }
      if (accepted.length) {
        const next = [...photos, ...accepted].slice(0, max);
        setPhotos(next);
        onChange(next);
      }
    } catch (e) {
      setError('이미지 처리 실패: ' + (e instanceof Error ? e.message : 'unknown'));
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
      if (camRef.current) camRef.current.value = '';
    }
  }

  function removeAt(i: number) {
    const next = photos.filter((_, idx) => idx !== i);
    setPhotos(next);
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {/* 미리보기 그리드 */}
      <div className="grid grid-cols-3 gap-2">
        {photos.map((src, i) => (
          <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border-2 border-line bg-surface-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`현장 사진 ${i + 1}`}
              className="w-full h-full object-cover cursor-zoom-in"
              onClick={() => setZoomed(src)}
            />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600/90 text-white text-xs font-extrabold leading-none hover:bg-red-700 shadow"
              aria-label="사진 제거"
            >
              ×
            </button>
            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[0.5625rem] font-mono font-bold">
              #{i + 1}
            </div>
          </div>
        ))}
        {photos.length < max && (
          <button
            type="button"
            disabled={loading}
            onClick={() => fileRef.current?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-line hover:border-accent hover:bg-accent-soft text-ink-muted hover:text-accent flex flex-col items-center justify-center gap-1 transition disabled:opacity-50"
          >
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <circle cx="12" cy="13" r="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[0.625rem] font-extrabold">사진 추가</span>
          </button>
        )}
      </div>

      {/* 액션 버튼 (촬영/선택) */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={loading || photos.length >= max}
          onClick={() => camRef.current?.click()}
          className="flex-1 px-3 py-2 rounded-md bg-accent text-white text-xs font-extrabold hover:bg-accent-strong active:bg-cyan-800 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <circle cx="12" cy="13" r="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          카메라 촬영
        </button>
        <button
          type="button"
          disabled={loading || photos.length >= max}
          onClick={() => fileRef.current?.click()}
          className="flex-1 px-3 py-2 rounded-md border-2 border-line text-xs font-extrabold hover:bg-surface-soft text-ink disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          앨범에서 선택
        </button>
      </div>

      {/* 숨겨진 input들 */}
      <input
        ref={camRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        capture="environment"
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {/* 상태/에러 */}
      <div className="flex items-center justify-between text-[0.625rem] font-mono">
        <span className="text-slate-600">
          {photos.length}/{max}장 · 자동 1024px 리사이즈
        </span>
        {loading && <span className="text-accent font-bold animate-pulse">처리 중…</span>}
      </div>
      {error && <div className="text-[0.6875rem] font-bold text-red-600">{error}</div>}

      {/* 확대 보기 모달 */}
      {zoomed && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center px-4 py-8"
          onClick={() => setZoomed(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomed} alt="확대" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoomed(null); }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white text-2xl font-extrabold backdrop-blur"
          >
            ×
          </button>
        </div>
      )}
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
