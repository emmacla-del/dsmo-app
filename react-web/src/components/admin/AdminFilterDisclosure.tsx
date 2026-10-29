"use client";

import { useState, type ReactNode } from "react";
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
  const [disclosureState, setDisclosureState] = useState({ active, open: active });
  if (disclosureState.active !== active) {
    setDisclosureState({ active, open: active ? true : disclosureState.open });
  }
  const open = disclosureState.open;

  return (
    <details
      className={cn("cam-admin-filter-disclosure", className)}
      open={open}
      onToggle={(event) => setDisclosureState({ active, open: event.currentTarget.open })}
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
