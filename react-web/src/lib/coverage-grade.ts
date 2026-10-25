// The six attainment bands the registration-coverage screens share.
//
// Two units are in play and mixing them silently mislabels a territory, so
// each has its own entry point: the coverage tables hold a 0-1 ratio (the
// server's `coverageRate`), the bar chart holds a 0-100 percentage.
export const COVERAGE_GRADE_BANDS = [
  { key: "critical", className: "is-critical", labelKey: "coverageCritical", minimum: 0, maximum: 30 },
  { key: "veryPoor", className: "is-very-poor", labelKey: "coverageVeryPoor", minimum: 30, maximum: 50 },
  { key: "poor", className: "is-poor", labelKey: "coveragePoor", minimum: 50, maximum: 75 },
  { key: "average", className: "is-average", labelKey: "coverageAverage", minimum: 75, maximum: 90 },
  { key: "good", className: "is-good", labelKey: "coverageGood", minimum: 90, maximum: 100 },
  { key: "excellent", className: "is-excellent", labelKey: "coverageExcellent", minimum: 100, maximum: Infinity },
] as const;

export type CoverageGrade = (typeof COVERAGE_GRADE_BANDS)[number];

/** The band for a 0-1 ratio, as the coverage tables hold it. */
export function coverageGrade(rate: number | null): CoverageGrade | null {
  if (rate == null) return null;
  const percentage = rate * 100;
  // An unmeasurable rate is ungraded, not "critical": the fallback below is
  // the floor for a value under the first band, not a catch-all.
  if (!Number.isFinite(percentage)) return null;
  return COVERAGE_GRADE_BANDS.find(
    (band) => percentage >= band.minimum && percentage < band.maximum,
  ) ?? COVERAGE_GRADE_BANDS[0];
}

/** The band for a 0-100 percentage, as the bar chart holds it. */
export function coverageGradeFromPercent(percentage: number | null): CoverageGrade | null {
  return coverageGrade(percentage == null ? null : percentage / 100);
}
