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
  title: "SECTION 0. IDENTIFICATION DU RÉPONDANT / RESPONDENT IDENTIFICATION",
  order: 0,
  description: "Identification du répondant / Respondent identification",
);

const section0Questions = <FormQuestionAst>[
  FormQuestionAst(
    id: "S0Q01",
    paperCode: "S0Q01",
    label: "Noms, prénoms du répondant/ Respondent's full name",
    sectionId: "section0",
    order: 1,
    type: AstFieldType.text,
    requiredField: true,
    path: "respondent.name",
    hint: "Ex: Jean Dupont",
  ),
  FormQuestionAst(
    id: "S0Q02",
    paperCode: "S0Q02",
    label: "Fonction du répondant/ Respondent's function",
    sectionId: "section0",
    order: 2,
    type: AstFieldType.text,
    requiredField: true,
    path: "respondent.function",
    hint: "Ex: DRH",
  ),
  FormQuestionAst(
    id: "S0Q03_TEL1",
    paperCode: "S0Q03",
    label: "Téléphone 1/ Tel 1",
    sectionId: "section0",
    order: 3,
    type: AstFieldType.tel,
    requiredField: true,
    path: "respondent.phone1",
    hint: "Ex: 677123456",
  ),
  FormQuestionAst(
    id: "S0Q03_TEL2",
    paperCode: "S0Q03",
    label: "Téléphone 2/ Tel 2",
    sectionId: "section0",
    order: 4,
    type: AstFieldType.tel,
    // NO requiredField - phone2 is optional
    path: "respondent.phone2",
    hint: "Ex: 699123456",
  ),
  FormQuestionAst(
    id: "S0Q03_EMAIL",
    paperCode: "S0Q03",
    label: "E-mail",
    sectionId: "section0",
    order: 5,
    type: AstFieldType.email,
    requiredField: true, // FIX-7: Added required
    path: "respondent.email",
    hint: "Ex: contact@entreprise.com",
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
  title: "SECTION 1. IDENTIFICATION DE L'ENTREPRISE/ COMPANY DETAILS",
  order: 1,
  entityTypes: ["enterprise"],
);

const section1EnterpriseQuestions = <FormQuestionAst>[
  FormQuestionAst(
    id: "S1Q01",
    paperCode: "S1Q01",
    label: "Régime/statut juridique/ Legal status",
    sectionId: "section1_entreprise",
    order: 1,
    type: AstFieldType.select,
    options: [
      "Société unipersonnelle/ Single-member company",
      "SARL/ LLC",
      "SA/ PLC",
      "Autres/ Others",
    ],
    requiredField: true,
    path: "enterprise.legalStatus",
  ),
  FormQuestionAst(
    id: "S1Q02",
    paperCode: "S1Q02",
    label: "Nom de l'entreprise/ Company name",
    sectionId: "section1_entreprise",
    order: 2,
    type: AstFieldType.text,
    requiredField: true,
    path: "enterprise.name",
  ),
  FormQuestionAst(
    id: "S1Q03",
    paperCode: "S1Q03",
    label: "Milieu de résidence/ Area",
    sectionId: "section1_entreprise",
    order: 3,
    type: AstFieldType.radio,
    options: ["Urbain/ Urban", "Rural/ Rural"],
    requiredField: true,
    path: "enterprise.area",
  ),
  FormQuestionAst(
    id: "S1Q04_REGION",
    paperCode: "S1Q04",
    label: "Région/ Region",
    sectionId: "section1_entreprise",
    order: 4,
    type: AstFieldType.text,
    requiredField: true,
    path: "enterprise.region",
  ),
  FormQuestionAst(
    id: "S1Q04_DEPT",
    paperCode: "S1Q04",
    label: "Département/ Division",
    sectionId: "section1_entreprise",
    order: 5,
    type: AstFieldType.text,
    requiredField: true,
    path: "enterprise.department",
  ),
  FormQuestionAst(
    id: "S1Q04_SUBDIV",
    paperCode: "S1Q04",
    label: "Arrondissement/ Subdivision",
    sectionId: "section1_entreprise",
    order: 6,
    type: AstFieldType.text,
    requiredField: true,
    path: "enterprise.subdivision",
  ),
  FormQuestionAst(
    id: "S1Q04_LOCALITY",
    paperCode: "S1Q04",
    label: "Quartier/Village/Localité/ Neighborhood/Village/Locality",
    sectionId: "section1_entreprise",
    order: 7,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "enterprise.locality",
  ),
  FormQuestionAst(
    id: "S1Q05_TEL1",
    paperCode: "S1Q05",
    label: "Téléphone 1/ Tel 1",
    sectionId: "section1_entreprise",
    order: 8,
    type: AstFieldType.tel,
    requiredField: true,
    path: "enterprise.phone1",
  ),
  FormQuestionAst(
    id: "S1Q05_TEL2",
    paperCode: "S1Q05",
    label: "Téléphone 2/ Tel 2",
    sectionId: "section1_entreprise",
    order: 9,
    type: AstFieldType.tel,
    // NO requiredField - phone2 is optional
    path: "enterprise.phone2",
  ),
  FormQuestionAst(
    id: "S1Q05_BP",
    paperCode: "S1Q05",
    label: "Boîte postale/ PO Box",
    sectionId: "section1_entreprise",
    order: 10,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "enterprise.poBox",
  ),
  FormQuestionAst(
    id: "S1Q06",
    paperCode: "S1Q06",
    label: "Secteur d'activité/ Business sector",
    sectionId: "section1_entreprise",
    order: 11,
    type: AstFieldType.radio,
    options: [
      "Primaire/ Primary",
      "Secondaire/ Secondary",
      "Tertiaire/ Tertiary",
    ],
    requiredField: true,
    path: "enterprise.sector",
  ),
  FormQuestionAst(
    id: "S1Q07",
    paperCode: "S1Q07",
    label: "Branche d'activité/ Branch of activity",
    sectionId: "section1_entreprise",
    order: 12,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "enterprise.branch",
  ),
  FormQuestionAst(
    id: "S1Q08",
    paperCode: "S1Q08",
    label: "Activité principale/ Main activity",
    sectionId: "section1_entreprise",
    order: 13,
    type: AstFieldType.text,
    requiredField: true,
    path: "enterprise.mainActivity",
  ),
  FormQuestionAst(
    id: "S1Q09",
    paperCode: "S1Q09",
    label: "Siège social de l'entreprise/ Company's head office",
    sectionId: "section1_entreprise",
    order: 14,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "enterprise.headOffice",
  ),
  FormQuestionAst(
    id: "S1Q10",
    paperCode: "S1Q10",
    label: "Nombre d'employés permanents/ Number of permanent workers",
    sectionId: "section1_entreprise",
    order: 15,
    type: AstFieldType.number,
    requiredField: true,
    path: "enterprise.permanentWorkers",
  ),
  FormQuestionAst(
    id: "S1Q11",
    paperCode: "S1Q11",
    label: "Nombre de postes vacants/ Number of vacancies",
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
    label: "Taille de l'entreprise/ Enterprise size",
    sectionId: "section1_entreprise",
    order: 17,
    type: AstFieldType.radio,
    options: [
      "TPE/ Very small enterprise",
      "PE/ Small enterprise",
      "ME/ Medium-sized enterprise",
      "GE/ Large enterprise",
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
  title: "SECTION 1. IDENTIFICATION DE LA COOPERATIVE/ COOPERATIVE DETAILS",
  order: 1,
  entityTypes: ["cooperative"],
);

const section1CooperativeQuestions = <FormQuestionAst>[
  FormQuestionAst(
    id: "COOP_S1Q01",
    paperCode: "S1Q01",
    label: "Nom de la coopérative/ Cooperative name",
    sectionId: "section1_cooperative",
    order: 1,
    type: AstFieldType.text,
    requiredField: true,
    path: "cooperative.name",
  ),
  FormQuestionAst(
    id: "COOP_S1Q02",
    paperCode: "S1Q02",
    label: "Siège social/ Head office",
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
    label: "Année de création de la coopérative/ Year of creation",
    sectionId: "section1_cooperative",
    order: 3,
    type: AstFieldType.number,
    requiredField: true, // FIX-7: Added required
    path: "cooperative.yearCreated",
    hint: "Ex: 2010",
  ),
  FormQuestionAst(
    id: "COOP_S1Q04",
    paperCode: "S1Q04",
    label: "Milieu de résidence/ Area",
    sectionId: "section1_cooperative",
    order: 4,
    type: AstFieldType.radio,
    options: ["Urbain/ Urban", "Rural/ Rural"],
    requiredField: true, // FIX-7: Added required
    path: "cooperative.area",
  ),
  FormQuestionAst(
    id: "COOP_S1Q05_REGION",
    paperCode: "S1Q05",
    label: "Région/ Region",
    sectionId: "section1_cooperative",
    order: 5,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "cooperative.region",
  ),
  FormQuestionAst(
    id: "COOP_S1Q05_DEPT",
    paperCode: "S1Q05",
    label: "Département/ Division",
    sectionId: "section1_cooperative",
    order: 6,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "cooperative.department",
  ),
  FormQuestionAst(
    id: "COOP_S1Q05_SUBDIV",
    paperCode: "S1Q05",
    label: "Arrondissement/ Subdivision",
    sectionId: "section1_cooperative",
    order: 7,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "cooperative.subdivision",
  ),
  FormQuestionAst(
    id: "COOP_S1Q05_LOCALITY",
    paperCode: "S1Q05",
    label: "Quartier/Village/Localité/ Neighborhood/Village/Locality",
    sectionId: "section1_cooperative",
    order: 8,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "cooperative.locality",
  ),
  FormQuestionAst(
    id: "COOP_S1Q06_TEL1",
    paperCode: "S1Q06",
    label: "Téléphone 1/ Tel 1",
    sectionId: "section1_cooperative",
    order: 9,
    type: AstFieldType.tel,
    requiredField: true, // FIX-7: Added required
    path: "cooperative.phone1",
  ),
  FormQuestionAst(
    id: "COOP_S1Q06_TEL2",
    paperCode: "S1Q06",
    label: "Téléphone 2/ Tel 2",
    sectionId: "section1_cooperative",
    order: 10,
    type: AstFieldType.tel,
    // NO requiredField - phone2 is optional
    path: "cooperative.phone2",
  ),
  FormQuestionAst(
    id: "COOP_S1Q06_BP",
    paperCode: "S1Q06",
    label: "Boîte postale/ PO Box",
    sectionId: "section1_cooperative",
    order: 11,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "cooperative.poBox",
  ),
  FormQuestionAst(
    id: "COOP_S1Q07",
    paperCode: "S1Q07",
    label: "Secteur d'activité/ Business sector",
    sectionId: "section1_cooperative",
    order: 12,
    type: AstFieldType.radio,
    options: [
      "Primaire/ Primary",
      "Secondaire/ Secondary",
      "Tertiaire/ Tertiary",
    ],
    requiredField: true, // FIX-7: Added required
    path: "cooperative.sector",
  ),
  FormQuestionAst(
    id: "COOP_S1Q08",
    paperCode: "S1Q08",
    label: "Branche d'activité/ Branch of activity",
    sectionId: "section1_cooperative",
    order: 13,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "cooperative.branch",
  ),
  FormQuestionAst(
    id: "COOP_S1Q09",
    paperCode: "S1Q09",
    label: "Activité principale/ Main activity",
    sectionId: "section1_cooperative",
    order: 14,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "cooperative.mainActivity",
  ),
  FormQuestionAst(
    id: "COOP_S1Q10",
    paperCode: "S1Q10",
    label: "Type de la coopérative/ Type of cooperative",
    sectionId: "section1_cooperative",
    order: 15,
    type: AstFieldType.radio,
    options: [
      "Coopérative à comptabilité simplifiée",
      "Coopérative avec conseil d'administration",
      "Autre (à préciser)/ Other (specify)",
    ],
    requiredField: true, // FIX-7: Added required
    path: "cooperative.type",
  ),
  FormQuestionAst(
    id: "COOP_S1Q10_OTHER",
    paperCode: "S1Q10",
    label: "Précisez/ Specify",
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
    label: "Nombre d'employés permanents/ Number of permanent workers",
    sectionId: "section1_cooperative",
    order: 17,
    type: AstFieldType.number,
    requiredField: true, // FIX-7: Added required
    path: "cooperative.permanentWorkers",
  ),
  FormQuestionAst(
    id: "COOP_S1Q12",
    paperCode: "S1Q12",
    label: "Nombre de postes vacants/ Number of vacancies",
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
  title: "SECTION 1. IDENTIFICATION DE LA CTD/ RLA DETAILS",
  order: 1,
  entityTypes: ["ctd"],
);

const section1CtdQuestions = <FormQuestionAst>[
  FormQuestionAst(
    id: "CTD_S1Q01",
    paperCode: "S1Q01",
    label: "Type de CTD/ Type of RLA",
    sectionId: "section1_ctd",
    order: 1,
    type: AstFieldType.radio,
    options: ["Région/ Region", "Commune/ Council"],
    requiredField: true,
    path: "ctd.type",
  ),
  FormQuestionAst(
    id: "CTD_S1Q02",
    paperCode: "S1Q02",
    label: "Si 2, Quel est le type de Commune/ If 2, what type of council",
    sectionId: "section1_ctd",
    order: 2,
    type: AstFieldType.radio,
    options: [
      "Commune d'Arrondissement/ Local Council",
      "Communauté Urbaine/ Urban Council",
    ],
    dependsOn: "CTD_S1Q01",
    dependsValue: "Commune/ Council",
    // NO requiredField - conditional field
    path: "ctd.councilType",
  ),
  FormQuestionAst(
    id: "CTD_S1Q03",
    paperCode: "S1Q03",
    label: "Année de création de la CTD/ Year of creation of RLA",
    sectionId: "section1_ctd",
    order: 3,
    type: AstFieldType.number,
    requiredField: true, // FIX-7: Added required
    path: "ctd.yearCreated",
    hint: "Ex: 2005",
  ),
  FormQuestionAst(
    id: "CTD_S1Q04",
    paperCode: "S1Q04",
    label: "Milieu de résidence/ Area",
    sectionId: "section1_ctd",
    order: 4,
    type: AstFieldType.radio,
    options: ["Urbain/ Urban", "Rural/ Rural"],
    requiredField: true, // FIX-7: Added required
    path: "ctd.area",
  ),
  FormQuestionAst(
    id: "CTD_S1Q05_REGION",
    paperCode: "S1Q05",
    label: "Région/ Region",
    sectionId: "section1_ctd",
    order: 5,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "ctd.region",
  ),
  FormQuestionAst(
    id: "CTD_S1Q05_DEPT",
    paperCode: "S1Q05",
    label: "Département/ Division",
    sectionId: "section1_ctd",
    order: 6,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "ctd.department",
  ),
  FormQuestionAst(
    id: "CTD_S1Q05_SUBDIV",
    paperCode: "S1Q05",
    label: "Arrondissement/ Subdivision",
    sectionId: "section1_ctd",
    order: 7,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "ctd.subdivision",
  ),
  FormQuestionAst(
    id: "CTD_S1Q05_LOCALITY",
    paperCode: "S1Q05",
    label: "Quartier/Village/Localité/ Neighborhood/Village/Locality",
    sectionId: "section1_ctd",
    order: 8,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "ctd.locality",
  ),
  FormQuestionAst(
    id: "CTD_S1Q06_TEL1",
    paperCode: "S1Q06",
    label: "Téléphone 1/ Tel 1",
    sectionId: "section1_ctd",
    order: 9,
    type: AstFieldType.tel,
    requiredField: true, // FIX-7: Added required
    path: "ctd.phone1",
  ),
  FormQuestionAst(
    id: "CTD_S1Q06_TEL2",
    paperCode: "S1Q06",
    label: "Téléphone 2/ Tel 2",
    sectionId: "section1_ctd",
    order: 10,
    type: AstFieldType.tel,
    // NO requiredField - phone2 is optional
    path: "ctd.phone2",
  ),
  FormQuestionAst(
    id: "CTD_S1Q06_BP",
    paperCode: "S1Q06",
    label: "Boîte postale/ PO Box",
    sectionId: "section1_ctd",
    order: 11,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "ctd.poBox",
  ),
  FormQuestionAst(
    id: "CTD_S1Q07",
    paperCode: "S1Q07",
    label: "Secteur d'activité/ Business sector",
    sectionId: "section1_ctd",
    order: 12,
    type: AstFieldType.radio,
    options: [
      "Primaire/ Primary",
      "Secondaire/ Secondary",
      "Tertiaire/ Tertiary",
    ],
    requiredField: true, // FIX-7: Added required
    path: "ctd.sector",
  ),
  FormQuestionAst(
    id: "CTD_S1Q08",
    paperCode: "S1Q08",
    label: "Branche d'activité/ Branch of activity",
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
    label: "Nombre d'employé permanent/ Number of permanent workers",
    sectionId: "section1_ctd",
    order: 14,
    type: AstFieldType.number,
    requiredField: true, // FIX-7: Added required
    path: "ctd.permanentWorkers",
  ),
  FormQuestionAst(
    id: "CTD_S1Q10",
    paperCode: "S1Q10",
    label: "Nombre de poste vacant/ Number of vacancies",
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
  title: "SECTION 1. IDENTIFICATION DE L'ONG/ NGO DETAILS",
  order: 1,
  entityTypes: ["ong"],
);

const section1OngQuestions = <FormQuestionAst>[
  FormQuestionAst(
    id: "ONG_S1Q01",
    paperCode: "S1Q01",
    label: "Nom de l'ONG/ NGO's name",
    sectionId: "section1_ong",
    order: 1,
    type: AstFieldType.text,
    requiredField: true,
    path: "ong.name",
  ),
  FormQuestionAst(
    id: "ONG_S1Q02",
    paperCode: "S1Q02",
    label: "Siège social/ NGO head office",
    sectionId: "section1_ong",
    order: 2,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "ong.headOffice",
  ),
  FormQuestionAst(
    id: "ONG_S1Q03",
    paperCode: "S1Q03",
    label: "Année de création de l'ONG/ Year of creation of NGO",
    sectionId: "section1_ong",
    order: 3,
    type: AstFieldType.number,
    requiredField: true, // FIX-7: Added required
    path: "ong.yearCreated",
    hint: "Ex: 2008",
  ),
  FormQuestionAst(
    id: "ONG_S1Q04",
    paperCode: "S1Q04",
    label: "Milieu de résidence/ Area",
    sectionId: "section1_ong",
    order: 4,
    type: AstFieldType.radio,
    options: ["Urbain/ Urban", "Rural/ Rural"],
    requiredField: true, // FIX-7: Added required
    path: "ong.area",
  ),
  FormQuestionAst(
    id: "ONG_S1Q05_REGION",
    paperCode: "S1Q05",
    label: "Région/ Region",
    sectionId: "section1_ong",
    order: 5,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "ong.region",
  ),
  FormQuestionAst(
    id: "ONG_S1Q05_DEPT",
    paperCode: "S1Q05",
    label: "Département/ Division",
    sectionId: "section1_ong",
    order: 6,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "ong.department",
  ),
  FormQuestionAst(
    id: "ONG_S1Q05_SUBDIV",
    paperCode: "S1Q05",
    label: "Arrondissement/ Subdivision",
    sectionId: "section1_ong",
    order: 7,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "ong.subdivision",
  ),
  FormQuestionAst(
    id: "ONG_S1Q05_LOCALITY",
    paperCode: "S1Q05",
    label: "Quartier/Village/Localité/ Neighborhood/Village/Locality",
    sectionId: "section1_ong",
    order: 8,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "ong.locality",
  ),
  FormQuestionAst(
    id: "ONG_S1Q06_TEL1",
    paperCode: "S1Q06",
    label: "Téléphone 1/ Tel 1",
    sectionId: "section1_ong",
    order: 9,
    type: AstFieldType.tel,
    requiredField: true, // FIX-7: Added required
    path: "ong.phone1",
  ),
  FormQuestionAst(
    id: "ONG_S1Q06_TEL2",
    paperCode: "S1Q06",
    label: "Téléphone 2/ Tel 2",
    sectionId: "section1_ong",
    order: 10,
    type: AstFieldType.tel,
    // NO requiredField - phone2 is optional
    path: "ong.phone2",
  ),
  FormQuestionAst(
    id: "ONG_S1Q06_BP",
    paperCode: "S1Q06",
    label: "Boîte postale/ PO Box",
    sectionId: "section1_ong",
    order: 11,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "ong.poBox",
  ),
  FormQuestionAst(
    id: "ONG_S1Q07",
    paperCode: "S1Q07",
    label: "Secteur d'activité/ Business sector",
    sectionId: "section1_ong",
    order: 12,
    type: AstFieldType.radio,
    options: [
      "Primaire/ Primary",
      "Secondaire/ Secondary",
      "Tertiaire/ Tertiary",
    ],
    requiredField: true, // FIX-7: Added required
    path: "ong.sector",
  ),
  FormQuestionAst(
    id: "ONG_S1Q08",
    paperCode: "S1Q08",
    label: "Branche d'activité/ Branch of activity",
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
    label: "Quelle est votre mission principale ?/ What is your main mission ?",
    sectionId: "section1_ong",
    order: 14,
    type: AstFieldType.text,
    requiredField: true, // FIX-7: Added required
    path: "ong.mainMission",
  ),
  FormQuestionAst(
    id: "ONG_S1Q10",
    paperCode: "S1Q10",
    label: "Nombre d'employé permanent/ Number of permanent workers",
    sectionId: "section1_ong",
    order: 15,
    type: AstFieldType.number,
    requiredField: true, // FIX-7: Added required
    path: "ong.permanentWorkers",
  ),
  FormQuestionAst(
    id: "ONG_S1Q11",
    paperCode: "S1Q11",
    label: "Nombre de poste vacant/ Number of vacancies",
    sectionId: "section1_ong",
    order: 16,
    type: AstFieldType.number,
    requiredField: true, // FIX-7: Added required
    path: "ong.vacancies",
  ),
];

// ============================================================
// SECTION 2 - EMPLOI ET TRAVAIL/ EMPLOYMENT AND LABOUR
//
// Identical across all four questionnaires except S22Q05
// (see entity-specific variants below).
// ============================================================

const section2 = SectionAst(
  id: "section2",
  title: "SECTION 2. EMPLOI ET TRAVAIL/ EMPLOYMENT AND LABOUR",
  order: 2,
);

// ----------------------------------------------------------
// 2.1 DEMANDE D'EMPLOIS/ JOB APPLICATION
// ----------------------------------------------------------

const s21q01 = FormQuestionAst(
  id: "S21Q01",
  paperCode: "S21Q01",
  subsection: "2.1 DEMANDE D'EMPLOIS/ JOB APPLICATION",
  label:
      "Combien de demandes d'emplois avez-vous enregistré selon la catégorie socioprofessionnelle, le sexe et la tranche d'âge du premier Janvier 2025 à ce jour ?/ "
      "How many job applications per socio-professional category, gender and age group did you register from the 1st of January 2025 to the present day?",
  sectionId: "section2",
  order: 1,
  type: AstFieldType.table,
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
  subsection: "2.2 RECRUTEMENTS/ RECRUITMENTS",
  label:
      "Combien de permanents avez-vous recruté selon la catégorie socioprofessionnelle, le sexe et la tranche d'âge du premier Janvier 2025 à ce jour?/ "
      "How many permanent workers per socio-professional category, gender and age group did you recruit from the 1st of January 2025 to the present day?",
  sectionId: "section2",
  order: 2,
  type: AstFieldType.table,
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
  subsection: "2.2 RECRUTEMENTS/ RECRUITMENTS",
  label:
      "Combien de temporaires avez-vous recruté selon la catégorie socioprofessionnelle, le sexe et la tranche d'âge du premier Janvier 2025 à ce jour?/ "
      "How many temporary workers per socio-professional category, gender and age group did you recruit from the 1st of January 2025 to the present day?",
  sectionId: "section2",
  order: 3,
  type: AstFieldType.table,
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
  subsection: "2.2 RECRUTEMENTS/ RECRUITMENTS",
  label:
      "Combien de personnes avez-vous recruté selon la catégorie socioprofessionnelle, le sexe, le diplôme et la tranche d'âge du premier Janvier 2025 à ce jour?/ "
      "How many workers per socio-professional category, gender, and diploma did you recruit from the 1st of January 2025 to the present day?",
  sectionId: "section2",
  order: 4,
  type: AstFieldType.table,
  tableSpec: {
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
  subsection: "2.2 RECRUTEMENTS/ RECRUITMENTS",
  label:
      "Combien de personnes en situation de handicap avez-vous recruté selon la catégorie socio professionnelle, le sexe et le statut du 1er Janvier 2025 à ce jour?/ "
      "How many workers with a disability per socio-professional category, gender, and status did you recruit from the 1st of January 2025 to the present day?",
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
  subsection: "2.2 RECRUTEMENTS/ RECRUITMENTS",
  label:
      "Combien de personnes vulnérables avez-vous recruté selon le statut et la nature de la vulnérabilité du 1er Janvier 2025 à ce jour?/ "
      "How many vulnerable workers per status and nature of vulnerability did you recruit from the 1st of January 2025 to the present day?",
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
  subsection: "2.2 RECRUTEMENTS/ RECRUITMENTS",
  label:
      "Combien de personnes vulnérables avez-vous recruté selon le statut et la nature de la vulnérabilité du 1er Janvier 2025 à ce jour?/ "
      "How many vulnerable workers per status and nature of vulnerability did you recruit from the 1st of January 2025 to the present day?",
  sectionId: "section2",
  order: 6,
  type: AstFieldType.table,
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
  subsection:
      "2.3 PRIMO DEMANDEUR (personne à la recherche de son premier emploi)/ FIRST-TIME JOB SEEKER",
  label:
      "Combien de personnes recherchant leur premier emploi avez-vous enregistré selon la catégorie socioprofessionnelle, le sexe et la tranche d'âge du premier Janvier 2025 à ce jour?/ "
      "How many people looking for their first job per socio-professional category, gender and age group did you register from the 1st of January 2025 to the present day?",
  sectionId: "section2",
  order: 7,
  type: AstFieldType.table,
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
  subsection:
      "2.3 PRIMO DEMANDEUR (personne à la recherche de son premier emploi)/ FIRST-TIME JOB SEEKER",
  label:
      "Combien de personnes travaillant pour la première fois avez-vous recrutées selon la catégorie socioprofessionnelle et la tranche d'âge du premier Janvier 2025 à ce jour?/ "
      "How many people Working for their first time per socio-professional category, gender and age group did you recruit from the 1st of January 2025 to the present day?",
  sectionId: "section2",
  order: 8,
  type: AstFieldType.table,
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
  title: "SECTION 3. DÉPARTS/ DEPARTURES",
  order: 3,
);

const s3q01 = FormQuestionAst(
  id: "S3Q01",
  paperCode: "S3Q01",
  label:
      "Combien de départs avez-vous enregistrés du 1er Janvier 2025 à ce jour?/ "
      "How many departures did you register from the 1st of January 2025 to the present day?",
  sectionId: "section3",
  order: 1,
  type: AstFieldType.table,
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
  label: "Quels sont les principaux motifs de licenciement ?/ "
      "What are the main grounds for dismissal?",
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
  label: "Motif de licenciement 1/ Dismissal reason 1",
  sectionId: "section3",
  order: 2,
  type: AstFieldType.text,
  requiredField: true,
  path: "section3.dismissalReasons.reason1.text",
  hint: "Décrivez le motif de licenciement",
  instruction: "Précisez la raison du licenciement",
);

const s3q02_reason_2_text = FormQuestionAst(
  id: "S3Q02_REASON_2_TEXT",
  paperCode: "S3Q02",
  label: "Motif de licenciement 2/ Dismissal reason 2",
  sectionId: "section3",
  order: 2,
  type: AstFieldType.text,
  requiredField: true,
  path: "section3.dismissalReasons.reason2.text",
  hint: "Décrivez le motif de licenciement",
  instruction: "Précisez la raison du licenciement",
);

const s3q02_reason_3_text = FormQuestionAst(
  id: "S3Q02_REASON_3_TEXT",
  paperCode: "S3Q02",
  label: "Motif de licenciement 3/ Dismissal reason 3",
  sectionId: "section3",
  order: 2,
  type: AstFieldType.text,
  requiredField: true,
  path: "section3.dismissalReasons.reason3.text",
  hint: "Décrivez le motif de licenciement",
  instruction: "Précisez la raison du licenciement",
);

const s3q03 = FormQuestionAst(
  id: "S3Q03",
  paperCode: "S3Q03",
  label:
      "Combien de personnes avez-vous licenciées ou mises en chômage technique du 1er Janvier 2025 à ce jour?/ "
      "How many people did you dismiss or put on technical unemployment from the 1st of January 2025 to the present day?",
  sectionId: "section3",
  order: 3,
  type: AstFieldType.table,
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
  title: "SECTION 4. STAGE ET FORMATION/ INTERNSHIP AND TRAINING",
  order: 4,
);

const s4q01 = FormQuestionAst(
  id: "S4Q01",
  paperCode: "S4Q01",
  label:
      "Combien de stagiaires avez-vous recrutés du 1er Janvier 2025 à ce jour?/ "
      "How many interns did you recruit from the 1st of January 2025 to the present day?",
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
  label:
      "Quels sont les besoins en compétence de votre entreprise? (énumérer les 3 compétences prioritaires)/ "
      "What are the skills needs of your company? (list the 3 priority skills)",
  sectionId: "section4",
  order: 2,
  type: AstFieldType.table,
  tableSpec: {
    "template": "skills_table",
    "prefix": "s4q02",
    "rows": 3,
    "fields": ["skill_description", "male", "female", "total"],
  },
);

const s4q02_domain_1_text = FormQuestionAst(
  id: "S4Q02_DOMAIN_1_TEXT",
  paperCode: "S4Q02",
  label: "Domaine de compétence 1/ Skill domain 1",
  sectionId: "section4",
  order: 2,
  type: AstFieldType.text,
  requiredField: true,
  path: "section4.skills.domain1.text",
  hint: "Ex: Gestion, Comptabilité, Marketing, RH, Technique...",
  instruction: "Nommez le domaine de compétence prioritaire",
);

const s4q02_domain_2_text = FormQuestionAst(
  id: "S4Q02_DOMAIN_2_TEXT",
  paperCode: "S4Q02",
  label: "Domaine de compétence 2/ Skill domain 2",
  sectionId: "section4",
  order: 2,
  type: AstFieldType.text,
  requiredField: true,
  path: "section4.skills.domain2.text",
  hint: "Ex: Gestion, Comptabilité, Marketing, RH, Technique...",
  instruction: "Nommez le domaine de compétence prioritaire",
);

const s4q02_domain_3_text = FormQuestionAst(
  id: "S4Q02_DOMAIN_3_TEXT",
  paperCode: "S4Q02",
  label: "Domaine de compétence 3/ Skill domain 3",
  sectionId: "section4",
  order: 2,
  type: AstFieldType.text,
  requiredField: true,
  path: "section4.skills.domain3.text",
  hint: "Ex: Gestion, Comptabilité, Marketing, RH, Technique...",
  instruction: "Nommez le domaine de compétence prioritaire",
);

const s4q03 = FormQuestionAst(
  id: "S4Q03",
  paperCode: "S4Q03",
  label:
      "Quels sont les besoins en formation des personnels de votre entreprise? (énumérer les 3 domaines de formation prioritaires)/ "
      "What are the training needs of your company's staff? (list the 3 priority fields of training)",
  sectionId: "section4",
  order: 3,
  type: AstFieldType.table,
  tableSpec: {
    "template": "training_table",
    "prefix": "s4q03",
    "rows": 3,
    "fields": ["training_domain", "male", "female", "total"],
  },
);

const s4q03_domain_1_text = FormQuestionAst(
  id: "S4Q03_DOMAIN_1_TEXT",
  paperCode: "S4Q03",
  label: "Domaine de formation 1/ Training domain 1",
  sectionId: "section4",
  order: 3,
  type: AstFieldType.text,
  requiredField: true,
  path: "section4.training.domain1.text",
  hint: "Ex: Leadership, Techniques de vente, Gestion de projet...",
  instruction: "Nommez le domaine de formation prioritaire",
);

const s4q03_domain_2_text = FormQuestionAst(
  id: "S4Q03_DOMAIN_2_TEXT",
  paperCode: "S4Q03",
  label: "Domaine de formation 2/ Training domain 2",
  sectionId: "section4",
  order: 3,
  type: AstFieldType.text,
  requiredField: true,
  path: "section4.training.domain2.text",
  hint: "Ex: Leadership, Techniques de vente, Gestion de projet...",
  instruction: "Nommez le domaine de formation prioritaire",
);

const s4q03_domain_3_text = FormQuestionAst(
  id: "S4Q03_DOMAIN_3_TEXT",
  paperCode: "S4Q03",
  label: "Domaine de formation 3/ Training domain 3",
  sectionId: "section4",
  order: 3,
  type: AstFieldType.text,
  requiredField: true,
  path: "section4.training.domain3.text",
  hint: "Ex: Leadership, Techniques de vente, Gestion de projet...",
  instruction: "Nommez le domaine de formation prioritaire",
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
  section2,
  section3,
  section4,
];

// FIX-3: s3q02_reason_4_text removed from this list (no 4th reason in any PDF)
const List<FormQuestionAst> allQuestions = [
  // Section 0 — respondent (all entities)
  ...section0Questions,

  // Section 1 — entity-specific identification
  ...section1EnterpriseQuestions,
  ...section1CooperativeQuestions,
  ...section1CtdQuestions,
  ...section1OngQuestions,

  // Section 2.1 — job applications
  s21q01,

  // Section 2.2 — recruitments
  s22q01,
  s22q02,
  s22q03,
  s22q04,
  s22q05Enterprise,
  s22q05Other,

  // Section 2.3 — first-time job seekers
  s23q01,
  s23q02,

  // Section 3 — departures
  s3q01,
  s3q02,
  s3q02_reason_1_text,
  s3q02_reason_2_text,
  s3q02_reason_3_text,
  s3q03,

  // Section 4 — internship and training
  s4q01,
  s4q02,
  s4q02_domain_1_text,
  s4q02_domain_2_text,
  s4q02_domain_3_text,
  s4q03,
  s4q03_domain_1_text,
  s4q03_domain_2_text,
  s4q03_domain_3_text,
];
