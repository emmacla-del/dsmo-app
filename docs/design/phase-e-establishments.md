# Phase E — Multi-Site Establishments & Reconciliation Design

## 1. Context & Business Rules

### 1.1 Policy Directive
ONEFOP declarations are filed **per establishment (site)**. A multi-site organization files one return per physical site. Aggregation across Cameroon must eliminate double counting by design while maintaining full territorial traceability down to the arrondissement level.

### 1.2 Entity Scope
- **Multi-Site Organizations (6 Entity Types)**:
  - `ENTREPRISE` (Private enterprise)
  - `COOPERATIVE` (Cooperative society)
  - `CTD` (Collectivité Territoriale Décentralisée / Municipality)
  - `ONG` (Non-Governmental Organization)
  - `PROJECT_PROGRAM` (Development project or program)
  - `VOCATIONAL_TRAINING` (Vocational training center / CFP)
- **Single-Site Only (Excluded from Multi-Site)**:
  - `ADMINISTRATION` (Ministries, Central Government Directorates, Autonomous Public Bodies).
  - Excluded because civil service employment is managed centrally via MINFOPRA / SIGIPES.
  - Regional delegations and decentralized branches are strictly prohibited from registering separate accounts.
  - Territory for an Administration designates the geographic seat of its headquarters (no restriction to Centre/Mfoundi, enabling public bodies headquartered outside Yaoundé to register).
  - Registration requires a staff-approval check verifying that the registrant is an accredited central public structure.
  - Displayed in Pilotage under a distinct `"Niveau central (Administrations)"` row to prevent distorting regional quotas.

---

## 2. Identifier Architecture & Code Formats

### 2.1 Company Code (Parent)
The existing `Company.establishmentId` (e.g. `EN26000100`, `VT26000114`) is preserved and designated as the **Company Code** (`companyCode`).
- Format: `{Prefix:2}{Year:2}{Serial:4}{SubdivCode:2}` (10 characters).
- Never re-minted or modified when secondary establishments are added.

### 2.2 Site Code (Establishment)
Every site has an explicit `code` derived strictly from the parent Company Code plus a hierarchical sequential suffix:
$$\text{Site Code} = \text{CompanyCode} - \text{Suffix}$$
- **Principal Site (Headquarters)**: Suffix `-01` (e.g. `EN26000100-01`).
- **Secondary Sites**: Suffixes `-02`, `-03`, `-04`, ... allocated sequentially in order of creation (e.g. `EN26000100-02`, `EN26000100-03`).
- **No new national serial**: Sites do not consume national sequential serials; their identity is permanently anchored to the parent entity.

---

## 3. Data Model & Constraints

### 3.1 Relational Architecture

```mermaid
erDiagram
    Company ||--o{ Establishment : "has sites (Restrict)"
    Establishment ||--o{ OnefopSubmission : "files returns (Restrict)"
    Establishment ||--o{ CampaignSubmission : "targeted in (Restrict)"
    Company ||--o{ User : "staff / declarant"
    Region ||--o{ Establishment : "located in"
    Department ||--o{ Establishment : "located in"
    Subdivision ||--o{ Establishment : "located in"
```

### 3.2 Schema Definition (Prisma)

```prisma
enum EstablishmentStatus {
  ACTIVE
  CLOSED
  SUSPENDED
}

model Establishment {
  id              String               @id @default(uuid())
  code            String               @unique // e.g. EN26000100-01
  name            String               // Site label, e.g. "Usine de Bonabéri"
  isPrincipal     Boolean              @default(false)
  status          EstablishmentStatus  @default(ACTIVE)

  companyId       String
  company         Company              @relation(fields: [companyId], references: [id], onDelete: Restrict)

  // Territory hierarchy (canonical FKs + denormalized text)
  regionId        String
  departmentId    String
  subdivisionId   String
  region          String
  department      String
  subdivision     String
  address         String
  phone           String?
  email           String?

  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt

  submissions     OnefopSubmission[]
  campaignTargets CampaignSubmission[]

  @@index([companyId])
  @@index([regionId])
  @@index([departmentId])
  @@index([subdivisionId])
  @@map("establishments")
}
```

