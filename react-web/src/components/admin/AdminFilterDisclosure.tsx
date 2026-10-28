"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminFilterDisclosureProps {
  label: string;
  active?: boolean;
  children: ReactNode;
  className?: string;
}

/** Shared, keyboard accessible disclosure for advanced admin table filters. */
export function AdminFilterDisclosure({
  label,
  active = false,
  children,
  className,
}: AdminFilterDisclosureProps) {
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <details
      className={cn("cam-admin-filter-disclosure", className)}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>{label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn("cam-admin-filter-disclosure-chevron", open && "is-open")}
        />
      </summary>
      <div className="cam-admin-filter-disclosure-panel">{children}</div>
    </details>
  );
}
