export type PrimaryQuestionId =
  | "applications"
  | "recruitment"
  | "primo_seekers"
  | "primo_workers"
  | "departures"
  | "interns"
  | "skills"
  | "training";

export type ChildBeatId =
  | "application_csp"
  | "application_age"
  | "recruit_types"
  | "recruit_csp"
  | "recruit_age"
  | "recruit_diploma"
  | "recruit_disability"
  | "recruit_vulnerable"
  | "primo_seekers_csp"
  | "primo_seekers_age"
  | "primo_workers_types"
  | "primo_workers_csp"
  | "primo_workers_age"
  | "departure_reasons"
  | "dismissal_technical"
  | "intern_types";

export interface BeatDefinition {
  mainId: PrimaryQuestionId;
  childBeatId?: ChildBeatId;
}

export type TrackerColumnKey =
  | "fait"
  | "reponse"
  | "typesMotifs"
  | "personnels"
  | "ages"
  | "diplomes"
  | "autre";

export interface TrackerChipItem {
  label: string;
  tooltip?: string;
}

export interface TrackerRow {
  mainId: PrimaryQuestionId;
  title: string;
  reponse: "Oui" | "Non" | null;
  typesMotifs?: (string | TrackerChipItem)[];
  personnels?: (string | TrackerChipItem)[];
  ages?: (string | TrackerChipItem)[];
  diplomes?: (string | TrackerChipItem)[];
  autre?: (string | TrackerChipItem)[];
  // Mapping of column key to child beat id (if clicking that cell should jump to that child beat)
  cellBeats?: Partial<Record<TrackerColumnKey, ChildBeatId>>;
}

export interface ScopeState {
  applications: boolean | null;
  application_csp: string[];   // "cadres", "maitrise", "execution"
  application_age: string[];   // "15_24", "25_34", "35_plus"
  recruit: boolean | null;
  recruit_types: string[]; // "permanent", "temporaire"
  recruit_csp: string[];   // "cadres", "maitrise", "execution"
  recruit_age: string[];   // "15_24", "25_34", "35_plus"
  recruit_diploma: string[];
  disability: boolean | null;
  vulnerable: boolean | null;
  primo_seekers: boolean | null;
  primo_seekers_csp: string[]; // "cadres", "maitrise", "execution"
  primo_seekers_age: string[]; // "15_24", "25_34", "35_plus"
  primo_workers: boolean | null;
  primo_workers_types: string[]; // "permanent", "temporaire"
  primo_workers_csp: string[];   // "cadres", "maitrise", "execution"
  primo_workers_age: string[];   // "15_24", "25_34", "35_plus"
  departures: boolean | null;
  departure_reasons: string[]; // "licenciement", "demission", "retraite", "autre"
  dismissal_technical: boolean | null;
  interns: boolean | null;
  intern_types: string[]; // "vacance", "academique", "professionnel", "preemploi"
  skills_needs: boolean | null;
  training_needs: boolean | null;
}

export const DEFAULT_SCOPE: ScopeState = {
  applications: null,
  application_csp: [],
  application_age: [],
  recruit: null,
  recruit_types: [],
  recruit_csp: [],
  recruit_age: [],
  recruit_diploma: [],
  disability: null,
  vulnerable: null,
  primo_seekers: null,
  primo_seekers_csp: [],
  primo_seekers_age: [],
  primo_workers: null,
  primo_workers_types: [],
  primo_workers_csp: [],
  primo_workers_age: [],
  departures: null,
  departure_reasons: [],
  dismissal_technical: null,
  interns: null,
  intern_types: [],
  skills_needs: null,
  training_needs: null,
};

export interface FilterOption {
  id: string;
  fr: string;
  en: string;
  shortFr?: string;
  shortEn?: string;
}

export const CSP_OPTIONS: FilterOption[] = [
  { id: "cadres", fr: "Cadres", shortFr: "Cadres", en: "Executives", shortEn: "Executives" },
  { id: "maitrise", fr: "Agents de maîtrise", shortFr: "Maîtrise", en: "Supervisors / Foremen", shortEn: "Supervisors" },
  { id: "execution", fr: "Agents d'exécution", shortFr: "Exécution", en: "Field workers", shortEn: "Workers" },
];

