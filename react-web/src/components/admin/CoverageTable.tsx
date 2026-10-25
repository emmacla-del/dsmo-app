"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { asUiLocale, type UiLocale } from "@/lib/register-i18n";
import { count, percent } from "@/lib/admin-data-state";
import type { CoverageEntityTypeRow, CoverageResponse, StockCounts } from "@/lib/pilotage-targets";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel } from "@/lib/companies-directory";
import { formatCoverageCount, modeLabel } from "@/lib/pilotage-target-payload";
import { coverageGrade } from "@/lib/coverage-grade";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Right-aligned, tabular figures: a column of counts must line up. */
const NUM = "is-num tabular-nums";

type CoverageStatusMetric = "pendingApproval" | "pendingReview" | "complementsRequested" | "documentsIncomplete" | "draft";

const COVERAGE_STATUS_METRICS: readonly {
  value: CoverageStatusMetric;
  labelKey: string;
  shortLabelKey: string;
}[] = [
  { value: "pendingApproval", labelKey: "approvalColumn", shortLabelKey: "approvalShortColumn" },
  { value: "pendingReview", labelKey: "reviewColumn", shortLabelKey: "reviewShortColumn" },
  { value: "complementsRequested", labelKey: "complementsColumn", shortLabelKey: "complementsShortColumn" },
  { value: "documentsIncomplete", labelKey: "documentsIncompleteColumn", shortLabelKey: "documentsIncompleteShortColumn" },
  { value: "draft", labelKey: "draftColumn", shortLabelKey: "draftShortColumn" },
];

const COVERAGE_HEADER_LEGEND: readonly {
  shortLabelKey: string;
  labelKey: string;
}[] = [
  { shortLabelKey: "territoryHeaderShort", labelKey: "territoryColumn" },
  { shortLabelKey: "entityTypeHeaderShort", labelKey: "entityTypeColumn" },
  { shortLabelKey: "modeHeaderShort", labelKey: "modeColumn" },
  { shortLabelKey: "companyCountHeaderShort", labelKey: "companyCountColumn" },
  { shortLabelKey: "registeredHeaderShort", labelKey: "registeredColumn" },
  { shortLabelKey: "registerShareHeaderShort", labelKey: "registerShareColumn" },
  { shortLabelKey: "quotaHeaderShort", labelKey: "coverageTargetColumn" },
  { shortLabelKey: "gapHeaderShort", labelKey: "gapColumn" },
  { shortLabelKey: "rateHeaderShort", labelKey: "rateColumn" },
  { shortLabelKey: "coverageGradeHeaderShort", labelKey: "coverageGradeColumn" },
  { shortLabelKey: "registeredInPeriodHeaderShort", labelKey: "inYearColumn" },
  { shortLabelKey: "overdueHeaderShort", labelKey: "overdueCoverageColumn" },
  { shortLabelKey: "statusHeaderShort", labelKey: "statusGroupColumn" },
  ...COVERAGE_STATUS_METRICS.map((metric) => ({
    shortLabelKey: metric.shortLabelKey,
    labelKey: metric.labelKey,
  })),
];

function CoverageColumnHeader({
  label,
  shortLabel,
  numeric = false,
  rowSpan = 2,
  className,
}: {
  label: string;
  shortLabel: string;
  numeric?: boolean;
  rowSpan?: number;
  className?: string;
}) {
  return (
    <TableHead
      scope="col"
      rowSpan={rowSpan}
      aria-label={label}
      className={[numeric ? NUM : "", className ?? ""].filter(Boolean).join(" ")}
    >
      {shortLabel}
    </TableHead>
  );
}

function StatusHeaders({ idPrefix }: { idPrefix: string }) {
  const t = useTranslations("adminTargets");
  return (
    <>
      <TableHead scope="colgroup" colSpan={COVERAGE_STATUS_METRICS.length} id={`${idPrefix}-group`} aria-label={t("statusGroupColumn")} className="text-center">
        {t("statusHeaderShort")}
      </TableHead>
    </>
  );
}

function StatusSubheaders({ idPrefix }: { idPrefix: string }) {
  const t = useTranslations("adminTargets");
  return (
    <>
      {COVERAGE_STATUS_METRICS.map((metric) => (
        <TableHead
          key={metric.value}
          scope="col"
          id={`${idPrefix}-${metric.value}`}
          aria-label={t(metric.labelKey)}
          className={`${NUM} px-2`}
        >
          {t(metric.shortLabelKey)}
        </TableHead>
      ))}
    </>
  );
}

