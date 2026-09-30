# docs/admin-replacement/role-decisions.md

Decisions taken 2026-09-30. Every rebuild run and every backend
endpoint PR reads this before choosing what to wire or guard.

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
BUILD, with two clarifications:

1. SCOPE. Figma's four roles (Administrateur, Responsable,
   Comptable, Lecteur) are COMPANY-SCOPED permission roles, not
   platform roles. Distinct from:
   - the existing "respondent role" dropdown in the company
     creation wizard (descriptive, not permission-granting), AND
   - the platform UserRole enum.

2. STORAGE. Do NOT add these values to UserRole. That enum holds
   platform roles; adding company roles creates ambiguity in every
   @Roles() check. Use a separate CompanyUserRole enum and a
   CompanyMember relation:
     CompanyMember { userId, companyId, role: CompanyUserRole }
   Company.userId @unique -> one-to-many becomes
   Company.members -> CompanyMember[].
   Migration: each existing Company.userId becomes a CompanyMember
   with role = ADMINISTRATEUR.

3. PERMISSION MATRIX. Define before implementing:
   - Administrateur: full
   - Lecteur: read-only
   - Responsable: TBD
   - Comptable: TBD
   TBD items are an open item - do not implement until decided.

Largest schema change on the list. Sequence after B1/B2. Does not
block any rebuild except /admin/etablissement-detail.

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
- D5 permission matrix: Responsable and Comptable roles are TBD.
  Resolve before B3 begins.
- D5 (company RBAC) restructures Company.userId to one-to-many.
  Sequence deliberately, not in the same PR as B1.
