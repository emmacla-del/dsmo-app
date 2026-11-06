"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { AdminLockedFilterPill } from "@/components/admin/AdminFilterPill";

/**
 * Pieces of the list filter bar (spec §4F) shared by the lists that don't
 * have the dossier queue's side panel: the « Filtres » popover and the
 * locked scope pill.
 *
 *   search · scope · ≤ 4 pills · Vues enregistrées · Filtres · Tout effacer
 */

/** Which territory filter a role can really use as a pill. */
export function territoryPillFor(role: string | null | undefined): "region" | "department" | null {
  if (role === "DIVISIONAL_ADMIN") return null;
  if (role === "REGIONAL_ADMIN") return "department";
  return "region";
}

/** A territorial officer's fixed scope, shown in the bar so the list is explained. */
export function AdminScopePill() {
  const t = useTranslations("adminDossiersPage");
  const user = useAuthStore((s) => s.user);
  if (user?.role === "REGIONAL_ADMIN") {
    const label = user.region ? t("scopeRegional", { region: user.region }) : t("scopeRegionalUnassigned");
    return <AdminLockedFilterPill label={label} title={label} />;
  }
  if (user?.role === "DIVISIONAL_ADMIN") {
    const label = user.department ? t("scopeDepartmental", { department: user.department }) : t("scopeDepartmentalUnassigned");
    return <AdminLockedFilterPill label={label} title={label} />;
  }
  return null;
}

/**
 * « Filtres »: every filter that has no pill, in a popover. `count` is the
 * number of those that are active (pills are not counted: they show
 * themselves). Fields apply at once, like the pills.
 */
export function AdminFilterMore({ label, count, children, className }: {
  label: string;
  count: number;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("cam-filter-pill cam-filter-bar-more", count > 0 && "is-active", className)}
          aria-haspopup="dialog"
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          {label}
          {count > 0 && <span className="cam-dossier-filter-count">{count}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="cam-filter-more-popover" role="dialog" aria-label={label}>
        <div className="cam-filter-more-grid">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

/** One labelled field inside « Filtres ». */
export function AdminFilterField({ id, label, children, wide }: { id: string; label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("cam-filter-more-field", wide && "is-wide")}>
      <label className="cam-admin-label" htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}
