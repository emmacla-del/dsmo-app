# Modern Jobs Statistical Declaration Forms
## Phase 0: Full Discovery & Architecture Audit

**Document Version:** 1.0  
**Date:** September 2026  
**Scope:** `react-web` (Non-VT Entities: Enterprise, Administration, CTD, Coopérative, ONG, Project/Program)  
**Reference Standard:** Form A / ONEFOP VT Wizard UX Principles  
**Status:** Canonical Audit Baseline (Gate 0 Completed)

---

## 1. Executive Summary & Architectural Scope

The ONEFOP system collects quarterly statistical employment declarations across seven entity types in Cameroon. While Vocational Training (VT / Form A) operates under a specialized educational questionnaire with its own dedicated wizard, the remaining **six entity types** (Enterprise, Administration, CTD, Coopérative, ONG, Project/Program) represent employment, labor demand, workforce movements, and skills requirements in public and private workplaces.

### Architectural Imperatives:
1. **VT is 100% untouched:** The VT wizard (`src/components/onefop/VtWizard.tsx`) is an independent reference implementation. It is never modified, merged, or affected by changes to Modern Jobs.
2. **Schema & Contract Invariance (Principle A):** UI $\neq$ Questionnaire schema. Digital field IDs, FormData keys, computed cell formulas, and backend submission contracts are strictly preserved.
3. **Single Source of Truth:** `FormData: Record<string, unknown>` remains the sole state repository. Grid renderers, guided-entry cards, and gateway questions read from and write to the exact same flat keys.
4. **Scope Constraint:** Strictly limited to `react-web`. Zero modifications to Flutter `lib/` or `test/`.

---

## 2. Current Architecture & Entry Points

### 2.1 Route Topology in `react-web`
- **Preview Sandbox:** `src/app/onefop/preview/page.tsx`
  - Loads entity schema dynamically via `useOnefopSchema(entityType)`.
  - Initializes/restores drafts from Dexie IndexedDB (`src/lib/onefop-drafts.ts`).
  - Routes directly into `WizardShell`.
- **Live Declaration Flow:** `src/app/home/declarations/new/page.tsx`
  - Fetches user entity context and active declaration quarter (`/onefop/active-quarter`).
  - Pre-populates company registration data and previously approved declarations.
- **Orchestration Dispatcher:** `src/components/onefop/WizardShell.tsx`
  - Evaluates `isVt = entityType === "vocationalTraining"`.
  - If `isVt`: Renders `VtWizard` (untouched).
  - If `!isVt`: Renders `ModernJobsWizard` (canonical Modern Jobs shell).

### 2.2 Modern Jobs Shell Hierarchy
```text
WizardShell
└── ModernJobsWizard (Single Source of Truth: formData)
    ├── ModernJobsHeader (Cameroon tricolor masthead, FR/EN locale toggle, draft sync status)
    ├── ModernJobsSidebar (Section navigation, completion % chips, auto-save status)
    ├── FormSectionCard (Card containment, section title, guidance header)
    │   ├── Section 0: Identification de l'enquêteur / répondant
    │   ├── Section 1: Thematic Cards (Identification, Localisation, Contact, Activité/Effectif)
    │   │   └── Cameroon Administrative Geography (Region -> Department -> Subdivision cascading selects)
    │   ├── Section 2: 3-Sub-Tab Staging (Demandes d'emplois, Recrutements ordinaires, Profils prioritaires)
    │   │   └── Gateway Questions -> Adaptive Statistical Tables (Grid & Guided modes)
    │   ├── Section 3: Départs & Licenciements (Gateways + Tables S3Q01, S3Q02, S3Q03)
    │   └── Section 4: Stages & Compétences (Gateways + Tables S4Q01, S4Q02, S4Q03)
    └── ModernJobsNavigation (Sticky bottom footer: Précédent, Sauvegarder brouillon, Suivant, Soumettre)
```

---

## 3. Entity Topology & Identifier Map

All six non-VT entity types in `public/schemas/onefop.schema.json` map cleanly to standard sections:

