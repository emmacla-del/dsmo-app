# Vocational Training — Design Note (VT-0 / VT-0.5, binding for VT-1)

Status: **VT-1 through VT-8 complete (2026-08-30).** VT-1 (schema +
migration): `schema.prisma` carries the 13 models, 16 enums, and `VOCATIONAL_TRAINING` entity type
described below; migration `prisma/migrations/20260829130000_add_vocational_training_entity/migration.sql`
has been applied to the database; `getEntityTypeLabel()` has its one new key. VT-2 (AST): all 9 sections
authored in `lib/core/focus/compiler/onefop_ast.dart` (179 `FormQuestionAst` entries), plus the entity-type
registry hooks needed for `VOCATIONAL_TRAINING`/`vocationalTraining` to compile across the app (see VT-2
completion notes below §13). VT-3 (DTO): `src/dto/onefop-questionnaire.dto.ts` carries
`VocationalTrainingIdentificationDto` and the 12 child-row DTOs. VT-4 (normalizer):
`src/common/normalizers/flat-key-normalizer.ts` maps every flat `VT*`/`sNqM_*` key to its Prisma-shaped
field. VT-5 (persistence): `src/questionnaires/questionnaires.service.ts` creates
`vocationalTrainingDetail` plus all 12 `vt*` child relations on submission (`createMany`, empty arrays
skipped), and — since 2026-08-29's gap-closing pass below — includes them on read-back
(`getById`/`getQuestionnaireById`/`getAllQuestionnaires`/`listByStatus`). VT-6/VT-7 (PDF):
`src/pdf/templates/dynamic/vocationalTraining.hbs` + `mapVocationalTrainingData()` in
`src/services/pdf-data-mapper.service.ts`, wired into `onefop-puppeteer.service.ts`,
`onefop-submission-pdf.service.ts`, and `questionnaires.controller.ts`; verified end-to-end with a local
smoke test (synthetic flat data → mapper → Handlebars → Puppeteer PDF, 152KB HTML / 635KB PDF, no errors).
VT-8 (data-management exports): the flattened `Formation Professionnelle` sheet in the multi-sheet Excel
export is done (`data-management.service.ts`'s `onefopSheetDefs()`); as of 2026-08-30, 11 of the 12
`OnefopVt*` child/fact tables also have their own long-format breakdown sheet via `BREAKDOWN_SHEET_DEFS`
(diplomas, age flows, trainer age, education-level flow, vulnerable trainees, trainer disability,
scholarships, specialty rows, curricula, infrastructure, furniture), matching how the shared six-entity
fact tables are handled. `OnefopVtTrainerRoster` (8.8, named individuals) is deliberately excluded from
this sheet set — per §9's PII posture, a roster export stays separate, explicitly labelled, and gated to
the same reviewer roles (this endpoint's `@Roles` already matches that gate, but no roster sheet has been
built). The flat SPSS/CSV export (`streamApprovedOnefopSubmissionsCsv`) turned out to already cover VT's
Detail-level fields with no code change needed — `buildFlatColumns`/`approvedOnefopInclude` both build off
`onefopSheetDefs()`, which has carried a `VOCATIONAL_TRAINING` entry since earlier in VT-8, so `name`,
`cfpType`, `totalTraineesDeclared`, etc. already flowed into the flat CSV; this was previously
undocumented and untested, closed 2026-08-30 with regression coverage in
`data-management.service.spec.ts`. The 11 `OnefopVt*` breakdown tables are **not** pivoted into the flat
CSV — by design, matching the existing precedent that only the original four entities' shared ten fact
tables get pivoted into flat columns; every later entity's own child/fact tables (VT's included) are
Excel-only, long-format sheets. `ProjectProgramActivity` (`projectProgramActivities`) remains genuinely
unexported in both the Excel and CSV paths — a pre-existing gap noticed while auditing this, unrelated to
VT and not fixed here. This note remains the authoritative reference for these phases, not the PDF
directly.

