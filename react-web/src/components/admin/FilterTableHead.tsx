"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TableHead } from "@/components/ui/table";

export function FilterTableHead({
  label,
  filterLabel,
  active,
  id,
  rowSpan,
  className,
  centered = false,
  contentClassName,
  children,
}: {
  label: string;
  filterLabel: string;
  active: boolean;
  id?: string;
  rowSpan?: number;
  className?: string;
  centered?: boolean;
  contentClassName?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <TableHead scope="col" id={id} rowSpan={rowSpan} className={`whitespace-nowrap p-0 ${className ?? ""}`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            aria-label={filterLabel}
            className={`h-10 w-full ${centered ? "justify-center px-1" : "justify-start px-2"} gap-2 rounded-none ${active ? "text-primary" : "text-foreground"}`}
          >
            <span>{label}</span>
            <ChevronDown aria-hidden="true" className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            {active && <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className={contentClassName ?? "w-64 p-2"}>
          {children(() => setOpen(false))}
        </PopoverContent>
      </Popover>
    </TableHead>
  );
}

export function FilterTableOptions({
  label,
  value,
  options,
  onChange,
  onSelect,
  searchable = false,
  searchPlaceholder,
  emptyLabel,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  onSelect: () => void;
  searchable?: boolean;
  searchPlaceholder: string;
  emptyLabel: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const showSearch = searchable || options.length > 12;

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter((opt) => opt.value === "" || opt.label.toLowerCase().includes(q));
  }, [options, searchQuery]);

  return (
    <div className="grid gap-1.5">
      {showSearch && (
        <div className="relative mb-1">
          <Search className="absolute left-2 top-2 size-3.5 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 pr-2 text-xs"
          />
        </div>
      )}
      <div className="grid max-h-56 gap-1 overflow-y-auto" role="group" aria-label={label}>
        {filteredOptions.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">{emptyLabel}</p>
        ) : (
          filteredOptions.map((option) => (
            <Button
              key={option.value || "default"}
              type="button"
              variant={value === option.value ? "secondary" : "ghost"}
              size="sm"
              className="h-8 w-full justify-start text-xs font-normal"
              aria-pressed={value === option.value}
              onClick={() => {
                onChange(option.value);
                onSelect();
              }}
            >
              {option.label}
            </Button>
          ))
        )}
      </div>
    </div>
  );
}
