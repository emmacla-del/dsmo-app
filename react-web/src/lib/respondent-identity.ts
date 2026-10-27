import type { ActiveQuarter } from "./onefop-submission";
import { entityTypeDisplayName, referencePeriodLabel, referencePeriodPhrases } from "./onefop-period-label";
import { parseCompanyEntityType } from "./register-constants";
import { hasRealNiu } from "./companies-directory";
import { formatCampaignDisplayName } from "./campaigns";

type Locale = "fr" | "en";

/**
 * The respondent's own structure type in words ("Centre de formation
 * professionnelle"), from Company.entityType. Null when the type is unknown,
 * so the caller can fall back to the role label rather than guess.
 */
export function respondentTypeLabel(entityType: string | null | undefined, locale: Locale): string | null {
  const key = parseCompanyEntityType(entityType);
  return key ? entityTypeDisplayName(key, locale) : null;
}

/**
 * The current campaign in words, "Campagne du 4e trimestre 2026", never the
 * stored code nor the survey's all-caps official title (which names one
 * questionnaire and misreads for another type of respondent). Falls back to
 * the server's label made readable, then to null.
 */
export function campaignPhrase(quarter: ActiveQuarter | null | undefined, locale: Locale): string | null {
  if (!quarter) return null;
  const phrase = referencePeriodPhrases(quarter.code, locale)?.campaign;
  if (phrase) return phrase;
  if (quarter.label) return formatCampaignDisplayName(quarter.label);
  return quarter.code ? referencePeriodLabel(quarter.code, locale) : null;
}

/** VOCATIONAL_TRAINING (API) or vocationalTraining (schema). */
export function isTrainingCentre(entityType: string | null | undefined): boolean {
  return (entityType ?? "").replace(/_/g, "").toLowerCase() === "vocationaltraining";
}

/**
 * The taxpayer number to show the respondent, or null when there is none.
 *
 * Registration asks for a NIU from enterprises, cooperatives, CTDs, NGOs and
 * training centres only (ENTITY_CONFIGS in register-constants.ts): an
 * administration and a project/programme do not declare one. Company.taxNumber
 * is nullable now; legacy accounts may carry a synthetic `NA-<uuid>` from
 * AuthService. It is an internal identifier, not a number the
 * respondent could recognise, and §8 keeps technical codes off their screens —
 * a project respondent was shown « NIU : NA-6ff0ebd0-4f9f-… » (E2E
 * 2026-10-17, B6). Every admin screen already hides it; this is the same rule
 * for the respondent's own.
 */
export function respondentNiu(taxNumber: string | null | undefined): string | null {
  return hasRealNiu(taxNumber) ? taxNumber!.trim() : null;
}

/**
 * The workforce figure to show the respondent, or null when the platform
 * holds none to show.
 *
 * Company.totalEmployees is the headcount of the DSMO company profile
 * (CreateCompanyDto.totalEmployees). ONEFOP registration never asks for it
 * and no ONEFOP path writes it, so an ONEFOP account's row is created at 0
 * and stays there: after declaring 12 permanent workers, the respondent's
 * home still read « 0 déclarés » (E2E 2026-10-17, B6), which reads as a lost
 * declaration. The column is NOT NULL, so a stored 0 cannot be told from
 * "never asked", and §9 forbids presenting an unanswered value as an answer —
 * only a figure someone actually entered is shown.
 *
 * The headcount a respondent declares in an ONEFOP file belongs to that
 * file's reference period and is read there, not in an identity strip.
 *
 * A training centre declares trainees and trainers, not employees, so it has
 * no figure here at all.
 */
export function declaredWorkforce(
  company: { totalEmployees?: number | null; entityType?: string | null } | null | undefined,
): number | null {
  if (!company || isTrainingCentre(company.entityType)) return null;
  const total = company.totalEmployees;
  return typeof total === "number" && Number.isFinite(total) && total > 0 ? total : null;
}