**2026-08-29 gap-closing pass** (found while auditing already-implemented-but-uncommitted VT-3..VT-7 code,
before the Excel sheet work above): three registry gaps were closing the same way ADMINISTRATION's and
PROJECT_PROGRAM's were in earlier phases — additive, no behavior change for the six pre-existing entities.
1. `EstablishmentIdGenerator` (`src/common/utils/establishment-id.generator.ts`) had no
   `VOCATIONAL_TRAINING` → `VT` prefix entry. This is a **live path** in `dsmo.service.ts`'s company
   registration flow — without it, registering any VT company threw `Unknown entity type:
   VOCATIONAL_TRAINING` and blocked the feature end-to-end. Fixed; `establishment-id.generator.spec.ts`
   extended with VT coverage (generate/case-insensitivity/serial-increment/isValid/parse).
2. `questionnaires.service.ts`'s four submission-read methods (`getAllQuestionnaires`,
   `getQuestionnaireById`, `listByStatus`, `getById`) didn't include `vocationalTrainingDetail` (or, on the
   two "full detail" methods, the 12 `vt*` child relations) — VT submissions would read back with their
   detail silently missing in admin/review views. Fixed.
3. `data-management.service.ts`'s Excel export had no `VOCATIONAL_TRAINING` sheet at all. Fixed with a
   flattened Detail-only sheet (see VT-8 above); the 12-table long-format breakdown remains open.

Source instrument: `QUESTIONNAIIRE FORMATION PROFESSIONNELLE 2025_2026.pdf` (MINEFOP, 19 pages, FR/EN),
the only version found in the repository or supplied materials.

Inventory at closure: **13 models (1 Detail + 12 child/fact), 16 enums, 9 AST sections.**

---

## 1. Closed decisions (binding — do not reopen, do not add "just in case" fields)

| # | Item | Decision |
|---|---|---|
| 1 | §4.12 | Leftover number under table 4.11 on page 10: no title, no grid, no instruction. **Not collected.** No model, column, AST key, or enum. Add only if MINEFOP later supplies real question text — a later phase; do not block VT-1 on a blank line. |
| 2 | §7.1.3 channel columns | Printed shape confirmed: 5 stakeholder rows (Élèves, Personnel Enseignant, Personnel Non Enseignant, Parents/Tuteurs, Conseil d'établissement) under the group title "Modes de communication"; individual channel headers are blank on the form itself (not an extraction defect). VT-1: **5 `String[]` columns on `OnefopVocationalTrainingDetail`**, no `VtCommsChannel` enum. Channel option values are **not invented** — the AST option list is deferred to VT-2, pending a written list from MINEFOP. |
| 3 | Page 15 "Scolaire / Social / Profesionnel" | Unfinished layout fragment after §7.7, no code, no stem. **Not captured.** No columns, no AST keys. |
| 4 | §6.1.2 / §7.3 | §6.1.2 is two Yes/No questions sharing one printed code — persisted as two Detail booleans: `traineesChooseWithSupport` (learners choose tracks with the in-house guidance service) and `collaboratesWithCiopCosup` (if not, collaboration with CIOP/COSUP). §7.3 **does not exist** — the instrument's own numbering jumps 7.2 → 7.4. No field, no key, no placeholder. |
| 5 | Respondent sex (§1.15) | Stored as `respondentSex` on `OnefopVocationalTrainingDetail` **only**. `OnefopRespondent` (shared by all six existing entities) is **not modified** in VT-1. §1.15's name/function/phone1/phone2/email stay on `OnefopRespondent` exactly as for the other six entities. §1.16 promoter sex stays on Detail as `promoterSex` (unrelated field, already decided in VT-0). |

**Sign-off recorded 2026-08-29:** decisions 1–5 above are confirmed binding as printed — not reopened, nothing added "to be safe." This closes the five items from the VT-0.5 verification pass that required a judgment call on ambiguous/missing printed content (§4.12, §7.1.3, page 15, §6.1.2/§7.3, respondent sex placement).

**Still open, deliberately not closed here:** the `[Plat]` blanket required-field policy (§9 of the VT-0.5 pass). Left for VT-2. **All Prisma columns below stay nullable regardless of that policy** — requiredness is enforced in application code (`enforceFinalRequiredFields`, VT-4), never at the column level, matching the existing six entities' convention.

---

## 2. Entity architecture

```
Company (entityType: VOCATIONAL_TRAINING)
      │
      ▼
OnefopSubmission (formType: VOCATIONAL_TRAINING)
      │
      ├──1:1──▶ OnefopVocationalTrainingDetail   (identification + every fixed-shape §2/3/6/7/9 field)
      │
      ├──1:N──▶ OnefopVtDiplomaData        (4.1, 4.2, 8.1, 8.2)
      ├──1:N──▶ OnefopVtTraineeAgeFlow     (4.7)
      ├──1:N──▶ OnefopVtTrainerAge         (8.3)
      ├──1:N──▶ OnefopVtEducationLevelFlow (4.8)
      ├──1:N──▶ OnefopVtTraineeVulnerable  (4.9)
      ├──1:N──▶ OnefopVtTrainerDisability  (8.6)
      ├──1:N──▶ OnefopVtScholarship        (4.11)
      ├──1:N──▶ OnefopVtSpecialtyRow       (4.3, 4.4, 4.5, 4.6, 4.10, 6.3, 8.4, 8.7)
      ├──1:N──▶ OnefopVtCurriculum         (5.2)
      ├──1:N──▶ OnefopVtInfrastructure     (5.3)
      ├──1:N──▶ OnefopVtFurniture          (5.4)
      └──1:N──▶ OnefopVtTrainerRoster      (8.8 — named individuals, PII, see §6)
```

No existing entity's table, enum, or shared fact table (`OnefopCspGenderAge`, `OnefopDiplomaData`,
`OnefopDisabilityData`, `OnefopVulnerableData`, `OnefopFirstTimeWorker`, etc.) is reused or modified.
`OnefopVocationalTrainingDetail` has no `sectorId`/`sectorRef` — VT has no economic-sector concept.

