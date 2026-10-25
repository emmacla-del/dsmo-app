"use client";

import { createContext, useContext, type CSSProperties } from "react";
import { CodedLabel } from "@/components/onefop/ui/QuestionCode";
import { InfoTooltip } from "@/components/onefop/ui/InfoTooltip";

/**
 * The one heading a statistical table gets: the question it asks.
 *
 * Three renderers put a table on a respondent's screen — AdaptiveStatisticalTable
 * (the quiz-gated matrices), TableRenderer (the classic grids: 4.6 and the
 * project's outcomes table among them) and ActivitiesTableRenderer — and each
 * used to draw that question differently: an <h2> at --cam-font-size-lg in one,
 * a small bold <p> in the second (no heading at all for a screen reader), an
 * <h2> styled like the small <p> in the third. On the project form's Section 4
 * the difference showed between two neighbouring tables.
 *
 * All three read this now, so one table's question looks like the next one's.
 * `style` is for the gap below the heading only: the adaptive tables sit in a
 * flex column with its own gap, the other two in a plain block.
 */
export const tableQuestionHeadingStyle: CSSProperties = {
  fontFamily: "var(--cam-font-sans)",
  fontSize: "var(--cam-font-size-lg, 1.125rem)",
  fontWeight: "var(--cam-font-weight-medium)",
  color: "var(--cam-text)",
  lineHeight: 1.35,
  margin: 0,
};

/**
 * How to fill the table in ("Indiquez le nombre … par catégorie, sexe et
 * âge"), set by the gateway that opened it (ConditionalTable). It used to be
 * a bold line of its own between the table's name and its question; it is
 * now an ⓘ at the end of the question (owner, 2026-10-22).
 */
export const TableInstructionContext = createContext<string | null>(null);

export function TableQuestionHeading({
  code,
  text,
  style,
}: {
  code: string | null | undefined;
  text: string;
  style?: CSSProperties;
}) {
  const instruction = useContext(TableInstructionContext);
  return (
    <h2 style={{ ...tableQuestionHeadingStyle, ...style }}>
      <CodedLabel code={code} text={text} />
      {instruction && <InfoTooltip content={instruction} />}
    </h2>
  );
}
