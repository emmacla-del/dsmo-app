# docs/admin-replacement/phase-plan.md

Sequence for the admin rebuild. Each phase is a separate cloud session.

- B1 — User & registration schema. DONE (PR #5).
- B2 — Permission model. DONE. D1 (widen SUPER_ADMIN_ONEFOP), D3
  (decentralize to DR), D7 (national scope for SUPER_ADMIN_DSMO /
  DATA_MANAGER / ANALYST on the ONEFOP exports only), D8 (page-level
  role guard component). Endpoint guards + shared role guard. No schema.
  D1/D3 in PR #6, RolesGuard class-level @Roles fix in PR #9, D7
  export-only in PR #12, D8 in PR #13.
- B3 — Company RBAC. CANCELLED per D5 (commit b971189f, "docs: drop
  company-side RBAC (D5)"). D5 is a deliberate SKIP, not a deferral:
  no UserRole additions, no Company.userId change (it stays one user
  per company), no permission matrix. If company-side roles are ever
  wanted, that is a new decision, not a resumption of B3.
- B4 — Campaign schema. agent<->campaign link, campaign export.
  Unblocks /admin/campagnes.
- B5 — Quality schema. D6. Rules, thresholds, control runs.
  Unblocks /admin/centre-qualite.
- B6 — Parametres settings columns + save endpoint.
- B7 — Audit coverage. Dossier-approve audit row, export audit rows,
  export-job table. Unblocks diffusion export history.

Rebuild runs (Phase C) start after B1+B2 and proceed one screen per
session: utilisateurs, annuaire, inscriptions, validation-compte,
etablissement-detail, then the rest as their phase lands.

Per D5, the etablissement-detail rebuild has no company-roles section
and no admin user-creation for a company.
