/** 모바일 하단 탭바 목업 — 5탭, 활성 탭 강조. */

const TABS = [
  { key: 'home',      label: '홈',     glyph: '⌂' },
  { key: 'clock',     label: '출퇴근', glyph: '◷' },
  { key: 'complaint', label: '민원',   glyph: '◉' },
  { key: 'safety',    label: '안전',   glyph: '◇' },
  { key: 'perf',      label: '실적',   glyph: '▥' },
] as const;

export type TabKey = (typeof TABS)[number]['key'];

export default function TabBarMock({ active }: { active?: TabKey }) {
  return (
    <div className="mock-tabbar">
      {TABS.map((t) => (
        <div className="mock-tab" data-active={active === t.key} key={t.key}>
          <span className="mock-tab-glyph" aria-hidden>{t.glyph}</span>
          <span className="mock-tab-label">{t.label}</span>
        </div>
      ))}
    </div>
  );
}
