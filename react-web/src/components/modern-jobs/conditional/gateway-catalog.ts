import type { FormData, LocalizedText, OnefopField } from "@/lib/onefop-schema";

export type ResponseStatus = "REPORTED" | "NONE" | "NOT_APPLICABLE";

export interface GatewayCopy {
  /** Conversational yes/no question — never the statistical table title. */
  question: LocalizedText;
  /** Short hint: what “yes” means, and that the grid comes next. */
  hint: LocalizedText;
  /** Quiet instruction shown only after the respondent answers Yes. */
  followUp: LocalizedText;
}

/**
 * Respondent-facing gateway questions for Modern Jobs statistical tables.
 *
 * Keys are canonical paper codes (S21Q01, S22Q05, …), not table titles and
 * not `_RESPONSE_STATUS` admin labels. Field ids such as `S22Q05_ENTERPRISE`
 * resolve to the same copy; Project/Program tables (PP_S4Q01, …) are not
 * in this catalog and must not inherit another table’s paperCode.
 */
export const GATEWAY_CATALOG: Record<string, GatewayCopy> = {
  S21Q01: {
    question: {
      fr: "Avez-vous reçu des demandes d'emploi au cours de la période ?",
      en: "Did you receive job applications during this period?",
    },
    hint: {
      fr: "Candidatures spontanées ou réponses à vos offres. Si oui, vous indiquerez ensuite le nombre par catégorie, sexe et âge.",
      en: "Unsolicited applications or responses to your vacancies. If yes, you will then enter the numbers by category, sex and age.",
    },
    followUp: {
      fr: "Indiquez le nombre de demandes d'emploi reçues, par catégorie socioprofessionnelle, sexe et âge.",
      en: "Enter the number of job applications received, by occupational category, sex and age.",
    },
  },
  S22Q01: {
    question: {
      fr: "Avez-vous recruté du personnel permanent au cours de la période ?",
      en: "Did you recruit permanent staff during this period?",
    },
    hint: {
      fr: "Contrats à durée indéterminée ou équivalents. Si oui, vous saisirez ensuite les effectifs par catégorie, sexe et âge.",
      en: "Open-ended contracts or equivalent. If yes, you will then enter headcount by category, sex and age.",
    },
    followUp: {
      fr: "Indiquez les recrutements permanents par catégorie socioprofessionnelle, sexe et âge.",
      en: "Enter permanent recruitments by occupational category, sex and age.",
    },
  },
  S22Q02: {
    question: {
      fr: "Avez-vous recruté du personnel temporaire au cours de la période ?",
      en: "Did you recruit temporary staff during this period?",
    },
    hint: {
      fr: "Contrats à durée déterminée, saisonniers ou occasionnels. Si oui, vous saisirez ensuite les effectifs.",
      en: "Fixed-term, seasonal or casual contracts. If yes, you will then enter the figures.",
    },
    followUp: {
      fr: "Indiquez les recrutements temporaires par catégorie socioprofessionnelle, sexe et âge.",
      en: "Enter temporary recruitments by occupational category, sex and age.",
    },
  },
  S22Q03: {
    question: {
      fr: "Pouvez-vous déclarer les recrutements selon le niveau de diplôme ?",
      en: "Can you report recruitments by diploma / qualification level?",
    },
    hint: {
      fr: "Répondez oui si vous disposez de la répartition par diplôme. Sinon, choisissez néant.",
      en: "Answer yes if you can break recruitments down by diploma. Otherwise choose none.",
    },
    followUp: {
      fr: "Répartissez les personnes recrutées selon le diplôme, le sexe et l'âge.",
      en: "Break down recruited staff by diploma, sex and age.",
    },
  },
  S22Q04: {
    question: {
      fr: "Avez-vous recruté des personnes en situation de handicap au cours de la période ?",
      en: "Did you recruit persons with disabilities during this period?",
    },
    hint: {
      fr: "Si oui, vous indiquerez ensuite les effectifs par catégorie et type de contrat.",
      en: "If yes, you will then enter headcount by category and contract type.",
    },
    followUp: {
      fr: "Indiquez les recrutements de personnes en situation de handicap.",
      en: "Enter recruitments of persons with disabilities.",
    },
  },
  S22Q05: {
    question: {
      fr: "Avez-vous recruté des personnes vulnérables (déplacés internes, réfugiés, orphelins) ?",
      en: "Did you recruit vulnerable persons (internally displaced people, refugees, orphans)?",
    },
    hint: {
      fr: "Si aucun recrutement de ce type n'a eu lieu, choisissez néant — vous n'aurez pas à remplir le tableau.",
      en: "If no such recruitment took place, choose none — you will not have to complete the table.",
    },
    followUp: {
      fr: "Indiquez les recrutements de personnes vulnérables selon la nature de la vulnérabilité, le type de contrat et le sexe.",
      en: "Enter recruitments of vulnerable persons by nature of vulnerability, contract type and sex.",
    },
  },
  S23Q01: {
    question: {
      fr: "Avez-vous recruté des primo-demandeurs d'emploi (première recherche d'emploi) ?",
      en: "Did you recruit first-time job seekers (people looking for their first job)?",
    },
    hint: {
      fr: "Personnes sans emploi antérieur, en recherche de leur premier emploi.",
      en: "People with no prior job, looking for their first employment.",
    },
    followUp: {
      fr: "Indiquez les primo-demandeurs d'emploi recrutés, par catégorie, sexe et âge.",
      en: "Enter first-time job seekers recruited, by category, sex and age.",
    },
  },
  S23Q02: {
    question: {
      fr: "Avez-vous recruté des primo-travailleurs (sans expérience professionnelle préalable) ?",
      en: "Did you recruit first-time workers (with no prior work experience)?",
    },
    hint: {
      fr: "Personnes insérées pour la première fois, quel que soit le type de contrat.",
      en: "People entering work for the first time, regardless of contract type.",
    },
    followUp: {
      fr: "Indiquez les primo-travailleurs insérés, par type de contrat et catégorie.",
      en: "Enter first-time workers placed, by contract type and category.",
    },
  },
  S3Q01: {
    question: {
      fr: "Avez-vous enregistré des départs de personnel au cours de la période ?",
      en: "Did you record any staff departures during this period?",
    },
    hint: {
      fr: "Démissions, retraites, licenciements ou autres motifs de sortie.",
      en: "Resignations, retirements, dismissals or other reasons for leaving.",
    },
    followUp: {
      fr: "Indiquez les départs par motif, catégorie et sexe.",
      en: "Enter departures by reason, category and sex.",
    },
  },
  S3Q02: {
    question: {
      fr: "Avez-vous procédé à des licenciements dont vous pouvez indiquer les motifs ?",
      en: "Did you carry out dismissals whose grounds you can report?",
    },
    hint: {
      fr: "Si oui, vous indiquerez les trois principaux motifs. Si aucun licenciement, choisissez néant.",
      en: "If yes, you will enter the three main grounds. If there were no dismissals, choose none.",
    },
    followUp: {
      fr: "Précisez les principaux motifs de licenciement et les effectifs concernés.",
      en: "Give the main grounds for dismissal and the staff numbers concerned.",
    },
  },
  S3Q03: {
    question: {
      fr: "Avez-vous procédé à des licenciements ou à des mises en chômage technique ?",
      en: "Did you carry out dismissals or place staff on technical unemployment?",
    },
    hint: {
      fr: "Si aucun cas, choisissez néant. Le tableau de répartition n'apparaîtra pas.",
      en: "If none, choose none. The breakdown table will not appear.",
    },
    followUp: {
      fr: "Indiquez les licenciements et mises en chômage technique par catégorie et sexe.",
      en: "Enter dismissals and technical unemployment by category and sex.",
    },
  },
  S4Q01: {
    question: {
      fr: "Avez-vous accueilli des stagiaires au cours de la période ?",
      en: "Did you host any interns during this period?",
    },
    hint: {
      fr: "Stages de vacances, académiques, professionnels ou pré-emploi.",
      en: "Vacation, academic, professional or pre-employment internships.",
    },
    followUp: {
      fr: "Indiquez les stagiaires accueillis, par type de stage et par sexe.",
      en: "Enter interns hosted, by internship type and sex.",
    },
  },
  S4Q02: {
    question: {
      fr: "Votre établissement a-t-il identifié des compétences prioritaires à pourvoir ?",
      en: "Has your establishment identified priority skills it needs to fill?",
    },
    hint: {
      fr: "Métiers ou domaines que vous cherchez à recruter en priorité. Si aucun, choisissez néant.",
      en: "Occupations or domains you need to recruit as a priority. If none, choose none.",
    },
    followUp: {
      fr: "Indiquez jusqu'à trois compétences prioritaires et les effectifs recherchés.",
      en: "Enter up to three priority skills and the numbers sought.",
    },
  },
  S4Q03: {
    question: {
      fr: "Avez-vous des besoins prioritaires en formation professionnelle continue ?",
      en: "Do you have priority needs for continuing vocational training?",
    },
    hint: {
      fr: "Formations que vous souhaitez organiser ou dont votre personnel a besoin.",
      en: "Training you want to organise or that your staff need.",
    },
    followUp: {
      fr: "Indiquez jusqu'à trois domaines de formation prioritaire et les effectifs concernés.",
      en: "Enter up to three priority training domains and the staff numbers concerned.",
    },
  },
};