---

## 3. `OnefopEntityType` (additive)

```prisma
enum OnefopEntityType {
  ENTREPRISE
  COOPERATIVE
  CTD
  ONG
  ADMINISTRATION
  PROJECT_PROGRAM
  VOCATIONAL_TRAINING   // new
}
```

---

## 4. `OnefopVocationalTrainingDetail` — full column list

1:1 with `OnefopSubmission` (`submissionId String @unique`, `onDelete: Cascade`). Every column nullable
except `name` and `submissionId`/`id` (identification's own required-in-practice fields; nullability of
everything else is deliberate per the open required-field policy in §1).

```prisma
model OnefopVocationalTrainingDetail {
  id                String   @id @default(uuid())
  submissionId      String   @unique

  // §1 — identification
  structureCode     String?          // 1.1, admin-assigned
  name              String           // 1.2
  sigle             String?          // 1.3
  region            String?          // 1.4
  department        String?          // 1.5
  subdivision       String?          // 1.6
  commune           String?          // 1.7 — new geo concept, see §7
  locality          String?          // 1.8 Village-Quartier — reuses existing convention
  area              String?          // 1.9 Urbain/Rural
  educationSystem   String?          // 1.10
  cfpType           String?          // 1.11
  functionalStatus  String?          // 1.12
  nonFunctionalReason      String?   // 1.13
  nonFunctionalReasonOther String?
  yearOfEstablishment Int?           // 1.14
  respondentSex     String?          // 1.15 — Decision 5: VT-local, NOT on OnefopRespondent
  promoterName      String?          // 1.16
  promoterSex       String?
  promoterPhone1    String?
  promoterPhone2    String?
  promoterEmail     String?

  // §2 — general information (one column per numbered item, 2.1.1–2.1.16, 2.2.1–2.2.20)
  hasStateAgreement         Boolean?
  agreementTypes            String[] @default([])
  siteCount                 Int?
  sharesInfrastructure      Boolean?
  sharedWithSchoolName      String?
  hasSpecialNeedsTrainers   Boolean?
  specialNeedsTrainerTotal  Int?
  specialNeedsTrainerFemale Int?
  hasAccessRamps            Boolean?
  hasDirectorOffice         Boolean?
  poBox                     String?
  email                     String?
  website                   String?
  isAccredited              Boolean?
  lastAccreditationYear     Int?
  accreditationOrderNumber  String?
  accreditationOrderDate    String?
  trainingTypesOffered      String[] @default([])
  totalTraineesDeclared     Int?
  totalTrainersDeclared     Int?
  traineesFromLowerSecondary Int?
  traineesFromUpperSecondary Int?
  hasEnergySource           Boolean?
  isEnergySourceFunctional  Boolean?
  energySourceTypes         String[] @default([])
  hasWaterSource            Boolean?
  waterSourceTypes          String[] @default([])
  hasHandwashingDevice      Boolean?
  hasReceivedHealthCampaign Boolean?
  hasFirstAidBox            Boolean?
  hasDispensary             Boolean?
  hasFunctionalLibrary      Boolean?
  fenceStatus               String?
  hasSchoolCouncil          Boolean?
  hasLevelCouncil           Boolean?
  hasDisciplinaryCouncil    Boolean?
  hasFunctionalLatrines     Boolean?
  latrineTypes              String[] @default([])
  latrinesSeparateByGender  Boolean?
  latrinesSeparateFromStaff Boolean?
  hasPlayground             Boolean?
  playgroundTypes           String[] @default([])
  hasIctTools               Boolean?
  ictToolsForTrainersCount  Int?
  ictToolsInternetCount     Int?
  trainersIctTrained        Boolean?
  trainersIctTrainedTotal   Int?
  trainersIctTrainedFemale  Int?
  trainersViolenceTraining  Boolean?
  trainersPssTraining       Boolean?
  hasBoarding               Boolean?
  hasGbvMechanism           Boolean?
  hasCanteen                Boolean?

  // §3 — education in emergencies
  facedCrisis               Boolean?
  crisisTypes                String[] @default([])
  crisisClosedCenter          Boolean?
  closureDurationWeeks         Int?
  siteRelocated                 Boolean?
  relocationLocality             String?
  traineesReassigned               Boolean?
  reassignedTo                       String?
  hasEarlyWarningSystem                Boolean?
  earlyWarningDescription                String?
  earlyWarningFunctional                   Boolean?
  trainersInnovativePedagogyTrained          Boolean?
  trainersInnovativePedagogyMale               Int?
  trainersInnovativePedagogyFemale               Int?
  trainersCrisisPedagogyTrained             Boolean?
  trainersCrisisPedagogyMale                  Int?
  trainersCrisisPedagogyFemale                  Int?
  trainersDrrmTrained                       Boolean?
  trainersDrrmMale                            Int?
  trainersDrrmFemale                            Int?
  trainersEvacuationDrillTrained            Boolean?
  trainersEvacuationDrillMale                 Int?
  trainersEvacuationDrillFemale                 Int?
  trainersOtherEmergencyTrained             Boolean?
  trainersOtherEmergencyMale                  Int?
  trainersOtherEmergencyFemale                  Int?
  hasStudentRecordsSecurity                 Boolean?
  hasTextbookSecurity                       Boolean?
  hasContingencyPlan                        Boolean?
  traineesTrainedOnProtection               Boolean?

  // §5.1 — study guides
  hasTraineeStudyGuides    Boolean?
  traineeStudyGuideCount   Int?
  hasTrainerStudyGuides    Boolean?
  trainerStudyGuideCount   Int?

  // §6 — orientation / post-training follow-up
  hasCareerGuidanceService   Boolean?   // 6.1.1
  careerGuidanceTimings      String[] @default([])
  traineesChooseWithSupport  Boolean?   // 6.1.2a — Decision 4
  collaboratesWithCiopCosup  Boolean?   // 6.1.2b — Decision 4
  guidanceSupportTypes       String[] @default([])   // 6.1.3
  guidanceSupportOther       String?
  hasPostTrainingFollowUp    Boolean?   // 6.2.1
  followUpMechanisms         String[] @default([])
  followUpMechanismOther     String?
  hasInsertionSupportUnit    Boolean?   // 6.2.2
  hasTraineeDatabaseTool     Boolean?   // 6.2.3
  hasJobSearchSupportTool    Boolean?   // 6.2.4
  // No 7.3 field — Decision 4, the code does not exist in the instrument.

  // §7 — cross-cutting themes
  hasHivAidsRules            Boolean?   // 7.1
  hivRulesCoverSafety        Boolean?   // 7.1.1
  hivRulesCoverStigmaHiv     Boolean?
  hivRulesCoverStigmaOther   Boolean?
  hivRulesCoverHarassment    Boolean?
  hasDisciplinaryProcedures  Boolean?   // 7.1.2
  // 7.1.3 — Decision 2: five stakeholder rows, blank channel headers on the
  // form. One String[] per stakeholder; values populated only once MINEFOP
  // supplies a written channel list (VT-2). No VtCommsChannel enum.
  pupilsCommsChannels             String[] @default([])
  teachingStaffCommsChannels      String[] @default([])
  nonTeachingStaffCommsChannels   String[] @default([])
  parentsCommsChannels            String[] @default([])
  schoolCouncilCommsChannels      String[] @default([])
  addressesIstIssues         Boolean?   // 7.2
  traineesReceivedFullSexEd  Boolean?   // 7.4
  genericLifeSkillsInSyllabus        Boolean?
  genericLifeSkillsExtracurricular   Boolean?
  reproHealthEdInSyllabus            Boolean?
  reproHealthEdExtracurricular       Boolean?
  hivTransmissionEdInSyllabus        Boolean?
  hivTransmissionEdExtracurricular   Boolean?
  trainersDeliveredSexEd     Boolean?   // 7.5
  trainersPassedOnToStudents Boolean?   // 7.6
  heldParentOrientationSessions Boolean?  // 7.7
  // Page-15 "Scolaire/Social/Profesionnel" fragment — Decision 3: not captured.

  // §8.5 — trainer occupational status (fixed 3-row × gender grid, embedded not normalized)
  vacataireProfMale       Int?
  vacataireProfFemale     Int?
  vacataireNonProfMale    Int?
  vacataireNonProfFemale  Int?
  permanentMale           Int?
  permanentFemale         Int?

  // §9 — difficulties and perspectives
  facesDifficulties      Boolean?
  difficultyTypes        String[] @default([])
  difficultyOtherTexts   String[] @default([])
  perspectives           String[] @default([])
  // §4.12 — Decision 1: nothing to capture, no column.

  createdAt         DateTime @default(now())
  submission        OnefopSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)

  @@map("onefop_vocational_training_details")
}
```

