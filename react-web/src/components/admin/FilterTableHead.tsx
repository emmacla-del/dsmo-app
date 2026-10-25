"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TableHead } from "@/components/ui/table";

export function FilterTableHead({
  label,
  filterLabel,
  active,
  contentClassName,
  children,
}: {
  label: string;
  filterLabel: string;
  active: boolean;
  contentClassName?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <TableHead scope="col" className="whitespace-nowrap p-0">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            aria-label={filterLabel}
            className={`h-10 w-full justify-start gap-2 rounded-none px-2 ${active ? "text-primary" : "text-foreground"}`}
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
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  onSelect: () => void;
}) {
  return (
    <div className="grid max-h-80 gap-1 overflow-y-auto" role="group" aria-label={label}>
      {options.map((option) => (
        <Button
          key={option.value || "default"}
          type="button"
          variant={value === option.value ? "secondary" : "ghost"}
          size="sm"
          className="w-full justify-start"
          aria-pressed={value === option.value}
          onClick={() => {
            onChange(option.value);
            onSelect();
          }}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
