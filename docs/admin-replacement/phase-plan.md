# docs/admin-replacement/phase-plan.md

Sequence for the admin rebuild. Each phase is a separate cloud session.

> **STATUS (2026-09-30): this is a reference, not a queue.**
> The B-series below describes backend work that was originally
> planned as standalone phases. The build approach is now
> screen-driven: each session picks one Figma screen and builds it
> end-to-end, adding the specific endpoints the screen needs. The
> phases below are no longer run as standalone sessions.
> See the "Approach" section at the bottom of this file.

## Phase definitions (original plan, kept for reference)

- B1 — User & registration schema. DONE (PR #5).
<<<<<<< HEAD
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
=======
- B2 — Permission model. D1 (widen SUPER_ADMIN_ONEFOP), D3 (decentralize
  to DR), D7 (national scope for SUPER_ADMIN_DSMO / DATA_MANAGER /
  ANALYST), D8 (page-level role guard component). Endpoint guards +
  shared role guard. No schema. DONE (PRs #6, #9, #12, #13).
- B3 — Company RBAC. D5. UserRole enum additions, Company.userId ->
  one-to-many, permission matrix. SKIPPED (D5 decided SKIP).
>>>>>>> origin/master
- B4 — Campaign schema. agent<->campaign link, campaign export.
  PARTIAL: the submission progress link is done
  (campaignId FK on OnefopSubmission, PRs #16 / #17 / #19). The
  agent<->campaign link and campaign export are still open.
- B5 — Quality schema. D6. Rules, thresholds, control runs.
  Folded into the `/admin/centre-qualite` build.
- B6 — Parametres settings columns + save endpoint.
  Folded into the `/admin/parametres` rebuild.
- B7 — Audit coverage. Dossier-approve audit row, export audit rows,
  export-job table. Still backlog — compliance-shaped, not
  screen-shaped.

Original rebuild plan (Phase C) was: one screen per session, starting
after B1+B2 — utilisateurs, annuaire, inscriptions, validation-compte,
etablissement-detail, then the rest as their phase lands.

<<<<<<< HEAD
Per D5, the etablissement-detail rebuild has no company-roles section
and no admin user-creation for a company.
=======
Rebuilt so far: pilotage, dossiers/[id], parametres (read-only shell),
journal-audit, diffusion (PR #4 open), utilisateurs, campagnes.

---

## Approach (2026-09-30) — screen-driven

Each session picks one remaining Figma screen and builds it
end-to-end:

  1. Read the Figma, the feature matrix, and the current page.
  2. Build the UI matching the frame.
  3. Wire every capability that already has an endpoint.
  4. For capabilities the screen needs without endpoints: add them
     in the same session (additive endpoint, DTO, service method).
  5. Schema changes are flagged in the PR, never applied by the
     agent. A human runs `prisma migrate deploy`.
  6. Everything else goes in `deferred.md`.

This replaces "backend phase, then rebuild." Backend work is done
exactly where a screen needs it, not speculatively.

### B-series status after this change
- B1 user schema — done
- B2 permission model — done
- B3 company RBAC — skipped (D5 decided SKIP)
- B4 campaign schema — partial (submissions link done; agent<->campaign
  and export still open)
- B5 quality schema — folded into the `/admin/centre-qualite` build
- B6 parametres columns — folded into the `/admin/parametres` rebuild
- B7 audit coverage — still backlog (compliance-shaped, not screen-shaped)

### Screens still to build
- /admin/parametres (editable) — smallest next, columns documented
  in deferred.md
- /admin/inscriptions — B1 schema covers most of it
- /admin/centre-qualite — needs rules/thresholds tables (this is B5,
  done inline)
- /admin/annuaire (Établissements) — partial today
- /admin/diffusion — PR #4 open, needs review
- /admin/dossiers (list) — out of scope earlier, still pending

### Blocked pending a model decision (do not build yet)
- /admin/questionnaires — canonical AST viewer doesn't exist
- /admin/etablissement-detail — no multi-user company model

### Open backlog (not phased)
- Drift reconciliation (multi-phase)
- B7 audit coverage
- PR #8 schema drop (parked draft)
- Various `deferred.md` items
>>>>>>> origin/master