---

## 5. Enums (16)

```prisma
enum VtGender      { MALE FEMALE TOTAL }
enum VtPersonType  { TRAINEE TRAINER }
enum VtDiplomaKind { ACADEMIC PROFESSIONAL }

enum VtDiplomaCode {
  DOCTORAT MASTER2 MAITRISE LICENCE DEUG_DUT BACC_GENERAL BACC_TECHNIQUE
  PROBATOIRE BEPC CEP SANS_DIPLOME_ACADEMIQUE
  DIPLEG_DIPES2 INGENIEUR_MASTER_PRO DIPCEG_DIPES1 LICENCE_PRO BTS_HND
  BEP_BP_BACPRO CAPIEG CAPIAEG CAP DQP CQP AUTRES_PRO SANS_DIPLOME_PROFESSIONNEL
  TOTAL
}

enum VtAgeBand {
  UNDER_14 AGE_14 AGE_15 AGE_16 AGE_17 AGE_18 AGE_19 AGE_20 AGE_21 AGE_22
  AGE_23 AGE_24 AGE_25 AGE_26 AGE_27 AGE_28 AGE_29 AGE_30 AGE_31 AGE_32
  AGE_33 AGE_34 AGE_35 ABOVE_35 TOTAL
}

enum VtTrainerAgeBand      { AGE_18_24 AGE_25_39 AGE_40_59 AGE_60_PLUS TOTAL }
enum VtFlowStatus          { ENTRANT SORTANT ABANDON }
enum VtEducationLevel      { NON_ALPHABETISE PRIMAIRE PREMIER_CYCLE_GENERAL PREMIER_CYCLE_TECHNIQUE
                              SECOND_CYCLE_GENERAL SECOND_CYCLE_TECHNIQUE ENSEIGNEMENT_NORMAL
                              ENSEIGNEMENT_SUPERIEUR TOTAL }
enum VtVulnerableCategory  { MOTEUR VISUEL AUDITIF POLYHANDICAPES REFUGIES ORPHELINS_VULNERABLES
                              DEPLACES_INTERNES RETOURNES BORORO BAKA BAGUIELI TOTAL }
enum VtTrainerDisabilityType { MOTEUR VISUEL AUDITIF POLYHANDICAPES TOTAL }
enum VtTrainingType        { INITIAL CONTINUING }
enum VtTrainerStatus       { VACATAIRE_PROFESSIONNEL VACATAIRE_NON_PROFESSIONNEL PERMANENT TOTAL }
enum VtInfrastructureType  { SALLE_CLASSE ATELIERS_PRATIQUES LABORATOIRES BLOCS_ADMINISTRATIFS
                              SALLE_REUNION SALLE_FORMATEURS BUREAUX MAGASIN ESPACES_TEMPORAIRES }
enum VtFurnitureType       { BANC_1_PLACE BANC_2_PLACES BANC_3_PLACES BANC_4_PLACES_PLUS
                              CHAISES_FORMATEURS TABLES_FORMATEURS ARMOIRES TABLEAUX }
enum VtScholarshipCategory { OTHER_ADMIN INTERNATIONAL TOTAL }
enum VtScholarshipStatus   { GRANTED RECEIVED }
```

