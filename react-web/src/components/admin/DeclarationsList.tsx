"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DECLARATION_STATUS_META,
  type Declaration,
  approveDeclaration,
  declarationDepartment,
  declarationDisplayName,
  isPendingDeclaration,
  listDeclarations,
  rejectDeclaration,
} from "@/lib/declarations";

const chipStyle = (active: boolean, color: string): React.CSSProperties => ({
  padding: "var(--cam-space-1) var(--cam-space-3)",
  borderRadius: 20,
  fontSize: "var(--cam-font-size-sm)",
  fontWeight: 500,
  cursor: "pointer",
  border: `1px solid ${active ? color : "var(--cam-border)"}`,
  background: active ? color : "var(--cam-surface)",
  color: active ? "#fff" : "var(--cam-text-muted)",
  whiteSpace: "nowrap",
});

const statPillStyle = (color: string): React.CSSProperties => ({
  display: "flex",
  alignItems: "baseline",
  gap: "var(--cam-space-1)",
  padding: "var(--cam-space-1) var(--cam-space-3)",
  borderRadius: "var(--cam-radius-sm)",
  background: `${color}15`,
});

/**
 * Faithful port of declarations_list_screen.dart: stat strip, search,
 * status filter chips, declaration cards, and an approve/reject detail
 * view — wired to the real GET/PATCH endpoints (see declarations.ts for the
 * approve/reject endpoint-mismatch bug found and NOT reproduced here).
 */
