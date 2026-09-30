# Resolutions

Audit trail of mechanical blockages resolved inside a screen-driven build
session (phase-plan.md, "Approach"). One row per resolution. Structural or
policy blockages are not resolved here; they go to `docs/deferred.md`.

| Date | Screen | Blockage | Resolution | Files touched | Rationale |
|---|---|---|---|---|---|
| 2026-09-30 | /admin/questionnaires | — | SKIPPED, no PR | — | Canonical AST viewer does not exist; needs a model decision first. |
| 2026-09-30 | /admin/etablissement-detail | — | SKIPPED, no PR | — | No multi-user company model (D5); needs a model decision first. |
| 2026-09-30 | /admin/diffusion | — | SKIPPED, no PR | — | PR #4 is already open and needs review, not a rebuild. |
| 2026-09-30 | /admin/parametres | No column for Nom de l'observatoire, Pays, Langue par défaut, Fuseau horaire | Four nullable TEXT columns on `system_settings` (`observatoryName`, `countryCode`, `defaultLanguage`, `timezone`); migration `20260930170000_add_system_settings_identity_fields`, flagged, not applied | prisma/schema.prisma, prisma/migrations/20260930170000_add_system_settings_identity_fields/ | Each maps to exactly one Figma field and no other screen competes for it. |
| 2026-09-30 | /admin/parametres | PATCH /system-settings did not accept the identity fields | Added optional fields to `SystemSettingsUpdate` plus `validateIdentityFields` (trim, blank → null, country CM, language fr/en, valid IANA zone, name ≤ 120); the four original fields pass through unchanged | src/system-settings/system-settings.service.ts | Additive body fields on the endpoint the task names; @Roles unchanged (SUPER_ADMIN). |
| 2026-09-30 | /admin/parametres | No test for the settings service | Added `system-settings.service.spec.ts` (validation + upsert/cache) | src/system-settings/system-settings.service.spec.ts | The new validation must be proven without a database. |
| 2026-09-30 | /admin/parametres | No api-client wrapper for /system-settings | Added `src/lib/system-settings.ts` (get + identity-only PATCH), following `lib/audit-log.ts` | react-web/src/lib/system-settings.ts | The page never sends the security fields (password length, 2FA, maintenance). |
| 2026-09-30 | /admin/parametres | "Voir le journal complet →" not wired | Linked to `/admin/journal-audit` for roles that can read the audit panel | react-web/src/app/admin/parametres/page.tsx | The page now exists (journal-audit rebuild). |
