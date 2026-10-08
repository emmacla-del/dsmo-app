export const VT_COMPACT_TOGGLE_SECTION_IDS = new Set([
  "section6_vocationalTraining",
  "section7_vocationalTraining",
]);

export const VT_TABBED_SECTION_IDS = new Set([
  "section4_vocationalTraining",
  "section8_vocationalTraining",
]);

export const VT_SIGNATURES_SECTION_ID = "section9_vocationalTraining";

export const VT_713_FOLDED_IDS = new Set(["VT7_7", "VT7_8", "VT7_9", "VT7_10", "VT7_11"]);

export const VT_SECTION_713_TABLE_ID = "VT7_7_table";

export const SECTION_784_BREAKPOINT = 784;
export const TABLET_BREAKPOINT = 768;

// Was a VT-specific #0A6640/#E6F2ED/#F4F6F5/Manrope skin to pixel-match
// Flutter's own VT styling; now aliases the app-wide tokens so the VT
// wizard matches the rest of the app (including the login page) in accent
// green, background, and font.
export const VT_ACCENT = "var(--cam-green)";
export const VT_CARD_BORDER = "var(--cam-border)";
export const VT_INK = "var(--cam-text)";
export const VT_INK_SOFT = "var(--cam-text-muted)";
export const VT_INK_FAINT = "#7A827F";
export const VT_BACKGROUND = "var(--cam-bg)";
export const VT_ACCENT_SOFT = "var(--cam-success-bg)";
export const VT_YELLOW = "#FCD116";
export const VT_RED = "#CE1126";
export const VT_RED_SOFT = "#FFF5F5";
export const VT_YELLOW_SOFT = "#FFFCEB";
export const VT_CARD_RADIUS = 4;
export const VT_FAMILY = "var(--cam-font-sans)";

/**
 * Category-tab labels for sections 4/5/8, matching Flutter's own
 * LocalizedText pairs in vt_wizard_section_screen.dart (lines 1572-1612) —
 * each tab switches between French and English with the app's locale
 * instead of always showing the French paper-form wording.
 */
export const VT_TAB_LABELS: Record<string, { fr: string; en: string }[]> = {
  section4_vocationalTraining: [
    { fr: "4.1 Diplôme Académique", en: "4.1 Academic Diploma" },
    { fr: "4.2 Diplôme Professionnel", en: "4.2 Professional Diploma" },
    { fr: "4.3 Qualifiés Non Occupés", en: "4.3 Qualified Not Working" },
    { fr: "4.4 Secteur Informel", en: "4.4 Informal Sector" },
    { fr: "4.5 Par Spécialité", en: "4.5 By Specialty" },
    { fr: "4.6 Par Année", en: "4.6 By Year" },
    { fr: "4.7 Par Âge", en: "4.7 By Age" },
    { fr: "4.8 Entrants & Flux", en: "4.8 Entrants & Flow" },
    { fr: "4.9 Vulnérables", en: "4.9 Vulnerable" },
    { fr: "4.10 Sortants", en: "4.10 Leavers" },
    { fr: "4.11 Bourses", en: "4.11 Scholarships" },
  ],
  section5_vocationalTraining: [
    { fr: "5.1 Manuels d'Apprentissage", en: "5.1 Study Guides" },
    { fr: "5.2 Référentiel de Formation", en: "5.2 Training Curriculum" },
    { fr: "5.3 Infrastructures", en: "5.3 Infrastructure" },
    { fr: "5.4 Équipements Mobiliers", en: "5.4 Furniture" },
  ],
  section8_vocationalTraining: [
    { fr: "8.1 Diplômes Académiques", en: "8.1 Academic Diplomas" },
    { fr: "8.2 Diplômes Professionnels", en: "8.2 Professional Diplomas" },
    { fr: "8.3 Par Âge", en: "8.3 By Age" },
    { fr: "8.4 Par Spécialité", en: "8.4 By Specialty" },
    { fr: "8.5 Par Statut", en: "8.5 By Status" },
    { fr: "8.6 Handicap", en: "8.6 Disability" },
    { fr: "8.7 Capacité", en: "8.7 Capacity" },
    { fr: "8.8 État Nominatif", en: "8.8 Nominal Roll" },
  ],
};

