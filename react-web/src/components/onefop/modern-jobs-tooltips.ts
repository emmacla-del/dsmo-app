/**
 * Contextual definitions and respondent-friendly explanations for the Modern Jobs Survey
 * (Administration, CTD, Coopérative, Entreprise, ONG, Projet/Programme).
 * Helps self-respondents understand survey classifications without jargon.
 */
export const MODERN_JOBS_TOOLTIPS: Record<string, { fr: string; en: string }> = {
  // General Concepts & Classifications
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

  // Cooperative types
  SCOOPS: {
    fr: "Société Coopérative Simplifiée : forme coopérative sans Conseil d'Administration, gérée par un Comité de Gestion.",
    en: "Simplified Cooperative: cooperative without a Board of Directors, run by a management committee.",
  },
  COOP_CA: {
    fr: "Société Coopérative avec Conseil d'Administration : régie par les règles OHADA avec un CA et une Direction Générale.",
    en: "Cooperative with Board of Directors: governed by OHADA standards with a formal board and general management.",
  },

  // Departures & Labor disruptions
  CHOMAGE_TECHNIQUE: {
    fr: "Suspension temporaire et collective du contrat de travail décidée par l'employeur (difficultés économiques, rupture d'approvisionnement), sans rupture de contrat.",
    en: "Temporary collective suspension of employment contracts decided by employer due to economic reasons, without termination.",
  },
  LICENCIEMENT_ECONOMIQUE: {
    fr: "Rupture de contrat consécutive à des difficultés économiques ou restructurations, non liée à la personne du salarié.",
    en: "Dismissal due to economic difficulties or restructuring, not related to employee misconduct.",
  },

  // Internships
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

  // Key Questions across questionnaires
  S0Q01: {
    fr: "Nom et prénom de la personne qui remplit ou certifie le présent questionnaire.",
    en: "Full name of the person filling out or certifying this questionnaire.",
  },
  S0Q02: {
    fr: "Fonction officielle au sein de la structure (ex: Directeur des Ressources Humaines, Secrétaire Général, Chef Comptable).",
    en: "Official job title within the organization (e.g. HR Director, Secretary General, Chief Accountant).",
  },
  S1Q01: {
    fr: "Régime juridique principal déclaré au registre de commerce ou décret de création.",
    en: "Main legal status registered in commercial registry or founding decree.",
  },
  S1Q10: {
    fr: "Effectif total des salariés sous contrat permanent (CDI ou statut de fonctionnaire) au dernier jour du trimestre.",
    en: "Total count of permanent staff (open-ended contract or civil servant status) on the last day of the quarter.",
  },
  S1Q11: {
    fr: "Nombre de postes ouverts et non pourvus au sein de l'organisation à la fin du trimestre.",
    en: "Number of open and unfilled positions in the organization at the end of the quarter.",
  },
  S2Q01: {
    fr: "Indiquez Oui uniquement si au moins un nouveau travailleur a été embauché au cours des 3 derniers mois.",
    en: "Select Yes only if at least one new worker was hired during the last 3 months.",
  },
  S3Q01: {
    fr: "Indiquez Oui uniquement si des employés ont quitté l'organisation (retraite, fin de contrat, démission, licenciement, décès).",
    en: "Select Yes only if employees left the organization (retirement, contract expiration, resignation, dismissal, death).",
  },
};

/**
 * Lookup helper that finds an appropriate tooltip for a field or concept key.
 */
export function getModernJobsTooltip(key: string): { fr: string; en: string } | null {
  if (!key) return null;
  const upper = key.toUpperCase();
  return MODERN_JOBS_TOOLTIPS[upper] ?? MODERN_JOBS_TOOLTIPS[key] ?? null;
}
