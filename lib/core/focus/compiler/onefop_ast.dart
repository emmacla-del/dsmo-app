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
    requiredField: true,
    path: "respondent.phone1",
    hint: LocalizedText.same("Ex: 677123456"),
  ),
  FormQuestionAst(
    id: "S0Q03_TEL2",
    paperCode: "S0Q03",
    label: LocalizedText(fr: "Téléphone 2", en: "Tel 2"),
    sectionId: "section0",
    order: 4,
    type: AstFieldType.tel,
    // NO requiredField - phone2 is optional
    path: "respondent.phone2",
    hint: LocalizedText.same("Ex: 699123456"),
  ),
  FormQuestionAst(
    id: "S0Q03_EMAIL",
    paperCode: "S0Q03",
    label: LocalizedText.same("E-mail"),
    sectionId: "section0",
    order: 5,
    type: AstFieldType.email,
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
    hint: LocalizedText.same("Ex: 2010"),
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
    hint: LocalizedText.same("Ex: 2005"),
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
    hint: LocalizedText.same("Ex: 2008"),
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
      fr: "Si oui, combien de projets ?",
      en: "If Yes, how many projects?",
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
      fr: "Si oui, combien de structures sous tutelle ?",
      en: "If Yes, how many structures under supervision?",
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
// S22Q04 (disability) and S22Q05 (vulnerable) are NOT re-declared here:
// S22Q04 reuses the shared CSP-row question as-is — preserved per the
// Phase 1 instruction; the paper form's own "SFP/CSS" table header for
// this specific question groups CSP-labeled rows, a drafting
// inconsistency present identically in both source documents, not
// introduced by this implementation. S22Q05 reuses s22q05Other above —
// its wording and named-vulnerability-rows shape are identical to
// Cooperative/CTD/ONG's.
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

const s21q01Administration = FormQuestionAst(
  id: "S21Q01",
  paperCode: "S21Q01",
  subsection: LocalizedText(
    fr: "2.1 DEMANDE D'EMPLOIS",
    en: "2.1 JOB APPLICATION",
  ),
  // DOCUMENTED ASSUMPTION (unresolved wording discrepancy between the two
  // source drafts — see Phase 1 audit): Questionnaire_Administration.pdf
  // omits the "à ce jour" date-range clause here; the MINFOPRA draft
  // includes it, matching every other period-based question in both
  // documents. The MINFOPRA wording is used here as the internally
  // consistent one — not silently invented, and not yet confirmed with
  // the instrument owner.
  label: LocalizedText(
    fr: "Combien de personnes avez-vous recensé selon les statuts de la "
        "fonction publique par catégorie socio-professionnelle, le sexe "
        "et la tranche d'âge du premier Janvier 2025 à ce jour ?",
    en: "How many people did you count according to civil service status, "
        "socio-professional category, sex and age group from the 1st of "
        "January 2025 to the present day?",
  ),
  sectionId: "section2",
  order: 1,
  type: AstFieldType.table,
  entityTypes: ["administration"],
  tableSpec: {
    "template": "csp_gender_age_table",
    "prefix": "s21q01",
    "rows": ["fonctionnaire", "decisionnaire", "contractuelle"],
    "genders": ["male", "female", "total"],
    "age_bands": ["15_24", "25_34", "35_plus"],
  },
);

// Both source PDFs print this second table under the same "S21Q01" paper
// code as the census table above (an authoring error present in both
// documents — see Phase 1 audit), even though its wording ("avez-vous
// recruté" vs. "avez-vous recensé") makes it functionally the
// Administration equivalent of the enterprise-family's S22Q01. Modelled
// as such here; both source documents already include the date clause
// for this one, so there's no wording discrepancy to document.
const s22q01Administration = FormQuestionAst(
  id: "S22Q01",
  paperCode: "S22Q01",
  subsection: LocalizedText(fr: "2.2 RECRUTEMENTS", en: "2.2 RECRUITMENTS"),
  label: LocalizedText(
    fr: "Combien de personnes avez-vous recruté selon les statuts de la "
        "fonction publique par catégorie socio-professionnelle, le sexe "
        "et la tranche d'âge du premier Janvier 2025 à ce jour?",
    en: "How many people did you recruit according to civil service "
        "status, socio-professional category, sex and age group from the "
        "1st of January 2025 to the present day?",
  ),
  sectionId: "section2",
  order: 2,
  type: AstFieldType.table,
  entityTypes: ["administration"],
  tableSpec: {
    "template": "csp_gender_age_table",
    "prefix": "s22q01",
    "rows": ["fonctionnaire", "decisionnaire", "contractuelle"],
    "genders": ["male", "female", "total"],
    "age_bands": ["15_24", "25_34", "35_plus"],
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
  // (s22q01Administration, same id, disjoint entityTypes) — see
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
  // into s22q01Administration.
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
        "premier Janvier 2025 à ce jour?",
    en: "How many workers per socio-professional category, gender, and "
        "diploma did you recruit from the 1st of January 2025 to the "
        "present day?",
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
  // Administration's S22Q05 wording and named-vulnerability-rows shape are
  // identical to the Cooperative/CTD/ONG variant — added here rather than
  // as a fourth near-duplicate variant.
  entityTypes: ["cooperative", "ctd", "ong", "administration"],
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
        "recrutées selon la catégorie socioprofessionnelle et la tranche "
        "d'âge du premier Janvier 2025 à ce jour?",
    en: "How many people Working for their first time per "
        "socio-professional category, gender and age group did you "
        "recruit from the 1st of January 2025 to the present day?",
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
        "technique du 1er Janvier 2025 à ce jour?",
    en: "How many people did you dismiss or put on technical unemployment "
        "from the 1st of January 2025 to the present day?",
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
);

const s4q01 = FormQuestionAst(
  id: "S4Q01",
  paperCode: "S4Q01",
  label: LocalizedText(
    fr: "Combien de stagiaires avez-vous recrutés du 1er Janvier 2025 à "
        "ce jour?",
    en: "How many interns did you recruit from the 1st of January 2025 "
        "to the present day?",
  ),
  sectionId: "section4",
  order: 1,
  type: AstFieldType.table,
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
// EXPORT COLLECTIONS
// ============================================================

const List<SectionAst> allSections = [
  section0,
  section1Enterprise,
  section1Cooperative,
  section1Ctd,
  section1Ong,
  section1Administration,
  section2,
  section3,
  section4,
];

// FIX-3: s3q02_reason_4_text removed from this list (no 4th reason in any PDF)
final List<FormQuestionAst> allQuestions = [
  // Section 0 — respondent (all entities)
  ...section0Questions,

  // Section 1 — entity-specific identification
  ...section1EnterpriseQuestions,
  ...section1CooperativeQuestions,
  ...section1CtdQuestions,
  ...section1OngQuestions,
  ...section1AdministrationQuestions,

  // Section 2.1 — job applications
  s21q01,
  s21q01Administration,
  tableResponseStatus(
      paperCode: 'S21Q01',
      sectionId: 'section2',
      order: 1,
      subsection: const LocalizedText(
          fr: "2.1 DEMANDE D'EMPLOIS", en: '2.1 JOB APPLICATION')),

  // Section 2.2 — recruitments
  s22q01,
  s22q01Administration,
  tableResponseStatus(
      paperCode: 'S22Q01',
      sectionId: 'section2',
      order: 2,
      subsection: const LocalizedText(fr: '2.2 RECRUTEMENTS', en: '2.2 RECRUITMENTS')),
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
      subsection: const LocalizedText(fr: '2.2 RECRUTEMENTS', en: '2.2 RECRUITMENTS')),
  s22q05Enterprise,
  s22q05Other,
  tableResponseStatus(
      paperCode: 'S22Q05',
      sectionId: 'section2',
      order: 6,
      subsection: const LocalizedText(fr: '2.2 RECRUTEMENTS', en: '2.2 RECRUITMENTS')),

  // Section 2.3 — first-time job seekers
  s23q01,
  tableResponseStatus(
      paperCode: 'S23Q01',
      sectionId: 'section2',
      order: 7,
      subsection: const LocalizedText(
          fr: '2.3 PRIMO DEMANDEUR', en: '2.3 FIRST-TIME JOB SEEKER'),
      entityTypes: const ["enterprise", "cooperative", "ctd", "ong"]),
  s23q02,
  tableResponseStatus(
      paperCode: 'S23Q02',
      sectionId: 'section2',
      order: 8,
      subsection: const LocalizedText(
          fr: '2.3 PRIMO DEMANDEUR', en: '2.3 FIRST-TIME JOB SEEKER'),
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
  tableResponseStatus(paperCode: 'S4Q01', sectionId: 'section4', order: 1),
  s4q02,
  s4q02Administration,
  tableResponseStatus(paperCode: 'S4Q02', sectionId: 'section4', order: 2),
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
