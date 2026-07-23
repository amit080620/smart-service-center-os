'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

// A type-to-search dropdown, replacing a plain <select> for lists that
// can grow large (customers, vehicles) — scrolling through hundreds of
// plain <option> entries is bad UX once a business has real volume.
// Generic over the item type so it works for both customers and
// vehicles with different display/search logic passed in as props.
export default function SearchableSelect<T extends { id: string }>({
  items,
  value,
  onChange,
  getLabel,
  getSubLabel,
  getSearchText,
  placeholder,
  disabled
}: {
  items: T[];
  value: string;
  onChange: (id: string) => void;
  getLabel: (item: T) => string;
  getSubLabel?: (item: T) => string;
  getSearchText: (item: T) => string;
  placeholder: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = items.find((i) => i.id === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = items.filter((item) => getSearchText(item).toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative" ref={containerRef}>
      {selected && !open ? (
        <button
          type="button"
          onClick={() => !disabled && setOpen(true)}
          disabled={disabled}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50 flex items-center justify-between text-left cursor-pointer"
        >
          <span className="truncate">
            {getLabel(selected)}
            {getSubLabel && <span className="text-slate-500 ml-1.5">{getSubLabel(selected)}</span>}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setQuery('');
              }}
              className="text-slate-600 hover:text-slate-300 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </span>
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </div>
        </button>
      ) : (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            autoFocus={open}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full bg-slate-950 border border-amber-500 rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none disabled:opacity-50"
          />
        </div>
      )}

      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl shadow-xl">
          {filtered.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 text-center">No matches.</div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item.id);
                  setQuery('');
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-800 cursor-pointer flex items-center justify-between gap-2"
              >
                <span className="truncate text-slate-200">{getLabel(item)}</span>
                {getSubLabel && <span className="text-xs text-slate-500 shrink-0">{getSubLabel(item)}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