export function vtWizardTabLabel(sectionId: string, index: number, locale: string): string | null {
  const entry = VT_TAB_LABELS[sectionId]?.[index];
  if (!entry) return null;
  return locale.startsWith("en") ? entry.en : entry.fr;
}

export interface VtFieldGroup {
  title: string | null;
  fieldIds: string[];
}

const SECTION_1_FINE_GROUPS: Record<string, string | null> = {
  VT1_1: "Localisation administrative et Milieu d'implantation",
  VT1_2: "Localisation administrative et Milieu d'implantation",
  VT1_3: "Localisation administrative et Milieu d'implantation",
  VT1_4: "Localisation administrative et Milieu d'implantation",
  VT1_5: "Localisation administrative et Milieu d'implantation",
  VT1_6: "Localisation administrative et Milieu d'implantation",
  VT1_7: "Localisation administrative et Milieu d'implantation",
  VT1_8: "Localisation administrative et Milieu d'implantation",
  VT1_9: "Localisation administrative et Milieu d'implantation",
  VT1_10: "Ordre d'enseignement et Type de CFP",
  VT1_11: "Ordre d'enseignement et Type de CFP",
  VT1_12: "Situation d'activité et Contacts",
  VT1_13: "Situation d'activité et Contacts",
  VT1_13_OTHER: "Situation d'activité et Contacts",
  VT1_14: "Situation d'activité et Contacts",
  VT1_15_NAME: "Situation d'activité et Contacts",
  VT1_15_FUNCTION: "Situation d'activité et Contacts",
  VT1_15_TEL1: "Situation d'activité et Contacts",
  VT1_15_TEL2: "Situation d'activité et Contacts",
  VT1_15_EMAIL: "Situation d'activité et Contacts",
  VT1_15_SEX: "Situation d'activité et Contacts",
  VT1_16_NAME: "Situation d'activité et Contacts",
  VT1_16_SEX: "Situation d'activité et Contacts",
  VT1_16_TEL1: "Situation d'activité et Contacts",
  VT1_16_TEL2: "Situation d'activité et Contacts",
  VT1_16_EMAIL: "Situation d'activité et Contacts",
};

const SECTION_2_FINE_GROUPS: Record<string, string | null> = {
  VT2_1: "Conventions, Sites et Infrastructures",
  VT2_2: "Conventions, Sites et Infrastructures",
  VT2_3: "Conventions, Sites et Infrastructures",
  VT2_4: "Conventions, Sites et Infrastructures",
  VT2_5: "Conventions, Sites et Infrastructures",
  VT2_6: "Accessibilité & Adressage postal",
  VT2_7: "Accessibilité & Adressage postal",
  VT2_8: "Accessibilité & Adressage postal",
  VT2_9: "Accessibilité & Adressage postal",
  VT2_10: "Accessibilité & Adressage postal",
  VT2_11: "Accessibilité & Adressage postal",
  VT2_12: "Accessibilité & Adressage postal",
  VT2_13: "Accessibilité & Adressage postal",
  VT2_14: "Agrément de fonctionnement (Accreditation)",
  VT2_15: "Agrément de fonctionnement (Accreditation)",
  VT2_16: "Agrément de fonctionnement (Accreditation)",
  VT2_17: "Agrément de fonctionnement (Accreditation)",
  VT2_18: "Régime et Volume Global d'Apprenants",
  VT2_19: "Régime et Volume Global d'Apprenants",
  VT2_20: "Régime et Volume Global d'Apprenants",
  VT2_21: "Régime et Volume Global d'Apprenants",
  VT2_22: "Régime et Volume Global d'Apprenants",
  VT2_23: "Électricité",
  VT2_24: "Électricité",
  VT2_25: "Électricité",
  VT2_26: "Eau potable",
  VT2_27: "Eau potable",
  VT2_28: "Services de Santé & Commodités",
  VT2_29: "Services de Santé & Commodités",
  VT2_30: "Services de Santé & Commodités",
  VT2_31: "Services de Santé & Commodités",
  VT2_32: "Services de Santé & Commodités",
  VT2_33: "Clôture",
  VT2_34: "Gouvernance & Conseils",
  VT2_35: "Gouvernance & Conseils",
  VT2_36: "Gouvernance & Conseils",
  VT2_37: "Latrines",
  VT2_38: "Latrines",
  VT2_39: "Latrines",
  VT2_40: "Latrines",
  VT2_41: "Aires de jeux",
  VT2_42: "Aires de jeux",
  VT2_43: "Équipements informatiques",
  VT2_44: "Équipements informatiques",
  VT2_45: "Équipements informatiques",
  VT2_46: "Équipements informatiques",
  VT2_47: "Équipements informatiques",
  VT2_48: "Équipements informatiques",
  VT2_49: "Programmes & Politiques de Protection",
  VT2_50: "Programmes & Politiques de Protection",
  VT2_51: "Programmes & Politiques de Protection",
  VT2_52: "Programmes & Politiques de Protection",
  VT2_53: "Programmes & Politiques de Protection",
};