export const S21Q01_ADMIN_GATEWAY_COPY: GatewayCopy = {
  question: {
    fr: "Avez-vous recensé du personnel au cours de la période ?",
    en: "Did you count staff during this period?",
  },
  hint: {
    fr: "Si oui, vous indiquerez ensuite les effectifs selon la catégorie (fonctionnaire, décisionnaire, contractuelle), le sexe et la tranche d'âge.",
    en: "If yes, you will then enter headcount by category (civil servant, decision-maker, contractual), sex and age group.",
  },
  followUp: {
    fr: "Indiquez les effectifs recensés selon la catégorie socioprofessionnelle, le sexe et la tranche d'âge.",
    en: "Enter headcount counted by socio-professional category, sex and age group.",
  },
};

/**
 * Administration Section 2 after the 2026-09-28 chronological renumbering
 * (S21Q02 recrutements, S21Q03 handicap, S21Q04 vulnérables). These ids are
 * Administration-only, so they need no entity check. No permanent/temporary
 * wording: Administration tables carry no status dimension.
 */
Object.assign(GATEWAY_CATALOG, {
  S21Q02: {
    question: {
      fr: "Avez-vous recruté du personnel au cours de la période ?",
      en: "Did you recruit staff during this period?",
    },
    hint: {
      fr: "Si oui, vous indiquerez ensuite les recrutements selon la catégorie (fonctionnaire, décisionnaire, contractuelle), le sexe et la tranche d'âge.",
      en: "If yes, you will then enter recruitments by category (civil servant, decision-maker, contractual), sex and age group.",
    },
    followUp: {
      fr: "Indiquez les recrutements selon la catégorie socioprofessionnelle, le sexe et la tranche d'âge.",
      en: "Enter recruitments by socio-professional category, sex and age group.",
    },
  },
  S21Q03: {
    question: {
      fr: "Avez-vous recruté des personnes en situation de handicap au cours de la période ?",
      en: "Did you recruit persons with disabilities during this period?",
    },
    hint: {
      fr: "Si oui, vous indiquerez ensuite les effectifs selon la catégorie socioprofessionnelle et le sexe.",
      en: "If yes, you will then enter headcount by socio-professional category and sex.",
    },
    followUp: {
      fr: "Indiquez les recrutements de personnes en situation de handicap selon la catégorie et le sexe.",
      en: "Enter recruitments of persons with disabilities by category and sex.",
    },
  },
  S21Q04: {
    question: {
      fr: "Avez-vous recruté des personnes vulnérables (déplacés internes, réfugiés, orphelins) ?",
      en: "Did you recruit vulnerable persons (internally displaced people, refugees, orphans)?",
    },
    hint: {
      fr: "Si aucun recrutement de ce type n'a eu lieu, choisissez néant — vous n'aurez pas à remplir le tableau.",
      en: "If no such recruitment took place, choose none — you will not have to complete the table.",
    },
    followUp: {
      fr: "Indiquez les recrutements de personnes vulnérables selon la nature de la vulnérabilité et le sexe.",
      en: "Enter recruitments of vulnerable persons by nature of vulnerability and sex.",
    },
  },
} satisfies Record<string, GatewayCopy>);

