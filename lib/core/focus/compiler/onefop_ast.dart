// lib/core/focus/compiler/onefop_ast.dart
//
// Verified against:
//   • Questionnaire_ENTREPRISES_ONEFOP_.pdf
//   • Questionnaire_Coope_rative_ONEFOP_.pdf
//   • Questionnaire_CTD_ONEFOP_.pdf
//   • Questionnaire_ONG_ONEFOP_.pdf
//
// Fixes applied vs previous version:
//   FIX-1  s3q02 tableSpec "rows": 4 → 3  (PDFs show exactly 3 dismissal reasons)
//   FIX-2  Removed s3q02_reason_4_text const (no 4th reason row in any PDF)
//   FIX-3  Removed s3q02_reason_4_text from allQuestions list
//   FIX-4  S1Q12 enterprise size marked requiredField: true (mandatory on PDF)
//   FIX-5  s22q05Other template renamed "vulnerable_csp_rows_table" for clarity
//   FIX-6  section0.title made entity-neutral (was hardcoded to Cooperative variant)
//   FIX-7  Added requiredField: true to all fields (national data collection)
//   FIX-8  Only phone2 fields remain optional (no requiredField)
//   FIX-9  s22q05Other template corrected to "vulnerable_named_rows_table" with
//          named vulnerability rows (Déplacés internes / Réfugiés / Orphelins).
//          "vulnerable_csp_rows_table" no longer exists in TableSpecBuilder;
//          all four entity types now use the same named-rows layout per the PDFs.
//   FIX-10 All display text (titles, labels, hints, instructions, subsections,
//          options) split from combined "French/ English" literals into
//          LocalizedText/LocalizedOption pairs for FR/EN localization. Option
//          *values* are byte-identical to the pre-split combined strings —
//          BackendMappers and dependsValue checks compare against these
//          stored values, so they must never change. tableSpec content
//          (including any "rows" string lists) is untouched: those strings
//          generate grid cell IDs, they are never rendered.

import '../../i18n/localized_text.dart';
import 'form_ast.dart';

// ============================================================
// SECTION 0 - RESPONDENT (IDENTICAL ACROSS ALL ENTITY TYPES)
//
// PDF layout (all four questionnaires):
//   S0Q01  Noms, prénoms du répondant
//   S0Q02  Fonction du répondant
//   S0Q03  Tél 1 | Tél 2 | E-mail
// ============================================================

// Entity types that share the generic Section 0 respondent block below.
// VT-2: Vocational Training deliberately excluded — its printed instrument
// has no separate respondent section (§1.15 sits inside its own Section 1
// instead), so section0/section0Questions must not reach it. This list was
// previously implicit (entityTypes: null on every entry below, meaning
// "all entity types") — made explicit here so a 7th+ entity type is opt-in,
// not opt-out. Behaviorally a no-op for these six: each was already always
// included, and still is.
const _section0EntityTypes = [
  "enterprise",
  "cooperative",
  "ctd",
  "ong",
  "administration",
  "projectProgram",
];

const section0 = SectionAst(
  id: "section0",
  // FIX-6: Was "SECTION 0. IDENTIFICATION DU REPONDANT DE LA COOPERATIVE/
  // IDENTIFICATION OF COOPERATIVE RESPONDENT" — that was the Cooperative-specific
  // title. Section 0 is shared across ALL entity types so the title must be
  // entity-neutral.
  title: LocalizedText(
    fr: "SECTION 0. IDENTIFICATION DU RÉPONDANT",
    en: "SECTION 0. RESPONDENT IDENTIFICATION",
  ),
  order: 0,
  description: LocalizedText(
    fr: "Identification du répondant",
    en: "Respondent identification",
  ),
  entityTypes: _section0EntityTypes,
);

const section0Questions = <FormQuestionAst>[
  FormQuestionAst(
    id: "S0Q01",
    paperCode: "S0Q01",
    label: LocalizedText(
      fr: "Noms, prénoms du répondant",
      en: "Respondent's full name",
    ),
    sectionId: "section0",
    order: 1,
    type: AstFieldType.text,
    entityTypes: _section0EntityTypes,
    requiredField: true,
    path: "respondent.name",
    hint: LocalizedText(fr: "Ex: Jean Dupont", en: "E.g. Jean Dupont"),
  ),
  FormQuestionAst(
    id: "S0Q02",
    paperCode: "S0Q02",
    label: LocalizedText(
      fr: "Fonction du répondant",
      en: "Respondent's function",
    ),
    sectionId: "section0",
    order: 2,
    type: AstFieldType.text,
    entityTypes: _section0EntityTypes,
    requiredField: true,
    path: "respondent.function",
    hint: LocalizedText(fr: "Ex: DRH", en: "E.g. HR Manager"),
  ),
  FormQuestionAst(
    id: "S0Q03_TEL1",
    paperCode: "S0Q03",
    label: LocalizedText(fr: "Téléphone 1", en: "Tel 1"),
    sectionId: "section0",
    order: 3,
    type: AstFieldType.tel,
    entityTypes: _section0EntityTypes,
    requiredField: true,
    path: "respondent.phone1",
    hint: LocalizedText(fr: "Ex: 677123456", en: "E.g. 677123456"),
  ),
  FormQuestionAst(
    id: "S0Q03_TEL2",
    paperCode: "S0Q03",
    label: LocalizedText(fr: "Téléphone 2", en: "Tel 2"),
    sectionId: "section0",
    order: 4,
    type: AstFieldType.tel,
    entityTypes: _section0EntityTypes,
    // NO requiredField - phone2 is optional
    path: "respondent.phone2",
    hint: LocalizedText(fr: "Ex: 699123456", en: "E.g. 699123456"),
  ),
  FormQuestionAst(
    id: "S0Q03_EMAIL",
    paperCode: "S0Q03",
    label: LocalizedText.same("E-mail"),
    sectionId: "section0",
    order: 5,
    type: AstFieldType.email,
    entityTypes: _section0EntityTypes,
    requiredField: true, // FIX-7: Added required
    path: "respondent.email",
    hint: LocalizedText(
      fr: "Ex: contact@entreprise.com",
      en: "E.g. contact@company.com",
    ),
  ),
];

// ============================================================
// SECTION 1 - ENTERPRISE
// PDF: Questionnaire_ENTREPRISES_ONEFOP_
//
// S1Q01  Régime/statut juridique
// S1Q02  Nom de l'entreprise
// S1Q03  Milieu de résidence
// S1Q04  Région / Département / Arrondissement / Localité
// S1Q05  Tél 1 / Tél 2 / BP
// S1Q06  Secteur d'activité
// S1Q07  Branche d'activité
// S1Q08  Activité principale
// S1Q09  Siège social
// S1Q10  Nombre d'employés permanents
// S1Q11  Nombre de postes vacants
// S1Q12  Taille de l'entreprise  ← required (FIX-4)
// ============================================================

const section1Enterprise = SectionAst(
  id: "section1_entreprise",
  title: LocalizedText(
    fr: "SECTION 1. IDENTIFICATION DE L'ENTREPRISE",
    en: "SECTION 1. COMPANY DETAILS",
  ),
  order: 1,
  entityTypes: ["enterprise"],
);

const section1EnterpriseQuestions = <FormQuestionAst>[
  FormQuestionAst(
    id: "S1Q01",
    paperCode: "S1Q01",
    label: LocalizedText(fr: "Régime/statut juridique", en: "Legal status"),
    sectionId: "section1_entreprise",
    order: 1,
    type: AstFieldType.select,
    options: [
      LocalizedOption(
        "Société unipersonnelle/ Single-member company",
        LocalizedText(fr: "Société unipersonnelle", en: "Single-member company"),
      ),
      LocalizedOption("SARL/ LLC", LocalizedText(fr: "SARL", en: "LLC")),
      LocalizedOption("SA/ PLC", LocalizedText(fr: "SA", en: "PLC")),
      LocalizedOption("Autres/ Others", LocalizedText(fr: "Autres", en: "Others")),
    ],
    requiredField: true,
    path: "enterprise.legalStatus",
  ),
  FormQuestionAst(
    id: "S1Q02",
    paperCode: "S1Q02",
    label: LocalizedText(fr: "Nom de l'entreprise", en: "Company name"),
    sectionId: "section1_entreprise",
    order: 2,
    type: AstFieldType.text,
    requiredField: true,
    path: "enterprise.name",
  ),
  FormQuestionAst(
    id: "S1Q03",
    paperCode: "S1Q03",
    label: LocalizedText(fr: "Milieu de résidence", en: "Area"),
    sectionId: "section1_entreprise",
    order: 3,
    type: AstFieldType.radio,
    options: [
      LocalizedOption("Urbain/ Urban", LocalizedText(fr: "Urbain", en: "Urban")),
      LocalizedOption("Rural/ Rural", LocalizedText(fr: "Rural", en: "Rural")),
    ],
    requiredField: true,
    path: "enterprise.area",
  ),
  FormQuestionAst(
    id: "S1Q04_REGION",
    paperCode: "S1Q04",
    label: LocalizedText(fr: "Région", en: "Region"),
    sectionId: "section1_entreprise",
    order: 4,
    type: AstFieldType.text,
    requiredField: true,
    readOnly: true,
    path: "enterprise.region",
  ),
  FormQuestionAst(
    id: "S1Q04_DEPT",
    paperCode: "S1Q04",
    label: LocalizedText(fr: "Département", en: "Division"),
    sectionId: "section1_entreprise",
    order: 5,
    type: AstFieldType.text,
    requiredField: true,
    readOnly: true,
    path: "enterprise.department",
  ),
  FormQuestionAst(
    id: "S1Q04_SUBDIV",
    paperCode: "S1Q04",
    label: LocalizedText(fr: "Arrondissement", en: "Subdivision"),
    sectionId: "section1_entreprise",
    order: 6,
    type: AstFieldType.text,
    requiredField: true,
    readOnly: true,
    path: "enterprise.subdivision",
  ),
  FormQuestionAst(
    id: "S1Q04_LOCALITY",
    paperCode: "S1Q04",
    label: LocalizedText(
      fr: "Quartier/Village/Localité",
      en: "Neighborhood/Village/Locality",
    ),
    sectionId: "section1_entreprise",
    order: 7,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "enterprise.locality",
  ),
  FormQuestionAst(
    id: "S1Q05_TEL1",
    paperCode: "S1Q05",
    label: LocalizedText(fr: "Téléphone 1", en: "Tel 1"),
    sectionId: "section1_entreprise",
    order: 8,
    type: AstFieldType.tel,
    requiredField: true,
    path: "enterprise.phone1",
  ),
  FormQuestionAst(
    id: "S1Q05_TEL2",
    paperCode: "S1Q05",
    label: LocalizedText(fr: "Téléphone 2", en: "Tel 2"),
    sectionId: "section1_entreprise",
    order: 9,
    type: AstFieldType.tel,
    // NO requiredField - phone2 is optional
    path: "enterprise.phone2",
  ),
  FormQuestionAst(
    id: "S1Q05_BP",
    paperCode: "S1Q05",
    label: LocalizedText(fr: "Boîte postale", en: "PO Box"),
    sectionId: "section1_entreprise",
    order: 10,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "enterprise.poBox",
  ),
  FormQuestionAst(
    id: "S1Q06",
    paperCode: "S1Q06",
    label: LocalizedText(fr: "Secteur d'activité", en: "Business sector"),
    sectionId: "section1_entreprise",
    order: 11,
    type: AstFieldType.radio,
    options: [
      LocalizedOption("Primaire/ Primary", LocalizedText(fr: "Primaire", en: "Primary")),
      LocalizedOption(
          "Secondaire/ Secondary", LocalizedText(fr: "Secondaire", en: "Secondary")),
      LocalizedOption(
          "Tertiaire/ Tertiary", LocalizedText(fr: "Tertiaire", en: "Tertiary")),
    ],
    requiredField: true,
    path: "enterprise.sector",
  ),
  FormQuestionAst(
    id: "S1Q07",
    paperCode: "S1Q07",
    label: LocalizedText(fr: "Branche d'activité", en: "Branch of activity"),
    sectionId: "section1_entreprise",
    order: 12,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "enterprise.branch",
  ),
  FormQuestionAst(
    id: "S1Q08",
    paperCode: "S1Q08",
    label: LocalizedText(fr: "Activité principale", en: "Main activity"),
    sectionId: "section1_entreprise",
    order: 13,
    type: AstFieldType.text,
    requiredField: true,
    path: "enterprise.mainActivity",
  ),
  FormQuestionAst(
    id: "S1Q09",
    paperCode: "S1Q09",
    label: LocalizedText(
      fr: "Siège social de l'entreprise",
      en: "Company's head office",
    ),
    sectionId: "section1_entreprise",
    order: 14,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "enterprise.headOffice",
  ),
  FormQuestionAst(
    id: "S1Q10",
    paperCode: "S1Q10",
    label: LocalizedText(
      fr: "Nombre d'employés permanents",
      en: "Number of permanent workers",
    ),
    sectionId: "section1_entreprise",
    order: 15,
    type: AstFieldType.number,
    requiredField: true,
    path: "enterprise.permanentWorkers",
  ),
  FormQuestionAst(
    id: "S1Q11",
    paperCode: "S1Q11",
    label: LocalizedText(
      fr: "Nombre de postes vacants",
      en: "Number of vacancies",
    ),
    sectionId: "section1_entreprise",
    order: 16,
    type: AstFieldType.number,
    requiredField: true, // FIX-7: Added required
    path: "enterprise.vacancies",
  ),
  // FIX-4: requiredField: true — PDF presents this as a mandatory selection
  FormQuestionAst(
    id: "S1Q12",
    paperCode: "S1Q12",
    label: LocalizedText(fr: "Taille de l'entreprise", en: "Enterprise size"),
    sectionId: "section1_entreprise",
    order: 17,
    type: AstFieldType.radio,
    options: [
      LocalizedOption(
          "TPE/ Very small enterprise", LocalizedText(fr: "TPE", en: "Very small enterprise")),
      LocalizedOption("PE/ Small enterprise", LocalizedText(fr: "PE", en: "Small enterprise")),
      LocalizedOption(
          "ME/ Medium-sized enterprise", LocalizedText(fr: "ME", en: "Medium-sized enterprise")),
      LocalizedOption("GE/ Large enterprise", LocalizedText(fr: "GE", en: "Large enterprise")),
    ],
    requiredField: true,
    path: "enterprise.size",
  ),
];

// ============================================================
// SECTION 1 - COOPERATIVE
// PDF: Questionnaire_Coope_rative_ONEFOP_
//
// S1Q01  Nom de la coopérative
// S1Q02  Siège social
// S1Q03  Année de création  (PDF label mistakenly says "head office" — number field, year is correct)
// S1Q04  Milieu de résidence
// S1Q05  Région / Département / Arrondissement / Localité
// S1Q06  Tél 1 / Tél 2 / BP
// S1Q07  Secteur d'activité
// S1Q08  Branche d'activité
// S1Q09  Activité principale
// S1Q10  Type de la coopérative  (+ conditional "other" sub-field)
// S1Q11  Nombre d'employés permanents
// S1Q12  Nombre de postes vacants
// ============================================================

const section1Cooperative = SectionAst(
  id: "section1_cooperative",
  title: LocalizedText(
    fr: "SECTION 1. IDENTIFICATION DE LA COOPERATIVE",
    en: "SECTION 1. COOPERATIVE DETAILS",
  ),
  order: 1,
  entityTypes: ["cooperative"],
);

const section1CooperativeQuestions = <FormQuestionAst>[
  FormQuestionAst(
    id: "COOP_S1Q01",
    paperCode: "S1Q01",
    label: LocalizedText(fr: "Nom de la coopérative", en: "Cooperative name"),
    sectionId: "section1_cooperative",
    order: 1,
    type: AstFieldType.text,
    requiredField: true,
    path: "cooperative.name",
  ),
  FormQuestionAst(
    id: "COOP_S1Q02",
    paperCode: "S1Q02",
    label: LocalizedText(fr: "Siège social", en: "Head office"),
    sectionId: "section1_cooperative",
    order: 2,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "cooperative.headOffice",
  ),
  // Note: PDF label reads "Cooperative head office" for this field — that is a
  // typo in the source document. The field captures the year of creation (number).
  FormQuestionAst(
    id: "COOP_S1Q03",
    paperCode: "S1Q03",
    label: LocalizedText(
      fr: "Année de création de la coopérative",
      en: "Year of creation",
    ),
    sectionId: "section1_cooperative",
    order: 3,
    type: AstFieldType.number,
    requiredField: true, // FIX-7: Added required
    path: "cooperative.yearCreated",
    hint: LocalizedText(fr: "Ex: 2010", en: "E.g. 2010"),
  ),
  FormQuestionAst(
    id: "COOP_S1Q04",
    paperCode: "S1Q04",
    label: LocalizedText(fr: "Milieu de résidence", en: "Area"),
    sectionId: "section1_cooperative",
    order: 4,
    type: AstFieldType.radio,
    options: [
      LocalizedOption("Urbain/ Urban", LocalizedText(fr: "Urbain", en: "Urban")),
      LocalizedOption("Rural/ Rural", LocalizedText(fr: "Rural", en: "Rural")),
    ],
    requiredField: true, // FIX-7: Added required
    path: "cooperative.area",
  ),
  FormQuestionAst(
    id: "COOP_S1Q05_REGION",
    paperCode: "S1Q05",
    label: LocalizedText(fr: "Région", en: "Region"),
    sectionId: "section1_cooperative",
    order: 5,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    readOnly: true,
    path: "cooperative.region",
  ),
  FormQuestionAst(
    id: "COOP_S1Q05_DEPT",
    paperCode: "S1Q05",
    label: LocalizedText(fr: "Département", en: "Division"),
    sectionId: "section1_cooperative",
    order: 6,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    readOnly: true,
    path: "cooperative.department",
  ),
  FormQuestionAst(
    id: "COOP_S1Q05_SUBDIV",
    paperCode: "S1Q05",
    label: LocalizedText(fr: "Arrondissement", en: "Subdivision"),
    sectionId: "section1_cooperative",
    order: 7,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    readOnly: true,
    path: "cooperative.subdivision",
  ),
  FormQuestionAst(
    id: "COOP_S1Q05_LOCALITY",
    paperCode: "S1Q05",
    label: LocalizedText(
      fr: "Quartier/Village/Localité",
      en: "Neighborhood/Village/Locality",
    ),
    sectionId: "section1_cooperative",
    order: 8,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "cooperative.locality",
  ),
  FormQuestionAst(
    id: "COOP_S1Q06_TEL1",
    paperCode: "S1Q06",
    label: LocalizedText(fr: "Téléphone 1", en: "Tel 1"),
    sectionId: "section1_cooperative",
    order: 9,
    type: AstFieldType.tel,
    requiredField: true, // FIX-7: Added required
    path: "cooperative.phone1",
  ),
  FormQuestionAst(
    id: "COOP_S1Q06_TEL2",
    paperCode: "S1Q06",
    label: LocalizedText(fr: "Téléphone 2", en: "Tel 2"),
    sectionId: "section1_cooperative",
    order: 10,
    type: AstFieldType.tel,
    // NO requiredField - phone2 is optional
    path: "cooperative.phone2",
  ),
  FormQuestionAst(
    id: "COOP_S1Q06_BP",
    paperCode: "S1Q06",
    label: LocalizedText(fr: "Boîte postale", en: "PO Box"),
    sectionId: "section1_cooperative",
    order: 11,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "cooperative.poBox",
  ),
  FormQuestionAst(
    id: "COOP_S1Q07",
    paperCode: "S1Q07",
    label: LocalizedText(fr: "Secteur d'activité", en: "Business sector"),
    sectionId: "section1_cooperative",
    order: 12,
    type: AstFieldType.radio,
    options: [
      LocalizedOption("Primaire/ Primary", LocalizedText(fr: "Primaire", en: "Primary")),
      LocalizedOption(
          "Secondaire/ Secondary", LocalizedText(fr: "Secondaire", en: "Secondary")),
      LocalizedOption(
          "Tertiaire/ Tertiary", LocalizedText(fr: "Tertiaire", en: "Tertiary")),
    ],
    requiredField: true, // FIX-7: Added required
    path: "cooperative.sector",
  ),
  FormQuestionAst(
    id: "COOP_S1Q08",
    paperCode: "S1Q08",
    label: LocalizedText(fr: "Branche d'activité", en: "Branch of activity"),
    sectionId: "section1_cooperative",
    order: 13,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "cooperative.branch",
  ),
  FormQuestionAst(
    id: "COOP_S1Q09",
    paperCode: "S1Q09",
    label: LocalizedText(fr: "Activité principale", en: "Main activity"),
    sectionId: "section1_cooperative",
    order: 14,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "cooperative.mainActivity",
  ),
  FormQuestionAst(
    id: "COOP_S1Q10",
    paperCode: "S1Q10",
    label: LocalizedText(fr: "Type de la coopérative", en: "Type of cooperative"),
    sectionId: "section1_cooperative",
    order: 15,
    type: AstFieldType.radio,
    options: [
      LocalizedOption(
        "Coopérative à comptabilité simplifiée",
        LocalizedText(
          fr: "Coopérative à comptabilité simplifiée",
          en: "Cooperative with simplified accounting",
        ),
      ),
      LocalizedOption(
        "Coopérative avec conseil d'administration",
        LocalizedText(
          fr: "Coopérative avec conseil d'administration",
          en: "Cooperative with a board of directors",
        ),
      ),
      LocalizedOption(
        "Autre (à préciser)/ Other (specify)",
        LocalizedText(fr: "Autre (à préciser)", en: "Other (specify)"),
      ),
    ],
    requiredField: true, // FIX-7: Added required
    path: "cooperative.type",
  ),
  FormQuestionAst(
    id: "COOP_S1Q10_OTHER",
    paperCode: "S1Q10",
    label: LocalizedText(fr: "Précisez", en: "Specify"),
    sectionId: "section1_cooperative",
    order: 16,
    type: AstFieldType.text,
    dependsOn: "COOP_S1Q10",
    dependsValue: "Autre (à préciser)/ Other (specify)",
    requiredField: true, // FIX-7: Added required (conditional)
    path: "cooperative.typeOther",
  ),
  FormQuestionAst(
    id: "COOP_S1Q11",
    paperCode: "S1Q11",
    label: LocalizedText(
      fr: "Nombre d'employés permanents",
      en: "Number of permanent workers",
    ),
    sectionId: "section1_cooperative",
    order: 17,
    type: AstFieldType.number,
    requiredField: true, // FIX-7: Added required
    path: "cooperative.permanentWorkers",
  ),
  FormQuestionAst(
    id: "COOP_S1Q12",
    paperCode: "S1Q12",
    label: LocalizedText(
      fr: "Nombre de postes vacants",
      en: "Number of vacancies",
    ),
    sectionId: "section1_cooperative",
    order: 18,
    type: AstFieldType.number,
    requiredField: true, // FIX-7: Added required
    path: "cooperative.vacancies",
  ),
];

// ============================================================
// SECTION 1 - CTD (Collectivités Territoriales Décentralisées)
// PDF: Questionnaire_CTD_ONEFOP_
//
// S1Q01  Type de CTD (Région | Commune)
// S1Q02  Si Commune: type (Commune d'Arrondissement | Communauté Urbaine)  [conditional]
// S1Q03  Année de création de la CTD
// S1Q04  Milieu de résidence
// S1Q05  Région / Département / Arrondissement / Localité
// S1Q06  Tél 1 / Tél 2 / BP
// S1Q07  Secteur d'activité
// S1Q08  Branche d'activité
//         NB: CTD has NO "Activité principale" — PDF goes straight to headcount
// S1Q09  Nombre d'employés permanents
// S1Q10  Nombre de postes vacants
// ============================================================

const section1Ctd = SectionAst(
  id: "section1_ctd",
  title: LocalizedText(
    fr: "SECTION 1. IDENTIFICATION DE LA CTD",
    en: "SECTION 1. RLA DETAILS",
  ),
  order: 1,
  entityTypes: ["ctd"],
);

const section1CtdQuestions = <FormQuestionAst>[
  FormQuestionAst(
    id: "CTD_S1Q01",
    paperCode: "S1Q01",
    label: LocalizedText(fr: "Type de CTD", en: "Type of RLA"),
    sectionId: "section1_ctd",
    order: 1,
    type: AstFieldType.radio,
    options: [
      LocalizedOption("Région/ Region", LocalizedText(fr: "Région", en: "Region")),
      LocalizedOption("Commune/ Council", LocalizedText(fr: "Commune", en: "Council")),
    ],
    requiredField: true,
    path: "ctd.type",
  ),
  FormQuestionAst(
    id: "CTD_S1Q02",
    paperCode: "S1Q02",
    label: LocalizedText(
      fr: "Si 2, Quel est le type de Commune",
      en: "If 2, what type of council",
    ),
    sectionId: "section1_ctd",
    order: 2,
    type: AstFieldType.radio,
    options: [
      LocalizedOption(
        "Commune d'Arrondissement/ Local Council",
        LocalizedText(fr: "Commune d'Arrondissement", en: "Local Council"),
      ),
      LocalizedOption(
        "Communauté Urbaine/ Urban Council",
        LocalizedText(fr: "Communauté Urbaine", en: "Urban Council"),
      ),
    ],
    dependsOn: "CTD_S1Q01",
    dependsValue: "Commune/ Council",
    // Required when visible (CTD type = Commune/Council).
    requiredField: true,
    path: "ctd.councilType",
  ),
  FormQuestionAst(
    id: "CTD_S1Q03",
    paperCode: "S1Q03",
    label: LocalizedText(
      fr: "Année de création de la CTD",
      en: "Year of creation of RLA",
    ),
    sectionId: "section1_ctd",
    order: 3,
    type: AstFieldType.number,
    requiredField: true, // FIX-7: Added required
    path: "ctd.yearCreated",
    hint: LocalizedText(fr: "Ex: 2005", en: "E.g. 2005"),
  ),
  FormQuestionAst(
    id: "CTD_S1Q04",
    paperCode: "S1Q04",
    label: LocalizedText(fr: "Milieu de résidence", en: "Area"),
    sectionId: "section1_ctd",
    order: 4,
    type: AstFieldType.radio,
    options: [
      LocalizedOption("Urbain/ Urban", LocalizedText(fr: "Urbain", en: "Urban")),
      LocalizedOption("Rural/ Rural", LocalizedText(fr: "Rural", en: "Rural")),
    ],
    requiredField: true, // FIX-7: Added required
    path: "ctd.area",
  ),
  FormQuestionAst(
    id: "CTD_S1Q05_REGION",
    paperCode: "S1Q05",
    label: LocalizedText(fr: "Région", en: "Region"),
    sectionId: "section1_ctd",
    order: 5,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    readOnly: true,
    path: "ctd.region",
  ),
  FormQuestionAst(
    id: "CTD_S1Q05_DEPT",
    paperCode: "S1Q05",
    label: LocalizedText(fr: "Département", en: "Division"),
    sectionId: "section1_ctd",
    order: 6,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    readOnly: true,
    path: "ctd.department",
  ),
  FormQuestionAst(
    id: "CTD_S1Q05_SUBDIV",
    paperCode: "S1Q05",
    label: LocalizedText(fr: "Arrondissement", en: "Subdivision"),
    sectionId: "section1_ctd",
    order: 7,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    readOnly: true,
    path: "ctd.subdivision",
  ),
  FormQuestionAst(
    id: "CTD_S1Q05_LOCALITY",
    paperCode: "S1Q05",
    label: LocalizedText(
      fr: "Quartier/Village/Localité",
      en: "Neighborhood/Village/Locality",
    ),
    sectionId: "section1_ctd",
    order: 8,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "ctd.locality",
  ),
  FormQuestionAst(
    id: "CTD_S1Q06_TEL1",
    paperCode: "S1Q06",
    label: LocalizedText(fr: "Téléphone 1", en: "Tel 1"),
    sectionId: "section1_ctd",
    order: 9,
    type: AstFieldType.tel,
    requiredField: true, // FIX-7: Added required
    path: "ctd.phone1",
  ),
  FormQuestionAst(
    id: "CTD_S1Q06_TEL2",
    paperCode: "S1Q06",
    label: LocalizedText(fr: "Téléphone 2", en: "Tel 2"),
    sectionId: "section1_ctd",
    order: 10,
    type: AstFieldType.tel,
    // NO requiredField - phone2 is optional
    path: "ctd.phone2",
  ),
  FormQuestionAst(
    id: "CTD_S1Q06_BP",
    paperCode: "S1Q06",
    label: LocalizedText(fr: "Boîte postale", en: "PO Box"),
    sectionId: "section1_ctd",
    order: 11,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "ctd.poBox",
  ),
  FormQuestionAst(
    id: "CTD_S1Q07",
    paperCode: "S1Q07",
    label: LocalizedText(fr: "Secteur d'activité", en: "Business sector"),
    sectionId: "section1_ctd",
    order: 12,
    type: AstFieldType.radio,
    options: [
      LocalizedOption("Primaire/ Primary", LocalizedText(fr: "Primaire", en: "Primary")),
      LocalizedOption(
          "Secondaire/ Secondary", LocalizedText(fr: "Secondaire", en: "Secondary")),
      LocalizedOption(
          "Tertiaire/ Tertiary", LocalizedText(fr: "Tertiaire", en: "Tertiary")),
    ],
    requiredField: true, // FIX-7: Added required
    path: "ctd.sector",
  ),
  FormQuestionAst(
    id: "CTD_S1Q08",
    paperCode: "S1Q08",
    label: LocalizedText(fr: "Branche d'activité", en: "Branch of activity"),
    sectionId: "section1_ctd",
    order: 13,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "ctd.branch",
  ),
  // NB: CTD has no S1Q09 "Activité principale" — PDF jumps directly to headcount
  FormQuestionAst(
    id: "CTD_S1Q09",
    paperCode: "S1Q09",
    label: LocalizedText(
      fr: "Nombre d'employé permanent",
      en: "Number of permanent workers",
    ),
    sectionId: "section1_ctd",
    order: 14,
    type: AstFieldType.number,
    requiredField: true, // FIX-7: Added required
    path: "ctd.permanentWorkers",
  ),
  FormQuestionAst(
    id: "CTD_S1Q10",
    paperCode: "S1Q10",
    label: LocalizedText(
      fr: "Nombre de poste vacant",
      en: "Number of vacancies",
    ),
    sectionId: "section1_ctd",
    order: 15,
    type: AstFieldType.number,
    requiredField: true, // FIX-7: Added required
    path: "ctd.vacancies",
  ),
];

// ============================================================
// SECTION 1 - ONG (Organisation Non Gouvernementale)
// PDF: Questionnaire_ONG_ONEFOP_
//
// S1Q01  Nom de l'ONG
// S1Q02  Siège social
// S1Q03  Année de création de l'ONG
// S1Q04  Milieu de résidence
// S1Q05  Région / Département / Arrondissement / Localité
// S1Q06  Tél 1 / Tél 2 / BP
// S1Q07  Secteur d'activité
// S1Q08  Branche d'activité
// S1Q09  Mission principale  (replaces "Activité principale" used by other entities)
// S1Q10  Nombre d'employés permanents
// S1Q11  Nombre de postes vacants
// ============================================================

const section1Ong = SectionAst(
  id: "section1_ong",
  title: LocalizedText(
    fr: "SECTION 1. IDENTIFICATION DE L'ONG",
    en: "SECTION 1. NGO DETAILS",
  ),
  order: 1,
  entityTypes: ["ong"],
);

