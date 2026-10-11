import { createContext } from "react";

/**
 * True where the screen's own heading already names the table on it — the VT
 * Sections 4 and 8, one table per screen. A table renderer then leaves out its
 * own visible title, so the respondent reads one title per table, not two
 * (VT wizard audit, S4). Elsewhere (default false) tables keep their title.
 */
export const TableHeadingShownContext = createContext(false);