const SECTION_3_FINE_GROUPS: Record<string, string | null> = {
  VT3_1: "Crises & Impact", VT3_2: "Crises & Impact", VT3_3: "Crises & Impact",
  VT3_4: "Crises & Impact", VT3_5: "Crises & Impact", VT3_6: "Crises & Impact",
  VT3_7: "Crises & Impact", VT3_8: "Crises & Impact", VT3_9: "Crises & Impact",
  VT3_10: "Crises & Impact", VT3_11: "Crises & Impact",
  VT3_12: "Préparation et formations des formateurs",
  VT3_13: "Préparation et formations des formateurs",
  VT3_14: "Préparation et formations des formateurs",
  VT3_15: "Préparation et formations des formateurs",
  VT3_16: "Préparation et formations des formateurs",
  VT3_17: "Préparation et formations des formateurs",
  VT3_18: "Préparation et formations des formateurs",
  VT3_19: "Préparation et formations des formateurs",
  VT3_20: "Préparation et formations des formateurs",
  VT3_21: "Préparation et formations des formateurs",
  VT3_22: "Préparation et formations des formateurs",
  VT3_23: "Préparation et formations des formateurs",
  VT3_24: "Formateurs formés sur d'autres aspects d'ESU",
  VT3_25: "Formateurs formés sur d'autres aspects d'ESU",
  VT3_26: "Formateurs formés sur d'autres aspects d'ESU",
  VT3_27: "Sécurisation", VT3_28: "Sécurisation",
  VT3_29: "Sécurisation", VT3_30: "Sécurisation",
};

const SECTION_7_FINE_GROUPS: Record<string, string | null> = {
  VT7_1: "VBG & Discipline", VT7_2: "VBG & Discipline", VT7_3: "VBG & Discipline",
  VT7_4: "VBG & Discipline", VT7_5: "VBG & Discipline", VT7_6: "VBG & Discipline",
  VT7_7: "VBG & Discipline", VT7_8: "VBG & Discipline", VT7_9: "VBG & Discipline",
  VT7_10: "VBG & Discipline", VT7_11: "VBG & Discipline",
  VT7_13: "Éducation Sexuelle & Orientation", VT7_14: "Éducation Sexuelle & Orientation",
  VT7_15: "Éducation Sexuelle & Orientation", VT7_16: "Éducation Sexuelle & Orientation",
  VT7_17: "Éducation Sexuelle & Orientation", VT7_18: "Éducation Sexuelle & Orientation",
  VT7_19: "Éducation Sexuelle & Orientation", VT7_20: "Éducation Sexuelle & Orientation",
  VT7_21: "Éducation Sexuelle & Orientation", VT7_22: "Éducation Sexuelle & Orientation",
};

const SECTION_9_FINE_GROUPS: Record<string, string | null> = {
  VT9_1: "Difficultés", VT9_2: "Difficultés", VT9_3: "Difficultés",
};

/**
 * English counterparts for every canonical (French) fine-group title above,
 * ported 1:1 from the LocalizedText pairs in
 * lib/screens/onefop/wizard/vt_wizard_section_screen.dart. The French string
 * itself stays the stable internal identity/grouping key (used for equality
 * checks, family lookups, and the SECTION1_*_TITLE constants in
 * VtWizardSectionScreen.tsx) — only the *displayed* text is translated,
 * via vtWizardTranslateGroupTitle below.
 */