const section1OngQuestions = <FormQuestionAst>[
  FormQuestionAst(
    id: "ONG_S1Q01",
    paperCode: "S1Q01",
    label: LocalizedText(fr: "Nom de l'ONG", en: "NGO's name"),
    sectionId: "section1_ong",
    order: 1,
    type: AstFieldType.text,
    requiredField: true,
    path: "ong.name",
  ),
  FormQuestionAst(
    id: "ONG_S1Q02",
    paperCode: "S1Q02",
    label: LocalizedText(fr: "Siège social", en: "NGO head office"),
    sectionId: "section1_ong",
    order: 2,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "ong.headOffice",
  ),
  FormQuestionAst(
    id: "ONG_S1Q03",
    paperCode: "S1Q03",
    label: LocalizedText(
      fr: "Année de création de l'ONG",
      en: "Year of creation of NGO",
    ),
    sectionId: "section1_ong",
    order: 3,
    type: AstFieldType.number,
    requiredField: true, // FIX-7: Added required
    path: "ong.yearCreated",
    hint: LocalizedText(fr: "Ex: 2008", en: "E.g. 2008"),
  ),
  FormQuestionAst(
    id: "ONG_S1Q04",
    paperCode: "S1Q04",
    label: LocalizedText(fr: "Milieu de résidence", en: "Area"),
    sectionId: "section1_ong",
    order: 4,
    type: AstFieldType.radio,
    options: [
      LocalizedOption("Urbain/ Urban", LocalizedText(fr: "Urbain", en: "Urban")),
      LocalizedOption("Rural/ Rural", LocalizedText(fr: "Rural", en: "Rural")),
    ],
    requiredField: true, // FIX-7: Added required
    path: "ong.area",
  ),
  FormQuestionAst(
    id: "ONG_S1Q05_REGION",
    paperCode: "S1Q05",
    label: LocalizedText(fr: "Région", en: "Region"),
    sectionId: "section1_ong",
    order: 5,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    readOnly: true,
    path: "ong.region",
  ),
  FormQuestionAst(
    id: "ONG_S1Q05_DEPT",
    paperCode: "S1Q05",
    label: LocalizedText(fr: "Département", en: "Division"),
    sectionId: "section1_ong",
    order: 6,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    readOnly: true,
    path: "ong.department",
  ),
  FormQuestionAst(
    id: "ONG_S1Q05_SUBDIV",
    paperCode: "S1Q05",
    label: LocalizedText(fr: "Arrondissement", en: "Subdivision"),
    sectionId: "section1_ong",
    order: 7,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    readOnly: true,
    path: "ong.subdivision",
  ),
  FormQuestionAst(
    id: "ONG_S1Q05_LOCALITY",
    paperCode: "S1Q05",
    label: LocalizedText(
      fr: "Quartier/Village/Localité",
      en: "Neighborhood/Village/Locality",
    ),
    sectionId: "section1_ong",
    order: 8,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "ong.locality",
  ),
  FormQuestionAst(
    id: "ONG_S1Q06_TEL1",
    paperCode: "S1Q06",
    label: LocalizedText(fr: "Téléphone 1", en: "Tel 1"),
    sectionId: "section1_ong",
    order: 9,
    type: AstFieldType.tel,
    requiredField: true, // FIX-7: Added required
    path: "ong.phone1",
  ),
  FormQuestionAst(
    id: "ONG_S1Q06_TEL2",
    paperCode: "S1Q06",
    label: LocalizedText(fr: "Téléphone 2", en: "Tel 2"),
    sectionId: "section1_ong",
    order: 10,
    type: AstFieldType.tel,
    // NO requiredField - phone2 is optional
    path: "ong.phone2",
  ),
  FormQuestionAst(
    id: "ONG_S1Q06_BP",
    paperCode: "S1Q06",
    label: LocalizedText(fr: "Boîte postale", en: "PO Box"),
    sectionId: "section1_ong",
    order: 11,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "ong.poBox",
  ),
  FormQuestionAst(
    id: "ONG_S1Q07",
    paperCode: "S1Q07",
    label: LocalizedText(fr: "Secteur d'activité", en: "Business sector"),
    sectionId: "section1_ong",
    order: 12,
    type: AstFieldType.radio,
    options: [
      LocalizedOption("Primaire/ Primary", LocalizedText(fr: "Primaire", en: "Primary")),
      LocalizedOption(
          "Secondaire/ Secondary", LocalizedText(fr: "Secondaire", en: "Secondary")),
      LocalizedOption(
          "Tertiaire/ Tertiary", LocalizedText(fr: "Tertiaire", en: "Tertiary")),
    ],
    requiredField: true, // FIX-7: Added required
    path: "ong.sector",
  ),
  FormQuestionAst(
    id: "ONG_S1Q08",
    paperCode: "S1Q08",
    label: LocalizedText(fr: "Branche d'activité", en: "Branch of activity"),
    sectionId: "section1_ong",
    order: 13,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "ong.branch",
  ),
  // ONG uses "mission principale" — different from other entities' "activité principale"
  FormQuestionAst(
    id: "ONG_S1Q09",
    paperCode: "S1Q09",
    label: LocalizedText(
      fr: "Quelle est votre mission principale ?",
      en: "What is your main mission ?",
    ),
    sectionId: "section1_ong",
    order: 14,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "ong.mainMission",
  ),
  FormQuestionAst(
    id: "ONG_S1Q10",
    paperCode: "S1Q10",
    label: LocalizedText(
      fr: "Nombre d'employé permanent",
      en: "Number of permanent workers",
    ),
    sectionId: "section1_ong",
    order: 15,
    type: AstFieldType.number,
    requiredField: true, // FIX-7: Added required
    path: "ong.permanentWorkers",
  ),
  FormQuestionAst(
    id: "ONG_S1Q11",
    paperCode: "S1Q11",
    label: LocalizedText(
      fr: "Nombre de poste vacant",
      en: "Number of vacancies",
    ),
    sectionId: "section1_ong",
    order: 16,
    type: AstFieldType.number,
    requiredField: true, // FIX-7: Added required
    path: "ong.vacancies",
  ),
];

// ============================================================
// SECTION 1 - ADMINISTRATION
// PDF: Questionnaire_Administration / Questionnaire_Administration_MINFOPRA
//
// S1Q01  Nom de l'administration
// S1Q02  Sigle
// S1Q03  Milieu de résidence
// S1Q04  Région / Département / Arrondissement / Localité
// S1Q05  Tél 1 / Tél 2 / BP
// S1Q06  Secteur d'activité
// S1Q07  Branche d'activité
// S1Q08  Mission principale
// S1Q09  Existence de projet ? (Oui/Non — S1Q10 conditional on Oui)
// S1Q10  Si oui, combien de projets
// S1Q11  Existence de structures sous tutelle ? (Oui/Non — S1Q12
//        conditional on Oui)
// S1Q12  Si oui, combien de structures sous tutelle
//
// Two source documents exist (Questionnaire_Administration.pdf and
// Questionnaire_Administration_MINFOPRA.pdf) — re-diffed field-by-field
// for the Phase 1 audit and confirmed to be near-identical drafts of the
// same instrument (no distinct institutional branding, no structural
// difference), not two distinct questionnaires. Section 0/1 are
// byte-identical between them; see s21q01Administration and
// s4q02Administration below for the two wording spots that do differ.
// ============================================================

const section1Administration = SectionAst(
  id: "section1_administration",
  title: LocalizedText(
    fr: "SECTION 1. CARACTERISTIQUE DE L'ADMINISTRATION",
    en: "SECTION 1. ADMINISTRATION DETAILS",
  ),
  order: 1,
  entityTypes: ["administration"],
);

const section1AdministrationQuestions = <FormQuestionAst>[
  FormQuestionAst(
    id: "ADMIN_S1Q01",
    paperCode: "S1Q01",
    label: LocalizedText(
        fr: "Nom de l'administration", en: "Administration name"),
    sectionId: "section1_administration",
    order: 1,
    type: AstFieldType.text,
    requiredField: true,
    path: "administration.name",
  ),
  FormQuestionAst(
    id: "ADMIN_S1Q02",
    paperCode: "S1Q02",
    label: LocalizedText(fr: "Sigle", en: "Acronym"),
    sectionId: "section1_administration",
    order: 2,
    type: AstFieldType.text,
    requiredField: true,
    path: "administration.sigle",
  ),
  FormQuestionAst(
    id: "ADMIN_S1Q03",
    paperCode: "S1Q03",
    label: LocalizedText(fr: "Milieu de résidence", en: "Area"),
    sectionId: "section1_administration",
    order: 3,
    type: AstFieldType.radio,
    options: [
      LocalizedOption("Urbain/ Urban", LocalizedText(fr: "Urbain", en: "Urban")),
      LocalizedOption("Rural/ Rural", LocalizedText(fr: "Rural", en: "Rural")),
    ],
    requiredField: true,
    path: "administration.area",
  ),
  FormQuestionAst(
    id: "ADMIN_S1Q04_REGION",
    paperCode: "S1Q04",
    label: LocalizedText(fr: "Région", en: "Region"),
    sectionId: "section1_administration",
    order: 4,
    type: AstFieldType.text,
    requiredField: true,
    readOnly: true,
    path: "administration.region",
  ),
  FormQuestionAst(
    id: "ADMIN_S1Q04_DEPT",
    paperCode: "S1Q04",
    label: LocalizedText(fr: "Département", en: "Division"),
    sectionId: "section1_administration",
    order: 5,
    type: AstFieldType.text,
    requiredField: true,
    readOnly: true,
    path: "administration.department",
  ),
  FormQuestionAst(
    id: "ADMIN_S1Q04_SUBDIV",
    paperCode: "S1Q04",
    label: LocalizedText(fr: "Arrondissement", en: "Subdivision"),
    sectionId: "section1_administration",
    order: 6,
    type: AstFieldType.text,
    requiredField: true,
    readOnly: true,
    path: "administration.subdivision",
  ),
  FormQuestionAst(
    id: "ADMIN_S1Q04_LOCALITY",
    paperCode: "S1Q04",
    label: LocalizedText(
      fr: "Quartier/Village/Localité",
      en: "Neighborhood/Village/Locality",
    ),
    sectionId: "section1_administration",
    order: 7,
    type: AstFieldType.text,
    requiredField: true,
    path: "administration.locality",
  ),
  FormQuestionAst(
    id: "ADMIN_S1Q05_TEL1",
    paperCode: "S1Q05",
    label: LocalizedText(fr: "Téléphone 1", en: "Tel 1"),
    sectionId: "section1_administration",
    order: 8,
    type: AstFieldType.tel,
    requiredField: true,
    path: "administration.phone1",
  ),
  FormQuestionAst(
    id: "ADMIN_S1Q05_TEL2",
    paperCode: "S1Q05",
    label: LocalizedText(fr: "Téléphone 2", en: "Tel 2"),
    sectionId: "section1_administration",
    order: 9,
    type: AstFieldType.tel,
    // NO requiredField - phone2 is optional
    path: "administration.phone2",
  ),
  FormQuestionAst(
    id: "ADMIN_S1Q05_BP",
    paperCode: "S1Q05",
    label: LocalizedText(fr: "Boîte postale", en: "PO Box"),
    sectionId: "section1_administration",
    order: 10,
    type: AstFieldType.text,
    requiredField: true,
    path: "administration.poBox",
  ),
  FormQuestionAst(
    id: "ADMIN_S1Q06",
    paperCode: "S1Q06",
    label: LocalizedText(fr: "Secteur d'activité", en: "Business sector"),
    sectionId: "section1_administration",
    order: 11,
    type: AstFieldType.radio,
    options: [
      LocalizedOption("Primaire/ Primary", LocalizedText(fr: "Primaire", en: "Primary")),
      LocalizedOption(
          "Secondaire/ Secondary", LocalizedText(fr: "Secondaire", en: "Secondary")),
      LocalizedOption(
          "Tertiaire/ Tertiary", LocalizedText(fr: "Tertiaire", en: "Tertiary")),
    ],
    requiredField: true,
    path: "administration.sector",
  ),
  FormQuestionAst(
    id: "ADMIN_S1Q07",
    paperCode: "S1Q07",
    label: LocalizedText(fr: "Branche d'activité", en: "Branch of activity"),
    sectionId: "section1_administration",
    order: 12,
    type: AstFieldType.text,
    requiredField: true,
    path: "administration.branch",
  ),
  FormQuestionAst(
    id: "ADMIN_S1Q08",
    paperCode: "S1Q08",
    label: LocalizedText(fr: "Mission principale", en: "Main mission"),
    sectionId: "section1_administration",
    order: 13,
    type: AstFieldType.text,
    requiredField: true,
    path: "administration.mainMission",
  ),
  // S1Q09/S1Q11 conditional skip-branches — a structure not present in
  // any other entity type's Section 1. Uses the existing
  // dependsOn/dependsValue mechanism (already exercised by Cooperative's
  // COOP_S1Q10_OTHER and a CTD field) — no new plumbing required.
  FormQuestionAst(
    id: "ADMIN_S1Q09",
    paperCode: "S1Q09",
    label: LocalizedText(
      fr: "Existence de projet ?",
      en: "Existence of a project?",
    ),
    sectionId: "section1_administration",
    order: 14,
    type: AstFieldType.radio,
    options: [
      LocalizedOption("Oui/ Yes", LocalizedText(fr: "Oui", en: "Yes")),
      LocalizedOption("Non/ No", LocalizedText(fr: "Non", en: "No")),
    ],
    requiredField: true,
    path: "administration.hasProject",
  ),
  FormQuestionAst(
    id: "ADMIN_S1Q10",
    paperCode: "S1Q10",
    label: LocalizedText(
      fr: "Combien de projets ?",
      en: "How many projects?",
    ),
    sectionId: "section1_administration",
    order: 15,
    type: AstFieldType.number,
    dependsOn: "ADMIN_S1Q09",
    dependsValue: "Oui/ Yes",
    requiredField: true,
    path: "administration.projectCount",
  ),
  FormQuestionAst(
    id: "ADMIN_S1Q11",
    paperCode: "S1Q11",
    label: LocalizedText(
      fr: "Existence de structures sous tutelle ?",
      en: "Existence of structures under supervision?",
    ),
    sectionId: "section1_administration",
    order: 16,
    type: AstFieldType.radio,
    options: [
      LocalizedOption("Oui/ Yes", LocalizedText(fr: "Oui", en: "Yes")),
      LocalizedOption("Non/ No", LocalizedText(fr: "Non", en: "No")),
    ],
    requiredField: true,
    path: "administration.hasSupervisedStructures",
  ),
  FormQuestionAst(
    id: "ADMIN_S1Q12",
    paperCode: "S1Q12",
    label: LocalizedText(
      fr: "Combien de structures sous tutelle ?",
      en: "How many structures under supervision?",
    ),
    sectionId: "section1_administration",
    order: 17,
    type: AstFieldType.number,
    dependsOn: "ADMIN_S1Q11",
    dependsValue: "Oui/ Yes",
    requiredField: true,
    path: "administration.supervisedStructureCount",
  ),
];

// ============================================================
// SECTION 2/3/4 - ADMINISTRATION VARIANTS
//
// Administration's recensement/recrutement/départs tables use SFP status
// rows (Fonctionnaire / Décisionnaire / Contractuelle) instead of the CSP
// rows (Cadres / Agents de Maîtrise / Agents d'exécution) the other four
// entity types use — confirmed against both source documents.
//
// Administration's Section 2 is S21Q01–S21Q04 (see the block below):
// disability = S21Q03 (category × sex), vulnerable = S21Q04 (nature × sex),
// neither with a permanent/temporary status. Enterprise-family entities
// keep S22Q04 (CSP × status × sex) and S22Q05 (nature × status × sex).
//
// S3Q03 is deliberately NOT implemented for Administration in this pass
// — its row labels could not be visually confirmed against the
// authoritative PDF (only extracted text was available, and the
// extraction was ambiguous for this specific table). Flagged for
// follow-up once confirmed.
//
// Each variant below deliberately reuses the SAME id/paperCode as its
// shared enterprise-family counterpart, with entityTypes restricted to
// exactly one of the two — the compiler filters by entityType before
// building the schema, so only one of a pair ever survives for a given
// entity, and the shared tableResponseStatus() entries for S21Q01,
// S22Q01, S3Q01, S4Q02 (left unrestricted above) apply to whichever
// variant is active — matching how S22Q05_RESPONSE_STATUS already
// applies uniformly across the existing S22Q05_ENTERPRISE/S22Q05_OTHER
// variants.
// ============================================================

// ADMINISTRATION SECTION 2 — renumbered in chronological order (decision
// of 2026-09-28, see docs/onefop-cross-form-hybrid-table-audit.md §K).
// The paper form printed the census and recruitment tables under the same
// code "S21Q01" and then jumped to "S22Q04"/"S22Q05". Administration now
// uses S21Q01 → S21Q04, in the order the questions appear:
//   S21Q01 effectifs recensés     (catégorie × sexe × âge)
//   S21Q02 recrutements           (catégorie × sexe × âge)   was S22Q01
//   S21Q03 recrutés handicapés    (catégorie × sexe)         was S22Q04
//   S21Q04 recrutés vulnérables   (nature × sexe)            was S22Q05
// Administration has no permanent/temporary status: its categories are the
// civil-service ones (fonctionnaire, décisionnaire, contractuelle), so the
// disability and vulnerability tables carry no status dimension
// ("statuses": [] — honoured by FormSchemaCompiler). No 2.x subsection
// heading: the paper form has none under "SECTION 2. RECRUTEMENTS".

const _adminCategories = ["fonctionnaire", "decisionnaire", "contractuelle"];

const s21q01Administration = FormQuestionAst(
  id: "S21Q01",
  paperCode: "S21Q01",
  label: LocalizedText(
    fr: "Combien de personnes avez-vous recensé selon la catégorie "
        "socioprofessionnelle (fonctionnaire, décisionnaire, contractuelle), "
        "le sexe et la tranche d'âge du 1er Janvier 2026 à ce jour ?",
    en: "How many people did you count per socio-professional category "
        "(civil servant, decision-maker, contractual), sex and age group "
        "from the 1st of January 2026 to the present day?",
  ),
  sectionId: "section2",
  order: 1,
  type: AstFieldType.table,
  entityTypes: ["administration"],
  tableSpec: {
    "template": "csp_gender_age_table",
    "prefix": "s21q01",
    "rows": _adminCategories,
    "genders": ["male", "female", "total"],
    "age_bands": ["15_24", "25_34", "35_plus"],
  },
);

const s21q02Administration = FormQuestionAst(
  id: "S21Q02",
  paperCode: "S21Q02",
  label: LocalizedText(
    fr: "Combien de personnes avez-vous recruté selon la catégorie "
        "socioprofessionnelle (fonctionnaire, décisionnaire, contractuelle), "
        "le sexe et la tranche d'âge du 1er Janvier 2026 à ce jour ?",
    en: "How many people did you recruit per socio-professional category "
        "(civil servant, decision-maker, contractual), sex and age group "
        "from the 1st of January 2026 to the present day?",
  ),
  sectionId: "section2",
  order: 2,
  type: AstFieldType.table,
  entityTypes: ["administration"],
  tableSpec: {
    "template": "csp_gender_age_table",
    "prefix": "s21q02",
    "rows": _adminCategories,
    "genders": ["male", "female", "total"],
    "age_bands": ["15_24", "25_34", "35_plus"],
  },
);

const s21q03Administration = FormQuestionAst(
  id: "S21Q03",
  paperCode: "S21Q03",
  label: LocalizedText(
    fr: "Combien de personnes en situation de handicap avez-vous recruté "
        "selon la catégorie socioprofessionnelle (fonctionnaire, "
        "décisionnaire, contractuelle) et le sexe du 1er Janvier 2026 à ce "
        "jour ?",
    en: "How many people with a disability did you recruit per "
        "socio-professional category (civil servant, decision-maker, "
        "contractual) and sex from the 1st of January 2026 to the present "
        "day?",
  ),
  sectionId: "section2",
  order: 3,
  type: AstFieldType.table,
  entityTypes: ["administration"],
  tableSpec: {
    "template": "csp_status_gender_table",
    "prefix": "s21q03",
    "rows": _adminCategories,
    "statuses": <String>[],
    "genders": ["male", "female", "total"],
  },
);

const s21q04Administration = FormQuestionAst(
  id: "S21Q04",
  paperCode: "S21Q04",
  label: LocalizedText(
    fr: "Combien de personnes vulnérables avez-vous recruté selon la nature "
        "de la vulnérabilité et le sexe du 1er Janvier 2026 à ce jour ?",
    en: "How many vulnerable people did you recruit per nature of "
        "vulnerability and sex from the 1st of January 2026 to the present "
        "day?",
  ),
  sectionId: "section2",
  order: 4,
  type: AstFieldType.table,
  entityTypes: ["administration"],
  tableSpec: {
    "template": "vulnerable_named_rows_table",
    "prefix": "s21q04",
    "rows": [
      "Déplacés internes/ Internal displaced",
      "Réfugiés/ Refugees",
      "Orphelins/ Orphans",
    ],
    "statuses": <String>[],
    "genders": ["male", "female", "total"],
  },
);

const s3q01Administration = FormQuestionAst(
  id: "S3Q01",
  paperCode: "S3Q01",
  label: LocalizedText(
    fr: "Combien de départs avez-vous enregistrés du 1er Janvier 2025 à "
        "ce jour?",
    en: "How many departures did you register from the 1st of January "
        "2025 to the present day?",
  ),
  sectionId: "section3",
  order: 1,
  type: AstFieldType.table,
  entityTypes: ["administration"],
  tableSpec: {
    "template": "departure_table",
    "prefix": "s3q01",
    "rows": ["fonctionnaire", "decisionnaire", "contractuelle"],
    "departure_types": [
      "dismissal",
      "resignation",
      "retirement",
      "other",
      "ensemble",
    ],
    "genders": ["male", "female", "total"],
  },
);

// DOCUMENTED ASSUMPTION (unresolved wording discrepancy — see Phase 1
// audit): Questionnaire_Administration.pdf reads "de votre administration"
// (singular); the MINFOPRA draft reads "des administrations" (plural) in
// French only — both documents' English text reads "of your
// administration" identically. The singular French wording is used here
// as the one internally consistent with its own English counterpart in
// both documents — not yet confirmed with the instrument owner.
const s4q02Administration = FormQuestionAst(
  id: "S4Q02",
  paperCode: "S4Q02",
  label: LocalizedText(
    fr: "Quels sont les besoins en compétence de votre administration? "
        "(énumérer les 3 compétences prioritaires)",
    en: "What are the skills needs of your administration? (list the 3 "
        "priority skills)",
  ),
  sectionId: "section4",
  order: 2,
  type: AstFieldType.table,
  entityTypes: ["administration"],
  tableSpec: {
    "template": "skills_table",
    "prefix": "s4q02",
    "rows": 3,
    "fields": ["skill_description", "male", "female", "total"],
  },
);

// ============================================================
// SECTION 2 - EMPLOI ET TRAVAIL/ EMPLOYMENT AND LABOUR
//
// Identical across all four questionnaires except S22Q05
// (see entity-specific variants below).
// ============================================================

const section2 = SectionAst(
  id: "section2",
  title: LocalizedText(
    fr: "SECTION 2. EMPLOI ET TRAVAIL",
    en: "SECTION 2. EMPLOYMENT AND LABOUR",
  ),
  order: 2,
  // Every question in this section restricts itself to some subset of
  // {enterprise, cooperative, ctd, ong, administration} — Administration
  // has its own real content here too (s21q01Administration …
  // s21q04Administration, Administration's chronological S21Q01–S21Q04), it just
  // never uses the exact 4-tuple every other question in this section
  // does. The section declaration itself was missing any restriction at
  // all, so with entityTypes left at its implicit-null "always included"
  // default, the compiler included this section for every entity type,
  // ProjectProgram/VocationalTraining included even though neither has any
  // question here — same class of gap section0 was already fixed for (see
  // _section0EntityTypes above), just missed here. VT specifically renders
  // this leak as a second, blank "SECTION 4. STAGE ET FORMATION"
  // ("training") page.
  entityTypes: ["enterprise", "cooperative", "ctd", "ong", "administration"],
);

// ----------------------------------------------------------
// 2.1 DEMANDE D'EMPLOIS/ JOB APPLICATION
// ----------------------------------------------------------

const s21q01 = FormQuestionAst(
  id: "S21Q01",
  paperCode: "S21Q01",
  subsection: LocalizedText(
    fr: "2.1 DEMANDE D'EMPLOIS",
    en: "2.1 JOB APPLICATION",
  ),
  label: LocalizedText(
    fr: "Combien de demandes d'emplois avez-vous enregistré selon la "
        "catégorie socioprofessionnelle, le sexe et la tranche d'âge du "
        "premier Janvier 2025 à ce jour ?",
    en: "How many job applications per socio-professional category, gender "
        "and age group did you register from the 1st of January 2025 to "
        "the present day?",
  ),
  sectionId: "section2",
  order: 1,
  type: AstFieldType.table,
  // Administration has its own SFP-row variant (s21q01Administration) —
  // see ADMINISTRATION SECTION 1-4 block below.
  entityTypes: ["enterprise", "cooperative", "ctd", "ong"],
  tableSpec: {
    "template": "csp_gender_age_table",
    "prefix": "s21q01",
    "rows": ["cadres", "foremen", "workers"],
    "genders": ["male", "female", "total"],
    "age_bands": ["15_24", "25_34", "35_plus"],
  },
);

// ----------------------------------------------------------
// 2.2 RECRUTEMENTS/ RECRUITMENTS
// ----------------------------------------------------------

const s22q01 = FormQuestionAst(
  id: "S22Q01",
  paperCode: "S22Q01",
  subsection: LocalizedText(fr: "2.2 RECRUTEMENTS", en: "2.2 RECRUITMENTS"),
  label: LocalizedText(
    fr: "Combien de permanents avez-vous recruté selon la catégorie "
        "socioprofessionnelle, le sexe et la tranche d'âge du premier "
        "Janvier 2025 à ce jour?",
    en: "How many permanent workers per socio-professional category, "
        "gender and age group did you recruit from the 1st of January "
        "2025 to the present day?",
  ),
  sectionId: "section2",
  order: 2,
  type: AstFieldType.table,
  // Administration collapses permanent+temporary into one SFP-row table
  // (s21q02Administration, formerly S22Q01) — see
  // ADMINISTRATION SECTION 1-4 block below.
  entityTypes: ["enterprise", "cooperative", "ctd", "ong"],
  tableSpec: {
    "template": "csp_gender_age_table",
    "prefix": "s22q01",
    "rows": ["cadres", "foremen", "workers"],
    "genders": ["male", "female", "total"],
    "age_bands": ["15_24", "25_34", "35_plus"],
  },
);

const s22q02 = FormQuestionAst(
  id: "S22Q02",
  paperCode: "S22Q02",
  subsection: LocalizedText(fr: "2.2 RECRUTEMENTS", en: "2.2 RECRUITMENTS"),
  label: LocalizedText(
    fr: "Combien de temporaires avez-vous recruté selon la catégorie "
        "socioprofessionnelle, le sexe et la tranche d'âge du premier "
        "Janvier 2025 à ce jour?",
    en: "How many temporary workers per socio-professional category, "
        "gender and age group did you recruit from the 1st of January "
        "2025 to the present day?",
  ),
  sectionId: "section2",
  order: 3,
  type: AstFieldType.table,
  // Administration has no separate temporary-recruitment table — folded
  // into s21q02Administration (formerly S22Q01).
  entityTypes: ["enterprise", "cooperative", "ctd", "ong"],
  tableSpec: {
    "template": "csp_gender_age_table",
    "prefix": "s22q02",
    "rows": ["cadres", "foremen", "workers"],
    "genders": ["male", "female", "total"],
    "age_bands": ["15_24", "25_34", "35_plus"],
  },
);

const s22q03 = FormQuestionAst(
  id: "S22Q03",
  paperCode: "S22Q03",
  subsection: LocalizedText(fr: "2.2 RECRUTEMENTS", en: "2.2 RECRUITMENTS"),
  label: LocalizedText(
    fr: "Combien de personnes avez-vous recruté selon la catégorie "
        "socioprofessionnelle, le sexe, le diplôme et la tranche d'âge du "
        "premier Janvier 2026 à ce jour?",
    en: "How many workers per socio-professional category, gender, "
        "diploma and age group did you recruit from 1st January 2026 to "
        "date?",
  ),
  sectionId: "section2",
  order: 4,
  type: AstFieldType.table,
  // Administration has no diploma-breakdown recruitment table.
  entityTypes: ["enterprise", "cooperative", "ctd", "ong"],
  tableSpec: {
    // NOTE: these row strings are NOT rendered — TableSpecBuilder is the
    // live renderer for this table and defines its own localized diploma
    // labels. This list only feeds grid cell-ID generation and must stay
    // untouched (changing it would change stored data keys).
    "template": "diploma_gender_age_table",
    "prefix": "s22q03",
    "csps": ["cadres", "foremen", "workers"],
    "rows": [
      "CEP/ CEPE/ FSLC",
      "BEPC/ CAP/ GCE-OL",
      "PROBATOIRE/ Lower sixth",
      "BAC/ GCE-AL",
      "BTS/ DUT/ HND",
      "Licence (Bac+3)/ Bachelor",
      "Maîtrise (Bac+4)/ Master 1",
      "Master (Bac+5)/ Master 2",
      "DQP/ PQD",
      "CQP/ CPQ",
      "Autres/ Others",
      "Sans diplôme/ Without diploma",
    ],
    "genders": ["male", "female", "total"],
    "age_bands": ["15_24", "25_34", "35_plus"],
  },
);

const s22q04 = FormQuestionAst(
  id: "S22Q04",
  paperCode: "S22Q04",
  subsection: LocalizedText(fr: "2.2 RECRUTEMENTS", en: "2.2 RECRUITMENTS"),
  label: LocalizedText(
    fr: "Combien de personnes en situation de handicap avez-vous recruté "
        "selon la catégorie socio professionnelle, le sexe et le statut "
        "du 1er Janvier 2025 à ce jour?",
    en: "How many workers with a disability per socio-professional "
        "category, gender, and status did you recruit from the 1st of "
        "January 2025 to the present day?",
  ),
  sectionId: "section2",
  order: 5,
  type: AstFieldType.table,
  entityTypes: ["enterprise", "cooperative", "ctd", "ong"],
  tableSpec: {
    "template": "csp_status_gender_table",
    "prefix": "s22q04",
    "rows": ["cadres", "foremen", "workers"],
    "statuses": ["permanent", "temporary"],
    "genders": ["male", "female", "total"],
  },
);

// S22Q05 — Enterprise variant
// PDF rows: Déplacés internes | Réfugiés | Orphelins  (named vulnerability types)
const s22q05Enterprise = FormQuestionAst(
  id: "S22Q05_ENTERPRISE",
  paperCode: "S22Q05",
  subsection: LocalizedText(fr: "2.2 RECRUTEMENTS", en: "2.2 RECRUITMENTS"),
  label: LocalizedText(
    fr: "Combien de personnes vulnérables avez-vous recruté selon le "
        "statut et la nature de la vulnérabilité du 1er Janvier 2025 à ce "
        "jour?",
    en: "How many vulnerable workers per status and nature of "
        "vulnerability did you recruit from the 1st of January 2025 to "
        "the present day?",
  ),
  sectionId: "section2",
  order: 6,
  type: AstFieldType.table,
  entityTypes: ["enterprise"],
  tableSpec: {
    "template": "vulnerable_named_rows_table",
    "prefix": "s22q05_ent",
    "rows": [
      "Déplacés internes/ Internal displaced",
      "Réfugiés/ Refugees",
      "Orphelins/ Orphans",
    ],
    "statuses": ["permanent", "temporary"],
    "genders": ["male", "female", "total"],
  },
);