/** Strip entity suffixes so S22Q05_ENTERPRISE and S22Q05_OTHER share copy. */
export function canonicalGatewayId(fieldId: string): string {
  return fieldId.replace(/_ENTERPRISE$|_OTHER$/i, "").toUpperCase();
}

/**
 * Resolve catalog copy from the table field.
 * Do not fall back to paperCode — Project/Program tables reuse paper codes
 * such as S4Q01 without having a `_RESPONSE_STATUS` gateway.
 */
export function getGatewayCopy(
  field: Pick<OnefopField, "id"> & Partial<Pick<OnefopField, "table">>,
): GatewayCopy | null {
  const id = canonicalGatewayId(field.id);
  if (id === "S21Q01") {
    const isAdministration =
      field.table?.rowKeys?.includes("fonctionnaire") ||
      field.table?.id?.toLowerCase().includes("admin");
    if (isAdministration) {
      return S21Q01_ADMIN_GATEWAY_COPY;
    }
  }
  return GATEWAY_CATALOG[id] ?? null;
}

export function tableHasGateway(
  field: Pick<OnefopField, "id" | "type"> & Partial<Pick<OnefopField, "table">>,
): boolean {
  if (field.type !== "table" && field.type !== "repeating_table") return false;
  return getGatewayCopy(field) != null;
}