export function DeclarationsList() {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Declaration | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["dsmo", "declarations"],
    queryFn: () => listDeclarations(),
  });

  const declarations = useMemo(() => query.data ?? [], [query.data]);
  const total = declarations.length;
  const pending = declarations.filter((d) => d.status === "SUBMITTED").length;
  const approved = declarations.filter((d) => d.status === "FINAL_APPROVED").length;
  const rejected = declarations.filter((d) => d.status === "REJECTED").length;

  const filtered = useMemo(() => {
    return declarations.filter((d) => {
      const name = declarationDisplayName(d).toLowerCase();
      const matchSearch = !search || name.includes(search.toLowerCase());
      const matchStatus = !statusFilter || d.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [declarations, search, statusFilter]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["dsmo", "declarations"] });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveDeclaration(id),
    onSuccess: () => {
      invalidate();
      setSelected(null);
    },
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectDeclaration(id),
    onSuccess: () => {
      invalidate();
      setSelected(null);
    },
  });

  useEffect(() => {
    if (selected) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [selected]);

  return (
    <div>
      <div style={{ display: "flex", gap: "var(--cam-space-2)", flexWrap: "wrap", marginBottom: "var(--cam-space-3)" }}>
        <span style={statPillStyle("var(--cam-green)")}>
          <strong>{total}</strong> {t("declarationsListAdmin.totalLabel")}
        </span>
        <span style={statPillStyle("var(--cam-info)")}>
          <strong>{pending}</strong> {t("declarationsListAdmin.pendingLabel")}
        </span>
        <span style={statPillStyle("var(--cam-success)")}>
          <strong>{approved}</strong> {t("declarationsListAdmin.approvedLabel")}
        </span>
        <span style={statPillStyle("var(--cam-error)")}>
          <strong>{rejected}</strong> {t("declarationsListAdmin.rejectedLabel")}
        </span>
        <button
          type="button"
          onClick={() => query.refetch()}
          style={{ marginLeft: "auto", border: "1px solid var(--cam-border-strong)", borderRadius: "var(--cam-radius-sm)", background: "none", padding: "var(--cam-space-1) var(--cam-space-3)", cursor: "pointer" }}
        >
          {t("declarationsListAdmin.refresh")}
        </button>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("declarationsListAdmin.searchPlaceholder")}
        style={{
          width: "100%",
          height: "var(--cam-form-field-height)",
          border: "var(--cam-border-width) solid var(--cam-border-strong)",
          borderRadius: "var(--cam-radius-sm)",
          padding: "0 var(--cam-space-3)",
          marginBottom: "var(--cam-space-3)",
        }}
      />

      <div style={{ display: "flex", gap: "var(--cam-space-2)", flexWrap: "wrap", marginBottom: "var(--cam-space-4)" }}>
        <span onClick={() => setStatusFilter(null)} style={chipStyle(statusFilter === null, "var(--cam-green)")}>
          {t("declarationsListAdmin.statusAll")}
        </span>
        {Object.entries(DECLARATION_STATUS_META).map(([status, meta]) => (
          <span key={status} onClick={() => setStatusFilter(status)} style={chipStyle(statusFilter === status, meta.color)}>
            {meta.label}
          </span>
        ))}
      </div>

      {query.isLoading && <p>{t("common.loading")}</p>}
      {query.isError && (
        <div role="alert" style={{ color: "var(--cam-error)" }}>
          {t("declarationsListAdmin.loadError", { error: (query.error as Error).message })}
        </div>
      )}
      {query.data && filtered.length === 0 && (
        <p style={{ color: "var(--cam-text-muted)" }}>
          {search || statusFilter ? t("declarationsListAdmin.noResults") : t("declarationsListAdmin.noPendingDeclarations")}
        </p>
      )}

      {filtered.map((d) => {
        const meta = DECLARATION_STATUS_META[d.status] ?? { label: d.status, color: "var(--cam-text-muted)" };
        const dept = declarationDepartment(d);
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => setSelected(d)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              border: "var(--cam-border-width) solid var(--cam-border)",
              borderRadius: "var(--cam-radius-md)",
              padding: "var(--cam-space-3)",
              marginBottom: "var(--cam-space-2)",
              background: "var(--cam-surface)",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--cam-space-3)" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{declarationDisplayName(d)}</div>
                <div style={{ fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)" }}>
                  {[d.region, dept, d.year].filter(Boolean).join(" · ")}
                </div>
              </div>
              <span
                style={{
                  padding: "2px 10px",
                  borderRadius: 20,
                  fontSize: "var(--cam-font-size-sm)",
                  fontWeight: 600,
                  background: `${meta.color}1A`,
                  color: meta.color,
                }}
              >
                {meta.label}
              </span>
            </div>
          </button>
        );
      })}

      <dialog
        ref={dialogRef}
        onClose={() => setSelected(null)}
        style={{ border: "var(--cam-border-width) solid var(--cam-border)", borderRadius: "var(--cam-radius-md)", padding: 0, maxWidth: 480, width: "90vw" }}
      >
        {selected && (
          <div style={{ padding: "var(--cam-space-5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--cam-space-3)" }}>
              <h2 style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: 700, margin: 0 }}>
                {declarationDisplayName(selected)}
              </h2>
              <button type="button" onClick={() => setSelected(null)} aria-label={t("declarationsListAdmin.closeAriaLabel")} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "var(--cam-font-size-lg)" }}>
                ×
              </button>
            </div>
            {Object.entries(selected)
              .filter(([k, v]) => v !== null && v !== undefined && v !== "" && !["id", "__v", "company"].includes(k))
              .map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: "var(--cam-space-3)", padding: "var(--cam-space-1) 0", fontSize: "var(--cam-font-size-sm)" }}>
                  <span style={{ width: 140, flexShrink: 0, color: "var(--cam-text-muted)" }}>{k}</span>
                  <span>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                </div>
              ))}

            {isPendingDeclaration(selected.status) && (
              <div style={{ display: "flex", gap: "var(--cam-space-3)", marginTop: "var(--cam-space-4)" }}>
                <button
                  type="button"
                  disabled={rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate(selected.id)}
                  style={{ flex: 1, height: "var(--cam-form-field-height)", border: "1px solid var(--cam-error)", color: "var(--cam-error)", background: "none", borderRadius: "var(--cam-radius-sm)", cursor: "pointer" }}
                >
                  {rejectMutation.isPending ? "…" : t("declarationsListAdmin.reject")}
                </button>
                <button
                  type="button"
                  disabled={approveMutation.isPending}
                  onClick={() => approveMutation.mutate(selected.id)}
                  style={{ flex: 1, height: "var(--cam-form-field-height)", border: "none", color: "#fff", background: "var(--cam-success)", borderRadius: "var(--cam-radius-sm)", cursor: "pointer" }}
                >
                  {approveMutation.isPending ? "…" : t("declarationsListAdmin.approve")}
                </button>
              </div>
            )}
            {(approveMutation.isError || rejectMutation.isError) && (
              <p role="alert" style={{ color: "var(--cam-error)", marginTop: "var(--cam-space-3)" }}>
                {t("declarationsListAdmin.actionError", { error: ((approveMutation.error ?? rejectMutation.error) as Error).message })}
              </p>
            )}
          </div>
        )}
      </dialog>
    </div>
  );
}