| Entity Type | Schema Sections | Field Count | Table Count | Key Characteristics |
| :--- | :--- | :--- | :--- | :--- |
| **Enterprise** (`enterprise`) | `section0`, `section1_entreprise`, `section2`, `section3`, `section4` | 33 | 11 | Private sector enterprises; CSP breakdown (cadres, maîtrises, ouvriers); 8-table Section 2 |
| **Coopérative** (`cooperative`) | `section0`, `section1_cooperative`, `section2`, `section3`, `section4` | 34 | 11 | Cooperatives & GICs; COOP type selector; vulnerable categories |
| **CTD** (`ctd`) | `section0`, `section1_ctd`, `section2`, `section3`, `section4` | 31 | 11 | Decentralized territorial authorities (Communautés urbaines, Communes); public service workforce |
| **ONG** (`ong`) | `section0`, `section1_ong`, `section2`, `section3`, `section4` | 32 | 11 | Non-governmental organizations; mission and non-profit personnel |
| **Administration** (`administration`) | `section0`, `section1_administration`, `section2`, `section3`, `section4` | 34 | 10 | Ministries and public institutions; administrative projects & supervisory structures |
| **Project / Program** (`projectProgram`) | `section0`, `section1_projectProgram`, `section2_projectProgram`, `section3_projectProgram`, `section4_projectProgram` | 31 | 8 | Development programs; repeating activities table, KPI outcomes, beneficiary insertions |

---

## 4. Master Table Inventory (Sections 2, 3, 4 & Project/Program)

Every table across Modern Jobs uses specific row keys, column layouts, and mathematical formulas:

| Table ID | Paper Code | Template | Target Entities | Matrix / Capacity | Cells / Keys | Mathematical Formulas |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **S21Q01** | S21Q01 | `csp_gender_age_table` | All except PP | 4 rows × 12 cols | 48 cells | Row sums (M+F=Total; age bands sum), Column sums (Total row = cadres+foremen+workers), Grand total |
| **S22Q01** | S22Q01 | `csp_gender_age_table` | All except PP | 4 rows × 12 cols | 48 cells | Recrutements permanents (M/F × 15-24, 25-34, 35+ × Total) |
| **S22Q02** | S22Q02 | `csp_gender_age_table` | All except PP | 4 rows × 12 cols | 48 cells | Recrutements temporaires (M/F × 15-24, 25-34, 35+ × Total) |
| **S22Q03** | S22Q03 | `diploma_gender_age_table` | All except PP | 13 rows × 12 cols | 156 cells | 12 diploma rows (CEP to Sans diplôme) + Total row × Gender & Age bands |
| **S22Q04** | S22Q04 | `csp_status_gender_table` | All except PP | 4 rows × 9 cols | 36 cells | Recrutements personnes handicapées: Permanent (M, F, Total), Temporaire (M, F, Total), Total (M, F, Total) |
| **S22Q05_ENT** | S22Q05 | `vulnerable_named_rows_table` | Enterprise | 4 rows × 9 cols | 36 cells | Recrutements vulnérables: Déplacés internes, Réfugiés, Orphelins + Total row |
| **S22Q05_OTH** | S22Q05 | `vulnerable_named_rows_table` | Coop, CTD, ONG, Admin | 4 rows × 9 cols | 36 cells | Identical structure to S22Q05_ENTERPRISE |
| **S23Q01** | S23Q01 | `csp_gender_age_table` | All except PP | 4 rows × 12 cols | 48 cells | Primo-demandeurs d'emplois recrutés (sans expérience préalable) |
| **S23Q02** | S23Q02 | `first_time_workers_table` | All except PP | 8 rows × 12 cols | 96 cells | Primo-travailleurs: Permanent (3 CSP rows + Subtotal), Temporaire (3 CSP rows + Subtotal) |
| **S3Q01** | S3Q01 | `departure_table` | All except PP | 4 rows × 15 cols | 60 cells | Départs par motif: Licenciements, Démissions, Retraite, Autres, Ensemble (each M, F, Total) |
| **S3Q02** | S3Q02 | `reasons_table` | All except PP | 3 rows × 3 cols + 3 text | 12 items | Top 3 motifs de licenciement (text fields `S3Q02_REASON_1..3_TEXT` + M/F/Total counts) |
| **S3Q03** | S3Q03 | `dismissal_unemployment_table` | Ent, CTD, Coop, ONG | 4 rows × 9 cols | 36 cells | Licenciements et chômage technique par CSP: Licenciement (M/F/Tot), Chômage tech (M/F/Tot), Total |
| **S4Q01** | S4Q01 | `internship_table` | All except PP | 5 rows × 3 cols | 15 cells | Stagiaires accueillis: Vacance, Académique, Professionnel, Pré-emploi + Total row (M, F, Total) |
| **S4Q02** | S4Q02 | `skills_table` | All except PP | 3 rows × 3 cols + 3 text | 12 items | Top 3 compétences recherchées (`S4Q02_DOMAIN_1..3_TEXT` + M/F/Total counts) |
| **S4Q03** | S4Q03 | `training_table` | Ent, Coop, CTD, ONG | 3 rows × 3 cols + 3 text | 12 items | Top 3 besoins en formation continue (`S4Q03_DOMAIN_1..3_TEXT` + M/F/Total counts) |
| **PP_S2_ACT** | - | `activities_table` | Project/Program | 13 repeating rows × 6 cols | Roster | Description, targetPopulation (code 1..6), supportType (1..5), scope (1..4), startDate, duration |
| **PP_S3_OUT** | - | `kpi_period_table` | Project/Program | 4 rows × 3 periods | 12 cells | Bénéficiaires insérés (employés, auto-emploi, créateurs, formés) sur 3 périodes (current, outlook_dec, outlook_june) |
| **PP_S4Q01..06**| S4Q01..06 | `csp_gender_age_table` & `csp_status_gender_table` | Project/Program | Standard CSP shapes | Standard | Project workforce, recruitments, handicap, and vulnerable workers |

