/**
 * Contextual definitions and respondent-friendly explanations for the Modern Jobs Survey
 * (Administration, CTD, Coopérative, Entreprise, ONG, Projet/Programme).
 * Helps self-respondents understand survey classifications without jargon.
 *
 * A definition is attached BY FIELD ID, never by paper code. Every form
 * numbers its Section 1 questions S1Q01, S1Q10, S1Q11, so a lookup that
 * fell back to the paper code served the definitions written for the
 * enterprise on whatever question happened to carry the same number on
 * another form: « Nature de la structure » was defined as a « régime
 * juridique… déclaré au registre de commerce », « Objectif ou mission
 * principale » as an « effectif total des salariés », and — the two that
 * mattered most, because they read plausibly and were off by one — the
 * cooperative's « Nombre d'employés permanents » was defined as the
 * vacancies and the CTD's « Nombre de poste vacant » as the headcount.
 * Field ids are unique per form outside Section 0 and Section 3, and where
 * they are shared the question is the same on every form, so the id is the
 * right key; ENTITY_TOOLTIPS below carries the one case that differs.
 */
export interface TooltipText {
  fr: string;
  en: string;
}

/**
 * A period-based definition names the round rather than a quarter: a round
 * may be quarterly, half-yearly or annual, and its exact bounds are printed
 * once on the wizard masthead (owner's decision, 2026-10-18 — see
 * lib/campaign-period.ts).
 */
const PERMANENT_WORKERS: TooltipText = {
  fr: "Effectif total des salariés sous contrat permanent (CDI ou statut de fonctionnaire) à la fin de la période de référence.",
  en: "Total count of permanent staff (open-ended contract or civil servant status) at the end of the reference period.",
};

const VACANCIES: TooltipText = {
  fr: "Nombre de postes ouverts et non pourvus au sein de l'organisation à la fin de la période de référence.",
  en: "Number of open and unfilled positions in the organization at the end of the reference period.",
};

/** Definitions keyed by the question's own field id. */
export const MODERN_JOBS_TOOLTIPS: Record<string, TooltipText> = {
  // ── Section 0 — respondent (field ids shared by all six forms) ──
  S0Q01: {
    fr: "Nom et prénom de la personne qui remplit ou certifie le présent questionnaire.",
    en: "Full name of the person filling out or certifying this questionnaire.",
  },
  S0Q02: {
    fr: "Fonction officielle au sein de la structure (ex: Directeur des Ressources Humaines, Secrétaire Général, Chef Comptable).",
    en: "Official job title within the organization (e.g. HR Director, Secretary General, Chief Accountant).",
  },

  // ── Section 1 — enterprise ──
  S1Q01: {
    fr: "Régime juridique principal déclaré au registre de commerce ou décret de création.",
    en: "Main legal status registered in commercial registry or founding decree.",
  },
  S1Q10: PERMANENT_WORKERS,
  S1Q11: VACANCIES,

  // ── Section 1 — cooperative ──
  // The two OHADA forms this question distinguishes; its third option is
  // « Autre (à préciser) ».
  COOP_S1Q10: {
    fr: "Coopérative à comptabilité simplifiée (SCOOPS) : forme coopérative sans Conseil d'Administration, gérée par un Comité de Gestion. Coopérative avec Conseil d'Administration : régie par les règles OHADA avec un CA et une Direction Générale.",
    en: "Simplified cooperative (SCOOPS): cooperative without a Board of Directors, run by a management committee. Cooperative with Board of Directors: governed by OHADA standards with a formal board and general management.",
  },
  COOP_S1Q11: PERMANENT_WORKERS,
  COOP_S1Q12: VACANCIES,

  // ── Section 1 — CTD ──
  CTD_S1Q09: PERMANENT_WORKERS,
  CTD_S1Q10: VACANCIES,

  // ── Section 1 — NGO ──
  ONG_S1Q10: PERMANENT_WORKERS,
  ONG_S1Q11: VACANCIES,

  // ── Section 1 — project / programme ──
  PP_S1Q15: PERMANENT_WORKERS,
  PP_S1Q16: VACANCIES,

  // ── Section 3 — departures (one question, same on all five forms) ──
  // Dormant: FieldRenderer returns a table before it reads a tooltip, and
  // S3Q01 is a table. Keyed here on its own question all the same, so that
  // wiring tooltips into table headings picks it up rather than leaving it
  // on S3Q01_RESPONSE_STATUS, the reported/not-reported selector, which is
  // where the paper-code fallback used to put it.
  S3Q01: {
    fr: "Compter tout salarié ayant quitté l'organisation au cours de la période : retraite, fin de contrat, démission, licenciement, décès.",
    en: "Count every employee who left the organization during the period: retirement, contract expiration, resignation, dismissal, death.",
  },
};