No `VtCommsChannel` enum (Decision 2 — channel labels not invented; §7.1.3 uses plain `String[]`).

---

## 6. Child/fact tables (12)

| Model | PDF table(s) | Row grain | Key columns |
|---|---|---|---|
| `OnefopVtDiplomaData` | 4.1, 4.2, 8.1, 8.2 | aggregate cell | `personType, diplomaKind, diploma, gender, value` |
| `OnefopVtTraineeAgeFlow` | 4.7 | aggregate cell | `ageBand, flowStatus, gender, value` |
| `OnefopVtTrainerAge` | 8.3 | aggregate cell | `ageBand, gender, value` |
| `OnefopVtEducationLevelFlow` | 4.8 | aggregate cell | `educationLevel, flowStatus, gender, value` |
| `OnefopVtTraineeVulnerable` | 4.9 | aggregate cell | `category, flowStatus, gender, value` |
| `OnefopVtTrainerDisability` | 8.6 | aggregate cell | `category, gender, value` |
| `OnefopVtScholarship` | 4.11 | aggregate cell | `category, status, gender, value` |
| `OnefopVtSpecialtyRow` | 4.3, 4.4, 4.5, 4.6, 4.10, 6.3, 8.4, 8.7 | repeating respondent row | `tableCode, rowIndex, specialtyText`, plus named `Int?` columns selected by `tableCode` — see §13.1 |
| `OnefopVtCurriculum` | 5.2 | repeating respondent row | `rowIndex, specialtyText, hasCurriculum, isApproved` |
| `OnefopVtInfrastructure` | 5.3 | fixed category row | `infrastructureType, totalCount, permanentGoodCount, permanentBadCount, temporaryCount` |
| `OnefopVtFurniture` | 5.4 | fixed category row | `furnitureType, goodCount, badCount` |
| `OnefopVtTrainerRoster` | 8.8 | **individual named person** | `rowIndex, lastName, firstName, sex, trainerStatus, isAdminPersonnel, academicDiploma, professionalDiploma` |

