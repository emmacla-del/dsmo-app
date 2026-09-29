// src/components/onefop/tables/resolveGuidedScope.ts

import type { FormData } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { SEX_COLUMN_LABELS } from "@/lib/onefop-tables";
import type {
  FixedMatrixDefinition,
} from "./StatisticalTableDefinition";
import type { ScopeState } from "@/components/modern-jobs/scope/ScopeTypes";

export interface GuidedQuestionBreakdown {
  key: string;
  label: string; // e.g. "Homme", "Femme"
  fieldKey: string;
  kind: "number" | "computed";
  min?: number;
}

export interface GuidedQuestionItem {
  id: string; // unique item id, e.g. "cadres_25_34"
  rowId: string;
  rowLabel: string;
  categoryTag?: string; // e.g. "Cadres"
  dimensionTag?: string; // e.g. "25–34 ans", "Démission"
  contractType?: "permanent" | "temporary" | "other";
  prompt: string; // Conversational prompt
  subPrompt: string; // Sub-breakdown prompt
  totalFieldKey?: string; // Materialized total cell key if exists
  breakdowns: GuidedQuestionBreakdown[];
  /** Free-text label asked with the count (dismissal reason, skill/training domain). */
  textField?: { fieldKey: string; label: string; placeholder: string };
  // Helper to read current values from data
  getCurrentBreakdowns: (data: FormData) => { label: string; fieldKey: string; value: number | null }[];
  getCurrentTotal: (data: FormData) => number;
}

export interface GuidedScopeResult {
  hasCustomScope: boolean;
  activeScopeTags: string[];
  questions: GuidedQuestionItem[];
  excludedCellKeys: string[];
}

/** Human-readable tag labels */
const CSP_TAG_LABELS: Record<string, { fr: string; en: string }> = {
  cadres: { fr: "Cadres", en: "Executives" },
  maitrise: { fr: "Agents de maîtrise", en: "Supervisors" },
  foremen: { fr: "Agents de maîtrise", en: "Supervisors" },
  execution: { fr: "Agents d'exécution", en: "Field workers" },
  workers: { fr: "Agents d'exécution", en: "Field workers" },
};

const AGE_TAG_LABELS: Record<string, { fr: string; en: string }> = {
  "15_24": { fr: "15–24 ans", en: "15–24 yrs" },
  "25_34": { fr: "25–34 ans", en: "25–34 yrs" },
  "35_plus": { fr: "35 ans et +", en: "35+ yrs" },
};

const DEPARTURE_TAG_LABELS: Record<string, { fr: string; en: string }> = {
  licenciement: { fr: "Licenciement", en: "Dismissal" },
  demission: { fr: "Démission", en: "Resignation" },
  retraite: { fr: "Retraite", en: "Retirement" },
  autre: { fr: "Autre motif", en: "Other motive" },
};

const INTERN_TAG_LABELS: Record<string, { fr: string; en: string }> = {
  vacance: { fr: "Stage de vacances", en: "Holiday internship" },
  academique: { fr: "Stage académique", en: "Academic internship" },
  professionnel: { fr: "Stage professionnel", en: "Professional internship" },
  preemploi: { fr: "Stage pré-emploi", en: "Pre-employment internship" },
};

/**
 * Derives active user-selected scope tags from _scopeConfig for display in the Guided header.
 */
