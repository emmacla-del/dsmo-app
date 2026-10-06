# ONEFOP field map: registration vs questionnaire (2026-10-06)

Read-only survey. No source, schema, or generated artifact was modified. Scope is
ONEFOP only; DSMO declarations and questionnaires are excluded, including the DSMO
declaration form at `/home/declarations/new`, which also collects NIU/CNPS.

**Sources read**

| Concern | File |
|---|---|
| Public registration wizard | `react-web/src/app/register/page.tsx` |
| Per-type registration fields | `react-web/src/lib/register-constants.ts` (`ENTITY_CONFIGS`), `register-entity-sections.ts` (block headings), `register-options.ts` (select values), `messages/{fr,en}.json` (`registerPage.*`) |
| Admin-assisted registration | `react-web/src/app/admin/inscriptions/nouvelle/page.tsx` |
| Request validation | `src/auth/dto/register-company.dto.ts`, `src/auth/dto/assisted-registration.dto.ts` |
| Request → column | `src/auth/auth.controller.ts` (`registerCompany`, `adminRegisterCompany`), `src/auth/auth.service.ts` (`createCompanyRegistration`) |
| Canonical questionnaire | `lib/core/focus/compiler/onefop_ast.dart` |
| Field enumeration | `react-web/public/schemas/onefop.schema.json`, the generated artifact compiled from the AST. Read programmatically and never edited. Tables were generated from it so that no row is hand-transcribed. |
| Questionnaire storage | `src/questionnaires/questionnaires.service.ts` (live `POST /onefop/submit`), `prisma/schema.prisma` |
| Registration → questionnaire prefill | `react-web/src/lib/onefop-autofill.ts` (`companyToInitialData`) |
| Display sites | `react-web/src/app/admin/**`, `react-web/src/components/admin/CompaniesDirectory.tsx`, `react-web/src/app/home/inscription-en-attente/page.tsx`, `src/data-management/*` |

---

## Step 1: Entity types

The three sources agree on seven live types. The Prisma enum has an eighth value,
`VOCATIONAL_TRAINING_CENTER`, which is deprecated: no code writes or reads it, and it
remains only because Postgres cannot drop enum values.

| Prisma `OnefopEntityType` / API value | Wizard / AST key | Public wizard label (fr / en) | Admin form label (`ENTITY_CONFIGS[].title.fr`) | `/admin/inscriptions` label | AST Section 1 id |
|---|---|---|---|---|---|
| `ENTREPRISE` | `enterprise` | Entreprise / Enterprise | Entreprise | Entreprise | `section1_entreprise` |
| `COOPERATIVE` | `cooperative` | Coopérative / Cooperative | Coopérative | Coopérative | `section1_cooperative` |
| `CTD` | `ctd` | Collectivité territoriale *(région, commune)* / Local authority | CTD (en: "RLA") | CTD | `section1_ctd` |
| `ONG` | `ong` | ONG ou association / NGO or association | ONG | ONG | `section1_ong` |
| `ADMINISTRATION` | `administration` | Administration publique *(ministère, établissement public)* | Administration | Administration | `section1_administration` |
| `PROJECT_PROGRAM` | `projectProgram` | Projet ou programme / Project or programme | Projet / Programme | Projet / programme | `section1_projectProgram` |
| `VOCATIONAL_TRAINING` | `vocationalTraining` | Centre de formation professionnelle | Centre de formation professionnelle (enquête ONEFOP) | CFP | `section1_vocationalTraining` |
| `VOCATIONAL_TRAINING_CENTER` | — | — (deprecated) | — | — | — |

Option order also differs. The public wizard lists enterprise, cooperative, ong,
administration, ctd, projectProgram, vocationalTraining. The admin form lists
enterprise, cooperative, ctd, ong, administration, projectProgram, vocationalTraining.

---

## Step 2: Registration fields

### 2a. Public wizard (`/register`)

The wizard has six steps: **entityType → respondent → entityInfo → location →
security → review**.

- **Steps 1, 2, 4 and 5 are identical for every type.** They cover the type radio; the
  respondent's first name, last name, function, email, phone 1 and phone 2; region,
  department, subdivision, area and sector; and the password with its confirmation.
- **Step 3 ("entityInfo") is the only type-specific step.** Its fields come from
  `ENTITY_CONFIGS[type].fields`. `register-entity-sections.ts` groups them under
  headings. Only VT has conditional fields:
  `functionalStatus = "Non-fonctionnelle"` → `nonFunctionalReason = "Autres"` →
  `nonFunctionalReasonOther`.
- **Hidden or orphaned fields are stripped before sending.** `pruneEntityDataForType`
  runs on type change, and `visibleEntityDataForType` runs at submit.
- **"Required" is mostly a client-side rule.** The server enforces only the following:
  - `email` (`@IsEmail`)
  - region, department and subdivision (`@IsNotEmpty`, plus `requireSubdivision`)
  - `companyName` and `address` (`@IsString`, so an empty string passes)
  - `password`
  - for `VOCATIONAL_TRAINING` only: `cfpType`, `educationSystem` and `functionalStatus`, plus the conditional chain

Step-3 block headings per type (from `register-entity-sections.ts`):

| Type | Blocks |
|---|---|
| enterprise | Identité juridique · Fiscalité et affiliation · Activité économique · Siège social et contact |
| cooperative | Identité de la coopérative · Activité · Siège social et contact |
| ctd | Identification de la CTD · Siège et contact |
| ong | Enregistrement et mission · Siège social et contact |
| administration | Identification administrative · Siège et contact |
| projectProgram | Identification du projet · Siège et contact |
| vocationalTraining | Identification du centre · Situation opérationnelle · Localisation et contact · Promoteur / Directeur |

### 2b. Admin-assisted form (`/admin/inscriptions/nouvelle`) and how it differs

The admin form reuses `ENTITY_CONFIGS`, so step-3 fields, their requiredness and their
labels are the same as the public wizard. Labels are always shown in French. The
differences are:

| Aspect | Public `/register` | Admin `/admin/inscriptions/nouvelle` |
|---|---|---|
| Type labels | Plain-language radio labels with hints | `ENTITY_CONFIGS[].title.fr` (e.g. "CTD", "Centre de formation professionnelle (enquête ONEFOP)") |
| Entity-field layout | Grouped under block headings | One flat grid titled "Identification — {type}" |
| Fonction | Required select with 9 values (`RESPONDENT_FUNCTION_OPTIONS`) | Optional free text |
| Respondent phone 1 | "Téléphone 1", required | "Téléphone", optional |
| Email label | "Email professionnel" | "Adresse e-mail" (hint: "Identifiant de connexion du déclarant.") |
| Milieu (`area`) | Required | **Not shown**, so never sent |
| Secteur d'activité (`sectorId`) | Optional | **Not shown**, so never sent |
| Region/department/subdivision IDs | Sends names and IDs | Sends names only; the server resolves IDs |
| Password | Chosen by the respondent; confirmation and certification checkbox | Not shown; the server generates a temporary password and returns it once |
| Respondent name keys | `firstName`, `lastName` | `firstName`, `lastName`, `respondentFirstName`, `respondentLastName` |
| Extra key | `role: "COMPANY"`, stripped by the DTO whitelist and hard-coded server-side | — |
| Review | Always queued, except `ADMINISTRATION`, which auto-approves | Always queued (`skipAutoApproval`) |

### 2c. Request keys that never reach a column

| Request key | Fate |
|---|---|
| `role` (public) | Not in the DTO; stripped by `whitelist: true`. `User.role` is hard-coded to `COMPANY`. |
| `confirmPassword`, certification | Never sent. |
| `contactName`, `trainingDomains` | Accepted by the DTO and mapped to `Company.trainingDomains` / the `User.firstName` fallback, but **neither form sends them**. |
| `fax`, `totalEmployees`, `menCount`, `womenCount`, `lastYear*` | In `CompanyRegistrationData`, not in the DTO, never sent. `Company.totalEmployees` is set to **0** at registration. |
| Per-type name keys (`cooperativeName`, `ctdName`, `ngoName`, `administrationName`, `projectProgramName`, `centerName`) | Not sent under their own names. They collapse to `companyName` → `Company.name`. |
| `cooperativeHeadOffice` | Collapses to `address` → `Company.address`. |
| `mainMission` | Sent as itself **and** copied into `mainActivity`, so it is stored in both `Company.mainMission` and `Company.mainActivity`. |

---

## Step 3: ONEFOP questionnaire fields

### 3a. How the AST is filtered by entity type

Every `SectionAst` and `FormQuestionAst` carries an `entityTypes` list. The compiler
(`OnefopFormLoader.loadForEntity`) keeps only the sections and questions whose list
contains the entity. This is the generated `sectionEntityMap`:

| Section id | Entity types | Section title (fr) |
|---|---|---|
| `section0` | enterprise, cooperative, ctd, ong, administration, projectProgram | SECTION 0. IDENTIFICATION DU RÉPONDANT |
| `section1_<type>` | one each | SECTION 1. IDENTIFICATION DE L'ENTREPRISE / … (one variant per type) |
| `section2` | enterprise, cooperative, ctd, ong, administration | SECTION 2. EMPLOI ET TRAVAIL |
| `section3` | same five | SECTION 3. DÉPARTS |
| `section4` | same five | SECTION 4. STAGE ET FORMATION |
| `section2_projectProgram` | projectProgram | SECTION 2. RENSEIGNEMENTS SUR LA STRUCTURE SOUS-TUTELLE/ PROJET ET PROGRAMME |
| `section3_projectProgram` | projectProgram | SECTION 3. EMPLOI ET TRAVAIL/ INFORMATIONS SUR L'ACTIVITE DE LA STRUCTURE … |
| `section4_projectProgram` | projectProgram | SECTION 4. DETAILS SUR LES RESENCEMENTS ET RECRUTEMENTS … |
| `section1..9_vocationalTraining` | vocationalTraining | Nine VT-only sections; VT has **no Section 0** because the respondent is §1.15 inside Section 1 |

Within the shared sections, questions are filtered per type as well:

| Type | Section 2 | Section 3 | Section 4 |
|---|---|---|---|
| enterprise | S21Q01, S22Q01–04, **S22Q05_ENTERPRISE**, S23Q01–02 | S3Q01–03 | S4Q01–03 |
| cooperative, ctd, ong | Same, with **S22Q05_OTHER** instead | S3Q01–03 | S4Q01–03 |
| administration | Renumbered S21Q01–S21Q04 (census, recruitment, disability, vulnerable), using SFP categories (fonctionnaire / décisionnaire / contractuelle) instead of CSP | S3Q01–02 only, no S3Q03 | S4Q01–02 only, no S4Q03 |

Each table question has a companion `*_RESPONSE_STATUS` gateway select
(REPORTED / NONE / NOT_APPLICABLE). The schema contains 70 of them.

Size of each type's questionnaire in the generated schema:

| Type | Sections | Top-level questions | Table cells + fields (`fieldCount`) |
|---|---|---|---|
| enterprise | 5 | 59 | 332 |
| cooperative | 5 | 60 | 332 |
| ctd | 5 | 57 | 332 |
| ong | 5 | 58 | 332 |
| administration | 5 | 44 | 317 |
| projectProgram | 5 | 40 | 318 |
| vocationalTraining | 9 | 186 | 299 |

### 3b. Sections, fields and storage

Every submission is one `OnefopSubmission` row:

- `rawData` holds the full answers JSON.
- The **respondent** goes to `OnefopRespondent`, a 1:1 child, for the six non-VT types and for VT §1.15. VT `respondentSex` goes to the VT detail table instead.
- **Section 1** goes to one 1:1 entity-detail relation:

  | Entity type | Relation | Table |
  |---|---|---|
  | enterprise | `enterpriseDetail` | `OnefopEnterpriseDetail` |
  | cooperative | `cooperativeDetail` | `OnefopCooperativeDetail` |
  | ctd | `ctdDetail` | `OnefopCtdDetail` |
  | ong | `ongDetail` | `OnefopOngDetail` |
  | administration | `administrationDetail` | `OnefopAdministrationDetail` |
  | projectProgram | `projectProgramDetail` | `OnefopProjectProgramDetail` |
  | vocationalTraining | `vocationalTrainingDetail` | `OnefopVocationalTrainingDetail` |

- **Statistical tables** go to normalized 1:N fact children, all written in `QuestionnairesService`:
  - non-VT types: `OnefopCspGenderAge` (with a `tableName` discriminator), `OnefopJobApplicationData`, `OnefopRegisteredSeeker`, `OnefopDiplomaData`, `OnefopDisabilityData`, `OnefopVulnerableData`, `OnefopFirstTimeWorker`, `OnefopDepartureData`, `OnefopDismissalReason`, `OnefopDismissalUnemployment`, `OnefopInternshipData`, `OnefopSkillNeed`, `OnefopTrainingNeed`
  - projectProgram only: `ProjectProgramActivity`
  - VT: the 12 `OnefopVt*` tables

Section 1 per type (every row is in Table B):