### 3.3 Integrity & Deletion Invariants
1. **`onDelete: Restrict` Everywhere**:
   - `Company` $\rightarrow$ `Establishment`: A company cannot be deleted if establishments exist.
   - `Establishment` $\rightarrow$ `OnefopSubmission`: An establishment cannot be deleted if historical returns exist.
   - `Establishment` $\rightarrow$ `CampaignSubmission`: An establishment cannot be deleted if campaign targets exist.
2. **Never Deleted, Closed via Status**:
   - Physical sites that cease operations are updated to `status = CLOSED` with a closure date. Historical returns remain immutable.
3. **Partial Unique Index on Principal Site**:
   - Exactly one principal site per company is enforced at the database level via raw SQL partial unique index:
     ```sql
     CREATE UNIQUE INDEX "establishments_company_principal_uidx"
       ON "establishments" ("companyId")
       WHERE "isPrincipal" = true;
     ```
4. **Submission Unique Return Index**:
   - The unique return index moves from `(companyId, quarterCode)` to `(establishmentId, quarterCode)`:
     ```sql
     CREATE UNIQUE INDEX "onefop_submissions_establishment_quarter_live_uidx"
       ON "onefop_submissions" ("establishmentId", "quarterCode")
       WHERE "status" IN ('PENDING_REVIEW', 'APPROVED');
     ```

---

## 4. Reconciliation Engine

### 4.1 Concept per Entity Type

| Entity Type | Local Return Metric | Principal Return Control Question (Non-Aggregated) |
|---|---|---|
| **ENTREPRISE** | `S1Q10` (`permanentWorkers`) | `CTRL_TOTAL_PERMANENT` ("Effectif permanent total de l'entreprise, tous sites confondus") |
| **COOPERATIVE** | `COOP_S1Q11` (`permanentWorkers`) | `CTRL_TOTAL_PERMANENT` ("Effectif permanent total de la coopérative, tous sites confondus") |
| **CTD** | `CTD_S1Q09` (`permanentWorkers`) | `CTRL_TOTAL_PERMANENT` ("Effectif permanent total de la CTD, tous sites confondus") |
| **ONG** | `ONG_S1Q10` (`permanentWorkers`) | `CTRL_TOTAL_PERMANENT` ("Effectif permanent total de l'ONG, tous sites confondus") |
| **PROJECT_PROGRAM** | `PP_S1Q15` (`permanentWorkers`) | `CTRL_TOTAL_PERMANENT` ("Effectif permanent total du projet/programme, tous sites confondus") |
| **VOCATIONAL_TRAINING** | `VT8_5_PERM_M` + `VT8_5_PERM_F` (Permanent trainers) | `CTRL_VT_PERM_TRAINERS` ("Effectif permanent total des formateurs, tous sites confondus") |
| **ADMINISTRATION** | Excluded | Excluded (Single-site, central MINFOPRA data) |

### 4.2 Reconciliation Rules & Invariant
For a company with active establishments $E_1, \dots, E_n$ (where $E_1$ is principal):

$$\text{ReportedSum} = \sum_{i=1}^n \text{Metric}(E_i)$$
$$\text{ControlTarget} = \text{ControlQuestion}(E_1)$$

1. **Trigger Condition**:
   - Re-evaluated automatically whenever all active establishments of the company have filed a live return (`PENDING_REVIEW` or `APPROVED`) for that quarter.
2. **Missing Return Anomaly**:
   - If the quarter deadline passes and only a subset of active sites have filed, log an anomaly in `OnefopAnomaly`:
     - Code: `MISSING_ESTABLISHMENT_RETURNS`
     - Severity: `WARNING`
3. **Discrepancy Anomaly**:
   - Configurable tolerance threshold $\tau$ (default: $0.05$ or $5\%$):
     $$\frac{|\text{ReportedSum} - \text{ControlTarget}|}{\text{ControlTarget}} > \tau$$
   - If discrepancy exceeds tolerance, log anomaly in `OnefopAnomaly`:
     - Code: `RECONCILIATION_HEADCOUNT_DISCREPANCY`
     - Severity: `ERROR`
     - Details: `{"control": ControlTarget, "sum": ReportedSum, "delta": ReportedSum - ControlTarget, "sites": [...]}`
4. **Zero Double-Counting Invariant**:
   - Regional and national statistical reporting, aggregations, and indicators sum **only the local returns** ($\text{ReportedSum}$). The control question is an evaluation baseline and is **never** added to totals.

---

## 5. Campaign Targeting & Mid-Campaign Sites

