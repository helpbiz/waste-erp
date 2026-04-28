// PWA 아이콘 생성 스크립트 — public/icons/icon-master.svg 에서 모든 사이즈 PNG 생성
// 사용: node scripts/generate-pwa-icons.mjs
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'public/icons/icon-master.svg');
const OUT = path.join(ROOT, 'public/icons');
const BG = '#1e3a5f';

const targets = [
  { name: 'icon-192.png', size: 192, mode: 'fit' },
  { name: 'icon-512.png', size: 512, mode: 'fit' },
  { name: 'icon-180.png', size: 180, mode: 'fit' },               // iOS apple-touch-icon
  { name: 'icon-maskable-512.png', size: 512, mode: 'maskable' }, // Android adaptive (안전영역 80%)
];

const svg = await fs.readFile(SRC);

for (const t of targets) {
  if (t.mode === 'fit') {
    await sharp(svg, { density: 384 })
      .resize(t.size, t.size, { fit: 'contain', background: BG })
      .png()
      .toFile(path.join(OUT, t.name));
  } else if (t.mode === 'maskable') {
    // 안드로이드 어댑티브 안전영역: 중앙 80%(409.6px). 그래서 콘텐츠를 410px로 그리고 배경 패딩
    const inner = Math.round(t.size * 0.8);
    const innerBuf = await sharp(svg, { density: 384 })
      .resize(inner, inner, { fit: 'contain', background: BG })
      .png()
      .toBuffer();
    const pad = Math.round((t.size - inner) / 2);
    await sharp({
      create: { width: t.size, height: t.size, channels: 4, background: BG },
    })
      .composite([{ input: innerBuf, top: pad, left: pad }])
      .png()
      .toFile(path.join(OUT, t.name));
  }
  console.log(`✓ ${t.name} (${t.size}x${t.size}, ${t.mode})`);
}

console.log('\n✅ 모든 PWA 아이콘 생성 완료');