export function resolveTableStatusFieldId(field: OnefopField, data: FormData): string {
  const candidates = [
    `${field.id}_RESPONSE_STATUS`,
    `${field.id.toUpperCase()}_RESPONSE_STATUS`,
    `${field.id.toLowerCase()}_RESPONSE_STATUS`,
  ];

  if (field.paperCode) {
    candidates.push(
      `${field.paperCode}_RESPONSE_STATUS`,
      `${field.paperCode.toUpperCase()}_RESPONSE_STATUS`,
    );
  }

  const cleanId = canonicalGatewayId(field.id);
  candidates.push(`${cleanId}_RESPONSE_STATUS`, `${cleanId.toLowerCase()}_RESPONSE_STATUS`);

  for (const key of candidates) {
    if (key in data) return key;
  }

  if (field.paperCode && cleanId.startsWith("PP_")) {
    return `${field.paperCode.toUpperCase()}_RESPONSE_STATUS`;
  }

  return `${cleanId}_RESPONSE_STATUS`;
}

/**
 * Text/number companions of a gated table (dismissal reasons, skill domains)
 * must stay hidden — and unvalidated — until the respondent answers Yes.
 */
export function isCompanionHiddenByGateway(
  field: OnefopField,
  data: FormData,
  sectionFields: OnefopField[],
): boolean {
  if (field.type === "table" || field.type === "repeating_table") return false;
  if (field.id.endsWith("_RESPONSE_STATUS")) return false;

  const paper = field.paperCode?.toUpperCase();
  if (!paper) return false;

  const table = sectionFields.find(
    (f) =>
      tableHasGateway(f) &&
      (f.paperCode?.toUpperCase() === paper || canonicalGatewayId(f.id) === paper),
  );
  if (!table) return false;

  const statusId = resolveTableStatusFieldId(table, data);
  return data[statusId] !== "REPORTED";
}