---

## 5. Gateway Questions & Conditional Logic Audit

### 5.1 The `RESPONSE_STATUS` Gateway Inversion
In the current raw questionnaire schema, every table is paired with a trailing enum select field:
- Name pattern: `[TABLE_ID]_RESPONSE_STATUS` (e.g., `S21Q01_RESPONSE_STATUS`, `S22Q01_RESPONSE_STATUS`, `S3Q01_RESPONSE_STATUS`, `S4Q01_RESPONSE_STATUS`)
- Values: `REPORTED` | `NONE` | `NOT_APPLICABLE`
- **Drawback in current UI:** Placed at the bottom of or beneath large tables. A user who had zero recruitments must confront an intimidating empty 48-cell table before finding out they could select "NONE".
- **Respondent-First Gateway Architecture:**
  - Placed **above** the table as an upfront conversational question:
    > *"Avez-vous effectué des recrutements de personnel permanent au cours du trimestre ?"*
    > `[ (•) Oui, déclarer les effectifs ]`  `[ ( ) Aucun recrutement (Néant) ]`  `[ ( ) Non concerné (N/A) ]`
  - Selecting "Aucun (NONE)" or "Non concerné (NOT_APPLICABLE)" immediately sets `[TABLE_ID]_RESPONSE_STATUS`, collapses the table, and auto-zeros the summary totals.
  - Selecting "Oui (REPORTED)" expands the statistical table (with choice of Grid or Guided mode).

### 5.2 Single-Field Skip Logic & Dependencies
The audit confirms all existing single-field conditionals in the schema:
1. **Coopérative:**
   - `COOP_S1Q10_OTHER` visible only when `COOP_S1Q10 == "Autre (à préciser)/ Other (specify)"`
2. **CTD:**
   - `CTD_S1Q02` (Type de commune) visible only when `CTD_S1Q01 == "Commune/ Council"`
3. **Administration:**
   - `ADMIN_S1Q10` (Nombre de projets) visible only when `ADMIN_S1Q09 == "Oui/ Yes"`
   - `ADMIN_S1Q12` (Nombre de structures sous tutelle) visible only when `ADMIN_S1Q11 == "Oui/ Yes"`
