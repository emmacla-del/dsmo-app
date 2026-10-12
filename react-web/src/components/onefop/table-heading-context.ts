import { createContext } from "react";

/**
 * True where the screen's own heading already names the table on it — the VT
 * Sections 4 and 8, one table per screen. A table renderer then leaves out its
 * own visible title, so the respondent reads one title per table, not two
 * (VT wizard audit, S4). Elsewhere (default false) tables keep their title.
 */
export const TableHeadingShownContext = createContext(false);

/**
 * True where the block heading above a table already states the table's
 * progress (VT Section 5's "✓ Complete" / "1 to fix"). The table then leaves
 * out its own status pill, so one state is not reported twice in two words.
 */
export const TableStatusShownContext = createContext(false);