| Type | Section 1 fields (AST label) |
|---|---|
| enterprise | Régime/statut juridique · Nom de l'entreprise · Milieu de résidence · Région · Département · Arrondissement · Quartier/Village/Localité · Téléphone 1 · Téléphone 2 · Boîte postale · Secteur d'activité (Primaire/Secondaire/Tertiaire) · Branche d'activité · Activité principale · Siège social de l'entreprise · Nombre d'employés permanents · Nombre de postes vacants · Taille de l'entreprise |
| cooperative | Nom de la coopérative · Siège social · Année de création de la coopérative · Milieu · Région/Dépt/Arr./Localité · Tél 1/2 · BP · Secteur · Branche · Activité principale · Type de la coopérative (+ Précisez) · Employés permanents · Postes vacants |
| ctd | Type de CTD · *Si 2, Quel est le type de Commune* (conditional) · Année de création de la CTD · Milieu · Région/Dépt/Arr./Localité · Tél 1/2 · BP · Secteur · Branche · Employé permanent · Poste vacant. **No name question.** |
| ong | Nom de l'ONG · Siège social · Année de création de l'ONG · Milieu · Région/Dépt/Arr./Localité · Tél 1/2 · BP · Secteur · Branche · *Quelle est votre mission principale ?* · Employé permanent · Poste vacant |
| administration | Nom de l'administration · Sigle · Milieu · Région/Dépt/Arr./Localité · Tél 1/2 · BP · Secteur · Branche · Mission principale · Existence de projet ? (→ Combien) · Existence de structures sous tutelle ? (→ Combien) |
| projectProgram | Nature de la structure · Nom · Sigle ou acronyme · Nom du Responsable · Milieu · Région/Dépt/Arr./Localité · Tél 1/2 · BP · Secteur · Branche · Objectif ou mission principale · Siège social · Ministère/Organisme tutelle · Situation du Projet/Programme (→ motif d'arrêt) · Employé permanent · Poste vacant |
| vocationalTraining | 1.1 Code de la Structure *(à ne pas remplir)* · 1.2 Nom du CFP · 1.3 Sigle · 1.4–1.6 Région/Dépt/Arr. · 1.7 Commune · 1.8 Village-Quartier · 1.9 Milieu d'implantation · 1.10 Statut de l'établissement · 1.11 Type de CFP · 1.12 Situation du Centre (→ 1.13 raison → Précisez) · 1.14 Année d'ouverture · 1.15 Répondant: Noms et prénoms, Qualité, WhatsApp, Tél 2, E-mail, Sexe · 1.16 Promoteur/Directeur: Noms et prénoms, Sexe, WhatsApp, Tél 2, E-mail. **No centre phone, no centre address.** |

Required flags follow the AST's `requiredField` setting:

- **The six non-VT types:** about 76% of fields are required. Every phone 2 is optional, as is every table question; tables are gated by their `_RESPONSE_STATUS` field instead.
- **VT:** no field is required in the AST, by explicit VT-2 decision.
- **Final-submit server gate:** `FINAL_REQUIRED_FIELDS` in `questionnaires.service.ts` requires only `name`, `region`, `department`, `subdivision`, `locality` and `area` for VT.

VT sections 2–9 are summarized here; every field is in Table B.

| VT section | Title | Content | Storage |
|---|---|---|---|
| 2 | Informations générales sur l'établissement | 55 scalar questions: convention with the State, sites, shared infrastructure, accessibility, **BP / email / website**, **accreditation (agréé? year, Arrêté n°, date)**, training types, headcounts, energy, water, health, latrines, ICT, councils, boarding, GBV, canteen | `OnefopVocationalTrainingDetail` columns |
| 3 | Éducation en situation d'urgence | 30 scalar questions (crisis, closure, relocation, early warning, trainer training ×5) | VT detail columns |
| 4 | Informations sur les apprenants | 11 tables (4.1–4.11) | `OnefopVtDiplomaData`, `VtSpecialtyRow`, `VtTraineeAgeFlow`, `VtEducationLevelFlow`, `VtTraineeVulnerable`, `VtScholarship` |
| 5 | Manuels, équipements, infrastructures | 4 scalars, 3 tables | VT detail; `OnefopVtCurriculum`, `VtInfrastructure`, `VtFurniture` |
| 6 | Orientation et suivi post-formation | 16 questions, 1 table | VT detail; `VtSpecialtyRow` |
| 7 | Thèmes transversaux | 22 radio/checkbox questions | VT detail |
| 8 | Formateurs | 7 tables, 8 scalars (8.5 by status × sex) | `VtDiplomaData`, `VtTrainerAge`, `VtSpecialtyRow`, `VtTrainerDisability`, `VtTrainerRoster`; scalars in VT detail |
| 9 | Difficultés et perspectives | 4 questions | VT detail |

### 3c. AST fields that are reference numbers rather than answers

| AST key | Label | Type | Storage | Note |
|---|---|---|---|---|
| `VT1_1` | Code de la Structure | text | `OnefopVocationalTrainingDetail.structureCode` | Hint says "A ne pas remplir" (admin-assigned). `onefop-autofill.ts` prefills it with `Company.establishmentId`. |
| `VT2_16` | Arrêté n° | text | `…accreditationOrderNumber` | Accreditation order number. Shown if `VT2_14 = Oui`. |
| `VT2_17` | Date de l'arrêté d'accréditation | text | `…accreditationOrderDate` | Reference date, stored as free text. |
| `VT2_15` | Si oui, année du dernier agrément | number | `…lastAccreditationYear` | Year attached to the reference. |

**No AST field collects an NIU (tax number), CNPS number, RCCM, registration number,
or decree number for any of the seven types.** The phone and P.O. box fields look like
numbers but are contact data, not identifiers.

---

## Step 4: The two tables

### Table A — Registration

Each row is one field of one entity type. Shared rows (respondent, location, security)
repeat under every type, as requested. "Required?" is the client-side flag; the
server-side rule is noted where it differs.

| Entity type | Field label | Request key | Schema column | Required? | Conditional on | Notes |
|---|---|---|---|---|---|---|
| enterprise | Type de structure: "Entreprise"; admin: "Entreprise" | entityType | Company.entityType (= ENTREPRISE) | Yes (both) | — | Option labels and order differ between the two forms. |
| enterprise | Prénom | firstName (public); firstName + respondentFirstName (admin) | User.firstName + Company.respondentFirstName | Yes (both) | — | Controller falls back respondentFirstName ← firstName. |
| enterprise | Nom | lastName (public); lastName + respondentLastName (admin) | User.lastName + Company.respondentLastName | Yes (both) | — |  |
| enterprise | Fonction (public: select of 9 values; admin: free text) | respondentFunction | Company.respondentFunction | Public: yes · Admin: no | — | Different control per form. |
| enterprise | "Email professionnel"; admin: "Adresse e-mail" | email | User.email (@unique) | Yes (both) | — | Login identifier. |
| enterprise | "Téléphone 1"; admin: "Téléphone" | respondentPhone | Company.respondentPhone | Public: yes · Admin: no | — |  |
| enterprise | Téléphone 2 | respondentPhone2 | Company.respondentPhone2 | No | — |  |
| enterprise | Raison sociale (hint: Nom légal de l'entreprise) | companyName (from `companyName` via resolveCompanyName) | Company.name | Yes | — | Per-type wizard key collapses into one request key. |
| enterprise | Statut juridique | legalStatus | Company.legalStatus | Yes | — |  |
| enterprise | N° contribuable (NIU) | taxNumber | Company.taxNumber (@unique) | Yes | — | Server rejects a duplicate NIU. |
| enterprise | N° CNPS | cnpsNumber | Company.cnpsNumber | No | — |  |
| enterprise | Activité principale | mainActivity | Company.mainActivity | Yes | — |  |
| enterprise | Branche d'activité (hint: Ex : Commerce, Industrie, Services) | branch | Company.branch | No | — |  |
| enterprise | Adresse du siège | address | Company.address | Yes | — |  |
| enterprise | Téléphone (hint: Ex : 655000000) | phone | Company.phone | Yes | — |  |
| enterprise | Téléphone 2 | phone2 | Company.phone2 | No | — |  |
| enterprise | Boîte postale | poBox | Company.poBox | No | — |  |
| enterprise | Capital social (XAF) | socialCapital (Number()) | Company.socialCapital (Float) | No | — |  |
| enterprise | Maison mère | parentCompany | Company.parentCompany | No | — |  |
| enterprise | Activité secondaire | secondaryActivity | Company.secondaryActivity | No | — |  |
| enterprise | Région | region (+ regionId, public only) | Company.region/regionId; User.region | Yes (both; server @IsNotEmpty) | — | Admin form sends names only. |
| enterprise | Département | department (+ departmentId, public only) | Company.department/departmentId; User.department | Yes (both; server @IsNotEmpty) | — |  |
| enterprise | Arrondissement | subdivision (+ subdivisionId, public only) | Company.subdivision/subdivisionId | Yes (both; server requireSubdivision) | — | Public UI waives it when the department lists none, but submit() and the server still require it. |
| enterprise | Milieu | area | Company.area | Public: yes · Admin: not shown | — | Values Urbain / Rural. |
| enterprise | Secteur d'activité | sectorId | Company.sectorId → Sector | Public: no · Admin: not shown | — |  |
| enterprise | Mot de passe | password | User.passwordHash (bcrypt) | Public: yes · Admin: not shown | — | Assisted route generates a temporary password on the server. |
| enterprise | Confirmer | — (not sent) | — | Public: yes | — | Client-side check only. |
| enterprise | Je certifie que les informations fournies sont exactes… | — (not sent) | — | Public: yes (gates submit) | — | Not stored. |
| cooperative | Type de structure: "Coopérative"; admin: "Coopérative" | entityType | Company.entityType (= COOPERATIVE) | Yes (both) | — | Option labels and order differ between the two forms. |
| cooperative | Prénom | firstName (public); firstName + respondentFirstName (admin) | User.firstName + Company.respondentFirstName | Yes (both) | — | Controller falls back respondentFirstName ← firstName. |
| cooperative | Nom | lastName (public); lastName + respondentLastName (admin) | User.lastName + Company.respondentLastName | Yes (both) | — |  |
| cooperative | Fonction (public: select of 9 values; admin: free text) | respondentFunction | Company.respondentFunction | Public: yes · Admin: no | — | Different control per form. |
| cooperative | "Email professionnel"; admin: "Adresse e-mail" | email | User.email (@unique) | Yes (both) | — | Login identifier. |
| cooperative | "Téléphone 1"; admin: "Téléphone" | respondentPhone | Company.respondentPhone | Public: yes · Admin: no | — |  |
| cooperative | Téléphone 2 | respondentPhone2 | Company.respondentPhone2 | No | — |  |
| cooperative | Nom de la coopérative | companyName (from `cooperativeName` via resolveCompanyName) | Company.name | Yes | — | Per-type wizard key collapses into one request key. |
| cooperative | Type de coopérative | cooperativeType | Company.cooperativeType | Yes | — |  |
| cooperative | Année de création (hint: AAAA) | yearOfCreation | Company.yearOfCreation (String) | Yes | — | Stored as text. |
| cooperative | N° contribuable (NIU) | taxNumber | Company.taxNumber (@unique) | Yes | — | Server rejects a duplicate NIU. |
| cooperative | Activité principale | mainActivity | Company.mainActivity | Yes | — |  |
| cooperative | Adresse du siège | address (from `cooperativeHeadOffice` via resolveAddress) | Company.address | Yes | — |  |
| cooperative | Branche d'activité | branch | Company.branch | No | — |  |
| cooperative | Téléphone (hint: Ex : 655000000) | phone | Company.phone | Yes | — |  |
| cooperative | Téléphone 2 | phone2 | Company.phone2 | No | — |  |
| cooperative | Boîte postale | poBox | Company.poBox | No | — |  |
| cooperative | Région | region (+ regionId, public only) | Company.region/regionId; User.region | Yes (both; server @IsNotEmpty) | — | Admin form sends names only. |
| cooperative | Département | department (+ departmentId, public only) | Company.department/departmentId; User.department | Yes (both; server @IsNotEmpty) | — |  |
| cooperative | Arrondissement | subdivision (+ subdivisionId, public only) | Company.subdivision/subdivisionId | Yes (both; server requireSubdivision) | — | Public UI waives it when the department lists none, but submit() and the server still require it. |
| cooperative | Milieu | area | Company.area | Public: yes · Admin: not shown | — | Values Urbain / Rural. |
| cooperative | Secteur d'activité | sectorId | Company.sectorId → Sector | Public: no · Admin: not shown | — |  |
| cooperative | Mot de passe | password | User.passwordHash (bcrypt) | Public: yes · Admin: not shown | — | Assisted route generates a temporary password on the server. |
| cooperative | Confirmer | — (not sent) | — | Public: yes | — | Client-side check only. |
| cooperative | Je certifie que les informations fournies sont exactes… | — (not sent) | — | Public: yes (gates submit) | — | Not stored. |
| ctd | Type de structure: "Collectivité territoriale (hint: région, commune)"; admin: "CTD" | entityType | Company.entityType (= CTD) | Yes (both) | — | Option labels and order differ between the two forms. |
| ctd | Prénom | firstName (public); firstName + respondentFirstName (admin) | User.firstName + Company.respondentFirstName | Yes (both) | — | Controller falls back respondentFirstName ← firstName. |
| ctd | Nom | lastName (public); lastName + respondentLastName (admin) | User.lastName + Company.respondentLastName | Yes (both) | — |  |
| ctd | Fonction (public: select of 9 values; admin: free text) | respondentFunction | Company.respondentFunction | Public: yes · Admin: no | — | Different control per form. |
| ctd | "Email professionnel"; admin: "Adresse e-mail" | email | User.email (@unique) | Yes (both) | — | Login identifier. |
| ctd | "Téléphone 1"; admin: "Téléphone" | respondentPhone | Company.respondentPhone | Public: yes · Admin: no | — |  |
| ctd | Téléphone 2 | respondentPhone2 | Company.respondentPhone2 | No | — |  |
| ctd | Type de CTD | ctdType | Company.ctdType | Yes | — |  |
| ctd | Nom de la CTD (hint: Région ou commune) | companyName (from `ctdName` via resolveCompanyName) | Company.name | Yes | — | Per-type wizard key collapses into one request key. |
| ctd | Année de création (hint: AAAA) | yearOfCreation | Company.yearOfCreation (String) | Yes | — | Stored as text. |
| ctd | N° contribuable (NIU) | taxNumber | Company.taxNumber (@unique) | Yes | — | Server rejects a duplicate NIU. |
| ctd | Adresse du siège | address | Company.address | Yes | — |  |
| ctd | Téléphone (hint: Ex : 655000000) | phone | Company.phone | Yes | — |  |
| ctd | Téléphone 2 | phone2 | Company.phone2 | No | — |  |
| ctd | Boîte postale | poBox | Company.poBox | No | — |  |
| ctd | Région | region (+ regionId, public only) | Company.region/regionId; User.region | Yes (both; server @IsNotEmpty) | — | Admin form sends names only. |
| ctd | Département | department (+ departmentId, public only) | Company.department/departmentId; User.department | Yes (both; server @IsNotEmpty) | — |  |
| ctd | Arrondissement | subdivision (+ subdivisionId, public only) | Company.subdivision/subdivisionId | Yes (both; server requireSubdivision) | — | Public UI waives it when the department lists none, but submit() and the server still require it. |
| ctd | Milieu | area | Company.area | Public: yes · Admin: not shown | — | Values Urbain / Rural. |
| ctd | Secteur d'activité | sectorId | Company.sectorId → Sector | Public: no · Admin: not shown | — |  |
| ctd | Mot de passe | password | User.passwordHash (bcrypt) | Public: yes · Admin: not shown | — | Assisted route generates a temporary password on the server. |
| ctd | Confirmer | — (not sent) | — | Public: yes | — | Client-side check only. |
| ctd | Je certifie que les informations fournies sont exactes… | — (not sent) | — | Public: yes (gates submit) | — | Not stored. |
| ong | Type de structure: "ONG ou association"; admin: "ONG" | entityType | Company.entityType (= ONG) | Yes (both) | — | Option labels and order differ between the two forms. |
| ong | Prénom | firstName (public); firstName + respondentFirstName (admin) | User.firstName + Company.respondentFirstName | Yes (both) | — | Controller falls back respondentFirstName ← firstName. |
| ong | Nom | lastName (public); lastName + respondentLastName (admin) | User.lastName + Company.respondentLastName | Yes (both) | — |  |
| ong | Fonction (public: select of 9 values; admin: free text) | respondentFunction | Company.respondentFunction | Public: yes · Admin: no | — | Different control per form. |
| ong | "Email professionnel"; admin: "Adresse e-mail" | email | User.email (@unique) | Yes (both) | — | Login identifier. |
| ong | "Téléphone 1"; admin: "Téléphone" | respondentPhone | Company.respondentPhone | Public: yes · Admin: no | — |  |
| ong | Téléphone 2 | respondentPhone2 | Company.respondentPhone2 | No | — |  |
| ong | Nom de l'ONG | companyName (from `ngoName` via resolveCompanyName) | Company.name | Yes | — | Per-type wizard key collapses into one request key. |
| ong | N° d'enregistrement (hint: Numéro d'agrément) | registrationNumber | Company.registrationNumber | Yes | — |  |
| ong | N° contribuable (NIU) | taxNumber | Company.taxNumber (@unique) | Yes | — | Server rejects a duplicate NIU. |
| ong | Année de création (hint: AAAA) | yearOfCreation | Company.yearOfCreation (String) | Yes | — | Stored as text. |
| ong | Mission principale | mainMission AND mainActivity (via resolveMainActivity) | Company.mainMission + Company.mainActivity | Yes | — | Same text stored in two columns. |
| ong | Adresse du siège | address | Company.address | Yes | — |  |
| ong | Téléphone (hint: Ex : 655000000) | phone | Company.phone | Yes | — |  |
| ong | Téléphone 2 | phone2 | Company.phone2 | No | — |  |
| ong | Boîte postale | poBox | Company.poBox | No | — |  |
| ong | Région | region (+ regionId, public only) | Company.region/regionId; User.region | Yes (both; server @IsNotEmpty) | — | Admin form sends names only. |
| ong | Département | department (+ departmentId, public only) | Company.department/departmentId; User.department | Yes (both; server @IsNotEmpty) | — |  |
| ong | Arrondissement | subdivision (+ subdivisionId, public only) | Company.subdivision/subdivisionId | Yes (both; server requireSubdivision) | — | Public UI waives it when the department lists none, but submit() and the server still require it. |
| ong | Milieu | area | Company.area | Public: yes · Admin: not shown | — | Values Urbain / Rural. |
| ong | Secteur d'activité | sectorId | Company.sectorId → Sector | Public: no · Admin: not shown | — |  |
| ong | Mot de passe | password | User.passwordHash (bcrypt) | Public: yes · Admin: not shown | — | Assisted route generates a temporary password on the server. |
| ong | Confirmer | — (not sent) | — | Public: yes | — | Client-side check only. |
| ong | Je certifie que les informations fournies sont exactes… | — (not sent) | — | Public: yes (gates submit) | — | Not stored. |
| administration | Type de structure: "Administration publique (hint: ministère, établissement public)"; admin: "Administration" | entityType | Company.entityType (= ADMINISTRATION) | Yes (both) | — | Option labels and order differ between the two forms. |
| administration | Prénom | firstName (public); firstName + respondentFirstName (admin) | User.firstName + Company.respondentFirstName | Yes (both) | — | Controller falls back respondentFirstName ← firstName. |
| administration | Nom | lastName (public); lastName + respondentLastName (admin) | User.lastName + Company.respondentLastName | Yes (both) | — |  |
| administration | Fonction (public: select of 9 values; admin: free text) | respondentFunction | Company.respondentFunction | Public: yes · Admin: no | — | Different control per form. |
| administration | "Email professionnel"; admin: "Adresse e-mail" | email | User.email (@unique) | Yes (both) | — | Login identifier. |
| administration | "Téléphone 1"; admin: "Téléphone" | respondentPhone | Company.respondentPhone | Public: yes · Admin: no | — |  |
| administration | Téléphone 2 | respondentPhone2 | Company.respondentPhone2 | No | — |  |
| administration | Nom | companyName (from `administrationName` via resolveCompanyName) | Company.name | Yes | — | Per-type wizard key collapses into one request key. |
| administration | Sigle | sigle | Company.sigle | No | — |  |
| administration | Mission principale | mainMission AND mainActivity (via resolveMainActivity) | Company.mainMission + Company.mainActivity | Yes | — | Same text stored in two columns. |
| administration | Adresse du siège | address | Company.address | Yes | — |  |
| administration | Téléphone (hint: Ex : 655000000) | phone | Company.phone | Yes | — |  |
| administration | Téléphone 2 | phone2 | Company.phone2 | No | — |  |
| administration | Boîte postale | poBox | Company.poBox | No | — |  |
| administration | Région | region (+ regionId, public only) | Company.region/regionId; User.region | Yes (both; server @IsNotEmpty) | — | Admin form sends names only. |
| administration | Département | department (+ departmentId, public only) | Company.department/departmentId; User.department | Yes (both; server @IsNotEmpty) | — |  |
| administration | Arrondissement | subdivision (+ subdivisionId, public only) | Company.subdivision/subdivisionId | Yes (both; server requireSubdivision) | — | Public UI waives it when the department lists none, but submit() and the server still require it. |
| administration | Milieu | area | Company.area | Public: yes · Admin: not shown | — | Values Urbain / Rural. |
| administration | Secteur d'activité | sectorId | Company.sectorId → Sector | Public: no · Admin: not shown | — |  |
| administration | Mot de passe | password | User.passwordHash (bcrypt) | Public: yes · Admin: not shown | — | Assisted route generates a temporary password on the server. |
| administration | Confirmer | — (not sent) | — | Public: yes | — | Client-side check only. |
| administration | Je certifie que les informations fournies sont exactes… | — (not sent) | — | Public: yes (gates submit) | — | Not stored. |
| administration | (no NIU field shown) | taxNumber omitted | Company.taxNumber = `NA-<uuid>` | — | — | Synthetic value: column is NOT NULL + @unique. |
| projectProgram | Type de structure: "Projet ou programme"; admin: "Projet / Programme" | entityType | Company.entityType (= PROJECT_PROGRAM) | Yes (both) | — | Option labels and order differ between the two forms. |
| projectProgram | Prénom | firstName (public); firstName + respondentFirstName (admin) | User.firstName + Company.respondentFirstName | Yes (both) | — | Controller falls back respondentFirstName ← firstName. |
| projectProgram | Nom | lastName (public); lastName + respondentLastName (admin) | User.lastName + Company.respondentLastName | Yes (both) | — |  |
| projectProgram | Fonction (public: select of 9 values; admin: free text) | respondentFunction | Company.respondentFunction | Public: yes · Admin: no | — | Different control per form. |
| projectProgram | "Email professionnel"; admin: "Adresse e-mail" | email | User.email (@unique) | Yes (both) | — | Login identifier. |
| projectProgram | "Téléphone 1"; admin: "Téléphone" | respondentPhone | Company.respondentPhone | Public: yes · Admin: no | — |  |
| projectProgram | Téléphone 2 | respondentPhone2 | Company.respondentPhone2 | No | — |  |
| projectProgram | Nom | companyName (from `projectProgramName` via resolveCompanyName) | Company.name | Yes | — | Per-type wizard key collapses into one request key. |
| projectProgram | Sigle | sigle | Company.sigle | No | — |  |
| projectProgram | Mission principale | mainMission AND mainActivity (via resolveMainActivity) | Company.mainMission + Company.mainActivity | Yes | — | Same text stored in two columns. |
| projectProgram | Adresse du siège | address | Company.address | Yes | — |  |
| projectProgram | Téléphone (hint: Ex : 655000000) | phone | Company.phone | Yes | — |  |
| projectProgram | Téléphone 2 | phone2 | Company.phone2 | No | — |  |
| projectProgram | Boîte postale | poBox | Company.poBox | No | — |  |
| projectProgram | Région | region (+ regionId, public only) | Company.region/regionId; User.region | Yes (both; server @IsNotEmpty) | — | Admin form sends names only. |
| projectProgram | Département | department (+ departmentId, public only) | Company.department/departmentId; User.department | Yes (both; server @IsNotEmpty) | — |  |
| projectProgram | Arrondissement | subdivision (+ subdivisionId, public only) | Company.subdivision/subdivisionId | Yes (both; server requireSubdivision) | — | Public UI waives it when the department lists none, but submit() and the server still require it. |
| projectProgram | Milieu | area | Company.area | Public: yes · Admin: not shown | — | Values Urbain / Rural. |
| projectProgram | Secteur d'activité | sectorId | Company.sectorId → Sector | Public: no · Admin: not shown | — |  |
| projectProgram | Mot de passe | password | User.passwordHash (bcrypt) | Public: yes · Admin: not shown | — | Assisted route generates a temporary password on the server. |
| projectProgram | Confirmer | — (not sent) | — | Public: yes | — | Client-side check only. |
| projectProgram | Je certifie que les informations fournies sont exactes… | — (not sent) | — | Public: yes (gates submit) | — | Not stored. |
| projectProgram | (no NIU field shown) | taxNumber omitted | Company.taxNumber = `NA-<uuid>` | — | — | Synthetic value: column is NOT NULL + @unique. |
| vocationalTraining | Type de structure: "Centre de formation professionnelle"; admin: "Centre de formation professionnelle (enquête ONEFOP)" | entityType | Company.entityType (= VOCATIONAL_TRAINING) | Yes (both) | — | Option labels and order differ between the two forms. |
| vocationalTraining | Prénom | firstName (public); firstName + respondentFirstName (admin) | User.firstName + Company.respondentFirstName | Yes (both) | — | Controller falls back respondentFirstName ← firstName. |
| vocationalTraining | Nom | lastName (public); lastName + respondentLastName (admin) | User.lastName + Company.respondentLastName | Yes (both) | — |  |
| vocationalTraining | Fonction (public: select of 9 values; admin: free text) | respondentFunction | Company.respondentFunction | Public: yes · Admin: no | — | Different control per form. |
| vocationalTraining | "Email professionnel"; admin: "Adresse e-mail" | email | User.email (@unique) | Yes (both) | — | Login identifier. |
| vocationalTraining | "Téléphone 1"; admin: "Téléphone" | respondentPhone | Company.respondentPhone | Public: yes · Admin: no | — |  |
| vocationalTraining | Téléphone 2 | respondentPhone2 | Company.respondentPhone2 | No | — |  |
| vocationalTraining | Nom du CFP | companyName (from `centerName` via resolveCompanyName) | Company.name | Yes | — | Per-type wizard key collapses into one request key. |
| vocationalTraining | Sigle | sigle | Company.sigle | No | — |  |
| vocationalTraining | N° contribuable (NIU) | taxNumber | Company.taxNumber (@unique) | Yes | — | Server rejects a duplicate NIU. |
| vocationalTraining | Type de CFP | cfpType | Company.cfpType | Yes (also server-enforced) | — |  |
| vocationalTraining | Ordre d'enseignement | educationSystem | Company.educationSystem | Yes (also server-enforced) | — |  |
| vocationalTraining | Situation du centre | functionalStatus | Company.functionalStatus | Yes (also server-enforced) | — |  |
| vocationalTraining | Raison | nonFunctionalReason | Company.nonFunctionalReason | Yes (also server-enforced) | functionalStatus = "Non-fonctionnelle" |  |
| vocationalTraining | Autre raison (hint: Précisez) | nonFunctionalReasonOther | Company.nonFunctionalReasonOther | Yes (also server-enforced) | nonFunctionalReason = "Autres" |  |
| vocationalTraining | Année d'ouverture (hint: AAAA) | yearOfCreation | Company.yearOfCreation (String) | Yes | — | Stored as text. |
| vocationalTraining | Adresse du CFP | address | Company.address | Yes | — |  |
| vocationalTraining | Téléphone (hint: Ex : 655000000) | phone | Company.phone | Yes | — |  |
| vocationalTraining | Téléphone 2 | phone2 | Company.phone2 | No | — |  |
| vocationalTraining | Boîte postale | poBox | Company.poBox | No | — |  |
| vocationalTraining | Promoteur — Nom | promoterName | Company.promoterName | Yes | — |  |
| vocationalTraining | Promoteur — Sexe | promoterSex | Company.promoterSex | Yes | — |  |
| vocationalTraining | Promoteur — Tél. 1 | promoterPhone1 | Company.promoterPhone1 | Yes | — |  |
| vocationalTraining | Promoteur — Tél. 2 | promoterPhone2 | Company.promoterPhone2 | No | — |  |
| vocationalTraining | Région | region (+ regionId, public only) | Company.region/regionId; User.region | Yes (both; server @IsNotEmpty) | — | Admin form sends names only. |
| vocationalTraining | Département | department (+ departmentId, public only) | Company.department/departmentId; User.department | Yes (both; server @IsNotEmpty) | — |  |
| vocationalTraining | Arrondissement | subdivision (+ subdivisionId, public only) | Company.subdivision/subdivisionId | Yes (both; server requireSubdivision) | — | Public UI waives it when the department lists none, but submit() and the server still require it. |
| vocationalTraining | Milieu | area | Company.area | Public: yes · Admin: not shown | — | Values Urbain / Rural. |
| vocationalTraining | Secteur d'activité | sectorId | Company.sectorId → Sector | Public: no · Admin: not shown | — |  |
| vocationalTraining | Mot de passe | password | User.passwordHash (bcrypt) | Public: yes · Admin: not shown | — | Assisted route generates a temporary password on the server. |
| vocationalTraining | Confirmer | — (not sent) | — | Public: yes | — | Client-side check only. |
| vocationalTraining | Je certifie que les informations fournies sont exactes… | — (not sent) | — | Public: yes (gates submit) | — | Not stored. |

### Table B — ONEFOP questionnaire

One row per field per entity type, generated from the compiled schema. Shared sections are repeated under each type. Gateway rows (`*_RESPONSE_STATUS`) are included. For table questions, the cell grid is stored in the named fact table; "Required?" is the AST `requiredField` flag.

| Entity type | Section | Field label | AST key (path) | Storage model | Required? | Notes |
|---|---|---|---|---|---|---|
| enterprise | SECTION 0. IDENTIFICATION DU RÉPONDANT | Noms, prénoms du répondant | S0Q01 (`respondent.name`) | OnefopRespondent.respondentName | Yes | text |
| enterprise | SECTION 0. IDENTIFICATION DU RÉPONDANT | Fonction du répondant | S0Q02 (`respondent.function`) | OnefopRespondent.respondentFunction | Yes | text |
| enterprise | SECTION 0. IDENTIFICATION DU RÉPONDANT | Téléphone 1 | S0Q03_TEL1 (`respondent.phone1`) | OnefopRespondent.phone1 | Yes | tel |
| enterprise | SECTION 0. IDENTIFICATION DU RÉPONDANT | Téléphone 2 | S0Q03_TEL2 (`respondent.phone2`) | OnefopRespondent.phone2 | No | tel |
| enterprise | SECTION 0. IDENTIFICATION DU RÉPONDANT | E-mail | S0Q03_EMAIL (`respondent.email`) | OnefopRespondent.email | Yes | email |
| enterprise | SECTION 1. IDENTIFICATION DE L'ENTREPRISE | Régime/statut juridique | S1Q01 (`enterprise.legalStatus`) | OnefopEnterpriseDetail.legalStatus | Yes | select · 4 options |
| enterprise | SECTION 1. IDENTIFICATION DE L'ENTREPRISE | Nom de l'entreprise | S1Q02 (`enterprise.name`) | OnefopEnterpriseDetail.companyName | Yes | text |
| enterprise | SECTION 1. IDENTIFICATION DE L'ENTREPRISE | Milieu de résidence | S1Q03 (`enterprise.area`) | OnefopEnterpriseDetail.area | Yes | radio · 2 options |
| enterprise | SECTION 1. IDENTIFICATION DE L'ENTREPRISE | Région | S1Q04_REGION (`enterprise.region`) | OnefopEnterpriseDetail.region | Yes | text |
| enterprise | SECTION 1. IDENTIFICATION DE L'ENTREPRISE | Département | S1Q04_DEPT (`enterprise.department`) | OnefopEnterpriseDetail.department | Yes | text |
| enterprise | SECTION 1. IDENTIFICATION DE L'ENTREPRISE | Arrondissement | S1Q04_SUBDIV (`enterprise.subdivision`) | OnefopEnterpriseDetail.subdivision | Yes | text |
| enterprise | SECTION 1. IDENTIFICATION DE L'ENTREPRISE | Quartier/Village/Localité | S1Q04_LOCALITY (`enterprise.locality`) | OnefopEnterpriseDetail.locality | Yes | text |
| enterprise | SECTION 1. IDENTIFICATION DE L'ENTREPRISE | Téléphone 1 | S1Q05_TEL1 (`enterprise.phone1`) | OnefopEnterpriseDetail.phone1 | Yes | tel |
| enterprise | SECTION 1. IDENTIFICATION DE L'ENTREPRISE | Téléphone 2 | S1Q05_TEL2 (`enterprise.phone2`) | OnefopEnterpriseDetail.phone2 | No | tel |
| enterprise | SECTION 1. IDENTIFICATION DE L'ENTREPRISE | Boîte postale | S1Q05_BP (`enterprise.poBox`) | OnefopEnterpriseDetail.poBox | Yes | text |
| enterprise | SECTION 1. IDENTIFICATION DE L'ENTREPRISE | Secteur d'activité | S1Q06 (`enterprise.sector`) | OnefopEnterpriseDetail.sector (+ sectorId) | Yes | radio · 3 options |
| enterprise | SECTION 1. IDENTIFICATION DE L'ENTREPRISE | Branche d'activité | S1Q07 (`enterprise.branch`) | OnefopEnterpriseDetail.branch | Yes | text |
| enterprise | SECTION 1. IDENTIFICATION DE L'ENTREPRISE | Activité principale | S1Q08 (`enterprise.mainActivity`) | OnefopEnterpriseDetail.mainActivity | Yes | text |
| enterprise | SECTION 1. IDENTIFICATION DE L'ENTREPRISE | Siège social de l'entreprise | S1Q09 (`enterprise.headOffice`) | OnefopEnterpriseDetail.headOffice | Yes | text |
| enterprise | SECTION 1. IDENTIFICATION DE L'ENTREPRISE | Nombre d'employés permanents | S1Q10 (`enterprise.permanentWorkers`) | OnefopEnterpriseDetail.permanentWorkers | Yes | number |
| enterprise | SECTION 1. IDENTIFICATION DE L'ENTREPRISE | Nombre de postes vacants | S1Q11 (`enterprise.vacancies`) | OnefopEnterpriseDetail.vacancies | Yes | number |
| enterprise | SECTION 1. IDENTIFICATION DE L'ENTREPRISE | Taille de l'entreprise | S1Q12 (`enterprise.size`) | OnefopEnterpriseDetail.enterpriseSize | Yes | radio · 4 options |
| enterprise | SECTION 2. EMPLOI ET TRAVAIL | Combien de demandes d'emplois avez-vous enregistré selon la catégorie socioprofessionnelle, le sexe et la tra… | S21Q01 (`section2.S21Q01`) | OnefopCspGenderAge (s21q01) + OnefopJobApplicationData | No | table · csp_gender_age_table; sub-section: 2.1 DEMANDE D'EMPLOIS |
| enterprise | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S21Q01_RESPONSE_STATUS (`responseStatus.S21Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.1 DEMANDE D'EMPLOIS |
| enterprise | SECTION 2. EMPLOI ET TRAVAIL | Combien de permanents avez-vous recruté selon la catégorie socioprofessionnelle, le sexe et la tranche d'âge … | S22Q01 (`section2.S22Q01`) | OnefopCspGenderAge (s22q01) | No | table · csp_gender_age_table; sub-section: 2.2 RECRUTEMENTS |
| enterprise | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S22Q01_RESPONSE_STATUS (`responseStatus.S22Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.2 RECRUTEMENTS |
| enterprise | SECTION 2. EMPLOI ET TRAVAIL | Combien de temporaires avez-vous recruté selon la catégorie socioprofessionnelle, le sexe et la tranche d'âge… | S22Q02 (`section2.S22Q02`) | OnefopCspGenderAge (s22q02) | No | table · csp_gender_age_table; sub-section: 2.2 RECRUTEMENTS |
| enterprise | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S22Q02_RESPONSE_STATUS (`responseStatus.S22Q02`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.2 RECRUTEMENTS |
| enterprise | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes avez-vous recruté selon la catégorie socioprofessionnelle, le sexe, le diplôme et la tra… | S22Q03 (`section2.S22Q03`) | OnefopDiplomaData | No | table · diploma_gender_age_table; sub-section: 2.2 RECRUTEMENTS |
| enterprise | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S22Q03_RESPONSE_STATUS (`responseStatus.S22Q03`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.2 RECRUTEMENTS |
| enterprise | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes en situation de handicap avez-vous recruté selon la catégorie socio professionnelle, le … | S22Q04 (`section2.S22Q04`) | OnefopDisabilityData | No | table · csp_status_gender_table; sub-section: 2.2 RECRUTEMENTS |
| enterprise | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S22Q04_RESPONSE_STATUS (`responseStatus.S22Q04`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.2 RECRUTEMENTS |
| enterprise | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes vulnérables avez-vous recruté selon le statut et la nature de la vulnérabilité du 1er Ja… | S22Q05_ENTERPRISE (`section2.S22Q05_ENTERPRISE`) | OnefopVulnerableData | No | table · vulnerable_named_rows_table; sub-section: 2.2 RECRUTEMENTS |
| enterprise | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S22Q05_RESPONSE_STATUS (`responseStatus.S22Q05`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.2 RECRUTEMENTS |
| enterprise | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes recherchant leur premier emploi avez-vous enregistré selon la catégorie socioprofessionn… | S23Q01 (`section2.S23Q01`) | OnefopCspGenderAge (s23q01) + OnefopRegisteredSeeker | No | table · csp_gender_age_table; sub-section: 2.3 PRIMO DEMANDEUR (personne à la recherche de son premier… |
| enterprise | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S23Q01_RESPONSE_STATUS (`responseStatus.S23Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.3 PRIMO DEMANDEUR (personne à la recherche de son premier… |
| enterprise | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes travaillant pour la première fois avez-vous recrutées selon le statut, la catégorie soci… | S23Q02 (`section2.S23Q02`) | OnefopFirstTimeWorker | No | table · first_time_workers_table; sub-section: 2.3 PRIMO DEMANDEUR (personne à la recherche de son premier… |
| enterprise | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S23Q02_RESPONSE_STATUS (`responseStatus.S23Q02`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.3 PRIMO DEMANDEUR (personne à la recherche de son premier… |
| enterprise | SECTION 3. DÉPARTS | Combien de départs avez-vous enregistrés du 1er Janvier 2025 à ce jour? | S3Q01 (`section3.S3Q01`) | OnefopDepartureData | No | table · departure_table |
| enterprise | SECTION 3. DÉPARTS | Statut de réponse | S3Q01_RESPONSE_STATUS (`responseStatus.S3Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| enterprise | SECTION 3. DÉPARTS | Quels sont les principaux motifs de licenciement ? | S3Q02 (`section3.S3Q02`) | OnefopDismissalReason | No | table · reasons_table |
| enterprise | SECTION 3. DÉPARTS | Statut de réponse | S3Q02_RESPONSE_STATUS (`responseStatus.S3Q02`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| enterprise | SECTION 3. DÉPARTS | Motif de licenciement 1 | S3Q02_REASON_1_TEXT (`section3.dismissalReasons.reason1.text`) | OnefopDismissalReason (reason text) | Yes | text |
| enterprise | SECTION 3. DÉPARTS | Motif de licenciement 2 | S3Q02_REASON_2_TEXT (`section3.dismissalReasons.reason2.text`) | OnefopDismissalReason (reason text) | Yes | text |
| enterprise | SECTION 3. DÉPARTS | Motif de licenciement 3 | S3Q02_REASON_3_TEXT (`section3.dismissalReasons.reason3.text`) | OnefopDismissalReason (reason text) | Yes | text |
| enterprise | SECTION 3. DÉPARTS | Combien de personnes avez-vous licenciées ou mises en chômage technique du 1er Janvier 2026 à ce jour? | S3Q03 (`section3.S3Q03`) | OnefopDismissalUnemployment | No | table · dismissal_unemployment_table |
| enterprise | SECTION 3. DÉPARTS | Statut de réponse | S3Q03_RESPONSE_STATUS (`responseStatus.S3Q03`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| enterprise | SECTION 4. STAGE ET FORMATION | Combien de stagiaires avez-vous accueillis du 1er Janvier 2026 à ce jour? | S4Q01 (`section4.S4Q01`) | OnefopInternshipData | No | table · internship_table |
| enterprise | SECTION 4. STAGE ET FORMATION | Statut de réponse | S4Q01_RESPONSE_STATUS (`responseStatus.S4Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| enterprise | SECTION 4. STAGE ET FORMATION | Quels sont les besoins en compétence de votre entreprise? (énumérer les 3 compétences prioritaires) | S4Q02 (`section4.S4Q02`) | OnefopSkillNeed | No | table · skills_table |
| enterprise | SECTION 4. STAGE ET FORMATION | Statut de réponse | S4Q02_RESPONSE_STATUS (`responseStatus.S4Q02`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| enterprise | SECTION 4. STAGE ET FORMATION | Domaine de compétence 1 | S4Q02_DOMAIN_1_TEXT (`section4.skills.domain1.text`) | OnefopSkillNeed (domain text) | Yes | text |
| enterprise | SECTION 4. STAGE ET FORMATION | Domaine de compétence 2 | S4Q02_DOMAIN_2_TEXT (`section4.skills.domain2.text`) | OnefopSkillNeed (domain text) | No | text |
| enterprise | SECTION 4. STAGE ET FORMATION | Domaine de compétence 3 | S4Q02_DOMAIN_3_TEXT (`section4.skills.domain3.text`) | OnefopSkillNeed (domain text) | No | text |
| enterprise | SECTION 4. STAGE ET FORMATION | Quels sont les besoins en formation des personnels de votre entreprise? (énumérer les 3 domaines de formation… | S4Q03 (`section4.S4Q03`) | OnefopTrainingNeed | No | table · training_table |
| enterprise | SECTION 4. STAGE ET FORMATION | Statut de réponse | S4Q03_RESPONSE_STATUS (`responseStatus.S4Q03`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| enterprise | SECTION 4. STAGE ET FORMATION | Domaine de formation 1 | S4Q03_DOMAIN_1_TEXT (`section4.training.domain1.text`) | OnefopTrainingNeed (domain text) | Yes | text |
| enterprise | SECTION 4. STAGE ET FORMATION | Domaine de formation 2 | S4Q03_DOMAIN_2_TEXT (`section4.training.domain2.text`) | OnefopTrainingNeed (domain text) | No | text |
| enterprise | SECTION 4. STAGE ET FORMATION | Domaine de formation 3 | S4Q03_DOMAIN_3_TEXT (`section4.training.domain3.text`) | OnefopTrainingNeed (domain text) | No | text |
| cooperative | SECTION 0. IDENTIFICATION DU RÉPONDANT | Noms, prénoms du répondant | S0Q01 (`respondent.name`) | OnefopRespondent.respondentName | Yes | text |
| cooperative | SECTION 0. IDENTIFICATION DU RÉPONDANT | Fonction du répondant | S0Q02 (`respondent.function`) | OnefopRespondent.respondentFunction | Yes | text |
| cooperative | SECTION 0. IDENTIFICATION DU RÉPONDANT | Téléphone 1 | S0Q03_TEL1 (`respondent.phone1`) | OnefopRespondent.phone1 | Yes | tel |
| cooperative | SECTION 0. IDENTIFICATION DU RÉPONDANT | Téléphone 2 | S0Q03_TEL2 (`respondent.phone2`) | OnefopRespondent.phone2 | No | tel |
| cooperative | SECTION 0. IDENTIFICATION DU RÉPONDANT | E-mail | S0Q03_EMAIL (`respondent.email`) | OnefopRespondent.email | Yes | email |
| cooperative | SECTION 1. IDENTIFICATION DE LA COOPERATIVE | Nom de la coopérative | COOP_S1Q01 (`cooperative.name`) | OnefopCooperativeDetail.cooperativeName | Yes | text |
| cooperative | SECTION 1. IDENTIFICATION DE LA COOPERATIVE | Siège social | COOP_S1Q02 (`cooperative.headOffice`) | OnefopCooperativeDetail.headOffice | Yes | text |
| cooperative | SECTION 1. IDENTIFICATION DE LA COOPERATIVE | Année de création de la coopérative | COOP_S1Q03 (`cooperative.yearCreated`) | OnefopCooperativeDetail.yearCreated | Yes | number |
| cooperative | SECTION 1. IDENTIFICATION DE LA COOPERATIVE | Milieu de résidence | COOP_S1Q04 (`cooperative.area`) | OnefopCooperativeDetail.area | Yes | radio · 2 options |
| cooperative | SECTION 1. IDENTIFICATION DE LA COOPERATIVE | Région | COOP_S1Q05_REGION (`cooperative.region`) | OnefopCooperativeDetail.region | Yes | text |
| cooperative | SECTION 1. IDENTIFICATION DE LA COOPERATIVE | Département | COOP_S1Q05_DEPT (`cooperative.department`) | OnefopCooperativeDetail.department | Yes | text |
| cooperative | SECTION 1. IDENTIFICATION DE LA COOPERATIVE | Arrondissement | COOP_S1Q05_SUBDIV (`cooperative.subdivision`) | OnefopCooperativeDetail.subdivision | Yes | text |
| cooperative | SECTION 1. IDENTIFICATION DE LA COOPERATIVE | Quartier/Village/Localité | COOP_S1Q05_LOCALITY (`cooperative.locality`) | OnefopCooperativeDetail.locality | Yes | text |
| cooperative | SECTION 1. IDENTIFICATION DE LA COOPERATIVE | Téléphone 1 | COOP_S1Q06_TEL1 (`cooperative.phone1`) | OnefopCooperativeDetail.phone1 | Yes | tel |
| cooperative | SECTION 1. IDENTIFICATION DE LA COOPERATIVE | Téléphone 2 | COOP_S1Q06_TEL2 (`cooperative.phone2`) | OnefopCooperativeDetail.phone2 | No | tel |
| cooperative | SECTION 1. IDENTIFICATION DE LA COOPERATIVE | Boîte postale | COOP_S1Q06_BP (`cooperative.poBox`) | OnefopCooperativeDetail.poBox | Yes | text |
| cooperative | SECTION 1. IDENTIFICATION DE LA COOPERATIVE | Secteur d'activité | COOP_S1Q07 (`cooperative.sector`) | OnefopCooperativeDetail.sector (+ sectorId) | Yes | radio · 3 options |
| cooperative | SECTION 1. IDENTIFICATION DE LA COOPERATIVE | Branche d'activité | COOP_S1Q08 (`cooperative.branch`) | OnefopCooperativeDetail.branch | Yes | text |
| cooperative | SECTION 1. IDENTIFICATION DE LA COOPERATIVE | Activité principale | COOP_S1Q09 (`cooperative.mainActivity`) | OnefopCooperativeDetail.mainActivity | Yes | text |
| cooperative | SECTION 1. IDENTIFICATION DE LA COOPERATIVE | Type de la coopérative | COOP_S1Q10 (`cooperative.type`) | OnefopCooperativeDetail.cooperativeType | Yes | radio · 3 options |
| cooperative | SECTION 1. IDENTIFICATION DE LA COOPERATIVE | Précisez | COOP_S1Q10_OTHER (`cooperative.typeOther`) | OnefopCooperativeDetail.cooperativeTypeOther | Yes | text; shown if COOP_S1Q10 = "Autre (à préciser)/ Other (specify)" |
| cooperative | SECTION 1. IDENTIFICATION DE LA COOPERATIVE | Nombre d'employés permanents | COOP_S1Q11 (`cooperative.permanentWorkers`) | OnefopCooperativeDetail.permanentWorkers | Yes | number |
| cooperative | SECTION 1. IDENTIFICATION DE LA COOPERATIVE | Nombre de postes vacants | COOP_S1Q12 (`cooperative.vacancies`) | OnefopCooperativeDetail.vacancies | Yes | number |
| cooperative | SECTION 2. EMPLOI ET TRAVAIL | Combien de demandes d'emplois avez-vous enregistré selon la catégorie socioprofessionnelle, le sexe et la tra… | S21Q01 (`section2.S21Q01`) | OnefopCspGenderAge (s21q01) + OnefopJobApplicationData | No | table · csp_gender_age_table; sub-section: 2.1 DEMANDE D'EMPLOIS |
| cooperative | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S21Q01_RESPONSE_STATUS (`responseStatus.S21Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.1 DEMANDE D'EMPLOIS |
| cooperative | SECTION 2. EMPLOI ET TRAVAIL | Combien de permanents avez-vous recruté selon la catégorie socioprofessionnelle, le sexe et la tranche d'âge … | S22Q01 (`section2.S22Q01`) | OnefopCspGenderAge (s22q01) | No | table · csp_gender_age_table; sub-section: 2.2 RECRUTEMENTS |
| cooperative | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S22Q01_RESPONSE_STATUS (`responseStatus.S22Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.2 RECRUTEMENTS |
| cooperative | SECTION 2. EMPLOI ET TRAVAIL | Combien de temporaires avez-vous recruté selon la catégorie socioprofessionnelle, le sexe et la tranche d'âge… | S22Q02 (`section2.S22Q02`) | OnefopCspGenderAge (s22q02) | No | table · csp_gender_age_table; sub-section: 2.2 RECRUTEMENTS |
| cooperative | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S22Q02_RESPONSE_STATUS (`responseStatus.S22Q02`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.2 RECRUTEMENTS |
| cooperative | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes avez-vous recruté selon la catégorie socioprofessionnelle, le sexe, le diplôme et la tra… | S22Q03 (`section2.S22Q03`) | OnefopDiplomaData | No | table · diploma_gender_age_table; sub-section: 2.2 RECRUTEMENTS |
| cooperative | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S22Q03_RESPONSE_STATUS (`responseStatus.S22Q03`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.2 RECRUTEMENTS |
| cooperative | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes en situation de handicap avez-vous recruté selon la catégorie socio professionnelle, le … | S22Q04 (`section2.S22Q04`) | OnefopDisabilityData | No | table · csp_status_gender_table; sub-section: 2.2 RECRUTEMENTS |
| cooperative | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S22Q04_RESPONSE_STATUS (`responseStatus.S22Q04`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.2 RECRUTEMENTS |
| cooperative | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes vulnérables avez-vous recruté selon le statut et la nature de la vulnérabilité du 1er Ja… | S22Q05_OTHER (`section2.S22Q05_OTHER`) | OnefopVulnerableData | No | table · vulnerable_named_rows_table; sub-section: 2.2 RECRUTEMENTS |
| cooperative | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S22Q05_RESPONSE_STATUS (`responseStatus.S22Q05`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.2 RECRUTEMENTS |
| cooperative | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes recherchant leur premier emploi avez-vous enregistré selon la catégorie socioprofessionn… | S23Q01 (`section2.S23Q01`) | OnefopCspGenderAge (s23q01) + OnefopRegisteredSeeker | No | table · csp_gender_age_table; sub-section: 2.3 PRIMO DEMANDEUR (personne à la recherche de son premier… |
| cooperative | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S23Q01_RESPONSE_STATUS (`responseStatus.S23Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.3 PRIMO DEMANDEUR (personne à la recherche de son premier… |
| cooperative | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes travaillant pour la première fois avez-vous recrutées selon le statut, la catégorie soci… | S23Q02 (`section2.S23Q02`) | OnefopFirstTimeWorker | No | table · first_time_workers_table; sub-section: 2.3 PRIMO DEMANDEUR (personne à la recherche de son premier… |
| cooperative | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S23Q02_RESPONSE_STATUS (`responseStatus.S23Q02`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.3 PRIMO DEMANDEUR (personne à la recherche de son premier… |
| cooperative | SECTION 3. DÉPARTS | Combien de départs avez-vous enregistrés du 1er Janvier 2025 à ce jour? | S3Q01 (`section3.S3Q01`) | OnefopDepartureData | No | table · departure_table |
| cooperative | SECTION 3. DÉPARTS | Statut de réponse | S3Q01_RESPONSE_STATUS (`responseStatus.S3Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| cooperative | SECTION 3. DÉPARTS | Quels sont les principaux motifs de licenciement ? | S3Q02 (`section3.S3Q02`) | OnefopDismissalReason | No | table · reasons_table |
| cooperative | SECTION 3. DÉPARTS | Statut de réponse | S3Q02_RESPONSE_STATUS (`responseStatus.S3Q02`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| cooperative | SECTION 3. DÉPARTS | Motif de licenciement 1 | S3Q02_REASON_1_TEXT (`section3.dismissalReasons.reason1.text`) | OnefopDismissalReason (reason text) | Yes | text |
| cooperative | SECTION 3. DÉPARTS | Motif de licenciement 2 | S3Q02_REASON_2_TEXT (`section3.dismissalReasons.reason2.text`) | OnefopDismissalReason (reason text) | Yes | text |
| cooperative | SECTION 3. DÉPARTS | Motif de licenciement 3 | S3Q02_REASON_3_TEXT (`section3.dismissalReasons.reason3.text`) | OnefopDismissalReason (reason text) | Yes | text |
| cooperative | SECTION 3. DÉPARTS | Combien de personnes avez-vous licenciées ou mises en chômage technique du 1er Janvier 2026 à ce jour? | S3Q03 (`section3.S3Q03`) | OnefopDismissalUnemployment | No | table · dismissal_unemployment_table |
| cooperative | SECTION 3. DÉPARTS | Statut de réponse | S3Q03_RESPONSE_STATUS (`responseStatus.S3Q03`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| cooperative | SECTION 4. STAGE ET FORMATION | Combien de stagiaires avez-vous accueillis du 1er Janvier 2026 à ce jour? | S4Q01 (`section4.S4Q01`) | OnefopInternshipData | No | table · internship_table |
| cooperative | SECTION 4. STAGE ET FORMATION | Statut de réponse | S4Q01_RESPONSE_STATUS (`responseStatus.S4Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| cooperative | SECTION 4. STAGE ET FORMATION | Quels sont les besoins en compétence de votre entreprise? (énumérer les 3 compétences prioritaires) | S4Q02 (`section4.S4Q02`) | OnefopSkillNeed | No | table · skills_table |
| cooperative | SECTION 4. STAGE ET FORMATION | Statut de réponse | S4Q02_RESPONSE_STATUS (`responseStatus.S4Q02`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| cooperative | SECTION 4. STAGE ET FORMATION | Domaine de compétence 1 | S4Q02_DOMAIN_1_TEXT (`section4.skills.domain1.text`) | OnefopSkillNeed (domain text) | Yes | text |
| cooperative | SECTION 4. STAGE ET FORMATION | Domaine de compétence 2 | S4Q02_DOMAIN_2_TEXT (`section4.skills.domain2.text`) | OnefopSkillNeed (domain text) | No | text |
| cooperative | SECTION 4. STAGE ET FORMATION | Domaine de compétence 3 | S4Q02_DOMAIN_3_TEXT (`section4.skills.domain3.text`) | OnefopSkillNeed (domain text) | No | text |
| cooperative | SECTION 4. STAGE ET FORMATION | Quels sont les besoins en formation des personnels de votre entreprise? (énumérer les 3 domaines de formation… | S4Q03 (`section4.S4Q03`) | OnefopTrainingNeed | No | table · training_table |
| cooperative | SECTION 4. STAGE ET FORMATION | Statut de réponse | S4Q03_RESPONSE_STATUS (`responseStatus.S4Q03`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| cooperative | SECTION 4. STAGE ET FORMATION | Domaine de formation 1 | S4Q03_DOMAIN_1_TEXT (`section4.training.domain1.text`) | OnefopTrainingNeed (domain text) | Yes | text |
| cooperative | SECTION 4. STAGE ET FORMATION | Domaine de formation 2 | S4Q03_DOMAIN_2_TEXT (`section4.training.domain2.text`) | OnefopTrainingNeed (domain text) | No | text |
| cooperative | SECTION 4. STAGE ET FORMATION | Domaine de formation 3 | S4Q03_DOMAIN_3_TEXT (`section4.training.domain3.text`) | OnefopTrainingNeed (domain text) | No | text |
| ctd | SECTION 0. IDENTIFICATION DU RÉPONDANT | Noms, prénoms du répondant | S0Q01 (`respondent.name`) | OnefopRespondent.respondentName | Yes | text |
| ctd | SECTION 0. IDENTIFICATION DU RÉPONDANT | Fonction du répondant | S0Q02 (`respondent.function`) | OnefopRespondent.respondentFunction | Yes | text |
| ctd | SECTION 0. IDENTIFICATION DU RÉPONDANT | Téléphone 1 | S0Q03_TEL1 (`respondent.phone1`) | OnefopRespondent.phone1 | Yes | tel |
| ctd | SECTION 0. IDENTIFICATION DU RÉPONDANT | Téléphone 2 | S0Q03_TEL2 (`respondent.phone2`) | OnefopRespondent.phone2 | No | tel |
| ctd | SECTION 0. IDENTIFICATION DU RÉPONDANT | E-mail | S0Q03_EMAIL (`respondent.email`) | OnefopRespondent.email | Yes | email |
| ctd | SECTION 1. IDENTIFICATION DE LA CTD | Type de CTD | CTD_S1Q01 (`ctd.type`) | OnefopCtdDetail.ctdType | Yes | radio · 2 options |
| ctd | SECTION 1. IDENTIFICATION DE LA CTD | Si 2, Quel est le type de Commune | CTD_S1Q02 (`ctd.councilType`) | OnefopCtdDetail.councilType | Yes | radio · 2 options; shown if CTD_S1Q01 = "Commune/ Council" |
| ctd | SECTION 1. IDENTIFICATION DE LA CTD | Année de création de la CTD | CTD_S1Q03 (`ctd.yearCreated`) | OnefopCtdDetail.yearCreated | Yes | number |
| ctd | SECTION 1. IDENTIFICATION DE LA CTD | Milieu de résidence | CTD_S1Q04 (`ctd.area`) | OnefopCtdDetail.area | Yes | radio · 2 options |
| ctd | SECTION 1. IDENTIFICATION DE LA CTD | Région | CTD_S1Q05_REGION (`ctd.region`) | OnefopCtdDetail.region | Yes | text |
| ctd | SECTION 1. IDENTIFICATION DE LA CTD | Département | CTD_S1Q05_DEPT (`ctd.department`) | OnefopCtdDetail.department | Yes | text |
| ctd | SECTION 1. IDENTIFICATION DE LA CTD | Arrondissement | CTD_S1Q05_SUBDIV (`ctd.subdivision`) | OnefopCtdDetail.subdivision | Yes | text |
| ctd | SECTION 1. IDENTIFICATION DE LA CTD | Quartier/Village/Localité | CTD_S1Q05_LOCALITY (`ctd.locality`) | OnefopCtdDetail.locality | Yes | text |
| ctd | SECTION 1. IDENTIFICATION DE LA CTD | Téléphone 1 | CTD_S1Q06_TEL1 (`ctd.phone1`) | OnefopCtdDetail.phone1 | Yes | tel |
| ctd | SECTION 1. IDENTIFICATION DE LA CTD | Téléphone 2 | CTD_S1Q06_TEL2 (`ctd.phone2`) | OnefopCtdDetail.phone2 | No | tel |
| ctd | SECTION 1. IDENTIFICATION DE LA CTD | Boîte postale | CTD_S1Q06_BP (`ctd.poBox`) | OnefopCtdDetail.poBox | Yes | text |
| ctd | SECTION 1. IDENTIFICATION DE LA CTD | Secteur d'activité | CTD_S1Q07 (`ctd.sector`) | OnefopCtdDetail.sector (+ sectorId) | Yes | radio · 3 options |
| ctd | SECTION 1. IDENTIFICATION DE LA CTD | Branche d'activité | CTD_S1Q08 (`ctd.branch`) | OnefopCtdDetail.branch | Yes | text |
| ctd | SECTION 1. IDENTIFICATION DE LA CTD | Nombre d'employé permanent | CTD_S1Q09 (`ctd.permanentWorkers`) | OnefopCtdDetail.permanentWorkers | Yes | number |
| ctd | SECTION 1. IDENTIFICATION DE LA CTD | Nombre de poste vacant | CTD_S1Q10 (`ctd.vacancies`) | OnefopCtdDetail.vacancies | Yes | number |
| ctd | SECTION 2. EMPLOI ET TRAVAIL | Combien de demandes d'emplois avez-vous enregistré selon la catégorie socioprofessionnelle, le sexe et la tra… | S21Q01 (`section2.S21Q01`) | OnefopCspGenderAge (s21q01) + OnefopJobApplicationData | No | table · csp_gender_age_table; sub-section: 2.1 DEMANDE D'EMPLOIS |
| ctd | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S21Q01_RESPONSE_STATUS (`responseStatus.S21Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.1 DEMANDE D'EMPLOIS |
| ctd | SECTION 2. EMPLOI ET TRAVAIL | Combien de permanents avez-vous recruté selon la catégorie socioprofessionnelle, le sexe et la tranche d'âge … | S22Q01 (`section2.S22Q01`) | OnefopCspGenderAge (s22q01) | No | table · csp_gender_age_table; sub-section: 2.2 RECRUTEMENTS |
| ctd | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S22Q01_RESPONSE_STATUS (`responseStatus.S22Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.2 RECRUTEMENTS |
| ctd | SECTION 2. EMPLOI ET TRAVAIL | Combien de temporaires avez-vous recruté selon la catégorie socioprofessionnelle, le sexe et la tranche d'âge… | S22Q02 (`section2.S22Q02`) | OnefopCspGenderAge (s22q02) | No | table · csp_gender_age_table; sub-section: 2.2 RECRUTEMENTS |
| ctd | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S22Q02_RESPONSE_STATUS (`responseStatus.S22Q02`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.2 RECRUTEMENTS |
| ctd | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes avez-vous recruté selon la catégorie socioprofessionnelle, le sexe, le diplôme et la tra… | S22Q03 (`section2.S22Q03`) | OnefopDiplomaData | No | table · diploma_gender_age_table; sub-section: 2.2 RECRUTEMENTS |
| ctd | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S22Q03_RESPONSE_STATUS (`responseStatus.S22Q03`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.2 RECRUTEMENTS |
| ctd | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes en situation de handicap avez-vous recruté selon la catégorie socio professionnelle, le … | S22Q04 (`section2.S22Q04`) | OnefopDisabilityData | No | table · csp_status_gender_table; sub-section: 2.2 RECRUTEMENTS |
| ctd | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S22Q04_RESPONSE_STATUS (`responseStatus.S22Q04`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.2 RECRUTEMENTS |
| ctd | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes vulnérables avez-vous recruté selon le statut et la nature de la vulnérabilité du 1er Ja… | S22Q05_OTHER (`section2.S22Q05_OTHER`) | OnefopVulnerableData | No | table · vulnerable_named_rows_table; sub-section: 2.2 RECRUTEMENTS |
| ctd | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S22Q05_RESPONSE_STATUS (`responseStatus.S22Q05`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.2 RECRUTEMENTS |
| ctd | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes recherchant leur premier emploi avez-vous enregistré selon la catégorie socioprofessionn… | S23Q01 (`section2.S23Q01`) | OnefopCspGenderAge (s23q01) + OnefopRegisteredSeeker | No | table · csp_gender_age_table; sub-section: 2.3 PRIMO DEMANDEUR (personne à la recherche de son premier… |
| ctd | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S23Q01_RESPONSE_STATUS (`responseStatus.S23Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.3 PRIMO DEMANDEUR (personne à la recherche de son premier… |
| ctd | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes travaillant pour la première fois avez-vous recrutées selon le statut, la catégorie soci… | S23Q02 (`section2.S23Q02`) | OnefopFirstTimeWorker | No | table · first_time_workers_table; sub-section: 2.3 PRIMO DEMANDEUR (personne à la recherche de son premier… |
| ctd | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S23Q02_RESPONSE_STATUS (`responseStatus.S23Q02`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.3 PRIMO DEMANDEUR (personne à la recherche de son premier… |
| ctd | SECTION 3. DÉPARTS | Combien de départs avez-vous enregistrés du 1er Janvier 2025 à ce jour? | S3Q01 (`section3.S3Q01`) | OnefopDepartureData | No | table · departure_table |
| ctd | SECTION 3. DÉPARTS | Statut de réponse | S3Q01_RESPONSE_STATUS (`responseStatus.S3Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| ctd | SECTION 3. DÉPARTS | Quels sont les principaux motifs de licenciement ? | S3Q02 (`section3.S3Q02`) | OnefopDismissalReason | No | table · reasons_table |
| ctd | SECTION 3. DÉPARTS | Statut de réponse | S3Q02_RESPONSE_STATUS (`responseStatus.S3Q02`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| ctd | SECTION 3. DÉPARTS | Motif de licenciement 1 | S3Q02_REASON_1_TEXT (`section3.dismissalReasons.reason1.text`) | OnefopDismissalReason (reason text) | Yes | text |
| ctd | SECTION 3. DÉPARTS | Motif de licenciement 2 | S3Q02_REASON_2_TEXT (`section3.dismissalReasons.reason2.text`) | OnefopDismissalReason (reason text) | Yes | text |
| ctd | SECTION 3. DÉPARTS | Motif de licenciement 3 | S3Q02_REASON_3_TEXT (`section3.dismissalReasons.reason3.text`) | OnefopDismissalReason (reason text) | Yes | text |
| ctd | SECTION 3. DÉPARTS | Combien de personnes avez-vous licenciées ou mises en chômage technique du 1er Janvier 2026 à ce jour? | S3Q03 (`section3.S3Q03`) | OnefopDismissalUnemployment | No | table · dismissal_unemployment_table |
| ctd | SECTION 3. DÉPARTS | Statut de réponse | S3Q03_RESPONSE_STATUS (`responseStatus.S3Q03`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| ctd | SECTION 4. STAGE ET FORMATION | Combien de stagiaires avez-vous accueillis du 1er Janvier 2026 à ce jour? | S4Q01 (`section4.S4Q01`) | OnefopInternshipData | No | table · internship_table |
| ctd | SECTION 4. STAGE ET FORMATION | Statut de réponse | S4Q01_RESPONSE_STATUS (`responseStatus.S4Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| ctd | SECTION 4. STAGE ET FORMATION | Quels sont les besoins en compétence de votre entreprise? (énumérer les 3 compétences prioritaires) | S4Q02 (`section4.S4Q02`) | OnefopSkillNeed | No | table · skills_table |
| ctd | SECTION 4. STAGE ET FORMATION | Statut de réponse | S4Q02_RESPONSE_STATUS (`responseStatus.S4Q02`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| ctd | SECTION 4. STAGE ET FORMATION | Domaine de compétence 1 | S4Q02_DOMAIN_1_TEXT (`section4.skills.domain1.text`) | OnefopSkillNeed (domain text) | Yes | text |
| ctd | SECTION 4. STAGE ET FORMATION | Domaine de compétence 2 | S4Q02_DOMAIN_2_TEXT (`section4.skills.domain2.text`) | OnefopSkillNeed (domain text) | No | text |
| ctd | SECTION 4. STAGE ET FORMATION | Domaine de compétence 3 | S4Q02_DOMAIN_3_TEXT (`section4.skills.domain3.text`) | OnefopSkillNeed (domain text) | No | text |
| ctd | SECTION 4. STAGE ET FORMATION | Quels sont les besoins en formation des personnels de votre entreprise? (énumérer les 3 domaines de formation… | S4Q03 (`section4.S4Q03`) | OnefopTrainingNeed | No | table · training_table |
| ctd | SECTION 4. STAGE ET FORMATION | Statut de réponse | S4Q03_RESPONSE_STATUS (`responseStatus.S4Q03`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| ctd | SECTION 4. STAGE ET FORMATION | Domaine de formation 1 | S4Q03_DOMAIN_1_TEXT (`section4.training.domain1.text`) | OnefopTrainingNeed (domain text) | Yes | text |
| ctd | SECTION 4. STAGE ET FORMATION | Domaine de formation 2 | S4Q03_DOMAIN_2_TEXT (`section4.training.domain2.text`) | OnefopTrainingNeed (domain text) | No | text |
| ctd | SECTION 4. STAGE ET FORMATION | Domaine de formation 3 | S4Q03_DOMAIN_3_TEXT (`section4.training.domain3.text`) | OnefopTrainingNeed (domain text) | No | text |
| ong | SECTION 0. IDENTIFICATION DU RÉPONDANT | Noms, prénoms du répondant | S0Q01 (`respondent.name`) | OnefopRespondent.respondentName | Yes | text |
| ong | SECTION 0. IDENTIFICATION DU RÉPONDANT | Fonction du répondant | S0Q02 (`respondent.function`) | OnefopRespondent.respondentFunction | Yes | text |
| ong | SECTION 0. IDENTIFICATION DU RÉPONDANT | Téléphone 1 | S0Q03_TEL1 (`respondent.phone1`) | OnefopRespondent.phone1 | Yes | tel |
| ong | SECTION 0. IDENTIFICATION DU RÉPONDANT | Téléphone 2 | S0Q03_TEL2 (`respondent.phone2`) | OnefopRespondent.phone2 | No | tel |
| ong | SECTION 0. IDENTIFICATION DU RÉPONDANT | E-mail | S0Q03_EMAIL (`respondent.email`) | OnefopRespondent.email | Yes | email |
| ong | SECTION 1. IDENTIFICATION DE L'ONG | Nom de l'ONG | ONG_S1Q01 (`ong.name`) | OnefopOngDetail.ongName | Yes | text |
| ong | SECTION 1. IDENTIFICATION DE L'ONG | Siège social | ONG_S1Q02 (`ong.headOffice`) | OnefopOngDetail.headOffice | Yes | text |
| ong | SECTION 1. IDENTIFICATION DE L'ONG | Année de création de l'ONG | ONG_S1Q03 (`ong.yearCreated`) | OnefopOngDetail.yearCreated | Yes | number |
| ong | SECTION 1. IDENTIFICATION DE L'ONG | Milieu de résidence | ONG_S1Q04 (`ong.area`) | OnefopOngDetail.area | Yes | radio · 2 options |
| ong | SECTION 1. IDENTIFICATION DE L'ONG | Région | ONG_S1Q05_REGION (`ong.region`) | OnefopOngDetail.region | Yes | text |
| ong | SECTION 1. IDENTIFICATION DE L'ONG | Département | ONG_S1Q05_DEPT (`ong.department`) | OnefopOngDetail.department | Yes | text |
| ong | SECTION 1. IDENTIFICATION DE L'ONG | Arrondissement | ONG_S1Q05_SUBDIV (`ong.subdivision`) | OnefopOngDetail.subdivision | Yes | text |
| ong | SECTION 1. IDENTIFICATION DE L'ONG | Quartier/Village/Localité | ONG_S1Q05_LOCALITY (`ong.locality`) | OnefopOngDetail.locality | Yes | text |
| ong | SECTION 1. IDENTIFICATION DE L'ONG | Téléphone 1 | ONG_S1Q06_TEL1 (`ong.phone1`) | OnefopOngDetail.phone1 | Yes | tel |
| ong | SECTION 1. IDENTIFICATION DE L'ONG | Téléphone 2 | ONG_S1Q06_TEL2 (`ong.phone2`) | OnefopOngDetail.phone2 | No | tel |
| ong | SECTION 1. IDENTIFICATION DE L'ONG | Boîte postale | ONG_S1Q06_BP (`ong.poBox`) | OnefopOngDetail.poBox | Yes | text |
| ong | SECTION 1. IDENTIFICATION DE L'ONG | Secteur d'activité | ONG_S1Q07 (`ong.sector`) | OnefopOngDetail.sector (+ sectorId) | Yes | radio · 3 options |
| ong | SECTION 1. IDENTIFICATION DE L'ONG | Branche d'activité | ONG_S1Q08 (`ong.branch`) | OnefopOngDetail.branch | Yes | text |
| ong | SECTION 1. IDENTIFICATION DE L'ONG | Quelle est votre mission principale ? | ONG_S1Q09 (`ong.mainMission`) | OnefopOngDetail.mainMission | Yes | text |
| ong | SECTION 1. IDENTIFICATION DE L'ONG | Nombre d'employé permanent | ONG_S1Q10 (`ong.permanentWorkers`) | OnefopOngDetail.permanentWorkers | Yes | number |
| ong | SECTION 1. IDENTIFICATION DE L'ONG | Nombre de poste vacant | ONG_S1Q11 (`ong.vacancies`) | OnefopOngDetail.vacancies | Yes | number |
| ong | SECTION 2. EMPLOI ET TRAVAIL | Combien de demandes d'emplois avez-vous enregistré selon la catégorie socioprofessionnelle, le sexe et la tra… | S21Q01 (`section2.S21Q01`) | OnefopCspGenderAge (s21q01) + OnefopJobApplicationData | No | table · csp_gender_age_table; sub-section: 2.1 DEMANDE D'EMPLOIS |
| ong | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S21Q01_RESPONSE_STATUS (`responseStatus.S21Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.1 DEMANDE D'EMPLOIS |
| ong | SECTION 2. EMPLOI ET TRAVAIL | Combien de permanents avez-vous recruté selon la catégorie socioprofessionnelle, le sexe et la tranche d'âge … | S22Q01 (`section2.S22Q01`) | OnefopCspGenderAge (s22q01) | No | table · csp_gender_age_table; sub-section: 2.2 RECRUTEMENTS |
| ong | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S22Q01_RESPONSE_STATUS (`responseStatus.S22Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.2 RECRUTEMENTS |
| ong | SECTION 2. EMPLOI ET TRAVAIL | Combien de temporaires avez-vous recruté selon la catégorie socioprofessionnelle, le sexe et la tranche d'âge… | S22Q02 (`section2.S22Q02`) | OnefopCspGenderAge (s22q02) | No | table · csp_gender_age_table; sub-section: 2.2 RECRUTEMENTS |
| ong | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S22Q02_RESPONSE_STATUS (`responseStatus.S22Q02`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.2 RECRUTEMENTS |
| ong | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes avez-vous recruté selon la catégorie socioprofessionnelle, le sexe, le diplôme et la tra… | S22Q03 (`section2.S22Q03`) | OnefopDiplomaData | No | table · diploma_gender_age_table; sub-section: 2.2 RECRUTEMENTS |
| ong | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S22Q03_RESPONSE_STATUS (`responseStatus.S22Q03`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.2 RECRUTEMENTS |
| ong | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes en situation de handicap avez-vous recruté selon la catégorie socio professionnelle, le … | S22Q04 (`section2.S22Q04`) | OnefopDisabilityData | No | table · csp_status_gender_table; sub-section: 2.2 RECRUTEMENTS |
| ong | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S22Q04_RESPONSE_STATUS (`responseStatus.S22Q04`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.2 RECRUTEMENTS |
| ong | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes vulnérables avez-vous recruté selon le statut et la nature de la vulnérabilité du 1er Ja… | S22Q05_OTHER (`section2.S22Q05_OTHER`) | OnefopVulnerableData | No | table · vulnerable_named_rows_table; sub-section: 2.2 RECRUTEMENTS |
| ong | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S22Q05_RESPONSE_STATUS (`responseStatus.S22Q05`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.2 RECRUTEMENTS |
| ong | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes recherchant leur premier emploi avez-vous enregistré selon la catégorie socioprofessionn… | S23Q01 (`section2.S23Q01`) | OnefopCspGenderAge (s23q01) + OnefopRegisteredSeeker | No | table · csp_gender_age_table; sub-section: 2.3 PRIMO DEMANDEUR (personne à la recherche de son premier… |
| ong | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S23Q01_RESPONSE_STATUS (`responseStatus.S23Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.3 PRIMO DEMANDEUR (personne à la recherche de son premier… |
| ong | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes travaillant pour la première fois avez-vous recrutées selon le statut, la catégorie soci… | S23Q02 (`section2.S23Q02`) | OnefopFirstTimeWorker | No | table · first_time_workers_table; sub-section: 2.3 PRIMO DEMANDEUR (personne à la recherche de son premier… |
| ong | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S23Q02_RESPONSE_STATUS (`responseStatus.S23Q02`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options; sub-section: 2.3 PRIMO DEMANDEUR (personne à la recherche de son premier… |
| ong | SECTION 3. DÉPARTS | Combien de départs avez-vous enregistrés du 1er Janvier 2025 à ce jour? | S3Q01 (`section3.S3Q01`) | OnefopDepartureData | No | table · departure_table |
| ong | SECTION 3. DÉPARTS | Statut de réponse | S3Q01_RESPONSE_STATUS (`responseStatus.S3Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| ong | SECTION 3. DÉPARTS | Quels sont les principaux motifs de licenciement ? | S3Q02 (`section3.S3Q02`) | OnefopDismissalReason | No | table · reasons_table |
| ong | SECTION 3. DÉPARTS | Statut de réponse | S3Q02_RESPONSE_STATUS (`responseStatus.S3Q02`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| ong | SECTION 3. DÉPARTS | Motif de licenciement 1 | S3Q02_REASON_1_TEXT (`section3.dismissalReasons.reason1.text`) | OnefopDismissalReason (reason text) | Yes | text |
| ong | SECTION 3. DÉPARTS | Motif de licenciement 2 | S3Q02_REASON_2_TEXT (`section3.dismissalReasons.reason2.text`) | OnefopDismissalReason (reason text) | Yes | text |
| ong | SECTION 3. DÉPARTS | Motif de licenciement 3 | S3Q02_REASON_3_TEXT (`section3.dismissalReasons.reason3.text`) | OnefopDismissalReason (reason text) | Yes | text |
| ong | SECTION 3. DÉPARTS | Combien de personnes avez-vous licenciées ou mises en chômage technique du 1er Janvier 2026 à ce jour? | S3Q03 (`section3.S3Q03`) | OnefopDismissalUnemployment | No | table · dismissal_unemployment_table |
| ong | SECTION 3. DÉPARTS | Statut de réponse | S3Q03_RESPONSE_STATUS (`responseStatus.S3Q03`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| ong | SECTION 4. STAGE ET FORMATION | Combien de stagiaires avez-vous accueillis du 1er Janvier 2026 à ce jour? | S4Q01 (`section4.S4Q01`) | OnefopInternshipData | No | table · internship_table |
| ong | SECTION 4. STAGE ET FORMATION | Statut de réponse | S4Q01_RESPONSE_STATUS (`responseStatus.S4Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| ong | SECTION 4. STAGE ET FORMATION | Quels sont les besoins en compétence de votre entreprise? (énumérer les 3 compétences prioritaires) | S4Q02 (`section4.S4Q02`) | OnefopSkillNeed | No | table · skills_table |
| ong | SECTION 4. STAGE ET FORMATION | Statut de réponse | S4Q02_RESPONSE_STATUS (`responseStatus.S4Q02`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| ong | SECTION 4. STAGE ET FORMATION | Domaine de compétence 1 | S4Q02_DOMAIN_1_TEXT (`section4.skills.domain1.text`) | OnefopSkillNeed (domain text) | Yes | text |
| ong | SECTION 4. STAGE ET FORMATION | Domaine de compétence 2 | S4Q02_DOMAIN_2_TEXT (`section4.skills.domain2.text`) | OnefopSkillNeed (domain text) | No | text |
| ong | SECTION 4. STAGE ET FORMATION | Domaine de compétence 3 | S4Q02_DOMAIN_3_TEXT (`section4.skills.domain3.text`) | OnefopSkillNeed (domain text) | No | text |
| ong | SECTION 4. STAGE ET FORMATION | Quels sont les besoins en formation des personnels de votre entreprise? (énumérer les 3 domaines de formation… | S4Q03 (`section4.S4Q03`) | OnefopTrainingNeed | No | table · training_table |
| ong | SECTION 4. STAGE ET FORMATION | Statut de réponse | S4Q03_RESPONSE_STATUS (`responseStatus.S4Q03`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| ong | SECTION 4. STAGE ET FORMATION | Domaine de formation 1 | S4Q03_DOMAIN_1_TEXT (`section4.training.domain1.text`) | OnefopTrainingNeed (domain text) | Yes | text |
| ong | SECTION 4. STAGE ET FORMATION | Domaine de formation 2 | S4Q03_DOMAIN_2_TEXT (`section4.training.domain2.text`) | OnefopTrainingNeed (domain text) | No | text |
| ong | SECTION 4. STAGE ET FORMATION | Domaine de formation 3 | S4Q03_DOMAIN_3_TEXT (`section4.training.domain3.text`) | OnefopTrainingNeed (domain text) | No | text |
| administration | SECTION 0. IDENTIFICATION DU RÉPONDANT | Noms, prénoms du répondant | S0Q01 (`respondent.name`) | OnefopRespondent.respondentName | Yes | text |
| administration | SECTION 0. IDENTIFICATION DU RÉPONDANT | Fonction du répondant | S0Q02 (`respondent.function`) | OnefopRespondent.respondentFunction | Yes | text |
| administration | SECTION 0. IDENTIFICATION DU RÉPONDANT | Téléphone 1 | S0Q03_TEL1 (`respondent.phone1`) | OnefopRespondent.phone1 | Yes | tel |
| administration | SECTION 0. IDENTIFICATION DU RÉPONDANT | Téléphone 2 | S0Q03_TEL2 (`respondent.phone2`) | OnefopRespondent.phone2 | No | tel |
| administration | SECTION 0. IDENTIFICATION DU RÉPONDANT | E-mail | S0Q03_EMAIL (`respondent.email`) | OnefopRespondent.email | Yes | email |
| administration | SECTION 1. CARACTERISTIQUE DE L'ADMINISTRATION | Nom de l'administration | ADMIN_S1Q01 (`administration.name`) | OnefopAdministrationDetail.name | Yes | text |
| administration | SECTION 1. CARACTERISTIQUE DE L'ADMINISTRATION | Sigle | ADMIN_S1Q02 (`administration.sigle`) | OnefopAdministrationDetail.sigle | Yes | text |
| administration | SECTION 1. CARACTERISTIQUE DE L'ADMINISTRATION | Milieu de résidence | ADMIN_S1Q03 (`administration.area`) | OnefopAdministrationDetail.area | Yes | radio · 2 options |
| administration | SECTION 1. CARACTERISTIQUE DE L'ADMINISTRATION | Région | ADMIN_S1Q04_REGION (`administration.region`) | OnefopAdministrationDetail.region | Yes | text |
| administration | SECTION 1. CARACTERISTIQUE DE L'ADMINISTRATION | Département | ADMIN_S1Q04_DEPT (`administration.department`) | OnefopAdministrationDetail.department | Yes | text |
| administration | SECTION 1. CARACTERISTIQUE DE L'ADMINISTRATION | Arrondissement | ADMIN_S1Q04_SUBDIV (`administration.subdivision`) | OnefopAdministrationDetail.subdivision | Yes | text |
| administration | SECTION 1. CARACTERISTIQUE DE L'ADMINISTRATION | Quartier/Village/Localité | ADMIN_S1Q04_LOCALITY (`administration.locality`) | OnefopAdministrationDetail.locality | Yes | text |
| administration | SECTION 1. CARACTERISTIQUE DE L'ADMINISTRATION | Téléphone 1 | ADMIN_S1Q05_TEL1 (`administration.phone1`) | OnefopAdministrationDetail.phone1 | Yes | tel |
| administration | SECTION 1. CARACTERISTIQUE DE L'ADMINISTRATION | Téléphone 2 | ADMIN_S1Q05_TEL2 (`administration.phone2`) | OnefopAdministrationDetail.phone2 | No | tel |
| administration | SECTION 1. CARACTERISTIQUE DE L'ADMINISTRATION | Boîte postale | ADMIN_S1Q05_BP (`administration.poBox`) | OnefopAdministrationDetail.poBox | Yes | text |
| administration | SECTION 1. CARACTERISTIQUE DE L'ADMINISTRATION | Secteur d'activité | ADMIN_S1Q06 (`administration.sector`) | OnefopAdministrationDetail.sector (+ sectorId) | Yes | radio · 3 options |
| administration | SECTION 1. CARACTERISTIQUE DE L'ADMINISTRATION | Branche d'activité | ADMIN_S1Q07 (`administration.branch`) | OnefopAdministrationDetail.branch | Yes | text |
| administration | SECTION 1. CARACTERISTIQUE DE L'ADMINISTRATION | Mission principale | ADMIN_S1Q08 (`administration.mainMission`) | OnefopAdministrationDetail.mainMission | Yes | text |
| administration | SECTION 1. CARACTERISTIQUE DE L'ADMINISTRATION | Existence de projet ? | ADMIN_S1Q09 (`administration.hasProject`) | OnefopAdministrationDetail.hasProject | Yes | radio · 2 options |
| administration | SECTION 1. CARACTERISTIQUE DE L'ADMINISTRATION | Combien de projets ? | ADMIN_S1Q10 (`administration.projectCount`) | OnefopAdministrationDetail.projectCount | Yes | number; shown if ADMIN_S1Q09 = "Oui/ Yes" |
| administration | SECTION 1. CARACTERISTIQUE DE L'ADMINISTRATION | Existence de structures sous tutelle ? | ADMIN_S1Q11 (`administration.hasSupervisedStructures`) | OnefopAdministrationDetail.hasSupervisedStructures | Yes | radio · 2 options |
| administration | SECTION 1. CARACTERISTIQUE DE L'ADMINISTRATION | Combien de structures sous tutelle ? | ADMIN_S1Q12 (`administration.supervisedStructureCount`) | OnefopAdministrationDetail.supervisedStructureCount | Yes | number; shown if ADMIN_S1Q11 = "Oui/ Yes" |
| administration | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes avez-vous recensé selon la catégorie socioprofessionnelle (fonctionnaire, décisionnaire,… | S21Q01 (`section2.S21Q01`) | OnefopCspGenderAge (s21q01) + OnefopJobApplicationData (†) | No | table · csp_gender_age_table |
| administration | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S21Q01_RESPONSE_STATUS (`responseStatus.S21Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| administration | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes avez-vous recruté selon la catégorie socioprofessionnelle (fonctionnaire, décisionnaire,… | S21Q02 (`section2.S21Q02`) | OnefopCspGenderAge (tableName s22q01) | No | table · csp_gender_age_table |
| administration | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S21Q02_RESPONSE_STATUS (`responseStatus.S21Q02`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| administration | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes en situation de handicap avez-vous recruté selon la catégorie socioprofessionnelle (fonc… | S21Q03 (`section2.S21Q03`) | OnefopDisabilityData (status TOTAL) | No | table · csp_status_gender_table |
| administration | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S21Q03_RESPONSE_STATUS (`responseStatus.S21Q03`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| administration | SECTION 2. EMPLOI ET TRAVAIL | Combien de personnes vulnérables avez-vous recruté selon la nature de la vulnérabilité et le sexe du 1er Janv… | S21Q04 (`section2.S21Q04`) | OnefopVulnerableData | No | table · vulnerable_named_rows_table |
| administration | SECTION 2. EMPLOI ET TRAVAIL | Statut de réponse | S21Q04_RESPONSE_STATUS (`responseStatus.S21Q04`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| administration | SECTION 3. DÉPARTS | Combien de départs avez-vous enregistrés du 1er Janvier 2025 à ce jour? | S3Q01 (`section3.S3Q01`) | OnefopDepartureData | No | table · departure_table |
| administration | SECTION 3. DÉPARTS | Statut de réponse | S3Q01_RESPONSE_STATUS (`responseStatus.S3Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| administration | SECTION 3. DÉPARTS | Quels sont les principaux motifs de licenciement ? | S3Q02 (`section3.S3Q02`) | OnefopDismissalReason | No | table · reasons_table |
| administration | SECTION 3. DÉPARTS | Statut de réponse | S3Q02_RESPONSE_STATUS (`responseStatus.S3Q02`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| administration | SECTION 3. DÉPARTS | Motif de licenciement 1 | S3Q02_REASON_1_TEXT (`section3.dismissalReasons.reason1.text`) | OnefopDismissalReason (reason text) | Yes | text |
| administration | SECTION 3. DÉPARTS | Motif de licenciement 2 | S3Q02_REASON_2_TEXT (`section3.dismissalReasons.reason2.text`) | OnefopDismissalReason (reason text) | Yes | text |
| administration | SECTION 3. DÉPARTS | Motif de licenciement 3 | S3Q02_REASON_3_TEXT (`section3.dismissalReasons.reason3.text`) | OnefopDismissalReason (reason text) | Yes | text |
| administration | SECTION 4. STAGE ET FORMATION | Combien de stagiaires avez-vous accueillis du 1er Janvier 2026 à ce jour? | S4Q01 (`section4.S4Q01`) | OnefopInternshipData | No | table · internship_table |
| administration | SECTION 4. STAGE ET FORMATION | Statut de réponse | S4Q01_RESPONSE_STATUS (`responseStatus.S4Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| administration | SECTION 4. STAGE ET FORMATION | Quels sont les besoins en compétence de votre administration? (énumérer les 3 compétences prioritaires) | S4Q02 (`section4.S4Q02`) | OnefopSkillNeed | No | table · skills_table |
| administration | SECTION 4. STAGE ET FORMATION | Statut de réponse | S4Q02_RESPONSE_STATUS (`responseStatus.S4Q02`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| administration | SECTION 4. STAGE ET FORMATION | Domaine de compétence 1 | S4Q02_DOMAIN_1_TEXT (`section4.skills.domain1.text`) | OnefopSkillNeed (domain text) | Yes | text |
| administration | SECTION 4. STAGE ET FORMATION | Domaine de compétence 2 | S4Q02_DOMAIN_2_TEXT (`section4.skills.domain2.text`) | OnefopSkillNeed (domain text) | No | text |
| administration | SECTION 4. STAGE ET FORMATION | Domaine de compétence 3 | S4Q02_DOMAIN_3_TEXT (`section4.skills.domain3.text`) | OnefopSkillNeed (domain text) | No | text |
| projectProgram | SECTION 0. IDENTIFICATION DU RÉPONDANT | Noms, prénoms du répondant | S0Q01 (`respondent.name`) | OnefopRespondent.respondentName | Yes | text |
| projectProgram | SECTION 0. IDENTIFICATION DU RÉPONDANT | Fonction du répondant | S0Q02 (`respondent.function`) | OnefopRespondent.respondentFunction | Yes | text |
| projectProgram | SECTION 0. IDENTIFICATION DU RÉPONDANT | Téléphone 1 | S0Q03_TEL1 (`respondent.phone1`) | OnefopRespondent.phone1 | Yes | tel |
| projectProgram | SECTION 0. IDENTIFICATION DU RÉPONDANT | Téléphone 2 | S0Q03_TEL2 (`respondent.phone2`) | OnefopRespondent.phone2 | No | tel |
| projectProgram | SECTION 0. IDENTIFICATION DU RÉPONDANT | E-mail | S0Q03_EMAIL (`respondent.email`) | OnefopRespondent.email | Yes | email |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Nature de la structure | PP_S1Q01 (`projectProgram.nature`) | OnefopProjectProgramDetail.nature | Yes | radio · 4 options |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Nom | PP_S1Q02 (`projectProgram.name`) | OnefopProjectProgramDetail.name | Yes | text |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Sigle ou acronyme | PP_S1Q03 (`projectProgram.sigle`) | OnefopProjectProgramDetail.sigle | Yes | text |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Nom du Responsable | PP_S1Q04 (`projectProgram.personInCharge`) | OnefopProjectProgramDetail.personInCharge | Yes | text |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Milieu de résidence | PP_S1Q05 (`projectProgram.area`) | OnefopProjectProgramDetail.area | Yes | radio · 2 options |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Région | PP_S1Q06_REGION (`projectProgram.region`) | OnefopProjectProgramDetail.region | Yes | text |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Département | PP_S1Q06_DEPT (`projectProgram.department`) | OnefopProjectProgramDetail.department | Yes | text |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Arrondissement | PP_S1Q06_SUBDIV (`projectProgram.subdivision`) | OnefopProjectProgramDetail.subdivision | Yes | text |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Quartier/Village/Localité | PP_S1Q06_LOCALITY (`projectProgram.locality`) | OnefopProjectProgramDetail.locality | Yes | text |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Téléphone 1 | PP_S1Q07_TEL1 (`projectProgram.phone1`) | OnefopProjectProgramDetail.phone1 | Yes | tel |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Téléphone 2 | PP_S1Q07_TEL2 (`projectProgram.phone2`) | OnefopProjectProgramDetail.phone2 | No | tel |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Boîte postale | PP_S1Q07_BP (`projectProgram.poBox`) | OnefopProjectProgramDetail.poBox | Yes | text |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Secteur d'activité | PP_S1Q08 (`projectProgram.sector`) | OnefopProjectProgramDetail.sector (+ sectorId) | Yes | radio · 3 options |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Branche d'activité | PP_S1Q09 (`projectProgram.branch`) | OnefopProjectProgramDetail.branch | Yes | text |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Objectif ou mission principale | PP_S1Q10 (`projectProgram.mainMission`) | OnefopProjectProgramDetail.mainMission | Yes | text |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Siège social | PP_S1Q11 (`projectProgram.headOffice`) | OnefopProjectProgramDetail.headOffice | Yes | text |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Ministère/ Organisme tutelle | PP_S1Q12 (`projectProgram.supervisingMinistry`) | OnefopProjectProgramDetail.supervisingMinistry | Yes | text |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Situation du Projet / Programme | PP_S1Q13 (`projectProgram.status`) | OnefopProjectProgramDetail.status | Yes | radio · 3 options |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Si en arrêt, quel est le principal motif ? | PP_S1Q14 (`projectProgram.stopReason`) | OnefopProjectProgramDetail.stopReason | Yes | radio · 4 options; shown if PP_S1Q13 = "En arrêt/ Stopped" |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Nombre d'employé permanent | PP_S1Q15 (`projectProgram.permanentWorkers`) | OnefopProjectProgramDetail.permanentWorkers | Yes | number |
| projectProgram | SECTION 1. IDENTIFICATION DE LA STRUCTURE | Nombre de poste vacant | PP_S1Q16 (`projectProgram.vacancies`) | OnefopProjectProgramDetail.vacancies | Yes | number |
| projectProgram | SECTION 2. RENSEIGNEMENTS SUR LA STRUCTURE SOUS-TUTELLE/ PROJET ET PROGRAMME | Prestations offertes, population cible, nature de l'appui, rayon d'action, date de début et durée | PP_S2_ACTIVITIES (`projectProgram.activities`) | OnefopProjectProgramDetail.activities | No | repeating_table · activities_table |
| projectProgram | SECTION 3. EMPLOI ET TRAVAIL/ INFORMATIONS SUR L'ACTIVITE DE LA STRUCTURE SOUS-TUTELLE / PROJET / PROGRAMME | Nombre de bénéficiaires insérés comme employés, en auto emploi, d'emplois créés par les bénéficiaires employe… | PP_S3_OUTCOMES (`projectProgram.outcomes`) | OnefopProjectProgramDetail.outcomes | No | table · kpi_period_table |
| projectProgram | SECTION 4. DETAILS SUR LES RESENCEMENTS ET RECRUTEMENTS CONCERNANT L'ACTIVITE DE LA STRUCTURE SOUS-TUTELLE / PROJET / PROGRAMME | Combien de permanents avez-vous recensé selon la catégorie socioprofessionnelle, le sexe et la tranche d'âge … | PP_S4Q01 (`section4_projectProgram.PP_S4Q01`) | OnefopCspGenderAge (tableName pp_s4q01) | No | table · csp_gender_age_table |
| projectProgram | SECTION 4. DETAILS SUR LES RESENCEMENTS ET RECRUTEMENTS CONCERNANT L'ACTIVITE DE LA STRUCTURE SOUS-TUTELLE / PROJET / PROGRAMME | Statut de réponse | S4Q01_RESPONSE_STATUS (`responseStatus.S4Q01`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| projectProgram | SECTION 4. DETAILS SUR LES RESENCEMENTS ET RECRUTEMENTS CONCERNANT L'ACTIVITE DE LA STRUCTURE SOUS-TUTELLE / PROJET / PROGRAMME | Combien de temporaires avez-vous recensé selon la catégorie socioprofessionnelle, le sexe et la tranche d'âge… | PP_S4Q02 (`section4_projectProgram.PP_S4Q02`) | OnefopCspGenderAge (tableName pp_s4q02) | No | table · csp_gender_age_table |
| projectProgram | SECTION 4. DETAILS SUR LES RESENCEMENTS ET RECRUTEMENTS CONCERNANT L'ACTIVITE DE LA STRUCTURE SOUS-TUTELLE / PROJET / PROGRAMME | Statut de réponse | S4Q02_RESPONSE_STATUS (`responseStatus.S4Q02`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| projectProgram | SECTION 4. DETAILS SUR LES RESENCEMENTS ET RECRUTEMENTS CONCERNANT L'ACTIVITE DE LA STRUCTURE SOUS-TUTELLE / PROJET / PROGRAMME | Combien de permanents avez-vous recruté selon la catégorie socioprofessionnelle, le sexe et la tranche d'âge … | PP_S4Q03 (`section4_projectProgram.PP_S4Q03`) | OnefopCspGenderAge (tableName pp_s4q03) | No | table · csp_gender_age_table |
| projectProgram | SECTION 4. DETAILS SUR LES RESENCEMENTS ET RECRUTEMENTS CONCERNANT L'ACTIVITE DE LA STRUCTURE SOUS-TUTELLE / PROJET / PROGRAMME | Statut de réponse | S4Q03_RESPONSE_STATUS (`responseStatus.S4Q03`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| projectProgram | SECTION 4. DETAILS SUR LES RESENCEMENTS ET RECRUTEMENTS CONCERNANT L'ACTIVITE DE LA STRUCTURE SOUS-TUTELLE / PROJET / PROGRAMME | Combien de temporaires avez-vous recruté selon la catégorie socioprofessionnelle, le sexe et la tranche d'âge… | PP_S4Q04 (`section4_projectProgram.PP_S4Q04`) | OnefopCspGenderAge (tableName pp_s4q04) | No | table · csp_gender_age_table |
| projectProgram | SECTION 4. DETAILS SUR LES RESENCEMENTS ET RECRUTEMENTS CONCERNANT L'ACTIVITE DE LA STRUCTURE SOUS-TUTELLE / PROJET / PROGRAMME | Statut de réponse | S4Q04_RESPONSE_STATUS (`responseStatus.S4Q04`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| projectProgram | SECTION 4. DETAILS SUR LES RESENCEMENTS ET RECRUTEMENTS CONCERNANT L'ACTIVITE DE LA STRUCTURE SOUS-TUTELLE / PROJET / PROGRAMME | Combien de personnes en situation de handicap avez-vous recruté selon la catégorie socio professionnelle, le … | PP_S4Q05 (`section4_projectProgram.PP_S4Q05`) | OnefopDisabilityData | No | table · csp_status_gender_table |
| projectProgram | SECTION 4. DETAILS SUR LES RESENCEMENTS ET RECRUTEMENTS CONCERNANT L'ACTIVITE DE LA STRUCTURE SOUS-TUTELLE / PROJET / PROGRAMME | Statut de réponse | S4Q05_RESPONSE_STATUS (`responseStatus.S4Q05`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| projectProgram | SECTION 4. DETAILS SUR LES RESENCEMENTS ET RECRUTEMENTS CONCERNANT L'ACTIVITE DE LA STRUCTURE SOUS-TUTELLE / PROJET / PROGRAMME | Combien de personnes vulnérables avez-vous recruté selon le statut et la nature de la vulnérabilité du 1er Ja… | PP_S4Q06 (`section4_projectProgram.PP_S4Q06`) | OnefopVulnerableData | No | table · csp_status_gender_table |
| projectProgram | SECTION 4. DETAILS SUR LES RESENCEMENTS ET RECRUTEMENTS CONCERNANT L'ACTIVITE DE LA STRUCTURE SOUS-TUTELLE / PROJET / PROGRAMME | Statut de réponse | S4Q06_RESPONSE_STATUS (`responseStatus.S4Q06`) | rawData only (gateway: REPORTED / NONE / NOT_APPLICABLE) | Yes | select · 3 options |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Code de la Structure | VT1_1 (`vocationalTraining.structureCode`) | OnefopVocationalTrainingDetail.structureCode | No | text; **reference number/date** |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Nom du CFP | VT1_2 (`vocationalTraining.name`) | OnefopVocationalTrainingDetail.name | No | text |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Sigle | VT1_3 (`vocationalTraining.sigle`) | OnefopVocationalTrainingDetail.sigle | No | text |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Région | VT1_4 (`vocationalTraining.region`) | OnefopVocationalTrainingDetail.region | No | text |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Département | VT1_5 (`vocationalTraining.department`) | OnefopVocationalTrainingDetail.department | No | text |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Arrondissement | VT1_6 (`vocationalTraining.subdivision`) | OnefopVocationalTrainingDetail.subdivision | No | text |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Commune | VT1_7 (`vocationalTraining.commune`) | OnefopVocationalTrainingDetail.commune | No | text |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Village-Quartier | VT1_8 (`vocationalTraining.locality`) | OnefopVocationalTrainingDetail.locality | No | text |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Milieu d'implantation | VT1_9 (`vocationalTraining.area`) | OnefopVocationalTrainingDetail.area | No | radio · 2 options |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Statut de l'établissement | VT1_10 (`vocationalTraining.educationSystem`) | OnefopVocationalTrainingDetail.educationSystem | No | radio · 3 options |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Type de CFP | VT1_11 (`vocationalTraining.cfpType`) | OnefopVocationalTrainingDetail.cfpType | No | radio · 7 options |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Situation du Centre de formation | VT1_12 (`vocationalTraining.functionalStatus`) | OnefopVocationalTrainingDetail.functionalStatus | No | radio · 3 options |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Si « Non-fonctionnelle », préciser la raison | VT1_13 (`vocationalTraining.nonFunctionalReason`) | OnefopVocationalTrainingDetail.nonFunctionalReason | No | radio · 5 options; shown if VT1_12 = "Non-fonctionnelle/ Non-functional" |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Précisez | VT1_13_OTHER (`vocationalTraining.nonFunctionalReasonOther`) | OnefopVocationalTrainingDetail.nonFunctionalReasonOther | No | text; shown if VT1_13 = "Autres/ Others" |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Année d'ouverture | VT1_14 (`vocationalTraining.yearOfEstablishment`) | OnefopVocationalTrainingDetail.yearOfEstablishment | No | number |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Noms et prénoms | VT1_15_NAME (`respondent.name`) | OnefopRespondent.respondentName | No | text; sub-section: 1.15 Informations sur le répondant |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Qualité du répondant | VT1_15_FUNCTION (`respondent.function`) | OnefopRespondent.respondentFunction | No | text |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | WhatsApp | VT1_15_TEL1 (`respondent.phone1`) | OnefopRespondent.phone1 | No | tel |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Téléphone 2 | VT1_15_TEL2 (`respondent.phone2`) | OnefopRespondent.phone2 | No | tel |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | E-mail | VT1_15_EMAIL (`respondent.email`) | OnefopRespondent.email | No | email |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Sexe | VT1_15_SEX (`vocationalTraining.respondentSex`) | OnefopVocationalTrainingDetail.respondentSex | No | radio · 2 options |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Noms et prénoms | VT1_16_NAME (`vocationalTraining.promoterName`) | OnefopVocationalTrainingDetail.promoterName | No | text; sub-section: 1.16 Noms et contacts du Promoteur/Directeur du CFP |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Sexe | VT1_16_SEX (`vocationalTraining.promoterSex`) | OnefopVocationalTrainingDetail.promoterSex | No | radio · 2 options |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | WhatsApp | VT1_16_TEL1 (`vocationalTraining.promoterPhone1`) | OnefopVocationalTrainingDetail.promoterPhone1 | No | tel |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | Téléphone 2 | VT1_16_TEL2 (`vocationalTraining.promoterPhone2`) | OnefopVocationalTrainingDetail.promoterPhone2 | No | tel |
| vocationalTraining | SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE | E-mail | VT1_16_EMAIL (`vocationalTraining.promoterEmail`) | OnefopVocationalTrainingDetail.promoterEmail | No | email |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Votre structure dispose-t-elle d'une convention avec l'Etat ? | VT2_1 (`vocationalTraining.hasStateAgreement`) | OnefopVocationalTrainingDetail.hasStateAgreement | No | radio · 2 options; sub-section: 2.1 Renseignements généraux |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Si oui, précisez le(s) type(s) de convention | VT2_2 (`vocationalTraining.agreementTypes`) | OnefopVocationalTrainingDetail.agreementTypes | No | checkbox · 4 options; shown if VT2_1 = "Oui/ Yes" |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Nombre de sites occupés par votre structure | VT2_3 (`vocationalTraining.siteCount`) | OnefopVocationalTrainingDetail.siteCount | No | number |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Votre centre de formation professionnelle utilise-t-il des infrastructures en commun avec un autre établissem… | VT2_4 (`vocationalTraining.sharesInfrastructure`) | OnefopVocationalTrainingDetail.sharesInfrastructure | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Si oui, indiquez le nom de l'établissement partagé | VT2_5 (`vocationalTraining.sharedWithSchoolName`) | OnefopVocationalTrainingDetail.sharedWithSchoolName | No | text; shown if VT2_4 = "Oui/ Yes" |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Avez-vous des formateurs ayant reçu une formation pour accueillir les enfants à besoins éducatifs spéciaux ? | VT2_6 (`vocationalTraining.hasSpecialNeedsTrainers`) | OnefopVocationalTrainingDetail.hasSpecialNeedsTrainers | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Si oui, précisez l'effectif de ces formateurs (Total) | VT2_7 (`vocationalTraining.specialNeedsTrainerTotal`) | OnefopVocationalTrainingDetail.specialNeedsTrainerTotal | No | number; shown if VT2_6 = "Oui/ Yes" |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | dont femmes | VT2_8 (`vocationalTraining.specialNeedsTrainerFemale`) | OnefopVocationalTrainingDetail.specialNeedsTrainerFemale | No | number; shown if VT2_6 = "Oui/ Yes" |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Le centre dispose-t-il de rampes d'accès pour accueillir les enfants à motricité reduite ? | VT2_9 (`vocationalTraining.hasAccessRamps`) | OnefopVocationalTrainingDetail.hasAccessRamps | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Existe-t-il un bureau pour le directeur dans votre centre ? | VT2_10 (`vocationalTraining.hasDirectorOffice`) | OnefopVocationalTrainingDetail.hasDirectorOffice | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Boîte postale | VT2_11 (`vocationalTraining.poBox`) | OnefopVocationalTrainingDetail.poBox | No | text |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Email | VT2_12 (`vocationalTraining.email`) | OnefopVocationalTrainingDetail.email | No | email |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Site Web | VT2_13 (`vocationalTraining.website`) | OnefopVocationalTrainingDetail.website | No | text |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Êtes-vous agréé? | VT2_14 (`vocationalTraining.isAccredited`) | OnefopVocationalTrainingDetail.isAccredited | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Si oui, année du dernier agrément | VT2_15 (`vocationalTraining.lastAccreditationYear`) | OnefopVocationalTrainingDetail.lastAccreditationYear | No | number; shown if VT2_14 = "Oui/ Yes"; **reference number/date** |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Arrêté n° | VT2_16 (`vocationalTraining.accreditationOrderNumber`) | OnefopVocationalTrainingDetail.accreditationOrderNumber | No | text; shown if VT2_14 = "Oui/ Yes"; **reference number/date** |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Date de l'arrêté d'accréditation | VT2_17 (`vocationalTraining.accreditationOrderDate`) | OnefopVocationalTrainingDetail.accreditationOrderDate | No | text; shown if VT2_14 = "Oui/ Yes"; **reference number/date** |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Quels types de formation votre centre dispense-t-il ? | VT2_18 (`vocationalTraining.trainingTypesOffered`) | OnefopVocationalTrainingDetail.trainingTypesOffered | No | checkbox · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Nombre total d'apprenants dans votre centre | VT2_19 (`vocationalTraining.totalTraineesDeclared`) | OnefopVocationalTrainingDetail.totalTraineesDeclared | No | number |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Nombre total de formateurs dans votre centre | VT2_20 (`vocationalTraining.totalTrainersDeclared`) | OnefopVocationalTrainingDetail.totalTrainersDeclared | No | number |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Nombre total d'apprenants venant du premier cycle du secondaire | VT2_21 (`vocationalTraining.traineesFromLowerSecondary`) | OnefopVocationalTrainingDetail.traineesFromLowerSecondary | No | number |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Nombre total d'apprenants venant du second cycle du secondaire | VT2_22 (`vocationalTraining.traineesFromUpperSecondary`) | OnefopVocationalTrainingDetail.traineesFromUpperSecondary | No | number |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Le centre dispose-t-il d'une source d'énergie ? | VT2_23 (`vocationalTraining.hasEnergySource`) | OnefopVocationalTrainingDetail.hasEnergySource | No | radio · 2 options; sub-section: 2.2 Informations sur les autres équipements et commodités d… |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Si oui, cette source d'énergie est-elle fonctionnelle ? | VT2_24 (`vocationalTraining.isEnergySourceFunctional`) | OnefopVocationalTrainingDetail.isEnergySourceFunctional | No | radio · 2 options; shown if VT2_23 = "Oui/ Yes" |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Si oui, précisez la source d'énergie | VT2_25 (`vocationalTraining.energySourceTypes`) | OnefopVocationalTrainingDetail.energySourceTypes | No | checkbox · 3 options; shown if VT2_23 = "Oui/ Yes" |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Le centre dispose-t-il d'une source d'approvisionnement en eau ? | VT2_26 (`vocationalTraining.hasWaterSource`) | OnefopVocationalTrainingDetail.hasWaterSource | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Si oui, précisez le type d'approvisionnement | VT2_27 (`vocationalTraining.waterSourceTypes`) | OnefopVocationalTrainingDetail.waterSourceTypes | No | checkbox · 5 options; shown if VT2_26 = "Oui/ Yes" |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Le centre a-t-il un dispositif fonctionnel de lavage des mains ? | VT2_28 (`vocationalTraining.hasHandwashingDevice`) | OnefopVocationalTrainingDetail.hasHandwashingDevice | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Le centre a-t-il reçu une campagne de santé ? | VT2_29 (`vocationalTraining.hasReceivedHealthCampaign`) | OnefopVocationalTrainingDetail.hasReceivedHealthCampaign | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Y a-t-il une boîte à pharmacie dans Le centre avec des produits de premiers soins ? | VT2_30 (`vocationalTraining.hasFirstAidBox`) | OnefopVocationalTrainingDetail.hasFirstAidBox | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Votre centre dispose-t-il d'une infirmerie ? | VT2_31 (`vocationalTraining.hasDispensary`) | OnefopVocationalTrainingDetail.hasDispensary | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Le centre dispose-t-il d'une bibliothèque fonctionnelle ? | VT2_32 (`vocationalTraining.hasFunctionalLibrary`) | OnefopVocationalTrainingDetail.hasFunctionalLibrary | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Le centre de formation est-il limité par une clôture ? | VT2_33 (`vocationalTraining.fenceStatus`) | OnefopVocationalTrainingDetail.fenceStatus | No | radio · 3 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Existe-t-il un conseil d'établissement fonctionnel ? | VT2_34 (`vocationalTraining.hasSchoolCouncil`) | OnefopVocationalTrainingDetail.hasSchoolCouncil | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Existe-t-il un conseil de niveau au sein de votre etablissement ? | VT2_35 (`vocationalTraining.hasLevelCouncil`) | OnefopVocationalTrainingDetail.hasLevelCouncil | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Existe-t-il un conseil de discipline au sein de votre etablissement ? | VT2_36 (`vocationalTraining.hasDisciplinaryCouncil`) | OnefopVocationalTrainingDetail.hasDisciplinaryCouncil | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Le centre de formation a-t-il des latrines fonctionnelles et adaptées ? | VT2_37 (`vocationalTraining.hasFunctionalLatrines`) | OnefopVocationalTrainingDetail.hasFunctionalLatrines | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Si oui, précisez le type de latrines | VT2_38 (`vocationalTraining.latrineTypes`) | OnefopVocationalTrainingDetail.latrineTypes | No | checkbox · 3 options; shown if VT2_37 = "Oui/ Yes" |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Si oui, les latrines des filles sont-elles dans un bloc différent de celui des garçons ? | VT2_39 (`vocationalTraining.latrinesSeparateByGender`) | OnefopVocationalTrainingDetail.latrinesSeparateByGender | No | radio · 2 options; shown if VT2_37 = "Oui/ Yes" |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Si oui, les latrines des élèves sont-elles séparées de celles des formateurs ? | VT2_40 (`vocationalTraining.latrinesSeparateFromStaff`) | OnefopVocationalTrainingDetail.latrinesSeparateFromStaff | No | radio · 2 options; shown if VT2_37 = "Oui/ Yes" |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Le centre de formation dispose-t-il d'aires de jeux ? | VT2_41 (`vocationalTraining.hasPlayground`) | OnefopVocationalTrainingDetail.hasPlayground | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Si oui, sélectionnez le(s) type(s) d'infrastructure de jeux | VT2_42 (`vocationalTraining.playgroundTypes`) | OnefopVocationalTrainingDetail.playgroundTypes | No | checkbox · 5 options; shown if VT2_41 = "Oui/ Yes" |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Votre centre de formation dispose-t-il d'outils informatiques (ordinateurs ou tablettes)? | VT2_43 (`vocationalTraining.hasIctTools`) | OnefopVocationalTrainingDetail.hasIctTools | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Si oui, précisez le nombre d'outils informatiques (ordinateurs ou tablettes) mis à la disposition des formate… | VT2_44 (`vocationalTraining.ictToolsForTrainersCount`) | OnefopVocationalTrainingDetail.ictToolsForTrainersCount | No | number; shown if VT2_43 = "Oui/ Yes" |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Votre centre de formation a-t-il un accès à internet ? | VT2_45 (`vocationalTraining.ictToolsInternetCount`) | OnefopVocationalTrainingDetail.ictToolsInternetCount | No | number; shown if VT2_43 = "Oui/ Yes" |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Les formateurs de votre centre ont-ils reçu une formation sur les TIC ? | VT2_46 (`vocationalTraining.trainersIctTrained`) | OnefopVocationalTrainingDetail.trainersIctTrained | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Si oui, précisez le nombre de formateurs formés (Total) | VT2_47 (`vocationalTraining.trainersIctTrainedTotal`) | OnefopVocationalTrainingDetail.trainersIctTrainedTotal | No | number; shown if VT2_46 = "Oui/ Yes" |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | dont femmes | VT2_48 (`vocationalTraining.trainersIctTrainedFemale`) | OnefopVocationalTrainingDetail.trainersIctTrainedFemale | No | number; shown if VT2_46 = "Oui/ Yes" |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Les formateurs ont-ils reçu une session de formation sur la lutte contre les violences en milieu scolaire ? | VT2_49 (`vocationalTraining.trainersViolenceTraining`) | OnefopVocationalTrainingDetail.trainersViolenceTraining | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Les formateurs de votre centre ont-ils reçu des sessions de formation PSS (Appui psychosocial) pour le soutie… | VT2_50 (`vocationalTraining.trainersPssTraining`) | OnefopVocationalTrainingDetail.trainersPssTraining | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Votre centre dispose-t-il d'un internat ? | VT2_51 (`vocationalTraining.hasBoarding`) | OnefopVocationalTrainingDetail.hasBoarding | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Votre centre dispose-t-il d'un dispositif de lutte contre les Violences Basées sur le genre (VBG) ? | VT2_52 (`vocationalTraining.hasGbvMechanism`) | OnefopVocationalTrainingDetail.hasGbvMechanism | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Votre centre dispose-t-il d'une cantine scolaire ? | VT2_53 (`vocationalTraining.hasCanteen`) | OnefopVocationalTrainingDetail.hasCanteen | No | radio · 2 options |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Nombre total de cabines | VT2_54 (`vocationalTraining.latrineCabinTotalCount`) | OnefopVocationalTrainingDetail.latrineCabinTotalCount | No | number; shown if VT2_37 = "Oui/ Yes" |
| vocationalTraining | SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT | Cabines réservées aux filles | VT2_55 (`vocationalTraining.latrineCabinGirlsCount`) | OnefopVocationalTrainingDetail.latrineCabinGirlsCount | No | number; shown if VT2_37 = "Oui/ Yes" |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Le centre a-t-il fait face à une situation de crise au cours de l'année ? | VT3_1 (`vocationalTraining.facedCrisis`) | OnefopVocationalTrainingDetail.facedCrisis | No | radio · 2 options |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Quels sont les types de crise ? | VT3_2 (`vocationalTraining.crisisTypes`) | OnefopVocationalTrainingDetail.crisisTypes | No | checkbox · 10 options; shown if VT3_1 = "Oui/ Yes" |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Si oui, cette crise a-t-elle entrainé la fermeture provisoire de votre centre ? | VT3_3 (`vocationalTraining.crisisClosedCenter`) | OnefopVocationalTrainingDetail.crisisClosedCenter | No | radio · 2 options; shown if VT3_1 = "Oui/ Yes" |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Si oui, indiquez le temps de fermeture (en semaines) | VT3_4 (`vocationalTraining.closureDurationWeeks`) | OnefopVocationalTrainingDetail.closureDurationWeeks | No | number; shown if VT3_3 = "Oui/ Yes" |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Le site de l'établissement est-il déplacé suite à la survenue de cette crise? | VT3_5 (`vocationalTraining.siteRelocated`) | OnefopVocationalTrainingDetail.siteRelocated | No | radio · 2 options; shown if VT3_1 = "Oui/ Yes" |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Si oui, précisez la localité de déplacement (ou le nom de l'établissement qui l'abrite) | VT3_6 (`vocationalTraining.relocationLocality`) | OnefopVocationalTrainingDetail.relocationLocality | No | text; shown if VT3_5 = "Oui/ Yes" |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Les apprenants ont-ils été réaffectés dans d'autres établissements ? | VT3_7 (`vocationalTraining.traineesReassigned`) | OnefopVocationalTrainingDetail.traineesReassigned | No | radio · 2 options; shown if VT3_1 = "Oui/ Yes" |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Si oui, précisez lesquels | VT3_8 (`vocationalTraining.reassignedTo`) | OnefopVocationalTrainingDetail.reassignedTo | No | text; shown if VT3_7 = "Oui/ Yes" |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Le centre dispose-t-il un dispositif d'alerte précoce d'urgence ? | VT3_9 (`vocationalTraining.hasEarlyWarningSystem`) | OnefopVocationalTrainingDetail.hasEarlyWarningSystem | No | radio · 2 options |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Si oui, donnez le nom ou une description de ce dispositif | VT3_10 (`vocationalTraining.earlyWarningDescription`) | OnefopVocationalTrainingDetail.earlyWarningDescription | No | textarea; shown if VT3_9 = "Oui/ Yes" |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Si oui, ce dispositif est-il toujours à jour et fonctionnel ? | VT3_11 (`vocationalTraining.earlyWarningFunctional`) | OnefopVocationalTrainingDetail.earlyWarningFunctional | No | radio · 2 options; shown if VT3_9 = "Oui/ Yes" |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Les formateurs de votre centre sont-ils formés aux approches pédagogiques innovantes ? | VT3_12 (`vocationalTraining.trainersInnovativePedagogyTrained`) | OnefopVocationalTrainingDetail.trainersInnovativePedagogyTrained | No | radio · 2 options |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Si oui, dont hommes | VT3_13 (`vocationalTraining.trainersInnovativePedagogyMale`) | OnefopVocationalTrainingDetail.trainersInnovativePedagogyMale | No | number; shown if VT3_12 = "Oui/ Yes" |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | dont femmes | VT3_14 (`vocationalTraining.trainersInnovativePedagogyFemale`) | OnefopVocationalTrainingDetail.trainersInnovativePedagogyFemale | No | number; shown if VT3_12 = "Oui/ Yes" |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Les formateurs de votre centre sont-ils formés aux Approches pédagogiques adaptées aux crises (classe multi-n… | VT3_15 (`vocationalTraining.trainersCrisisPedagogyTrained`) | OnefopVocationalTrainingDetail.trainersCrisisPedagogyTrained | No | radio · 2 options |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Si oui, dont hommes | VT3_16 (`vocationalTraining.trainersCrisisPedagogyMale`) | OnefopVocationalTrainingDetail.trainersCrisisPedagogyMale | No | number; shown if VT3_15 = "Oui/ Yes" |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | dont femmes | VT3_17 (`vocationalTraining.trainersCrisisPedagogyFemale`) | OnefopVocationalTrainingDetail.trainersCrisisPedagogyFemale | No | number; shown if VT3_15 = "Oui/ Yes" |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Les formateurs de votre établissement sont-ils formés sur la réduction et gestion des risques de catastrophe | VT3_18 (`vocationalTraining.trainersDrrmTrained`) | OnefopVocationalTrainingDetail.trainersDrrmTrained | No | radio · 2 options |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Si oui, dont hommes | VT3_19 (`vocationalTraining.trainersDrrmMale`) | OnefopVocationalTrainingDetail.trainersDrrmMale | No | number; shown if VT3_18 = "Oui/ Yes" |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | dont femmes | VT3_20 (`vocationalTraining.trainersDrrmFemale`) | OnefopVocationalTrainingDetail.trainersDrrmFemale | No | number; shown if VT3_18 = "Oui/ Yes" |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Les formateurs de votre établissement sont-ils formés sur la réalisation des simulations et exercices pratiqu… | VT3_21 (`vocationalTraining.trainersEvacuationDrillTrained`) | OnefopVocationalTrainingDetail.trainersEvacuationDrillTrained | No | radio · 2 options |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Si oui, dont hommes | VT3_22 (`vocationalTraining.trainersEvacuationDrillMale`) | OnefopVocationalTrainingDetail.trainersEvacuationDrillMale | No | number; shown if VT3_21 = "Oui/ Yes" |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | dont femmes | VT3_23 (`vocationalTraining.trainersEvacuationDrillFemale`) | OnefopVocationalTrainingDetail.trainersEvacuationDrillFemale | No | number; shown if VT3_21 = "Oui/ Yes" |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Les formateurs de votre établissement sont-ils formés sur d'autres aspect d'éducation en situation d'urgence | VT3_24 (`vocationalTraining.trainersOtherEmergencyTrained`) | OnefopVocationalTrainingDetail.trainersOtherEmergencyTrained | No | radio · 2 options |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Si oui, dont hommes | VT3_25 (`vocationalTraining.trainersOtherEmergencyMale`) | OnefopVocationalTrainingDetail.trainersOtherEmergencyMale | No | number; shown if VT3_24 = "Oui/ Yes" |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | dont femmes | VT3_26 (`vocationalTraining.trainersOtherEmergencyFemale`) | OnefopVocationalTrainingDetail.trainersOtherEmergencyFemale | No | number; shown if VT3_24 = "Oui/ Yes" |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Sécurisation des dossiers des apprenants? | VT3_27 (`vocationalTraining.hasStudentRecordsSecurity`) | OnefopVocationalTrainingDetail.hasStudentRecordsSecurity | No | radio · 2 options |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Sécurisation des manuels scolaires ? | VT3_28 (`vocationalTraining.hasTextbookSecurity`) | OnefopVocationalTrainingDetail.hasTextbookSecurity | No | radio · 2 options |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Le Centre dispose-t-il d'un plan de préparation ou de contingence ? | VT3_29 (`vocationalTraining.hasContingencyPlan`) | OnefopVocationalTrainingDetail.hasContingencyPlan | No | radio · 2 options |
| vocationalTraining | SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE | Les apprenants de votre Centre ont-ils été formés aux mesures de protection en cas d'attaque ? | VT3_30 (`vocationalTraining.traineesTrainedOnProtection`) | OnefopVocationalTrainingDetail.traineesTrainedOnProtection | No | radio · 2 options |
| vocationalTraining | SECTION 4. INFORMATIONS SUR LES APPRENANTS | Effectifs des apprenants par diplôme académique le plus élevé | VT4_1 (`section4_vocationalTraining.VT4_1`) | OnefopVtDiplomaData | No | table · vt_diploma_table; sub-section: 4.1 Effectifs des apprenants par diplôme académique le plus… |
| vocationalTraining | SECTION 4. INFORMATIONS SUR LES APPRENANTS | Apprenants par diplôme professionnel le plus élevé | VT4_2 (`section4_vocationalTraining.VT4_2`) | OnefopVtDiplomaData | No | table · vt_diploma_table; sub-section: 4.2 Apprenants par diplôme professionnel le plus élevé |
| vocationalTraining | SECTION 4. INFORMATIONS SUR LES APPRENANTS | Effectifs des apprenants en âge de travailler non occupés et qualifiés par spécialités et type de formation | VT4_3 (`vocationalTraining.specialtyRows_4_3`) | OnefopVtSpecialtyRow | No | repeating_table · vt_specialty_fi_fc_table; sub-section: 4.3 Effectifs des apprenants en âge de travailler non occup… |
| vocationalTraining | SECTION 4. INFORMATIONS SUR LES APPRENANTS | Effectifs des apprenants par spécialités et type de formation travaillant dans le secteur informel | VT4_4 (`vocationalTraining.specialtyRows_4_4`) | OnefopVtSpecialtyRow | No | repeating_table · vt_specialty_fi_fc_table; sub-section: 4.4 Effectifs des apprenants par spécialités et type de for… |
| vocationalTraining | SECTION 4. INFORMATIONS SUR LES APPRENANTS | Effectifs des apprenants par spécialités et type de formation | VT4_5 (`vocationalTraining.specialtyRows_4_5`) | OnefopVtSpecialtyRow | No | repeating_table · vt_specialty_fi_fc_table; sub-section: 4.5 Effectifs des apprenants par spécialités et type de for… |
| vocationalTraining | SECTION 4. INFORMATIONS SUR LES APPRENANTS | Effectifs des apprenants par année d'études (pour la formation Initiale) et par sexe | VT4_6 (`vocationalTraining.specialtyRows_4_6`) | OnefopVtSpecialtyRow | No | repeating_table · vt_specialty_year_table; sub-section: 4.6 Effectifs des apprenants par année d'études (pour la fo… |
| vocationalTraining | SECTION 4. INFORMATIONS SUR LES APPRENANTS | Effectifs des apprenants par âge | VT4_7 (`section4_vocationalTraining.VT4_7`) | OnefopVtTraineeAgeFlow | No | table · vt_trainee_age_flow_table; sub-section: 4.7 Effectifs des apprenants par âge |
| vocationalTraining | SECTION 4. INFORMATIONS SUR LES APPRENANTS | Effectifs des entrants, des sortants et abandons par Niveau d'études à l'entrée | VT4_8 (`section4_vocationalTraining.VT4_8`) | OnefopVtEducationLevelFlow | No | table · vt_education_level_flow_table; sub-section: 4.8 Effectifs des entrants, des sortants et abandons par Ni… |
| vocationalTraining | SECTION 4. INFORMATIONS SUR LES APPRENANTS | Effectifs des personnes socialement vulnérables par sexe | VT4_9 (`section4_vocationalTraining.VT4_9`) | OnefopVtTraineeVulnerable | No | table · vt_vulnerable_table; sub-section: 4.9 Effectifs des personnes socialement vulnérables par sexe |
| vocationalTraining | SECTION 4. INFORMATIONS SUR LES APPRENANTS | Effectifs des sortants par spécialités et selon le sexe pour l'année antérieur (2024-2025) | VT4_10 (`vocationalTraining.specialtyRows_4_10`) | OnefopVtSpecialtyRow | No | repeating_table · vt_specialty_gender_total_table; sub-section: 4.10 Effectifs des sortants par spécialités et selon le sex… |
| vocationalTraining | SECTION 4. INFORMATIONS SUR LES APPRENANTS | Effectifs des apprenants par types de bourse et selon le sexe | VT4_11 (`section4_vocationalTraining.VT4_11`) | OnefopVtScholarship | No | table · vt_scholarship_table; sub-section: 4.11 Effectifs des apprenants par types de bourse et selon … |
| vocationalTraining | SECTION 5. INFORMATIONS SUR LES MANUELS D'APPRENTISSAGE, EQUIPEMENTS ET INFRASTRUCTURES | Des manuels d'apprentissage pour apprenant ? | VT5_1 (`vocationalTraining.hasTraineeStudyGuides`) | OnefopVocationalTrainingDetail.hasTraineeStudyGuides | No | radio · 2 options; sub-section: 5.1 Manuels d'apprentissage pour l'année en cours |
| vocationalTraining | SECTION 5. INFORMATIONS SUR LES MANUELS D'APPRENTISSAGE, EQUIPEMENTS ET INFRASTRUCTURES | Si oui, précisez le nombre de manuels d'apprentissage pour apprenants | VT5_2 (`vocationalTraining.traineeStudyGuideCount`) | OnefopVocationalTrainingDetail.traineeStudyGuideCount | No | number; shown if VT5_1 = "Oui/ Yes"; sub-section: 5.1 Manuels d'apprentissage pour l'année en cours |
| vocationalTraining | SECTION 5. INFORMATIONS SUR LES MANUELS D'APPRENTISSAGE, EQUIPEMENTS ET INFRASTRUCTURES | Des manuels d'apprentissage pour formateurs ? | VT5_3 (`vocationalTraining.hasTrainerStudyGuides`) | OnefopVocationalTrainingDetail.hasTrainerStudyGuides | No | radio · 2 options; sub-section: 5.1 Manuels d'apprentissage pour l'année en cours |
| vocationalTraining | SECTION 5. INFORMATIONS SUR LES MANUELS D'APPRENTISSAGE, EQUIPEMENTS ET INFRASTRUCTURES | Si oui, précisez le nombre de manuels d'apprentissage pour formateurs | VT5_4 (`vocationalTraining.trainerStudyGuideCount`) | OnefopVocationalTrainingDetail.trainerStudyGuideCount | No | number; shown if VT5_3 = "Oui/ Yes"; sub-section: 5.1 Manuels d'apprentissage pour l'année en cours |
| vocationalTraining | SECTION 5. INFORMATIONS SUR LES MANUELS D'APPRENTISSAGE, EQUIPEMENTS ET INFRASTRUCTURES | Référentiel de formation | VT5_5 (`vocationalTraining.curriculum`) | OnefopVtCurriculum | No | repeating_table · vt_curriculum_table; sub-section: 5.2 Référentiel de formation |
| vocationalTraining | SECTION 5. INFORMATIONS SUR LES MANUELS D'APPRENTISSAGE, EQUIPEMENTS ET INFRASTRUCTURES | Nombre d'infrastructures en fonction de leur état | VT5_6 (`section5_vocationalTraining.VT5_6`) | OnefopVtInfrastructure | No | table · vt_infrastructure_table; sub-section: 5.3 Nombre d'infrastructures selon leur état |
| vocationalTraining | SECTION 5. INFORMATIONS SUR LES MANUELS D'APPRENTISSAGE, EQUIPEMENTS ET INFRASTRUCTURES | Equipements mobiliers | VT5_7 (`section5_vocationalTraining.VT5_7`) | OnefopVtFurniture | No | table · vt_furniture_table; sub-section: 5.4 Equipements mobiliers |
| vocationalTraining | SECTION 6. ORIENTATION PROFESSIONNELLE ET INFORMATIONS SUR LE SUIVI POST-FORMATION DES SORTANTS DES CENTRES DE FORMATION PROFESSIONNELLES DU MINEFOP | Existe-t-il un service d'orientation professionnelle dans votre centre ? | VT6_1 (`vocationalTraining.hasCareerGuidanceService`) | OnefopVocationalTrainingDetail.hasCareerGuidanceService | No | radio · 2 options; sub-section: 6.1 Orientation professionnelle dans les centres de formati… |
| vocationalTraining | SECTION 6. ORIENTATION PROFESSIONNELLE ET INFORMATIONS SUR LE SUIVI POST-FORMATION DES SORTANTS DES CENTRES DE FORMATION PROFESSIONNELLES DU MINEFOP | Si oui, comment prenez-vous en compte l'orientation professionnelle dans votre dispositif de formation profes… | VT6_2 (`vocationalTraining.careerGuidanceTimings`) | OnefopVocationalTrainingDetail.careerGuidanceTimings | No | checkbox · 3 options; shown if VT6_1 = "Oui/ Yes" |
| vocationalTraining | SECTION 6. ORIENTATION PROFESSIONNELLE ET INFORMATIONS SUR LE SUIVI POST-FORMATION DES SORTANTS DES CENTRES DE FORMATION PROFESSIONNELLES DU MINEFOP | Les apprenants choisissent-ils les filières de formation avec l'accompagnement de ce service ? | VT6_3 (`vocationalTraining.traineesChooseWithSupport`) | OnefopVocationalTrainingDetail.traineesChooseWithSupport | No | radio · 2 options |
| vocationalTraining | SECTION 6. ORIENTATION PROFESSIONNELLE ET INFORMATIONS SUR LE SUIVI POST-FORMATION DES SORTANTS DES CENTRES DE FORMATION PROFESSIONNELLES DU MINEFOP | Sinon, collaborez-vous avec les structures publiques d'orientation existante à l'exemple du CIOP ? | VT6_4 (`vocationalTraining.collaboratesWithCiopCosup`) | OnefopVocationalTrainingDetail.collaboratesWithCiopCosup | No | radio · 2 options; shown if VT6_3 = "Non/ No" |
| vocationalTraining | SECTION 6. ORIENTATION PROFESSIONNELLE ET INFORMATIONS SUR LE SUIVI POST-FORMATION DES SORTANTS DES CENTRES DE FORMATION PROFESSIONNELLES DU MINEFOP | Quel accompagnement le service d'orientation assure aux apprenants ? | VT6_5 (`vocationalTraining.guidanceSupportTypes`) | OnefopVocationalTrainingDetail.guidanceSupportTypes | No | checkbox · 5 options |
| vocationalTraining | SECTION 6. ORIENTATION PROFESSIONNELLE ET INFORMATIONS SUR LE SUIVI POST-FORMATION DES SORTANTS DES CENTRES DE FORMATION PROFESSIONNELLES DU MINEFOP | Autre, précisez | VT6_6 (`vocationalTraining.guidanceSupportOther`) | OnefopVocationalTrainingDetail.guidanceSupportOther | No | text; shown if VT6_5 = "Autres/ Others" |
| vocationalTraining | SECTION 6. ORIENTATION PROFESSIONNELLE ET INFORMATIONS SUR LE SUIVI POST-FORMATION DES SORTANTS DES CENTRES DE FORMATION PROFESSIONNELLES DU MINEFOP | Effectuez-vous le suivi post-formation des apprenants de votre établissement? | VT6_7 (`vocationalTraining.hasPostTrainingFollowUp`) | OnefopVocationalTrainingDetail.hasPostTrainingFollowUp | No | radio · 2 options; sub-section: 6.2 Informations sur le suivi post-formation des sortants d… |
| vocationalTraining | SECTION 6. ORIENTATION PROFESSIONNELLE ET INFORMATIONS SUR LE SUIVI POST-FORMATION DES SORTANTS DES CENTRES DE FORMATION PROFESSIONNELLES DU MINEFOP | Si oui, par quels mécanismes ? | VT6_8 (`vocationalTraining.followUpMechanisms`) | OnefopVocationalTrainingDetail.followUpMechanisms | No | checkbox · 4 options; shown if VT6_7 = "Oui/ Yes" |
| vocationalTraining | SECTION 6. ORIENTATION PROFESSIONNELLE ET INFORMATIONS SUR LE SUIVI POST-FORMATION DES SORTANTS DES CENTRES DE FORMATION PROFESSIONNELLES DU MINEFOP | Autre, précisez | VT6_9 (`vocationalTraining.followUpMechanismOther`) | OnefopVocationalTrainingDetail.followUpMechanismOther | No | text; shown if VT6_8 = "Autres/ Others" |
| vocationalTraining | SECTION 6. ORIENTATION PROFESSIONNELLE ET INFORMATIONS SUR LE SUIVI POST-FORMATION DES SORTANTS DES CENTRES DE FORMATION PROFESSIONNELLES DU MINEFOP | Existe-t-il une cellule d'appui à l'insertion des sortants dans votre centre ? | VT6_10 (`vocationalTraining.hasInsertionSupportUnit`) | OnefopVocationalTrainingDetail.hasInsertionSupportUnit | No | radio · 2 options |
| vocationalTraining | SECTION 6. ORIENTATION PROFESSIONNELLE ET INFORMATIONS SUR LE SUIVI POST-FORMATION DES SORTANTS DES CENTRES DE FORMATION PROFESSIONNELLES DU MINEFOP | Existe-t-il un outil de gestion de la base de données des apprenants et sortants dans votre centre ? | VT6_11 (`vocationalTraining.hasTraineeDatabaseTool`) | OnefopVocationalTrainingDetail.hasTraineeDatabaseTool | No | radio · 2 options |
| vocationalTraining | SECTION 6. ORIENTATION PROFESSIONNELLE ET INFORMATIONS SUR LE SUIVI POST-FORMATION DES SORTANTS DES CENTRES DE FORMATION PROFESSIONNELLES DU MINEFOP | Existe-t-il dans votre centre un outil d'accompagnement des sortants dans la recherche d'emploi, la création … | VT6_12 (`vocationalTraining.hasJobSearchSupportTool`) | OnefopVocationalTrainingDetail.hasJobSearchSupportTool | No | radio · 2 options |
| vocationalTraining | SECTION 6. ORIENTATION PROFESSIONNELLE ET INFORMATIONS SUR LE SUIVI POST-FORMATION DES SORTANTS DES CENTRES DE FORMATION PROFESSIONNELLES DU MINEFOP | Effectifs des sortants insérés par spécialités et selon le sexe pour l'année antérieur (2024-2025) | VT6_13 (`vocationalTraining.specialtyRows_6_3`) | OnefopVtSpecialtyRow | No | repeating_table · vt_specialty_gender_total_table; sub-section: 6.3 Sortants insérés par spécialité |
| vocationalTraining | SECTION 6. ORIENTATION PROFESSIONNELLE ET INFORMATIONS SUR LE SUIVI POST-FORMATION DES SORTANTS DES CENTRES DE FORMATION PROFESSIONNELLES DU MINEFOP | Effectif inséré dans l'emploi formel | VT6_14 (`vocationalTraining.insertedFormalSectorCount`) | OnefopVocationalTrainingDetail.insertedFormalSectorCount | No | number; sub-section: 6.4 Suivi de l'insertion des diplômés (année antérieure) |
| vocationalTraining | SECTION 6. ORIENTATION PROFESSIONNELLE ET INFORMATIONS SUR LE SUIVI POST-FORMATION DES SORTANTS DES CENTRES DE FORMATION PROFESSIONNELLES DU MINEFOP | Effectif inséré dans l'emploi informel / auto-emploi | VT6_15 (`vocationalTraining.insertedInformalSectorCount`) | OnefopVocationalTrainingDetail.insertedInformalSectorCount | No | number; sub-section: 6.4 Suivi de l'insertion des diplômés (année antérieure) |
| vocationalTraining | SECTION 6. ORIENTATION PROFESSIONNELLE ET INFORMATIONS SUR LE SUIVI POST-FORMATION DES SORTANTS DES CENTRES DE FORMATION PROFESSIONNELLES DU MINEFOP | Effectif en recherche d'emploi | VT6_16 (`vocationalTraining.seekingEmploymentCount`) | OnefopVocationalTrainingDetail.seekingEmploymentCount | No | number; sub-section: 6.4 Suivi de l'insertion des diplômés (année antérieure) |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | Votre établissement a t'il intégré dans son règlement intérieur des directives en lien avec le VIH et le SIDA… | VT7_1 (`vocationalTraining.hasHivAidsRules`) | OnefopVocationalTrainingDetail.hasHivAidsRules | No | radio · 2 options |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | Le règlement couvre-t-il la sécurité physique au sein de l'établissement ? | VT7_2 (`vocationalTraining.hivRulesCoverSafety`) | OnefopVocationalTrainingDetail.hivRulesCoverSafety | No | radio · 2 options; shown if VT7_1 = "Oui/ Yes"; sub-section: 7.1.1 Si oui, ces directives couvrent-elles les aspects sui… |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | Le règlement couvre-t-il la stigmatisation et la discrimination à l'égard du personnel et des élèves vivant a… | VT7_3 (`vocationalTraining.hivRulesCoverStigmaHiv`) | OnefopVocationalTrainingDetail.hivRulesCoverStigmaHiv | No | radio · 2 options; shown if VT7_1 = "Oui/ Yes"; sub-section: 7.1.1 Si oui, ces directives couvrent-elles les aspects sui… |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | Le règlement couvre-t-il la stigmatisation et la discrimination à l'égard du personnel et des élèves porteurs… | VT7_4 (`vocationalTraining.hivRulesCoverStigmaOther`) | OnefopVocationalTrainingDetail.hivRulesCoverStigmaOther | No | radio · 2 options; shown if VT7_1 = "Oui/ Yes"; sub-section: 7.1.1 Si oui, ces directives couvrent-elles les aspects sui… |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | Le règlement couvre-t-il le harcèlement et les abus sexuels ? | VT7_5 (`vocationalTraining.hivRulesCoverHarassment`) | OnefopVocationalTrainingDetail.hivRulesCoverHarassment | No | radio · 2 options; shown if VT7_1 = "Oui/ Yes"; sub-section: 7.1.1 Si oui, ces directives couvrent-elles les aspects sui… |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | Existe-t-il des procédures disciplinaires en cas de violation de ces aspects ? | VT7_6 (`vocationalTraining.hasDisciplinaryProcedures`) | OnefopVocationalTrainingDetail.hasDisciplinaryProcedures | No | radio · 2 options |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | Canaux de communication — Élèves | VT7_7 (`vocationalTraining.pupilsCommsChannels`) | OnefopVocationalTrainingDetail.pupilsCommsChannels | No | checkbox |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | Canaux de communication — Personnel Enseignant | VT7_8 (`vocationalTraining.teachingStaffCommsChannels`) | OnefopVocationalTrainingDetail.teachingStaffCommsChannels | No | checkbox |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | Canaux de communication — Personnel Non Enseignant | VT7_9 (`vocationalTraining.nonTeachingStaffCommsChannels`) | OnefopVocationalTrainingDetail.nonTeachingStaffCommsChannels | No | checkbox |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | Canaux de communication — Parents/Tuteurs | VT7_10 (`vocationalTraining.parentsCommsChannels`) | OnefopVocationalTrainingDetail.parentsCommsChannels | No | checkbox |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | Canaux de communication — Conseil d'établissement | VT7_11 (`vocationalTraining.schoolCouncilCommsChannels`) | OnefopVocationalTrainingDetail.schoolCouncilCommsChannels | No | checkbox |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | Prenez-vous en compte les questions liées aux IST ? | VT7_12 (`vocationalTraining.addressesIstIssues`) | OnefopVocationalTrainingDetail.addressesIstIssues | No | radio · 2 options |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | Les apprenants de votre établissement ont-ils reçu une éducation sexuelle et sur le VIH complète axée sur les… | VT7_13 (`vocationalTraining.traineesReceivedFullSexEd`) | OnefopVocationalTrainingDetail.traineesReceivedFullSexEd | No | radio · 2 options |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | L'enseignement des compétences génériques pour la vie courante est-il inscrit au programme officiel ? | VT7_14 (`vocationalTraining.genericLifeSkillsInSyllabus`) | OnefopVocationalTrainingDetail.genericLifeSkillsInSyllabus | No | radio · 2 options; shown if VT7_13 = "Oui/ Yes"; sub-section: 7.4 Si oui, les thèmes suivants sont-ils abordés ? |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | L'enseignement des compétences génériques pour la vie courante est-il proposé en activité parascolaire ? | VT7_15 (`vocationalTraining.genericLifeSkillsExtracurricular`) | OnefopVocationalTrainingDetail.genericLifeSkillsExtracurricular | No | radio · 2 options; shown if VT7_13 = "Oui/ Yes"; sub-section: 7.4 Si oui, les thèmes suivants sont-ils abordés ? |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | L'éducation à la santé reproductive et sexuelle est-elle inscrite au programme officiel ? | VT7_16 (`vocationalTraining.reproHealthEdInSyllabus`) | OnefopVocationalTrainingDetail.reproHealthEdInSyllabus | No | radio · 2 options; shown if VT7_13 = "Oui/ Yes"; sub-section: 7.4 Si oui, les thèmes suivants sont-ils abordés ? |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | L'éducation à la santé reproductive et sexuelle est-elle proposée en activité parascolaire ? | VT7_17 (`vocationalTraining.reproHealthEdExtracurricular`) | OnefopVocationalTrainingDetail.reproHealthEdExtracurricular | No | radio · 2 options; shown if VT7_13 = "Oui/ Yes"; sub-section: 7.4 Si oui, les thèmes suivants sont-ils abordés ? |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | L'enseignement sur la transmission et la prévention du VIH est-il inscrit au programme officiel ? | VT7_18 (`vocationalTraining.hivTransmissionEdInSyllabus`) | OnefopVocationalTrainingDetail.hivTransmissionEdInSyllabus | No | radio · 2 options; shown if VT7_13 = "Oui/ Yes"; sub-section: 7.4 Si oui, les thèmes suivants sont-ils abordés ? |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | L'enseignement sur la transmission et la prévention du VIH est-il proposé en activité parascolaire ? | VT7_19 (`vocationalTraining.hivTransmissionEdExtracurricular`) | OnefopVocationalTrainingDetail.hivTransmissionEdExtracurricular | No | radio · 2 options; shown if VT7_13 = "Oui/ Yes"; sub-section: 7.4 Si oui, les thèmes suivants sont-ils abordés ? |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | Les formateurs de votre établissement ont-ils reçu et dispensé une éducation sexuelle et sur le VIH complète … | VT7_20 (`vocationalTraining.trainersDeliveredSexEd`) | OnefopVocationalTrainingDetail.trainersDeliveredSexEd | No | radio · 2 options |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | Si oui, ces enseignants ont-ils dispensé les enseignements reçus aux élèves ? | VT7_21 (`vocationalTraining.trainersPassedOnToStudents`) | OnefopVocationalTrainingDetail.trainersPassedOnToStudents | No | radio · 2 options; shown if VT7_20 = "Oui/ Yes" |
| vocationalTraining | SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION | Votre centre a-t-il organisé une ou plusieurs sessions d'orientation destinées aux parents ou tuteurs d'appre… | VT7_22 (`vocationalTraining.heldParentOrientationSessions`) | OnefopVocationalTrainingDetail.heldParentOrientationSessions | No | radio · 2 options |
| vocationalTraining | SECTION 8. INFORMATIONS SUR LES FORMATEURS | Effectifs des formateurs par diplôme académique le plus élevé et par sexe | VT8_1 (`section8_vocationalTraining.VT8_1`) | OnefopVtDiplomaData | No | table · vt_diploma_table; sub-section: 8.1 Effectifs des formateurs par diplôme académique le plus… |
| vocationalTraining | SECTION 8. INFORMATIONS SUR LES FORMATEURS | Formateurs par diplôme professionnel le plus élevé et par sexe | VT8_2 (`section8_vocationalTraining.VT8_2`) | OnefopVtDiplomaData | No | table · vt_diploma_table; sub-section: 8.2 Formateurs par diplôme professionnel le plus élevé et p… |
| vocationalTraining | SECTION 8. INFORMATIONS SUR LES FORMATEURS | Effectifs des formateurs par tranche d'âge et par sexe | VT8_3 (`section8_vocationalTraining.VT8_3`) | OnefopVtTrainerAge | No | table · vt_trainer_age_table; sub-section: 8.3 Effectifs des formateurs par tranche d'âge et par sexe |
| vocationalTraining | SECTION 8. INFORMATIONS SUR LES FORMATEURS | Formateurs par spécialités de formation et type de formation | VT8_4 (`vocationalTraining.specialtyRows_8_4`) | OnefopVtSpecialtyRow | No | repeating_table · vt_specialty_fi_fc_table; sub-section: 8.4 Formateurs par spécialité et type de formation |
| vocationalTraining | SECTION 8. INFORMATIONS SUR LES FORMATEURS | Formateurs vacataires professionnels — hommes | VT8_5_VP_M (`vocationalTraining.vacataireProfMale`) | OnefopVocationalTrainingDetail.vacataireProfMale | No | number; sub-section: 8.5 Formateurs par statut professionnel |
| vocationalTraining | SECTION 8. INFORMATIONS SUR LES FORMATEURS | Formateurs vacataires professionnels — femmes | VT8_5_VP_F (`vocationalTraining.vacataireProfFemale`) | OnefopVocationalTrainingDetail.vacataireProfFemale | No | number; sub-section: 8.5 Formateurs par statut professionnel |
| vocationalTraining | SECTION 8. INFORMATIONS SUR LES FORMATEURS | Formateurs vacataires non professionnels — hommes | VT8_5_VNP_M (`vocationalTraining.vacataireNonProfMale`) | OnefopVocationalTrainingDetail.vacataireNonProfMale | No | number; sub-section: 8.5 Formateurs par statut professionnel |
| vocationalTraining | SECTION 8. INFORMATIONS SUR LES FORMATEURS | Formateurs vacataires non professionnels — femmes | VT8_5_VNP_F (`vocationalTraining.vacataireNonProfFemale`) | OnefopVocationalTrainingDetail.vacataireNonProfFemale | No | number; sub-section: 8.5 Formateurs par statut professionnel |
| vocationalTraining | SECTION 8. INFORMATIONS SUR LES FORMATEURS | Formateurs Permanents — hommes | VT8_5_PERM_M (`vocationalTraining.permanentMale`) | OnefopVocationalTrainingDetail.permanentMale | No | number; sub-section: 8.5 Formateurs par statut professionnel |
| vocationalTraining | SECTION 8. INFORMATIONS SUR LES FORMATEURS | Formateurs Permanents — femmes | VT8_5_PERM_F (`vocationalTraining.permanentFemale`) | OnefopVocationalTrainingDetail.permanentFemale | No | number; sub-section: 8.5 Formateurs par statut professionnel |
| vocationalTraining | SECTION 8. INFORMATIONS SUR LES FORMATEURS | Formateurs Contractuels — hommes | VT8_5_CONTRACT_M (`vocationalTraining.contractualMale`) | OnefopVocationalTrainingDetail.contractualMale | No | number; sub-section: 8.5 Formateurs par statut professionnel |
| vocationalTraining | SECTION 8. INFORMATIONS SUR LES FORMATEURS | Formateurs Contractuels — femmes | VT8_5_CONTRACT_F (`vocationalTraining.contractualFemale`) | OnefopVocationalTrainingDetail.contractualFemale | No | number; sub-section: 8.5 Formateurs par statut professionnel |
| vocationalTraining | SECTION 8. INFORMATIONS SUR LES FORMATEURS | Effectifs des formateurs par type de handicap et par sexe | VT8_6 (`section8_vocationalTraining.VT8_6`) | OnefopVtTrainerDisability | No | table · vt_trainer_disability_table; sub-section: 8.6 Effectifs des formateurs par type de handicap et par se… |
| vocationalTraining | SECTION 8. INFORMATIONS SUR LES FORMATEURS | Capacité d'accueil | VT8_7 (`vocationalTraining.specialtyRows_8_7`) | OnefopVtSpecialtyRow | No | repeating_table · vt_specialty_fi_fc_count_table; sub-section: 8.7 Capacité d'accueil |
| vocationalTraining | SECTION 8. INFORMATIONS SUR LES FORMATEURS | Etat nominatif du personnel formateur et administratif des établissements ou privés | VT8_8 (`vocationalTraining.trainerRoster`) | OnefopVtTrainerRoster | No | repeating_table · vt_trainer_roster_table; sub-section: 8.8 Etat nominatif du personnel formateur et administratif … |
| vocationalTraining | SECTION 9. DIFFICULTÉS ET PERSPECTIVES | Rencontrez-vous des difficultés dans le processus de formation de vos apprenants ? | VT9_1 (`vocationalTraining.facesDifficulties`) | OnefopVocationalTrainingDetail.facesDifficulties | No | radio · 2 options |
| vocationalTraining | SECTION 9. DIFFICULTÉS ET PERSPECTIVES | Si oui, lesquelles ? (Cochez svp) | VT9_2 (`vocationalTraining.difficultyTypes`) | OnefopVocationalTrainingDetail.difficultyTypes | No | checkbox · 6 options; shown if VT9_1 = "Oui/ Yes" |
| vocationalTraining | SECTION 9. DIFFICULTÉS ET PERSPECTIVES | Autre (à préciser) | VT9_3 (`vocationalTraining.difficultyOtherTexts`) | OnefopVocationalTrainingDetail.difficultyOtherTexts | No | textarea; shown if VT9_1 = "Oui/ Yes" |
| vocationalTraining | SECTION 9. DIFFICULTÉS ET PERSPECTIVES | Citer les 5 principales perspectives | VT9_4 (`vocationalTraining.perspectives`) | OnefopVocationalTrainingDetail.perspectives | No | textarea; sub-section: 9.2 Cinq principales perspectives |

---

## Step 5: The delta

### 5.1 In registration but not in ONEFOP

These fields are collected at sign-up but the questionnaire never asks for them. The
AST has no question that maps to them.

| Field (registration label) | Types | Stored in | Note |
|---|---|---|---|
| N° contribuable (NIU), `taxNumber` | enterprise, cooperative, ctd, ong, VT (required) | `Company.taxNumber` | Never asked by any AST section. |
| N° CNPS, `cnpsNumber` | enterprise (optional) | `Company.cnpsNumber` | — |
| N° d'enregistrement, `registrationNumber` (hint "Numéro d'agrément") | ong (required) | `Company.registrationNumber` | — |
| Capital social (XAF) · Maison mère · Activité secondaire | enterprise (optional) | `Company.socialCapital`, `parentCompany`, `secondaryActivity` | — |
| Statut juridique = **"SNC"** | enterprise | `Company.legalStatus` | Registration offers SNC. The AST option set is unipersonnelle / SARL / SA / Autres, so autofill passes "SNC" through as a value the AST does not list. |
| Nom de la CTD (`ctdName`) | ctd | `Company.name` | The AST CTD Section 1 has no name question and `OnefopCtdDetail` has no name column. Autofill writes `CTD_S1Q01_NAME`, a key that does not exist in the AST. |
| Téléphone / Téléphone 2 of the **centre** | VT | `Company.phone`, `phone2` | VT Section 1 has only respondent (§1.15) and promoter (§1.16) phones. |
| Adresse du CFP | VT | `Company.address` | VT has no address question. Autofill puts it into `VT1_8` "Village-Quartier". |
| Secteur d'activité (`sectorId`, Sector table) | all (public only, optional) | `Company.sectorId` | The AST "Secteur d'activité" is a different variable (Primaire/Secondaire/Tertiaire). Autofill does **not** use `sectorId`; it infers the AST sector from keywords in `mainActivity`. |
| Email professionnel, Mot de passe, certification | all | `User.email`, `User.passwordHash`, — | Account fields. The respondent email is also prefilled into `S0Q03_EMAIL` / `VT1_15_EMAIL`. |

### 5.2 In ONEFOP but not in registration

This list covers identification-level fields only. Sections 2 onward are entirely
questionnaire-only by nature.

| Field (AST label) | Types | Storage |
|---|---|---|
| Quartier/Village/Localité | all six non-VT (`*_LOCALITY`) | detail `.locality`. Autofill fills it from `Company.address`. |
| Commune (1.7) | VT | `…VocationalTrainingDetail.commune` |
| Siège social de l'entreprise (`S1Q09`) | enterprise | `OnefopEnterpriseDetail.headOffice`. Autofill copies `Company.address` into both `S1Q04_LOCALITY` and `S1Q09`. |
| Nombre d'employés permanents / postes vacants | all six non-VT | detail `.permanentWorkers` / `.vacancies`. Autofill fills permanentWorkers from `Company.totalEmployees`, which registration always sets to **0**. |
| Taille de l'entreprise (`S1Q12`) | enterprise | `OnefopEnterpriseDetail.enterpriseSize`. `Company.enterpriseSize` exists but registration never writes it. |
| Branche d'activité | ctd, ong, administration, projectProgram | detail `.branch`. Registration asks it only of enterprise and cooperative. |
| Précisez (other cooperative type) | cooperative | `.cooperativeTypeOther` |
| Type de Commune (`CTD_S1Q02`) | ctd | `OnefopCtdDetail.councilType` |
| Existence de projet / combien; structures sous tutelle / combien | administration | `OnefopAdministrationDetail.hasProject` etc. |
| Nature de la structure · Nom du Responsable · Ministère/Organisme tutelle · Situation · Motif d'arrêt | projectProgram | `OnefopProjectProgramDetail.*`. Autofill fills "Nom du Responsable" from `promoterName` (which projectProgram never collects) or else from the respondent's name. |
| Code de la Structure (1.1) | VT | `.structureCode`. Prefilled from `establishmentId`. |
| Sexe du répondant (1.15) · E-mail du promoteur (1.16) | VT | `.respondentSex`, `.promoterEmail` |
| Boîte postale, Email, Site Web (VT2_11–13) | VT | VT detail. VT §2 asks BP again even though registration collected it; autofill does not prefill VT2_11. |
| Agréé? · année · Arrêté n° · date (VT2_14–17) | VT | VT detail (see §3c) |

### 5.3 Same field, different labels

| Concept | Registration label (key) | AST label (key) | Admin display label(s) |
|---|---|---|---|
| Entity name | Raison sociale (ent) · Nom (admin, PP) · Nom de la coopérative · Nom de la CTD · Nom de l'ONG · Nom du CFP | Nom de l'entreprise · Nom de l'administration · Nom (PP) · Nom de la coopérative · *(none for CTD)* · Nom de l'ONG · Nom du CFP | "Raison sociale" for every type (`etablissement-detail`, inscriptions correction diff); "Dénomination / Organisation" (registration receipt) |
| Address / head office | Adresse du siège (`address`, `cooperativeHeadOffice`) · Adresse du CFP | Siège social de l'entreprise · Siège social (coop, ONG, PP) · Village-Quartier (VT, via autofill) · Quartier/Village/Localité (via autofill) | "Adresse" |
| Legal status | Statut juridique | Régime/statut juridique | — |
| Year | Année de création · Année d'ouverture (VT) | Année de création de la coopérative / de la CTD / de l'ONG · Année d'ouverture (VT) | — |
| Mission | Mission principale (ONG, admin, PP) | *Quelle est votre mission principale ?* (ONG) · Mission principale (admin) · *Objectif ou mission principale* (PP) | — |
| Acronym | Sigle (admin, PP, VT; optional) | Sigle (admin, VT) · *Sigle ou acronyme* (PP); **required** for admin and PP | — |
| Entity phone | Téléphone / Téléphone 2 | Téléphone 1 / Téléphone 2 | "Téléphone" |
| Area | Milieu (Urbain / Rural) | Milieu de résidence · Milieu d'implantation (VT) | — |
| Sector | Secteur d'activité (Sector table) | Secteur d'activité (Primaire/Secondaire/Tertiaire) | **Same label, different variable.** |
| Cooperative type | Type de coopérative; values "Coopérative simplifiée", "Autre" | Type de la coopérative; values "Coopérative à comptabilité simplifiée", "Autre (à préciser)/ Other (specify)" | — |
| CTD type | Type de CTD; values "Région", "Commune" | Type de CTD; values "Région/ Region", "Commune/ Council" | Autofill maps "Commune" but passes "Région" through unchanged, which is not an AST value. |
| VT education system | Ordre d'enseignement | Statut de l'établissement | — |
| VT functional status | Situation du centre · Raison · Autre raison | Situation du Centre de formation · *Si « Non-fonctionnelle », préciser la raison* · Précisez | — |
| VT promoter | Promoteur — Nom / Sexe (Homme/Femme) / Tél. 1 / Tél. 2 | Noms et prénoms / Sexe (Masculin/Féminin) / WhatsApp / Téléphone 2 | — |
| Respondent name | Prénom + Nom (two fields) | Noms, prénoms du répondant · Noms et prénoms (VT), one field | "Déclarant habilité / Respondent" (receipt) |
| Respondent function | Fonction (select of 9) | Fonction du répondant (free text) · *Qualité du répondant* (VT) | — |
| Respondent phone 1 | Téléphone 1 (public) · Téléphone (admin) | Téléphone 1 · *WhatsApp* (VT) | — |
| Respondent email | Email professionnel · Adresse e-mail (admin) | E-mail | Identifiant (assisted-registration dialog) |
| Entity type | See Step 1. Four label sets: public radio, `ENTITY_CONFIGS` title, `/admin/inscriptions` ("CFP"), `/home/inscription-en-attente` ("Centre de formation professionnelle") | AST section titles | — |

### 5.4 Reference numbers

| Field | Collected (where · label) | Stored | Displayed (where · label) |
|---|---|---|---|
| **taxNumber** | `/register` and `/admin/inscriptions/nouvelle` step 3, for enterprise, cooperative, ctd, ong and VT, required · "N° contribuable (NIU)" / "Taxpayer no. (NIU)". Correction form `/home/inscription-en-attente` · "Numéro contribuable (NIU)". Login "forgot password" lookup · "N° contribuable (NIU) \*". **Not in the AST.** | `Company.taxNumber` (NOT NULL, @unique). Administration and projectProgram get a synthetic `NA-<uuid>`. `OnefopSubmission.taxNumber` exists but is written only by `OnefopService.submitForm`, which **no route calls**. The live `POST /onefop/submit` (`QuestionnairesService`) leaves it null. | `/admin/inscriptions` review dialog · "NIU : …". Correction diff · "Numéro contribuable (NIU)". `CompaniesDirectory` · "NIU". `/admin/etablissement-detail` · "Numéro fiscal (NIU)". `/admin/etablissements` list · used as a fallback in the "N° RCCM / Identifiant" column when `registrationNumber` is null. `/admin/dossiers/[id]` · "Numéro de contribuable" (reads the submission column, so live submissions show "non renseigné"). `SovereignMasthead` · "NIU :" (component is not mounted anywhere). SPSS export `SYS_07` · "N° contribuable" (reads `submission.taxNumber`). Excel register export · "N° contribuable" (reads `company.taxNumber`, then the submission column). Synthetic `NA-<uuid>` values are displayed as-is wherever `Company.taxNumber` is shown. |
| **cnpsNumber** | Enterprise only, optional · "N° CNPS" / "CNPS no." (block "Fiscalité et affiliation"). Correction form · "Numéro CNPS". **Not in the AST.** | `Company.cnpsNumber`. `OnefopSubmission.cnpsNumber` has the same dead write path as above. | `/admin/inscriptions` review · "CNPS : …". Correction diff · "Numéro CNPS". `CompaniesDirectory` · "N° CNPS". `/admin/etablissement-detail` · "Numéro CNPS". `SovereignMasthead` · "CNPS :" (unmounted). The dossier API type carries `cnpsNumber` but the page does not render it. |
| **registrationNumber** (Company) | ONG only, required · "N° d'enregistrement" with hint "Numéro d'agrément" / "Registration no." (block "Enregistrement et mission"). **Not in the AST.** | `Company.registrationNumber` (nullable, not unique). `OnefopSubmission.registrationNumber` has the dead write path. | `CompaniesDirectory` · "N° d'enregistrement". `/admin/etablissement-detail` · **"N° RCCM"** (header and field). `/admin/etablissement-detail/approbation` · **"N° RCCM"**. `/admin/etablissements` · **"N° RCCM / Identifiant"** (falls back to taxNumber, then establishmentId). `/admin/dossiers/[id]` · **"Numéro de registre du commerce (RCCM)"**, read from the submission column, so empty for live submissions. It is also used as a lookup key on the two établissement pages. |
| **registrationNumber** (User) | Never collected. | `User.registrationNumber` (@unique). Schema comment: "Human-readable registration number (e.g. INS-2026-0847); no generator yet". | Not displayed; excluded from the public user select. Same column name as the Company field with a different meaning. |
| **establishmentId** | System-generated at approval, or at registration for auto-approved ADMINISTRATION files. | `Company.establishmentId` (@unique); `OnefopSubmission.establishmentId` | Registration receipt · "Identifiant d'établissement". Accepted as a login identifier. Prefilled into AST `VT1_1` "Code de la Structure" (hint: "A ne pas remplir"). Etablissements list fallback in "N° RCCM / Identifiant". SPSS `SYS_08` "ID établissement". |
| **structureCode** | AST `VT1_1` only · "Code de la Structure" | `OnefopVocationalTrainingDetail.structureCode` | Through submission detail and exports. |
| **accreditationOrderNumber / Date / lastAccreditationYear** | AST `VT2_16` "Arrêté n°", `VT2_17` "Date de l'arrêté d'accréditation", `VT2_15` "année du dernier agrément" (VT, conditional on `VT2_14 = Oui`). Not at registration. | VT detail columns | Through submission detail and exports. "Agrément" therefore names two different things: ONG `registrationNumber` at registration, and VT accreditation in the AST. |
| Phones, P.O. box | Registration: `phone`, `phone2`, `poBox` (optional), `respondentPhone(2)`, `promoterPhone1/2`. AST: `*_TEL1/2`, `*_BP` (**required** in the AST for every non-VT type), `VT1_15_TEL*`, `VT1_16_TEL*`, `VT2_11` | `Company.*`; detail `.phone1/.phone2/.poBox`; `OnefopRespondent.phone1/2` | Number-like, but contact data rather than identifiers. Listed for completeness. |

---

## Step 6: Summary

**Universal fields.** Only a small set is collected at registration for every entity
type and then reused consistently:

- **The geographic triple (region, department, subdivision)** comes closest to the goal. Every type collects it, it is stored canonically on both `Company` and `User`, and it is prefilled into every Section 1 under the same three labels "Région / Département / Arrondissement". Its weakness is upstream: the admin-assisted form never collects Milieu (`area`), so admin-registered entities have no value to prefill.
- **The respondent block (name, function, phones, email)** is also universal. However, registration splits the name into Prénom + Nom while the AST uses one "Noms, prénoms" field, Fonction changes from a 9-value select to free text, and phone 1 is "WhatsApp" for VT.
- **Entity name and phone/P.O. box** are collected for all seven types, but none of them carries one label everywhere.

**Entity-specific and label-inconsistent fields.** These are the source of the mix-up:

- **The three reference numbers** — `taxNumber`, `cnpsNumber`, `registrationNumber`:
  - They exist only at registration and on `Company`. The ONEFOP questionnaire never asks for any of them.
  - The `OnefopSubmission` columns of the same names are never written on the live submit path, so `/admin/dossiers/[id]` and the SPSS export read nulls.
  - The NIU appears under at least six labels: "N° contribuable (NIU)", "Numéro contribuable (NIU)", "Numéro fiscal (NIU)", "Numéro de contribuable", "NIU", "N° contribuable".
  - Administration and projectProgram carry a synthetic `NA-<uuid>` in the NIU column.
  - `registrationNumber` is collected only from ONGs, as an *agrément* number, but every admin detail page labels it **"N° RCCM"** (a commercial-register number). The établissements list fills that same RCCM column with the NIU or the establishment ID when it is empty.
  - A second, unrelated `User.registrationNumber` exists under the same name.
- **Type-specific gaps:**
  - The CTD name has no AST question or detail column.
  - The VT centre address and phones have no AST counterpart (the address is pushed into "Village-Quartier").
  - The registration "Secteur d'activité" and the AST "Secteur d'activité" are different classifications under the same label.
  - Several option vocabularies differ between registration and the AST: legal status (SNC), cooperative type, CTD type, and promoter sex labels.
  - Entity-type names themselves use four label sets across the public wizard, the admin form, `/admin/inscriptions` and the respondent correction page.

---

### Appendix: method

- Table B was generated from `react-web/public/schemas/onefop.schema.json`, a generated artifact of `onefop_ast.dart`. It was read only, never edited. All 504 field entries for 7 entity types map to a storage target. Storage targets come from the entity-detail `create` blocks and the fact-row builders in `src/questionnaires/questionnaires.service.ts`, and VT scalar paths were checked against the columns of `OnefopVocationalTrainingDetail`.
- Table A was generated from `ENTITY_CONFIGS` (178 rows), with request→column mappings taken from `auth.controller.ts` and `AuthService.createCompanyRegistration`.
- † For Administration, `buildJobApplicationRows` reads the `s21q01` prefix for every entity type. Administration's `S21Q01` is a staff census with SFP categories, not job applications, yet its cells are also written to `OnefopJobApplicationData`. This is reported as observed, not fixed.
- The AST comment in `section1VocationalTraining` says VT 1.10–1.13 are free text. The generated schema shows them as `radio` with option lists. The schema is what is rendered, so Table B follows it.