export function getActiveScopeTags(
  definition: FixedMatrixDefinition,
  scopeConfig?: ScopeState,
  locale: "fr" | "en" = "fr"
): string[] {
  if (!scopeConfig) return [];
  const tags: string[] = [];
  const tid = definition.id.toLowerCase();

  // Recruitment / S21 / S22
  if (tid.includes("s21") || tid.includes("s22") || tid.includes("pp_s4q01") || tid.includes("pp_s4q02") || tid.includes("pp_s4q03")) {
    const csps = (tid.includes("s21q01") ? scopeConfig.application_csp : scopeConfig.recruit_csp) || [];
    csps.forEach((c) => {
      const label = CSP_TAG_LABELS[c]?.[locale];
      if (label && !tags.includes(label)) tags.push(label);
    });

    const ages = (tid.includes("s21q01") ? scopeConfig.application_age : scopeConfig.recruit_age) || [];
    ages.forEach((a) => {
      const label = AGE_TAG_LABELS[a]?.[locale];
      if (label && !tags.includes(label)) tags.push(label);
    });

    if (tid.includes("s22q01")) {
      tags.unshift(locale === "fr" ? "CDI / Permanents" : "Permanent / Open-ended");
    } else if (tid.includes("s22q02")) {
      tags.unshift(locale === "fr" ? "CDD / Temporaires" : "Temporary / Fixed-term");
    }
  }

  // Departures
  if (tid.includes("s3q01") || tid.includes("s3q02")) {
    const reasons = scopeConfig.departure_reasons || [];
    reasons.forEach((r) => {
      const label = DEPARTURE_TAG_LABELS[r]?.[locale];
      if (label && !tags.includes(label)) tags.push(label);
    });
  }

  // Internships
  if (tid.includes("s4q01")) {
    const internTypes = scopeConfig.intern_types || [];
    internTypes.forEach((t) => {
      const label = INTERN_TAG_LABELS[t]?.[locale];
      if (label && !tags.includes(label)) tags.push(label);
    });
  }

  return tags;
}

/**
 * Natural age phrase from an age-band column header ("15 à 24", "25 à 34",
 * "35 et +"), or null when the dimension is not an age band (e.g. a motive).
 */
function agePhrase(dimLabel: string | undefined, locale: "fr" | "en"): string | null {
  if (!dimLabel) return null;
  const d = dimLabel.replace(/\s+/g, " ").trim();
  if (/^15\b/.test(d)) return locale === "fr" ? "de moins de 25 ans" : "under 25";
  if (/^25\b/.test(d)) return locale === "fr" ? "de 25 à 34 ans" : "aged 25 to 34";
  if (/^35\b/.test(d)) return locale === "fr" ? "de 35 ans et plus" : "aged 35 and over";
  return null;
}

/** Administration civil-service category row labels (FR or EN). */
const ADMIN_CATEGORY_LABEL = /^(fonctionnaire|d[ée]cisionnaire|contractuel|civil servant|decision-maker|contractual)/i;

/** CSP labels are plain category names: "Cadres" → "de cadres", "Agents de Maîtrise" → "d'agents de maîtrise". */
function deGroup(rowLabel: string): string {
  const lower = rowLabel.toLocaleLowerCase("fr");
  return /^[aeiouhéèêàâîôûy]/i.test(lower) ? `d'${lower}` : `de ${lower}`;
}

/**
 * Builds a natural conversational question prompt based on table context and intersection dimensions.
 */
function getContractType(tableId: string): "permanent" | "temporary" | "other" {
  const tid = tableId.toLowerCase();
  if (tid.includes("s22q01") || tid.includes("permanent") || tid.includes("cdi")) {
    return "permanent";
  }
  if (tid.includes("s22q02") || tid.includes("temporaire") || tid.includes("cdd")) {
    return "temporary";
  }
  return "other";
}

/**
 * Builds a natural conversational question prompt based on table context and intersection dimensions.
 * Always names the specific group in full (never generic 'ces personnes').
 */