Every model: `id String @id @default(uuid())`, `submissionId String` FK → `OnefopSubmission.id` (`onDelete: Cascade`), `createdAt DateTime @default(now())`, unique constraint on `[submissionId, <dimension columns>]`, index on `[submissionId]` (plus `[submissionId, tableCode]` for `OnefopVtSpecialtyRow`). Full per-column detail as specified in the VT-0.5 pass; unchanged by this closure.

Row-count corrections carried forward from VT-0.5 (all verified against the extracted PDF text, not re-guessed): 4.3/4.4/4.5/4.6 = 12 rows each; 4.10/8.4/8.7 = 10 rows each (8.7 has no printed Total row); 5.2 = 15 rows; 8.8 = 14 rows.

---

## 7. Geography — Commune

Existing hierarchy unchanged: `Region → Department → Subdivision` (schema.prisma:51-95), resolved via
the existing name-based `resolveGeoAndSector()`. No fourth level exists today and none is added to the
shared tables. `commune` (§1.7) is a **new nullable free-text column on `OnefopVocationalTrainingDetail`
only** — not merged into `locality`, not written into `Subdivision`, no reference table this phase.
`locality` (§1.8, Village-Quartier) reuses the existing column, since it is the same concept the other
six entities already store there.

---

## 8. Specialty strategy

Phase 1: `specialtyText` free text on `OnefopVtSpecialtyRow` and `OnefopVtCurriculum`. No lookup table,
no invented nomenclature — none exists in this repository or any supplied material. Cross-table
consistency within one submission is by `(submissionId, specialtyText)` match. Tables carrying a
specialty dimension: 4.3, 4.4, 4.5, 4.6, 4.10, 5.2, 6.3, 8.4, 8.7 (nine total).

---

## 9. Named personnel roster (§8.8)

