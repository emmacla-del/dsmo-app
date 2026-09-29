/**
 * Shared sizing rules for every statistical grid in the Modern Jobs wizard
 * (StatisticalGridRenderer and TableRenderer's GenericGrid), so all tables
 * line up at the same width whatever the window size:
 *
 * - Every table frame fills its container, capped at TABLE_MAX_WIDTH_PX
 *   (the natural width of S22Q04: 170px label + 9 × 95px columns).
 * - The row-label column is a fixed TABLE_LABEL_COL_PX; the data columns
 *   share the rest of the width equally.
 * - The table only scrolls horizontally (inside its own frame) once a data
 *   column would drop below TABLE_MIN_DATA_COL_PX.
 * - Tables whose columns are grouped into blocks switch to one-block-at-a-time
 *   tabs when a data column would drop below TABLE_BLOCK_TAB_COL_PX
 *   (see AdaptiveStatisticalTable).
 */
export const TABLE_MAX_WIDTH_PX = 1025;
export const TABLE_LABEL_COL_PX = 170;
export const TABLE_MIN_DATA_COL_PX = 56;
export const TABLE_BLOCK_TAB_COL_PX = 64;

/** Width below which the table starts scrolling inside its frame. */
export function tableMinWidthPx(dataColumnCount: number, labelColumnPx: number = TABLE_LABEL_COL_PX): number {
  return labelColumnPx + dataColumnCount * TABLE_MIN_DATA_COL_PX;
}
