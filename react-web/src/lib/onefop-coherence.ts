// src/lib/onefop-coherence.ts
//
// Direct port of lib/screens/onefop/onefop_coherence_checker.dart's
// OnefopCoherenceChecker.check() — cross-question arithmetic sanity checks,
// bounded per the plan (§2.3): "Port ... as bounded business logic. Do not
// turn it into a general rules engine." Flags, never blocks — a live hint
// layer distinct from onefop-validation.ts's required-field summary, which
// does block submission. The authoritative copy that reaches a reviewer is
// still computed server-side at submit time (questionnaires.service.ts's
// checkCoherence(), stored on OnefopSubmission.flags) — this is a
// convenience hint for the person filling the form, nothing more.
//
// KNOWN DISCREPANCY (flagged per the plan's "flag, don't silently resolve"
// rule — not fixed here): the backend's checkCoherence() does NOT skip the
// S22Q03/S3 checks for `administration`, while this Flutter-sourced version
// does, with an explicit comment that administration lacks
// S22Q02/S22Q03/S3Q03 in its schema and would otherwise false-positive on
// every submission with recruitment data. This port follows Flutter's
// version because this module fills Flutter's exact role (a live,
// client-side hint) — but the backend's own authoritative check may still
// spuriously flag administration submissions server-side. That is a
// pre-existing backend inconsistency, independent of this migration, and is
// not silently patched here.
//
// Key alignment with the web grids (rules unchanged, approved by the product
// owner): S22Q03 totals are summed from the per-CSP tabs
// (`s22q03_<csp>_total_…`), and S23Q02 reads `<contract>_total_…` — the keys
// the web tables actually store. Previously S22Q03 read a key that was never
// written (so it fired whenever recruitment existed) and S23Q02 read a key
// that was never written (so it never fired).
//
// Presentation: each flag carries per-language text (no pre-joined
// "FR/ EN") with no question codes, plus the exact cells involved so the UI
// can mark them in their own tables (components/onefop/coherence/).
import type { FormData, LocalizedText } from "./onefop-schema";

/** One cell (or plain field) involved in an anomaly, and the table/field it lives in. */
export interface CoherenceCell {
  /** FormData key of the cell (e.g. "s22q01_total_female_total") or plain field id. */
  fieldKey: string;
  /** Schema field id of the table (e.g. "S22Q01") or of the plain field itself. */
  tableFieldId: string;
}

/**
 * A non-blocking arithmetic anomaly. Text is kept per language (never
 * pre-joined "FR/ EN") and never exposes question codes to respondents —
 * the UI picks the respondent's locale. `cells` lists every cell that
 * takes part in the comparison so each can be marked in its own table.
 */
export interface CoherenceFlag {
  code: string;
  /** Stable id for this specific anomaly (code + gender), used to dismiss it. */
  key: string;
  title: LocalizedText;
  message: LocalizedText;
  why: LocalizedText;
  /** Primary table/field the anomaly is reported on. */
  fieldId: string;
  cells: CoherenceCell[];
}

/** Respondent-facing names of the tables a coherence check can point to. */
export const COHERENCE_TABLE_LABELS: Record<string, LocalizedText> = {
  S22Q01: { fr: "Recrutements permanents", en: "Permanent recruitment" },
  S22Q02: { fr: "Recrutements temporaires", en: "Temporary recruitment" },
  S22Q03: { fr: "Recrutements par diplôme", en: "Recruitment by diploma" },
  S22Q04: { fr: "Personnes en situation de handicap", en: "People with disabilities" },
  S22Q05_ENTERPRISE: { fr: "Personnes vulnérables", en: "Vulnerable people" },
  S22Q05_OTHER: { fr: "Personnes vulnérables", en: "Vulnerable people" },
  S23Q02: { fr: "Primo-demandeurs recrutés", en: "First-time job seekers" },
  S3Q01: { fr: "Départs", en: "Departures" },
  S3Q02: { fr: "Motifs de licenciement", en: "Grounds for dismissal" },
  S3Q03: { fr: "Licenciements et chômage technique", en: "Dismissals and technical unemployment" },
};