export function CoverageTableHelp({ overdueDays }: { overdueDays: number }) {
  const t = useTranslations("adminTargets");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="coverage-help-trigger">
          <Info aria-hidden="true" />
          {t("coverageHelpLabel")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[70vh] w-96 max-w-[calc(100vw-2rem)] overflow-y-auto">
        <PopoverHeader>
          <PopoverTitle>{t("coverageHelpTitle")}</PopoverTitle>
        </PopoverHeader>
        <div className="mt-3 grid gap-3 text-sm">
          <div>
            <p className="mb-1 font-medium">{t("coverageHelpRowsTitle")}</p>
            <p className="text-muted-foreground">{t("coverageHelpRows")}</p>
            <p className="mt-1 text-muted-foreground">{t("coverageHelpTotal")}</p>
          </div>
          <div>
            <p className="mb-1 font-medium">{t("coverageHelpCountsTitle")}</p>
            <p className="text-muted-foreground">{t("coverageHelpRegistered")}</p>
            <p className="mt-1 text-muted-foreground">{t("quotaCoverageRegisterDefinition")}</p>
            <p className="mt-1 text-muted-foreground">{t("coverageHelpCompanyCount")}</p>
            <p className="mt-1 text-muted-foreground">{t("coverageHelpOverdue", { days: overdueDays })}</p>
            <p className="mb-1 mt-3 font-medium">{t("coverageHelpPeriodLegendTitle")}</p>
            <ul className="grid gap-1 text-muted-foreground">
              {COVERAGE_HEADER_LEGEND.map((item) => (
                <li key={item.shortLabelKey}>
                  <strong className="font-medium text-foreground">{t(item.shortLabelKey)}</strong>
                  {" = "}
                  {item.labelKey === "overdueCoverageColumn"
                    ? t(item.labelKey, { days: overdueDays })
                    : t(item.labelKey)}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-muted-foreground">{t("coverageHelpYearSelection")}</p>
            <p className="mt-1 text-muted-foreground">{t("coverageHelpSemesterSelection")}</p>
            <p className="mt-1 text-muted-foreground">{t("coverageHelpQuarterSelection")}</p>
          </div>
          <div>
            <p className="mb-1 font-medium">{t("coverageHelpQuotaTitle")}</p>
            <p className="mb-2 text-muted-foreground">{t("coverageHelpGrade")}</p>
            <ul className="grid gap-1 text-muted-foreground">
              <li><strong className="font-medium text-foreground">{t("modeColumn")}</strong> — {t("coverageHelpMode")}</li>
              <li><strong className="font-medium text-foreground">{t("coverageTargetColumn")}</strong> — {t("coverageHelpQuota")}</li>
              <li><strong className="font-medium text-foreground">{t("gapColumn")}</strong> — {t("coverageHelpGap")}</li>
              <li><strong className="font-medium text-foreground">{t("rateColumn")}</strong> — {t("coverageHelpRate")}</li>
              <li>
                <strong className="font-medium text-foreground">{t("registerShareColumn")}</strong>
                {" — "}
                {t("coverageHelpRegisterShare")}
                {" "}
                <span>({t("byEntityTypeTab")})</span>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-1 font-medium">{t("coverageHelpStatusTitle")}</p>
            <p className="mb-2 text-muted-foreground">{t("coverageHelpStatusIntro")}</p>
          </div>
          <p className="text-muted-foreground">{t("coverageHelpDashAndZero")}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CoverageTable({
  data,
  expanded,
  onToggle,
  overdueHref,
}: {
  data: CoverageResponse;
  expanded: Set<string>;
  onToggle: (regionId: string) => void;
  overdueHref?: (regionName: string, departmentName?: string) => string | null;
}) {
  const t = useTranslations("adminTargets");
  const locale = asUiLocale(useLocale());
  const [showWorkflowDetails, setShowWorkflowDetails] = useState(false);
  const national = data.central != null || data.unassigned != null || data.nullEntityType != null;

  if (data.regions.length === 0 && !national) {
    return <p className="cam-admin-lede">{t("noTerritory")}</p>;
  }

  return (
    <>
    {data.totals.targetIndeterminate && (
      <p className="mb-3 text-sm text-muted-foreground">{t("coverageTotalIndeterminateNote")}</p>
    )}
    <div className="mb-2 flex justify-end">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={showWorkflowDetails}
        aria-controls="coverage-territory-table"
        onClick={() => setShowWorkflowDetails((shown) => !shown)}
      >
        {showWorkflowDetails ? t("hideWorkflowDetails") : t("showWorkflowDetails")}
      </Button>
    </div>
    <Table
      id="coverage-territory-table"
      className={`cam-dash-table cam-target-table cam-registration-coverage-table${showWorkflowDetails ? " is-workflow-expanded" : ""}`}
    >
      <TableHeader>
        <TableRow>
          <CoverageColumnHeader label={t("territoryColumn")} shortLabel={t("territoryHeaderShort")} rowSpan={showWorkflowDetails ? 2 : 1} className="coverage-sticky-column" />
          <CoverageColumnHeader label={t("registeredColumn")} shortLabel={t("registeredHeaderShort")} numeric rowSpan={showWorkflowDetails ? 2 : 1} />
          <TableHead scope="col" id="coverage-territory-registered-period" aria-label={t("inYearColumn")} rowSpan={showWorkflowDetails ? 2 : 1} className={`${NUM} whitespace-nowrap coverage-period-header`}>
            {t("registeredInPeriodHeaderShort")}
          </TableHead>
          <CoverageColumnHeader label={t("coverageTargetColumn")} shortLabel={t("quotaHeaderShort")} numeric rowSpan={showWorkflowDetails ? 2 : 1} />
          <CoverageColumnHeader label={t("gapColumn")} shortLabel={t("gapHeaderShort")} numeric rowSpan={showWorkflowDetails ? 2 : 1} />
          <CoverageColumnHeader label={t("rateColumn")} shortLabel={t("rateHeaderShort")} numeric rowSpan={showWorkflowDetails ? 2 : 1} />
          <CoverageColumnHeader label={t("coverageGradeColumn")} shortLabel={t("coverageGradeHeaderShort")} rowSpan={showWorkflowDetails ? 2 : 1} />
          <CoverageColumnHeader label={t("overdueCoverageColumn", { days: data.overdueDays })} shortLabel={t("overdueHeaderShort")} numeric rowSpan={showWorkflowDetails ? 2 : 1} />
          {showWorkflowDetails && <StatusHeaders idPrefix="coverage-territory-status" />}
        </TableRow>
        {showWorkflowDetails && <TableRow><StatusSubheaders idPrefix="coverage-territory-status" /></TableRow>}
      </TableHeader>
      <TableBody>
        {data.regions.map((region) => {
          const open = expanded.has(region.regionId);
          return (
            <Fragment key={region.regionId}>
              <TableRow className="cam-target-region">
                <TableHead scope="row" className="coverage-sticky-column h-auto whitespace-normal font-semibold text-foreground">
                  {/* The disclosure is the region name itself, so the whole
                      label is the target rather than a chevron beside it. */}
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-left hover:underline"
                    onClick={() => onToggle(region.regionId)}
                    aria-expanded={open}
                  >
                    {open
                      ? <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
                      : <ChevronRight className="size-4 shrink-0" aria-hidden="true" />}
                    <span>{region.name}</span>
                  </button>
                  <span className="ms-5 block text-xs text-muted-foreground">
                    {region.mode === "UNSET" ? t("quotaModeNotSet") : modeLabel(region.mode, locale)}
                  </span>
                </TableHead>
                <CountCells
                  companyCount={region.companyCount}
                  registered={region.registered}
                  target={region.inscriptionTarget}
                  rate={region.rate}
                  registeredInYear={region.registeredInYear}
                  pendingApproval={region.pendingApproval}
                  pendingReview={region.pendingReview}
                  complementsRequested={region.complementsRequested}
                  documentsIncomplete={region.documentsIncomplete}
                  draft={region.draft}
                  overdue={region.overdue}
                  overdueHref={overdueHref?.(region.name)}
                  statusHeaderPrefix="coverage-territory-status"
                  showWorkflowDetails={showWorkflowDetails}
                />
              </TableRow>
              {open &&
                region.departments.map((department) => (
                  <TableRow key={department.departmentId} className="cam-target-dept">
                    <TableHead scope="row" className="coverage-sticky-column h-auto whitespace-normal ps-9 font-normal text-muted-foreground">
                      {department.name}
                    </TableHead>
                    <CountCells
                      companyCount={department.companyCount}
                      registered={department.registered}
                      target={department.inscriptionTarget}
                      rate={department.rate}
                      registeredInYear={department.registeredInYear}
                      pendingApproval={department.pendingApproval}
                      pendingReview={department.pendingReview}
                      complementsRequested={department.complementsRequested}
                      documentsIncomplete={department.documentsIncomplete}
                      draft={department.draft}
                      overdue={department.overdue}
                      overdueHref={overdueHref?.(region.name, department.name)}
                      statusHeaderPrefix="coverage-territory-status"
                      showWorkflowDetails={showWorkflowDetails}
                    />
                  </TableRow>
                ))}
            </Fragment>
          );
        })}

        {/* The national buckets close the grid: they are not territories, so
            they carry no mode and no target of their own (except central). */}
        {data.central && (
          <BucketRow name={t("centralLevel")} counts={data.central} target={data.central.inscriptionTarget ?? null} rate={data.central.rate ?? null} statusHeaderPrefix="coverage-territory-status" showWorkflowDetails={showWorkflowDetails} />
        )}
        {data.unassigned && (
          <BucketRow name={t("unassigned")} counts={data.unassigned} target={null} rate={null} statusHeaderPrefix="coverage-territory-status" showWorkflowDetails={showWorkflowDetails} />
        )}
        {data.nullEntityType && (
          <BucketRow name={t("missingEntityType")} counts={data.nullEntityType} target={null} rate={null} statusHeaderPrefix="coverage-territory-status" showWorkflowDetails={showWorkflowDetails} />
        )}
        <TableRow className="cam-target-region coverage-total-row">
          <TableHead scope="row" className="coverage-sticky-column h-auto whitespace-normal font-semibold text-foreground">{t("total")}</TableHead>
          <CountCells
            companyCount={data.totals.companyCount}
            registered={data.totals.registered}
            target={data.totals.inscriptionTarget}
            rate={data.totals.rate}
            registeredInYear={data.totals.registeredInYear}
            pendingApproval={data.totals.pendingApproval}
            pendingReview={data.totals.pendingReview}
            complementsRequested={data.totals.complementsRequested}
            documentsIncomplete={data.totals.documentsIncomplete}
            draft={data.totals.draft}
            overdue={data.totals.overdue}
            statusHeaderPrefix="coverage-territory-status"
            showWorkflowDetails={showWorkflowDetails}
          />
        </TableRow>
      </TableBody>
    </Table>
    </>
  );
}

function BucketRow({
  name,
  counts,
  target,
  rate,
  statusHeaderPrefix,
  showWorkflowDetails,
}: {
  name: string;
  counts: StockCounts;
  target: number | null;
  rate: number | null;
  statusHeaderPrefix: string;
  showWorkflowDetails: boolean;
}) {
  return (
    <TableRow className="cam-target-region coverage-bucket-row">
      <TableHead scope="row" className="coverage-sticky-column h-auto whitespace-normal font-medium text-foreground">{name}</TableHead>
      <CountCells
        companyCount={counts.companyCount}
        registered={counts.registered}
        target={target}
        rate={rate}
        registeredInYear={counts.registeredInYear}
        pendingApproval={counts.pendingApproval}
        pendingReview={counts.pendingReview}
        complementsRequested={counts.complementsRequested}
        documentsIncomplete={counts.documentsIncomplete}
        draft={counts.draft}
        overdue={counts.overdue}
        statusHeaderPrefix={statusHeaderPrefix}
        showWorkflowDetails={showWorkflowDetails}
      />
    </TableRow>
  );
}

function CountCells({
  companyCount,
  registered,
  target,
  rate,
  registeredInYear,
  pendingApproval,
  pendingReview,
  complementsRequested,
  documentsIncomplete,
  draft,
  overdue,
  overdueHref,
  statusHeaderPrefix,
  showWorkflowDetails,
}: {
  companyCount: number | null;
  registered: number | null;
  target: number | null;
  rate: number | null;
  registeredInYear: number | null;
  pendingApproval: number | null;
  pendingReview: number | null;
  complementsRequested: number | null;
  documentsIncomplete: number | null;
  draft: number | null;
  overdue: number | null;
  overdueHref?: string | null;
  statusHeaderPrefix: string;
  showWorkflowDetails: boolean;
}) {
  const locale = asUiLocale(useLocale());
  const values: Record<CoverageStatusMetric, number | null> = {
    pendingApproval,
    pendingReview,
    complementsRequested,
    documentsIncomplete,
    draft,
  };
  return (
    <>
      <TableCell className={NUM}>{formatCoverageCount(registered, companyCount, locale)}</TableCell>
      <TableCell className={`${NUM} coverage-period-cell`} headers="coverage-territory-registered-period">
        {formatCoverageCount(registeredInYear, companyCount, locale)}
      </TableCell>
      <TableCell className={NUM}>{fmt(target, locale)}</TableCell>
      <TableCell className={NUM}>{fmt(target != null && target > 0 && registeredInYear != null ? Math.max(0, target - registeredInYear) : null, locale)}</TableCell>
      <TableCell className={NUM}>{fmtRate(rate, locale)}</TableCell>
      <CoverageGradeCell rate={rate} />
      <TableCell className={NUM}>
        {overdueHref && overdue != null && overdue > 0 ? (
          <Link href={overdueHref} className="cam-badge cam-badge-warning coverage-overdue-link">
            {fmt(overdue, locale)}
          </Link>
        ) : fmt(overdue, locale)}
      </TableCell>
      {showWorkflowDetails && COVERAGE_STATUS_METRICS.map((metric) => (
        <TableCell key={metric.value} className={NUM} headers={`${statusHeaderPrefix}-group ${statusHeaderPrefix}-${metric.value}`}>
          {formatCoverageCount(values[metric.value], companyCount, locale)}
        </TableCell>
      ))}
    </>
  );
}

function CoverageGradeCell({ rate }: { rate: number | null }) {
  const t = useTranslations("adminPilotagePage");
  const tTargets = useTranslations("adminTargets");
  const grade = coverageGrade(rate);
  const badgeTone = grade?.key === "critical" || grade?.key === "veryPoor"
    ? "cam-badge-error"
    : grade?.key === "poor"
      ? "cam-badge-warning"
      : grade?.key === "average"
        ? "cam-badge-info"
        : grade
          ? "cam-badge-success"
          : null;
  return (
    <TableCell aria-label={grade ? t(grade.labelKey) : tTargets("coverageGradeUnavailable")}>
      {grade ? (
        <span className={`cam-badge ${badgeTone} coverage-grade-badge`}>{t(grade.labelKey)}</span>
      ) : "—"}
    </TableCell>
  );
}

// Shared formatters (G12): one locale decision, in lib/admin-data-state.
function fmt(value: number | null | undefined, locale: UiLocale): string {
  return count(value, locale);
}

// A 0–1 ratio as a percentage with at most one decimal: "50 %", "50,5 %".
function fmtRate(rate: number | null | undefined, locale: UiLocale): string {
  return percent(rate == null ? null : rate * 100, 1, locale, 0);
}

/**
 * The same registration stock, by entity type.
 *
 * Entity types have no quota because quotas are territorial, but they do have
 * a measurable register share: registered companies divided by all companies
 * of that type. The note under the table distinguishes the share from quota
 * attainment, which has no entity-type denominator.
 *
 * The server lists every type, zeros included, on the same terms as the
 * campaign-returns breakdown, so the two read in the same order.
 */
export function CoverageEntityTypeTable({
  rows,
  overdueDays,
  overdueHref,
}: {
  rows: CoverageEntityTypeRow[];
  overdueDays: number;
  overdueHref?: (entityType: string) => string | null;
}) {
  const t = useTranslations("adminTargets");
  const tRoot = useTranslations();
  const locale = asUiLocale(useLocale());
  const [showWorkflowDetails, setShowWorkflowDetails] = useState(false);
  const label = (code: string) =>
    ENTITY_TYPE_OPTION_KEYS[code] ? tRoot(ENTITY_TYPE_OPTION_KEYS[code]) : entityTypeLabel(code);

  return (
    <>
      <div className="mb-2 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={showWorkflowDetails}
          aria-controls="coverage-type-table"
          onClick={() => setShowWorkflowDetails((shown) => !shown)}
        >
          {showWorkflowDetails ? t("hideWorkflowDetails") : t("showWorkflowDetails")}
        </Button>
      </div>
      <Table
        id="coverage-type-table"
        className={`cam-dash-table cam-target-table cam-registration-coverage-table${showWorkflowDetails ? " is-workflow-expanded" : ""}`}
      >
        <TableHeader>
          <TableRow>
            <CoverageColumnHeader label={t("entityTypeColumn")} shortLabel={t("entityTypeHeaderShort")} rowSpan={showWorkflowDetails ? 2 : 1} className="coverage-sticky-column" />
            <CoverageColumnHeader label={t("companyCountColumn")} shortLabel={t("companyCountHeaderShort")} numeric rowSpan={showWorkflowDetails ? 2 : 1} />
            <CoverageColumnHeader label={t("registeredColumn")} shortLabel={t("registeredHeaderShort")} numeric rowSpan={showWorkflowDetails ? 2 : 1} />
            <CoverageColumnHeader label={t("registerShareColumn")} shortLabel={t("registerShareHeaderShort")} numeric rowSpan={showWorkflowDetails ? 2 : 1} />
            <TableHead scope="col" id="coverage-type-registered-period" aria-label={t("inYearColumn")} rowSpan={showWorkflowDetails ? 2 : 1} className={`${NUM} whitespace-nowrap coverage-period-header`}>
              {t("registeredInPeriodHeaderShort")}
            </TableHead>
            {/* Quota, Écart and Taux sit where the territory grid puts them,
                so the two tabs read the same way round. */}
            <CoverageColumnHeader label={t("coverageTargetColumn")} shortLabel={t("quotaHeaderShort")} numeric rowSpan={showWorkflowDetails ? 2 : 1} />
            <CoverageColumnHeader label={t("gapColumn")} shortLabel={t("gapHeaderShort")} numeric rowSpan={showWorkflowDetails ? 2 : 1} />
            <CoverageColumnHeader label={t("rateColumn")} shortLabel={t("rateHeaderShort")} numeric rowSpan={showWorkflowDetails ? 2 : 1} />
            <CoverageColumnHeader label={t("coverageGradeColumn")} shortLabel={t("coverageGradeHeaderShort")} rowSpan={showWorkflowDetails ? 2 : 1} />
            <CoverageColumnHeader label={t("overdueCoverageColumn", { days: overdueDays })} shortLabel={t("overdueHeaderShort")} numeric rowSpan={showWorkflowDetails ? 2 : 1} />
            {showWorkflowDetails && <StatusHeaders idPrefix="coverage-type-status" />}
          </TableRow>
          {showWorkflowDetails && <TableRow><StatusSubheaders idPrefix="coverage-type-status" /></TableRow>}
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const queueHref = overdueHref?.(row.entityType) ?? null;
            return (
            <TableRow key={row.entityType}>
              <TableHead scope="row" className="coverage-sticky-column h-auto whitespace-normal font-medium text-foreground">
                {label(row.entityType)}
              </TableHead>
              <TableCell className={NUM}>{fmt(row.companyCount, locale)}</TableCell>
              <TableCell className={NUM}>{formatCoverageCount(row.registered, row.companyCount, locale)}</TableCell>
              <TableCell className={NUM}>{fmtRate(row.companyCount > 0 ? row.registered / row.companyCount : null, locale)}</TableCell>
              <TableCell className={`${NUM} coverage-period-cell`} headers="coverage-type-registered-period">
                {formatCoverageCount(row.registeredInYear, row.companyCount, locale)}
              </TableCell>
              <TableCell className={NUM}>{fmt(row.inscriptionTarget ?? null, locale)}</TableCell>
              {/* The gap counts against the same numerator as the rate: what
                  the year still owes, never a negative once it is met. */}
              <TableCell className={NUM}>
                {fmt(
                  row.inscriptionTarget != null && row.inscriptionTarget > 0
                    ? Math.max(0, row.inscriptionTarget - row.registeredInYear)
                    : null,
                  locale,
                )}
              </TableCell>
              <TableCell className={NUM}>{fmtRate(row.rate ?? null, locale)}</TableCell>
              <CoverageGradeCell rate={row.rate ?? null} />
              <TableCell className={NUM}>
                {queueHref && row.overdue > 0 ? (
                  <Link href={queueHref} className="cam-badge cam-badge-warning coverage-overdue-link">
                    {fmt(row.overdue, locale)}
                  </Link>
                ) : fmt(row.overdue, locale)}
              </TableCell>
              {showWorkflowDetails && COVERAGE_STATUS_METRICS.map((metric) => {
                const value: Record<CoverageStatusMetric, number | null> = {
                  pendingApproval: row.pendingApproval,
                  pendingReview: row.pendingReview,
                  complementsRequested: row.complementsRequested,
                  documentsIncomplete: row.documentsIncomplete,
                  draft: row.draft,
                };
                return (
                  <TableCell key={metric.value} className={NUM} headers={`coverage-type-status-group coverage-type-status-${metric.value}`}>
                    {formatCoverageCount(value[metric.value], row.companyCount, locale)}
                  </TableCell>
                );
              })}
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="mt-3 text-sm text-muted-foreground">{t("entityTypeQuotaNote")}</p>
    </>
  );
}
