"use client";

import { useTranslations } from "next-intl";
import { YEAR_MIN } from "@/lib/pilotage-targets";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Semester = 1 | 2;
type Quarter = 1 | 2 | 3 | 4;
type CoveragePeriod = { semester: Semester | null; quarter: Quarter | null };

const PERIOD_OPTIONS: readonly { value: string; period: CoveragePeriod }[] = [
  { value: "year", period: { semester: null, quarter: null } },
  { value: "semester-1", period: { semester: 1, quarter: null } },
  { value: "semester-2", period: { semester: 2, quarter: null } },
  { value: "quarter-1", period: { semester: 1, quarter: 1 } },
  { value: "quarter-2", period: { semester: 1, quarter: 2 } },
  { value: "quarter-3", period: { semester: 2, quarter: 3 } },
  { value: "quarter-4", period: { semester: 2, quarter: 4 } },
];

function periodValue(semester: Semester | null, quarter: Quarter | null): string {
  if (quarter != null) return `quarter-${quarter}`;
  if (semester != null) return `semester-${semester}`;
  return "year";
}

function periodFor(value: string): CoveragePeriod {
  return PERIOD_OPTIONS.find((option) => option.value === value)?.period ?? PERIOD_OPTIONS[0].period;
}

/** A year selector followed by one unambiguous coverage-period selector. */
export function CoveragePeriodSelector({
  year,
  semester,
  quarter,
  latestAvailableYear,
  onPeriodChange,
}: {
  year: number;
  semester: Semester | null;
  quarter: Quarter | null;
  latestAvailableYear: number;
  onPeriodChange: (selection: { year: number } & CoveragePeriod) => void;
}) {
  const t = useTranslations("adminTargets");
  const years = Array.from(
    { length: Math.max(0, latestAvailableYear - YEAR_MIN + 1) },
    (_, index) => latestAvailableYear - index,
  );

  return (
    <fieldset className="coverage-period-selector min-w-0 border-0 p-0">
      <legend className="sr-only">{t("coveragePeriodSelectorLabel")}</legend>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-32 gap-1.5">
          <Label htmlFor="coverage-period-year">{t("chooseYearHeader")}</Label>
          <Select
            value={String(year)}
            onValueChange={(value) => onPeriodChange({ year: Number(value), semester, quarter })}
          >
            <SelectTrigger id="coverage-period-year" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((option) => (
                <SelectItem key={option} value={String(option)}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-40 gap-1.5">
          <Label htmlFor="coverage-period-value">{t("coveragePeriodLabel")}</Label>
          <Select
            value={periodValue(semester, quarter)}
            onValueChange={(value) => onPeriodChange({ year, ...periodFor(value) })}
          >
            <SelectTrigger id="coverage-period-value" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="year">{t("fullYearPeriod")}</SelectItem>
              <SelectItem value="semester-1">S1</SelectItem>
              <SelectItem value="semester-2">S2</SelectItem>
              <SelectItem value="quarter-1">{t("coverageQuarter1")}</SelectItem>
              <SelectItem value="quarter-2">{t("coverageQuarter2")}</SelectItem>
              <SelectItem value="quarter-3">{t("coverageQuarter3")}</SelectItem>
              <SelectItem value="quarter-4">{t("coverageQuarter4")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </fieldset>
  );
}
