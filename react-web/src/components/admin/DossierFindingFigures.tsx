"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCoherence } from "@/components/onefop/coherence/Coherence";
import { sameRule } from "@/lib/dossier-cell-checks";
import { COHERENCE_TABLE_LABELS, type CoherenceCell, type CoherenceFlag } from "@/lib/onefop-coherence";
import type { FormData } from "@/lib/onefop-schema";
import { vtTableAnchor, type VtFigure } from "@/lib/vt-finding-figures";

function figure(data: FormData, key: string): number {
  const value = Number(data[key]);
  return Number.isFinite(value) ? value : 0;
}

/** The sex a checker flag is about, from its key (« S22Q03_DIPLOMA_MISMATCH:male »). */
function flagSex(flag: CoherenceFlag): "male" | "female" | "total" | null {
  const last = flag.key.split(":").pop();
  return last === "male" || last === "female" || last === "total" ? last : null;
}

/**
 * The figures a finding compares, side by side, one line per sex: each
 * table's figure (summed where the rule sums, as the diploma table across
 * staff categories) as a link that scrolls to it and opens its note. Shown
 * only when the figures show the gap (lib/dossier-cell-checks.ts).
 */
export function FindingCompare({ ruleCode, data }: { ruleCode: string; data: FormData }) {
  const t = useTranslations("adminDossierPage");
  const locale = useLocale().startsWith("en") ? "en" : "fr";
  const coherence = useCoherence();
  const flags = (coherence?.flags ?? []).filter((flag) => sameRule(ruleCode, flag.code));
  if (!coherence || flags.length === 0) return null;

  // The first of a table's cells that is on the page: the review leaves out a
  // staff category with no figures, so a listed cell may not be drawn.
  const goTo = (cells: CoherenceCell[]) => {
    const shown = cells.find((cell) => document.querySelector(`[data-coherence-cell="${CSS.escape(cell.fieldKey)}"]`));
    coherence.focusCell(shown ?? cells[0], true);
  };

  return (
    <dl className="cam-dossier-finding-compare" aria-label={t("findingCompareLabel")}>
      {flags.map((flag) => {
        const byTable = new Map<string, CoherenceCell[]>();
        for (const cell of flag.cells) byTable.set(cell.tableFieldId, [...(byTable.get(cell.tableFieldId) ?? []), cell]);
        const sex = flagSex(flag);
        return (
          <div key={flag.key}>
            <dt>{sex ? t(`findingSex.${sex}`) : t("findingCompareLabel")}</dt>
            <dd>
              {[...byTable].map(([table, cells], index) => (
                <span key={table}>
                  {index > 0 && <span aria-hidden="true" className="cam-dossier-finding-compare-sep">·</span>}
                  <button type="button" className="cam-text-button" onClick={() => goTo(cells)}>
                    {COHERENCE_TABLE_LABELS[table]?.[locale] ?? table}{" "}
                    <strong>{cells.reduce((sum, cell) => sum + figure(data, cell.fieldKey), 0)}</strong>
                  </button>
                </span>
              ))}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * A VT finding's totals side by side, one line per sex, each linking to its
 * table: VT rules compare table totals (lib/vt-finding-figures.ts).
 */
export function VtFindingCompare({ figures }: { figures: VtFigure[] }) {
  const t = useTranslations("adminDossierPage");
  const bySex = (["male", "female"] as const)
    .map((sex) => ({ sex, items: figures.filter((figure) => figure.sex === sex) }))
    .filter((line) => line.items.length > 0);
  return (
    <dl className="cam-dossier-finding-compare" aria-label={t("findingCompareLabel")}>
      {bySex.map(({ sex, items }) => (
        <div key={sex}>
          <dt>{t(`findingSex.${sex}`)}</dt>
          <dd>
            {items.map((figure, index) => (
              <span key={`${figure.label}-${index}`}>
                {index > 0 && <span aria-hidden="true" className="cam-dossier-finding-compare-sep">·</span>}
                <a href={`#${vtTableAnchor(figure.code)}`}>
                  {t("vtTableFigure", { table: figure.label })} <strong>{figure.value}</strong>
                </a>
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}