// S22Q05 — Cooperative / CTD / ONG variant
// FIX-9: Template corrected from "vulnerable_csp_rows_table" (which no longer
// exists in TableSpecBuilder) to "vulnerable_named_rows_table". Cooperative, CTD,
// and ONG use named vulnerability rows per the official ONEFOP PDFs:
//   Déplacés internes / Réfugiés / Orphelins
// Enterprise has its own variant (S22Q05_ENTERPRISE) with the same row structure.
// The prefix is kept as "s22q05_oth" to preserve any existing saved data.
const s22q05Other = FormQuestionAst(
  id: "S22Q05_OTHER",
  paperCode: "S22Q05",
  subsection: LocalizedText(fr: "2.2 RECRUTEMENTS", en: "2.2 RECRUITMENTS"),
  label: LocalizedText(
    fr: "Combien de personnes vulnérables avez-vous recruté selon le "
        "statut et la nature de la vulnérabilité du 1er Janvier 2025 à ce "
        "jour?",
    en: "How many vulnerable workers per status and nature of "
        "vulnerability did you recruit from the 1st of January 2025 to "
        "the present day?",
  ),
  sectionId: "section2",
  order: 6,
  type: AstFieldType.table,
  // Administration's vulnerable-recruit table is S21Q04 (nature × sexe,
  // no status) since the 2026-09-28 renumbering.
  entityTypes: ["cooperative", "ctd", "ong"],
  tableSpec: {
    "template":
        "vulnerable_named_rows_table", // FIX-9: was "vulnerable_csp_rows_table"
    "prefix": "s22q05_oth",
    "rows": [
      "Déplacés internes/ Internal displaced", // FIX-9: was CSP rows
      "Réfugiés/ Refugees",
      "Orphelins/ Orphans",
    ],
    "statuses": ["permanent", "temporary"],
    "genders": ["male", "female", "total"],
  },
);

// ----------------------------------------------------------
// 2.3 PRIMO DEMANDEUR/ FIRST-TIME JOB SEEKER
// ----------------------------------------------------------

const s23q01 = FormQuestionAst(
  id: "S23Q01",
  paperCode: "S23Q01",
  subsection: LocalizedText(
    fr: "2.3 PRIMO DEMANDEUR (personne à la recherche de son premier emploi)",
    en: "2.3 FIRST-TIME JOB SEEKER",
  ),
  label: LocalizedText(
    fr: "Combien de personnes recherchant leur premier emploi avez-vous "
        "enregistré selon la catégorie socioprofessionnelle, le sexe et "
        "la tranche d'âge du premier Janvier 2025 à ce jour?",
    en: "How many people looking for their first job per "
        "socio-professional category, gender and age group did you "
        "register from the 1st of January 2025 to the present day?",
  ),
  sectionId: "section2",
  order: 7,
  type: AstFieldType.table,
  // Administration has no "Primo demandeur" section.
  entityTypes: ["enterprise", "cooperative", "ctd", "ong"],
  tableSpec: {
    "template": "csp_gender_age_table",
    "prefix": "s23q01",
    "rows": ["cadres", "foremen", "workers"],
    "genders": ["male", "female", "total"],
    "age_bands": ["15_24", "25_34", "35_plus"],
  },
);

const s23q02 = FormQuestionAst(
  id: "S23Q02",
  paperCode: "S23Q02",
  subsection: LocalizedText(
    fr: "2.3 PRIMO DEMANDEUR (personne à la recherche de son premier emploi)",
    en: "2.3 FIRST-TIME JOB SEEKER",
  ),
  label: LocalizedText(
    fr: "Combien de personnes travaillant pour la première fois avez-vous "
        "recrutées selon le statut, la catégorie socioprofessionnelle, le sexe et "
        "la tranche d'âge du premier Janvier 2026 à ce jour?",
    en: "How many first-time workers did you recruit per contract status, "
        "socio-professional category, gender and age group from 1st "
        "January 2026 to date?",
  ),
  sectionId: "section2",
  order: 8,
  type: AstFieldType.table,
  // Administration has no "Primo demandeur" section.
  entityTypes: ["enterprise", "cooperative", "ctd", "ong"],
  tableSpec: {
    "template": "first_time_workers_table",
    "prefix": "s23q02",
    "statuses": ["permanent", "temporary"],
    "rows": ["cadres", "foremen", "workers"],
    "genders": ["male", "female", "total"],
    "age_bands": ["15_24", "25_34", "35_plus"],
  },
);

// ============================================================
// SECTION 3 - DÉPARTS/ DEPARTURES
// ============================================================

const section3 = SectionAst(
  id: "section3",
  title: LocalizedText(fr: "SECTION 3. DÉPARTS", en: "SECTION 3. DEPARTURES"),
  order: 3,
  // Same gap as section2 above, same fix — see its comment.
  // Administration has s3q01Administration here too.
  entityTypes: ["enterprise", "cooperative", "ctd", "ong", "administration"],
);

const s3q01 = FormQuestionAst(
  id: "S3Q01",
  paperCode: "S3Q01",
  label: LocalizedText(
    fr: "Combien de départs avez-vous enregistrés du 1er Janvier 2025 à "
        "ce jour?",
    en: "How many departures did you register from the 1st of January "
        "2025 to the present day?",
  ),
  sectionId: "section3",
  order: 1,
  type: AstFieldType.table,
  // Administration has its own SFP-row variant (s3q01Administration, same
  // id, disjoint entityTypes) — see ADMINISTRATION SECTION 1-4 block below.
  entityTypes: ["enterprise", "cooperative", "ctd", "ong"],
  tableSpec: {
    "template": "departure_table",
    "prefix": "s3q01",
    "rows": ["cadres", "foremen", "workers"],
    "departure_types": [
      "dismissal",
      "resignation",
      "retirement",
      "other",
      "ensemble",
    ],
    "genders": ["male", "female", "total"],
  },
);

// FIX-1: "rows": 3 — all four PDFs show exactly 3 dismissal reason rows
//         (Motif 1 / Motif 2 / Motif 3).  Was incorrectly set to 4.
const s3q02 = FormQuestionAst(
  id: "S3Q02",
  paperCode: "S3Q02",
  label: LocalizedText(
    fr: "Quels sont les principaux motifs de licenciement ?",
    en: "What are the main grounds for dismissal?",
  ),
  sectionId: "section3",
  order: 2,
  type: AstFieldType.table,
  tableSpec: {
    "template": "reasons_table",
    "prefix": "s3q02",
    "rows": 3,
    "fields": ["reason_text", "male", "female", "total"],
  },
);

// FIX-2: 3 text fields only — matches the 3 PDF rows exactly.
//         s3q02_reason_4_text has been removed.
// ignore: constant_identifier_names
const s3q02_reason_1_text = FormQuestionAst(
  id: "S3Q02_REASON_1_TEXT",
  paperCode: "S3Q02",
  label: LocalizedText(fr: "Motif de licenciement 1", en: "Dismissal reason 1"),
  sectionId: "section3",
  order: 2,
  type: AstFieldType.text,
  requiredField: true,
  path: "section3.dismissalReasons.reason1.text",
  hint: LocalizedText(
    fr: "Décrivez le motif de licenciement",
    en: "Describe the reason for dismissal",
  ),
  instruction: LocalizedText(
    fr: "Précisez la raison du licenciement",
    en: "Specify the reason for dismissal",
  ),
);

// ignore: constant_identifier_names
const s3q02_reason_2_text = FormQuestionAst(
  id: "S3Q02_REASON_2_TEXT",
  paperCode: "S3Q02",
  label: LocalizedText(fr: "Motif de licenciement 2", en: "Dismissal reason 2"),
  sectionId: "section3",
  order: 2,
  type: AstFieldType.text,
  requiredField: true,
  path: "section3.dismissalReasons.reason2.text",
  hint: LocalizedText(
    fr: "Décrivez le motif de licenciement",
    en: "Describe the reason for dismissal",
  ),
  instruction: LocalizedText(
    fr: "Précisez la raison du licenciement",
    en: "Specify the reason for dismissal",
  ),
);

// ignore: constant_identifier_names
const s3q02_reason_3_text = FormQuestionAst(
  id: "S3Q02_REASON_3_TEXT",
  paperCode: "S3Q02",
  label: LocalizedText(fr: "Motif de licenciement 3", en: "Dismissal reason 3"),
  sectionId: "section3",
  order: 2,
  type: AstFieldType.text,
  requiredField: true,
  path: "section3.dismissalReasons.reason3.text",
  hint: LocalizedText(
    fr: "Décrivez le motif de licenciement",
    en: "Describe the reason for dismissal",
  ),
  instruction: LocalizedText(
    fr: "Précisez la raison du licenciement",
    en: "Specify the reason for dismissal",
  ),
);

const s3q03 = FormQuestionAst(
  id: "S3Q03",
  paperCode: "S3Q03",
  label: LocalizedText(
    fr: "Combien de personnes avez-vous licenciées ou mises en chômage "
        "technique du 1er Janvier 2026 à ce jour?",
    en: "How many people were dismissed or placed on technical unemployment "
        "from 1st January 2026 to date?",
  ),
  sectionId: "section3",
  order: 3,
  type: AstFieldType.table,
  // Administration's S3Q03 row labels are not confirmed against the
  // authoritative PDF (extraction was ambiguous — the "SFP/CSS" table
  // header groups 3 unlabeled rows) and the instruction gating this
  // implementation required visual verification before coding it, which
  // was not available. Deliberately NOT implemented for Administration in
  // this pass — flagged for follow-up once the row labels are confirmed.
  entityTypes: ["enterprise", "cooperative", "ctd", "ong"],
  tableSpec: {
    "template": "dismissal_unemployment_table",
    "prefix": "s3q03",
    "rows": ["cadres", "foremen", "workers"],
    "types": ["dismissal", "technical_unemployment"],
    "genders": ["male", "female", "total"],
  },
);

// ============================================================
// SECTION 4 - STAGE ET FORMATION/ INTERNSHIP AND TRAINING
// ============================================================

const section4 = SectionAst(
  id: "section4",
  title: LocalizedText(
    fr: "SECTION 4. STAGE ET FORMATION",
    en: "SECTION 4. INTERNSHIP AND TRAINING",
  ),
  order: 4,
  // Same gap as section2 above, same fix — see its comment. This is the
  // specific section that was leaking into Vocational Training as a blank
  // second "training" page (VT's own trainee-data section is the
  // unrelated section4_vocationalTraining, "Apprenants").
  // Administration has s4q02Administration here, and shares s4q01 outright
  // (see its own comment above — "harmless while only the original 4
  // entities + Administration existed").
  entityTypes: ["enterprise", "cooperative", "ctd", "ong", "administration"],
);

const s4q01 = FormQuestionAst(
  id: "S4Q01",
  paperCode: "S4Q01",
  label: LocalizedText(
    fr: "Combien de stagiaires avez-vous accueillis du 1er Janvier 2026 à "
        "ce jour?",
    en: "How many interns did you host from 1st January 2026 to date?",
  ),
  sectionId: "section4",
  order: 1,
  type: AstFieldType.table,
  // Was unrestricted (entityTypes: null) — harmless while only the
  // original 4 entities + Administration existed, since all 5 use this
  // shared internship table. Made explicit now that Projects & Programs
  // (paperCode "S4Q01" too, by coincidence of independent numbering)
  // must NOT inherit it — see ppS4Q01 below, which has its own S4Q01.
  entityTypes: ["enterprise", "cooperative", "ctd", "ong", "administration"],
  tableSpec: {
    "template": "internship_table",
    "prefix": "s4q01",
    "rows": [
      "Stage de vacance/ Holiday jobs",
      "Stage académique/ Academic internship",
      "Stage professionnelle/ Professional internship",
      "Stage pré-emploi/ Pre-work internship",
    ],
    "genders": ["male", "female", "total"],
  },
);

const s4q02 = FormQuestionAst(
  id: "S4Q02",
  paperCode: "S4Q02",
  label: LocalizedText(
    fr: "Quels sont les besoins en compétence de votre entreprise? "
        "(énumérer les 3 compétences prioritaires)",
    en: "What are the skills needs of your company? (list the 3 priority "
        "skills)",
  ),
  sectionId: "section4",
  order: 2,
  type: AstFieldType.table,
  // Administration has its own wording variant (s4q02Administration, same
  // id/prefix, disjoint entityTypes) — see ADMINISTRATION SECTION 1-4
  // block below. Same prefix is safe/intended: the domain_N_text fields
  // below are entity-agnostic UI companions to whichever S4Q02 variant is
  // active, so they stay shared and untouched.
  entityTypes: ["enterprise", "cooperative", "ctd", "ong"],
  tableSpec: {
    "template": "skills_table",
    "prefix": "s4q02",
    "rows": 3,
    "fields": ["skill_description", "male", "female", "total"],
  },
);

// ignore: constant_identifier_names
const s4q02_domain_1_text = FormQuestionAst(
  id: "S4Q02_DOMAIN_1_TEXT",
  paperCode: "S4Q02",
  label: LocalizedText(fr: "Domaine de compétence 1", en: "Skill domain 1"),
  sectionId: "section4",
  order: 2,
  type: AstFieldType.text,
  requiredField: true,
  path: "section4.skills.domain1.text",
  hint: LocalizedText(
    fr: "Ex: Gestion, Comptabilité, Marketing, RH, Technique...",
    en: "E.g. Management, Accounting, Marketing, HR, Technical...",
  ),
  instruction: LocalizedText(
    fr: "Nommez le domaine de compétence prioritaire",
    en: "Name the priority skill domain",
  ),
);

// ignore: constant_identifier_names
const s4q02_domain_2_text = FormQuestionAst(
  id: "S4Q02_DOMAIN_2_TEXT",
  paperCode: "S4Q02",
  label: LocalizedText(fr: "Domaine de compétence 2", en: "Skill domain 2"),
  sectionId: "section4",
  order: 2,
  type: AstFieldType.text,
  path: "section4.skills.domain2.text",
  hint: LocalizedText(
    fr: "Ex: Gestion, Comptabilité, Marketing, RH, Technique...",
    en: "E.g. Management, Accounting, Marketing, HR, Technical...",
  ),
  instruction: LocalizedText(
    fr: "Nommez le domaine de compétence prioritaire",
    en: "Name the priority skill domain",
  ),
);

// ignore: constant_identifier_names
const s4q02_domain_3_text = FormQuestionAst(
  id: "S4Q02_DOMAIN_3_TEXT",
  paperCode: "S4Q02",
  label: LocalizedText(fr: "Domaine de compétence 3", en: "Skill domain 3"),
  sectionId: "section4",
  order: 2,
  type: AstFieldType.text,
  path: "section4.skills.domain3.text",
  hint: LocalizedText(
    fr: "Ex: Gestion, Comptabilité, Marketing, RH, Technique...",
    en: "E.g. Management, Accounting, Marketing, HR, Technical...",
  ),
  instruction: LocalizedText(
    fr: "Nommez le domaine de compétence prioritaire",
    en: "Name the priority skill domain",
  ),
);

const s4q03 = FormQuestionAst(
  id: "S4Q03",
  paperCode: "S4Q03",
  label: LocalizedText(
    fr: "Quels sont les besoins en formation des personnels de votre "
        "entreprise? (énumérer les 3 domaines de formation prioritaires)",
    en: "What are the training needs of your company's staff? (list the "
        "3 priority fields of training)",
  ),
  sectionId: "section4",
  order: 3,
  type: AstFieldType.table,
  // Administration has no training-domain-needs question.
  entityTypes: ["enterprise", "cooperative", "ctd", "ong"],
  tableSpec: {
    "template": "training_table",
    "prefix": "s4q03",
    "rows": 3,
    "fields": ["training_domain", "male", "female", "total"],
  },
);

// ignore: constant_identifier_names
const s4q03_domain_1_text = FormQuestionAst(
  id: "S4Q03_DOMAIN_1_TEXT",
  paperCode: "S4Q03",
  label: LocalizedText(fr: "Domaine de formation 1", en: "Training domain 1"),
  sectionId: "section4",
  order: 3,
  type: AstFieldType.text,
  entityTypes: ["enterprise", "cooperative", "ctd", "ong"],
  requiredField: true,
  path: "section4.training.domain1.text",
  hint: LocalizedText(
    fr: "Ex: Leadership, Techniques de vente, Gestion de projet...",
    en: "E.g. Leadership, Sales techniques, Project management...",
  ),
  instruction: LocalizedText(
    fr: "Nommez le domaine de formation prioritaire",
    en: "Name the priority training domain",
  ),
);

// ignore: constant_identifier_names
const s4q03_domain_2_text = FormQuestionAst(
  id: "S4Q03_DOMAIN_2_TEXT",
  paperCode: "S4Q03",
  label: LocalizedText(fr: "Domaine de formation 2", en: "Training domain 2"),
  sectionId: "section4",
  order: 3,
  type: AstFieldType.text,
  entityTypes: ["enterprise", "cooperative", "ctd", "ong"],
  path: "section4.training.domain2.text",
  hint: LocalizedText(
    fr: "Ex: Leadership, Techniques de vente, Gestion de projet...",
    en: "E.g. Leadership, Sales techniques, Project management...",
  ),
  instruction: LocalizedText(
    fr: "Nommez le domaine de formation prioritaire",
    en: "Name the priority training domain",
  ),
);

// ignore: constant_identifier_names
const s4q03_domain_3_text = FormQuestionAst(
  id: "S4Q03_DOMAIN_3_TEXT",
  paperCode: "S4Q03",
  label: LocalizedText(fr: "Domaine de formation 3", en: "Training domain 3"),
  sectionId: "section4",
  order: 3,
  type: AstFieldType.text,
  entityTypes: ["enterprise", "cooperative", "ctd", "ong"],
  path: "section4.training.domain3.text",
  hint: LocalizedText(
    fr: "Ex: Leadership, Techniques de vente, Gestion de projet...",
    en: "E.g. Leadership, Sales techniques, Project management...",
  ),
  instruction: LocalizedText(
    fr: "Nommez le domaine de formation prioritaire",
    en: "Name the priority training domain",
  ),
);

// Explicit table-level response so an untouched grid is not stored as
// a genuine zero. NONE = nothing to report (treated as zeros).
// NOT_APPLICABLE = the question does not apply. REPORTED = figures
// were entered (empty cells stay missing; 0 is an explicit zero).
FormQuestionAst tableResponseStatus({
  required String paperCode,
  required String sectionId,
  required int order,
  LocalizedText? subsection,
  List<String>? entityTypes,
}) =>
    FormQuestionAst(
      id: '${paperCode}_RESPONSE_STATUS',
      paperCode: paperCode,
      entityTypes: entityTypes,
      label: const LocalizedText(
        fr: 'Statut de réponse',
        en: 'Response status',
      ),
      instruction: const LocalizedText(
        fr:
            'Indiquez si les chiffres sont déclarés, si aucun cas n\'est à signaler, ou si la question ne s\'applique pas.',
        en:
            'State whether figures are reported, there is nothing to report, or the question does not apply.',
      ),
      sectionId: sectionId,
      order: order,
      subsection: subsection,
      type: AstFieldType.select,
      options: const [
        LocalizedOption(
          'REPORTED',
          LocalizedText(fr: 'Chiffres déclarés', en: 'Figures reported'),
        ),
        LocalizedOption(
          'NONE',
          LocalizedText(
              fr: 'Aucun cas à signaler', en: 'Nothing to report'),
        ),
        LocalizedOption(
          'NOT_APPLICABLE',
          LocalizedText(fr: 'Non applicable', en: 'Not applicable'),
        ),
      ],
      requiredField: true,
      path: 'responseStatus.$paperCode',
    );

// ============================================================
// PROJECTS & PROGRAMS — dedicated questionnaire, Phase 1 structural
// implementation. Source: Questionnaire_Projet_et_Programmes.pdf.
//
// Unlike Administration, this is NOT a variant of the shared
// section2/section3/section4 — its Sections 2-4 have their own paper
// codes (S2/S3Q01-04/S4Q01-06) and structure entirely distinct from the
// enterprise-family "Emploi et Travail"/"Départs"/"Stage et Formation"
// sections, so it gets its own dedicated sections rather than reusing
// the shared ones the way Administration reused S21Q01/S22Q01/S3Q01.
//
// Section 4's S4Q01-S4Q04 pairing ("recensé" vs "recruté", each split
// permanent/temporary) is a genuine 4-way distinction confirmed from the
// source PDF, not a duplication: "recensé" (counted) is a headcount of
// current staff; "recruté" (recruited) is new hires during the
// reporting period — the same census-vs-recruitment distinction other
// entities draw between their Section 1 headcount fields and their
// Section 2.2 recruitment tables, just both expressed as full CSP
// tables here rather than one side being a single header number.
// ============================================================

const section1ProjectProgram = SectionAst(
  id: "section1_projectProgram",
  title: LocalizedText(
    fr: "SECTION 1. IDENTIFICATION DE LA STRUCTURE",
    en: "SECTION 1. STRUCTURE DETAILS",
  ),
  order: 1,
  entityTypes: ["projectProgram"],
);

const section1ProjectProgramQuestions = <FormQuestionAst>[
  FormQuestionAst(
    id: "PP_S1Q01",
    paperCode: "S1Q01",
    label: LocalizedText(
        fr: "Nature de la structure", en: "Nature of the structure"),
    sectionId: "section1_projectProgram",
    order: 1,
    type: AstFieldType.radio,
    options: [
      LocalizedOption("Projet/ Project", LocalizedText(fr: "Projet", en: "Project")),
      LocalizedOption("Programme/ Program", LocalizedText(fr: "Programme", en: "Program")),
      LocalizedOption(
        "Structure sous-tutelle/ Structure under supervision",
        LocalizedText(
            fr: "Structure sous-tutelle", en: "Structure under supervision"),
      ),
      LocalizedOption("Autres/ Other", LocalizedText(fr: "Autres", en: "Other")),
    ],
    requiredField: true,
    path: "projectProgram.nature",
  ),
  FormQuestionAst(
    id: "PP_S1Q02",
    paperCode: "S1Q02",
    label: LocalizedText(fr: "Nom", en: "Name"),
    sectionId: "section1_projectProgram",
    order: 2,
    type: AstFieldType.text,
    requiredField: true,
    path: "projectProgram.name",
  ),
  FormQuestionAst(
    id: "PP_S1Q03",
    paperCode: "S1Q03",
    label: LocalizedText(fr: "Sigle ou acronyme", en: "Abbreviation or acronym"),
    sectionId: "section1_projectProgram",
    order: 3,
    type: AstFieldType.text,
    requiredField: true,
    path: "projectProgram.sigle",
  ),
  FormQuestionAst(
    id: "PP_S1Q04",
    paperCode: "S1Q04",
    label: LocalizedText(
        fr: "Nom du Responsable", en: "Name of the person in charge"),
    sectionId: "section1_projectProgram",
    order: 4,
    type: AstFieldType.text,
    requiredField: true,
    path: "projectProgram.personInCharge",
  ),
  FormQuestionAst(
    id: "PP_S1Q05",
    paperCode: "S1Q05",
    label: LocalizedText(fr: "Milieu de résidence", en: "Area"),
    sectionId: "section1_projectProgram",
    order: 5,
    type: AstFieldType.radio,
    options: [
      LocalizedOption("Urbain/ Urban", LocalizedText(fr: "Urbain", en: "Urban")),
      LocalizedOption("Rural/ Rural", LocalizedText(fr: "Rural", en: "Rural")),
    ],
    requiredField: true,
    path: "projectProgram.area",
  ),
  FormQuestionAst(
    id: "PP_S1Q06_REGION",
    paperCode: "S1Q06",
    label: LocalizedText(fr: "Région", en: "Region"),
    sectionId: "section1_projectProgram",
    order: 6,
    type: AstFieldType.text,
    requiredField: true,
    readOnly: true,
    path: "projectProgram.region",
  ),
  FormQuestionAst(
    id: "PP_S1Q06_DEPT",
    paperCode: "S1Q06",
    label: LocalizedText(fr: "Département", en: "Division"),
    sectionId: "section1_projectProgram",
    order: 7,
    type: AstFieldType.text,
    requiredField: true,
    readOnly: true,
    path: "projectProgram.department",
  ),
  FormQuestionAst(
    id: "PP_S1Q06_SUBDIV",
    paperCode: "S1Q06",
    label: LocalizedText(fr: "Arrondissement", en: "Subdivision"),
    sectionId: "section1_projectProgram",
    order: 8,
    type: AstFieldType.text,
    requiredField: true,
    readOnly: true,
    path: "projectProgram.subdivision",
  ),
  FormQuestionAst(
    id: "PP_S1Q06_LOCALITY",
    paperCode: "S1Q06",
    label: LocalizedText(
      fr: "Quartier/Village/Localité",
      en: "Neighborhood/Village/Locality",
    ),
    sectionId: "section1_projectProgram",
    order: 9,
    type: AstFieldType.text,
    requiredField: true,
    path: "projectProgram.locality",
  ),
  FormQuestionAst(
    id: "PP_S1Q07_TEL1",
    paperCode: "S1Q07",
    label: LocalizedText(fr: "Téléphone 1", en: "Tel 1"),
    sectionId: "section1_projectProgram",
    order: 10,
    type: AstFieldType.tel,
    requiredField: true,
    path: "projectProgram.phone1",
  ),
  FormQuestionAst(
    id: "PP_S1Q07_TEL2",
    paperCode: "S1Q07",
    label: LocalizedText(fr: "Téléphone 2", en: "Tel 2"),
    sectionId: "section1_projectProgram",
    order: 11,
    type: AstFieldType.tel,
    // NO requiredField - phone2 is optional
    path: "projectProgram.phone2",
  ),
  FormQuestionAst(
    id: "PP_S1Q07_BP",
    paperCode: "S1Q07",
    label: LocalizedText(fr: "Boîte postale", en: "PO Box"),
    sectionId: "section1_projectProgram",
    order: 12,
    type: AstFieldType.text,
    requiredField: true,
    path: "projectProgram.poBox",
  ),
  FormQuestionAst(
    id: "PP_S1Q08",
    paperCode: "S1Q08",
    label: LocalizedText(fr: "Secteur d'activité", en: "Business sector"),
    sectionId: "section1_projectProgram",
    order: 13,
    type: AstFieldType.radio,
    options: [
      LocalizedOption("Primaire/ Primary", LocalizedText(fr: "Primaire", en: "Primary")),
      LocalizedOption(
          "Secondaire/ Secondary", LocalizedText(fr: "Secondaire", en: "Secondary")),
      LocalizedOption(
          "Tertiaire/ Tertiary", LocalizedText(fr: "Tertiaire", en: "Tertiary")),
    ],
    requiredField: true,
    path: "projectProgram.sector",
  ),
  FormQuestionAst(
    id: "PP_S1Q09",
    paperCode: "S1Q09",
    label: LocalizedText(fr: "Branche d'activité", en: "Branch of activity"),
    sectionId: "section1_projectProgram",
    order: 14,
    type: AstFieldType.text,
    requiredField: true,
    path: "projectProgram.branch",
  ),
  FormQuestionAst(
    id: "PP_S1Q10",
    paperCode: "S1Q10",
    label: LocalizedText(
        fr: "Objectif ou mission principale", en: "Objective or main mission"),
    sectionId: "section1_projectProgram",
    order: 15,
    type: AstFieldType.text,
    requiredField: true,
    path: "projectProgram.mainMission",
  ),
  FormQuestionAst(
    id: "PP_S1Q11",
    paperCode: "S1Q11",
    label: LocalizedText(fr: "Siège social", en: "Head office"),
    sectionId: "section1_projectProgram",
    order: 16,
    type: AstFieldType.text,
    requiredField: true,
    path: "projectProgram.headOffice",
  ),
  FormQuestionAst(
    id: "PP_S1Q12",
    paperCode: "S1Q12",
    label: LocalizedText(
      fr: "Ministère/ Organisme tutelle",
      en: "Ministry/ Organisation under supervision",
    ),
    sectionId: "section1_projectProgram",
    order: 17,
    type: AstFieldType.text,
    requiredField: true,
    path: "projectProgram.supervisingMinistry",
  ),
  FormQuestionAst(
    id: "PP_S1Q13",
    paperCode: "S1Q13",
    label: LocalizedText(
      fr: "Situation du Projet / Programme",
      en: "Project / Programme Status",
    ),
    sectionId: "section1_projectProgram",
    order: 18,
    type: AstFieldType.radio,
    options: [
      LocalizedOption("En arrêt/ Stopped", LocalizedText(fr: "En arrêt", en: "Stopped")),
      LocalizedOption("Actif/ Active", LocalizedText(fr: "Actif", en: "Active")),
      LocalizedOption(
        "En cours de démarrage/ Starting up",
        LocalizedText(fr: "En cours de démarrage", en: "Starting up"),
      ),
    ],
    requiredField: true,
    path: "projectProgram.status",
  ),
  // Conditional on S1Q13 = Stopped — same dependsOn/dependsValue
  // mechanism already exercised by Administration's S1Q09/S1Q11.
  FormQuestionAst(
    id: "PP_S1Q14",
    paperCode: "S1Q14",
    label: LocalizedText(
      fr: "Si en arrêt, quel est le principal motif ?",
      en: "If stopped, what is the main reason?",
    ),
    sectionId: "section1_projectProgram",
    order: 19,
    type: AstFieldType.radio,
    options: [
      LocalizedOption(
          "Arrivé à terme/ Expired", LocalizedText(fr: "Arrivé à terme", en: "Expired")),
      LocalizedOption(
        "Manque de fonds/ Lack of funds",
        LocalizedText(fr: "Manque de fonds", en: "Lack of funds"),
      ),
      LocalizedOption(
        "Résultats insuffisants/ Insufficient results",
        LocalizedText(fr: "Résultats insuffisants", en: "Insufficient results"),
      ),
      LocalizedOption("Autre/ Other", LocalizedText(fr: "Autre", en: "Other")),
    ],
    dependsOn: "PP_S1Q13",
    dependsValue: "En arrêt/ Stopped",
    requiredField: true,
    path: "projectProgram.stopReason",
  ),
  FormQuestionAst(
    id: "PP_S1Q15",
    paperCode: "S1Q15",
    label: LocalizedText(
        fr: "Nombre d'employé permanent", en: "Number of permanent workers"),
    sectionId: "section1_projectProgram",
    order: 20,
    type: AstFieldType.number,
    requiredField: true,
    path: "projectProgram.permanentWorkers",
  ),
  FormQuestionAst(
    id: "PP_S1Q16",
    paperCode: "S1Q16",
    label: LocalizedText(fr: "Nombre de poste vacant", en: "Number of vacancies"),
    sectionId: "section1_projectProgram",
    order: 21,
    type: AstFieldType.number,
    requiredField: true,
    path: "projectProgram.vacancies",
  ),
];

// ============================================================
// SECTION 2 — services/activities offered by the structure. The paper
// form shows a 13-row blank repeating table (Prestations offertes /
// Population cible / Nature de l'appui / Rayon d'action / Date de
// début / Durée) — no fixed row semantics, unlike the app's existing
// 3-row free-entry tables (reasons/skills/training). Modeled as a
// single AstFieldType.repeatingTable field; the row count (13) is a
// display capacity matching the paper form, not a hard cap on the
// conceptual data model — see ActivitiesTable and the backend's
// ProjectProgramActivity child table, which persists only the rows
// actually filled in.
// ============================================================

