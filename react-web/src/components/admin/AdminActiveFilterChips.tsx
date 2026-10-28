"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface AdminActiveFilter {
  key: string;
  label: string;
  onClear: () => void;
}

export function AdminActiveFilterChips({
  filters,
  label,
  clearAllLabel,
  onClearAll,
  removeFilterLabel,
}: {
  filters: AdminActiveFilter[];
  label: string;
  clearAllLabel?: string;
  onClearAll?: () => void;
  removeFilterLabel?: (label: string) => string;
}) {
  if (filters.length === 0) return null;
  return (
    <div className="cam-admin-active-filters" role="group" aria-label={label}>
      <span className="text-sm font-medium">{label}</span>
      {filters.map((filter) => (
        <Button key={filter.key} type="button" variant="outline" size="sm" onClick={filter.onClear} aria-label={removeFilterLabel?.(filter.label) ?? `${label}: ${filter.label}`}>
          {filter.label}<X className="ms-2 size-3" aria-hidden="true" />
        </Button>
      ))}
      {clearAllLabel && onClearAll && <Button type="button" variant="ghost" size="sm" onClick={onClearAll}>{clearAllLabel}</Button>}
    </div>
  );
}