### 5.1 CampaignSubmission Evolution
- `CampaignSubmission.establishmentId` transitions from a denormalized string column to a foreign key relation pointing to `Establishment.id`.
- Unique constraint: `@@unique([campaignId, establishmentId])`.
- Tracking: Each establishment has its own target card and submission status (`NOT_STARTED`, `SUBMITTED`, etc.) within the campaign.

### 5.2 Mid-Campaign Site Approval Rule
If a company registers a new secondary site while one or more campaigns are currently active (`status = ACTIVE`):
- The new establishment does **not** receive a `CampaignSubmission` upon creation.
- A `CampaignSubmission` record is generated **only when the site is APPROVED** by staff, and **only if the active campaign's scope** (`targetRegions`, `targetDepartments`, `targetEntityTypes`) includes the site's territory and entity type.
- Upon approval into an active campaign, the `CampaignSubmission` starts with status `NOT_STARTED`.
- The campaign's targeted establishment count is updated dynamically.
- Regional pilotage reflects the newly targeted establishment in the site's respective territory.

---

## 6. Client Backward Compatibility & Migration

### 6.1 Legacy API Clients (Flutter / React)
- **Single-Site Companies**:
  - If a legacy client submits a return without specifying `establishmentId`, the backend defaults automatically to the company's principal site (`-01`).
- **Multi-Site Companies**:
  - If a company has $> 1$ active establishments and submits via a legacy payload lacking `establishmentId`, the request is rejected with `400 Bad Request`:
    > *"Votre organisation comporte plusieurs sites déclarés. Veuillez mettre à jour votre application pour sélectionner le site concerné."*

### 6.2 Data Consumers & Downstream Modules
- **`report.service.ts` & Analytics**: Group by `establishment.regionId` and `establishment.departmentId`.
- **SPSS / CSV Exports**: Every row contains both `companyCode` and `establishmentCode` alongside the site's geographic coordinates.
- **ONEFOP PDF Generation**: Header displays the specific establishment name, code, address, and local territory.
- **Reviewer Territory Scoping (`territory.ts`)**: Regional and Departmental controllers review submissions based on the **site's territory**, not the parent company's headquarters.

---

## 7. Implementation Roadmap & Commit Breakdown

> **Prerequisite**: Implementation begins strictly after the `feat/targets` branch (dual-axis targets/quotas) is merged into master.

### Phase E.1: Database Schema & Historical Migration
- `Establishment` model and `EstablishmentStatus` enum in `schema.prisma`.
- Migration:
  - Generate an `Establishment` row (`-01`, `isPrincipal = true`) for every existing `Company` row using its canonical territory.
  - Populate `OnefopSubmission.establishmentId` and `CampaignSubmission.establishmentId` with the new establishment IDs.
  - Drop obsolete `onefop_submissions_company_quarter_live_uidx`; create `onefop_submissions_establishment_quarter_live_uidx` and `establishments_company_principal_uidx`.
- Unit tests verifying constraint integrity and migration consistency.

### Phase E.2a: Backend Core & Reconciliation Engine
- Establishment CRUD service (`createSecondaryEstablishment`, `closeEstablishment`, `listEstablishments`).
- Code generator for `-02`, `-03` suffixes.
- Update `questionnaires.service.ts` to accept `establishmentId` and enforce site-level live uniqueness.
- Implement reconciliation service storing anomalies in `OnefopAnomaly`.
- Unit tests for reconciliation tolerance and multi-site validation.

### Phase E.2b: Flutter Client Parity
- Add site selector dropdown at questionnaire initiation.
- Add "Mes Établissements" management screen in company profile.
- Render Administration warning banner during registration.
- Display the non-aggregated control question on principal return only.

### Phase E.2c: React Web Portal Parity
- Add site selector modal / stepper in `/home/declarations/new`.
- Add "Établissements secondaires" management tab in web dashboard.
- Render Administration warning banner in `/register`.
- Add staff approval verification checklist in `/admin/etablissement-detail/approbation`.

### Phase E.2d: Pilotage, Reporting & Downstream Adapters
- Add `"Niveau central (Administrations)"` row in Pilotage regional table.
- Update SPSS/CSV export service to output `companyCode` and `siteCode`.
- Update ONEFOP PDF generator to render establishment credentials.
- Update `territory.ts` reviewer scoping to inspect `submission.establishment.regionId`.