`OnefopVtTrainerRoster` — one row per named person, only non-empty rows persisted. Operational/reviewer
use only; excluded from the default statistical/SPSS export; any roster export is separate, explicitly
labelled, and gated to the same reviewer roles already permitted to see the submission. No new
access-control or encryption infrastructure — same posture as the un-encrypted promoter/respondent names
already stored today.

---

## 10. Coherence rules (9, all WARNING, none invented)

1. 4.1 total = 4.2 total (male, female)
2. 4.2 total = Σ 4.5 (male, female)
3. Σ 4.5[FI only] = Σ 4.6 (male, female)
4. 4.2 total = Σ 4.7[ENTRANT] (male, female)
5. 4.2 total = Σ 4.8[ENTRANT] (male, female)
6. Σ 4.7[SORTANT] = Σ 4.10 (male, female)
7. 8.1 total = 8.2 total (male, female)
8. 8.2 total = Σ 8.3 (male, female)
9. 8.2 total = 8.5 total (male, female)

All non-blocking, matching the existing `checkCoherence()` posture. No 10th rule added.

---

## 11. AST sections (9, not 10)

VT's paper form has no separate respondent section — §1.15 sits inside Section 1. The AST mirrors this:
9 sections, matching the instrument's own 9 body sections one-to-one. §1.15's name/function/phone fields
are authored inside Section 1's AST grouping but still target the shared `respondent.*` DTO path /
`OnefopRespondent` table (name, function, phone1, phone2, email only — sex stays on Detail per Decision 5).

---

## 12. VT-1 scope (schema + migration only — not started)

Files to change, all additive, none touching the six existing entities:
- `prisma/schema.prisma`: append `VOCATIONAL_TRAINING` to `OnefopEntityType`; append the 16 enums and 13
  models above; append 13 new relation fields to `OnefopSubmission` (1 Detail 1:1 + 12 children 1:N).
- One new migration file (timestamped after `20260829120000_add_project_program_entity`):
  `20260829130000_add_vocational_training_entity`.
- `src/onefop/onefop.service.ts`: one new key in `getEntityTypeLabel()`.

**Done.** All three applied 2026-08-29. Migration file is written, not applied to the database — applied
manually by the user, per project convention.

No AST, DTO, normalizer, persistence, PDF, or export file changes in VT-1 — those begin at VT-2/VT-4/VT-7/VT-8.

---

## 13. Schema-blocking items from the VT-0.5 verification pass — closed

Separate from decisions 1–5 in §1 above; these affect the Prisma column/enum definitions themselves.
**Sign-off recorded 2026-08-29:**

1. **`OnefopVtSpecialtyRow` — `cell1..cell4` waived, replaced with named nullable `Int?` columns.**
   `tableCode` decides which are filled; unused columns stay null. No JSON, no generic `cellN`:
   - `4.3, 4.4, 4.5, 8.4` → `fiMale, fiFemale, fcMale, fcFemale`
   - `4.6` → `year1Male, year1Female, year2Male, year2Female`
   - `4.10, 6.3` → `male, female, total`
   - `8.7` (page 17 — FI/FC only, no gender split) → `fiCount, fcCount`
2. **`VtTrainerStatus.TOTAL` does not type the roster.** `OnefopVtTrainerRoster.trainerStatus` is
   `String?` (`1`/`2`/`3` as printed). `VtTrainerStatus` (with `TOTAL`) stays in the 16-enum list for
   8.5's vocabulary only — 8.5 itself remains six embedded `Int?` columns on Detail. No 17th enum added.
3. **Roster diplomas:** `academicDiploma VtDiplomaCode?` and `professionalDiploma VtDiplomaCode?`.
   Invariant enforced in application code, not the DB: never `TOTAL`; academic members populate only
   `academicDiploma`, professional members only `professionalDiploma`. The printed list numbers both
   *Autres* and *Sans diplôme* as 12 under the professional list — mapped by meaning to `AUTRES_PRO` /
   `SANS_DIPLOME_PROFESSIONNEL`, not by their shared printed number.
4. **Relation count fixed.** `OnefopSubmission` gets **13** relation fields: 1 Detail (1:1) +
   12 children (1:N). §12 below corrected.

## 14. VT-2 completion notes (AST only, 2026-08-29)

