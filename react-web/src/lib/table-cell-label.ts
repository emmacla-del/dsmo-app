/**
 * Accessible name for a statistical-table cell: the row label followed by
 * the column labels (group, then leaf), joined the same way
 * StatisticalGridRenderer builds its `cellLabel` ("Row - Group - Column").
 * Screen readers announce this instead of the technical cell id
 * (e.g. "s4q3_row1_fiMale"), which must not be exposed to respondents.
 *
 * Empty / missing parts are skipped; the fallback (normally the cell id) is
 * returned only when no part carries any text at all.
 */
export function tableCellLabel(
  parts: ReadonlyArray<string | null | undefined>,
  fallback: string,
): string {
  const text = parts
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0)
    .join(" - ");
  return text || fallback;
}