function buildConversationalPrompt(
  tableId: string,
  rowLabel: string,
  dimLabel?: string,
  locale: "fr" | "en" = "fr"
): { prompt: string; subPrompt: string; contractType: "permanent" | "temporary" | "other" } {
  const tid = tableId.toLowerCase();
  const contractType = getContractType(tid);

  // Administration Section 2 (S21Q01–S21Q04, chronological since
  // 2026-09-28). S21Q01 shares its id with the enterprise-family "demandes
  // d'emploi" table, so Administration's census is recognised by its
  // civil-service category rows. No contract wording: no status dimension.
  const adminVerb =
    tid === "s21q01" && ADMIN_CATEGORY_LABEL.test(rowLabel)
      ? { fr: "recensées", en: "count" }
      : /s21q0[234]/.test(tid)
        ? { fr: "recrutées", en: "recruit" }
        : null;
  if (adminVerb) {
    const age = agePhrase(dimLabel, locale);
    const who = tid.includes("s21q04")
      ? { fr: `personnes vulnérables (${rowLabel})`, en: `vulnerable people (${rowLabel})` }
      : tid.includes("s21q03")
        ? { fr: `personnes en situation de handicap de la catégorie « ${rowLabel} »`, en: `people with a disability in the “${rowLabel}” category` }
        : { fr: `personnes de la catégorie « ${rowLabel} »${age ? ` ${age}` : ""}`, en: `people in the “${rowLabel}” category${age ? ` ${age}` : ""}` };
    return {
      contractType: "other",
      prompt:
        locale === "fr"
          ? `Combien de ${who.fr} avez-vous ${adminVerb.fr} ?`
          : `How many ${who.en} did you ${adminVerb.en}?`,
      subPrompt: locale === "fr" ? `Parmi elles, combien de femmes ?` : `Of these, how many are women?`,
    };
  }

  // S21Q01: Demandes d'emploi
  if (tid.includes("s21q01") || tid.includes("pp_s4q01")) {
    const dimSuffix = dimLabel ? (locale === "fr" ? ` (${dimLabel})` : ` (${dimLabel})`) : "";
    const age = agePhrase(dimLabel, locale);
    const lower = rowLabel.toLocaleLowerCase(locale);
    return {
      contractType,
      prompt:
        locale === "fr"
          ? age
            ? `Combien de demandes d'emploi avez-vous reçues ${deGroup(rowLabel).replace(/^de |^d'/, (m) => (m === "de " ? "de la part de " : "de la part d'"))} ${age} au cours du trimestre ?`
            : `Combien de demandes d'emploi émanant de ${rowLabel}${dimSuffix} avez-vous reçues ?`
          : age
            ? `How many job applications did you receive from ${lower} ${age} this quarter?`
            : `How many job applications from ${rowLabel}${dimSuffix} did you receive?`,
      subPrompt:
        locale === "fr"
          ? `Parmi ces demandes de ${rowLabel}, combien émanent de femmes ?`
          : `Among these applications for ${rowLabel}, how many are from women?`,
    };
  }

  // S22Q01: Recrutements permanents (CDI)
  if (tid.includes("s22q01") || tid.includes("pp_s4q02")) {
    const dimSuffix = dimLabel ? (locale === "fr" ? ` (${dimLabel})` : ` (${dimLabel})`) : "";
    const age = agePhrase(dimLabel, locale);
    const lower = rowLabel.toLocaleLowerCase(locale);
    return {
      contractType: "permanent",
      prompt:
        locale === "fr"
          ? age
            ? `Combien ${deGroup(rowLabel)} ${age} avez-vous recrutés en CDI au cours du trimestre ?`
            : `Combien de ${rowLabel} permanents (CDI)${dimSuffix} avez-vous recrutés ?`
          : age
            ? `How many ${lower} ${age} did you recruit on permanent contracts (CDI) this quarter?`
            : `How many permanent ${rowLabel}${dimSuffix} did you recruit?`,
      subPrompt:
        locale === "fr"
          ? `Parmi les ${rowLabel} permanents recrutés, combien sont des femmes ?`
          : `Among recruited permanent ${rowLabel}, how many are women?`,
    };
  }

  // S22Q02: Recrutements temporaires (CDD)
  if (tid.includes("s22q02") || tid.includes("pp_s4q03")) {
    const dimSuffix = dimLabel ? (locale === "fr" ? ` (${dimLabel})` : ` (${dimLabel})`) : "";
    const age = agePhrase(dimLabel, locale);
    const lower = rowLabel.toLocaleLowerCase(locale);
    return {
      contractType: "temporary",
      prompt:
        locale === "fr"
          ? age
            ? `Combien ${deGroup(rowLabel)} ${age} avez-vous recrutés en CDD au cours du trimestre ?`
            : `Combien de ${rowLabel} temporaires (CDD)${dimSuffix} avez-vous recrutés ?`
          : age
            ? `How many ${lower} ${age} did you recruit on temporary contracts (CDD) this quarter?`
            : `How many temporary ${rowLabel}${dimSuffix} did you recruit?`,
      subPrompt:
        locale === "fr"
          ? `Parmi les ${rowLabel} temporaires recrutés, combien sont des femmes ?`
          : `Among recruited temporary ${rowLabel}, how many are women?`,
    };
  }

  // S22Q03: Recrutements par diplôme
  if (tid.includes("s22q03")) {
    const dimSuffix = dimLabel ? (locale === "fr" ? ` (${dimLabel})` : ` (${dimLabel})`) : "";
    return {
      contractType,
      prompt:
        locale === "fr"
          ? `Combien de personnes ayant le diplôme ${rowLabel}${dimSuffix} avez-vous recrutées ?`
          : `How many recruits with education level ${rowLabel}${dimSuffix} did you make?`,
      subPrompt:
        locale === "fr"
          ? `Parmi les titulaires de ${rowLabel} recrutés, combien sont des femmes ?`
          : `Among recruits with ${rowLabel}, how many are women?`,
    };
  }

  // S22Q04: Handicap
  if (tid.includes("s22q04")) {
    const dimSuffix = dimLabel ? ` (${dimLabel})` : "";
    return {
      contractType,
      prompt:
        locale === "fr"
          ? `Combien de personnes en situation de handicap avez-vous recrutées parmi les ${rowLabel}${dimSuffix} ?`
          : `How many persons with disabilities did you recruit among ${rowLabel}${dimSuffix}?`,
      subPrompt:
        locale === "fr"
          ? `Parmi ces travailleurs en situation de handicap (${rowLabel}), combien sont des femmes ?`
          : `Among these workers with disabilities (${rowLabel}), how many are women?`,
    };
  }

  // S3Q01: Départs
  if (tid.includes("s3q01")) {
    const motive = dimLabel ? (locale === "fr" ? ` (${dimLabel})` : ` (${dimLabel})`) : "";
    return {
      contractType,
      prompt:
        locale === "fr"
          ? `Combien de départs de ${rowLabel}${motive} ont été enregistrés ?`
          : `How many departures of ${rowLabel}${motive} were recorded?`,
      subPrompt:
        locale === "fr"
          ? `Parmi ces départs de ${rowLabel}, combien concernent des femmes ?`
          : `Among these departures of ${rowLabel}, how many are women?`,
    };
  }

  // S4Q01: Stages
  if (tid.includes("s4q01")) {
    return {
      contractType,
      prompt:
        locale === "fr"
          ? `Combien de stagiaires avez-vous accueillis au titre de : ${rowLabel} ?`
          : `How many interns did you host for: ${rowLabel}?`,
      subPrompt:
        locale === "fr"
          ? `Parmi les stagiaires (${rowLabel}), combien sont des femmes ?`
          : `Among these interns (${rowLabel}), how many are women?`,
    };
  }

  // S23Q02: Primo-insérés
  if (tid.includes("s23q02")) {
    const dimSuffix = dimLabel ? ` (${dimLabel})` : "";
    const age = agePhrase(dimLabel, locale);
    const lower = rowLabel.toLocaleLowerCase(locale);
    return {
      contractType,
      prompt:
        locale === "fr"
          ? age
            ? `Parmi les ${lower} ${age} recrutés, combien occupent leur premier emploi ?`
            : `Combien de primo-insérés (premier emploi) avez-vous embauchés parmi les ${rowLabel}${dimSuffix} ?`
          : age
            ? `Among the ${lower} ${age} you recruited, how many are in their first job?`
            : `How many first-time job entrants did you recruit among ${rowLabel}${dimSuffix}?`,
      subPrompt:
        locale === "fr"
          ? `Parmi ces primo-insérés (${rowLabel}), combien sont des femmes ?`
          : `Among these first-time entrants (${rowLabel}), how many are women?`,
    };
  }

  // S22Q05: Personnes vulnérables (rows = nature of vulnerability, dim = Permanent / Temporaire)
  if (tid.includes("s22q05")) {
    const isTemp = /tempor/i.test(dimLabel ?? "");
    const lower = rowLabel.toLocaleLowerCase(locale);
    return {
      contractType: isTemp ? "temporary" : "permanent",
      prompt:
        locale === "fr"
          ? `Parmi vos recrutements ${isTemp ? "temporaires (CDD)" : "permanents (CDI)"}, combien de personnes sont des ${lower} ?`
          : `Among your ${isTemp ? "temporary (CDD)" : "permanent (CDI)"} recruits, how many are ${lower} people?`,
      subPrompt:
        locale === "fr" ? `Parmi eux, combien de femmes ?` : `Of these, how many are women?`,
    };
  }

  // S3Q03: Licenciements et chômage technique (rows = CSP, dim = type)
  if (tid.includes("s3q03")) {
    const technical = /ch[oô]mage|technical/i.test(dimLabel ?? "");
    const lower = rowLabel.toLocaleLowerCase(locale);
    return {
      contractType,
      prompt:
        locale === "fr"
          ? technical
            ? `Combien ${deGroup(rowLabel)} avez-vous mis en chômage technique au cours du trimestre ?`
            : `Combien ${deGroup(rowLabel)} avez-vous licenciés au cours du trimestre ?`
          : technical
            ? `How many ${lower} did you place on technical unemployment this quarter?`
            : `How many ${lower} did you dismiss this quarter?`,
      subPrompt: locale === "fr" ? `Parmi eux, combien de femmes ?` : `Of these, how many are women?`,
    };
  }

  // S3Q02: Motifs de licenciement (rows = Motif 1..3, text typed by the respondent)
  if (tid.includes("s3q02")) {
    return {
      contractType,
      prompt:
        locale === "fr"
          ? `Combien de personnes avez-vous licenciées pour ce motif ?`
          : `How many people did you dismiss for this reason?`,
      subPrompt: locale === "fr" ? `Parmi elles, combien de femmes ?` : `Of these, how many are women?`,
    };
  }

  // S4Q02 / S4Q03: Besoins en compétences / en formation (rows = domain 1..3)
  if (tid.includes("s4q02") || tid.includes("s4q03")) {
    const training = tid.includes("s4q03");
    return {
      contractType,
      prompt:
        locale === "fr"
          ? training
            ? `Combien de membres de votre personnel ont besoin d'une formation dans ce domaine ?`
            : `Combien de personnes ayant cette compétence vous faudrait-il ?`
          : training
            ? `How many of your staff need training in this field?`
            : `How many people with this skill do you need?`,
      subPrompt: locale === "fr" ? `Parmi elles, combien de femmes ?` : `Of these, how many are women?`,
    };
  }

  // Generic fallback
  return {
    contractType,
    prompt:
      locale === "fr"
        ? `Combien de personnes pour ${rowLabel}${dimLabel ? " — " + dimLabel : ""} ?`
        : `How many persons for ${rowLabel}${dimLabel ? " — " + dimLabel : ""}?`,
    subPrompt:
      locale === "fr"
        ? `Parmi ces ${rowLabel}, combien sont des femmes ?`
        : `Among these ${rowLabel}, how many are women?`,
  };
}

