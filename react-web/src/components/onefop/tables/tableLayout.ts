/**
 * Shared sizing rules for every statistical grid in the Modern Jobs wizard
 * (StatisticalGridRenderer and TableRenderer's GenericGrid), so all tables
 * line up at the same width whatever the window size:
 *
 * - A table frame never exceeds TABLE_MAX_WIDTH_PX (S22Q04: a 220px label +
 *   9 × 89px columns), and hugs its own columns below that.
 * - The row-label column is a fixed TABLE_LABEL_COL_PX. 220px, not 170px
 *   (2026-10-11): at 170px labels such as "GCE A-Level (General)" wrapped,
 *   rows came out at two heights, and three count columns were wider than
 *   any count.
 * - A data column sits between TABLE_MIN_DATA_COL_PX and
 *   TABLE_MAX_DATA_COL_PX. The cap is the owner's decision of 2026-10-11:
 *   the columns used to share all the slack equally, so on a wide screen
 *   VT 5.4 and 8.3 gave a three-digit count a 403px cell and the eleven
 *   two-to-four-column tables 201–268px, against the 89px that VT 4.8/4.9
 *   were tuned for and read correctly at. Tables therefore no longer all
 *   end at the same width — a narrow table is visibly narrower, which the
 *   owner accepted as the lesser cost.
 *   The cap is that same 89px rather than a round 96 so that the widest
 *   table still fits the frame: 220 + 9 × 89 = 1021 ≤ TABLE_MAX_WIDTH_PX.
 *   At 96 the nine-column tables came to 1084px and began scrolling
 *   horizontally on a screen wide enough to show them whole.
 *   tableLayout.test.ts holds that invariant.
 * - The table only scrolls horizontally (inside its own frame) once a data
 *   column would drop below TABLE_MIN_DATA_COL_PX.
 * - Tables whose columns are grouped into blocks switch to one-block-at-a-time
 *   tabs as soon as the whole table would not fit the frame — that is, when
 *   tablePreferredWidthPx exceeds it (see AdaptiveStatisticalTable). Such a
 *   table therefore never scrolls sideways: it shows whole, or it splits
 *   into its column groups. Until 2026-10-11 the trigger was a separate
 *   64px-per-column floor, which left VT 4.8 scrolling horizontally on
 *   every frame between 796px and the 1021px it needs.
 */
export const TABLE_MAX_WIDTH_PX = 1025;
export const TABLE_LABEL_COL_PX = 220;
export const TABLE_MIN_DATA_COL_PX = 56;
export const TABLE_MAX_DATA_COL_PX = 89;
/**
 * A table's data columns all take one width, set by that table's own
 * headings (owner, 2026-10-11): they had all been pinned at
 * TABLE_MAX_DATA_COL_PX whatever their headings said, so "Homme" got as much
 * room as "Nombre total de locaux", which wrapped onto four lines. Sizing
 * each column to its own heading was tried first and dropped the same day:
 * columns holding the same counts came out ragged, a short heading such as
 * "Bon état" still wrapped, and the band over 5.3's columns broke mid-word.
 * This is the ceiling for a long heading; the label column still absorbs
 * the slack.
 */
export const TABLE_MAX_HEADING_COL_PX = 160;
/** Average advance of a heading character at the table's 14px Inter. */
const TABLE_HEADING_CHAR_PX = 8;
/** A heading cell's padding and border (px-2.5 + 1px), and the required asterisk. */
const TABLE_HEADING_CHROME_PX = 30;
/** Columns in the widest statistical table (VT 4.8/4.9, S22Q04). */
export const TABLE_WIDEST_DATA_COL_COUNT = 9;
/** The table frame's border, on each side. */
export const TABLE_FRAME_BORDER_PX = 1;

/** Width below which the table starts scrolling inside its frame. */
export function tableMinWidthPx(dataColumnCount: number, labelColumnPx: number = TABLE_LABEL_COL_PX): number {
  return labelColumnPx + dataColumnCount * TABLE_MIN_DATA_COL_PX;
}

/**
 * The width the table asks for: the label column, its data columns at their
 * capped width, and any further fixed column (a total or comment column).
 * The frame hugs this instead of stretching to the container.
 */
export function tablePreferredWidthPx(
  dataColumnWidths: readonly number[],
  labelColumnPx: number = TABLE_LABEL_COL_PX,
  extraPx = 0,
): number {
  return labelColumnPx + dataColumnWidths.reduce((sum, w) => sum + w, 0) + extraPx;
}

/** Characters on the longer line when `words` wrap onto two lines at best. */
function twoLineChars(words: readonly string[]): number {
  if (words.length === 1) return words[0].length;
  let best = Infinity;
  for (let split = 1; split < words.length; split++) {
    const first = words.slice(0, split).join(" ").length;
    const second = words.slice(split).join(" ").length;
    best = Math.min(best, Math.max(first, second));
  }
  return best;
}

function headingPx(chars: number): number {
  return Math.ceil(chars * TABLE_HEADING_CHAR_PX + TABLE_HEADING_CHROME_PX);
}

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** A heading over several data columns: a group, or a band over groups. */
export interface SpanningHeading {
  heading: string;
  columns: number;
}

/**
 * The one width every data column of a table takes, from its headings: each
 * column heading on one line where that fits under TABLE_MAX_HEADING_COL_PX,
 * else on two lines; each spanning heading on at most two lines across the
 * columns it covers. Never inside a word, never below TABLE_MIN_DATA_COL_PX
 * (room for a count). An estimate from the character count rather than a
 * DOM measurement, so server and client render the same widths.
 */
export function tableDataColumnWidthPx(
  columnHeadings: readonly string[],
  spanningHeadings: readonly SpanningHeading[] = [],
): number {
  let wanted = TABLE_MIN_DATA_COL_PX;
  for (const heading of columnHeadings) {
    const w = words(heading);
    if (w.length === 0) continue;
    const oneLine = headingPx(w.join(" ").length);
    wanted = Math.max(wanted, oneLine <= TABLE_MAX_HEADING_COL_PX ? oneLine : headingPx(twoLineChars(w)));
  }
  for (const { heading, columns } of spanningHeadings) {
    const w = words(heading);
    if (w.length === 0 || columns <= 0) continue;
    wanted = Math.max(wanted, Math.ceil(headingPx(twoLineChars(w)) / columns));
  }
  return Math.min(TABLE_MAX_HEADING_COL_PX, wanted);
}

/** Consecutive equal, non-empty values as spanning headings. */
export function spanningHeadingsOf(values: readonly (string | undefined)[]): SpanningHeading[] {
  const out: SpanningHeading[] = [];
  values.forEach((value, i) => {
    if (!value) return;
    const last = out[out.length - 1];
    if (last && values[i - 1] === value) last.columns += 1;
    else out.push({ heading: value, columns: 1 });
  });
  return out;
}

/**
 * How wide the widest table in a section wants to be, from each table's
 * data-column count, or 0 where the section holds none. The wizard's
 * content column grows to this (within its own floor and cap) so a section
 * is no wider than what it actually shows.
 */
export function widestTableWidthPx(dataColumnCounts: readonly number[]): number {
  return dataColumnCounts.reduce((widest, columns) => {
    if (columns <= 0) return widest;
    const wanted =
      tablePreferredWidthPx(Array.from({ length: columns }, () => TABLE_MAX_DATA_COL_PX)) +
      // The frame's own edge, or the column is two pixels too narrow for it.
      2 * TABLE_FRAME_BORDER_PX;
    return Math.max(widest, wanted);
  }, 0);
}
