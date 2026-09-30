# docs/admin-replacement/phase-plan.md

Sequence for the admin rebuild. Each phase is a separate cloud session.

- B1 — User & registration schema. DONE (PR #5).
- B2 — Permission model. D1 (widen SUPER_ADMIN_ONEFOP), D3 (decentralize
  to DR), D7 (national scope for SUPER_ADMIN_DSMO / DATA_MANAGER /
  ANALYST), D8 (page-level role guard component). Endpoint guards +
  shared role guard. No schema.
- B3 — Company RBAC. D5. UserRole enum additions, Company.userId ->
  one-to-many, permission matrix. Largest schema change. After B1/B2.
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