/**
 * Resolves the structured question items for Guided Mode from a FixedMatrixDefinition.
 */
export function resolveGuidedScope(
  definition: FixedMatrixDefinition,
  data: FormData,
  locale: "fr" | "en" = "fr"
): GuidedScopeResult {
  const scopeConfig = data._scopeConfig as ScopeState | undefined;
  const editableRows = definition.rows.filter((r) => !r.isTotal && !r.isSubtotal);
  const activeScopeTags = getActiveScopeTags(definition, scopeConfig, locale);
  const questions: GuidedQuestionItem[] = [];

  // Analyze columns structure:
  // Are columns grouped by Gender (e.g. S21Q01, S22Q01, S22Q03)?
  // Or is Gender in the column itself (e.g. S4Q01, S3Q01)?
  const hasGenderHeaderGroups =
    definition.headerGroups &&
    definition.headerGroups.some((hg) => {
      const t = localized(hg.title, locale).toLowerCase();
      return (
        t.includes("homme") || t.includes("femme") ||
        t.includes("masculin") || t.includes("féminin") || t.includes("male") || t.includes("female")
      );
    });

  // Check for internship style: columns are "male", "female", "total"
  const isDirectGenderCols =
    definition.columns.some((c) => c.key === "male" || c.key.includes("masculin")) &&
    definition.columns.some((c) => c.key === "female" || c.key.includes("feminin"));

  // Check for departure style: header groups are motives, subcolumns are M/F/Total
  const hasMotiveHeaderGroups =
    !hasGenderHeaderGroups &&
    definition.headerGroups &&
    definition.headerGroups.length > 0;

  if (hasGenderHeaderGroups) {
    // Pattern: S21Q01, S22Q01, S22Q02, S22Q03, S23Q02
    // Header groups: Homme, Femme, Total
    // Subcolumns under each group are Age Bands (15–24, 25–34, 35+, Total)
    // We group questions by (Row × Subcolumn Age Band)
    const firstGroupCols = definition.columns.filter(
      (c) =>
        definition.headerGroups &&
        c.group &&
        localized(c.group, locale) === localized(definition.headerGroups[0].title, locale)
    );

    // Keep only non-total subcolumns
    const nonTotalSubCols = firstGroupCols.filter((c) => c.kind === "number");

    editableRows.forEach((row) => {
      const rowLbl = localized(row.label, locale);

      nonTotalSubCols.forEach((subCol) => {
        const subLbl = localized(subCol.header, locale);

        // Find the matching column for Masculin, Féminin, and Total for this subCol
        const maleCol = definition.columns.find((c) => {
          const g = c.group ? localized(c.group, locale).toLowerCase() : "";
          return (
            (g.includes("masculin") || g.includes("male") || g.includes("homme")) &&
            localized(c.header, locale) === subLbl
          );
        });

        const femaleCol = definition.columns.find((c) => {
          const g = c.group ? localized(c.group, locale).toLowerCase() : "";
          return (
            (g.includes("féminin") || g.includes("feminin") || g.includes("female") || g.includes("femme")) &&
            localized(c.header, locale) === subLbl
          );
        });

        const totalCol = definition.columns.find((c) => {
          const g = c.group ? localized(c.group, locale).toLowerCase() : "";
          return (
            (g.includes("total") || g.includes("ensemble")) &&
            localized(c.header, locale) === subLbl
          );
        });

        const breakdowns: GuidedQuestionBreakdown[] = [];
        if (maleCol && row.cells[maleCol.key]) {
          breakdowns.push({
            key: "male",
            label: localized(SEX_COLUMN_LABELS.male, locale),
            fieldKey: row.cells[maleCol.key].fieldKey,
            kind: row.cells[maleCol.key].kind as "number" | "computed",
            min: row.cells[maleCol.key].min,
          });
        }
        if (femaleCol && row.cells[femaleCol.key]) {
          breakdowns.push({
            key: "female",
            label: localized(SEX_COLUMN_LABELS.female, locale),
            fieldKey: row.cells[femaleCol.key].fieldKey,
            kind: row.cells[femaleCol.key].kind as "number" | "computed",
            min: row.cells[femaleCol.key].min,
          });
        }

        const totalCell = totalCol ? row.cells[totalCol.key] : undefined;
        const totalFieldKey = totalCell ? totalCell.fieldKey : undefined;

        const itemId = `${row.id}_${subCol.key}`;
        const { prompt, subPrompt, contractType } = buildConversationalPrompt(definition.id, rowLbl, subLbl, locale);

        questions.push({
          id: itemId,
          rowId: row.id,
          rowLabel: rowLbl,
          categoryTag: rowLbl,
          dimensionTag: subLbl,
          contractType,
          prompt,
          subPrompt,
          totalFieldKey,
          breakdowns,
          getCurrentBreakdowns: (curData) =>
            breakdowns.map((b) => ({
              label: b.label,
              fieldKey: b.fieldKey,
              value: curData[b.fieldKey] != null && curData[b.fieldKey] !== "" ? Number(curData[b.fieldKey]) : null,
            })),
          getCurrentTotal: (curData) => {
            if (totalFieldKey && curData[totalFieldKey] != null && curData[totalFieldKey] !== "") {
              return Number(curData[totalFieldKey]);
            }
            let sum = 0;
            breakdowns.forEach((b) => {
              const v = curData[b.fieldKey];
              if (v != null && v !== "") sum += Number(v);
            });
            return sum;
          },
        });
      });
    });
  } else if (hasMotiveHeaderGroups) {
    // Pattern: S3Q01 (Départs), S22Q04 (Handicap status)
    // Header groups are Motives/Status (Licenciement, Démission, Retraite, Autre)
    const validGroups = definition.headerGroups!.filter((hg) => {
      const t = localized(hg.title, locale).toLowerCase();
      return !t.includes("total") && !t.includes("ensemble");
    });

    editableRows.forEach((row) => {
      const rowLbl = localized(row.label, locale);

      validGroups.forEach((hg) => {
        const groupTitle = localized(hg.title, locale);
        const grpCols = definition.columns.filter(
          (c) => c.group && localized(c.group, locale) === groupTitle
        );

        const maleCol = grpCols.find((c) => {
          const h = localized(c.header, locale).toLowerCase();
          return h.includes("masculin") || h.includes("male") || h.includes("homme") || h === "m";
        });
        const femaleCol = grpCols.find((c) => {
          const h = localized(c.header, locale).toLowerCase();
          return h.includes("féminin") || h.includes("feminin") || h.includes("female") || h.includes("femme") || h === "f";
        });
        const totalCol = grpCols.find((c) => {
          const h = localized(c.header, locale).toLowerCase();
          return h.includes("total") || h.includes("ensemble");
        });

        const breakdowns: GuidedQuestionBreakdown[] = [];
        if (maleCol && row.cells[maleCol.key]) {
          breakdowns.push({
            key: "male",
            label: localized(SEX_COLUMN_LABELS.male, locale),
            fieldKey: row.cells[maleCol.key].fieldKey,
            kind: row.cells[maleCol.key].kind as "number" | "computed",
            min: row.cells[maleCol.key].min,
          });
        }
        if (femaleCol && row.cells[femaleCol.key]) {
          breakdowns.push({
            key: "female",
            label: localized(SEX_COLUMN_LABELS.female, locale),
            fieldKey: row.cells[femaleCol.key].fieldKey,
            kind: row.cells[femaleCol.key].kind as "number" | "computed",
            min: row.cells[femaleCol.key].min,
          });
        }

        const totalCell = totalCol ? row.cells[totalCol.key] : undefined;
        const totalFieldKey = totalCell ? totalCell.fieldKey : undefined;

        const itemId = `${row.id}_${hg.title.fr || groupTitle}`;
        const { prompt, subPrompt, contractType } = buildConversationalPrompt(definition.id, rowLbl, groupTitle, locale);

        questions.push({
          id: itemId,
          rowId: row.id,
          rowLabel: rowLbl,
          categoryTag: rowLbl,
          dimensionTag: groupTitle,
          contractType,
          prompt,
          subPrompt,
          totalFieldKey,
          breakdowns,
          getCurrentBreakdowns: (curData) =>
            breakdowns.map((b) => ({
              label: b.label,
              fieldKey: b.fieldKey,
              value: curData[b.fieldKey] != null && curData[b.fieldKey] !== "" ? Number(curData[b.fieldKey]) : null,
            })),
          getCurrentTotal: (curData) => {
            if (totalFieldKey && curData[totalFieldKey] != null && curData[totalFieldKey] !== "") {
              return Number(curData[totalFieldKey]);
            }
            let sum = 0;
            breakdowns.forEach((b) => {
              const v = curData[b.fieldKey];
              if (v != null && v !== "") sum += Number(v);
            });
            return sum;
          },
        });
      });
    });
  } else if (isDirectGenderCols) {
    // Pattern: S4Q01 (Stages)
    // Columns: male, female, total
    editableRows.forEach((row) => {
      const rowLbl = localized(row.label, locale);
      const maleCell = Object.values(row.cells).find((c) => c.key === "male" || c.fieldKey.endsWith("_male"));
      const femaleCell = Object.values(row.cells).find((c) => c.key === "female" || c.fieldKey.endsWith("_female"));
      const totalCell = Object.values(row.cells).find((c) => c.key === "total" || c.fieldKey.endsWith("_total"));

      const breakdowns: GuidedQuestionBreakdown[] = [];
      if (maleCell) {
        breakdowns.push({
          key: "male",
          label: localized(SEX_COLUMN_LABELS.male, locale),
          fieldKey: maleCell.fieldKey,
          kind: maleCell.kind as "number" | "computed",
          min: maleCell.min,
        });
      }
      if (femaleCell) {
        breakdowns.push({
          key: "female",
          label: localized(SEX_COLUMN_LABELS.female, locale),
          fieldKey: femaleCell.fieldKey,
          kind: femaleCell.kind as "number" | "computed",
          min: femaleCell.min,
        });
      }

      const totalFieldKey = totalCell ? totalCell.fieldKey : undefined;
      const itemId = row.id;
      const { prompt, subPrompt, contractType } = buildConversationalPrompt(definition.id, rowLbl, undefined, locale);

      const textField = row.labelText
        ? {
            fieldKey: row.labelText.fieldKey,
            label: localized(row.labelText.label, locale),
            placeholder: localized(row.labelText.placeholder, locale),
          }
        : undefined;

      questions.push({
        id: itemId,
        rowId: row.id,
        rowLabel: rowLbl,
        categoryTag: rowLbl,
        contractType,
        prompt,
        subPrompt,
        totalFieldKey,
        textField,
        breakdowns,
        getCurrentBreakdowns: (curData) =>
          breakdowns.map((b) => ({
            label: b.label,
            fieldKey: b.fieldKey,
            value: curData[b.fieldKey] != null && curData[b.fieldKey] !== "" ? Number(curData[b.fieldKey]) : null,
          })),
        getCurrentTotal: (curData) => {
          if (totalFieldKey && curData[totalFieldKey] != null && curData[totalFieldKey] !== "") {
            return Number(curData[totalFieldKey]);
          }
          let sum = 0;
          breakdowns.forEach((b) => {
            const v = curData[b.fieldKey];
            if (v != null && v !== "") sum += Number(v);
          });
          return sum;
        },
      });
    });
  } else {
    // Arbitrary fallback: Each editable column of each row becomes a targeted question
    editableRows.forEach((row) => {
      const rowLbl = localized(row.label, locale);
      const editableCols = definition.columns.filter((c) => c.kind === "number");

      editableCols.forEach((col) => {
        const colLbl = localized(col.header, locale);
        const cell = row.cells[col.key];
        if (!cell) return;

        const breakdowns: GuidedQuestionBreakdown[] = [
          {
            key: col.key,
            label: colLbl,
            fieldKey: cell.fieldKey,
            kind: cell.kind as "number" | "computed",
            min: cell.min,
          },
        ];

        const itemId = `${row.id}_${col.key}`;
        const { prompt, subPrompt, contractType } = buildConversationalPrompt(definition.id, rowLbl, colLbl, locale);

        questions.push({
          id: itemId,
          rowId: row.id,
          rowLabel: rowLbl,
          categoryTag: rowLbl,
          dimensionTag: colLbl,
          contractType,
          prompt,
          subPrompt,
          breakdowns,
          getCurrentBreakdowns: (curData) => [
            {
              label: colLbl,
              fieldKey: cell.fieldKey,
              value: curData[cell.fieldKey] != null && curData[cell.fieldKey] !== "" ? Number(curData[cell.fieldKey]) : null,
            },
          ],
          getCurrentTotal: (curData) => {
            const v = curData[cell.fieldKey];
            return v != null && v !== "" ? Number(v) : 0;
          },
        });
      });
    });
  }

  // Derive canonical excluded cell keys to safely zero-fill
  const activeFieldKeys = new Set<string>();
  questions.forEach((q) => {
    if (q.totalFieldKey) activeFieldKeys.add(q.totalFieldKey);
    q.breakdowns.forEach((b) => activeFieldKeys.add(b.fieldKey));
  });

  return {
    hasCustomScope: activeScopeTags.length > 0,
    activeScopeTags,
    questions,
    excludedCellKeys: [],
  };
}
