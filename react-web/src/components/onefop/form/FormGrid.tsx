"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * CSS Grid replacement for the wizard's old useViewportSize()-driven
 * flex/column switching. Mobile is always 1 column; `columns` sets the
 * ceiling at md/lg. No JS breakpoint reads — the browser handles the
 * collapse.
 */
export function FormGrid({
  columns = 2,
  gap = 18,
  gapX = 20,
  gapY = 16,
  children,
  style,
}: {
  columns?: 1 | 2 | 3;
  gap?: number;
  gapX?: number;
  gapY?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const colsClass =
    columns === 1
      ? "grid-cols-1"
      : columns === 2
        ? "grid-cols-1 md:grid-cols-2"
        : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  return (
    <div
      className={`grid ${colsClass}`}
      style={{ rowGap: gapY ?? gap, columnGap: gapX ?? gap, ...style }}
    >
      {children}
    </div>
  );
}

/**
 * A grid item. `full` forces full-row width regardless of the grid's
 * column count — for long questions, textareas, and tables, which must
 * never be squeezed into a narrow column.
 */
export function FormCol({
  full = false,
  children,
  style,
}: {
  full?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      className={full ? "col-span-full" : undefined}
      style={{ minWidth: 0, ...style }}
    >
      {children}
    </div>
  );
}