export const AGE_BAND_OPTIONS: FilterOption[] = [
  { id: "15_24", fr: "Moins de 25 ans (15–24 ans)", shortFr: "< 25 ans", en: "Under 25 (15–24 years)", shortEn: "< 25 yrs" },
  { id: "25_34", fr: "25 à 34 ans", shortFr: "25–34 ans", en: "25 to 34 years", shortEn: "25–34 yrs" },
  { id: "35_plus", fr: "35 ans et +", shortFr: "35+ ans", en: "35 years and over", shortEn: "35+ yrs" },
];

export const DIPLOMA_OPTIONS: FilterOption[] = [
  { id: "cep", fr: "CEP / CEPE / FSLC", shortFr: "CEP", en: "CEP / CEPE / FSLC", shortEn: "CEP" },
  { id: "bepc", fr: "BEPC / CAP / GCE-OL", shortFr: "BEPC / CAP", en: "BEPC / CAP / GCE-OL", shortEn: "BEPC / CAP" },
  { id: "probatoire", fr: "Probatoire", shortFr: "Probatoire", en: "Lower sixth", shortEn: "Lower 6th" },
  { id: "bac", fr: "BAC / GCE-AL", shortFr: "BAC / GCE-A", en: "BAC / GCE-AL", shortEn: "BAC / GCE-A" },
  { id: "bts", fr: "BTS / DUT / HND", shortFr: "BTS / DUT", en: "BTS / DUT / HND", shortEn: "BTS / DUT" },
  { id: "licence", fr: "Licence (Bac+3)", shortFr: "Licence", en: "Bachelor", shortEn: "Bachelor" },
  { id: "maitrise", fr: "Maîtrise (Bac+4)", shortFr: "Maîtrise", en: "Master 1", shortEn: "Master 1" },
  { id: "master", fr: "Master (Bac+5)", shortFr: "Master", en: "Master 2", shortEn: "Master 2" },
  { id: "dqp", fr: "DQP / PQD", shortFr: "DQP", en: "DQP / PQD", shortEn: "DQP" },
  { id: "cqp", fr: "CQP / CPQ", shortFr: "CQP", en: "CQP / CPQ", shortEn: "CQP" },
  { id: "autres", fr: "Autres", shortFr: "Autres", en: "Others", shortEn: "Others" },
  { id: "sans_diplome", fr: "Sans diplôme", shortFr: "Sans diplôme", en: "Without diploma", shortEn: "No diploma" },
];

export const DEPARTURE_REASON_OPTIONS: FilterOption[] = [
  { id: "licenciement", fr: "Licenciements", shortFr: "Licenciements", en: "Dismissal", shortEn: "Dismissal" },
  { id: "demission", fr: "Démissions", shortFr: "Démissions", en: "Resignation", shortEn: "Resignation" },
  { id: "retraite", fr: "Départ à la retraite", shortFr: "Retraite", en: "Retirement", shortEn: "Retirement" },
  { id: "autre", fr: "Autres départs", shortFr: "Autres", en: "Other departures", shortEn: "Others" },
];

export const INTERNSHIP_TYPE_OPTIONS: FilterOption[] = [
  { id: "vacance", fr: "Stage de vacance", shortFr: "Vacance", en: "Holiday internship", shortEn: "Holiday" },
  { id: "academique", fr: "Stage académique", shortFr: "Académique", en: "Academic internship", shortEn: "Academic" },
  { id: "professionnel", fr: "Stage professionnel", shortFr: "Professionnel", en: "Professional internship", shortEn: "Professional" },
  { id: "preemploi", fr: "Stage pré-emploi", shortFr: "Pré-emploi", en: "Pre-employment internship", shortEn: "Pre-employment" },
];

export const RECRUITMENT_TYPE_OPTIONS: FilterOption[] = [
  { id: "permanent", fr: "Permanents", shortFr: "Permanents", en: "Permanent", shortEn: "Permanent" },
  { id: "temporaire", fr: "Temporaires", shortFr: "Temporaires", en: "Temporary", shortEn: "Temporary" },
];

/** @deprecated Removed to follow official forms strictly; retained as empty stub for dev cache safety */
export const COOP_APPLICATION_NATURE_OPTIONS: Array<{ id: string; fr: string; en: string }> = [];
