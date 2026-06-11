'use client';

type Props = {
  onApply: (from: string, to: string) => void;
};

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

const RANGE_PRESETS: { label: string; range: () => [string, string] }[] = [
  {
    label: '오늘',
    range: () => { const t = fmt(new Date()); return [t, t]; },
  },
  {
    label: '이번주',
    range: () => {
      const now = new Date();
      const day = now.getDay();
      const mon = new Date(now);
      mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return [fmt(mon), fmt(sun)];
    },
  },
  {
    label: '이번달',
    range: () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return [fmt(first), fmt(last)];
    },
  },
  {
    label: '전분기',
    range: () => {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3);
      const prevQ = q === 0 ? 3 : q - 1;
      const year = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const first = new Date(year, prevQ * 3, 1);
      const last = new Date(year, prevQ * 3 + 3, 0);
      return [fmt(first), fmt(last)];
    },
  },
  {
    label: '올해',
    range: () => {
      const y = new Date().getFullYear();
      return [`${y}-01-01`, `${y}-12-31`];
    },
  },
];

export function DateRangePresets({ onApply }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {RANGE_PRESETS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => {
            const [f, t] = p.range();
            onApply(f, t);
          }}
          className="px-2.5 py-1 rounded text-[0.6875rem] font-extrabold bg-surface border border-line text-ink-muted hover:border-purple-400 hover:text-purple-700 hover:bg-purple-50 transition"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
