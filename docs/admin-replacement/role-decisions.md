# docs/admin-replacement/role-decisions.md

Decisions taken 2026-09-30. Every rebuild run and every backend
endpoint PR reads this before choosing what to wire or guard.

## Ground rule - Figma frames are visual targets, not feature lists
A Figma frame shows what a screen should look like. It is NOT a
request to build a capability. If a frame shows something the
product does not do, do NOT build it - note it here and rebuild the
screen without it. Two frames have already implied capabilities the
product does not have (D4, D5). Check before building.

Corollary: this is the ONEFOP ADMIN panel. It is for ONEFOP
administration - reviewing establishments, registrations, agents,
campaigns, quality. Anything scoped to a company's internal
operations (its own users, its own roles) is out of scope unless
explicitly requested.

## D1 - SUPER_ADMIN_ONEFOP on /admin/utilisateurs
WIDEN. SUPER_ADMIN_ONEFOP may reassign agents and create minefop
users, on par with SUPER_ADMIN. Matches its existing write powers
elsewhere (approve dossiers).

## D2 - CAMPAIGN_MANAGER on /admin/campagnes
REMOVE FROM PAGE. The campagnes screen is SUPER_ADMIN* only.
Campaign management is central. CAMPAIGN_MANAGER role is not
granted campaign endpoints.

## D3 - Registration approval by DR roles
DECENTRALIZE. Regional and Divisional roles may approve/reject
COMPANY registrations in their territory (/admin/inscriptions,
/admin/validation-compte). Uses existing territory enforcement.

AMENDED 2026-10-07 - staff accounts excluded. Regional and Divisional
roles neither initiate staff account creation nor approve it, not even
inside their own territory. Staff accounts are created by invitation
(SUPER_ADMIN / ADMIN_ONEFOP) and approved by the national administration
only: SUPER_ADMIN any account, ADMIN_ONEFOP the staff roles it manages.
Enforced by assertCanApproveRegistration (src/auth/staff-scope.ts).

## D4 - Admin-created establishments
SKIP. Companies self-register. No admin "create establishment"
endpoint or permission. Annuaire shows what exists.

## D5 - Company-side RBAC
SKIP. The four roles shown in the Figma (Administrateur,
Responsable, Comptable, Lecteur) are a company's INTERNAL roles.
This admin panel is for ONEFOP administration, not for managing a
company's own staff. The product has no company-scoped permission
model and none is needed here.

Do NOT add UserRole values, CompanyUserRole, or a CompanyMember
relation. Do NOT build a permission matrix. Do NOT add an
"Ajouter un utilisateur" or "Company roles" section.

Consequence: /admin/etablissement-detail rebuilds WITHOUT the
company-roles section and WITHOUT admin user-creation for a
company. The screen shows what exists for ONEFOP oversight:
company info, its user account(s), and the actions ONEFOP can
already take (reset password, suspend, delete).

## D6 - Quality-rule toggling
SUPER_ADMIN* ONLY. Validation rules are system config, not
per-tenant. No new quality role.

## D7 - National export scope for SUPER_ADMIN_DSMO / DATA_MANAGER / ANALYST
GRANT NATIONAL SCOPE ON EXPORTS ONLY. These three roles see all
rows on the ONEFOP export endpoints regardless of territory.
Rationale: strategic and analytical roles with a national
mandate; empty exports were a scoping bug, not a correct
restriction.

Mechanism: a separate EXPORT_NATIONAL_ROLES list in
src/auth/territory.ts, used only by territoryWhereForExport. The
two export where-builders (buildApprovedOnefopWhere,
buildSpssWhere) call it. NATIONAL_ROLES and
assertTerritorialAuthority are unchanged, so the three roles
gain no national read or write scope anywhere else.

Narrower than the original D7 draft, which said "any other
territory-scoped endpoint these roles can reach." That would
have coupled export scope to write scope, since NATIONAL_ROLES
also drives assertTerritorialAuthority. Any future endpoint
wanting export scope MUST opt in by calling
territoryWhereForExport explicitly.

TERRITORY ENFORCEMENT IS UNCHANGED FOR EVERY OTHER ROLE.

## D8 - Page-level role guards
ADD A SHARED PATTERN. Every admin page declares its allowed roles.
Unauthorized roles get a clean "not for you" state, not an error
cascade from every endpoint. Implement in a shared component or
in the admin layout. Apply to each rebuild as it runs; retrofit
/admin/diffusion.

## Open items not covered by these decisions
- Audit gap: single-dossier approve writes no audit row.
- Audit gap: SPSS/Excel exports on /admin/diffusion write no
  audit row; AUDIT_LIST_EXPORT covers dossier-list only.
- Export history on /admin/diffusion needs an export-job table
  (size, status, re-download) - schema, separate from audit.
- /admin/parametres save endpoint + settings columns.
