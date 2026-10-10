import type { ActiveQuarter } from "./onefop-submission";
import { entityTypeDisplayName, referencePeriodLabel, referencePeriodPhrases } from "./onefop-period-label";
import { parseCompanyEntityType } from "./register-constants";
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