/** Localized text for a flag field, in the respondent's language. */
export function coherenceText(text: LocalizedText, locale: "fr" | "en"): string {
  return text[locale];
}

function n(data: FormData, key: string): number {
  const v = data[key];
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") return Math.trunc(v);
  const parsed = parseInt(String(v), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

type Gender = "male" | "female" | "total";

/** CSP tabs of the web S22Q03 grid (table.csps in the schema). */
const DIPLOMA_CSPS = ["cadres", "foremen", "workers"] as const;

/** "3 femmes" / "1 woman" / "0 personne" — count + gender noun, correctly pluralised. */
function people(count: number, gender: Gender): LocalizedText {
  const fr = { male: ["homme", "hommes"], female: ["femme", "femmes"], total: ["personne", "personnes"] }[gender];
  const en = { male: ["man", "men"], female: ["woman", "women"], total: ["person", "people"] }[gender];
  return {
    fr: `${count} ${count > 1 ? fr[1] : fr[0]}`,
    en: `${count} ${count === 1 ? en[0] : en[1]}`,
  };
}

/** French past participle agreeing with the noun: recruté / recrutés / recrutée / recrutées. */
function recruitedFr(count: number, gender: Gender): string {
  const feminine = gender !== "male"; // "femme" and "personne" are feminine
  return `recruté${feminine ? "e" : ""}${count > 1 ? "s" : ""}`;
}

/** Plural gender noun for titles: "femmes" / "women". */
const GENDER_GROUP: Record<Gender, LocalizedText> = {
  male: { fr: "d'hommes", en: "of men" },
  female: { fr: "de femmes", en: "of women" },
  total: { fr: "", en: "" },
};

const WORKERS_FIELD_ID: Record<string, string> = {
  enterprise: "S1Q10",
  cooperative: "COOP_S1Q11",
  ctd: "CTD_S1Q09",
  ong: "ONG_S1Q10",
};
const VACANCIES_FIELD_ID: Record<string, string> = {
  enterprise: "S1Q11",
  cooperative: "COOP_S1Q12",
  ctd: "CTD_S1Q10",
  ong: "ONG_S1Q11",
};

/**
 * "X exceeds its total" family (S22Q04 / S22Q05 / S23Q02 vs S22Q01 / S22Q02).
 * Same arithmetic as before — only the wording and cell metadata are new.
 */
function subsetExceedsTotal(opts: {
  code: string;
  gender: Gender;
  contract: "permanent" | "temporary";
  subsetCount: number;
  totalCount: number;
  subsetName: LocalizedText; // e.g. "en situation de handicap"
  subsetGroup: LocalizedText; // e.g. "Les personnes en situation de handicap"
  subsetCell: CoherenceCell;
}): CoherenceFlag {
  const { code, gender, contract, subsetCount, totalCount, subsetName, subsetGroup, subsetCell } = opts;
  const totalTable = contract === "permanent" ? "S22Q01" : "S22Q02";
  const post = contract === "permanent" ? { fr: "poste permanent", en: "permanent post" } : { fr: "poste temporaire", en: "temporary post" };
  const totalName = contract === "permanent"
    ? { fr: "le total des recrutements permanents", en: "total permanent recruitment" }
    : { fr: "le total des recrutements temporaires", en: "total temporary recruitment" };
  const a = people(subsetCount, gender);
  const b = people(totalCount, gender);
  const group = GENDER_GROUP[gender];
  return {
    code,
    key: `${code}:${gender}`,
    title: {
      fr: `Vérifiez les recrutements ${group.fr}`.trim(),
      en: `Check the recruitment ${group.en}`.trim(),
    },
    message: {
      fr: `Vous avez indiqué ${a.fr} ${recruitedFr(subsetCount, gender)} ${subsetName.fr} (${post.fr}), mais ${b.fr} dans ${totalName.fr}.`,
      en: `You entered ${a.en} recruited ${subsetName.en} (${post.en}), but ${b.en} in ${totalName.en}.`,
    },
    why: {
      fr: `${subsetGroup.fr} font partie de ce total : l'un des deux chiffres est probablement à corriger.`,
      en: `${subsetGroup.en} are part of that total, so one of the two figures probably needs correcting.`,
    },
    fieldId: subsetCell.tableFieldId,
    cells: [subsetCell, { fieldKey: `${totalTable.toLowerCase()}_total_${gender}_total`, tableFieldId: totalTable }],
  };
}

// ── Quiz-scope consistency (recruitment) ─────────────────────────────────
// The preliminary quiz (EventFactInterview → data._scopeConfig) asks ONCE,
// for permanent and temporary recruitment together, which categories and age
// groups were recruited. Choosing one therefore means at least one recruit
// exists for it — but it may be in either table. So the check runs across the
// selected tables combined (never per table), and only once every in-scope
// cell of those tables has been answered, so it cannot fire mid-entry.
// Advisory like every flag here: dismissible, never blocks submission.
// Client-side hint only — the backend's checkCoherence() has no equivalent.

const SCOPE_CSP_ROWS: Record<string, { row: string; label: LocalizedText }> = {
  cadres: { row: "cadres", label: { fr: "Cadres", en: "Executives" } },
  maitrise: { row: "foremen", label: { fr: "Agents de maîtrise", en: "Supervisors / Foremen" } },
  execution: { row: "workers", label: { fr: "Agents d'exécution", en: "Field workers" } },
};
const SCOPE_AGE_LABELS: Record<string, LocalizedText> = {
  "15_24": { fr: "moins de 25 ans", en: "under 25" },
  "25_34": { fr: "25 à 34 ans", en: "25 to 34" },
  "35_plus": { fr: "35 ans et plus", en: "35 and over" },
};

interface RecruitScope {
  recruit?: boolean | null;
  recruit_types?: string[];
  recruit_csp?: string[];
  recruit_age?: string[];
}

function checkRecruitmentScope(data: FormData, entityType: string): CoherenceFlag[] {
  // Administration's recruitment table is by civil-service status
  // (fonctionnaire / décisionnaire / contractuelle), not by the quiz's
  // categories, and project/programme tables live under other codes and are
  // not covered by the quiz's recruitment questions — so neither is checked.
  if (entityType === "administration" || entityType === "projectProgram") return [];
  const scope = data._scopeConfig as RecruitScope | undefined;
  if (!scope || scope.recruit !== true) return [];
  const csps = (scope.recruit_csp ?? []).filter((c) => SCOPE_CSP_ROWS[c]);
  const ages = (scope.recruit_age ?? []).filter((a) => SCOPE_AGE_LABELS[a]);
  if (csps.length === 0 || ages.length === 0) return [];

  // Contract tables kept by the quiz (both exist for every entity checked here).
  const types = scope.recruit_types ?? [];
  const tables: { id: string; prefix: string; name: LocalizedText }[] = [];
  if (types.length === 0 || types.includes("permanent")) {
    tables.push({ id: "S22Q01", prefix: "s22q01", name: COHERENCE_TABLE_LABELS.S22Q01 });
  }
  if (types.includes("temporaire")) {
    tables.push({ id: "S22Q02", prefix: "s22q02", name: COHERENCE_TABLE_LABELS.S22Q02 });
  }
  if (tables.length === 0) return [];

  const filled = (k: string) => data[k] !== undefined && data[k] !== null && data[k] !== "";
  const cell = (prefix: string, row: string, age: string) =>
    n(data, `${prefix}_${row}_male_${age}`) + n(data, `${prefix}_${row}_female_${age}`);

  // Wait until every in-scope cell of every selected table is answered.
  const complete = tables.every((t) =>
    csps.every((c) =>
      ages.every((a) => {
        const row = SCOPE_CSP_ROWS[c].row;
        return filled(`${t.prefix}_${row}_male_${a}`) && filled(`${t.prefix}_${row}_female_${a}`);
      }),
    ),
  );
  if (!complete) return [];

  const tableTotal = (prefix: string) =>
    csps.reduce((s, c) => s + ages.reduce((s2, a) => s2 + cell(prefix, SCOPE_CSP_ROWS[c].row, a), 0), 0);
  const both = tables.length > 1;
  const where: LocalizedText = both
    ? { fr: "les recrutements permanents et temporaires", en: "permanent and temporary recruitment" }
    : { fr: tables[0].name.fr.toLowerCase(), en: tables[0].name.en.toLowerCase() };
  const fixHint: LocalizedText = {
    fr: "Corrigez les chiffres, ou modifiez votre réponse au quiz préalable si c'était une erreur.",
    en: "Correct the figures, or change your answer in the preliminary quiz if it was a mistake.",
  };

  const flags: CoherenceFlag[] = [];

  // 1. A contract type chosen in the quiz with no recruit at all.
  const zeroTables = tables.filter((t) => tableTotal(t.prefix) === 0);
  for (const t of zeroTables) {
    flags.push({
      code: "SCOPE_CONTRACT_ZERO",
      key: `SCOPE_CONTRACT_ZERO:${t.id}`,
      title: { fr: `Vérifiez : ${t.name.fr.toLowerCase()}`, en: `Check: ${t.name.en.toLowerCase()}` },
      message: {
        fr: `Au quiz préalable, vous avez indiqué des ${t.name.fr.toLowerCase()}, mais toutes les valeurs de ce tableau sont à 0.`,
        en: `In the preliminary quiz you indicated ${t.name.en.toLowerCase()}, but every value in this table is 0.`,
      },
      why: fixHint,
      fieldId: t.id,
      cells: csps.map((c) => ({ fieldKey: `${t.prefix}_${SCOPE_CSP_ROWS[c].row}_total_total`, tableFieldId: t.id })),
    });
  }
  // If every selected table is empty, the flag(s) above already say it all.
  if (zeroTables.length === tables.length) return flags;

  // 2. A category chosen in the quiz with no recruit across the selected tables.
  for (const c of csps) {
    const { row, label } = SCOPE_CSP_ROWS[c];
    const total = tables.reduce((s, t) => s + ages.reduce((s2, a) => s2 + cell(t.prefix, row, a), 0), 0);
    if (total > 0) continue;
    flags.push({
      code: "SCOPE_CSP_ZERO",
      key: `SCOPE_CSP_ZERO:${c}`,
      title: { fr: `Vérifiez les recrutements : ${label.fr}`, en: `Check recruitment: ${label.en}` },
      message: {
        fr: `Au quiz préalable, vous avez indiqué avoir recruté des ${label.fr.toLowerCase()}, mais aucun n'est déclaré dans ${where.fr}.`,
        en: `In the preliminary quiz you indicated recruiting ${label.en.toLowerCase()}, but none are declared in ${where.en}.`,
      },
      why: fixHint,
      fieldId: tables[0].id,
      cells: tables.map((t) => ({ fieldKey: `${t.prefix}_${row}_total_total`, tableFieldId: t.id })),
    });
  }

  // 3. An age group chosen in the quiz with no recruit across the selected tables.
  for (const a of ages) {
    const total = tables.reduce((s, t) => s + csps.reduce((s2, c) => s2 + cell(t.prefix, SCOPE_CSP_ROWS[c].row, a), 0), 0);
    if (total > 0) continue;
    const label = SCOPE_AGE_LABELS[a];
    flags.push({
      code: "SCOPE_AGE_ZERO",
      key: `SCOPE_AGE_ZERO:${a}`,
      title: { fr: `Vérifiez les recrutements : ${label.fr}`, en: `Check recruitment: ${label.en}` },
      message: {
        fr: `Au quiz préalable, vous avez indiqué avoir recruté des personnes de ${label.fr}, mais aucune n'est déclarée dans ${where.fr}.`,
        en: `In the preliminary quiz you indicated recruiting people ${label.en}, but none are declared in ${where.en}.`,
      },
      why: fixHint,
      fieldId: tables[0].id,
      cells: tables.map((t) => ({ fieldKey: `${t.prefix}_total_total_${a}`, tableFieldId: t.id })),
    });
  }

  return flags;
}

export function checkCoherence(data: FormData, entityType: string): CoherenceFlag[] {
  const flags: CoherenceFlag[] = [];
  const get = (key: string) => n(data, key);

  // administration has no S22Q02/S22Q03 in its schema — see onefop_ast.dart
  // — so skip this check for it (see file header).
  if (entityType !== "administration") {
    const byAge = {
      male: get("s22q01_total_male_total") + get("s22q02_total_male_total"),
      female: get("s22q01_total_female_total") + get("s22q02_total_female_total"),
      total: get("s22q01_total_total_total") + get("s22q02_total_total_total"),
    };
    // The web S22Q03 grid is split into one tab per CSP and stores each
    // tab's totals as `s22q03_<csp>_total_<g>_total` — there is no overall
    // `s22q03_total_…` key — so add the CSP totals up. The legacy overall key
    // (e.g. drafts from the Flutter client) is used only when no CSP total
    // exists at all.
    const diplomaTotal = (g: Gender) => {
      const perCsp = DIPLOMA_CSPS.map((csp) => data[`s22q03_${csp}_total_${g}_total`]);
      const hasPerCsp = perCsp.some((v) => v !== undefined && v !== null && v !== "");
      return hasPerCsp
        ? DIPLOMA_CSPS.reduce((sum, csp) => sum + get(`s22q03_${csp}_total_${g}_total`), 0)
        : get(`s22q03_total_${g}_total`);
    };
    const byDiploma = {
      male: diplomaTotal("male"),
      female: diplomaTotal("female"),
      total: diplomaTotal("total"),
    };
    for (const gender of ["male", "female", "total"] as const) {
      const a = byAge[gender];
      const b = byDiploma[gender];
      if (a !== b && (a > 0 || b > 0)) {
        const pa = people(a, gender);
        const pb = people(b, gender);
        flags.push({
          code: "S22Q03_DIPLOMA_MISMATCH",
          key: `S22Q03_DIPLOMA_MISMATCH:${gender}`,
          title: {
            fr: `Vérifiez la répartition par diplôme${gender === "total" ? "" : ` (${gender === "male" ? "hommes" : "femmes"})`}`,
            en: `Check the breakdown by diploma${gender === "total" ? "" : ` (${gender === "male" ? "men" : "women"})`}`,
          },
          message: {
            fr: `La répartition par diplôme compte ${pb.fr}, mais les recrutements permanents et temporaires en comptent ${pa.fr}.`,
            en: `The breakdown by diploma counts ${pb.en}, but permanent and temporary recruitment count ${pa.en}.`,
          },
          why: {
            fr: "Chaque personne recrutée doit apparaître une fois dans la répartition par diplôme : les deux totaux devraient être égaux.",
            en: "Each recruit should appear once in the breakdown by diploma, so the two totals should be equal.",
          },
          fieldId: "S22Q03",
          cells: [
            ...DIPLOMA_CSPS.map((csp) => ({ fieldKey: `s22q03_${csp}_total_${gender}_total`, tableFieldId: "S22Q03" })),
            { fieldKey: `s22q01_total_${gender}_total`, tableFieldId: "S22Q01" },
            { fieldKey: `s22q02_total_${gender}_total`, tableFieldId: "S22Q02" },
          ],
        });
      }
    }
  }

  // administration has no S3Q03 — see onefop_ast.dart — so skip for it too.
  if (entityType !== "administration") {
    for (const gender of ["male", "female"] as const) {
      const a = get(`s3q01_total_dismissal_${gender}`);
      const b = get(`s3q02_total_${gender}`);
      const c = get(`s3q03_total_dismissal_${gender}`);
      if (new Set([a, b, c]).size > 1 && (a > 0 || b > 0 || c > 0)) {
        const group = GENDER_GROUP[gender];
        flags.push({
          code: "S3_DISMISSAL_MISMATCH",
          key: `S3_DISMISSAL_MISMATCH:${gender}`,
          title: {
            fr: `Vérifiez les licenciements ${group.fr}`,
            en: `Check the dismissals ${group.en}`,
          },
          message: {
            fr: `Le nombre de licenciements n'est pas le même dans les trois tableaux : ${a} dans les départs, ${b} dans les motifs de licenciement et ${c} dans les licenciements et chômage technique.`,
            en: `The number of dismissals differs between the three tables: ${a} in departures, ${b} in grounds for dismissal and ${c} in dismissals and technical unemployment.`,
          },
          why: {
            fr: "Ces trois tableaux décrivent les mêmes licenciements : leurs totaux devraient être identiques.",
            en: "These three tables describe the same dismissals, so their totals should match.",
          },
          fieldId: "S3Q01",
          cells: [
            { fieldKey: `s3q01_total_dismissal_${gender}`, tableFieldId: "S3Q01" },
            { fieldKey: `s3q02_total_${gender}`, tableFieldId: "S3Q02" },
            { fieldKey: `s3q03_total_dismissal_${gender}`, tableFieldId: "S3Q03" },
          ],
        });
      }
    }
  }

  const vulnPrefix = entityType === "enterprise" ? "s22q05_ent" : "s22q05_oth";
  const vulnFieldId = entityType === "enterprise" ? "S22Q05_ENTERPRISE" : "S22Q05_OTHER";
  for (const gender of ["male", "female"] as const) {
    const permanentRecruits = get(`s22q01_total_${gender}_total`);
    const temporaryRecruits = get(`s22q02_total_${gender}_total`);

    const disabilityPermanent = get(`s22q04_total_permanent_${gender}`);
    const disabilityTemporary = get(`s22q04_total_temporary_${gender}`);
    const disability = {
      subsetName: { fr: "en situation de handicap", en: "with disabilities" },
      subsetGroup: { fr: "Les personnes en situation de handicap", en: "People with disabilities" },
    };
    if (disabilityPermanent > permanentRecruits) {
      flags.push(subsetExceedsTotal({
        code: "S22Q04_PERMANENT_EXCEEDS_TOTAL", gender, contract: "permanent",
        subsetCount: disabilityPermanent, totalCount: permanentRecruits, ...disability,
        subsetCell: { fieldKey: `s22q04_total_permanent_${gender}`, tableFieldId: "S22Q04" },
      }));
    }
    if (disabilityTemporary > temporaryRecruits) {
      flags.push(subsetExceedsTotal({
        code: "S22Q04_TEMPORARY_EXCEEDS_TOTAL", gender, contract: "temporary",
        subsetCount: disabilityTemporary, totalCount: temporaryRecruits, ...disability,
        subsetCell: { fieldKey: `s22q04_total_temporary_${gender}`, tableFieldId: "S22Q04" },
      }));
    }

    const vulnerablePermanent = get(`${vulnPrefix}_total_permanent_${gender}`);
    const vulnerableTemporary = get(`${vulnPrefix}_total_temporary_${gender}`);
    const vulnerable = {
      subsetName: { fr: "parmi les personnes vulnérables", en: "among vulnerable people" },
      subsetGroup: { fr: "Les personnes vulnérables", en: "Vulnerable people" },
    };
    if (vulnerablePermanent > permanentRecruits) {
      flags.push(subsetExceedsTotal({
        code: "S22Q05_PERMANENT_EXCEEDS_TOTAL", gender, contract: "permanent",
        subsetCount: vulnerablePermanent, totalCount: permanentRecruits, ...vulnerable,
        subsetCell: { fieldKey: `${vulnPrefix}_total_permanent_${gender}`, tableFieldId: vulnFieldId },
      }));
    }
    if (vulnerableTemporary > temporaryRecruits) {
      flags.push(subsetExceedsTotal({
        code: "S22Q05_TEMPORARY_EXCEEDS_TOTAL", gender, contract: "temporary",
        subsetCount: vulnerableTemporary, totalCount: temporaryRecruits, ...vulnerable,
        subsetCell: { fieldKey: `${vulnPrefix}_total_temporary_${gender}`, tableFieldId: vulnFieldId },
      }));
    }

    // S23Q02 "first-time workers recruited" is, by definition, a subset of
    // all recruits — can't recruit a first-time permanent worker without it
    // counting as a permanent recruit in S22Q01, same for temporary/S22Q02.
    // The web grid stores each contract's summary row as
    // `s23q02_<contract>_total_<g>_total` (see recalculateFirstTimeWorkers in
    // onefop-formulas.ts); the Flutter checker read `_subtotal_`, a key the
    // web grid never writes, so the check could never fire. Read the real
    // key, falling back to the legacy one for older drafts.
    const firstTime = (contract: "permanent" | "temporary") => {
      const key = `s23q02_${contract}_total_${gender}_total`;
      const v = data[key];
      return v !== undefined && v !== null && v !== ""
        ? get(key)
        : get(`s23q02_${contract}_subtotal_${gender}_total`);
    };
    const firstTimePermanent = firstTime("permanent");
    const firstTimeTemporary = firstTime("temporary");
    const firstTimeText = {
      subsetName: { fr: "parmi les primo-demandeurs", en: "among first-time job seekers" },
      subsetGroup: { fr: "Les primo-demandeurs", en: "First-time job seekers" },
    };
    if (firstTimePermanent > permanentRecruits) {
      flags.push(subsetExceedsTotal({
        code: "S23Q02_PERMANENT_EXCEEDS_TOTAL", gender, contract: "permanent",
        subsetCount: firstTimePermanent, totalCount: permanentRecruits, ...firstTimeText,
        subsetCell: { fieldKey: `s23q02_permanent_total_${gender}_total`, tableFieldId: "S23Q02" },
      }));
    }
    if (firstTimeTemporary > temporaryRecruits) {
      flags.push(subsetExceedsTotal({
        code: "S23Q02_TEMPORARY_EXCEEDS_TOTAL", gender, contract: "temporary",
        subsetCount: firstTimeTemporary, totalCount: temporaryRecruits, ...firstTimeText,
        subsetCell: { fieldKey: `s23q02_temporary_total_${gender}_total`, tableFieldId: "S23Q02" },
      }));
    }
  }

  // Headline sanity ceiling — catches a stray extra digit typo. Entity
  // types with no headline worker/vacancy field mapped here (vocational
  // training, projectProgram) resolve to n('') === 0, so this never fires
  // for them — matching Flutter's own comment on this section.
  const workersFieldId = WORKERS_FIELD_ID[entityType] ?? "";
  const vacanciesFieldId = VACANCIES_FIELD_ID[entityType] ?? "";
  const workers = get(workersFieldId);
  const vacancies = get(vacanciesFieldId);
  if (workers > 50000) {
    flags.push({
      code: "PERMANENT_WORKERS_IMPLAUSIBLE",
      key: "PERMANENT_WORKERS_IMPLAUSIBLE",
      title: { fr: "Vérifiez l'effectif permanent", en: "Check the permanent headcount" },
      message: {
        fr: `Vous avez déclaré ${workers} employés permanents, un chiffre inhabituellement élevé.`,
        en: `You declared ${workers} permanent employees, which is unusually high.`,
      },
      why: {
        fr: "Vérifiez qu'aucun chiffre n'a été saisi en trop.",
        en: "Make sure no extra digit was typed.",
      },
      fieldId: workersFieldId,
      cells: [{ fieldKey: workersFieldId, tableFieldId: workersFieldId }],
    });
  }
  if (vacancies > 50000) {
    flags.push({
      code: "VACANCIES_IMPLAUSIBLE",
      key: "VACANCIES_IMPLAUSIBLE",
      title: { fr: "Vérifiez le nombre de postes vacants", en: "Check the number of vacancies" },
      message: {
        fr: `Vous avez déclaré ${vacancies} postes vacants, un chiffre inhabituellement élevé.`,
        en: `You declared ${vacancies} vacancies, which is unusually high.`,
      },
      why: {
        fr: "Vérifiez qu'aucun chiffre n'a été saisi en trop.",
        en: "Make sure no extra digit was typed.",
      },
      fieldId: vacanciesFieldId,
      cells: [{ fieldKey: vacanciesFieldId, tableFieldId: vacanciesFieldId }],
    });
  }

  flags.push(...checkRecruitmentScope(data, entityType));

  return flags;
}
