"use client";

import React, { type ReactNode } from "react";

export interface FormGridProps {
  children: ReactNode;
  /** Number of columns on desktop (>=1024px). Defaults to 3. */
  cols?: 1 | 2 | 3 | 4;
  className?: string;
}

/**
 * Responsive CSS Grid container for form fields:
 * - 1 column on mobile (<768px)
 * - 2 columns on tablet (768px - 1023px)
 * - `cols` (2, 3, or 4) on desktop (>=1024px)
 */
export function FormGrid({ children, cols = 3, className = "" }: FormGridProps) {
  const desktopColsClass =
    cols === 1
      ? "lg:grid-cols-1"
      : cols === 2
        ? "lg:grid-cols-2"
        : cols === 4
          ? "lg:grid-cols-4"
          : "lg:grid-cols-3";

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 ${desktopColsClass} gap-x-5 gap-y-4 w-full items-start ${className}`}
    >
      {children}
    </div>
  );
}

export interface FormColProps {
  children: ReactNode;
  /** Column span on desktop (>=1024px). On mobile, always 1 column. */
  span?: 1 | 2 | 3 | "full";
  className?: string;
}

/**
 * Grid column wrapper to control span across responsive breakpoints.
 */
export function FormCol({ children, span = 1, className = "" }: FormColProps) {
  let spanClass = "col-span-1";
  if (span === 2) {
    spanClass = "col-span-1 md:col-span-2";
  } else if (span === 3) {
    spanClass = "col-span-1 md:col-span-2 lg:col-span-3";
  } else if (span === "full") {
    spanClass = "col-span-full";
  }

  return <div className={`${spanClass} min-w-0 w-full ${className}`}>{children}</div>;
}

export interface FormSectionCardProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

/**
 * Refined institutional section card container matching CAM-LEAP tokens.
 */
export function FormSectionCard({ children, className = "", id }: FormSectionCardProps) {
  return (
    <section
      id={id}
      className={`w-full bg-white border border-[#d8ddd3] rounded-[4px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-shadow duration-200 ${className}`}
    >
      {children}
    </section>
  );
}

export interface SubsectionHeaderProps {
  title: string;
  code?: string;
  description?: string;
  statusChip?: ReactNode;
  className?: string;
  hasDivider?: boolean;
}

/**
 * Subsection header with strong visual hierarchy, Cameroon green accent indicator,
 * optional section badge, and optional status chip.
 */
export function SubsectionHeader({
  title,
  code,
  description,
  statusChip,
  className = "",
  hasDivider = true,
}: SubsectionHeaderProps) {
  return (
    <div className={`w-full mb-6 ${className}`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-1 h-5 bg-[#1a5c3a] rounded-full shrink-0"
            aria-hidden="true"
          />
          <div className="flex items-baseline gap-2.5 flex-wrap">
            {code && (
              <span className="font-mono text-xs font-bold text-[#1a5c3a] bg-[#eaf3ec] px-2 py-0.5 rounded border border-[#1a5c3a]/20">
                {code}
              </span>
            )}
            <h3 className="font-sans text-base sm:text-lg font-bold text-[#0b1f14] tracking-tight leading-tight m-0">
              {title}
            </h3>
          </div>
        </div>
        {statusChip && <div className="shrink-0">{statusChip}</div>}
      </div>

      {description && (
        <p className="text-xs sm:text-sm text-[#4a5a50] mt-1.5 ml-4 leading-relaxed max-w-3xl">
          {description}
        </p>
      )}

      {hasDivider && <div className="h-px bg-[#d8ddd3] mt-4 w-full" />}
    </div>
  );
}
