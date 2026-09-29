/**
 * DataTable — the ONLY place table typography is decided.
 *
 * Every data-entry / statistical table in the app (StatisticalGridRenderer,
 * TableRenderer, VtTableRenderer, ActivitiesTableRenderer) is built from
 * these pieces. Each piece maps to exactly one semantic role and one CSS
 * class (`.cam-dt-*`, see globals.css), and the look of each role comes
 * from the `--cam-table-*` tokens in tokens.css:
 *
 *   role            piece             weight token
 *   ─────────────   ───────────────   ───────────────────────────
 *   corner header   <CornerHeader>    --cam-table-w-group    (600)
 *   group header    <GroupHeader>     --cam-table-w-group    (600)  Masculin, Permanent…
 *   leaf header     <LeafHeader>      --cam-table-w-leaf     (400)  Homme, Femme, 25 à 34, Total
 *   row label       <RowHeader>       --cam-table-w-label    (400)  Agents de Maîtrise…
 *   block label     <RowHeader block> --cam-table-w-group    (600)  Permanent / Temporaire row blocks
 *   total row label <RowHeader total> --cam-table-w-total    (700)  TOTAL GÉNÉRAL
 *   typed value     <NumberInput>     --cam-table-w-value    (400)
 *   computed value  <NumberInput computed> / <CellValue computed>   --cam-table-w-computed (600)
 *   total value     <CellValue total> --cam-table-w-total    (700)
 *   empty value     <CellValue> with no value → grey "—"
 *
 * Alignment is decided here too: every value, entry and column header is
 * centred; row labels and the corner header are left-aligned; free-text
 * entries (<TextInput>) stay left-aligned for readability.
 *
 * Callers may pass layout styling (borders, background, padding, sticky
 * positioning, width) but NOT typography or text alignment: the `style`
 * prop type below removes those properties, so `fontSize`, `fontWeight`
 * or `textAlign` on a table cell is a compile error. That is what keeps
 * "Homme" identical in every table.
 */
import type {
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { forwardRef } from "react";

/** CSS properties a table cell may set — everything except typography and alignment. */
export type LayoutStyle = Omit<
  CSSProperties,
  | "font"
  | "fontFamily"
  | "fontSize"
  | "fontWeight"
  | "fontStyle"
  | "fontVariant"
  | "fontVariantNumeric"
  | "fontStretch"
  | "letterSpacing"
  | "lineHeight"
  | "textTransform"
  | "textAlign"
>;

type WithLayoutStyle<T> = Omit<T, "style"> & { style?: LayoutStyle };

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ── Table ─────────────────────────────────────────────────────────── */

export const DataTable = forwardRef<HTMLTableElement, WithLayoutStyle<TableHTMLAttributes<HTMLTableElement>>>(
  function DataTable({ className, ...rest }, ref) {
    return <table ref={ref} className={cx("cam-dt", className)} {...rest} />;
  },
);

/* ── Header cells ──────────────────────────────────────────────────── */

type ThProps = WithLayoutStyle<ThHTMLAttributes<HTMLTableCellElement>>;

/** Top-left header cell above the row labels (e.g. "Catégorie Socio-Professionnelle"). */
export function CornerHeader({ className, scope = "col", ...rest }: ThProps) {
  return <th scope={scope} className={cx("cam-dt-corner", className)} {...rest} />;
}

/** Column-group header spanning several leaf columns (Masculin, Permanent, Temporaire…). */
export function GroupHeader({ className, scope = "colgroup", ...rest }: ThProps) {
  return <th scope={scope} className={cx("cam-dt-group", className)} {...rest} />;
}

/** Individual column header (Homme, Femme, 25 à 34, Total…). */
export function LeafHeader({ className, scope = "col", ...rest }: ThProps) {
  return <th scope={scope} className={cx("cam-dt-leaf", className)} {...rest} />;
}

/**
 * Row label cell. `total` for the TOTAL / TOTAL GÉNÉRAL row, `block` for a
 * label spanning a block of rows (Permanent / Temporaire).
 */
export function RowHeader({
  className,
  scope,
  total = false,
  block = false,
  ...rest
}: ThProps & { total?: boolean; block?: boolean }) {
  return (
    <th
      scope={scope ?? (block ? "rowgroup" : "row")}
      className={cx("cam-dt-rowhead", total && "cam-dt-rowhead--total", block && "cam-dt-rowhead--block", className)}
      {...rest}
    />
  );
}

/* ── Body cell ───────────────────────────────────────────────────── */

/** Plain data cell (use CoherenceTd instead when the cell has a coherence hint). */
export function Cell({ className, ...rest }: WithLayoutStyle<TdHTMLAttributes<HTMLTableCellElement>>) {
  return <td className={cx("cam-dt-cell", className)} {...rest} />;
}

/* ── Values ────────────────────────────────────────────────────────── */

type InputProps = WithLayoutStyle<InputHTMLAttributes<HTMLInputElement>> & {
  /** Calculated (read-only) value — semibold, green. */
  computed?: boolean;
};

/** Number (or text) input inside a cell. Typed values are regular weight. */
export const NumberInput = forwardRef<HTMLInputElement, InputProps>(function NumberInput(
  { className, computed = false, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cx("cam-dt-input", computed && "cam-dt-input--computed", className)}
      {...rest}
    />
  );
});

/**
 * Text input inside a cell. Free text (descriptions, editable row labels)
 * is left-aligned; pass `short` for short coded entries (dates like
 * MM/AAAA, durations) so they are centred like numbers.
 */
export const TextInput = forwardRef<
  HTMLInputElement,
  WithLayoutStyle<InputHTMLAttributes<HTMLInputElement>> & { short?: boolean }
>(function TextInput({ className, short = false, ...rest }, ref) {
  return <input ref={ref} className={cx("cam-dt-input", !short && "cam-dt-input--text", className)} {...rest} />;
});

/** Dropdown inside a cell (coded answers, yes/no). Same type as values. */
export const SelectInput = forwardRef<HTMLSelectElement, WithLayoutStyle<SelectHTMLAttributes<HTMLSelectElement>>>(
  function SelectInput({ className, ...rest }, ref) {
    return <select ref={ref} className={cx("cam-dt-input", "cam-dt-input--select", className)} {...rest} />;
  },
);

/**
 * Read-only value shown in a cell. Renders a grey "—" when there is no
 * value, so every empty cell looks the same in every table.
 */
export function CellValue({
  value,
  computed = false,
  total = false,
}: {
  value: ReactNode;
  computed?: boolean;
  total?: boolean;
}) {
  const empty = value === null || value === undefined || value === "";
  if (empty) return <span className="cam-dt-empty">—</span>;
  return (
    <span className={cx("cam-dt-value", computed && "cam-dt-value--computed", total && "cam-dt-value--total")}>
      {value}
    </span>
  );
}

/** Small row code shown before a row label (e.g. "1", "2a"). */
export function RowCode({ children }: { children: ReactNode }) {
  return <span className="cam-dt-rowcode">{children}</span>;
}
