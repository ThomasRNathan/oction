"use client";

import { useEffect, useRef, useState } from "react";

interface Option<T extends string | number> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  /** Field label shown above the trigger button. */
  label: string;
  /** Choices rendered inside the popover. */
  options: Option<T>[];
  /** Currently-selected values (controlled). */
  selected: T[];
  /** Fires whenever the selection changes; pass [] to clear. */
  onChange: (next: T[]) => void;
  /** Trigger text when nothing is selected. */
  placeholder?: string;
  /** Tailwind width class (use min-w-* to keep the trigger compact). */
  width?: string;
}

/**
 * Generic multi-select dropdown used by the Historique filter bar.
 *
 * UX:
 *   - Trigger shows "Toutes" when empty, the single label when 1 is picked,
 *     or "{N} sélectionnés" + a small badge when 2+ are picked.
 *   - Popover lists every option with a checkbox and a "Effacer la sélection"
 *     row when at least one is active.
 *   - Closes on outside click or Esc.
 */
export function MultiSelect<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  placeholder = "Toutes",
  width = "min-w-[140px]",
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (v: T) => {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v));
    else onChange([...selected, v]);
  };

  const triggerText = (() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      const opt = options.find((o) => o.value === selected[0]);
      return opt?.label ?? String(selected[0]);
    }
    return `${selected.length} sélectionnés`;
  })();

  const active = selected.length > 0;

  return (
    <div className={`relative flex flex-col gap-1 ${width}`} ref={ref}>
      <span className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </span>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          "flex items-center justify-between gap-2 px-3 py-2 bg-slate-800/70 border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-colors " +
          (active ? "border-orange-500/60" : "border-slate-700")
        }
      >
        <span className={active ? "truncate" : "text-slate-400 truncate"}>
          {triggerText}
        </span>
        <span className="flex items-center gap-1.5 flex-shrink-0">
          {selected.length > 1 && (
            <span className="text-[10px] leading-none px-1.5 py-1 rounded bg-orange-500/20 text-orange-400 font-semibold">
              {selected.length}
            </span>
          )}
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            className={
              "text-slate-400 transition-transform " +
              (open ? "rotate-180" : "")
            }
            aria-hidden
          >
            <path
              d="M2 3.5L5 6.5L8 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable
          className="absolute top-full mt-1 left-0 right-0 z-50 max-h-72 overflow-auto rounded-lg border border-slate-700 bg-slate-900/95 backdrop-blur-md shadow-xl py-1"
        >
          {options.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-500">
              Aucune option
            </div>
          )}
          {options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => toggle(opt.value)}
                className={
                  "w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left transition-colors " +
                  (checked
                    ? "bg-orange-500/10 text-white"
                    : "text-slate-300 hover:bg-slate-800")
                }
              >
                <span
                  className={
                    "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 " +
                    (checked
                      ? "bg-orange-500 border-orange-500"
                      : "border-slate-600")
                  }
                  aria-hidden
                >
                  {checked && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 5L4 7L8 3"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}

          {selected.length > 0 && (
            <>
              <div className="my-1 border-t border-slate-700" />
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full px-3 py-1.5 text-left text-xs text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Effacer la sélection
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