4. **Project/Program:**
   - `PP_S1Q14` (Motif d'arrêt) visible only when `PP_S1Q13 == "En arrêt/ Stopped"`

---

## 6. Administrative Geography & Section 1 Restructuring

### 6.1 Geography Endpoints
`src/lib/api-client.ts` exposes canonical Cameroon administrative hierarchy endpoints:
- `getRegions()` $\rightarrow$ `GET /locations/regions` (10 Regions: Adamaoua, Centre, Est, Extrême-Nord, Littoral, Nord, Nord-Ouest, Ouest, Sud, Sud-Ouest)
- `getDepartmentsByRegion(regionId)` $\rightarrow$ `GET /locations/regions/:id/departments` (58 Départements)
- `getSubdivisionsByDepartment(departmentId)` $\rightarrow$ `GET /locations/departments/:id/subdivisions` (360 Arrondissements)

### 6.2 Current Flaw vs. Redesign
- **Current State:** `S1Q04_REGION`, `S1Q04_DEPT`, `S1Q04_SUBDIV` (and entity equivalents `COOP_S1Q05_*`, `CTD_S1Q05_*`, `ONG_S1Q05_*`, `ADMIN_S1Q04_*`, `PP_S1Q06_*`) are free text fields. Respondents frequently enter typos, abbreviations, or informal names, creating severe data-cleansing overhead.
- **Modern Jobs Redesign:** Implement `CameroonGeographySelector`:
  - Cascading dropdowns dynamically populate Region $\rightarrow$ Department $\rightarrow$ Subdivision.
  - Automatically writes the standardized official name directly to `S1Q04_REGION`, `S1Q04_DEPT`, `S1Q04_SUBDIV`.
  - Offline fallback: If API is unreachable, provides intelligent searchable datalist with standard ISO names.

### 6.3 Thematic Cards for Section 1
Rather than a monotone stack of 12 text inputs, Section 1 is grouped into 4 clear thematic cards:
1. **Identité légale:** Nom/Raison sociale, Sigle, Statut juridique/Régime, Année de création.
2. **Localisation administrative:** Milieu de résidence (Urbain/Rural), Région, Département, Arrondissement, Localité/Quartier, Siège social.
3. **Contacts officiels:** Téléphone 1, Téléphone 2, Boîte postale, E-mail.
4. **Activité & Effectifs globaux:** Secteur d'activité, Branche d'activité, Activité principale, Effectif permanent global, Postes vacants, Taille d'entreprise.

---

## 7. The "8-Table Monster" Solution for Section 2

Section 2 (`section2`) in the current schema renders 8 consecutive multi-cell statistical tables in a single vertical scroll:
`S21Q01` $\rightarrow$ `S22Q01` $\rightarrow$ `S22Q02` $\rightarrow$ `S22Q03` $\rightarrow$ `S22Q04` $\rightarrow$ `S22Q05` $\rightarrow$ `S23Q01` $\rightarrow$ `S23Q02`.
This produces severe cognitive fatigue and high abandonment rates.

### The 3-Sub-Tab Architecture:
Section 2 is partitioned into 3 logical, respondent-friendly sub-steps:
- **Sub-Tab 2.1: Demandes d'emplois reçues (`S21Q01`)**
  - Gateway: Avez-vous reçu des demandes d'emploi au cours de la période ?
  - Table: Répartition des demandes selon la CSP, le sexe et la tranche d'âge.
- **Sub-Tab 2.2: Recrutements ordinaires (`S22Q01`, `S22Q02`, `S22Q03`)**
  - Gateway 1: Recrutements permanents (`S22Q01`)
  - Gateway 2: Recrutements temporaires (`S22Q02`)
  - Gateway 3: Recrutements par niveau de diplôme (`S22Q03`)
- **Sub-Tab 2.3: Profils prioritaires & Primo-demandeurs (`S22Q04`, `S22Q05`, `S23Q01`, `S23Q02`)**
  - Gateway 1: Travailleurs en situation de handicap (`S22Q04`)
  - Gateway 2: Personnes vulnérables (Déplacés, Réfugiés, Orphelins) (`S22Q05`)
  - Gateway 3: Primo-demandeurs sans qualification / expérience (`S23Q01`)
  - Gateway 4: Primo-travailleurs insérés par type de contrat (`S23Q02`)

Each sub-tab tracks its own completion status chip (`Non commencé`, `En cours`, `Terminé`) in the sidebar outline.

---

## 8. Persistence, Autosave & Submission Lifecycle

### 8.1 Dual Persistence Engine
1. **Local IndexedDB (`src/lib/onefop-drafts.ts`):**
   - Uses Dexie DB (`camleap-onefop-drafts`).
   - Debounced autosave (1,000 ms) triggered on every field change.
   - Guaranteed survival across browser restarts, page refreshes, and network dropouts.
2. **Remote API Draft Sync (`src/lib/onefop-submission.ts`):**
   - `saveDraftToBackend(entityType, quarterCode, draftData)` $\rightarrow$ `POST /onefop/draft`.
   - Fires periodically when connected and on explicit "Sauvegarder" button click.
   - Header visual indicator displays:
     - `● Brouillon enregistré localement` (when offline or saving locally)
     - `✔ Synchronisé avec le serveur` (when server sync confirms 200 OK).

### 8.2 Submission & Coherence Verification
- Pre-submission preview: `fetchDeclarationPreviewPdf(entityType, data, quarterCode)` generates official Handlebars/Puppeteer PDF preview from backend without state mutation.
- Coherence validation: `src/lib/onefop-coherence.ts` and `src/lib/onefop-validation.ts` verify mathematical consistency:
  - Row and column totals must match cell sums.
  - Section 1 global permanent staff count (`S1Q10`) must be coherent with detailed workforce rows.
- Submission lifecycle:
  - `DRAFT` $\rightarrow$ `PENDING_REVIEW` $\rightarrow$ `APPROVED` or `CORRECTION_REQUESTED`.

---

## 9. Identified Collision Risks & Migration Strategy

| Risk Category | Identified Hazard | Architectural Mitigation |
| :--- | :--- | :--- |
| **VT Regression** | Unintended side effects on Vocational Training | Complete isolation: `WizardShell` strictly routes `isVt` to `VtWizard.tsx`. Zero shared components between VT and Modern Jobs. |
| **Backend Deserialization Failure** | Renaming field keys or altering data types | Field IDs and matrix cell IDs match canonical Dart AST compiler output 100%. Gateway questions write directly to `_RESPONSE_STATUS`. |
| **Mathematical Drift** | Cell recalculations disagreeing with official rules | Reused proven mathematical functions from `src/lib/onefop-formulas.ts` (`recalculateCspGenderAge`, `recalculateDeparture`, etc.). |
| **Language Inconsistency** | Slashing French and English ("Français / English") | Replaced noisy bilingual concatenation with `localized(text, locale)` honoring the header language switch (`FR` / `EN`). |
| **Geography Discrepancies** | Non-standard locality text failing backend matching | Linked cascading selects provide official ISO names while saving to existing string keys `S1Q04_REGION`, `S1Q04_DEPT`, `S1Q04_SUBDIV`. |

---

## 10. Gate 0 Completion Checklist

- [x] All 6 non-VT entity schemas analyzed in detail.
- [x] All 17 statistical table templates, capacities, row keys, and cell matrices cataloged.
- [x] Inverted `_RESPONSE_STATUS` logic audited and gateway pattern designed.
- [x] Repeating sub-entities (`PP_S2_ACTIVITIES` and Administration projects) mapped.
- [x] Administrative geography API endpoints verified and selector architecture designed.
- [x] Section 2 "8-Table Monster" decomposition into 3 sub-tabs finalized.
- [x] Dual persistence (IndexedDB + API sync) verified.
- [x] `docs/modern-jobs-architecture-audit.md` authored and committed to repository.

**Gate 0 Status:** APPROVED. Ready to proceed to Phase 1 (Architecture Foundations: Declarative Gateway Questions, Thematic Cards, Cascading Geography).