All 9 sections authored in `lib/core/focus/compiler/onefop_ast.dart` (179 `FormQuestionAst` entries,
verified field-by-field against `schema.prisma`'s Detail column list). No DTO/normalizer/persistence/PDF/
export/coherence-runtime code — those are VT-3+.

**Registry files touched beyond the AST** (needed for `vocationalTraining`/`VOCATIONAL_TRAINING` to
compile and behave correctly across the app — none of this is AST content, all of it is additive, none of
the six existing entities' behavior changed):
- `lib/data/minefop_models.dart` — new `EntityType.vocationalTraining` member + its 5 exhaustive switches.
- `lib/screens/onefop/onefop_form_constants.dart` — 3 exhaustive switches.
- `lib/onefop_form_models.dart`, `lib/screens/home_screen.dart` — 2 more exhaustive switches (legacy
  per-entity model system predating the AST pipeline; `vocationalTraining` joins the same "no model
  variant yet" bucket `administration`/`projectProgram` already sit in there).
- `lib/screens/register_widgets.dart` — 1 exhaustive switch, `lib/l10n/app_en.arb`/`app_fr.arb` (+
  generated) — 1 new subtitle string, unreachable in practice (see below) but required to compile.
- `lib/screens/onefop/submissions_viewer_screen.dart` — not compile-mandatory, but without it VT
  submissions would silently render as Enterprise in the reviewer screen.
- `lib/core/focus/compiler/onefop_ast.dart`'s `section0`/`section0Questions` — given an explicit
  entityTypes allow-list (the six pre-existing entities) instead of implicit `null`, so VT doesn't inherit
  a synthetic Section 0. Zero behavior change for the six (they were already always-included).

**Deliberately not done:** `vocationalTraining` was **not** added to `entityConfigs`
(`register_constants.dart`), so it stays hidden from the company self-registration screen. That screen
turned out to already expose `administration`/`projectProgram` live despite stale "placeholder" comments
elsewhere — whether VT should be self-registerable there is a product decision, not an AST one.

**Known gaps carried forward, not closed by VT-2:**
- **Grid rendering.** All `AstFieldType.table`/`repeatingTable` fields with a new VT `template` string
  compile but render as empty/non-functional grids — `table_spec_builder.dart` and
  `form_schema_compiler.dart` have no case for any VT template yet. Same gap already live in production
  for Project & Program's own `kpi_period_table`. Explicit user decision: author AST now, close this in a
  later renderer phase.
- **`AstFieldType.checkbox` has no renderer anywhere in this codebase.** Every VT `String[]`-backed
  multi-select field (agreementTypes, energySourceTypes, the 7.1.3 comms channels, etc. — ~15 fields) uses
  `checkbox` with no `options`, extending §1's Decision 2 (declare the field, defer the option list) to
  every field in the same shape, not just the 5 comms-channel ones it originally covered.
- **§2, §3, §5.1, §8.5, §9 have no per-field PDF codes in this note** — only section-level numbering
  envelopes (e.g. "2.1.1–2.1.16, 2.2.1–2.2.20"). Every question in these sections has `paperCode: null`
  rather than a guessed individual code. Confirmed codes are used everywhere the note actually gives one
  (§1, §6, §7's coded items, all 12 child-table PDF codes).
- **§6.3's row count is confirmed: 10 (PDF p.14).** Closed 2026-08-29 — no longer an analogy-based
  inference. AST's `rows: 10` for `VT6_13`/`specialtyRows_6_3` was already correct; the "UNCONFIRMED"
  comment on it is stale and should read as confirmed.
- **4.3/4.4/4.5's individual meaning is not distinguished, and they remain three separate tableCodes —
  not merged.** All three share identical row/cell shape (12 rows, FI/FC × gender); this pass has no PDF
  text distinguishing what each specifically measures, and no future phase should collapse them into one
  tableCode on that basis. Labels state only the confirmed structural facts (table code, shape), not an
  invented semantic split.
- Source PDF still not available in this repository or session — everything above marked "unconfirmed"
  needs it, or an equivalent authoritative source, to close.

## Open items (not blockers for VT-1, tracked for later phases)

- Required-field policy (`[Plat]` blanket vs. a lighter VT-specific set) — decide before VT-3.
- §7.1.3 channel option list, and every other unconfirmed option list flagged in §14 above — needed
  before VT-3 DTO/normalizer authoring, not before VT-2 AST.
- §4.12 and the page-15 fragment — closed as "not collected"; revisit only if MINEFOP supplies real content.
