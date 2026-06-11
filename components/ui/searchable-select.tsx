'use client';
import { useEffect, useRef, useState } from 'react';

type Option = { value: string; label: string };

type Props = {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
};

export function SearchableSelect({ options, value, onChange, placeholder = '선택', className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = options
    .filter((o) => !query || o.label.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.label.localeCompare(b.label, 'ko'));

  useEffect(() => { setActiveIdx(-1); }, [query]);

  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const el = listRef.current.children[activeIdx] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIdx]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && filtered[activeIdx]) {
        onChange(filtered[activeIdx].value);
        setOpen(false);
        setQuery('');
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  return (
    <div className={`relative ${className}`}>
      <div
        className="flex items-center gap-1 px-3 py-1.5 rounded border border-line bg-surface min-w-[200px] cursor-pointer"
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        {open ? (
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => { setOpen(false); setQuery(''); }, 150)}
            placeholder={selected?.label ?? placeholder}
            className="flex-1 text-sm font-bold bg-transparent outline-none placeholder:text-ink-muted min-w-0"
            autoFocus
          />
        ) : (
          <span className="flex-1 text-sm font-bold truncate">
            {selected ? (
              <span className="text-ink">{selected.label}</span>
            ) : (
              <span className="text-ink-faint">{placeholder}</span>
            )}
          </span>
        )}
        <svg
          className={`w-3.5 h-3.5 text-ink-faint shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 w-full bg-white border border-line rounded-lg shadow-lg max-h-56 overflow-auto"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-faint">결과 없음</li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(o.value);
                  setOpen(false);
                  setQuery('');
                }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`px-3 py-2 text-sm font-bold cursor-pointer ${
                  o.value === value
                    ? 'bg-purple-50 text-purple-800'
                    : i === activeIdx
                    ? 'bg-slate-100 text-ink'
                    : 'text-ink hover:bg-slate-50'
                }`}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
