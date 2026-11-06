"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { ChevronDown, Lock, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface AdminFilterPillOption {
  value: string;
  label: string;
  /** Files this option would list with the other filters kept (from the facets endpoint). */
  count?: number;
}

interface AdminFilterPillProps {
  /** Filter name, e.g. « Contrôles ». */
  label: string;
  /** Current value; "" means the filter is off. */
  value: string;
  options: AdminFilterPillOption[];
  onChange: (value: string) => void;
  /** Accessible label of the × button, e.g. « Retirer le filtre Contrôles ». */
  clearLabel: string;
  /** Label of the "no filter" option at the top of the list, e.g. « Tous ». */
  allLabel: string;
  className?: string;
}

/**
 * One single-choice filter shown as a pill above a result list.
 *
 * Off: outlined, « Label ▾ ». On: filled, « Label : Valeur » with its own ×.
 * Choosing an option applies it at once (URL state belongs to the caller) and
 * closes the popover; Escape closes it and returns focus to the pill.
 */
export function AdminFilterPill({
  label,
  value,
  options,
  onChange,
  clearLabel,
  allLabel,
  className,
}: AdminFilterPillProps) {
  const [open, setOpen] = useState(false);
  const formatCount = new Intl.NumberFormat(useLocale()).format;
  const selected = options.find((option) => option.value === value);
  // On whenever the URL says so: the options may still be loading, and the list
  // is filtered either way. Until they arrive the pill names the raw value.
  const active = Boolean(value);

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className={cn("cam-filter-pill-wrap", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn("cam-filter-pill", active && "is-active")}
            aria-haspopup="listbox"
          >
            <span>{label}</span>
            {active ? <strong>: {selected?.label ?? value}</strong> : <ChevronDown aria-hidden="true" className="size-4" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="cam-filter-pill-popover">
          <div role="listbox" aria-label={label} className="cam-filter-pill-options">
            {[{ value: "", label: allLabel } as AdminFilterPillOption, ...options].map((option) => {
              const isSelected = option.value === value || (!option.value && !active);
              const empty = option.count === 0 && !isSelected;
              return (
                <button
                  key={option.value || "__all"}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn("cam-filter-pill-option", isSelected && "is-selected", empty && "is-empty")}
                  onClick={() => choose(option.value)}
                >
                  <span className="cam-filter-pill-radio" aria-hidden="true" />
                  <span className="cam-filter-pill-option-label">{option.label}</span>
                  {option.count !== undefined && <span className="cam-filter-pill-count">{formatCount(option.count)}</span>}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      {active && (
        <button type="button" className="cam-filter-pill-clear" aria-label={clearLabel} onClick={() => onChange("")}>
          <X aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** A filter fixed by the user's scope: visible so the list is explained, not editable. */
export function AdminLockedFilterPill({ label, title }: { label: string; title?: string }) {
  return (
    <span className="cam-filter-pill is-locked" title={title}>
      <Lock aria-hidden="true" className="size-3.5" />
      {label}
    </span>
  );
}
