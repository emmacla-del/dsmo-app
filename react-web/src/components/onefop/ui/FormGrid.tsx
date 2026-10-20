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
      className={`w-full bg-white border border-[var(--cam-border)] rounded-[4px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-shadow duration-200 ${className}`}
    >
      {children}
    </section>
  );
}