const VT_GROUP_TITLE_EN: Record<string, string> = {
  "Localisation administrative et Milieu d'implantation": "Administrative Location and Area of Establishment",
  "Ordre d'enseignement et Type de CFP": "Education System and Type of VTC",
  "Situation d'activité et Contacts": "Activity Status and Contacts",
  "Conventions, Sites et Infrastructures": "Agreements, Sites and Infrastructure",
  "Accessibilité & Adressage postal": "Accessibility & Postal Address",
  "Agrément de fonctionnement (Accreditation)": "Operating Accreditation",
  "Régime et Volume Global d'Apprenants": "Training Mode and Overall Trainee Volume",
  "Électricité": "Electricity",
  "Eau potable": "Drinking Water",
  "Services de Santé & Commodités": "Hygiene & Welfare",
  "Clôture": "Fencing",
  "Gouvernance & Conseils": "Governance & Councils",
  "Latrines": "Latrines",
  "Aires de jeux": "Playgrounds",
  "Équipements informatiques": "ICT Access",
  "Programmes & Politiques de Protection": "School Protection & Social Programs",
  "Crises & Impact": "Crises & Impact",
  "Préparation et formations des formateurs": "Trainer Emergency Preparedness",
  "Formateurs formés sur d'autres aspects d'ESU": "Trainers trained on other emergency aspects",
  "Sécurisation": "Security measures",
  "VBG & Discipline": "GBV & Discipline",
  "Éducation Sexuelle & Orientation": "Sex Education & Guidance",
  "Difficultés": "Difficulties",
};

export function vtWizardTranslateGroupTitle(title: string | null | undefined, locale: string): string {
  if (!title) return "";
  if (!locale.startsWith("en")) return title;
  return VT_GROUP_TITLE_EN[title] ?? title;
}

const FINE_GROUPS_MAP: Record<string, Record<string, string | null> | null> = {
  section1_vocationalTraining: SECTION_1_FINE_GROUPS,
  section2_vocationalTraining: SECTION_2_FINE_GROUPS,
  section3_vocationalTraining: SECTION_3_FINE_GROUPS,
  section7_vocationalTraining: SECTION_7_FINE_GROUPS,
  section9_vocationalTraining: SECTION_9_FINE_GROUPS,
};

export function vtWizardGetFineGroups(sectionId: string): Record<string, string | null> | null {
  return FINE_GROUPS_MAP[sectionId] ?? null;
}

const THREE_COLUMN_SECTION_IDS = new Set([
  "section1_vocationalTraining",
  "section2_vocationalTraining",
]);

export function vtWizardRowColumnsFor(sectionId: string): number {
  return THREE_COLUMN_SECTION_IDS.has(sectionId) ? 3 : 2;
}

export function vtSection1IdentificationLocalisation(): string[] {
  return ["VT1_1", "VT1_2", "VT1_3", "VT1_4", "VT1_5", "VT1_6", "VT1_7", "VT1_8", "VT1_9"];
}

export function vtSection1IdentificationEnseignement(): string[] {
  return ["VT1_10", "VT1_11"];
}

export function vtWizardSection1LocalisationGroups(): { ids: string[]; label: string }[] {
  return [
    { ids: ["VT1_1", "VT1_2", "VT1_3"], label: "Localisation administrative et Milieu d'implantation" },
    { ids: ["VT1_4", "VT1_5", "VT1_6"], label: "Localisation administrative et Milieu d'implantation" },
    { ids: ["VT1_7", "VT1_8", "VT1_9"], label: "Localisation administrative et Milieu d'implantation" },
  ];
}

export function vtWizardSection1EnseignementGroup(): { ids: string[]; label: string } {
  return { ids: ["VT1_10", "VT1_11"], label: "Ordre d'enseignement et Type de CFP" };
}

export function vtWizardCardFamilyOf(sub: string | null): string | null {
  if (!sub) return null;
  const s1Families = new Set([
    "Localisation administrative et Milieu d'implantation",
    "Ordre d'enseignement et Type de CFP",
    "Situation d'activité et Contacts",
  ]);
  if (s1Families.has(sub)) return "section1Identification";
  const s2Families = new Set([
    "Conventions, Sites et Infrastructures",
    "Accessibilité & Adressage postal",
    "Agrément de fonctionnement (Accreditation)",
    "Régime et Volume Global d'Apprenants",
  ]);
  if (s2Families.has(sub)) return "section2InformationsGenerales";
  return null;
}
