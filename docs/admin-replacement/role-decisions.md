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
registrations in their territory. Applies consistently to
/admin/inscriptions, /admin/validation-compte, and the
approve/reject actions on /admin/utilisateurs. Uses existing
territory enforcement.

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

## D7 - National scope for SUPER_ADMIN_DSMO / DATA_MANAGER / ANALYST
GRANT NATIONAL SCOPE. These three roles see all rows on export
endpoints regardless of territory. Rationale: strategic and
analytical roles with a national mandate; empty exports were a
scoping bug, not a correct restriction. Applies to /admin/diffusion
exports and any other territory-scoped endpoint these roles can
reach.
TERRITORY ENFORCEMENT IS UNCHANGED FOR EVERY OTHER ROLE.
Note for B2: the territory model is now role-dependent. Encode
"which roles bypass territory" as an explicit list, not an implicit
assumption. Do not let it become a per-controller ad-hoc check.

IMPLEMENTED (export scope only). src/auth/territory.ts keeps two
explicit lists:
- NATIONAL_ROLES (SUPER_ADMIN, SUPER_ADMIN_ONEFOP, CENTRAL) drives
  territoryWhere and assertTerritorialAuthority, unchanged.
- EXPORT_NATIONAL_ROLES (NATIONAL_ROLES + SUPER_ADMIN_DSMO,
  DATA_MANAGER, ANALYST) drives territoryWhereForExport, used only
  by the ONEFOP export where-builders in data-management
  (buildApprovedOnefopWhere, buildSpssWhere).
The three roles were deliberately NOT added to NATIONAL_ROLES: that
list also authorizes writes (visa, reject, bulk, anomaly resolution),
so any later @Roles change on a write route would have silently
granted them national write scope. Any further endpoint that should
get D7 scope must opt in to territoryWhereForExport explicitly.

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
