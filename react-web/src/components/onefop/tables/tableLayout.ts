/**
 * Shared sizing rules for every statistical grid in the Modern Jobs wizard
 * (StatisticalGridRenderer and TableRenderer's GenericGrid):
 *
 * - A table frame never exceeds TABLE_MAX_WIDTH_PX, and hugs its own
 *   columns below that.
 * - The row-label column is a fixed TABLE_LABEL_COL_PX.
 * - A data column sits between TABLE_MIN_DATA_COL_PX and
 *   TABLE_MAX_DATA_COL_PX. The cap is the owner's decision of 2026-10-11:
 *   the columns used to share all the slack equally, so on a wide screen
 *   VT 5.4 and 8.3 gave a three-digit count a 403px cell and the eleven
 *   two-to-four-column tables 201-268px, against the 89px that VT 4.8/4.9
 *   were tuned for and read correctly at. Tables therefore no longer all
 *   end at the same width - a narrow table is visibly narrower, which the
 *   owner accepted as the lesser cost.
 *   The cap is that same 89px rather than a round 96 so that the widest
 *   table still fits: TABLE_LABEL_COL_PX + TABLE_WIDEST_DATA_COL_COUNT x
 *   TABLE_MAX_DATA_COL_PX stays within TABLE_MAX_WIDTH_PX. At 96 the
 *   nine-column tables came to 1084px and began scrolling horizontally on
 *   a screen wide enough to show them whole. tableLayout.test.ts holds
 *   that invariant.
 * - The table only scrolls horizontally (inside its own frame) once a data
 *   column would drop below TABLE_MIN_DATA_COL_PX.
 * - Tables whose columns are grouped into blocks switch to one-block-at-a-time
 *   tabs as soon as the whole table would not fit the frame - that is, when
 *   tablePreferredWidthPx exceeds it (see AdaptiveStatisticalTable). Such a
 *   table therefore never scrolls sideways: it shows whole, or it splits
 *   into its column groups. Until 2026-10-11 the trigger was a separate
 *   64px-per-column floor, which left VT 4.8 scrolling horizontally on
 *   every frame between 796px and the width it actually needs.
 */
export const TABLE_MAX_WIDTH_PX = 1025;
export const TABLE_LABEL_COL_PX = 170;
export const TABLE_MIN_DATA_COL_PX = 56;
export const TABLE_MAX_DATA_COL_PX = 89;
/** Columns in the widest statistical table (VT 4.8/4.9, S22Q04). */
export const TABLE_WIDEST_DATA_COL_COUNT = 9;

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