const section2ProjectProgram = SectionAst(
  id: "section2_projectProgram",
  title: LocalizedText(
    fr: "SECTION 2. RENSEIGNEMENTS SUR LA STRUCTURE SOUS-TUTELLE/ PROJET ET PROGRAMME",
    en: "SECTION 2. INFORMATION ON THE STRUCTURE UNDER SUPERVISION/PROJECT AND PROGRAM",
  ),
  order: 2,
  entityTypes: ["projectProgram"],
);

const section2ProjectProgramQuestions = <FormQuestionAst>[
  FormQuestionAst(
    id: "PP_S2_ACTIVITIES",
    label: LocalizedText(
      fr: "Prestations offertes, population cible, nature de l'appui, "
          "rayon d'action, date de début et durée",
      en: "Services offered, target population, type of support, scope "
          "of action, start date and duration",
    ),
    sectionId: "section2_projectProgram",
    order: 1,
    type: AstFieldType.repeatingTable,
    entityTypes: ["projectProgram"],
    tableSpec: {
      "template": "activities_table",
      "prefix": "s2",
      "rows": 13,
      "fields": [
        "description",
        "targetPopulation",
        "supportType",
        "scope",
        "startDate",
        "duration",
      ],
    },
    path: "projectProgram.activities",
  ),
];

// ============================================================
// SECTION 3 — outcomes/perspectives. A small fixed 4-row x 3-column KPI
// grid (no CSP/gender/age breakdown), structurally unlike any existing
// table — a new "kpi_period_table" template. Still numeric/homogeneous,
// so it reuses the existing GridRenderSpec/TableSpecBuilder/
// TableCellEngine numeric-grid machinery (field.type stays 'table').
// ============================================================

const section3ProjectProgram = SectionAst(
  id: "section3_projectProgram",
  title: LocalizedText(
    fr: "SECTION 3. EMPLOI ET TRAVAIL/ INFORMATIONS SUR L'ACTIVITE DE LA STRUCTURE SOUS-TUTELLE / PROJET / PROGRAMME",
    en: "SECTION 3. EMPLOYMENT AND LABOUR/ INFORMATION ON THE ACTIVITY OF THE STRUCTURE UNDER SUPERVISION/ PROJECT / PROGRAM",
  ),
  order: 3,
  entityTypes: ["projectProgram"],
);

const section3ProjectProgramQuestions = <FormQuestionAst>[
  FormQuestionAst(
    id: "PP_S3_OUTCOMES",
    label: LocalizedText(
      fr: "Nombre de bénéficiaires insérés comme employés, en auto "
          "emploi, d'emplois créés par les bénéficiaires employeurs et "
          "de bénéficiaires formés dans les domaines divers",
      en: "Number of beneficiaries inserted as employees, in "
          "self-employment, jobs created by beneficiary employers, and "
          "beneficiaries trained in various fields",
    ),
    sectionId: "section3_projectProgram",
    order: 1,
    type: AstFieldType.table,
    entityTypes: ["projectProgram"],
    // No paperCode: this one table stands in for the paper form's
    // S3Q01-04 rows collectively, and deliberately has no
    // tableResponseStatus companion either — the paper form has no
    // response-status selector for it (unlike the recensement/
    // recrutement/départs tables elsewhere in the app).
    tableSpec: {
      "template": "kpi_period_table",
      "prefix": "s3kpi",
      "rows": ["employed", "self_employed", "jobs_created", "trained"],
      "periods": ["current", "outlook_dec", "outlook_june"],
    },
    path: "projectProgram.outcomes",
  ),
];

// ============================================================
// SECTION 4 — recruitment/headcount tables, reusing the existing CSP
// (cadres/foremen/workers) row infrastructure verbatim — same
// templates as the shared csp_gender_age_table/csp_status_gender_table
// Enterprise already uses, just under Projects & Programs' own
// S4Q01-S4Q06 paper codes. S4Q01/S4Q02 ("recensé") vs S4Q03/S4Q04
// ("recruté") are a genuine 4-way distinction confirmed from the
// source PDF (headcount census vs new recruitment flow) — see the
// file-level comment above this whole Projects & Programs block.
// ============================================================

const section4ProjectProgram = SectionAst(
  id: "section4_projectProgram",
  title: LocalizedText(
    fr: "SECTION 4. DETAILS SUR LES RESENCEMENTS ET RECRUTEMENTS CONCERNANT L'ACTIVITE DE LA STRUCTURE SOUS-TUTELLE / PROJET / PROGRAMME",
    en: "SECTION 4. DETAILS ON APPOINTMENTS AND RECRUITMENTS CONCERNING THE ACTIVITY OF THE STRUCTURE UNDER SUPERVISION/ PROJECT / PROGRAM",
  ),
  order: 4,
  entityTypes: ["projectProgram"],
);

const ppS4Q01 = FormQuestionAst(
  id: "PP_S4Q01",
  paperCode: "S4Q01",
  label: LocalizedText(
    fr: "Combien de permanents avez-vous recensé selon la catégorie "
        "socioprofessionnelle, le sexe et la tranche d'âge du premier "
        "Janvier 2026 à ce jour?",
    en: "How many permanent workers per socio-professional category, "
        "gender and age group did you count from the 1st of January "
        "2026 to the present day?",
  ),
  sectionId: "section4_projectProgram",
  order: 1,
  type: AstFieldType.table,
  entityTypes: ["projectProgram"],
  tableSpec: {
    "template": "csp_gender_age_table",
    "prefix": "pp_s4q01",
    "rows": ["cadres", "foremen", "workers"],
    "genders": ["male", "female", "total"],
    "age_bands": ["15_24", "25_34", "35_plus"],
  },
);

const ppS4Q02 = FormQuestionAst(
  id: "PP_S4Q02",
  paperCode: "S4Q02",
  label: LocalizedText(
    fr: "Combien de temporaires avez-vous recensé selon la catégorie "
        "socioprofessionnelle, le sexe et la tranche d'âge du premier "
        "Janvier 2026 à ce jour ?",
    en: "How many temporary workers per socio-professional category, "
        "gender and age group did you count from the 1st of January "
        "2026 to the present day?",
  ),
  sectionId: "section4_projectProgram",
  order: 2,
  type: AstFieldType.table,
  entityTypes: ["projectProgram"],
  tableSpec: {
    "template": "csp_gender_age_table",
    "prefix": "pp_s4q02",
    "rows": ["cadres", "foremen", "workers"],
    "genders": ["male", "female", "total"],
    "age_bands": ["15_24", "25_34", "35_plus"],
  },
);

const ppS4Q03 = FormQuestionAst(
  id: "PP_S4Q03",
  paperCode: "S4Q03",
  label: LocalizedText(
    fr: "Combien de permanents avez-vous recruté selon la catégorie "
        "socioprofessionnelle, le sexe et la tranche d'âge du premier "
        "Janvier 2026 à ce jour?",
    en: "How many permanent workers per socio-professional category, "
        "gender and age group did you recruit from the 1st of January "
        "2026 to the present day?",
  ),
  sectionId: "section4_projectProgram",
  order: 3,
  type: AstFieldType.table,
  entityTypes: ["projectProgram"],
  tableSpec: {
    "template": "csp_gender_age_table",
    "prefix": "pp_s4q03",
    "rows": ["cadres", "foremen", "workers"],
    "genders": ["male", "female", "total"],
    "age_bands": ["15_24", "25_34", "35_plus"],
  },
);

const ppS4Q04 = FormQuestionAst(
  id: "PP_S4Q04",
  paperCode: "S4Q04",
  label: LocalizedText(
    fr: "Combien de temporaires avez-vous recruté selon la catégorie "
        "socioprofessionnelle, le sexe et la tranche d'âge du premier "
        "Janvier 2026 à ce jour ?",
    en: "How many temporary workers per socio-professional category, "
        "gender and age group did you recruit from the 1st of January "
        "2026 to the present day?",
  ),
  sectionId: "section4_projectProgram",
  order: 4,
  type: AstFieldType.table,
  entityTypes: ["projectProgram"],
  tableSpec: {
    "template": "csp_gender_age_table",
    "prefix": "pp_s4q04",
    "rows": ["cadres", "foremen", "workers"],
    "genders": ["male", "female", "total"],
    "age_bands": ["15_24", "25_34", "35_plus"],
  },
);

const ppS4Q05 = FormQuestionAst(
  id: "PP_S4Q05",
  paperCode: "S4Q05",
  label: LocalizedText(
    fr: "Combien de personnes en situation de handicap avez-vous "
        "recruté selon la catégorie socio professionnelle, le sexe et "
        "le statut du 1er Janvier 2026 à ce jour?",
    en: "How many workers with a disability per socio-professional "
        "category, gender, and status did you recruit from the 1st of "
        "January 2026 to the present day?",
  ),
  sectionId: "section4_projectProgram",
  order: 5,
  type: AstFieldType.table,
  entityTypes: ["projectProgram"],
  tableSpec: {
    "template": "csp_status_gender_table",
    "prefix": "pp_s4q05",
    "rows": ["cadres", "foremen", "workers"],
  },
);

const ppS4Q06 = FormQuestionAst(
  id: "PP_S4Q06",
  paperCode: "S4Q06",
  label: LocalizedText(
    fr: "Combien de personnes vulnérables avez-vous recruté selon le "
        "statut et la nature de la vulnérabilité du 1er Janvier 2026 à "
        "ce jour?",
    en: "How many vulnerable workers per status and nature of "
        "vulnerability did you recruit from the 1st of January "
        "2026 to the present day?",
  ),
  sectionId: "section4_projectProgram",
  order: 6,
  type: AstFieldType.table,
  entityTypes: ["projectProgram"],
  tableSpec: {
    "template": "csp_status_gender_table",
    "prefix": "pp_s4q06",
    "rows": ["cadres", "foremen", "workers"],
  },
);

// ============================================================
// SECTION 1 - VOCATIONAL TRAINING (VT-2)
// PDF: QUESTIONNAIIRE FORMATION PROFESSIONNELLE 2025_2026 (MINEFOP)
// Per VOCATIONAL_TRAINING_DESIGN_NOTE.md §1/§4/§11 — binding source of
// truth for this section; not re-derived from the PDF (not available in
// this pass).
//
// No synthetic Section 0: VT's paper form has no separate respondent
// section (§1.15 sits inside Section 1 on the printed instrument), so
// section0/section0Questions above are scoped away from
// "vocationalTraining" (see _section0EntityTypes) and the respondent
// name/function/phone1/phone2/email fields are re-declared below instead,
// still targeting the same shared respondent.* path / OnefopRespondent
// table as every other entity — OnefopRespondent itself is not touched.
//
// requiredField is deliberately omitted (defaults to false) on every
// question below, per explicit VT-2 instruction: no blanket-required
// policy, unlike the six existing entities (~76% requiredField: true
// there, per the VT-2 research pass). 1.1 (structureCode) stays optional,
// as does every field in later sections. Conditional *visibility*
// (dependsOn/dependsValue) is used only where the printed instrument's
// own branching and exact option values are already confirmed elsewhere
// in this codebase; it is never used to imply requiredness.
//
// educationSystem (1.10), cfpType (1.11), functionalStatus (1.12) and
// nonFunctionalReason/-Other (1.13) are free text (AstFieldType.text) in
// this pass: their Prisma columns are plain String? (no VT enum backs
// them), and no confirmed printed option wording exists for any of them —
// inventing one here would be exactly the kind of fabrication
// VOCATIONAL_TRAINING_DESIGN_NOTE.md's decisions repeatedly forbid. area
// (1.9) and respondentSex/promoterSex (1.15/1.16) are the exceptions:
// area reuses the Urbain/Rural pair verbatim from Administration's
// ADMIN_S1Q03, and Sex reuses the Masculin/Féminin pair already live in
// register_constants.dart's kSexOptions (same promoterSex path, same VT
// registration flow) — both already-confirmed, already-live cross-flow
// conventions, not VT-specific inventions.
// ============================================================

// Same value strings as register_constants.dart's kSexOptions — this
// path (vocationalTraining.promoterSex) is also written by the VT
// registration flow (register_screen.dart), so the option values must
// match exactly or a value saved by one flow would show blank in the
// other.
const _vtSexOptions = [
  LocalizedOption('Masculin', LocalizedText(fr: 'Masculin', en: 'Male')),
  LocalizedOption('Féminin', LocalizedText(fr: 'Féminin', en: 'Female')),
];

const section1VocationalTraining = SectionAst(
  id: "section1_vocationalTraining",
  title: LocalizedText(
    // PDF-confirmed (p.1): "SECTON 1 : IDENTIFICATION ET LOCALISATION DE LA
    // STRUCTURE/ IDENTIFICATION AND LOCALISATION OF TRAINING CENTER" — the
    // printed "SECTON"/"LOCALISATION" spellings are the PDF's own, kept
    // here as "SECTION"/"LOCATION" (obvious typos, not meaningful content
    // to preserve verbatim, same posture already applied to table 4.1's
    // "trainers"→"trainees" fix elsewhere in this section).
    fr: "SECTION 1. IDENTIFICATION ET LOCALISATION DE LA STRUCTURE",
    en: "SECTION 1. IDENTIFICATION AND LOCATION OF TRAINING CENTER",
  ),
  order: 1,
  entityTypes: ["vocationalTraining"],
);

const section1VocationalTrainingQuestions = <FormQuestionAst>[
  FormQuestionAst(
    id: "VT1_1",
    paperCode: "1.1",
    label: LocalizedText(fr: "Code de la Structure", en: "Structure Code"),
    sectionId: "section1_vocationalTraining",
    order: 1,
    type: AstFieldType.text,
    path: "vocationalTraining.structureCode",
    // PDF-confirmed (p.1): "(A ne pas remplir/ Not to be filled in)" — an
    // admin-only code, not one the respondent should be guessing at even
    // when known; was "leave blank if unknown", which implied the
    // opposite (fill it in if you happen to know it).
    hint: LocalizedText(
      fr: "A ne pas remplir",
      en: "Not to be filled in",
    ),
  ),
  FormQuestionAst(
    id: "VT1_2",
    paperCode: "1.2",
    label: LocalizedText(fr: "Nom du CFP", en: "Name of VTC"),
    sectionId: "section1_vocationalTraining",
    order: 2,
    type: AstFieldType.text,
    path: "vocationalTraining.name",
  ),
  FormQuestionAst(
    id: "VT1_3",
    paperCode: "1.3",
    label: LocalizedText(fr: "Sigle", en: "Initials"),
    sectionId: "section1_vocationalTraining",
    order: 3,
    type: AstFieldType.text,
    path: "vocationalTraining.sigle",
  ),
  FormQuestionAst(
    id: "VT1_4",
    paperCode: "1.4",
    label: LocalizedText(fr: "Région", en: "Region"),
    sectionId: "section1_vocationalTraining",
    order: 4,
    type: AstFieldType.text,
    readOnly: true,
    path: "vocationalTraining.region",
  ),
  FormQuestionAst(
    id: "VT1_5",
    paperCode: "1.5",
    label: LocalizedText(fr: "Département", en: "Division"),
    sectionId: "section1_vocationalTraining",
    order: 5,
    type: AstFieldType.text,
    readOnly: true,
    path: "vocationalTraining.department",
  ),
  FormQuestionAst(
    id: "VT1_6",
    paperCode: "1.6",
    label: LocalizedText(fr: "Arrondissement", en: "Sub-Division"),
    sectionId: "section1_vocationalTraining",
    order: 6,
    type: AstFieldType.text,
    readOnly: true,
    path: "vocationalTraining.subdivision",
  ),
  FormQuestionAst(
    id: "VT1_7",
    paperCode: "1.7",
    label: LocalizedText(fr: "Commune", en: "Municipality"),
    sectionId: "section1_vocationalTraining",
    order: 7,
    type: AstFieldType.text,
    path: "vocationalTraining.commune",
  ),
  FormQuestionAst(
    id: "VT1_8",
    paperCode: "1.8",
    label: LocalizedText(
      fr: "Village-Quartier",
      en: "Village-Quarter",
    ),
    sectionId: "section1_vocationalTraining",
    order: 8,
    type: AstFieldType.text,
    path: "vocationalTraining.locality",
  ),
  FormQuestionAst(
    id: "VT1_9",
    paperCode: "1.9",
    label: LocalizedText(
      fr: "Milieu d'implantation",
      // Was "Area of residence" — "residence" implies where a person
      // lives, not an institution's location (this classifies the
      // center's own site as Urban/Rural, matching the French).
      en: "Location",
    ),
    sectionId: "section1_vocationalTraining",
    order: 9,
    type: AstFieldType.radio,
    options: [
      LocalizedOption(
          "Urbain/ Urban", LocalizedText(fr: "Urbain", en: "Urban")),
      LocalizedOption("Rural/ Rural", LocalizedText(fr: "Rural", en: "Rural")),
    ],
    path: "vocationalTraining.area",
  ),
  FormQuestionAst(
    id: "VT1_10",
    paperCode: "1.10",
    // Was "Ordre d'enseignement..."/"Education system..." — the options
    // below (Public/Lay private/Private denominational) classify
    // ownership/governance status, not an education system in any normal
    // sense; a respondent could not predict the answer choices from the
    // old label. Reworded to name what is actually being classified,
    // without changing path/options/data.
    label: LocalizedText(
      fr: "Statut de l'établissement",
      en: "Type of education provision (Public / Lay private / Private "
          "denominational)",
    ),
    sectionId: "section1_vocationalTraining",
    order: 10,
    // PDF-confirmed (p.1): 3-way coded choice — was free text with no
    // confirmed option wording ("this pass has no confirmed printed
    // option list" per the block comment above); now that the PDF is
    // available, retyped to radio like 1.12/1.13 already were.
    type: AstFieldType.radio,
    options: [
      LocalizedOption(
          "Public/ Public", LocalizedText(fr: "Public", en: "Public")),
      LocalizedOption("Privé laïc/ Lay private",
          LocalizedText(fr: "Privé laïc", en: "Lay private")),
      LocalizedOption("Privé confessionnel/ Private denominational",
          LocalizedText(
              fr: "Privé confessionnel", en: "Private denominational")),
    ],
    path: "vocationalTraining.educationSystem",
  ),
  FormQuestionAst(
    id: "VT1_11",
    paperCode: "1.11",
    label: LocalizedText(
      fr: "Type de CFP",
      en: "Type of VTC",
    ),
    sectionId: "section1_vocationalTraining",
    order: 11,
    // PDF-confirmed (p.1): 7-way coded choice — same "was free text,
    // PDF now available" fix as 1.10 above.
    type: AstFieldType.radio,
    options: [
      LocalizedOption("SAR/SM/ RA/HECs", LocalizedText(fr: "SAR/SM", en: "RA/HECs")),
      LocalizedOption(
          "Centre de Formation Professionnelle Rapide (CFPR)/ "
              "Intensive Vocational Training Centre (IVTC)",
          LocalizedText(
              fr: "Centre de Formation Professionnelle Rapide (CFPR)",
              en: "Intensive Vocational Training Centre (IVTC)")),
      LocalizedOption(
          "Centre de Formation Professionnelle Privé (CFPP)/ "
              "Private Vocational Training Centre (PVTC)",
          LocalizedText(
              fr: "Centre de Formation Professionnelle Privé (CFPP)",
              en: "Private Vocational Training Centre (PVTC)")),
      LocalizedOption(
          "Centre de Formation aux Métiers (CFM)/ Trades Training Centre (TTC)",
          LocalizedText(
              fr: "Centre de Formation aux Métiers (CFM)",
              en: "Trades Training Centre (TTC)")),
      LocalizedOption(
          "Centre de Formation Professionnelle d'Excellence (CFPE)/ "
              "Advanced Vocational Training Centre (AVTC)",
          LocalizedText(
              fr: "Centre de Formation Professionnelle d'Excellence (CFPE)",
              en: "Advanced Vocational Training Centre (AVTC)")),
      LocalizedOption(
          "Centre de Formation Professionnelle Sectorielles (CFPS)/ "
              "Sectoral Vocational Training Centre (SVTC)",
          LocalizedText(
              fr: "Centre de Formation Professionnelle Sectorielles (CFPS)",
              en: "Sectoral Vocational Training Centre (SVTC)")),
      LocalizedOption(
          "Centre National de Formation des Formateurs et de Développement "
              "des Programmes (CNFFDP)/ National Institute of Vocational "
              "Trainers and Programme Development (NIVTPD)",
          LocalizedText(
              fr: "Centre National de Formation des Formateurs et de "
                  "Développement des Programmes (CNFFDP)",
              en: "National Institute of Vocational Trainers and Programme "
                  "Development (NIVTPD)")),
    ],
    path: "vocationalTraining.cfpType",
  ),
  FormQuestionAst(
    id: "VT1_12",
    paperCode: "1.12",
    label: LocalizedText(
      fr: "Situation du Centre de formation",
      en: "Operating status of the training centre",
    ),
    sectionId: "section1_vocationalTraining",
    order: 12,
    // VT-UI/UX-06: paper p.1, 1.12 is a 3-way coded choice (1 Fonctionnelle
    // / 2 Non-fonctionnelle / 3 Fermée), not free text — retyped from
    // AstFieldType.text to radio to match, so VT1_13's dependsValue below
    // has a reliable value to key off. Prisma's functionalStatus column is
    // already a plain String? (VOCATIONAL_TRAINING_DESIGN_NOTE.md §4), so
    // this needs no backend change: the stored value is still a string,
    // just now constrained to one of these three option values instead of
    // arbitrary typed text.
    type: AstFieldType.radio,
    options: [
      LocalizedOption("Fonctionnelle/ Functional",
          LocalizedText(fr: "Fonctionnelle", en: "Functional")),
      LocalizedOption("Non-fonctionnelle/ Non-functional",
          LocalizedText(fr: "Non-fonctionnelle", en: "Non-functional")),
      LocalizedOption(
          "Fermée/ Closed", LocalizedText(fr: "Fermée", en: "Closed")),
    ],
    path: "vocationalTraining.functionalStatus",
  ),
  FormQuestionAst(
    id: "VT1_13",
    paperCode: "1.13",
    label: LocalizedText(
      fr: "Si « Non-fonctionnelle », préciser la raison",
      en: "If Non-functional, state the reason",
    ),
    sectionId: "section1_vocationalTraining",
    order: 13,
    // VT-UI/UX-06: paper p.1, 1.13 is a 5-way single-select coded reason
    // list ("préciser LA raison", singular — one reason, not several), not
    // free text — retyped to match, same no-backend-change rationale as
    // VT1_12 (nonFunctionalReason is already String?).
    type: AstFieldType.radio,
    options: [
      LocalizedOption("Manque d'apprenants/ Lack of trainees",
          LocalizedText(fr: "Manque d'apprenants", en: "Lack of trainees")),
      LocalizedOption("Manque de formateur/ Lack of trainers",
          LocalizedText(fr: "Manque de formateur", en: "Lack of trainers")),
      LocalizedOption("Raison d'insécurité/ Insecurity",
          LocalizedText(fr: "Raison d'insécurité", en: "Insecurity")),
      LocalizedOption("Agrément non valide/ Invalid accreditation",
          LocalizedText(
              fr: "Agrément non valide", en: "Invalid accreditation")),
      LocalizedOption(
          "Autres/ Others", LocalizedText(fr: "Autres", en: "Others")),
    ],
    dependsOn: "VT1_12",
    dependsValue: "Non-fonctionnelle/ Non-functional",
    path: "vocationalTraining.nonFunctionalReason",
  ),
  FormQuestionAst(
    id: "VT1_13_OTHER",
    paperCode: "1.13",
    label: LocalizedText(fr: "Précisez", en: "Specify"),
    sectionId: "section1_vocationalTraining",
    order: 14,
    type: AstFieldType.text,
    dependsOn: "VT1_13",
    dependsValue: "Autres/ Others",
    path: "vocationalTraining.nonFunctionalReasonOther",
  ),
  FormQuestionAst(
    id: "VT1_14",
    paperCode: "1.14",
    label: LocalizedText(
      fr: "Année d'ouverture",
      en: "Year of establishment",
    ),
    sectionId: "section1_vocationalTraining",
    order: 15,
    type: AstFieldType.number,
    path: "vocationalTraining.yearOfEstablishment",
  ),
  // 1.15 — respondent identification. No synthetic Section 0 for VT (see
  // block comment above): these five target the same shared
  // respondent.* path / OnefopRespondent table as every other entity's
  // Section 0, just declared inside VT's own Section 1 instead. Sex is
  // the one VT-local exception (Decision 5, VOCATIONAL_TRAINING_DESIGN_
  // NOTE.md §1) — it stays on Detail, not on OnefopRespondent.
  // PDF-confirmed (p.1): 1.15 ("Informations sur le répondant") and 1.16
  // ("Noms et contacts du Promoteur/Directeur du CFP") print the same
  // generic column labels twice — "Noms et prénoms/Name and surname",
  // "Sexe/Sex", "WhatsApp", "Téléphone 2", "E-mail/Email address" — the
  // paper's own two-column layout disambiguates them by position; here
  // that's the paperCode (1.15 vs 1.16) plus each field's place in the
  // section outline (see OnefopSectionMap) instead.
  FormQuestionAst(
    id: "VT1_15_NAME",
    paperCode: "1.15",
    // Only VT1_15_NAME needs this explicit — groupFields() (see
    // onefop_form_widgets.dart) inherits a non-table field's subsection
    // from the previous field whenever its own is null, so every other
    // 1.15 field below picks this up automatically; VT1_16_NAME starts
    // the next subsection the same way.
    subsection: LocalizedText(
      fr: "1.15 Informations sur le répondant",
      en: "1.15 Respondent information",
    ),
    label: LocalizedText(
      fr: "Noms et prénoms",
      en: "Name and surname",
    ),
    sectionId: "section1_vocationalTraining",
    order: 16,
    type: AstFieldType.text,
    path: "respondent.name",
    hint: LocalizedText(fr: "Ex: Jean Dupont", en: "E.g. Jean Dupont"),
  ),
  FormQuestionAst(
    id: "VT1_15_FUNCTION",
    paperCode: "1.15",
    label: LocalizedText(
      fr: "Qualité du répondant",
      en: "Quality of the respondent",
    ),
    sectionId: "section1_vocationalTraining",
    order: 17,
    type: AstFieldType.text,
    path: "respondent.function",
    hint: LocalizedText(fr: "Ex: DRH", en: "E.g. HR Manager"),
  ),
  FormQuestionAst(
    id: "VT1_15_TEL1",
    paperCode: "1.15",
    label: LocalizedText.same("WhatsApp"),
    sectionId: "section1_vocationalTraining",
    order: 18,
    type: AstFieldType.tel,
    path: "respondent.phone1",
    hint: LocalizedText(fr: "Ex: 677123456", en: "E.g. 677123456"),
  ),
  FormQuestionAst(
    id: "VT1_15_TEL2",
    paperCode: "1.15",
    label: LocalizedText(fr: "Téléphone 2", en: "Telephone 2"),
    sectionId: "section1_vocationalTraining",
    order: 19,
    type: AstFieldType.tel,
    path: "respondent.phone2",
    hint: LocalizedText(fr: "Ex: 699123456", en: "E.g. 699123456"),
  ),
  FormQuestionAst(
    id: "VT1_15_EMAIL",
    paperCode: "1.15",
    label: LocalizedText(fr: "E-mail", en: "Email address"),
    sectionId: "section1_vocationalTraining",
    order: 20,
    type: AstFieldType.email,
    path: "respondent.email",
    hint: LocalizedText(
      fr: "Ex: contact@centre.com",
      en: "E.g. contact@center.com",
    ),
  ),
  FormQuestionAst(
    id: "VT1_15_SEX",
    paperCode: "1.15",
    label: LocalizedText(fr: "Sexe", en: "Sex"),
    sectionId: "section1_vocationalTraining",
    order: 21,
    type: AstFieldType.radio,
    options: _vtSexOptions,
    path: "vocationalTraining.respondentSex",
  ),
  // 1.16 — promoter identification, entirely on Detail (promoterName/
  // Sex/Phone1/Phone2/Email), unrelated to OnefopRespondent.
  FormQuestionAst(
    id: "VT1_16_NAME",
    paperCode: "1.16",
    subsection: LocalizedText(
      fr: "1.16 Noms et contacts du Promoteur/Directeur du CFP",
      en: "1.16 Name and contact of Head/Promoter of VTC",
    ),
    label: LocalizedText(
      fr: "Noms et prénoms",
      en: "Name and surname",
    ),
    sectionId: "section1_vocationalTraining",
    order: 22,
    type: AstFieldType.text,
    path: "vocationalTraining.promoterName",
  ),
  FormQuestionAst(
    id: "VT1_16_SEX",
    paperCode: "1.16",
    label: LocalizedText(fr: "Sexe", en: "Sex"),
    sectionId: "section1_vocationalTraining",
    order: 23,
    type: AstFieldType.radio,
    options: _vtSexOptions,
    path: "vocationalTraining.promoterSex",
  ),
  FormQuestionAst(
    id: "VT1_16_TEL1",
    paperCode: "1.16",
    label: LocalizedText.same("WhatsApp"),
    sectionId: "section1_vocationalTraining",
    order: 24,
    type: AstFieldType.tel,
    path: "vocationalTraining.promoterPhone1",
  ),
  FormQuestionAst(
    id: "VT1_16_TEL2",
    paperCode: "1.16",
    label: LocalizedText(fr: "Téléphone 2", en: "Telephone 2"),
    sectionId: "section1_vocationalTraining",
    order: 25,
    type: AstFieldType.tel,
    path: "vocationalTraining.promoterPhone2",
  ),
  FormQuestionAst(
    id: "VT1_16_EMAIL",
    paperCode: "1.16",
    label: LocalizedText(fr: "E-mail", en: "Email address"),
    sectionId: "section1_vocationalTraining",
    order: 26,
    type: AstFieldType.email,
    path: "vocationalTraining.promoterEmail",
  ),
];

// Shared Yes/No option pair for VT boolean questions — identical value
// strings to Administration's Oui/Non fields (ADMIN_S1Q09 etc.), so
// dependsValue: "Oui/ Yes" works the same way across every VT section.
const _vtYesNoOptions = [
  LocalizedOption("Oui/ Yes", LocalizedText(fr: "Oui", en: "Yes")),
  LocalizedOption("Non/ No", LocalizedText(fr: "Non", en: "No")),
];

// ============================================================
// SECTION 2 - VOCATIONAL TRAINING (VT-2) — general information
//
// PDF-confirmed (p.4-5): every question below now carries its real
// paperCode (2.1.1-2.1.16, 2.2.1-2.2.20) and PDF wording — this section
// was originally authored before the source PDF was available (labels
// paraphrased from the Prisma column names, no paperCode at all), then
// re-derived word-for-word once the PDF was supplied. VT2_33 (fence
// status) was also retyped from free text to a real 3-way radio
// (Oui, entièrement / Oui, partiellement / Non) once its printed option
// list became available, same fix already applied to 1.10/1.11.
//
// String[]-backed multi-select fields without an explicit "PDF-confirmed"
// options comment (agreementTypes, etc. where none is listed above) use
// AstFieldType.checkbox with the options now confirmed from the PDF.
// ============================================================

const section2VocationalTraining = SectionAst(
  id: "section2_vocationalTraining",
  title: LocalizedText(
    // PDF-confirmed (p.4): "SECTION 2 : INFORMATIONS GENERALE SUR
    // L'ETABLISSEMENT/ GENERAL INFORMATION".
    fr: "SECTION 2. INFORMATIONS GÉNÉRALE SUR L'ÉTABLISSEMENT",
    en: "SECTION 2. GENERAL INFORMATION",
  ),
  order: 2,
  entityTypes: ["vocationalTraining"],
);

