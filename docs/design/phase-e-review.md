# Phase E Design Review: Multi-Site Establishments, Reconciliation, and Pilot Sequencing

## 1. Summary

Phase E transitions the ONEFOP system from a 1:1 company-to-site paradigm into a hierarchical multi-site model where a single parent organization files distinct quarterly returns for each physical establishment (site) down to the arrondissement level, backed by a reconciliation check against a non-aggregated control headcount declared by the principal site. It is the primary swing factor for the upcoming pilot: if launched without Phase E, multi-site organizations (commercial banks, microfinance networks, agro-industries, telecom operators, nationwide training centers) must either report all regional staff under their headquarters territory or register illicit duplicate company accounts, distorting regional directory stocks and quota response rates. Conversely, implementing Phase E before the pilot incurs significant schema and UI complexity across the entire reporting pipeline, risking schedule slippage.

---

## 2. What is Settled in the Existing Design Doc

The following architectural and domain rules are settled in [`docs/design/phase-e-establishments.md`](file:///C:/Users/win/dsmo_app_phase_e/docs/design/phase-e-establishments.md):

- **Per-Establishment Filing Mandate & Aggregation Principle (Lines 5–7)**: Returns are filed strictly per physical site with territorial attribution down to the arrondissement level; national and regional aggregations sum local establishment returns only, eliminating double counting by design.
- **Entity Scope & Multi-Site Eligibility (Lines 8–15)**: Multi-site registration is strictly permitted for six entity types: `ENTREPRISE`, `COOPERATIVE`, `CTD`, `ONG`, `PROJECT_PROGRAM`, and `VOCATIONAL_TRAINING`.
- **Exclusion of Public Administration (Lines 16–23)**: `ADMINISTRATION` is strictly single-site (civil service employment is central via MINFOPRA/SIGIPES), prohibited from secondary site accounts, and reported in Pilotage under a distinct `"Niveau central (Administrations)"` bucket to prevent regional quota distortion.
- **Parent Company Code Immutability (Lines 28–32)**: The existing 10-character `Company.establishmentId` (e.g. `EN26000100`) is preserved as the permanent `companyCode` and never modified when secondary sites are added.
- **Site Code Nomenclature & Suffixing (Lines 33–39)**: Site codes use the parent company code plus a sequential suffix: `-01` for the principal site (headquarters) and `-02`, `-03`, etc. for secondary sites, without consuming new national sequential serials.
- **Referential Integrity Constraints (Lines 101–105)**: Enforce `onDelete: Restrict` across `Company` $\rightarrow$ `Establishment`, `Establishment` $\rightarrow$ `OnefopSubmission`, and `Establishment` $\rightarrow$ `CampaignSubmission`.
- **Site Lifecycle & Immutability (Lines 106–107)**: Physical sites are never deleted; ceased operations transition to `status = CLOSED`, preserving historical returns immutably.
- **Single Principal Site Database Invariant (Lines 108–113)**: Exactly one principal site per company is guaranteed at the database level via a raw SQL partial unique index on `establishments ("companyId") WHERE "isPrincipal" = true`.
- **Submission Uniqueness Migration (Lines 114–121)**: The live quarterly return unique constraint moves from `(companyId, quarterCode)` to `(establishmentId, quarterCode)` for statuses `PENDING_REVIEW` and `APPROVED`.
- **Reconciliation Invariant & Metrics Scope (Lines 129–144, 158–160)**: Reconciliation compares local metric sums ($\sum \text{Metric}(E_i)$) against a single non-aggregated control question (`CTRL_TOTAL_PERMANENT` or `CTRL_VT_PERM_TRAINERS`) asked only on the principal return; the control value is never included in statistical rollups.
- **Anomaly Detection Rules & Default Tolerance (Lines 145–157)**: Reconciliation fires automatically when all active sites have filed; discrepancies exceeding a configurable 5% threshold ($\tau = 0.05$) trigger an anomaly with code `RECONCILIATION_HEADCOUNT_DISCREPANCY` (severity `ERROR`), while unsubmitted sites past deadline log `MISSING_ESTABLISHMENT_RETURNS` (severity `WARNING`).
- **Mid-Campaign Secondary Site Approval (Lines 170–177)**: Secondary sites registered during an active campaign do not automatically receive target cards; a `CampaignSubmission` record is generated with status `NOT_STARTED` only upon staff approval, provided the site matches the campaign's geographic and entity scope.
- **Client Backward Compatibility Baseline (Lines 181–188)**: Legacy clients submitting without `establishmentId` default to the `-01` principal site for single-site companies, but are rejected with `400 Bad Request` if the organization has multiple active sites.
- **Downstream Territorial Review Scoping (Lines 189–195, 230–233)**: Reviewer queue visibility (`territory.ts`), PDF generation, and SPSS/CSV exports scope to the physical establishment's territory rather than the parent company's headquarters.

---

## 3. What is Open

### 3.1 Declarant Access and User Model for Secondary Sites
- **The Question**: Who logs in to declare for secondary sites? Can a local branch manager log in with their own account scoped to a specific establishment, or does the single parent `User` account handle all sites?
- **Options**:
  - *Option A (Centralized Declarant)*: The company's sole `User` account logs in, accesses a site switcher / dropdown, and files returns for all establishments.
  - *Option B (Delegated Multi-User)*: Introduce user-to-establishment permissions or multi-user accounts under a single `Company`, enabling branch directors to submit locally.
- **Tradeoff**: Option A fits the existing schema (`Company.userId` is `@unique` in [`prisma/schema.prisma:245`](file:///C:/Users/win/dsmo_app_phase_e/prisma/schema.prisma#L245)) with zero changes to authentication, guards, or sessions, but forces corporate headquarters to centralize all regional data collection. Option B reflects real-world operational decentralization (e.g. Garoua plant manager completing their own questionnaire), but requires breaking the 1:1 `Company` $\leftrightarrow$ `User` constraint, building user-invitation workflows, and revising session authorization.
- **Recommendation**: *(Recommended)* Adopt **Option A** for initial Phase E. Treat establishment selection as a submission-level parameter managed by the parent account. Defer multi-user delegated access to a post-pilot iteration.

### 3.2 Reconciliation Storage and Anomaly Association
- **The Question**: Where is the control question stored, and what database entity owns the reconciliation anomaly when sums diverge?
- **Options**:
  - *Option A (Submission-Bound Anomaly)*: Store the control question in the principal site's `rawData` JSON; attach the `RECONCILIATION_HEADCOUNT_DISCREPANCY` record to the principal site's `OnefopSubmission.id`.
  - *Option B (Company-Level Reconciliation Entity)*: Create a dedicated `CompanyReconciliation` table keyed by `(companyId, quarterCode)` that stores control totals, calculated sums, delta percentages, and detached company-level anomalies.
- **Tradeoff**: Option A reuses the existing `OnefopAnomaly` table without schema modifications, but [`OnefopAnomaly.submissionId`](file:///C:/Users/win/dsmo_app_phase_e/prisma/schema.prisma#L2327) is non-nullable. If the principal site files *after* secondary sites, anomalies cannot be registered when secondary sites submit. Furthermore, `MISSING_ESTABLISHMENT_RETURNS` cannot logically attach to an unfiled submission. Option B cleanly models the company-wide lifecycle of reconciliation, but introduces a new database model and state management.
- **Recommendation**: *(Recommended)* Adopt **Option A with a fallback rule**: bind the anomaly to the principal site's `OnefopSubmission` once it exists. If secondary sites file before the principal site, defer reconciliation evaluation until the principal site submits. For `MISSING_ESTABLISHMENT_RETURNS`, log against the principal site's return as the anchor dossier.

### 3.3 Campaign Tracking Synchronization Mechanics
- **The Question**: How do review transitions update `CampaignSubmission` when a company has multiple establishments?
- **Options**:
  - *Option A (Site-Specific Progress)*: Update [`src/questionnaires/campaign-review-sync.ts`](file:///C:/Users/win/dsmo_app_phase_e/src/questionnaires/campaign-review-sync.ts) to match strictly by `(campaignId, establishmentId)`.
  - *Option B (Company Rollup Progress)*: A company's campaign target is marked `VALIDATED` only when *all* active establishments have been approved.
- **Tradeoff**: Option A gives accurate divisional pilotage (a divisional delegate sees their local branch validated independently of other regions), but requires updating `syncCampaignSubmissionOnReview` and dropping the database constraint `@@unique([campaignId, companyId])`. Option B keeps company-level progress simple but misrepresents regional quota attainment when branches in different regions are validated weeks apart.
- **Recommendation**: *(Recommended)* Adopt **Option A**. Campaign targeting must operate per establishment to satisfy T.3 territorial quota metrics.

### 3.4 Handling Incomplete Multi-Site Returns at Campaign Close
- **The Question**: When a campaign reaches its statutory deadline and a multi-site enterprise has only filed 3 out of 5 establishment returns, how does the aggregation engine treat the compliant sites?
- **Options**:
  - *Option A (Permissive Local Ingestion)*: Compliant local returns are approved, counted towards departmental/regional quotas, and included in statistical rollups. The company is flagged with `MISSING_ESTABLISHMENT_RETURNS`, but compliant branches are not penalized.
  - *Option B (All-or-Nothing Gating)*: Disallow final validation of any establishment return until all active sites have filed.
- **Tradeoff**: Option B protects mathematical purity of the company reconciliation aggregate, but paralyzes divisional delegates: a compliant branch in Douala cannot be validated because a branch in Maroua failed to report. Option A maintains operational momentum and local statistical integrity.
- **Recommendation**: *(Recommended)* Adopt **Option A**. Never hold a local territorial return hostage to the delinquency of a sister establishment in another division.

---

## 4. Schema Options

### Shape 1: First-Class `Establishment` Entity (Design Doc Proposal)
- **Architecture**: A new `Establishment` table is introduced. `Company` retains legal, tax, and governance metadata. `OnefopSubmission` and `CampaignSubmission` replace their loose string / company foreign keys with explicit relations to `Establishment`.
- **What it Changes**:
  - Adds `model Establishment` and `enum EstablishmentStatus`.
  - In `Company`: retains `establishmentId` as `companyCode`; adds `establishments Establishment[]`.
  - In `OnefopSubmission`: `establishmentId String` becomes a foreign key referencing `Establishment.id`.
  - In `CampaignSubmission`: drops `@@unique([campaignId, companyId])`; `establishmentId String` becomes a foreign key referencing `Establishment.id` with `@@unique([campaignId, establishmentId])`.
  - Drops raw SQL index `onefop_submissions_company_quarter_live_uidx`; adds `onefop_submissions_establishment_quarter_live_uidx` and `establishments_company_principal_uidx`.
- **Migrations Implied**:
  1. DDL migration creating `establishments` table and foreign key constraints.
  2. Data backfill: Iterate all existing `Company` rows; generate an initial `Establishment` record with suffix `-01`, `isPrincipal = true`, and geographic values copied from the parent `Company`.
  3. Relational backfill: Populate `OnefopSubmission.establishmentId` and `CampaignSubmission.establishmentId` with the corresponding newly generated `Establishment.id` UUIDs.
  4. Index migration: Drop company-level live unique index; create establishment-level live unique index.
- **Cost to Reverse**: **High**. Once secondary establishments are created and linked to returns, reverting to a single company model requires merging or discarding separate geographic submissions and resolving conflicting employee rosters.

### Shape 2: Denormalized Site Attributes on Submissions (No New Model)
- **Architecture**: No `Establishment` table. Secondary sites are represented as repeatable declarations under the existing `Company`. `OnefopSubmission` gains explicit site descriptor columns: `siteCode String` (e.g. `EN26000100-02`), `siteName String`, and local territory overrides (`siteRegionId`, `siteDepartmentId`, `siteSubdivisionId`).
- **What it Changes**:
  - No new database tables.
  - `OnefopSubmission` gains site metadata columns.
  - The live unique constraint changes to `(companyId, siteCode, quarterCode)`.
- **Migrations Implied**:
  1. Additive column migration on `onefop_submissions`.
  2. Simple data migration setting default `siteCode = establishmentId + '-01'` on existing submissions.
  3. Recreate the raw SQL partial unique index to include `siteCode`.
- **Cost to Reverse**: **Low to Moderate**. Dropping the site columns and enforcing single returns per company can be done with minimal DDL changes, though historical secondary returns would need archiving.
- **Tradeoff**: While migration is lighter, this pattern fails to provide persistent identity for physical sites across consecutive quarters, makes directory stock tracking in Pilotage inaccurate, and prevents pre-campaign establishment targeting in `CampaignSubmission`.

### Shape 3: Recursive Parent-Child Hierarchy on `Company`
- **Architecture**: Repurpose the `Company` model itself to represent establishments via a self-referencing relationship: `parentCompanyId String?` referencing `Company.id`. A top-level company has `parentCompanyId = null`; secondary sites are `Company` rows with `parentCompanyId` pointing to the head office.
- **What it Changes**:
  - Adds `parentCompanyId` self-relation to `Company`.
  - Retains all existing foreign keys on `OnefopSubmission` and `CampaignSubmission` (`companyId` points to the specific site row).
- **Migrations Implied**:
  1. Add `parentCompanyId` to `Company`.
  2. Relax constraints on `Company` that do not apply to secondary sites (e.g. `taxNumber` cannot be unique across branches of the same legal entity, requiring changing `@unique` on `taxNumber` or allowing duplicates for children).
  3. Update `User` link (only the parent company row links to a `User`).
- **Cost to Reverse**: **Extremely High**. Conflates legal entities with physical locations, destabilizes registration approval flows (R.1), and pollutes the enterprise directory with thousands of pseudo-companies.

---

## 5. Reconciliation Policy Options

When the sum of metrics across an organization's establishment returns diverges from the control question declared on the principal return ($\sum \text{ReportedSum} \neq \text{ControlTarget}$), the system can apply one of the following policies:

### Policy 1: Non-Blocking Anomaly Flagging (Informational / Auditing)
- **Mechanism**: The discrepancy is calculated automatically upon submission or batch reconciliation. If the delta exceeds tolerance $\tau$ (5%), an anomaly `RECONCILIATION_HEADCOUNT_DISCREPANCY` is logged with severity `WARNING` or `ERROR` in `OnefopAnomaly`. The submission workflow is not interrupted; statuses remain `PENDING_REVIEW` or `APPROVED`.
- **Consequences**:
  - Field data collection and local controller reviews proceed without obstruction.
  - Reviewers in the central pilotage team see an anomaly indicator on the company summary.
  - Risk: If reviewers ignore the anomaly, conflicting figures enter official statistics.

### Policy 2: Strict Submission-Time Lockout (Hard Gate)
- **Mechanism**: The backend rejects the submission HTTP request (`400 Bad Request`) if the reported numbers do not match the control headcount.
- **Consequences**:
  - Operationally unfeasible: sites submit asynchronously over a multi-week campaign window. If secondary sites submit first, there is no control target to validate against. If the principal site submits first, secondary sites would be blocked from submitting if their local counts exceed or fall short of remaining quotas, leading to deadlocks.

### Policy 3: Reviewer-Gated Approval (Validation Gate)
- **Mechanism**: Submissions are freely accepted into `PENDING_REVIEW`. However, an unresolved `RECONCILIATION_HEADCOUNT_DISCREPANCY` anomaly blocks the **approval** (`status -> APPROVED`) of the principal site's submission. A MINEFOP controller cannot issue the final approval stamp until the declarant submits an explanation or a correction dossier (`CORRECTION_REQUESTED`) reconciling the totals.
- **Consequences**:
  - Protects official data from being certified with known discrepancies.
  - Permits field collection while enforcing administrative accountability before data freezing.
  - Requires clear operational guidelines on which territorial controller (headquarters region vs. branch region) has jurisdiction to request corrections.

### Policy 4: Automated Imputation / Pro-Rata Scaling
- **Mechanism**: The system automatically scales local site figures proportionally to force their sum to equal the principal site's control figure, or overwrites national statistics with the principal target.
- **Consequences**:
  - Strictly prohibited: violates territorial integrity, alters legally binding declarations without registrant consent, and breaks the Zero Double-Counting invariant established in Section 1.1 of the design doc.

---

## 6. Pilot-versus-Phase-E Tradeoff

If the pilot launches with single-establishment returns and Phase E is implemented subsequently:
> Pilot data will represent multi-site organizations solely through their registered corporate headquarters, artificially concentrating economic headcount in Centre (Mfoundi) and Littoral (Wouri) while creating artificial deficits in regional departments where branches actually operate. Retrofitting Phase E post-pilot will require migrating active production databases under live operational use, retroactively generating `-01` establishment records for all registered companies, converting existing submissions and campaign targets, and dropping the live uniqueness constraint `onefop_submissions_company_quarter_live_uidx`. Reconciling pilot data post-hoc will be impossible for the pilot quarter because secondary site returns were never collected; the pilot dataset will permanently remain an aggregated single-site snapshot. However, the schema transition itself is technically reversible provided legacy foreign keys are preserved during the migration, and launching the pilot without Phase E avoids stalling immediate field deployment on complex multi-site UI and reconciliation mechanics.

---

## 7. Recommendation

### Recommendation: **Pilot First with Single-Establishment Returns; Schedule Phase E for Post-Pilot Expansion**

*Reasoning*:
1. **Core Pilot Objectives**: The primary purpose of the pilot is to validate the legal intake pipeline, the registration approval guard (R.1), campaign deadline snapshotting, and basic questionnaire usability across Cameroon's territorial delegations. None of these core operational goals require multi-site reconciliation on day one.
2. **Implementation Footprint**: Phase E is not merely a database change; it touches questionnaire submission services, autosave draft mechanics, the campaign review synchronizer, the React web dashboard, the Flutter mobile client, SPSS exports, and PDF generation. Introducing this surface area immediately prior to the pilot introduces severe regression risk.
3. **Pilot Scope Control**: The vast majority of registering entities in early pilot cohorts (local enterprises, vocational training centers, municipal CTDs) are single-site. Multi-site enterprises can participate in the pilot under their primary establishment, with explicit notification that branch-level disaggregation will be activated in the subsequent campaign cycle.
4. **Prerequisite Stability**: Deferring Phase E allows the team to stabilize Task T.3 (Returns vs. Quotas pilotage) on the existing `COUNT(DISTINCT companyId)` baseline before introducing the `COUNT(DISTINCT establishmentId)` pivot.

*(This recommendation is an architectural assessment to inform pilot planning, not an executive decision.)*
