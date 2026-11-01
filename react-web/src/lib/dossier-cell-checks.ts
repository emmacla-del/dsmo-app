import { checkCoherence, type CoherenceFlag } from "./onefop-coherence";
import type { FormData } from "./onefop-schema";

/**
 * The cells behind a file's open findings, recomputed from the figures as
 * filed with the wizard's own checker (onefop-coherence.ts), so the review
 * tables can mark the figures that disagree and say what they are compared
 * with. Only what a stored finding reports is marked: the respondent-side
 * quiz hints (SCOPE_*) are not server rules, and a finding already explained
 * leaves « À vérifier » and its marks with it.
 *
 * The server's check is the authority; this is a reading aid. When a stored
 * finding's figures no longer disagree (a rule since corrected, S22Q03 before
 * 2026-11-01), the finding is reported as not found in the figures rather than
 * marked on cells that agree.
 *
 * The reverse also happens: a gap in the figures with no finding stored for
 * its rule, because the file was filed before the rule existed or was fixed.
 * Those are returned as `detected` (« Détecté à la relecture ») and marked too.
 * A rule a reviewer has already settled (explained) is never detected again.
 */

/** The checker's codes that restate a server rule (the server adds the contract to PP_S4Q05 / PP_S4Q06). */
const SERVER_RULES = [
  "S22Q03_DIPLOMA_MISMATCH",
  "S3_DISMISSAL_MISMATCH",
  "S22Q04_PERMANENT_EXCEEDS_TOTAL",
  "S22Q04_TEMPORARY_EXCEEDS_TOTAL",
  "S22Q05_PERMANENT_EXCEEDS_TOTAL",
  "S22Q05_TEMPORARY_EXCEEDS_TOTAL",
  "S23Q02_PERMANENT_EXCEEDS_TOTAL",
  "S23Q02_TEMPORARY_EXCEEDS_TOTAL",
  "PP_S4Q05",
  "PP_S4Q06",
  "PP_S4Q01_HEADCOUNT_MISMATCH",
  "PERMANENT_WORKERS_IMPLAUSIBLE",
  "VACANCIES_IMPLAUSIBLE",
] as const;

/** A stored rule code and a checker code name the same rule. */
export function sameRule(serverCode: string, checkerCode: string): boolean {
  return serverCode === checkerCode || serverCode.startsWith(`${checkerCode}_`);
}

/** Whether the checker restates this stored rule at all (VT rules, for one, it does not). */
export function ruleIsRecomputed(serverCode: string): boolean {
  return SERVER_RULES.some((code) => sameRule(serverCode, code));
}

export interface ReviewCellChecks {
  /** Every disagreement to mark: behind an open finding, or detected on review. */
  flags: CoherenceFlag[];
  /** Disagreements in the figures that no stored finding reports, one per rule and sex. */
  detected: CoherenceFlag[];
  /** Open findings the checker restates but does not find in the figures. */
  notFound: Set<string>;
}

export function reviewCellChecks(
  data: FormData | null | undefined,
  entityKey: string | null,
  openRuleCodes: string[],
  /** Rules with a stored finding already settled (explained) on this file. */
  settledRuleCodes: string[] = [],
): ReviewCellChecks {
  if (!data || !entityKey || entityKey === "vocationalTraining") return { flags: [], detected: [], notFound: new Set() };
  const recomputed = checkCoherence(data, entityKey).filter((flag) =>
    (SERVER_RULES as readonly string[]).includes(flag.code));
  const reported = recomputed.filter((flag) => openRuleCodes.some((code) => sameRule(code, flag.code)));
  const detected = recomputed.filter((flag) =>
    ![...openRuleCodes, ...settledRuleCodes].some((code) => sameRule(code, flag.code)));
  const notFound = new Set(openRuleCodes.filter((code) =>
    ruleIsRecomputed(code) && !recomputed.some((flag) => sameRule(code, flag.code))));
  return { flags: [...reported, ...detected], detected, notFound };
}
