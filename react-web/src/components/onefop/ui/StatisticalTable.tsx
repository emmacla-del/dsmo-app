"use client";

import React, { type ReactNode } from "react";

export interface TableColumnDef {
  key: string;
  header: string;
  subHeader?: string;
  align?: "left" | "center" | "right";
  width?: string | number;
}

export interface TableColumnGroup {
  title: string;
  columns: TableColumnDef[];
}

export interface StatisticalTableRow {
  id: string;
  label: string;
  code?: string;
  isTotal?: boolean;
  isSubtotal?: boolean;
  values: Record<string, string | number | ReactNode>;
}

export interface StatisticalTableProps {
  title?: string;
  caption?: string;
  rowHeaderLabel?: string;
  columnGroups?: TableColumnGroup[];
  flatColumns?: TableColumnDef[];
  rows: StatisticalTableRow[];
  emptyMessage?: string;
  className?: string;
}

/**
 * Reusable Statistical Table template for multi-dimensional government census data
 * (e.g. Trainees by specialty × sex × training type, or Infrastructure condition matrices).
 * Features:
 * - Multi-tier header hierarchy
 * - Sticky first column (row label) for horizontal scrolling
 * - Right-aligned numeric data with tabular figures
 * - Distinct Total and Subtotal row treatments
 * - WCAG / ARIA compliant table markup
 */
export function StatisticalTable({
  title,
  caption,
  rowHeaderLabel = "Désignation / Spécialité",
  columnGroups,
  flatColumns,
  rows,
  emptyMessage = "Aucune donnée disponible",
  className = "",
}: StatisticalTableProps) {
  // Resolve columns: either grouped or flat
  const allColumns: TableColumnDef[] = columnGroups
    ? columnGroups.flatMap((g) => g.columns)
    : flatColumns || [];

  const hasGroups = Boolean(columnGroups && columnGroups.length > 0);

  return (
    <div className={`w-full my-4 ${className}`}>
      {title && (
        <div className="mb-2.5">
          <h4 className="text-sm sm:text-base font-bold text-[#0b1f14] tracking-tight">
            {title}
          </h4>
          {caption && (
            <p className="text-xs text-[#4a5a50] mt-0.5 leading-normal">
              {caption}
            </p>
          )}
        </div>
      )}

      <div className="w-full overflow-x-auto border border-[#d8ddd3] rounded-[4px] shadow-xs bg-white">
        <table className="w-full border-collapse text-xs sm:text-sm text-left">
          {caption && <caption className="sr-only">{caption}</caption>}

          <thead className="bg-[#fafaf7] text-[#0b1f14] font-semibold border-b border-[#d8ddd3]">
            {hasGroups && columnGroups ? (
              <>
                {/* Group Header Row */}
                <tr>
                  <th
                    scope="col"
                    rowSpan={2}
                    className="sticky left-0 z-20 bg-[#fafaf7] px-4 py-3 border-r border-b border-[#d8ddd3] font-bold text-[#1a5c3a] min-w-[180px] sm:min-w-[240px]"
                  >
                    {rowHeaderLabel}
                  </th>
                  {columnGroups.map((grp, gIdx) => (
                    <th
                      key={gIdx}
                      scope="colgroup"
                      colSpan={grp.columns.length}
                      className="px-3 py-2 text-center border-r border-b border-[#d8ddd3] font-bold text-[#0b1f14] last:border-r-0 bg-[#f4f7f4]"
                    >
                      {grp.title}
                    </th>
                  ))}
                </tr>
                {/* Sub-Header Row */}
                <tr>
                  {allColumns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className={`px-3 py-2 border-r border-b border-[#d8ddd3] font-semibold text-xs text-[#4a5a50] whitespace-nowrap last:border-r-0 ${
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                            ? "text-center"
                            : "text-left"
                      }`}
                      style={{ width: col.width }}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </>
            ) : (
              /* Single Header Row */
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-20 bg-[#fafaf7] px-4 py-3 border-r border-b border-[#d8ddd3] font-bold text-[#1a5c3a] min-w-[180px] sm:min-w-[240px]"
                >
                  {rowHeaderLabel}
                </th>
                {allColumns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={`px-3 py-2.5 border-r border-b border-[#d8ddd3] font-semibold text-xs sm:text-sm text-[#0b1f14] whitespace-nowrap last:border-r-0 ${
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                          ? "text-center"
                          : "text-left"
                    }`}
                    style={{ width: col.width }}
                  >
                    <div>{col.header}</div>
                    {col.subHeader && (
                      <div className="text-[11px] font-normal text-[#4a5a50]">
                        {col.subHeader}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            )}
          </thead>

          <tbody className="divide-y divide-[#d8ddd3]">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={allColumns.length + 1}
                  className="px-4 py-8 text-center text-[#4a5a50] italic text-xs sm:text-sm"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isTotalRow = row.isTotal;
                const isSubtotalRow = row.isSubtotal;

                let rowBgClass = "hover:bg-[#fafaf7] transition-colors";
                if (isTotalRow) {
                  rowBgClass = "bg-[#eaf3ec] font-bold text-[#0b1f14]";
                } else if (isSubtotalRow) {
                  rowBgClass = "bg-[#fafaf7] font-semibold text-[#0b1f14]";
                }

                return (
                  <tr key={row.id} className={rowBgClass}>
                    {/* Sticky Row Header */}
                    <th
                      scope="row"
                      className={`sticky left-0 z-10 px-4 py-2.5 border-r border-[#d8ddd3] text-xs sm:text-sm whitespace-normal ${
                        isTotalRow
                          ? "bg-[#eaf3ec] font-bold text-[#1a5c3a]"
                          : isSubtotalRow
                            ? "bg-[#fafaf7] font-semibold text-[#0b1f14]"
                            : "bg-white font-medium text-[#0b1f14]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {row.code && (
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#fafaf7] border border-[#d8ddd3] text-[#4a5a50]">
                            {row.code}
                          </span>
                        )}
                        <span>{row.label}</span>
                      </div>
                    </th>

                    {/* Value Cells */}
                    {allColumns.map((col) => {
                      const val = row.values[col.key];
                      const align = col.align ?? "right";

                      return (
                        <td
                          key={col.key}
                          className={`px-3 py-2 border-r border-[#d8ddd3] last:border-r-0 tabular-nums whitespace-nowrap text-xs sm:text-sm ${
                            align === "right"
                              ? "text-right font-mono"
                              : align === "center"
                                ? "text-center"
                                : "text-left"
                          } ${
                            isTotalRow
                              ? "font-bold text-[#1a5c3a]"
                              : "text-[#0b1f14]"
                          }`}
                        >
                          {val != null && val !== "" ? val : "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