/**
 * Where one field id is shared by several forms and the definition must
 * differ. Only S0Q02 so far: the same key names an « établissement » on the
 * employer forms and a project on the project/programme form — the rule
 * RESPONDENT_INTRO_KEYS and S0Q02's own label already follow.
 */
const ENTITY_TOOLTIPS: Record<string, Record<string, TooltipText>> = {
  projectProgram: {
    S0Q02: {
      fr: "Fonction officielle au sein du projet (ex: Coordonnateur de Projet, Responsable Suivi-Évaluation, Chef de Projet).",
      en: "Official job title within the project (e.g. Project Coordinator, M&E Specialist, Project Manager).",
    },
  },
};

/**
 * Definitions written for concepts rather than for a question: the CSP
 * categories of the Section 2 and 4 tables, the kinds of internship, the
 * kinds of departure. No field carries these as an id, so nothing renders
 * them today — the tables would have to show a definition on a row or
 * column heading. Kept here, out of the field map, so it is plain that they
 * are written and not yet shown, rather than looking like live entries.
 */
export const CONCEPT_DEFINITIONS: Record<string, TooltipText> = {
  SFP: {
    fr: "Spécialiste de la Formation Professionnelle : encadreurs techniques, formateurs qualifiés et instructeurs de métiers.",
    en: "Vocational Training Specialist: technical supervisors, certified instructors and master craftspeople.",
  },
  CSS: {
    fr: "Cadre Supérieur et Spécialisé : directeurs, ingénieurs, concepteurs et personnels d'encadrement stratégique (Bac+4/5 et plus).",
    en: "Senior Executive & Specialist: directors, engineers, designers and strategic management staff.",
  },
  FOREMEN: {
    fr: "Agent de Maîtrise : techniciens supérieurs, contremaîtres, chefs d'équipe supervisant l'exécution.",
    en: "Foremen / Supervisor: senior technicians, supervisors, and team leads overseeing operations.",
  },
  WORKERS: {
    fr: "Agent d'exécution : ouvriers, employés de bureau, opérateurs et personnels opérationnels de base.",
    en: "Field Workers / Execution Staff: laborers, clerks, operators, and baseline operational personnel.",
  },
  CHOMAGE_TECHNIQUE: {
    fr: "Suspension temporaire et collective du contrat de travail décidée par l'employeur (difficultés économiques, rupture d'approvisionnement), sans rupture de contrat.",
    en: "Temporary collective suspension of employment contracts decided by employer due to economic reasons, without termination.",
  },
  LICENCIEMENT_ECONOMIQUE: {
    fr: "Rupture de contrat consécutive à des difficultés économiques ou restructurations, non liée à la personne du salarié.",
    en: "Dismissal due to economic difficulties or restructuring, not related to employee misconduct.",
  },
  STAGE_ACADEMIQUE: {
    fr: "Stage obligatoire prescrit par une université ou école pour la validation d'un diplôme d'études.",
    en: "Mandatory internship prescribed by a university or school for degree completion.",
  },
  STAGE_PROFESSIONNEL: {
    fr: "Stage pratique d'immersion professionnelle ou de reconversion, indépendant d'un cursus scolaire en cours.",
    en: "Practical internship for professional immersion or retraining, independent of an ongoing academic degree.",
  },
  STAGE_PRE_EMPLOI: {
    fr: "Stage conventionné de transition précédant une embauche formelle.",
    en: "Transition internship agreement directly preceding formal permanent or temporary employment.",
  },
};

/**
 * The definition for a question, by its field id and the form being
 * declared. Never by paper code: that is an internal id (§8 keeps it off
 * the respondent's screen) and it is not unique across forms.
 */
export function getModernJobsTooltip(
  fieldId: string,
  entityType?: string,
): TooltipText | null {
  if (!fieldId) return null;
  const key = fieldId.toUpperCase();
  const perEntity = entityType ? ENTITY_TOOLTIPS[entityType]?.[key] : undefined;
  return perEntity ?? MODERN_JOBS_TOOLTIPS[key] ?? null;
}