const section2VocationalTrainingQuestions = <FormQuestionAst>[
  FormQuestionAst(
    id: "VT2_1",
    paperCode: "2.1.1",
    // Only the first field of each subsection run needs this explicit —
    // see VT1_15_NAME's own comment for why.
    subsection: LocalizedText(
      fr: "2.1 Renseignements généraux",
      en: "2.1 General Information",
    ),
    label: LocalizedText(
      fr: "Votre structure dispose-t-elle d'une convention avec l'Etat ?",
      en: "Has your training institution signed an agreement with the "
          "Government?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 1,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasStateAgreement",
  ),
  FormQuestionAst(
    id: "VT2_2",
    paperCode: "2.1.2",
    label: LocalizedText(
      fr: "Si oui, précisez le(s) type(s) de convention",
      en: "If yes, specify the type(s) of agreement",
    ),
    sectionId: "section2_vocationalTraining",
    order: 2,
    type: AstFieldType.checkbox,
    dependsOn: "VT2_1",
    dependsValue: "Oui/ Yes",
    // 2.1.2, PDF-confirmed (p.4): 4 items, no explicit QCM marker but
    // plural "type(s)" wording — treated as multi-select.
    options: [
      LocalizedOption("Stage académique/ academic internship",
          LocalizedText(fr: "Stage académique", en: "Academic internship")),
      LocalizedOption("Stage professionnel/ work placement",
          LocalizedText(fr: "Stage professionnel", en: "Work placement")),
      LocalizedOption(
          "Stage pré emploi/ pre-employment internship",
          LocalizedText(
              fr: "Stage pré-emploi", en: "Pre-employment internship")),
      LocalizedOption(
          "Insertion/ Insertion", LocalizedText(fr: "Insertion", en: "Insertion")),
    ],
    path: "vocationalTraining.agreementTypes",
  ),
  FormQuestionAst(
    id: "VT2_3",
    paperCode: "2.1.3",
    label: LocalizedText(
      fr: "Nombre de sites occupés par votre structure",
      // Was "Training institution premises" — not phrased as a request
      // for a number at all, unlike the French, even though this is a
      // number field (path: siteCount).
      en: "Number of sites occupied by your institution",
    ),
    sectionId: "section2_vocationalTraining",
    order: 3,
    type: AstFieldType.number,
    path: "vocationalTraining.siteCount",
  ),
  FormQuestionAst(
    id: "VT2_4",
    paperCode: "2.1.4",
    label: LocalizedText(
      fr: "Votre centre de formation professionnelle utilise-t-il des "
          "infrastructures en commun avec un autre établissement ?",
      en: "Does your school share infrastructure with another school?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 4,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.sharesInfrastructure",
  ),
  FormQuestionAst(
    id: "VT2_5",
    paperCode: "2.1.5",
    label: LocalizedText(
      fr: "Si oui, indiquez le nom de l'établissement partagé",
      en: "If yes, name of the school it shares premises with",
    ),
    sectionId: "section2_vocationalTraining",
    order: 5,
    type: AstFieldType.text,
    dependsOn: "VT2_4",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.sharedWithSchoolName",
  ),
  FormQuestionAst(
    id: "VT2_6",
    paperCode: "2.1.6",
    label: LocalizedText(
      fr: "Avez-vous des formateurs ayant reçu une formation pour "
          "accueillir les enfants à besoins éducatifs spéciaux ?",
      en: "Do you have trainers trained to receive learners with "
          "special educational needs?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 6,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasSpecialNeedsTrainers",
  ),
  FormQuestionAst(
    id: "VT2_7",
    paperCode: "2.1.7",
    label: LocalizedText(
      fr: "Si oui, précisez l'effectif de ces formateurs (Total)",
      en: "If yes, state the number of specialized teachers (Total)",
    ),
    sectionId: "section2_vocationalTraining",
    order: 7,
    type: AstFieldType.number,
    dependsOn: "VT2_6",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.specialNeedsTrainerTotal",
  ),
  FormQuestionAst(
    id: "VT2_8",
    paperCode: "2.1.7",
    label: LocalizedText(fr: "dont femmes", en: "of which female"),
    sectionId: "section2_vocationalTraining",
    order: 8,
    type: AstFieldType.number,
    dependsOn: "VT2_6",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.specialNeedsTrainerFemale",
  ),
  FormQuestionAst(
    id: "VT2_9",
    paperCode: "2.1.8",
    label: LocalizedText(
      // "dispose-t-elle" → "dispose-t-il": "le centre" is masculine.
      fr: "Le centre dispose-t-il de rampes d'accès pour accueillir "
          "les enfants à motricité reduite ?",
      en: "Does the centre have access ramps for persons with "
          "reduced mobility?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 9,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasAccessRamps",
  ),
  FormQuestionAst(
    id: "VT2_10",
    paperCode: "2.1.9",
    label: LocalizedText(
      fr: "Existe-t-il un bureau pour le directeur dans votre centre ?",
      en: "Is there an office for the director in your training center?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 10,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasDirectorOffice",
  ),
  FormQuestionAst(
    id: "VT2_11",
    paperCode: "2.1.10",
    label: LocalizedText(fr: "Boîte postale", en: "PO.Box"),
    sectionId: "section2_vocationalTraining",
    order: 11,
    type: AstFieldType.text,
    path: "vocationalTraining.poBox",
  ),
  FormQuestionAst(
    id: "VT2_12",
    paperCode: "2.1.11",
    label: LocalizedText(fr: "Email", en: "Email address"),
    sectionId: "section2_vocationalTraining",
    order: 12,
    type: AstFieldType.email,
    path: "vocationalTraining.email",
  ),
  FormQuestionAst(
    id: "VT2_13",
    paperCode: "2.1.12",
    label: LocalizedText(fr: "Site Web", en: "Web site"),
    sectionId: "section2_vocationalTraining",
    order: 13,
    type: AstFieldType.text,
    path: "vocationalTraining.website",
  ),
  FormQuestionAst(
    id: "VT2_14",
    paperCode: "2.1.13",
    label: LocalizedText(
      fr: "Êtes-vous agréé?",
      en: "Does your institution have an authorization?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 14,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.isAccredited",
  ),
  FormQuestionAst(
    id: "VT2_15",
    paperCode: "2.1.13",
    label: LocalizedText(
      fr: "Si oui, année du dernier agrément",
      en: "If yes, year of last authorization",
    ),
    sectionId: "section2_vocationalTraining",
    order: 15,
    type: AstFieldType.number,
    dependsOn: "VT2_14",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.lastAccreditationYear",
  ),
  FormQuestionAst(
    id: "VT2_16",
    paperCode: "2.1.13",
    label: LocalizedText(
      fr: "Arrêté n°",
      en: "Order N°",
    ),
    sectionId: "section2_vocationalTraining",
    order: 16,
    type: AstFieldType.text,
    dependsOn: "VT2_14",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.accreditationOrderNumber",
  ),
  FormQuestionAst(
    id: "VT2_17",
    paperCode: "2.1.13",
    // PDF-confirmed (p.4): not its own worded question — a continuation
    // of 2.1.13's own line ("Arrêté n°/ Order N° : ___ du/ of ___"), so
    // this label is a reasonable standalone stand-in rather than a
    // literal PDF phrase.
    label: LocalizedText(
      fr: "Date de l'arrêté d'accréditation",
      en: "Accreditation order date",
    ),
    sectionId: "section2_vocationalTraining",
    order: 17,
    type: AstFieldType.text,
    dependsOn: "VT2_14",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.accreditationOrderDate",
  ),
  FormQuestionAst(
    id: "VT2_18",
    paperCode: "2.1.14",
    label: LocalizedText(
      fr: "Quels types de formation votre centre dispense-t-il ?",
      en: "What types of training does your center offer?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 18,
    type: AstFieldType.checkbox,
    // PDF-confirmed (p.4): 2 items — a center can offer both FI and FC.
    options: [
      LocalizedOption(
          "Formation Initiale (FI)/ Initial Training (IT)",
          LocalizedText(
              fr: "Formation Initiale (FI)", en: "Initial Training (IT)")),
      LocalizedOption(
          "Formation Continue (FC)/ Continuing Training (CT)",
          LocalizedText(
              fr: "Formation Continue (FC)", en: "Continuing Training (CT)")),
    ],
    path: "vocationalTraining.trainingTypesOffered",
  ),
  FormQuestionAst(
    id: "VT2_19",
    paperCode: "2.1.15",
    label: LocalizedText(
      fr: "Nombre total d'apprenants dans votre centre",
      en: "Total number of trainees in your center",
    ),
    sectionId: "section2_vocationalTraining",
    order: 19,
    type: AstFieldType.number,
    path: "vocationalTraining.totalTraineesDeclared",
  ),
  FormQuestionAst(
    id: "VT2_20",
    paperCode: "2.1.15",
    label: LocalizedText(
      fr: "Nombre total de formateurs dans votre centre",
      en: "Total number of trainers in your center",
    ),
    sectionId: "section2_vocationalTraining",
    order: 20,
    type: AstFieldType.number,
    path: "vocationalTraining.totalTrainersDeclared",
  ),
  FormQuestionAst(
    id: "VT2_21",
    paperCode: "2.1.16",
    label: LocalizedText(
      fr: "Nombre total d'apprenants venant du premier cycle du "
          "secondaire",
      en: "Total number of trainees from lower secondary",
    ),
    sectionId: "section2_vocationalTraining",
    order: 21,
    type: AstFieldType.number,
    path: "vocationalTraining.traineesFromLowerSecondary",
  ),
  FormQuestionAst(
    id: "VT2_22",
    paperCode: "2.1.16",
    label: LocalizedText(
      fr: "Nombre total d'apprenants venant du second cycle du "
          "secondaire",
      en: "Total number of trainees from upper secondary",
    ),
    sectionId: "section2_vocationalTraining",
    order: 22,
    type: AstFieldType.number,
    path: "vocationalTraining.traineesFromUpperSecondary",
  ),
  FormQuestionAst(
    id: "VT2_23",
    paperCode: "2.2.1",
    subsection: LocalizedText(
      fr: "2.2 Informations sur les autres équipements et commodités du "
          "centre de formation",
      en: "2.2 Information on other equipment and facilities in the "
          "training center",
    ),
    label: LocalizedText(
      fr: "Le centre dispose-t-il d'une source d'énergie ?",
      en: "Is there a source of energy in the training center?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 23,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasEnergySource",
  ),
  FormQuestionAst(
    id: "VT2_24",
    paperCode: "2.2.1",
    label: LocalizedText(
      fr: "Si oui, cette source d'énergie est-elle fonctionnelle ?",
      en: "If yes, is this energy source functional?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 24,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    dependsOn: "VT2_23",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.isEnergySourceFunctional",
  ),
  FormQuestionAst(
    id: "VT2_25",
    paperCode: "2.2.1",
    label: LocalizedText(
      fr: "Si oui, précisez la source d'énergie",
      en: "If yes, specify the source of energy",
    ),
    sectionId: "section2_vocationalTraining",
    order: 25,
    type: AstFieldType.checkbox,
    dependsOn: "VT2_23",
    dependsValue: "Oui/ Yes",
    // PDF-confirmed (p.4): 3 items.
    options: [
      LocalizedOption("ENEO/ ENEO", LocalizedText.same("ENEO")),
      LocalizedOption("Groupe électrogène/ Generator",
          LocalizedText(fr: "Groupe électrogène", en: "Generator")),
      LocalizedOption(
          "Solaire/ Solar", LocalizedText(fr: "Solaire", en: "Solar")),
    ],
    path: "vocationalTraining.energySourceTypes",
  ),
  FormQuestionAst(
    id: "VT2_26",
    paperCode: "2.2.2",
    label: LocalizedText(
      // "dispose-t-elle" → "dispose-t-il": "le centre" is masculine.
      fr: "Le centre dispose-t-il d'une source d'approvisionnement en "
          "eau ?",
      en: "Does the centre have a water supply?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 26,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasWaterSource",
  ),
  FormQuestionAst(
    id: "VT2_27",
    paperCode: "2.2.2",
    // "Precise" used as a verb is a calque of French "préciser" — not
    // idiomatic English (matches PDF p.4-5 verbatim, inconsistent with
    // the PDF's own "specify" used one row up for the energy-source
    // equivalent, 2.2.1).
    label: LocalizedText(
      fr: "Si oui, précisez le type d'approvisionnement",
      en: "If yes, specify the type of supply",
    ),
    sectionId: "section2_vocationalTraining",
    order: 27,
    type: AstFieldType.checkbox,
    dependsOn: "VT2_26",
    dependsValue: "Oui/ Yes",
    // PDF-confirmed (p.4-5): 5 items.
    options: [
      LocalizedOption(
          "CAMWATER/ Tap Water", LocalizedText.same("CAMWATER")),
      LocalizedOption(
          "Puits/ Well", LocalizedText(fr: "Puits", en: "Well")),
      LocalizedOption(
          "Forage/ Bore-hole", LocalizedText(fr: "Forage", en: "Bore-hole")),
      LocalizedOption("Source aménagée/ Spring",
          LocalizedText(fr: "Source aménagée", en: "Spring")),
      LocalizedOption(
          "Marigot/ Pool", LocalizedText(fr: "Marigot", en: "Pool")),
    ],
    path: "vocationalTraining.waterSourceTypes",
  ),
  FormQuestionAst(
    id: "VT2_28",
    paperCode: "2.2.3",
    label: LocalizedText(
      fr: "Le centre a-t-il un dispositif fonctionnel de lavage des "
          "mains ?",
      en: "Does the school have a functional handwashing device?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 28,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasHandwashingDevice",
  ),
  FormQuestionAst(
    id: "VT2_29",
    paperCode: "2.2.4",
    // English previously described a different concept ("at least one
    // medical staff visit") than the French ("a health campaign"); the
    // path (hasReceivedHealthCampaign) confirms the French is the
    // intended concept, so English is reworded to match it.
    label: LocalizedText(
      fr: "Le centre a-t-il reçu une campagne de santé ?",
      en: "Has the centre received a health campaign?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 29,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasReceivedHealthCampaign",
  ),
  FormQuestionAst(
    id: "VT2_30",
    paperCode: "2.2.5",
    label: LocalizedText(
      fr: "Y a-t-il une boîte à pharmacie dans Le centre avec des "
          "produits de premiers soins ?",
      en: "Is there a first aid cupboard or box with drugs for "
          "emergency?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 30,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasFirstAidBox",
  ),
  FormQuestionAst(
    id: "VT2_31",
    paperCode: "2.2.6",
    label: LocalizedText(
      fr: "Votre centre dispose-t-il d'une infirmerie ?",
      en: "Does your school have a dispensary?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 31,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasDispensary",
  ),
  FormQuestionAst(
    id: "VT2_32",
    paperCode: "2.2.7",
    label: LocalizedText(
      fr: "Le centre dispose-t-il d'une bibliothèque fonctionnelle ?",
      en: "Is there a fonctional library?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 32,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasFunctionalLibrary",
  ),
  FormQuestionAst(
    id: "VT2_33",
    paperCode: "2.2.8",
    label: LocalizedText(
      fr: "Le centre de formation est-il limité par une clôture ?",
      en: "Is the training centre enclosed by a fence?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 33,
    // PDF-confirmed (p.5): 3-way coded choice — was free text with no
    // confirmed option wording; now retyped to radio like 1.10/1.11.
    type: AstFieldType.radio,
    options: [
      LocalizedOption("Oui, entièrement/ Yes, entirely",
          LocalizedText(fr: "Oui, entièrement", en: "Yes, entirely")),
      LocalizedOption("Oui, partiellement/ Yes, partially",
          LocalizedText(fr: "Oui, partiellement", en: "Yes, partially")),
      LocalizedOption("Non/ No", LocalizedText(fr: "Non", en: "No")),
    ],
    path: "vocationalTraining.fenceStatus",
  ),
  FormQuestionAst(
    id: "VT2_34",
    paperCode: "2.2.9",
    // VT2_34/35/36 previously all shared this identical English text
    // despite asking about three distinct bodies (confirmed by their own
    // distinct `path` values below) — an English-reading respondent
    // could not tell them apart. Each now names its actual body.
    label: LocalizedText(
      fr: "Existe-t-il un conseil d'établissement fonctionnel ?",
      en: "Is there a functioning school council?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 34,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasSchoolCouncil",
  ),
  FormQuestionAst(
    id: "VT2_35",
    paperCode: "2.2.10",
    label: LocalizedText(
      fr: "Existe-t-il un conseil de niveau au sein de votre "
          "etablissement ?",
      en: "Is there a level council in your institution?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 35,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasLevelCouncil",
  ),
  FormQuestionAst(
    id: "VT2_36",
    paperCode: "2.2.11",
    label: LocalizedText(
      fr: "Existe-t-il un conseil de discipline au sein de votre "
          "etablissement ?",
      en: "Is there a discipline council in your institution?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 36,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasDisciplinaryCouncil",
  ),
  FormQuestionAst(
    id: "VT2_37",
    paperCode: "2.2.12",
    label: LocalizedText(
      fr: "Le centre de formation a-t-il des latrines fonctionnelles "
          "et adaptées ?",
      en: "Does the school have functional latrines?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 37,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasFunctionalLatrines",
  ),
  FormQuestionAst(
    id: "VT2_38",
    paperCode: "2.2.12",
    label: LocalizedText(
      fr: "Si oui, précisez le type de latrines",
      en: "If yes, specify the type of latrine",
    ),
    sectionId: "section2_vocationalTraining",
    order: 38,
    type: AstFieldType.checkbox,
    dependsOn: "VT2_37",
    dependsValue: "Oui/ Yes",
    // PDF-confirmed (p.5): 3 items.
    options: [
      LocalizedOption("WC avec chasse d'eau/ Flushing toilet",
          LocalizedText(fr: "WC avec chasse d'eau", en: "Flushing toilet")),
      LocalizedOption("Latrines aménagées/ Equipped toilets",
          LocalizedText(fr: "Latrines aménagées", en: "Equipped toilets")),
      LocalizedOption(
          "Latrines non aménagées/ Unequipped toilets",
          LocalizedText(
              fr: "Latrines non aménagées", en: "Unequipped toilets")),
    ],
    path: "vocationalTraining.latrineTypes",
  ),
  FormQuestionAst(
    id: "VT2_39",
    paperCode: "2.2.12",
    label: LocalizedText(
      fr: "Si oui, les latrines des filles sont-elles dans un bloc "
          "différent de celui des garçons ?",
      en: "If yes, are the latrines of the girls in a different "
          "block and distant from that of the boys?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 39,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    dependsOn: "VT2_37",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.latrinesSeparateByGender",
  ),
  FormQuestionAst(
    id: "VT2_40",
    paperCode: "2.2.12",
    label: LocalizedText(
      fr: "Si oui, les latrines des élèves sont-elles séparées de "
          "celles des formateurs ?",
      en: "If yes, do teachers have separate toilets from students?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 40,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    dependsOn: "VT2_37",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.latrinesSeparateFromStaff",
  ),
  FormQuestionAst(
    id: "VT2_41",
    paperCode: "2.2.13",
    label: LocalizedText(
      fr: "Le centre de formation dispose-t-il d'aires de jeux ?",
      en: "Does the training centre have play areas?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 41,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasPlayground",
  ),
  FormQuestionAst(
    id: "VT2_42",
    paperCode: "2.2.13",
    label: LocalizedText(
      fr: "Si oui, sélectionnez le(s) type(s) d'infrastructure de jeux",
      en: "If yes, select the type(s) of play area",
    ),
    sectionId: "section2_vocationalTraining",
    order: 42,
    type: AstFieldType.checkbox,
    dependsOn: "VT2_41",
    dependsValue: "Oui/ Yes",
    // PDF-confirmed (p.5): 5 items, "sélectionner le(s) type(s)" → multi.
    options: [
      LocalizedOption("Terrain de football/ Football",
          LocalizedText(fr: "Terrain de football", en: "Football")),
      LocalizedOption("Terrain de handball/ Handball",
          LocalizedText(fr: "Terrain de handball", en: "Handball")),
      LocalizedOption(
          "Plateau de saut en hauteur/ High jump",
          LocalizedText(
              fr: "Plateau de saut en hauteur", en: "High jump")),
      LocalizedOption("Terrain de basketball/ Basketball",
          LocalizedText(fr: "Terrain de basketball", en: "Basketball")),
      LocalizedOption("Terrain de volleyball/ Volleyball",
          LocalizedText(fr: "Terrain de volleyball", en: "Volleyball")),
    ],
    path: "vocationalTraining.playgroundTypes",
  ),
  FormQuestionAst(
    id: "VT2_43",
    paperCode: "2.2.14",
    label: LocalizedText(
      fr: "Votre centre de formation dispose-t-il d'outils informatiques "
          "(ordinateurs ou tablettes)?",
      en: "Does your school possess ICT tools (computers, tablets)?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 43,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasIctTools",
  ),
  FormQuestionAst(
    id: "VT2_44",
    paperCode: "2.2.14",
    label: LocalizedText(
      fr: "Si oui, précisez le nombre d'outils informatiques "
          "(ordinateurs ou tablettes) mis à la disposition des "
          "formateurs",
      en: "If yes, indicate the number of ICT tools (computers, "
          "tablets) available to trainers",
    ),
    sectionId: "section2_vocationalTraining",
    order: 44,
    type: AstFieldType.number,
    dependsOn: "VT2_43",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.ictToolsForTrainersCount",
  ),
  FormQuestionAst(
    id: "VT2_45",
    paperCode: "2.2.14",
    // French is authoritative (PDF p.4-5, 2.2.14 internet line): a plain
    // Yes/No-style question ("Votre centre de formation a-t-il un accès à
    // internet ?", typo "à t-il"→"a-t-il" corrected), sitting beside a
    // blank count field on paper. English previously reused the *other*
    // ICT-count question's wording ("Indicate the number...") instead of
    // matching this field's own French — corrected to match. Field stays
    // `number` (path: ictToolsInternetCount) per the PDF's own blank
    // count line here, even though the label reads as Yes/No, same
    // ambiguity as printed.
    label: LocalizedText(
      fr: "Votre centre de formation a-t-il un accès à internet ?",
      en: "Does your training centre have internet access?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 45,
    type: AstFieldType.number,
    dependsOn: "VT2_43",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.ictToolsInternetCount",
  ),
  FormQuestionAst(
    id: "VT2_46",
    paperCode: "2.2.15",
    label: LocalizedText(
      fr: "Les formateurs de votre centre ont-ils reçu une formation sur "
          "les TIC ?",
      en: "Have your teachers undergone a training on ICTs?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 46,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.trainersIctTrained",
  ),
  FormQuestionAst(
    id: "VT2_47",
    paperCode: "2.2.15",
    label: LocalizedText(
      fr: "Si oui, précisez le nombre de formateurs formés (Total)",
      en: "If yes, specify the number of teachers trained (Total)",
    ),
    sectionId: "section2_vocationalTraining",
    order: 47,
    type: AstFieldType.number,
    dependsOn: "VT2_46",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.trainersIctTrainedTotal",
  ),
  FormQuestionAst(
    id: "VT2_48",
    paperCode: "2.2.15",
    label: LocalizedText(fr: "dont femmes", en: "of which female"),
    sectionId: "section2_vocationalTraining",
    order: 48,
    type: AstFieldType.number,
    dependsOn: "VT2_46",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.trainersIctTrainedFemale",
  ),
  FormQuestionAst(
    id: "VT2_49",
    paperCode: "2.2.16",
    label: LocalizedText(
      fr: "Les formateurs ont-ils reçu une session de formation sur la "
          "lutte contre les violences en milieu scolaire ?",
      en: "Did your teachers undergo a training on violence in the "
          "school milieu?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 49,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.trainersViolenceTraining",
  ),
  FormQuestionAst(
    id: "VT2_50",
    paperCode: "2.2.17",
    label: LocalizedText(
      fr: "Les formateurs de votre centre ont-ils reçu des sessions de "
          "formation PSS (Appui psychosocial) pour le soutien aux "
          "apprenants vulnérables ?",
      en: "Have teachers at your school received PSS (Psychosocial "
          "Support) training sessions to support vulnerable students?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 50,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.trainersPssTraining",
  ),
  FormQuestionAst(
    id: "VT2_51",
    paperCode: "2.2.18",
    // English was a noun-phrase fragment ("A residential training
    // centre?"), not phrased as a question — matches PDF p.6 (2.2.18)
    // verbatim, but doesn't read as a question the way the French does.
    label: LocalizedText(
      fr: "Votre centre dispose-t-il d'un internat ?",
      en: "Does your centre have a boarding facility?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 51,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasBoarding",
  ),
  FormQuestionAst(
    id: "VT2_52",
    paperCode: "2.2.19",
    label: LocalizedText(
      fr: "Votre centre dispose-t-il d'un dispositif de lutte contre "
          "les Violences Basées sur le genre (VBG) ?",
      en: "Does your centre have a mechanism to address gender-based "
          "violence (GBV)?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 52,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasGbvMechanism",
  ),
  FormQuestionAst(
    id: "VT2_53",
    paperCode: "2.2.20",
    label: LocalizedText(
      fr: "Votre centre dispose-t-il d'une cantine scolaire ?",
      en: "Does your centre have a school canteen?",
    ),
    sectionId: "section2_vocationalTraining",
    order: 53,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasCanteen",
  ),
  // Added for the MINEFOP Collect wizard redesign (Figma screen 06,
  // "Nombre total de cabines" / "Cabines réservées aux filles") — no
  // paper-form code, so appended after the last real §2.2 item rather
  // than interrupting the existing 2.2.1-2.2.20 sequence. dependsOn
  // VT2_37 matches the existing latrine-detail fields (VT2_38-40), which
  // only make sense once "functional/adapted latrines" is confirmed Oui.
  FormQuestionAst(
    id: "VT2_54",
    paperCode: "2.2.21",
    label: LocalizedText(
      fr: "Nombre total de cabines",
      en: "Total number of latrine cabins",
    ),
    sectionId: "section2_vocationalTraining",
    order: 54,
    type: AstFieldType.number,
    dependsOn: "VT2_37",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.latrineCabinTotalCount",
  ),
  FormQuestionAst(
    id: "VT2_55",
    paperCode: "2.2.22",
    label: LocalizedText(
      fr: "Cabines réservées aux filles",
      en: "Cabins reserved for girls",
    ),
    sectionId: "section2_vocationalTraining",
    order: 55,
    type: AstFieldType.number,
    dependsOn: "VT2_37",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.latrineCabinGirlsCount",
  ),
];

// ============================================================
// SECTION 3 - VOCATIONAL TRAINING (VT-2) — education in emergencies
// PDF-confirmed (p.6): every question now carries its real paperCode
// (3.1-3.12) and PDF wording — same "re-derived once the PDF became
// available" fix as Section 2 above.
// ============================================================

const section3VocationalTraining = SectionAst(
  id: "section3_vocationalTraining",
  title: LocalizedText(
    // PDF-confirmed (p.6): "SECTION 3 : INFORMATIONS SUR L'EDUCATION EN
    // SITUATION D'URGENCE / INFORMATIONS IN EDUCATION IN EMERGENCIES" — EN
    // kept as "Education in emergencies" rather than the PDF's own
    // grammatically-off "Informations in education in emergencies".
    fr: "SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION D'URGENCE",
    en: "SECTION 3. INFORMATION ON EDUCATION IN EMERGENCIES",
  ),
  order: 3,
  entityTypes: ["vocationalTraining"],
);

const section3VocationalTrainingQuestions = <FormQuestionAst>[
  FormQuestionAst(
    id: "VT3_1",
    paperCode: "3.1",
    // PDF-confirmed (p.6): no separate English printed for this stem
    // (unlike most other yes/no rows) — EN below is a direct, literal
    // translation of the French, not a printed PDF phrase.
    label: LocalizedText(
      fr: "Le centre a-t-il fait face à une situation de crise au cours "
          "de l'année ?",
      en: "Has the center faced a crisis situation during the year?",
    ),
    sectionId: "section3_vocationalTraining",
    order: 1,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.facedCrisis",
  ),
  FormQuestionAst(
    id: "VT3_2",
    paperCode: "3.1",
    // Singular wording ("the type") on a confirmed multi-select
    // (checkbox, QCM) field — pluralized to match.
    label: LocalizedText(
      fr: "Quels sont les types de crise ?",
      en: "What types of crisis?",
    ),
    sectionId: "section3_vocationalTraining",
    order: 2,
    type: AstFieldType.checkbox,
    dependsOn: "VT3_1",
    dependsValue: "Oui/ Yes",
    // 3.1, PDF-confirmed (p.6): 10 items, explicit "❑" tickbox glyphs +
    // "(QCM)" label — confirmed multi-select.
    options: [
      LocalizedOption(
          "Attaque contre l'établissement/ Attack on the School",
          LocalizedText(
              fr: "Attaque contre l'établissement",
              en: "Attack on the School")),
      LocalizedOption(
          "Attaque contre des élèves et personnels/ Attack on students and staff",
          LocalizedText(
              fr: "Attaque contre des élèves et personnels",
              en: "Attack on students and staff")),
      LocalizedOption(
          "Utilisation militaire de l'établissement/ Military use of the school",
          LocalizedText(
              fr: "Utilisation militaire de l'établissement",
              en: "Military use of the school")),
      LocalizedOption("Mouvements sociaux/ Social movements",
          LocalizedText(fr: "Mouvements sociaux", en: "Social movements")),
      LocalizedOption(
          "Endémie/épidémie/pandémie/ Endemic/epidemic/pandemic",
          LocalizedText(
              fr: "Endémie/épidémie/pandémie",
              en: "Endemic/epidemic/pandemic")),
      LocalizedOption(
          "Inondation/ Flood", LocalizedText(fr: "Inondation", en: "Flood")),
      LocalizedOption("Sècheresse/ Drought",
          LocalizedText(fr: "Sècheresse", en: "Drought")),
      LocalizedOption(
          "Tempêtes/ Storms", LocalizedText(fr: "Tempêtes", en: "Storms")),
      LocalizedOption("Glissement de Terrain/ Landslide",
          LocalizedText(fr: "Glissement de Terrain", en: "Landslide")),
      LocalizedOption(
          "Incendies/ Fires", LocalizedText(fr: "Incendies", en: "Fires")),
    ],
    path: "vocationalTraining.crisisTypes",
  ),
  FormQuestionAst(
    id: "VT3_3",
    paperCode: "3.1",
    label: LocalizedText(
      fr: "Si oui, cette crise a-t-elle entrainé la fermeture "
          "provisoire de votre centre ?",
      en: "If yes, did this crisis lead to the temporary closure of "
          "your center?",
    ),
    sectionId: "section3_vocationalTraining",
    order: 3,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    dependsOn: "VT3_1",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.crisisClosedCenter",
  ),
  FormQuestionAst(
    id: "VT3_4",
    paperCode: "3.1",
    label: LocalizedText(
      fr: "Si oui, indiquez le temps de fermeture (en semaines)",
      en: "If yes, indicate the length of the closure (in weeks)",
    ),
    sectionId: "section3_vocationalTraining",
    order: 4,
    type: AstFieldType.number,
    dependsOn: "VT3_3",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.closureDurationWeeks",
  ),
  FormQuestionAst(
    id: "VT3_5",
    paperCode: "3.2",
    label: LocalizedText(
      fr: "Le site de l'établissement est-il déplacé suite à la "
          "survenue de cette crise?",
      en: "Has the site of school been moved following the occurrence "
          "of this crisis?",
    ),
    sectionId: "section3_vocationalTraining",
    order: 5,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    dependsOn: "VT3_1",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.siteRelocated",
  ),
  FormQuestionAst(
    id: "VT3_6",
    paperCode: "3.2",
    label: LocalizedText(
      fr: "Si oui, précisez la localité de déplacement (ou le nom de "
          "l'établissement qui l'abrite)",
      en: "If yes, specify the relocation locality (or the name of "
          "the school which houses it)",
    ),
    sectionId: "section3_vocationalTraining",
    order: 6,
    type: AstFieldType.text,
    dependsOn: "VT3_5",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.relocationLocality",
  ),
  FormQuestionAst(
    id: "VT3_7",
    paperCode: "3.3",
    label: LocalizedText(
      fr: "Les apprenants ont-ils été réaffectés dans d'autres "
          "établissements ?",
      en: "Have learners been reassigned to other schools?",
    ),
    sectionId: "section3_vocationalTraining",
    order: 7,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    dependsOn: "VT3_1",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.traineesReassigned",
  ),
  FormQuestionAst(
    id: "VT3_8",
    paperCode: "3.3",
    label: LocalizedText(
        fr: "Si oui, précisez lesquels", en: "If yes, specify which ones"),
    sectionId: "section3_vocationalTraining",
    order: 8,
    type: AstFieldType.text,
    dependsOn: "VT3_7",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.reassignedTo",
  ),
  FormQuestionAst(
    id: "VT3_9",
    paperCode: "3.4",
    // PDF-confirmed (p.6) the printed English literally says "the MYEC"
    // rather than "the center" — an apparent drafting leftover in the
    // source PDF. Explicitly corrected per VT wording-fix instructions
    // ("never MYEC"): a respondent has no way to know what "MYEC" refers
    // to in a VTC census, so this deviates from print-verbatim fidelity
    // by deliberate instruction, unlike VT6_4/VT4_9's own kept-as-printed
    // discrepancies.
    label: LocalizedText(
      // Typo only ("dispose -t-il" → "dispose-t-il").
      fr: "Le centre dispose-t-il un dispositif d'alerte précoce "
          "d'urgence ?",
      en: "Does the centre have an emergency early-warning system?",
    ),
    sectionId: "section3_vocationalTraining",
    order: 9,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasEarlyWarningSystem",
  ),
  FormQuestionAst(
    id: "VT3_10",
    paperCode: "3.4",
    label: LocalizedText(
      fr: "Si oui, donnez le nom ou une description de ce dispositif",
      en: "If yes, give the name or a description of this device",
    ),
    sectionId: "section3_vocationalTraining",
    order: 10,
    type: AstFieldType.textarea,
    dependsOn: "VT3_9",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.earlyWarningDescription",
  ),
  FormQuestionAst(
    id: "VT3_11",
    paperCode: "3.4",
    label: LocalizedText(
      fr: "Si oui, ce dispositif est-il toujours à jour et fonctionnel ?",
      en: "If yes, is this device still up to date and functional?",
    ),
    sectionId: "section3_vocationalTraining",
    order: 11,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    dependsOn: "VT3_9",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.earlyWarningFunctional",
  ),
  FormQuestionAst(
    id: "VT3_12",
    paperCode: "3.5",
    label: LocalizedText(
      fr: "Les formateurs de votre centre sont-ils formés aux "
          "approches pédagogiques innovantes ?",
      en: "Are the trainers at your center trained in innovative "
          "teaching approaches?",
    ),
    sectionId: "section3_vocationalTraining",
    order: 12,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.trainersInnovativePedagogyTrained",
  ),
  FormQuestionAst(
    id: "VT3_13",
    paperCode: "3.5",
    label: LocalizedText(
        fr: "Si oui, dont hommes", en: "If yes, of which male"),
    sectionId: "section3_vocationalTraining",
    order: 13,
    type: AstFieldType.number,
    dependsOn: "VT3_12",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.trainersInnovativePedagogyMale",
  ),
  FormQuestionAst(
    id: "VT3_14",
    paperCode: "3.5",
    label: LocalizedText(fr: "dont femmes", en: "of which female"),
    sectionId: "section3_vocationalTraining",
    order: 14,
    type: AstFieldType.number,
    dependsOn: "VT3_12",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.trainersInnovativePedagogyFemale",
  ),
  FormQuestionAst(
    id: "VT3_15",
    paperCode: "3.6",
    label: LocalizedText(
      fr: "Les formateurs de votre centre sont-ils formés aux "
          "Approches pédagogiques adaptées aux crises (classe "
          "multi-niveaux, etc) ?",
      en: "Are the teachers in your school trained on Educational "
          "approaches adapted to crises (Multi-level class, etc)?",
    ),
    sectionId: "section3_vocationalTraining",
    order: 15,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.trainersCrisisPedagogyTrained",
  ),
  FormQuestionAst(
    id: "VT3_16",
    paperCode: "3.6",
    label: LocalizedText(
        fr: "Si oui, dont hommes", en: "If yes, of which male"),
    sectionId: "section3_vocationalTraining",
    order: 16,
    type: AstFieldType.number,
    dependsOn: "VT3_15",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.trainersCrisisPedagogyMale",
  ),
  FormQuestionAst(
    id: "VT3_17",
    paperCode: "3.6",
    label: LocalizedText(fr: "dont femmes", en: "of which female"),
    sectionId: "section3_vocationalTraining",
    order: 17,
    type: AstFieldType.number,
    dependsOn: "VT3_15",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.trainersCrisisPedagogyFemale",
  ),
  FormQuestionAst(
    id: "VT3_18",
    paperCode: "3.7",
    label: LocalizedText(
      fr: "Les formateurs de votre établissement sont-ils formés sur "
          "la réduction et gestion des risques de catastrophe",
      en: "Are the teachers in your school trained in Disaster risk "
          "reduction and management (DRRM)",
    ),
    sectionId: "section3_vocationalTraining",
    order: 18,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.trainersDrrmTrained",
  ),
  FormQuestionAst(
    id: "VT3_19",
    paperCode: "3.7",
    label: LocalizedText(
        fr: "Si oui, dont hommes", en: "If yes, of which male"),
    sectionId: "section3_vocationalTraining",
    order: 19,
    type: AstFieldType.number,
    dependsOn: "VT3_18",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.trainersDrrmMale",
  ),
  FormQuestionAst(
    id: "VT3_20",
    paperCode: "3.7",
    label: LocalizedText(fr: "dont femmes", en: "of which female"),
    sectionId: "section3_vocationalTraining",
    order: 20,
    type: AstFieldType.number,
    dependsOn: "VT3_18",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.trainersDrrmFemale",
  ),
  FormQuestionAst(
    id: "VT3_21",
    paperCode: "3.8",
    label: LocalizedText(
      fr: "Les formateurs de votre établissement sont-ils formés sur "
          "la réalisation des simulations et exercices pratiques "
          "d'évacuation, mise à l'abri avec les enfants, etc",
      en: "Are the teachers in your school trained on Carrying out "
          "simulations and practical evacuation exercises, sheltering "
          "with children, etc",
    ),
    sectionId: "section3_vocationalTraining",
    order: 21,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.trainersEvacuationDrillTrained",
  ),
  FormQuestionAst(
    id: "VT3_22",
    paperCode: "3.8",
    label: LocalizedText(
        fr: "Si oui, dont hommes", en: "If yes, of which male"),
    sectionId: "section3_vocationalTraining",
    order: 22,
    type: AstFieldType.number,
    dependsOn: "VT3_21",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.trainersEvacuationDrillMale",
  ),
  FormQuestionAst(
    id: "VT3_23",
    paperCode: "3.8",
    label: LocalizedText(fr: "dont femmes", en: "of which female"),
    sectionId: "section3_vocationalTraining",
    order: 23,
    type: AstFieldType.number,
    dependsOn: "VT3_21",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.trainersEvacuationDrillFemale",
  ),
  FormQuestionAst(
    id: "VT3_24",
    paperCode: "3.9",
    // PDF-confirmed (p.6): no separate English printed for this stem.
    label: LocalizedText(
      fr: "Les formateurs de votre établissement sont-ils formés sur "
          "d'autres aspect d'éducation en situation d'urgence",
      en: "Are the teachers in your school trained on other aspects of "
          "education in emergencies",
    ),
    sectionId: "section3_vocationalTraining",
    order: 24,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.trainersOtherEmergencyTrained",
  ),
  FormQuestionAst(
    id: "VT3_25",
    paperCode: "3.9",
    label: LocalizedText(
        fr: "Si oui, dont hommes", en: "If yes, of which male"),
    sectionId: "section3_vocationalTraining",
    order: 25,
    type: AstFieldType.number,
    dependsOn: "VT3_24",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.trainersOtherEmergencyMale",
  ),
  FormQuestionAst(
    id: "VT3_26",
    paperCode: "3.9",
    label: LocalizedText(fr: "dont femmes", en: "of which female"),
    sectionId: "section3_vocationalTraining",
    order: 26,
    type: AstFieldType.number,
    dependsOn: "VT3_24",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.trainersOtherEmergencyFemale",
  ),
  FormQuestionAst(
    id: "VT3_27",
    paperCode: "3.10",
    // PDF-confirmed (p.6): the printed English for this specific
    // sub-row literally reads "xxxx" — an unfilled drafting placeholder
    // in the source PDF itself. EN below is a direct translation of the
    // French, not a printed PDF phrase.
    label: LocalizedText(
      fr: "Sécurisation des dossiers des apprenants?",
      en: "Securing trainee records?",
    ),
    sectionId: "section3_vocationalTraining",
    order: 27,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasStudentRecordsSecurity",
  ),
  FormQuestionAst(
    id: "VT3_28",
    paperCode: "3.10",
    // PDF-confirmed (p.6): no separate English printed for this row.
    label: LocalizedText(
      fr: "Sécurisation des manuels scolaires ?",
      en: "Securing textbooks?",
    ),
    sectionId: "section3_vocationalTraining",
    order: 28,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasTextbookSecurity",
  ),
  FormQuestionAst(
    id: "VT3_29",
    paperCode: "3.11",
    label: LocalizedText(
      fr: "Le Centre dispose-t-il d'un plan de préparation ou de "
          "contingence ?",
      en: "Does the centre have a preparedness or contingency plan?",
    ),
    sectionId: "section3_vocationalTraining",
    order: 29,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasContingencyPlan",
  ),
  FormQuestionAst(
    id: "VT3_30",
    paperCode: "3.12",
    label: LocalizedText(
      fr: "Les apprenants de votre Centre ont-ils été formés aux "
          "mesures de protection en cas d'attaque ?",
      en: "Have the learners at your Center been trained in "
          "protective measures in the event of an attack?",
    ),
    sectionId: "section3_vocationalTraining",
    order: 30,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.traineesTrainedOnProtection",
  ),
];

// Shared row-key vocabularies for VT's grid/table questions below — one
// lowercased entry per non-TOTAL member of the matching Prisma enum
// (VtDiplomaCode, VtAgeBand, etc., all added in VT-1). TOTAL is never
// listed as a row: Administration's own csp_gender_age_table precedent
// (rows: ["fonctionnaire","decisionnaire","contractuelle"], no "total"
// row) establishes that a totals row/column is computed by the grid
// widget, not authored as data — "total" appears only in _vtGenders,
// matching that same precedent's "genders": [...,"total"].
//
// None of these tableSpec "template" strings have a renderer case yet
// (table_spec_builder.dart / form_schema_compiler.dart) — confirmed gap,
// accepted per explicit instruction: author the AST now, close the
// renderer gap in a later phase, same posture already true today for
// Project & Program's own kpi_period_table.
const _vtAcademicDiplomaRows = [
  "doctorat", "master2", "maitrise", "licence", "deug_dut", "bacc_general",
  "bacc_technique", "probatoire", "bepc", "cep", "sans_diplome_academique",
];
const _vtProfessionalDiplomaRows = [
  "dipleg_dipes2", "ingenieur_master_pro", "dipceg_dipes1", "licence_pro",
  "bts_hnd", "bep_bp_bacpro", "capieg", "capiaeg", "cap", "dqp", "cqp",
  "autres_pro", "sans_diplome_professionnel",
];
const _vtAgeBandRows = [
  "under_14", "age_14", "age_15", "age_16", "age_17", "age_18", "age_19",
  "age_20", "age_21", "age_22", "age_23", "age_24", "age_25", "age_26",
  "age_27", "age_28", "age_29", "age_30", "age_31", "age_32", "age_33",
  "age_34", "age_35", "above_35",
];
const _vtTrainerAgeBandRows = ["age_18_24", "age_25_39", "age_40_59", "age_60_plus"];
const _vtEducationLevelRows = [
  "non_alphabetise", "primaire", "premier_cycle_general",
  "premier_cycle_technique", "second_cycle_general",
  "second_cycle_technique", "enseignement_normal", "enseignement_superieur",
];
const _vtVulnerableCategoryRows = [
  "moteur", "visuel", "auditif", "polyhandicapes", "refugies",
  "orphelins_vulnerables", "deplaces_internes", "retournes", "bororo",
  "baka", "baguieli",
];
const _vtTrainerDisabilityRows = ["moteur", "visuel", "auditif", "polyhandicapes"];
const _vtInfrastructureRows = [
  "salle_classe", "ateliers_pratiques", "laboratoires",
  "blocs_administratifs", "salle_reunion", "salle_formateurs", "bureaux",
  "magasin", "espaces_temporaires",
];
const _vtFurnitureRows = [
  "banc_1_place", "banc_2_places", "banc_3_places", "banc_4_places_plus",
  "chaises_formateurs", "tables_formateurs", "armoires", "tableaux",
];
const _vtGenders = ["male", "female", "total"];
const _vtFlowStatuses = ["entrant", "sortant", "abandon"];

// ============================================================
// SECTION 4 - VOCATIONAL TRAINING (VT-2) — trainee data
//
// 11 PDF tables (4.1–4.11), 6 backing models per
// VOCATIONAL_TRAINING_DESIGN_NOTE.md §2/§6. §4.12 (Decision 1, closed)
// deliberately has no entry — leftover number under 4.11, no
// title/grid/instruction, nothing to collect.
//
// 4.1/4.2 and 4.3/4.4/4.5/4.6/4.10 share identical row/cell shapes
// within their group (confirmed by the design note's own row-count
// corrections and closure #1's named-column mapping) — PDF-confirmed
// (p.7-10): each table's own distinguishing text is now captured in its
// label (4.3 = unemployed/qualified working-age trainees, 4.4 = informal
// sector, 4.5 = general population, 4.6 = year of study, 4.10 = outgoing/
// leavers of the prior year). Coherence rules 1–6 (design note §10) are
// the only confirmed cross-table relationships; they inform row/cell
// shape here but are not themselves implemented in this pass (that's the
// coherence-runtime phase, out of scope for VT-2).
// ============================================================

const section4VocationalTraining = SectionAst(
  id: "section4_vocationalTraining",
  title: LocalizedText(
    // PDF-confirmed (p.7): "SECTION 4 : INFORMATIONS SUR LES APPRENANTS /
    // DETAILS ON TRAINEES".
    fr: "SECTION 4. INFORMATIONS SUR LES APPRENANTS",
    en: "SECTION 4. DETAILS ON TRAINEES",
  ),
  order: 4,
  entityTypes: ["vocationalTraining"],
);

const section4VocationalTrainingQuestions = <FormQuestionAst>[
  // 4.1 — trainees by academic diploma (OnefopVtDiplomaData,
  // personType=TRAINEE, diplomaKind=ACADEMIC)
  FormQuestionAst(
    id: "VT4_1",
    paperCode: "4.1",
    // PDF-confirmed (p.7): "Effectifs des apprenants par diplôme
    // académique le plus élevé / Number of trainers per Academic
    // qualification" — EN "trainers" is the PDF's own typo for
    // "trainees", corrected here (same posture as this section's own
    // header comment).
    // Own printed header (vocationalTraining.hbs's h3, p.7) — shown as
    // the VT desktop outline's subsection identity (VtSectionOutline);
    // no longer duplicated as a separate pinned banner above the table
    // itself (see onefop_section_units.dart — addSimpleUnit's
    // vtTableHeader path was removed for this exact reason).
    subsection: LocalizedText(
      fr: "4.1 Effectifs des apprenants par diplôme académique le plus "
          "élevé",
      en: "4.1 Number of trainees per academic qualification",
    ),
    label: LocalizedText(
      fr: "Effectifs des apprenants par diplôme académique le plus élevé",
      en: "Number of trainees per academic qualification",
    ),
    sectionId: "section4_vocationalTraining",
    order: 1,
    type: AstFieldType.table,
    tableSpec: {
      "template": "vt_diploma_table",
      "prefix": "s4q1",
      "rows": _vtAcademicDiplomaRows,
      "genders": _vtGenders,
    },
  ),
  // 4.2 — trainees by professional diploma (OnefopVtDiplomaData,
  // personType=TRAINEE, diplomaKind=PROFESSIONAL). Coherence rule 1: 4.1
  // total = 4.2 total (same headcount, cross-tabbed by diploma kind).
  FormQuestionAst(
    id: "VT4_2",
    paperCode: "4.2",
    // PDF-confirmed (p.7): "Apprenants par diplôme professionnel le
    // plus élevé / Number of trainers per Vocational Qualification"
    // (same "trainers"→"trainees" typo fix as 4.1).
    subsection: LocalizedText(
      fr: "4.2 Apprenants par diplôme professionnel le plus élevé",
      en: "4.2 Number of trainees per Vocational Qualification",
    ),
    label: LocalizedText(
      fr: "Apprenants par diplôme professionnel le plus élevé",
      en: "Number of trainees per Vocational Qualification",
    ),
    sectionId: "section4_vocationalTraining",
    order: 2,
    type: AstFieldType.table,
    tableSpec: {
      "template": "vt_diploma_table",
      "prefix": "s4q2",
      "rows": _vtProfessionalDiplomaRows,
      "genders": _vtGenders,
    },
  ),
  // 4.3, 4.4, 4.5 — repeating specialty rows, FI/FC × gender cell shape
  // (closure #1), 12-row printed capacity. Coherence rules 2/3 tie 4.5
  // specifically to 4.2's total and to 4.6 — no rule ties 4.3/4.4, so
  // their distinct meaning from 4.5 is not asserted here.
  FormQuestionAst(
    id: "VT4_3",
    paperCode: "4.3",
    // PDF-confirmed (p.7): a distinct population from 4.4/4.5 below —
    // unemployed, qualified trainees of working age, not the general
    // trainee body.
    subsection: LocalizedText(
      fr: "4.3 Effectifs des apprenants en âge de travailler non occupés "
          "et qualifiés par spécialités et type de formation",
      en: "4.3 Number of unemployed and qualified learners of working "
          "age by specialty and type of training",
    ),
    label: LocalizedText(
      fr: "Effectifs des apprenants en âge de travailler non occupés "
          "et qualifiés par spécialités et type de formation",
      en: "Number of unemployed and qualified learners of working age "
          "by specialty and type of training",
    ),
    sectionId: "section4_vocationalTraining",
    order: 3,
    type: AstFieldType.repeatingTable,
    path: "vocationalTraining.specialtyRows_4_3",
    tableSpec: {
      "template": "vt_specialty_fi_fc_table",
      "prefix": "s4q3",
      "tableCode": "4.3",
      "rows": 12,
      "fields": ["specialtyText", "fiMale", "fiFemale", "fcMale", "fcFemale"],
    },
  ),
  FormQuestionAst(
    id: "VT4_4",
    paperCode: "4.4",
    // PDF-confirmed (p.8): trainees working in the informal sector —
    // also a distinct population from 4.3/4.5.
    subsection: LocalizedText(
      fr: "4.4 Effectifs des apprenants par spécialités et type de "
          "formation travaillant dans le secteur informel",
      en: "4.4 Number of trainees per specialty and type of training in "
          "the informal sector",
    ),
    label: LocalizedText(
      fr: "Effectifs des apprenants par spécialités et type de "
          "formation travaillant dans le secteur informel",
      en: "Number of trainees per specialty and type of training in "
          "the informal sector",
    ),
    sectionId: "section4_vocationalTraining",
    order: 4,
    type: AstFieldType.repeatingTable,
    path: "vocationalTraining.specialtyRows_4_4",
    tableSpec: {
      "template": "vt_specialty_fi_fc_table",
      "prefix": "s4q4",
      "tableCode": "4.4",
      "rows": 12,
      "fields": ["specialtyText", "fiMale", "fiFemale", "fcMale", "fcFemale"],
    },
  ),
  FormQuestionAst(
    id: "VT4_5",
    paperCode: "4.5",
    // PDF-confirmed (p.8): the general trainee population by specialty
    // and training type — this is the one 4.3/4.4 are each a specific
    // subset of.
    subsection: LocalizedText(
      fr: "4.5 Effectifs des apprenants par spécialités et type de "
          "formation",
      en: "4.5 Number of trainees per specialty and type of training",
    ),
    label: LocalizedText(
      fr: "Effectifs des apprenants par spécialités et type de "
          "formation",
      en: "Number of trainees per specialty and type of training",
    ),
    sectionId: "section4_vocationalTraining",
    order: 5,
    type: AstFieldType.repeatingTable,
    path: "vocationalTraining.specialtyRows_4_5",
    tableSpec: {
      "template": "vt_specialty_fi_fc_table",
      "prefix": "s4q5",
      "tableCode": "4.5",
      "rows": 12,
      "fields": ["specialtyText", "fiMale", "fiFemale", "fcMale", "fcFemale"],
    },
  ),
  // 4.6 — repeating specialty rows, year1/year2 × gender cell shape
  // (closure #1), 12-row capacity. Coherence rule 3: Σ4.5[FI only] =
  // Σ4.6.
  FormQuestionAst(
    id: "VT4_6",
    paperCode: "4.6",
    subsection: LocalizedText(
      fr: "4.6 Effectifs des apprenants par année d'études (pour la "
          "formation Initiale) et par sexe",
      en: "4.6 Number of trainees per year of study (for Initial "
          "training) and per gender",
    ),
    label: LocalizedText(
      fr: "Effectifs des apprenants par année d'études (pour la "
          "formation Initiale) et par sexe",
      en: "Number of trainees per year of study (for Initial "
          "training) and per gender",
    ),
    sectionId: "section4_vocationalTraining",
    order: 6,
    type: AstFieldType.repeatingTable,
    path: "vocationalTraining.specialtyRows_4_6",
    tableSpec: {
      "template": "vt_specialty_year_table",
      "prefix": "s4q6",
      "tableCode": "4.6",
      "rows": 12,
      "fields": [
        "specialtyText",
        "year1Male",
        "year1Female",
        "year2Male",
        "year2Female",
      ],
    },
  ),
  // 4.7 — trainee flow (entrant/sortant/abandon) by age band and gender
  // (OnefopVtTraineeAgeFlow). Coherence rule 4: 4.2 total = Σ4.7[ENTRANT].
  FormQuestionAst(
    id: "VT4_7",
    paperCode: "4.7",
    subsection: LocalizedText(
      fr: "4.7 Effectifs des apprenants par âge",
      en: "4.7 Number of trainees per age group",
    ),
    label: LocalizedText(
      fr: "Effectifs des apprenants par âge",
      en: "Number of trainees per age group",
    ),
    sectionId: "section4_vocationalTraining",
    order: 7,
    type: AstFieldType.table,
    tableSpec: {
      "template": "vt_trainee_age_flow_table",
      "prefix": "s4q7",
      "rows": _vtAgeBandRows,
      "genders": _vtGenders,
      "flow_statuses": _vtFlowStatuses,
    },
  ),
  // 4.8 — trainee flow by education level and gender
  // (OnefopVtEducationLevelFlow). Coherence rule 5: 4.2 total =
  // Σ4.8[ENTRANT].
  FormQuestionAst(
    id: "VT4_8",
    paperCode: "4.8",
    subsection: LocalizedText(
      fr: "4.8 Effectifs des entrants, des sortants et abandons par "
          "Niveau d'études à l'entrée",
      en: "4.8 Number of incoming, outgoing and drop-out trainees per "
          "level of education",
    ),
    label: LocalizedText(
      fr: "Effectifs des entrants, des sortants et abandons par "
          "Niveau d'études à l'entrée",
      en: "Number of incoming, outgoing and drop-out trainees per "
          "level of education",
    ),
    sectionId: "section4_vocationalTraining",
    order: 8,
    type: AstFieldType.table,
    tableSpec: {
      "template": "vt_education_level_flow_table",
      "prefix": "s4q8",
      "rows": _vtEducationLevelRows,
      "genders": _vtGenders,
      "flow_statuses": _vtFlowStatuses,
    },
  ),
  // 4.9 — vulnerable trainee flow by category and gender
  // (OnefopVtTraineeVulnerable).
  FormQuestionAst(
    id: "VT4_9",
    paperCode: "4.9",
    // PDF-confirmed (p.10): its own French/English titles covered
    // different scopes ("socially vulnerable people" vs. "type of
    // impairment") — French is authoritative; English corrected to match
    // it per explicit VT wording-fix instruction, rather than kept as
    // printed.
    subsection: LocalizedText(
      fr: "4.9 Effectifs des personnes socialement vulnérables par sexe",
      en: "4.9 Number of socially vulnerable persons, by sex",
    ),
    label: LocalizedText(
      fr: "Effectifs des personnes socialement vulnérables par sexe",
      en: "Number of socially vulnerable persons, by sex",
    ),
    sectionId: "section4_vocationalTraining",
    order: 9,
    type: AstFieldType.table,
    tableSpec: {
      "template": "vt_vulnerable_table",
      "prefix": "s4q9",
      "rows": _vtVulnerableCategoryRows,
      "genders": _vtGenders,
      "flow_statuses": _vtFlowStatuses,
    },
  ),
  // 4.10 — repeating specialty rows, male/female/total cell shape
  // (closure #1), 10-row printed capacity. Coherence rule 6:
  // Σ4.7[SORTANT] = Σ4.10.
  FormQuestionAst(
    id: "VT4_10",
    paperCode: "4.10",
    subsection: LocalizedText(
      fr: "4.10 Effectifs des sortants par spécialités et selon le sexe "
          "pour l'année antérieur (2024-2025)",
      en: "4.10 Number of outgoing trainees per specialities",
    ),
    label: LocalizedText(
      fr: "Effectifs des sortants par spécialités et selon le sexe "
          "pour l'année antérieur (2024-2025)",
      en: "Number of outgoing trainees per specialities",
    ),
    sectionId: "section4_vocationalTraining",
    order: 10,
    type: AstFieldType.repeatingTable,
    path: "vocationalTraining.specialtyRows_4_10",
    tableSpec: {
      "template": "vt_specialty_gender_total_table",
      "prefix": "s4q10",
      "tableCode": "4.10",
      "rows": 10,
      "fields": ["specialtyText", "male", "female", "total"],
    },
  ),
  // 4.11 — scholarships by category and status (OnefopVtScholarship).
  FormQuestionAst(
    id: "VT4_11",
    paperCode: "4.11",
    // PDF-confirmed (p.10): fr "Effectifs des apprenants par types de
    // bourse et selon le sexe" — no English printed for this header;
    // EN below is a literal translation, kept consistent with the
    // sibling tables' style.
    subsection: LocalizedText(
      fr: "4.11 Effectifs des apprenants par types de bourse et selon "
          "le sexe",
      en: "4.11 Number of trainees by scholarship type and gender",
    ),
    label: LocalizedText(
      fr: "Effectifs des apprenants par types de bourse et selon le sexe",
      en: "Number of trainees by scholarship type and gender",
    ),
    sectionId: "section4_vocationalTraining",
    order: 11,
    type: AstFieldType.table,
    tableSpec: {
      "template": "vt_scholarship_table",
      "prefix": "s4q11",
      "rows": ["other_admin", "international"],
      "statuses": ["granted", "received"],
      "genders": _vtGenders,
    },
  ),
  // §4.12 — Decision 1 (closed): leftover number under 4.11, no title,
  // no grid, no instruction. Not collected. No question here.
];

// ============================================================
// SECTION 5 - VOCATIONAL TRAINING (VT-2) — study guides, curriculum,
// infrastructure, furniture
// PDF-confirmed (p.11): every question now carries its real paperCode
// (5.1.1/5.1.2/5.2/5.3/5.4) and PDF wording.
// ============================================================

const section5VocationalTraining = SectionAst(
  id: "section5_vocationalTraining",
  title: LocalizedText(
    // PDF-confirmed (p.11): "SECTION 5 : INFORMATIONS SUR LES MANUELS
    // D'APPRENTISSAGE, EQUIPEMENTS ET INFRASTRUCTURES" — no English printed
    // for this header on the source page (unlike every other section); EN
    // below is a literal, unconfirmed translation kept consistent with the
    // French, not copied from elsewhere in the PDF.
    fr: "SECTION 5. INFORMATIONS SUR LES MANUELS D'APPRENTISSAGE, "
        "EQUIPEMENTS ET INFRASTRUCTURES",
    en: "SECTION 5. LEARNING MATERIALS, EQUIPMENT AND INFRASTRUCTURE",
  ),
  order: 5,
  entityTypes: ["vocationalTraining"],
);

const section5VocationalTrainingQuestions = <FormQuestionAst>[
  FormQuestionAst(
    id: "VT5_1",
    paperCode: "5.1.1",
    // PDF-confirmed (vocationalTraining.hbs's own printed h3, p.11): "5.1
    // Manuels d'apprentissage pour l'année en cours" — set on every field
    // through VT5_4 (5.1.1 and 5.1.2 both belong under this one heading),
    // not just this first one; see SectionUnit.subsectionLabel's own doc
    // comment for why.
    subsection: LocalizedText(
      fr: "5.1 Manuels d'apprentissage pour l'année en cours",
      en: "5.1 Study guides for the current year",
    ),
    label: LocalizedText(
      fr: "Des manuels d'apprentissage pour apprenant ?",
      en: "Study guides or didactic materials for trainees?",
    ),
    sectionId: "section5_vocationalTraining",
    order: 1,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasTraineeStudyGuides",
  ),
  FormQuestionAst(
    id: "VT5_2",
    paperCode: "5.1.1",
    subsection: LocalizedText(
      fr: "5.1 Manuels d'apprentissage pour l'année en cours",
      en: "5.1 Study guides for the current year",
    ),
    label: LocalizedText(
      fr: "Si oui, précisez le nombre de manuels d'apprentissage pour "
          "apprenants",
      en: "If yes, specify the number of study guides for trainees",
    ),
    sectionId: "section5_vocationalTraining",
    order: 2,
    type: AstFieldType.number,
    dependsOn: "VT5_1",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.traineeStudyGuideCount",
  ),
  FormQuestionAst(
    id: "VT5_3",
    paperCode: "5.1.2",
    subsection: LocalizedText(
      fr: "5.1 Manuels d'apprentissage pour l'année en cours",
      en: "5.1 Study guides for the current year",
    ),
    label: LocalizedText(
      fr: "Des manuels d'apprentissage pour formateurs ?",
      en: "Study guides or didactic materials for trainers",
    ),
    sectionId: "section5_vocationalTraining",
    order: 3,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasTrainerStudyGuides",
  ),
  FormQuestionAst(
    id: "VT5_4",
    paperCode: "5.1.2",
    subsection: LocalizedText(
      fr: "5.1 Manuels d'apprentissage pour l'année en cours",
      en: "5.1 Study guides for the current year",
    ),
    label: LocalizedText(
      fr: "Si oui, précisez le nombre de manuels d'apprentissage pour "
          "formateurs",
      en: "If yes, specify the number of study guides for trainers",
    ),
    sectionId: "section5_vocationalTraining",
    order: 4,
    type: AstFieldType.number,
    dependsOn: "VT5_3",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.trainerStudyGuideCount",
  ),
  // 5.2 — curriculum by specialty (OnefopVtCurriculum), 15-row printed
  // capacity. PDF-confirmed (p.11) bracketed note: "Le référentiel ici
  // fait allusion pour une spécialité donnée, au programme de formation
  // élaboré. Et homologué demande si ce programme vient du MINEFOP".
  FormQuestionAst(
    id: "VT5_5",
    paperCode: "5.2",
    subsection: LocalizedText(
      fr: "5.2 Référentiel de formation",
      en: "5.2 Training curriculum",
    ),
    label: LocalizedText(
      fr: "Référentiel de formation",
      en: "Number of Training curricula",
    ),
    sectionId: "section5_vocationalTraining",
    order: 5,
    type: AstFieldType.repeatingTable,
    path: "vocationalTraining.curriculum",
    instruction: LocalizedText(
      fr: "Le référentiel ici fait allusion pour une spécialité donnée, "
          "au programme de formation élaboré. Et homologué demande si "
          "ce programme vient du MINEFOP",
      en: "\"Curriculum\" here refers, for a given specialty, to the "
          "training program developed. \"Approved\" asks whether this "
          "program comes from MINEFOP",
    ),
    tableSpec: {
      "template": "vt_curriculum_table",
      "prefix": "s5q2",
      "rows": 15,
      "fields": ["specialtyText", "hasCurriculum", "isApproved"],
    },
  ),
  // 5.3 — infrastructure inventory (OnefopVtInfrastructure), fixed
  // 9-category grid, no gender split.
  FormQuestionAst(
    id: "VT5_6",
    paperCode: "5.3",
    subsection: LocalizedText(
      fr: "5.3 Nombre d'infrastructures selon leur état",
      en: "5.3 Number of infrastructure by condition",
    ),
    label: LocalizedText(
      fr: "Nombre d'infrastructures en fonction de leur état",
      en: "Number of infrastructure",
    ),
    sectionId: "section5_vocationalTraining",
    order: 6,
    type: AstFieldType.table,
    tableSpec: {
      "template": "vt_infrastructure_table",
      "prefix": "s5q3",
      "rows": _vtInfrastructureRows,
      "columns": [
        "totalCount",
        "permanentGoodCount",
        "permanentBadCount",
        "temporaryCount",
      ],
    },
  ),
  // 5.4 — furniture inventory (OnefopVtFurniture), fixed 8-category grid.
  FormQuestionAst(
    id: "VT5_7",
    paperCode: "5.4",
    subsection: LocalizedText(
      fr: "5.4 Equipements mobiliers",
      en: "5.4 Furniture",
    ),
    label: LocalizedText(
      fr: "Equipements mobiliers",
      en: "Furniture",
    ),
    sectionId: "section5_vocationalTraining",
    order: 7,
    type: AstFieldType.table,
    tableSpec: {
      "template": "vt_furniture_table",
      "prefix": "s5q4",
      "rows": _vtFurnitureRows,
      "columns": ["goodCount", "badCount"],
    },
  ),
];

// ============================================================
// SECTION 6 - VOCATIONAL TRAINING (VT-2) — orientation and
// post-training follow-up
// ============================================================

const section6VocationalTraining = SectionAst(
  id: "section6_vocationalTraining",
  title: LocalizedText(
    // PDF-confirmed (p.13): "SECTION 6: ORIENTATION PROFESSIONNELLE ET
    // INFORMATIONS SUR LE SUIVI POST-FORMATION DES SORTANTS DES CENTRES DE
    // FORMATION PROFESSIONNELLES DU MINEFOP / PROFESSIONAL ORIENTATION AND
    // INFORMATION ON THE POST-TRAINING FOLLOW-UP OF MINEFOP VOCATIONAL
    // TRAINING CENTER GRADUATES".
    fr: "SECTION 6. ORIENTATION PROFESSIONNELLE ET INFORMATIONS SUR LE "
        "SUIVI POST-FORMATION DES SORTANTS DES CENTRES DE FORMATION "
        "PROFESSIONNELLES DU MINEFOP",
    en: "SECTION 6. PROFESSIONAL ORIENTATION AND INFORMATION ON THE "
        "POST-TRAINING FOLLOW-UP OF MINEFOP VOCATIONAL TRAINING CENTER "
        "GRADUATES",
  ),
  order: 6,
  entityTypes: ["vocationalTraining"],
);

const section6VocationalTrainingQuestions = <FormQuestionAst>[
  FormQuestionAst(
    id: "VT6_1",
    paperCode: "6.1.1",
    // PDF-confirmed (p.13): "6.1 Orientation professionnelle dans les
    // centres de formation professionnelle" — no English printed for
    // this specific subsection banner (unlike 6.2 below); EN is a
    // literal translation, not a printed PDF phrase.
    subsection: LocalizedText(
      fr: "6.1 Orientation professionnelle dans les centres de "
          "formation professionnelle",
      en: "6.1 Professional orientation in vocational training centers",
    ),
    label: LocalizedText(
      fr: "Existe-t-il un service d'orientation professionnelle dans "
          "votre centre ?",
      en: "Is there a career counseling service in your center?",
    ),
    sectionId: "section6_vocationalTraining",
    order: 1,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasCareerGuidanceService",
  ),
  FormQuestionAst(
    id: "VT6_2",
    paperCode: "6.1.1",
    // PDF-confirmed (p.13): was "Horaires du service d'orientation"/
    // "Career guidance service timings" — the 3 options are WHEN in the
    // training process guidance is factored in (before/during/after),
    // not opening hours; the label was a wrong reading of what the
    // options represent.
    label: LocalizedText(
      fr: "Si oui, comment prenez-vous en compte l'orientation "
          "professionnelle dans votre dispositif de formation "
          "professionnelle ?",
      en: "If yes, how do you consider career guidance in your "
          "vocational training system?",
    ),
    sectionId: "section6_vocationalTraining",
    order: 2,
    type: AstFieldType.checkbox,
    dependsOn: "VT6_1",
    dependsValue: "Oui/ Yes",
    // 6.1.1, PDF-confirmed (p.13): 3 items, "(QCM)" → multi-select.
    options: [
      LocalizedOption("Avant la formation/ Before training",
          LocalizedText(fr: "Avant la formation", en: "Before training")),
      LocalizedOption(
          "Pendant la formation/ During the training",
          LocalizedText(
              fr: "Pendant la formation", en: "During the training")),
      LocalizedOption("Après la formation/ After the training",
          LocalizedText(fr: "Après la formation", en: "After the training")),
    ],
    path: "vocationalTraining.careerGuidanceTimings",
  ),
  // 6.1.2 — Decision 4 (closed): two Yes/No questions sharing one printed
  // code, persisted as two Detail booleans.
  FormQuestionAst(
    id: "VT6_3",
    paperCode: "6.1.2",
    label: LocalizedText(
      fr: "Les apprenants choisissent-ils les filières de formation "
          "avec l'accompagnement de ce service ?",
      en: "Do learners choose training paths with the support of "
          "this service?",
    ),
    sectionId: "section6_vocationalTraining",
    order: 3,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.traineesChooseWithSupport",
  ),
  FormQuestionAst(
    id: "VT6_4",
    paperCode: "6.1.2",
    // PDF-confirmed (p.13): the French names CIOP as the example, the
    // English named COSUP instead — French is authoritative, so English
    // is corrected to CIOP per explicit VT wording-fix instruction rather
    // than kept as printed.
    label: LocalizedText(
      fr: "Sinon, collaborez-vous avec les structures publiques "
          "d'orientation existante à l'exemple du CIOP ?",
      en: "If not, do you collaborate with existing public guidance "
          "structures such as CIOP?",
    ),
    sectionId: "section6_vocationalTraining",
    order: 4,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    // VT-UI/UX-06: the only negative-trigger dependsOn in the VT AST — the
    // paper's own "Sinon" (p.13, 6.1.2) only asks this when 6.1.2's first
    // question was answered No, not Yes.
    dependsOn: "VT6_3",
    dependsValue: "Non/ No",
    path: "vocationalTraining.collaboratesWithCiopCosup",
  ),
  FormQuestionAst(
    id: "VT6_5",
    paperCode: "6.1.3",
    label: LocalizedText(
      fr: "Quel accompagnement le service d'orientation assure aux "
          "apprenants ?",
      en: "What support does the guidance department provide to "
          "learners?",
    ),
    sectionId: "section6_vocationalTraining",
    order: 5,
    type: AstFieldType.checkbox,
    // 6.1.3, PDF-confirmed (p.13): 5 items — 5th ("Autres") has a
    // free-text follow-up already modeled separately as VT6_6/
    // guidanceSupportOther.
    options: [
      // Display text only — the option VALUE string above is the stored/
      // compared value and stays byte-identical; "impregnation" was a
      // literal calque of "imprégnation" and doesn't mean anything in
      // English guidance terminology.
      LocalizedOption(
          "Orientation d'imprégnation/ impregnation orientation",
          LocalizedText(
              fr: "Orientation d'imprégnation",
              en: "Familiarisation / exposure guidance")),
      LocalizedOption(
          "Orientation de consolidation/ Consolidation orientation",
          LocalizedText(
              fr: "Orientation de consolidation",
              en: "Consolidation orientation")),
      LocalizedOption(
          "Orientation d'insertion/ Insertion orientation",
          LocalizedText(
              fr: "Orientation d'insertion", en: "Insertion orientation")),
      LocalizedOption(
          "Suivi post-formation/ Post-training follow-up",
          LocalizedText(
              fr: "Suivi post-formation", en: "Post-training follow-up")),
      LocalizedOption(
          "Autres/ Others", LocalizedText(fr: "Autres", en: "Others")),
    ],
    path: "vocationalTraining.guidanceSupportTypes",
  ),
  FormQuestionAst(
    id: "VT6_6",
    paperCode: "6.1.3",
    label: LocalizedText(fr: "Autre, précisez", en: "Other, specify"),
    sectionId: "section6_vocationalTraining",
    order: 6,
    type: AstFieldType.text,
    // VT-UI/UX-07: VT6_5's own "Autres/ Others" option value (see its
    // options list a few lines above) — shown only once that checkbox
    // option is actually selected, not merely whenever VT6_5 has any
    // selection at all.
    dependsOn: "VT6_5",
    dependsValue: "Autres/ Others",
    dependsOperator: "contains",
    path: "vocationalTraining.guidanceSupportOther",
  ),
  FormQuestionAst(
    id: "VT6_7",
    paperCode: "6.2.1",
    // PDF-confirmed (p.13): "6.2 Informations sur le suivi post-formation
    // des sortants des centres de formation professionnelles du minefop/
    // information on the post-training follow-up of minefop vocational
    // training center graduates" — VT6_13 (6.3) inherits this too (see
    // groupFields()); it's presented as a continuation of the same
    // suivi-post-formation theme, not a new subsection of its own.
    subsection: LocalizedText(
      fr: "6.2 Informations sur le suivi post-formation des sortants des "
          "centres de formation professionnelles du minefop",
      en: "6.2 Information on the post-training follow-up of minefop "
          "vocational training center graduates",
    ),
    label: LocalizedText(
      fr: "Effectuez-vous le suivi post-formation des apprenants de "
          "votre établissement?",
      en: "Is there any post-training follow-up?",
    ),
    sectionId: "section6_vocationalTraining",
    order: 7,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasPostTrainingFollowUp",
  ),
  FormQuestionAst(
    id: "VT6_8",
    paperCode: "6.2.1",
    label: LocalizedText(
      fr: "Si oui, par quels mécanismes ?",
      en: "If yes, how is that done?",
    ),
    sectionId: "section6_vocationalTraining",
    order: 8,
    type: AstFieldType.checkbox,
    dependsOn: "VT6_7",
    dependsValue: "Oui/ Yes",
    // 6.2.1, PDF-confirmed (p.13): 4 items — 4th ("Autres") has a
    // free-text follow-up already modeled separately as VT6_9/
    // followUpMechanismOther.
    options: [
      LocalizedOption("Téléphonique/ Telephone",
          LocalizedText(fr: "Téléphonique", en: "Telephone")),
      LocalizedOption(
          "Email/ Email address", LocalizedText.same("Email")),
      LocalizedOption("Contact direct/ Direct contact",
          LocalizedText(fr: "Contact direct", en: "Direct contact")),
      LocalizedOption(
          "Autres/ Others", LocalizedText(fr: "Autres", en: "Others")),
    ],
    path: "vocationalTraining.followUpMechanisms",
  ),
  FormQuestionAst(
    id: "VT6_9",
    paperCode: "6.2.1",
    label: LocalizedText(fr: "Autre, précisez", en: "Other, specify"),
    sectionId: "section6_vocationalTraining",
    order: 9,
    type: AstFieldType.text,
    // VT-UI/UX-07: narrowed from "VT6_7 = Oui" (the outer post-training-
    // follow-up gate) to "VT6_8 contains Autres" specifically — a user
    // can only select an option in VT6_8 once it's visible, which already
    // requires VT6_7 = Oui (see VT6_8's own dependsOn), so this single
    // "contains" check still correctly implies both conditions without a
    // compound AND the current engine has no way to express.
    dependsOn: "VT6_8",
    dependsValue: "Autres/ Others",
    dependsOperator: "contains",
    path: "vocationalTraining.followUpMechanismOther",
  ),
  FormQuestionAst(
    id: "VT6_10",
    paperCode: "6.2.2",
    // English previously asked a generic, different question ("any
    // vocational guidance institution") and dropped "in your center";
    // the path (hasInsertionSupportUnit) confirms the French concept —
    // a graduate job-placement support unit — is the intended one.
    label: LocalizedText(
      fr: "Existe-t-il une cellule d'appui à l'insertion des sortants "
          "dans votre centre ?",
      en: "Is there a graduate placement / integration support unit in "
          "your centre?",
    ),
    sectionId: "section6_vocationalTraining",
    order: 10,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasInsertionSupportUnit",
  ),
  FormQuestionAst(
    id: "VT6_11",
    paperCode: "6.2.3",
    label: LocalizedText(
      fr: "Existe-t-il un outil de gestion de la base de données des "
          "apprenants et sortants dans votre centre ?",
      en: "Is there a database management tool for trainees and "
          "graduates in your centre?",
    ),
    sectionId: "section6_vocationalTraining",
    order: 11,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasTraineeDatabaseTool",
  ),
  FormQuestionAst(
    id: "VT6_12",
    paperCode: "6.2.4",
    label: LocalizedText(
      fr: "Existe-t-il dans votre centre un outil d'accompagnement des "
          "sortants dans la recherche d'emploi, la création des "
          "Groupement d'Intérêt Économique (GIE), l'élaboration des "
          "plans d'affaires ?",
      en: "Is there any mechanism for accompanying outgoing trainees "
          "in job searching, creation of Economic Interest Groups "
          "(EIG), development of business plans?",
    ),
    sectionId: "section6_vocationalTraining",
    order: 12,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasJobSearchSupportTool",
  ),
  // 6.3 — repeating specialty rows, male/female/total cell shape (same
  // shape as 4.10 per closure #1). PDF-confirmed (p.14): exactly 10
  // numbered rows — the row count previously guessed by analogy to 4.10
  // and flagged UNCONFIRMED is now verified.
  FormQuestionAst(
    id: "VT6_13",
    paperCode: "6.3",
    subsection: LocalizedText(
      fr: "6.3 Sortants insérés par spécialité",
      en: "6.3 Outgoing trainees integrated by specialty",
    ),
    label: LocalizedText(
      fr: "Effectifs des sortants insérés par spécialités et selon le "
          "sexe pour l'année antérieur (2024-2025)",
      en: "Number of outgoing trainees integrated per specialities",
    ),
    sectionId: "section6_vocationalTraining",
    order: 13,
    type: AstFieldType.repeatingTable,
    path: "vocationalTraining.specialtyRows_6_3",
    tableSpec: {
      "template": "vt_specialty_gender_total_table",
      "prefix": "s6q3",
      "tableCode": "6.3",
      "rows": 10,
      "fields": ["specialtyText", "male", "female", "total"],
    },
  ),
  // Added for the MINEFOP Collect wizard redesign (Figma screen 10,
  // "Suivi de l'Insertion des Diplômés" — formal/informal/job-seeking
  // breakdown of last year's graduates, shown with a % bar). No paper
  // code; appended after 6.3 as its own small subsection rather than
  // folded into 6.3's specialty table, since it's a different shape
  // (aggregate totals, not per-specialty rows).
  FormQuestionAst(
    id: "VT6_14",
    paperCode: "6.4",
    subsection: LocalizedText(
      fr: "6.4 Suivi de l'insertion des diplômés (année antérieure)",
      en: "6.4 Follow-up on graduate placement (previous year)",
    ),
    label: LocalizedText(
      fr: "Effectif inséré dans l'emploi formel",
      en: "Number placed in the formal sector",
    ),
    sectionId: "section6_vocationalTraining",
    order: 14,
    type: AstFieldType.number,
    path: "vocationalTraining.insertedFormalSectorCount",
  ),
  FormQuestionAst(
    id: "VT6_15",
    paperCode: "6.4",
    subsection: LocalizedText(
      fr: "6.4 Suivi de l'insertion des diplômés (année antérieure)",
      en: "6.4 Follow-up on graduate placement (previous year)",
    ),
    label: LocalizedText(
      fr: "Effectif inséré dans l'emploi informel / auto-emploi",
      en: "Number placed in the informal sector / self-employed",
    ),
    sectionId: "section6_vocationalTraining",
    order: 15,
    type: AstFieldType.number,
    path: "vocationalTraining.insertedInformalSectorCount",
  ),
  FormQuestionAst(
    id: "VT6_16",
    paperCode: "6.4",
    subsection: LocalizedText(
      fr: "6.4 Suivi de l'insertion des diplômés (année antérieure)",
      en: "6.4 Follow-up on graduate placement (previous year)",
    ),
    label: LocalizedText(
      fr: "Effectif en recherche d'emploi",
      en: "Number still seeking employment",
    ),
    sectionId: "section6_vocationalTraining",
    order: 16,
    type: AstFieldType.number,
    path: "vocationalTraining.seekingEmploymentCount",
  ),
];

// ============================================================
// SECTION 7 - VOCATIONAL TRAINING (VT-2) — cross-cutting themes
// Confirmed per-field codes only where the design note gives one
// (7.1/7.1.1/7.1.2/7.1.3/7.2/7.4/7.5/7.6/7.7); ungrouped sub-items
// (e.g. the three 7.1.1 stigma/harassment sub-questions, the six 7.4
// syllabus/extracurricular sub-questions) share their parent's code,
// matching how Section 1's 1.13/1.15/1.16 sub-fields were handled.
// ============================================================

const section7VocationalTraining = SectionAst(
  id: "section7_vocationalTraining",
  title: LocalizedText(
    // PDF-confirmed (p.14): "SECTION 7 : PRISE EN COMPTE DES THÈMES
    // TRANSVERSAUX DANS LE PROGRAMME D'ÉDUCATION CROSS-CUTTING THEMES
    // IMPLEMENTATION IN EDUCATION PROGRAMME".
    fr: "SECTION 7. PRISE EN COMPTE DES THÈMES TRANSVERSAUX DANS LE "
        "PROGRAMME D'ÉDUCATION",
    en: "SECTION 7. CROSS-CUTTING THEMES IMPLEMENTATION IN EDUCATION "
        "PROGRAMME",
  ),
  order: 7,
  entityTypes: ["vocationalTraining"],
);

const section7VocationalTrainingQuestions = <FormQuestionAst>[
  FormQuestionAst(
    id: "VT7_1",
    paperCode: "7.1",
    label: LocalizedText(
      fr: "Votre établissement a t'il intégré dans son règlement "
          "intérieur des directives en lien avec le VIH et le SIDA ?",
      en: "Has your school incorporated rules related to HIV/AIDS in "
          "its internal regulations?",
    ),
    sectionId: "section7_vocationalTraining",
    order: 1,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasHivAidsRules",
  ),
  // VT7_2-5 previously rendered as bare topic fragments ("Physical
  // safety within the school") standing alone next to a Yes/No radio —
  // not phrased as questions and with no shared heading explaining what
  // they answer. Each is now a self-contained question, and all four
  // carry the same subsection heading (set on every field in the run,
  // not just the first — see VT5_1's own comment for why) so they read
  // together as "does the regulation cover the following aspects?".
  // path/options/dependsOn are unchanged.
  FormQuestionAst(
    id: "VT7_2",
    paperCode: "7.1.1",
    subsection: LocalizedText(
      // PDF-confirmed (p.14, §7.1.1): this is the printed governing
      // question shared by all four rows below it, not an invented one.
      fr: "7.1.1 Si oui, ces directives couvrent-elles les aspects "
          "suivants ?",
      en: "7.1.1 If Yes, Do these rules cover the following aspects?",
    ),
    label: LocalizedText(
      fr: "Le règlement couvre-t-il la sécurité physique au sein de "
          "l'établissement ?",
      en: "Does the regulation cover physical safety within the "
          "school?",
    ),
    sectionId: "section7_vocationalTraining",
    order: 2,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    dependsOn: "VT7_1",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.hivRulesCoverSafety",
  ),
  FormQuestionAst(
    id: "VT7_3",
    paperCode: "7.1.1",
    subsection: LocalizedText(
      // PDF-confirmed (p.14, §7.1.1): this is the printed governing
      // question shared by all four rows below it, not an invented one.
      fr: "7.1.1 Si oui, ces directives couvrent-elles les aspects "
          "suivants ?",
      en: "7.1.1 If Yes, Do these rules cover the following aspects?",
    ),
    label: LocalizedText(
      fr: "Le règlement couvre-t-il la stigmatisation et la "
          "discrimination à l'égard du personnel et des élèves vivant "
          "avec le VIH ou affectés par le VIH ?",
      en: "Does the regulation cover stigma and discrimination "
          "against staff and pupils living with or affected by HIV?",
    ),
    sectionId: "section7_vocationalTraining",
    order: 3,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    dependsOn: "VT7_1",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.hivRulesCoverStigmaHiv",
  ),
  FormQuestionAst(
    id: "VT7_4",
    paperCode: "7.1.1",
    subsection: LocalizedText(
      // PDF-confirmed (p.14, §7.1.1): this is the printed governing
      // question shared by all four rows below it, not an invented one.
      fr: "7.1.1 Si oui, ces directives couvrent-elles les aspects "
          "suivants ?",
      en: "7.1.1 If Yes, Do these rules cover the following aspects?",
    ),
    label: LocalizedText(
      fr: "Le règlement couvre-t-il la stigmatisation et la "
          "discrimination à l'égard du personnel et des élèves porteurs "
          "du VIH ou à risque, fondées sur la race, l'origine ethnique, "
          "la religion ou d'autres motifs ?",
      en: "Does the regulation cover stigma and discrimination based "
          "on race, ethnic origin, religion or other grounds, against "
          "HIV-positive or at-risk staff and pupils?",
    ),
    sectionId: "section7_vocationalTraining",
    order: 4,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    dependsOn: "VT7_1",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.hivRulesCoverStigmaOther",
  ),
  FormQuestionAst(
    id: "VT7_5",
    paperCode: "7.1.1",
    subsection: LocalizedText(
      // PDF-confirmed (p.14, §7.1.1): this is the printed governing
      // question shared by all four rows below it, not an invented one.
      fr: "7.1.1 Si oui, ces directives couvrent-elles les aspects "
          "suivants ?",
      en: "7.1.1 If Yes, Do these rules cover the following aspects?",
    ),
    label: LocalizedText(
      fr: "Le règlement couvre-t-il le harcèlement et les abus "
          "sexuels ?",
      en: "Does the regulation cover sexual harassment and abuse?",
    ),
    sectionId: "section7_vocationalTraining",
    order: 5,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    dependsOn: "VT7_1",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.hivRulesCoverHarassment",
  ),
  FormQuestionAst(
    id: "VT7_6",
    paperCode: "7.1.2",
    label: LocalizedText(
      // "Existe - t'il" (stray space, wrong apostrophe) → "Existe-t-il".
      // English was a noun phrase, not a question — reworded to match
      // the French question form.
      fr: "Existe-t-il des procédures disciplinaires en cas de "
          "violation de ces aspects ?",
      en: "Are there disciplinary procedures in case these provisions "
          "are breached?",
    ),
    sectionId: "section7_vocationalTraining",
    order: 6,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.hasDisciplinaryProcedures",
  ),
  // 7.1.3 — Decision 2 (closed): 5 stakeholder rows. PDF (p.14) intro:
  // "Si oui, Veuillez indiquer, parmi les parties prenantes de votre
  // établissement ci-dessous, celles qui ont été informées des mesures et
  // préciser le mode de communication utilisé pour chaque catégorie au
  // cours de l'année scolaire" / "If yes, kindly tick the categories
  // bellow that received information on the directives by precising the
  // communication channel" — see vt713CommsInformedTableDef's own title
  // in vt_table_defs.dart for where this is actually surfaced. The
  // printed table's column header is "Modes de communication (cocher les
  // cases correspondantes)" / "Means of communication (Please tick the
  // appropriate box)" over untitled columns — kept as printed rather than
  // inventing channel names; the option list below is deferred for the
  // same reason, pending a written list from MINEFOP.
  FormQuestionAst(
    id: "VT7_7",
    paperCode: "7.1.3",
    label: LocalizedText(
      fr: "Canaux de communication — Élèves",
      en: "Communication channels — Pupils",
    ),
    sectionId: "section7_vocationalTraining",
    order: 7,
    type: AstFieldType.checkbox,
    path: "vocationalTraining.pupilsCommsChannels",
  ),
  FormQuestionAst(
    id: "VT7_8",
    paperCode: "7.1.3",
    label: LocalizedText(
      fr: "Canaux de communication — Personnel Enseignant",
      en: "Communication channels — Teaching Staff",
    ),
    sectionId: "section7_vocationalTraining",
    order: 8,
    type: AstFieldType.checkbox,
    path: "vocationalTraining.teachingStaffCommsChannels",
  ),
  FormQuestionAst(
    id: "VT7_9",
    paperCode: "7.1.3",
    label: LocalizedText(
      fr: "Canaux de communication — Personnel Non Enseignant",
      en: "Communication channels — Non-Teaching Staff",
    ),
    sectionId: "section7_vocationalTraining",
    order: 9,
    type: AstFieldType.checkbox,
    path: "vocationalTraining.nonTeachingStaffCommsChannels",
  ),
  FormQuestionAst(
    id: "VT7_10",
    paperCode: "7.1.3",
    label: LocalizedText(
      fr: "Canaux de communication — Parents/Tuteurs",
      en: "Communication channels — Parents/Guardians",
    ),
    sectionId: "section7_vocationalTraining",
    order: 10,
    type: AstFieldType.checkbox,
    path: "vocationalTraining.parentsCommsChannels",
  ),
  FormQuestionAst(
    id: "VT7_11",
    paperCode: "7.1.3",
    label: LocalizedText(
      fr: "Canaux de communication — Conseil d'établissement",
      en: "Communication channels — School Council",
    ),
    sectionId: "section7_vocationalTraining",
    order: 11,
    type: AstFieldType.checkbox,
    path: "vocationalTraining.schoolCouncilCommsChannels",
  ),
  FormQuestionAst(
    id: "VT7_12",
    paperCode: "7.2",
    // PDF-confirmed (p.15): no separate English printed for this row.
    label: LocalizedText(
      fr: "Prenez-vous en compte les questions liées aux IST ?",
      en: "Do you address issues related to STIs?",
    ),
    sectionId: "section7_vocationalTraining",
    order: 12,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.addressesIstIssues",
  ),
  // No 7.3 field — Decision 4 (closed): the code does not exist in the
  // instrument, numbering jumps 7.2 → 7.4.
  FormQuestionAst(
    id: "VT7_13",
    paperCode: "7.4",
    label: LocalizedText(
      fr: "Les apprenants de votre établissement ont-ils reçu une "
          "éducation sexuelle et sur le VIH complète axée sur les "
          "compétences pour la vie courante?",
      en: "Have the trainees at your school received full sexual and "
          "HIV education focused on life skills?",
    ),
    sectionId: "section7_vocationalTraining",
    order: 13,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.traineesReceivedFullSexEd",
  ),
  // VT7_14-19 previously rendered as bare "topic — au programme/
  // parascolaire" fragments, not questions, next to a standalone Yes/No
  // radio each. PDF-confirmed (p.15) as a row×column matrix (topic ×
  // in-syllabus/extracurricular) — the column distinction is preserved
  // below, now inside a full sentence instead of a dash-suffix fragment,
  // under a shared subsection heading (set on every field in the run,
  // not just the first). path/options/dependsOn are unchanged.
  FormQuestionAst(
    id: "VT7_14",
    paperCode: "7.4",
    subsection: LocalizedText(
      // PDF-confirmed (p.15, §7.4): this is the printed governing
      // question shared by all six rows below it, not an invented one.
      fr: "7.4 Si oui, les thèmes suivants sont-ils abordés ?",
      en: "7.4 If yes, were the following themes discussed?",
    ),
    label: LocalizedText(
      fr: "L'enseignement des compétences génériques pour la vie "
          "courante est-il inscrit au programme officiel ?",
      en: "Is teaching of everyday generic life skills part of the "
          "official syllabus?",
    ),
    sectionId: "section7_vocationalTraining",
    order: 14,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    dependsOn: "VT7_13",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.genericLifeSkillsInSyllabus",
  ),
  FormQuestionAst(
    id: "VT7_15",
    paperCode: "7.4",
    subsection: LocalizedText(
      // PDF-confirmed (p.15, §7.4): this is the printed governing
      // question shared by all six rows below it, not an invented one.
      fr: "7.4 Si oui, les thèmes suivants sont-ils abordés ?",
      en: "7.4 If yes, were the following themes discussed?",
    ),
    label: LocalizedText(
      fr: "L'enseignement des compétences génériques pour la vie "
          "courante est-il proposé en activité parascolaire ?",
      en: "Is teaching of everyday generic life skills offered as an "
          "extracurricular activity?",
    ),
    sectionId: "section7_vocationalTraining",
    order: 15,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    dependsOn: "VT7_13",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.genericLifeSkillsExtracurricular",
  ),
  FormQuestionAst(
    id: "VT7_16",
    paperCode: "7.4",
    subsection: LocalizedText(
      // PDF-confirmed (p.15, §7.4): this is the printed governing
      // question shared by all six rows below it, not an invented one.
      fr: "7.4 Si oui, les thèmes suivants sont-ils abordés ?",
      en: "7.4 If yes, were the following themes discussed?",
    ),
    label: LocalizedText(
      fr: "L'éducation à la santé reproductive et sexuelle est-elle "
          "inscrite au programme officiel ?",
      en: "Is reproductive and sexual health education part of the "
          "official syllabus?",
    ),
    sectionId: "section7_vocationalTraining",
    order: 16,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    dependsOn: "VT7_13",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.reproHealthEdInSyllabus",
  ),
  FormQuestionAst(
    id: "VT7_17",
    paperCode: "7.4",
    subsection: LocalizedText(
      // PDF-confirmed (p.15, §7.4): this is the printed governing
      // question shared by all six rows below it, not an invented one.
      fr: "7.4 Si oui, les thèmes suivants sont-ils abordés ?",
      en: "7.4 If yes, were the following themes discussed?",
    ),
    label: LocalizedText(
      fr: "L'éducation à la santé reproductive et sexuelle est-elle "
          "proposée en activité parascolaire ?",
      en: "Is reproductive and sexual health education offered as an "
          "extracurricular activity?",
    ),
    sectionId: "section7_vocationalTraining",
    order: 17,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    dependsOn: "VT7_13",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.reproHealthEdExtracurricular",
  ),
  FormQuestionAst(
    id: "VT7_18",
    paperCode: "7.4",
    subsection: LocalizedText(
      // PDF-confirmed (p.15, §7.4): this is the printed governing
      // question shared by all six rows below it, not an invented one.
      fr: "7.4 Si oui, les thèmes suivants sont-ils abordés ?",
      en: "7.4 If yes, were the following themes discussed?",
    ),
    label: LocalizedText(
      fr: "L'enseignement sur la transmission et la prévention du VIH "
          "est-il inscrit au programme officiel ?",
      en: "Is teaching on HIV transmission and prevention part of the "
          "official syllabus?",
    ),
    sectionId: "section7_vocationalTraining",
    order: 18,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    dependsOn: "VT7_13",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.hivTransmissionEdInSyllabus",
  ),
  FormQuestionAst(
    id: "VT7_19",
    paperCode: "7.4",
    subsection: LocalizedText(
      // PDF-confirmed (p.15, §7.4): this is the printed governing
      // question shared by all six rows below it, not an invented one.
      fr: "7.4 Si oui, les thèmes suivants sont-ils abordés ?",
      en: "7.4 If yes, were the following themes discussed?",
    ),
    label: LocalizedText(
      fr: "L'enseignement sur la transmission et la prévention du VIH "
          "est-il proposé en activité parascolaire ?",
      en: "Is teaching on HIV transmission and prevention offered as "
          "an extracurricular activity?",
    ),
    sectionId: "section7_vocationalTraining",
    order: 19,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    dependsOn: "VT7_13",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.hivTransmissionEdExtracurricular",
  ),
  FormQuestionAst(
    id: "VT7_20",
    paperCode: "7.5",
    label: LocalizedText(
      fr: "Les formateurs de votre établissement ont-ils reçu et "
          "dispensé une éducation sexuelle et sur le VIH complète "
          "axée sur les compétences pour la vie courante ?",
      en: "Have the trainers at your school received and delivered "
          "full sexual and HIV education focused on life skills?",
    ),
    sectionId: "section7_vocationalTraining",
    order: 20,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.trainersDeliveredSexEd",
  ),
  FormQuestionAst(
    id: "VT7_21",
    paperCode: "7.6",
    label: LocalizedText(
      fr: "Si oui, ces enseignants ont-ils dispensé les enseignements "
          "reçus aux élèves ?",
      en: "If yes, did these teachers deliver the training they "
          "received to the pupils?",
    ),
    sectionId: "section7_vocationalTraining",
    order: 21,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    // VT-UI/UX-06: paper p.15, 7.6 — literal "Si oui" referring to 7.5.
    dependsOn: "VT7_20",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.trainersPassedOnToStudents",
  ),
  FormQuestionAst(
    id: "VT7_22",
    paperCode: "7.7",
    label: LocalizedText(
      fr: "Votre centre a-t-il organisé une ou plusieurs sessions "
          "d'orientation destinées aux parents ou tuteurs d'apprenants "
          "au sujet de l'éducation sexuelle et sur le VIH axée sur "
          "les compétences pour la vie courante dispensée par l'école ?",
      en: "Has your center organized one or more orientation sessions "
          "for parents or guardians of trainees on the "
          "life-skills-based sexuality and HIV education provided by "
          "the school?",
    ),
    sectionId: "section7_vocationalTraining",
    order: 22,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.heldParentOrientationSessions",
  ),
  // Page-15 "Scolaire/Social/Profesionnel" fragment — Decision 3
  // (closed): unfinished layout, no code, no stem. Not captured.
];

// ============================================================
// SECTION 8 - VOCATIONAL TRAINING (VT-2) — trainer/personnel data
//
// 8.1/8.2/8.3/8.6 are aggregate-cell grids (type: table, no path, same
// posture as Section 4's grids). 8.4/8.7 are repeating specialty-row
// tables (type: repeatingTable, 10-row capacity per the VT-2
// instruction's confirmed printed capacities). 8.5 is embedded directly
// as six Detail Int? columns (design note: "fixed 3-row × gender grid,
// embedded not normalized") — plain number questions, not a table type.
// 8.8 is the named-person roster (type: repeatingTable, 14-row
// capacity), operational/reviewer use only per design note §9 —
// export-exclusion is a VT-7/VT-8 concern, out of scope here.
// ============================================================

const section8VocationalTraining = SectionAst(
  id: "section8_vocationalTraining",
  title: LocalizedText(
    // PDF-confirmed (p.16): "SECTION 8 : INFORMATIONS SUR LES FORMATEURS /
    // DETAILS ON TRAINERS".
    fr: "SECTION 8. INFORMATIONS SUR LES FORMATEURS",
    en: "SECTION 8. DETAILS ON TRAINERS",
  ),
  order: 8,
  entityTypes: ["vocationalTraining"],
);

const section8VocationalTrainingQuestions = <FormQuestionAst>[
  // 8.1 — trainers by academic diploma (OnefopVtDiplomaData,
  // personType=TRAINER, diplomaKind=ACADEMIC). Coherence rule 7: 8.1
  // total = 8.2 total.
  FormQuestionAst(
    id: "VT8_1",
    paperCode: "8.1",
    subsection: LocalizedText(
      fr: "8.1 Effectifs des formateurs par diplôme académique le plus "
          "élevé et par sexe",
      en: "8.1 Number of trainers per academic qualification",
    ),
    label: LocalizedText(
      fr: "Effectifs des formateurs par diplôme académique le plus "
          "élevé et par sexe",
      en: "Number of trainers per academic qualification",
    ),
    sectionId: "section8_vocationalTraining",
    order: 1,
    type: AstFieldType.table,
    tableSpec: {
      "template": "vt_diploma_table",
      "prefix": "s8q1",
      "rows": _vtAcademicDiplomaRows,
      "genders": _vtGenders,
    },
  ),
  // 8.2 — trainers by professional diploma. Coherence rule 8: 8.2 total
  // = Σ8.3.
  FormQuestionAst(
    id: "VT8_2",
    paperCode: "8.2",
    subsection: LocalizedText(
      fr: "8.2 Formateurs par diplôme professionnel le plus élevé et "
          "par sexe",
      en: "8.2 Number of trainers per Vocational Qualification",
    ),
    label: LocalizedText(
      fr: "Formateurs par diplôme professionnel le plus élevé et par "
          "sexe",
      en: "Number of trainers per Vocational Qualification",
    ),
    sectionId: "section8_vocationalTraining",
    order: 2,
    type: AstFieldType.table,
    tableSpec: {
      "template": "vt_diploma_table",
      "prefix": "s8q2",
      "rows": _vtProfessionalDiplomaRows,
      "genders": _vtGenders,
    },
  ),
  // 8.3 — trainers by age band (OnefopVtTrainerAge).
  FormQuestionAst(
    id: "VT8_3",
    paperCode: "8.3",
    subsection: LocalizedText(
      fr: "8.3 Effectifs des formateurs par tranche d'âge et par sexe",
      en: "8.3 Number of trainers per age group",
    ),
    label: LocalizedText(
      fr: "Effectifs des formateurs par tranche d'âge et par sexe",
      en: "Number of trainers per age group",
    ),
    sectionId: "section8_vocationalTraining",
    order: 3,
    type: AstFieldType.table,
    tableSpec: {
      "template": "vt_trainer_age_table",
      "prefix": "s8q3",
      "rows": _vtTrainerAgeBandRows,
      "genders": _vtGenders,
    },
  ),
  // 8.4 — repeating specialty rows, FI/FC × gender cell shape, 10-row
  // printed capacity.
  FormQuestionAst(
    id: "VT8_4",
    paperCode: "8.4",
    subsection: LocalizedText(
      fr: "8.4 Formateurs par spécialité et type de formation",
      en: "8.4 Number of trainers per training specialty and training "
          "type",
    ),
    label: LocalizedText(
      fr: "Formateurs par spécialités de formation et type de formation",
      en: "Number of trainers per training specialty and training type",
    ),
    sectionId: "section8_vocationalTraining",
    order: 4,
    type: AstFieldType.repeatingTable,
    path: "vocationalTraining.specialtyRows_8_4",
    tableSpec: {
      "template": "vt_specialty_fi_fc_table",
      "prefix": "s8q4",
      "tableCode": "8.4",
      "rows": 10,
      "fields": ["specialtyText", "fiMale", "fiFemale", "fcMale", "fcFemale"],
    },
  ),
  // 8.5 — trainer occupational status, embedded directly as six Detail
  // Int? columns (fixed 3-row × gender grid, not normalized — design
  // note §2/§4). Coherence rule 9: 8.2 total = 8.5 total.
  FormQuestionAst(
    id: "VT8_5_VP_M",
    paperCode: "8.5",
    // PDF-confirmed (vocationalTraining.hbs's own printed h3, p.16-ish):
    // "8.5 Formateurs par statut professionnel" — set on all six 8.5
    // fields, none of which individually convey the overall grouping
    // (each states its own specific row, e.g. "vacataires professionnels
    // — hommes"), same convention as VT5_1-4's own subsection.
    subsection: LocalizedText(
      fr: "8.5 Formateurs par statut professionnel",
      en: "8.5 Trainers by professional status",
    ),
    label: LocalizedText(
      fr: "Formateurs vacataires professionnels — hommes",
      en: "Part-time vocational trainers — male",
    ),
    sectionId: "section8_vocationalTraining",
    order: 5,
    type: AstFieldType.number,
    path: "vocationalTraining.vacataireProfMale",
  ),
  FormQuestionAst(
    id: "VT8_5_VP_F",
    paperCode: "8.5",
    subsection: LocalizedText(
      fr: "8.5 Formateurs par statut professionnel",
      en: "8.5 Trainers by professional status",
    ),
    label: LocalizedText(
      fr: "Formateurs vacataires professionnels — femmes",
      en: "Part-time vocational trainers — female",
    ),
    sectionId: "section8_vocationalTraining",
    order: 6,
    type: AstFieldType.number,
    path: "vocationalTraining.vacataireProfFemale",
  ),
  FormQuestionAst(
    id: "VT8_5_VNP_M",
    paperCode: "8.5",
    subsection: LocalizedText(
      fr: "8.5 Formateurs par statut professionnel",
      en: "8.5 Trainers by professional status",
    ),
    label: LocalizedText(
      fr: "Formateurs vacataires non professionnels — hommes",
      en: "Part-time non vocational trainers — male",
    ),
    sectionId: "section8_vocationalTraining",
    order: 7,
    type: AstFieldType.number,
    path: "vocationalTraining.vacataireNonProfMale",
  ),
  FormQuestionAst(
    id: "VT8_5_VNP_F",
    paperCode: "8.5",
    subsection: LocalizedText(
      fr: "8.5 Formateurs par statut professionnel",
      en: "8.5 Trainers by professional status",
    ),
    label: LocalizedText(
      fr: "Formateurs vacataires non professionnels — femmes",
      en: "Part-time non vocational trainers — female",
    ),
    sectionId: "section8_vocationalTraining",
    order: 8,
    type: AstFieldType.number,
    path: "vocationalTraining.vacataireNonProfFemale",
  ),
  FormQuestionAst(
    id: "VT8_5_PERM_M",
    paperCode: "8.5",
    subsection: LocalizedText(
      fr: "8.5 Formateurs par statut professionnel",
      en: "8.5 Trainers by professional status",
    ),
    label: LocalizedText(
        fr: "Formateurs Permanents — hommes", en: "Permanent trainers — male"),
    sectionId: "section8_vocationalTraining",
    order: 9,
    type: AstFieldType.number,
    path: "vocationalTraining.permanentMale",
  ),
  FormQuestionAst(
    id: "VT8_5_PERM_F",
    paperCode: "8.5",
    subsection: LocalizedText(
      fr: "8.5 Formateurs par statut professionnel",
      en: "8.5 Trainers by professional status",
    ),
    label: LocalizedText(
      fr: "Formateurs Permanents — femmes",
      en: "Permanent trainers — female",
    ),
    sectionId: "section8_vocationalTraining",
    order: 10,
    type: AstFieldType.number,
    path: "vocationalTraining.permanentFemale",
  ),
  // Added for the MINEFOP Collect wizard redesign (Figma screen 11,
  // Permanent/Vacataire/Contractuel 3-way split) — placed and numbered
  // directly inside the existing 8.5 group (order 11/12, VT8_6/7/8 bumped
  // to 13/14/15) rather than appended after 8.8: groupFields() groups
  // consecutive same-subsection fields, so a non-adjacent "8.5" pair would
  // render as a second, disconnected 8.5 block instead of joining the
  // first.
  FormQuestionAst(
    id: "VT8_5_CONTRACT_M",
    paperCode: "8.5",
    subsection: LocalizedText(
      fr: "8.5 Formateurs par statut professionnel",
      en: "8.5 Trainers by professional status",
    ),
    label: LocalizedText(
      fr: "Formateurs Contractuels — hommes",
      en: "Contractual trainers — male",
    ),
    sectionId: "section8_vocationalTraining",
    order: 11,
    type: AstFieldType.number,
    path: "vocationalTraining.contractualMale",
  ),
  FormQuestionAst(
    id: "VT8_5_CONTRACT_F",
    paperCode: "8.5",
    subsection: LocalizedText(
      fr: "8.5 Formateurs par statut professionnel",
      en: "8.5 Trainers by professional status",
    ),
    label: LocalizedText(
      fr: "Formateurs Contractuels — femmes",
      en: "Contractual trainers — female",
    ),
    sectionId: "section8_vocationalTraining",
    order: 12,
    type: AstFieldType.number,
    path: "vocationalTraining.contractualFemale",
  ),
  // 8.6 — trainers with disability by category (OnefopVtTrainerDisability).
  FormQuestionAst(
    id: "VT8_6",
    paperCode: "8.6",
    subsection: LocalizedText(
      fr: "8.6 Effectifs des formateurs par type de handicap et par "
          "sexe",
      en: "8.6 Number of trainers per type of impairment",
    ),
    label: LocalizedText(
      fr: "Effectifs des formateurs par type de handicap et par sexe",
      en: "Number of trainers per type of impairment",
    ),
    sectionId: "section8_vocationalTraining",
    order: 13,
    type: AstFieldType.table,
    tableSpec: {
      "template": "vt_trainer_disability_table",
      "prefix": "s8q6",
      "rows": _vtTrainerDisabilityRows,
      "genders": _vtGenders,
    },
  ),
  // 8.7 — repeating specialty rows, FI/FC count only (no gender split,
  // no printed Total row per closure #1), 10-row printed capacity.
  // PDF-confirmed (p.17): this table is titled "Capacité d'accueil/
  // Hosting capacity" — NOT "Trainers by specialty" as previously
  // labeled. Its FI/FC-count-only shape (no gender split) is actually
  // consistent with "capacity" (a single number per training type), not
  // a trainer headcount — the earlier label was a real content error,
  // not just a wording gap.
  FormQuestionAst(
    id: "VT8_7",
    paperCode: "8.7",
    subsection: LocalizedText(
      fr: "8.7 Capacité d'accueil",
      en: "8.7 Hosting capacity",
    ),
    label: LocalizedText(
      fr: "Capacité d'accueil",
      en: "Hosting capacity",
    ),
    sectionId: "section8_vocationalTraining",
    order: 14,
    type: AstFieldType.repeatingTable,
    path: "vocationalTraining.specialtyRows_8_7",
    tableSpec: {
      "template": "vt_specialty_fi_fc_count_table",
      "prefix": "s8q7",
      "tableCode": "8.7",
      "rows": 10,
      "fields": ["specialtyText", "fiCount", "fcCount"],
    },
  ),
  // 8.8 — named trainer roster (OnefopVtTrainerRoster), one row per
  // person, 14-row printed capacity. Operational/reviewer use only,
  // excluded from default statistical export — enforcement of that
  // exclusion is a later phase (VT-7/VT-8), not this AST declaration.
  // trainerStatus/academicDiploma/professionalDiploma option lists are
  // not embedded in tableSpec — same "field key only, no options"
  // posture as every other unconfirmed-vocabulary field in this file.
  FormQuestionAst(
    id: "VT8_8",
    paperCode: "8.8",
    // PDF-confirmed (p.18): covers both teaching AND administrative
    // staff, not trainers alone.
    subsection: LocalizedText(
      fr: "8.8 Etat nominatif du personnel formateur et administratif "
          "des établissements ou privés",
      en: "8.8 Census of teaching and administrative staff of public "
          "schools or contract private schools",
    ),
    label: LocalizedText(
      fr: "Etat nominatif du personnel formateur et administratif "
          "des établissements ou privés",
      en: "Census of teaching and administrative staff of public "
          "schools or contract private schools",
    ),
    sectionId: "section8_vocationalTraining",
    order: 15,
    type: AstFieldType.repeatingTable,
    path: "vocationalTraining.trainerRoster",
    tableSpec: {
      "template": "vt_trainer_roster_table",
      "prefix": "s8q8",
      "rows": 14,
      "fields": [
        "lastName",
        "firstName",
        "sex",
        "trainerStatus",
        "isAdminPersonnel",
        "academicDiploma",
        "professionalDiploma",
      ],
    },
  ),
];

// ============================================================
// SECTION 9 - VOCATIONAL TRAINING (VT-2) — difficulties and
// perspectives
// difficultyOtherTexts/perspectives are String[] but respondent-authored
// free text, not a selection from a fixed list (unlike difficultyTypes)
// — rendered as textarea, not checkbox, since there's a real working
// renderer for free text and no invented option list either way.
// ============================================================

const section9VocationalTraining = SectionAst(
  id: "section9_vocationalTraining",
  title: LocalizedText(
    // PDF-confirmed (p.19): "SECTION 9 : DIFFICULTÉS ET PERSPECTIVES/
    // DIFFICULTIES AND PROSPECTS" — EN was "Perspectives", PDF says
    // "Prospects".
    fr: "SECTION 9. DIFFICULTÉS ET PERSPECTIVES",
    en: "SECTION 9. DIFFICULTIES AND PROSPECTS",
  ),
  order: 9,
  entityTypes: ["vocationalTraining"],
);

const section9VocationalTrainingQuestions = <FormQuestionAst>[
  FormQuestionAst(
    id: "VT9_1",
    paperCode: "9.1",
    label: LocalizedText(
      fr: "Rencontrez-vous des difficultés dans le processus de "
          "formation de vos apprenants ?",
      en: "Do you face any difficulty in providing training to "
          "learners?",
    ),
    sectionId: "section9_vocationalTraining",
    order: 1,
    type: AstFieldType.radio,
    options: _vtYesNoOptions,
    path: "vocationalTraining.facesDifficulties",
  ),
  FormQuestionAst(
    id: "VT9_2",
    paperCode: "9.1",
    label: LocalizedText(
      fr: "Si oui, lesquelles ? (Cochez svp)",
      en: "If yes, which of them? (Tick boxes, please)",
    ),
    sectionId: "section9_vocationalTraining",
    order: 2,
    type: AstFieldType.checkbox,
    dependsOn: "VT9_1",
    dependsValue: "Oui/ Yes",
    // 9.1, PDF-confirmed (p.18): 6 fixed items, "(Cochez svp)" → multi.
    // The printed list also has 5 separate "Autre 1..5" write-in slots —
    // already modeled separately as difficultyOtherTexts, not part of
    // this fixed option set.
    options: [
      LocalizedOption(
          "Insuffisances d'équipements de formation/ Insufficient number of training equipment",
          LocalizedText(
              fr: "Insuffisances d'équipements de formation",
              en: "Insufficient number of training equipment")),
      LocalizedOption("Coût de la formation/ Training cost",
          LocalizedText(fr: "Coût de la formation", en: "Training cost")),
      LocalizedOption(
          "Difficultés de stage pour les apprenants/ Internship difficulties faced by trainees",
          LocalizedText(
              fr: "Difficultés de stage pour les apprenants",
              en: "Internship difficulties faced by trainees")),
      LocalizedOption(
          "Insuffisance du personnel enseignant/ Insufficient number of trainers",
          LocalizedText(
              fr: "Insuffisance du personnel enseignant",
              en: "Insufficient number of trainers")),
      LocalizedOption(
          "Faible effectif d'apprenants/ Insufficient number of trainees",
          LocalizedText(
              fr: "Faible effectif d'apprenants",
              en: "Insufficient number of trainees")),
      LocalizedOption("Insécurité/ Insecurity",
          LocalizedText(fr: "Insécurité", en: "Insecurity")),
    ],
    path: "vocationalTraining.difficultyTypes",
  ),
  FormQuestionAst(
    id: "VT9_3",
    paperCode: "9.1",
    // PDF-confirmed (p.19): printed as 5 separate numbered write-in
    // slots ("Autre 1"..."Autre 5"), collected here as one free-text
    // list (difficultyOtherTexts is already String[]) rather than 5
    // separate fields.
    label: LocalizedText(
      fr: "Autre (à préciser)",
      en: "Other (specify)",
    ),
    sectionId: "section9_vocationalTraining",
    order: 3,
    type: AstFieldType.textarea,
    dependsOn: "VT9_1",
    dependsValue: "Oui/ Yes",
    path: "vocationalTraining.difficultyOtherTexts",
  ),
  FormQuestionAst(
    id: "VT9_4",
    paperCode: "9.2",
    // PDF-confirmed (p.19): printed as 5 separate numbered lines
    // ("Perspective 1"..."Perspective 5"), collected here as one
    // free-text list (perspectives is already String[]).
    // Subsection title from vocationalTraining.hbs's own printed h3 —
    // "prospects" not "perspectives" in EN to match this section's own
    // already-corrected title wording (see section9's title comment:
    // "PDF says 'Prospects'"), even though this field's own label below
    // still says "perspectives" (pre-existing, unrelated, not touched
    // here). 9.1 (VT9_1-3) gets no subsection — it's a single yes/no
    // item in the printed form, not a titled subsection.
    subsection: LocalizedText(
      fr: "9.2 Cinq principales perspectives",
      en: "9.2 Top five prospects",
    ),
    label: LocalizedText(
      fr: "Citer les 5 principales perspectives",
      en: "List the 5 main outlooks",
    ),
    sectionId: "section9_vocationalTraining",
    order: 4,
    type: AstFieldType.textarea,
    path: "vocationalTraining.perspectives",
  ),
];

// ============================================================
// EXPORT COLLECTIONS
// ============================================================

const List<SectionAst> allSections = [
  section0,
  section1Enterprise,
  section1Cooperative,
  section1Ctd,
  section1Ong,
  section1Administration,
  section1ProjectProgram,
  section1VocationalTraining,
  section2VocationalTraining,
  section3VocationalTraining,
  section4VocationalTraining,
  section5VocationalTraining,
  section6VocationalTraining,
  section7VocationalTraining,
  section8VocationalTraining,
  section9VocationalTraining,
  section2,
  section2ProjectProgram,
  section3,
  section3ProjectProgram,
  section4,
  section4ProjectProgram,
];

// FIX-3: s3q02_reason_4_text removed from this list (no 4th reason in any PDF)
final List<FormQuestionAst> allQuestions = [
  // Section 0 — respondent (enterprise/cooperative/ctd/ong/administration/
  // projectProgram only — see _section0EntityTypes; vocationalTraining is
  // deliberately excluded, its respondent fields live in Section 1 below)
  ...section0Questions,

  // Section 1 — entity-specific identification
  ...section1EnterpriseQuestions,
  ...section1CooperativeQuestions,
  ...section1CtdQuestions,
  ...section1OngQuestions,
  ...section1AdministrationQuestions,
  ...section1ProjectProgramQuestions,
  ...section1VocationalTrainingQuestions,
  ...section2VocationalTrainingQuestions,
  ...section3VocationalTrainingQuestions,
  ...section4VocationalTrainingQuestions,
  ...section5VocationalTrainingQuestions,
  ...section6VocationalTrainingQuestions,
  ...section7VocationalTrainingQuestions,
  ...section8VocationalTrainingQuestions,
  ...section9VocationalTrainingQuestions,

  // Projects & Programs — Sections 2/3/4 (dedicated, not shared with the
  // enterprise-family sections below).
  ...section2ProjectProgramQuestions,
  ...section3ProjectProgramQuestions,
  ppS4Q01,
  tableResponseStatus(
      paperCode: 'S4Q01',
      sectionId: 'section4_projectProgram',
      order: 1,
      entityTypes: const ["projectProgram"]),
  ppS4Q02,
  tableResponseStatus(
      paperCode: 'S4Q02',
      sectionId: 'section4_projectProgram',
      order: 2,
      entityTypes: const ["projectProgram"]),
  ppS4Q03,
  tableResponseStatus(
      paperCode: 'S4Q03',
      sectionId: 'section4_projectProgram',
      order: 3,
      entityTypes: const ["projectProgram"]),
  ppS4Q04,
  tableResponseStatus(
      paperCode: 'S4Q04',
      sectionId: 'section4_projectProgram',
      order: 4,
      entityTypes: const ["projectProgram"]),
  ppS4Q05,
  tableResponseStatus(
      paperCode: 'S4Q05',
      sectionId: 'section4_projectProgram',
      order: 5,
      entityTypes: const ["projectProgram"]),
  ppS4Q06,
  tableResponseStatus(
      paperCode: 'S4Q06',
      sectionId: 'section4_projectProgram',
      order: 6,
      entityTypes: const ["projectProgram"]),

  // Section 2.1 — job applications
  s21q01,
  tableResponseStatus(
      paperCode: 'S21Q01',
      sectionId: 'section2',
      order: 1,
      subsection: const LocalizedText(
          fr: "2.1 DEMANDE D'EMPLOIS", en: '2.1 JOB APPLICATION'),
      entityTypes: const ["enterprise", "cooperative", "ctd", "ong"]),

  // Administration Section 2 (S21Q01–S21Q04, chronological; no subsection)
  s21q01Administration,
  tableResponseStatus(
      paperCode: 'S21Q01', sectionId: 'section2', order: 1,
      entityTypes: const ["administration"]),
  s21q02Administration,
  tableResponseStatus(
      paperCode: 'S21Q02', sectionId: 'section2', order: 2,
      entityTypes: const ["administration"]),
  s21q03Administration,
  tableResponseStatus(
      paperCode: 'S21Q03', sectionId: 'section2', order: 3,
      entityTypes: const ["administration"]),
  s21q04Administration,
  tableResponseStatus(
      paperCode: 'S21Q04', sectionId: 'section2', order: 4,
      entityTypes: const ["administration"]),

  // Section 2.2 — recruitments
  s22q01,
  tableResponseStatus(
      paperCode: 'S22Q01',
      sectionId: 'section2',
      order: 2,
      subsection: const LocalizedText(fr: '2.2 RECRUTEMENTS', en: '2.2 RECRUITMENTS'),
      entityTypes: const ["enterprise", "cooperative", "ctd", "ong"]),
  s22q02,
  tableResponseStatus(
      paperCode: 'S22Q02',
      sectionId: 'section2',
      order: 3,
      subsection: const LocalizedText(fr: '2.2 RECRUTEMENTS', en: '2.2 RECRUITMENTS'),
      entityTypes: const ["enterprise", "cooperative", "ctd", "ong"]),
  s22q03,
  tableResponseStatus(
      paperCode: 'S22Q03',
      sectionId: 'section2',
      order: 4,
      subsection: const LocalizedText(fr: '2.2 RECRUTEMENTS', en: '2.2 RECRUITMENTS'),
      entityTypes: const ["enterprise", "cooperative", "ctd", "ong"]),
  s22q04,
  tableResponseStatus(
      paperCode: 'S22Q04',
      sectionId: 'section2',
      order: 5,
      subsection: const LocalizedText(fr: '2.2 RECRUTEMENTS', en: '2.2 RECRUITMENTS'),
      entityTypes: const ["enterprise", "cooperative", "ctd", "ong"]),
  s22q05Enterprise,
  s22q05Other,
  tableResponseStatus(
      paperCode: 'S22Q05',
      sectionId: 'section2',
      order: 6,
      subsection: const LocalizedText(fr: '2.2 RECRUTEMENTS', en: '2.2 RECRUITMENTS'),
      entityTypes: const ["enterprise", "cooperative", "ctd", "ong"]),

  // Section 2.3 — first-time job seekers
  s23q01,
  tableResponseStatus(
      paperCode: 'S23Q01',
      sectionId: 'section2',
      order: 7,
      // Must match s23q01's own `subsection:` text exactly (see above) —
      // this used to be the short form ("2.3 PRIMO DEMANDEUR", missing the
      // "(personne à la recherche de son premier emploi)" suffix), which
      // groupFields()/buildTableGroupUnits compared unequal to s23q01's
      // long form and split into a second, duplicate "2.3 PRIMO
      // DEMANDEUR" unit/chip on the desktop Excel shell's section
      // outline — same paperCode shown twice, plus the extra phantom
      // unit's own row inflating the vertical gap above the real table.
      subsection: const LocalizedText(
          fr: '2.3 PRIMO DEMANDEUR (personne à la recherche de son premier emploi)',
          en: '2.3 FIRST-TIME JOB SEEKER'),
      entityTypes: const ["enterprise", "cooperative", "ctd", "ong"]),
  s23q02,
  tableResponseStatus(
      paperCode: 'S23Q02',
      sectionId: 'section2',
      order: 8,
      // Same fix as S23Q01 above — must match s23q02's own `subsection:`.
      subsection: const LocalizedText(
          fr: '2.3 PRIMO DEMANDEUR (personne à la recherche de son premier emploi)',
          en: '2.3 FIRST-TIME JOB SEEKER'),
      entityTypes: const ["enterprise", "cooperative", "ctd", "ong"]),

  // Section 3 — departures
  s3q01,
  s3q01Administration,
  tableResponseStatus(paperCode: 'S3Q01', sectionId: 'section3', order: 1),
  s3q02,
  tableResponseStatus(paperCode: 'S3Q02', sectionId: 'section3', order: 2),
  s3q02_reason_1_text,
  s3q02_reason_2_text,
  s3q02_reason_3_text,
  s3q03,
  tableResponseStatus(
      paperCode: 'S3Q03',
      sectionId: 'section3',
      order: 3,
      entityTypes: const ["enterprise", "cooperative", "ctd", "ong"]),

  // Section 4 — internship and training
  s4q01,
  // Both wrappers below were unrestricted (entityTypes: null) — made
  // explicit for the same reason as s4q01's own entityTypes above:
  // Projects & Programs' PP_S4Q01/PP_S4Q02 (paperCode "S4Q01"/"S4Q02"
  // too, by coincidence) get their own dedicated wrappers further down
  // instead of silently inheriting these.
  tableResponseStatus(
      paperCode: 'S4Q01',
      sectionId: 'section4',
      order: 1,
      entityTypes: const ["enterprise", "cooperative", "ctd", "ong", "administration"]),
  s4q02,
  s4q02Administration,
  tableResponseStatus(
      paperCode: 'S4Q02',
      sectionId: 'section4',
      order: 2,
      entityTypes: const ["enterprise", "cooperative", "ctd", "ong", "administration"]),
  s4q02_domain_1_text,
  s4q02_domain_2_text,
  s4q02_domain_3_text,
  s4q03,
  tableResponseStatus(
      paperCode: 'S4Q03',
      sectionId: 'section4',
      order: 3,
      entityTypes: const ["enterprise", "cooperative", "ctd", "ong"]),
  s4q03_domain_1_text,
  s4q03_domain_2_text,
  s4q03_domain_3_text,
];
