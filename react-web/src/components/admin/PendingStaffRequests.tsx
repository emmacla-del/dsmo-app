"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { DataStateRow } from "@/components/admin/DataState";
import { NOT_PROVIDED, resolveDataState, stamp } from "@/lib/admin-data-state";
import { registrationMethodLabel } from "@/lib/inscriptions";
import { formatApiError } from "@/lib/pilotage-targets";
import { asUiLocale } from "@/lib/register-i18n";
import { territoryPhrase } from "@/lib/staff-invitations";
import { approveUser, directoryRoleLabel, invitationScopeMismatch, listUsers, rejectUser, type DirectoryUser } from "@/lib/user-directory";

// Staff accounts waiting for approval -- in practice the ones requested
// through a group invitation link (registrationMethod INVITATION_LINK).
// Approve and reject are PATCH /auth/approve-user/:id and reject-user/:id;
// the server checks the approver may act on that role and territory.
//
// What the approver weighs: who the person says they are (name, email) and
// the post they claim in the organigramme. The email is not verified, so
// the post and the territory are what to check against what you know.
//
// The territory is the officer's OWN answer -- since 2026-10-25 a group
// link's territory is its intended scope, not the account's (CLAUDE.md
// §21), which leaves this screen as the only control on that choice. So the
// cell names the link's scope under the chosen territory, and says when the
// two differ. It is a signal, not a block: a mismatch is often legitimate
// (an officer given a neighbouring delegation's link), and the approver is
// the one who can tell. Reject carries a reason for when it is not.

const PAGE_SIZE = 50;

export function PendingStaffRequests({ roles }: { roles: readonly string[] }) {
  const t = useTranslations("adminPendingStaff");
  const locale = asUiLocale(useLocale());
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<DirectoryUser | null>(null);
  const [reason, setReason] = useState("");

  const query = useQuery({
    queryKey: ["auth", "users", "pending-staff", roles.join(",")],
    queryFn: () => listUsers({ roles, status: "PENDING_APPROVAL", page: 1, pageSize: PAGE_SIZE }),
  });
  const state = resolveDataState({
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    rowCount: query.data?.users.length ?? null,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["auth", "users"] });

  const approveMutation = useMutation({ mutationFn: (id: string) => approveUser(id), onSuccess: refresh });
  const rejectMutation = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) => rejectUser(id, why),
    onSuccess: () => {
      refresh();
      setRejecting(null);
      setReason("");
    },
  });

  const name = (u: DirectoryUser) => [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.email;

  return (
    <section className="cam-admin-section" aria-labelledby="pending-staff-title">
      <div className="cam-admin-section-head">
        <h2 id="pending-staff-title" className="cam-admin-h2">{t("title")}</h2>
        <span className="cam-admin-meta">{query.data ? t("count", { count: query.data.total }) : NOT_PROVIDED}</span>
      </div>
      <p className="cam-admin-meta">{t("intro")}</p>

      {approveMutation.isError && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>{formatApiError(approveMutation.error, locale)}</span>
        </div>
      )}

      <div className="cam-table-wrapper">
        <table className="cam-table">
          <thead>
            <tr>
              <th scope="col">{t("personColumn")}</th>
              <th scope="col">{t("postColumn")}</th>
              <th scope="col">{t("territoryColumn")}</th>
              <th scope="col">{t("requestedColumn")}</th>
              <th scope="col" className="text-right">{t("actionsColumn")}</th>
            </tr>
          </thead>
          <tbody>
            <DataStateRow
              colSpan={5}
              state={state}
              resource={t("resource")}
              error={query.error}
              onRetry={() => query.refetch()}
              title={state === "empty" ? t("emptyTitle") : undefined}
              hint={state === "empty" ? t("emptyHint") : undefined}
            />
            {(query.data?.users ?? []).map((u) => (
              <tr key={u.id}>
                <td>
                  <span className="cam-admin-strong" style={{ display: "block" }}>{name(u)}</span>
                  <span className="cam-admin-meta">{u.email}</span>
                  {u.matricule && <span className="cam-admin-meta" style={{ display: "block" }}>{t("matricule", { value: u.matricule })}</span>}
                </td>
                <td>
                  {u.poste ?? NOT_PROVIDED}
                  <span className="cam-admin-meta" style={{ display: "block" }}>{directoryRoleLabel(u.role, locale)}</span>
                </td>
                <td>
                  <TerritoryCell user={u} />
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <span className="cam-admin-meta" style={{ display: "block" }}>{stamp(u.createdAt, true, locale)}</span>
                  {registrationMethodLabel(u.registrationMethod, locale) && (
                    <span className="cam-admin-meta">{registrationMethodLabel(u.registrationMethod, locale)}</span>
                  )}
                </td>
                <td className="text-right">
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--cam-space-3)", whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      className="cam-text-button"
                      disabled={approveMutation.isPending}
                      onClick={() => approveMutation.mutate(u.id)}
                    >
                      {t("approve")}
                    </button>
                    <button type="button" className="cam-text-button" onClick={() => setRejecting(u)}>{t("reject")}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rejecting && (
        <AdminDialog
          open
          onClose={() => { setRejecting(null); setReason(""); rejectMutation.reset(); }}
          title={t("rejectTitle", { name: name(rejecting) })}
          eyebrow={t("title")}
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--cam-space-3)", width: "100%" }}>
              <button type="button" className="cam-button cam-button-secondary" onClick={() => setRejecting(null)}>{t("cancel")}</button>
              <button
                type="button"
                className="cam-button cam-button-danger"
                disabled={!reason.trim() || rejectMutation.isPending}
                onClick={() => rejectMutation.mutate({ id: rejecting.id, why: reason.trim() })}
              >
                {t("rejectConfirm")}
              </button>
            </div>
          }
        >
          {rejectMutation.isError && (
            <div role="alert" className="cam-admin-notice cam-admin-notice--error">
              <span>{formatApiError(rejectMutation.error, locale)}</span>
            </div>
          )}
          <div className="cam-field">
            <label className="cam-admin-label" htmlFor="pending-reject-reason">{t("reasonLabel")}</label>
            <textarea
              id="pending-reject-reason"
              className="cam-admin-textarea"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </AdminDialog>
      )}
    </section>
  );
}

/**
 * The territory the officer chose, then the scope of the link they used.
 *
 * The link line is shown whenever the account came through a link, not only
 * on a mismatch: an approver who sees it every time learns what to expect,
 * and a warning that only ever appears on the exception is one nobody has
 * calibrated. A central link fixes no territory, so it states that rather
 * than implying a comparison it cannot make.
 */
function TerritoryCell({ user }: { user: DirectoryUser }) {
  const t = useTranslations("adminPendingStaff");
  const chosen = territoryPhrase(user.region, user.department) || t("national");
  const scope = user.invitationScope;
  const mismatch = invitationScopeMismatch(user);
  return (
    <>
      <span style={{ display: "block" }}>{chosen}</span>
      {scope && (
        <span className="cam-admin-meta" style={{ display: "block" }}>
          {t("linkScope", { scope: territoryPhrase(scope.region, scope.department) || t("linkScopeNone") })}
        </span>
      )}
      {mismatch && (
        <span className="cam-badge cam-badge-warning" style={{ marginTop: "var(--cam-space-1)" }}>
          {t("territoryDiffers")}
        </span>
      )}
    </>
  );
}
