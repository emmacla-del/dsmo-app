// src/lib/declarations.ts
//
// GET /dsmo/declarations and the approve/reject action, read directly from
// src/dsmo/dsmo.controller.ts + dsmo.service.ts.
//
// REAL BUG FOUND AND NOT PORTED: declarations_list_screen.dart's
// _updateStatus() calls `PATCH /dsmo/declarations/:id/status` with
// `{status: 'FINAL_APPROVED' | 'REJECTED'}` — that route does not exist on
// the backend at all (confirmed by reading dsmo.controller.ts in full; the
// only PATCH route is `declarations/:id/validate`). Every approve/reject
// tap on that Flutter screen 404s today. The real endpoint is
// `PATCH /dsmo/declarations/:id/validate` with `{accept: boolean,
// rejectionReason?: string}` — dsmo.service.ts's approveDeclaration()
// computes the next status from the CALLER'S OWN ROLE server-side (DIVISIONAL_ADMIN
// -> DIVISION_APPROVED, REGIONAL_ADMIN -> REGION_APPROVED, ADMIN_ONEFOP/
// SUPER_ADMIN -> FINAL_APPROVED), so the client never needs to name a
// target status at all. This is wired to the real, working endpoint rather
// than reproducing the broken one — porting a confirmed-broken network call
// on purpose would ship a known-dead button, which serves no one. Flagged
// here and in the session report rather than silently patched.
import { apiFetch } from "./api-client";

export interface Declaration {
  id: string;
  status: string;
  region?: string | null;
  division?: string | null;
  year?: number | null;
  companyName?: string | null;
  name?: string | null;
  company?: { name?: string | null } | null;
  [key: string]: unknown;
}

export interface DeclarationFilters {
  year?: number;
  status?: string;
  region?: string;
  department?: string;
}

export function listDeclarations(filters: DeclarationFilters = {}) {
  const query = new URLSearchParams();
  if (filters.year) query.set("year", String(filters.year));
  if (filters.status) query.set("status", filters.status);
  if (filters.region) query.set("region", filters.region);
  if (filters.department) query.set("department", filters.department);
  const qs = query.toString();
  return apiFetch<Declaration[]>(`/dsmo/declarations${qs ? `?${qs}` : ""}`);
}

function validateDeclaration(id: string, accept: boolean, rejectionReason?: string) {
  return apiFetch<Declaration>(`/dsmo/declarations/${id}/validate`, {
    method: "PATCH",
    body: JSON.stringify({ accept, rejectionReason }),
  });
}

export function approveDeclaration(id: string) {
  return validateDeclaration(id, true);
}

// No rejection-reason prompt — matches declarations_list_screen.dart's own
// UI exactly (it never asks for one either); the backend defaults to
// 'Non précisé' when omitted.
export function rejectDeclaration(id: string) {
  return validateDeclaration(id, false);
}

// Ported from declarations_list_screen.dart's _statusMeta — 5 of the 6 real
// DeclarationStatus enum values (DRAFT excluded, matching Flutter: this
// list only ever shows submitted-or-later declarations).
export const DECLARATION_STATUS_META: Record<string, { label: string; color: string }> = {
  SUBMITTED: { label: "Soumis", color: "var(--cam-info)" },
  DIVISION_APPROVED: { label: "Div. Approuvé", color: "var(--cam-info)" },
  REGION_APPROVED: { label: "Rég. Approuvé", color: "var(--cam-warning)" },
  FINAL_APPROVED: { label: "Approuvé", color: "var(--cam-success)" },
  REJECTED: { label: "Rejeté", color: "var(--cam-error)" },
};

export function declarationDisplayName(d: Declaration): string {
  return d.companyName || d.name || d.company?.name || "Entreprise";
}

// declarations_list_screen.dart's own comment: "Declaration's own field is
// 'division', not 'department' — the latter never matched, silently
// dropping it from the card." Matched here too, same fallback order.
export function declarationDepartment(d: Declaration): string | null {
  return d.division || (d.department as string | undefined) || null;
}

export function isPendingDeclaration(status: string): boolean {
  return status === "SUBMITTED" || status === "REGION_APPROVED";
}
