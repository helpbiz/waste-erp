import type { Config } from 'tailwindcss';

/* Plan §5.1 디자인 토큰 — 시안 HTML과 동일 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: '#e2e8f0',
        sidebar: '#1e3a5f',
        surface: { DEFAULT: '#ffffff', alt: '#f8fafc', soft: '#f1f5f9' },
        line: { DEFAULT: '#cbd5e1', strong: '#64748b' },
        accent: { DEFAULT: '#0c6a84', light: '#06b6d4', soft: '#cffafe' },
        ink: { DEFAULT: '#000000', mid: '#0f172a', muted: '#1e293b', faint: '#475569' },
        warn: '#b45309',
        danger: '#b91c1c',
        info: '#1d4ed8',
        success: '#15803d',
      },
      fontFamily: {
        /* Pretendard Variable 우선 (한글 가독성 + variable weight) — globals.css @font-face 와 동기화 */
        sans: ['"Pretendard Variable"', '"Noto Sans KR"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 4px 12px rgba(15, 23, 42, 0.12)',
        modal: '0 16px 48px rgba(15, 23, 42, 0.25)',
      },
      keyframes: {
        'slide-in': {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-up': {
          '0%':   { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.22s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
