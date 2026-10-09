// src/data-management/spss/export-labels.ts
//
// Export-only label rewrites applied by CanonicalSchemaAdapterService after
// the variable list is built. The AST (onefop_ast.dart) and its generated
// schema are never touched — these change what analysts read in the .sps /
// .sav dictionary, not the questionnaire.
//
// E11 — reporting-period wording. The AST prints a round-specific
// placeholder (« du 1er Janvier 2026 à ce jour », « from the 1st of January
// 2025 to the present day »); the wizard swaps it for the round's own dates
// (react-web/src/lib/campaign-period.ts, same patterns). One export file can
// hold several rounds, so the dictionary uses a neutral phrase instead and
// the actual bounds are per-record variables (periodStart / periodEnd).
//
// E10 — unique variable labels. Section-1 identification fields repeat the
// same wording across entity forms (« Région », « Téléphone 2 ») and every
// table has a « Statut de réponse »; SPSS shows such variables
// indistinguishably. Only labels that occur more than once are changed, by
// prefixing the paper code (« S22Q03 — Statut de réponse »), adding the
// entity when the paper code alone still repeats (« Entreprise S1Q04 —
// Région »), and falling back to the variable name as a last resort.
import type { AnalyticalVariableDefinition } from '../canonical-schema-adapter.service';

const FR_PERIOD_PLACEHOLDER = /du (?:1er|premier) Janvier \d{4} à ce jour/g;
const EN_PERIOD_PLACEHOLDER = /from (?:the )?1st (?:of )?January \d{4} to (?:the present day|date)/g;

export const NEUTRAL_PERIOD_FR = 'pendant la période de référence';
export const NEUTRAL_PERIOD_EN = 'during the reference period';

export function neutralizeReportingPeriod(text: string, locale: 'fr' | 'en'): string {
  if (!text) return text;
  return locale === 'fr'
    ? text.replace(FR_PERIOD_PLACEHOLDER, NEUTRAL_PERIOD_FR)
    : text.replace(EN_PERIOD_PLACEHOLDER, NEUTRAL_PERIOD_EN);
}

const ENTITY_TAG_FR: Record<string, string> = {
  enterprise: 'Entreprise',
  cooperative: 'Coopérative',
  ctd: 'CTD',
  ong: 'ONG',
  administration: 'Administration',
  projectProgram: 'Projet/Programme',
  vocationalTraining: 'Centre de formation',
};

const SEP = ' — ';

function entityTag(v: AnalyticalVariableDefinition): string | null {
  return v.entityApplicability.length === 1 ? ENTITY_TAG_FR[v.entityApplicability[0]] ?? null : null;
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

/**
 * Returns sourcePath → new French label for every variable whose label is
 * shared with another variable in `variables`. Variables with a unique
 * label are absent from the result (left unchanged). Deterministic: depends
 * only on the variables, not on their order.
 */
export function disambiguateDuplicateLabels(variables: AnalyticalVariableDefinition[]): Map<string, string> {
  const groups = new Map<string, AnalyticalVariableDefinition[]>();
  for (const v of variables) {
    const g = groups.get(v.labelFr);
    if (g) g.push(v);
    else groups.set(v.labelFr, [v]);
  }

  const result = new Map<string, string>();
  for (const [label, members] of groups) {
    if (members.length < 2) continue;
    const level1 = members.map((v) => `${v.paperCode}${SEP}${label}`);
    const level2 = members.map((v) => {
      const tag = entityTag(v);
      return `${tag ? `${tag} ` : ''}${v.paperCode}${SEP}${label}`;
    });
    const chosen = !hasDuplicates(level1) ? level1 : level2;
    // Any label still shared inside the group falls back to the variable name.
    const counts = new Map<string, number>();
    for (const l of chosen) counts.set(l, (counts.get(l) ?? 0) + 1);
    members.forEach((v, i) => {
      const l = counts.get(chosen[i])! > 1 ? `${v.variableName}${SEP}${label}` : chosen[i];
      result.set(v.sourcePath, l);
    });
  }

  // A prefixed label must not land on another variable's untouched label.
  const untouched = new Set(variables.filter((v) => !result.has(v.sourcePath)).map((v) => v.labelFr));
  for (const v of variables) {
    const l = result.get(v.sourcePath);
    if (l && untouched.has(l)) result.set(v.sourcePath, `${v.variableName}${SEP}${v.labelFr}`);
  }
  return result;
}
