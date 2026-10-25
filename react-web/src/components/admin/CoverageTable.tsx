"use client";

import { Fragment } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ChevronRight } from "lucide-react";
import { asUiLocale, type UiLocale } from "@/lib/register-i18n";
import { count, percent } from "@/lib/admin-data-state";
import type { CoverageEntityTypeRow, CoverageResponse, StockCounts } from "@/lib/pilotage-targets";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel } from "@/lib/companies-directory";
import { formatCoverageCount, modeLabel } from "@/lib/pilotage-target-payload";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Right-aligned, tabular figures: a column of counts must line up. */
const NUM = "text-right tabular-nums";

export function CoverageTable({
  data,
  expanded,
  onToggle,
}: {
  data: CoverageResponse;
  expanded: Set<string>;
  onToggle: (regionId: string) => void;
}) {
  const t = useTranslations("adminTargets");
  const locale = asUiLocale(useLocale());
  const national = data.central != null || data.unassigned != null || data.nullEntityType != null;

  if (data.regions.length === 0 && !national) {
    return <p className="cam-admin-lede">{t("noTerritory")}</p>;
  }

  return (
    <>
    <Table className="cam-target-table">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">{t("territoryColumn")}</TableHead>
          <TableHead scope="col">{t("modeColumn")}</TableHead>
          <TableHead scope="col" className={NUM}>{t("registeredColumn")}</TableHead>
          <TableHead scope="col" className={NUM}>{t("coverageTargetColumn")}</TableHead>
          <TableHead scope="col" className={NUM}>{t("gapColumn")}</TableHead>
          <TableHead scope="col" className={NUM}>{t("rateColumn")}</TableHead>
          <TableHead scope="col" className={NUM}>{t("inYearColumn")}</TableHead>
          <TableHead scope="col" className={NUM}>{t("approvalColumn")}</TableHead>
          <TableHead scope="col" className={NUM}>{t("reviewColumn")}</TableHead>
          <TableHead scope="col" className={NUM}>{t("complementsColumn")}</TableHead>
          <TableHead scope="col" className={NUM}>{t("documentsIncompleteColumn")}</TableHead>
          <TableHead scope="col" className={NUM}>{t("draftColumn")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.regions.map((region) => {
          const open = expanded.has(region.regionId);
          return (
            <Fragment key={region.regionId}>
              <TableRow className="cam-target-region">
                <TableHead scope="row" className="h-auto whitespace-normal font-medium text-foreground">
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
                    {region.name}
                  </button>
                </TableHead>
                <TableCell>{modeLabel(region.mode, locale)}</TableCell>
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
                />
              </TableRow>
              {open &&
                region.departments.map((department) => (
                  <TableRow key={department.departmentId} className="cam-target-dept">
                    <TableHead scope="row" className="h-auto whitespace-normal ps-9 font-normal text-muted-foreground">
                      {department.name}
                    </TableHead>
                    <TableCell />
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
                    />
                  </TableRow>
                ))}
            </Fragment>
          );
        })}

        {/* The national buckets close the grid: they are not territories, so
            they carry no mode and no target of their own (except central). */}
        {data.central && (
          <BucketRow name={t("centralLevel")} counts={data.central} target={data.central.inscriptionTarget ?? null} rate={data.central.rate ?? null} />
        )}
        {data.unassigned && (
          <BucketRow name={t("unassigned")} counts={data.unassigned} target={null} rate={null} />
        )}
        {data.nullEntityType && (
          <BucketRow name={t("missingEntityType")} counts={data.nullEntityType} target={null} rate={null} />
        )}
        <TableRow className="cam-target-region font-semibold">
          <TableHead scope="row" className="h-auto whitespace-normal font-semibold text-foreground">{t("total")}</TableHead>
          <TableCell>—</TableCell>
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
          />
        </TableRow>
      </TableBody>
    </Table>
    <p className="mt-3 text-sm text-muted-foreground">{t("statusBreakdownNote")}</p>
    <p className="mt-1 text-sm text-muted-foreground">{t("coverageTotalScopeNote")}</p>
    </>
  );
}

function BucketRow({
  name,
  counts,
  target,
  rate,
}: {
  name: string;
  counts: StockCounts;
  target: number | null;
  rate: number | null;
}) {
  return (
    <TableRow className="cam-target-region">
      <TableHead scope="row" className="h-auto whitespace-normal font-medium text-foreground">{name}</TableHead>
      <TableCell>—</TableCell>
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
}) {
  const locale = asUiLocale(useLocale());
  return (
    <>
      <TableCell className={NUM}>{formatCoverageCount(registered, companyCount, locale)}</TableCell>
      <TableCell className={NUM}>{fmt(target, locale)}</TableCell>
      <TableCell className={NUM}>{fmt(target != null && target > 0 && registeredInYear != null ? Math.max(0, target - registeredInYear) : null, locale)}</TableCell>
      <TableCell className={NUM}>{fmtRate(rate, locale)}</TableCell>
      <TableCell className={NUM}>{formatCoverageCount(registeredInYear, companyCount, locale)}</TableCell>
      <TableCell className={NUM}>{formatCoverageCount(pendingApproval, companyCount, locale)}</TableCell>
      <TableCell className={NUM}>{formatCoverageCount(pendingReview, companyCount, locale)}</TableCell>
      <TableCell className={NUM}>{formatCoverageCount(complementsRequested, companyCount, locale)}</TableCell>
      <TableCell className={NUM}>{formatCoverageCount(documentsIncomplete, companyCount, locale)}</TableCell>
      <TableCell className={NUM}>{formatCoverageCount(draft, companyCount, locale)}</TableCell>
    </>
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
export function CoverageEntityTypeTable({ rows }: { rows: CoverageEntityTypeRow[] }) {
  const t = useTranslations("adminTargets");
  const tRoot = useTranslations();
  const locale = asUiLocale(useLocale());
  const label = (code: string) =>
    ENTITY_TYPE_OPTION_KEYS[code] ? tRoot(ENTITY_TYPE_OPTION_KEYS[code]) : entityTypeLabel(code);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{t("entityTypeColumn")}</TableHead>
            <TableHead scope="col" className={NUM}>{t("registeredColumn")}</TableHead>
            <TableHead scope="col" className={NUM}>{t("registerShareColumn")}</TableHead>
            <TableHead scope="col" className={NUM}>{t("inYearColumn")}</TableHead>
            <TableHead scope="col" className={NUM}>{t("approvalColumn")}</TableHead>
            <TableHead scope="col" className={NUM}>{t("reviewColumn")}</TableHead>
            <TableHead scope="col" className={NUM}>{t("complementsColumn")}</TableHead>
            <TableHead scope="col" className={NUM}>{t("documentsIncompleteColumn")}</TableHead>
            <TableHead scope="col" className={NUM}>{t("draftColumn")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.entityType}>
              <TableHead scope="row" className="h-auto whitespace-normal font-medium text-foreground">
                {label(row.entityType)}
              </TableHead>
              <TableCell className={NUM}>{formatCoverageCount(row.registered, row.companyCount, locale)}</TableCell>
              <TableCell className={NUM}>{fmtRate(row.companyCount > 0 ? row.registered / row.companyCount : null, locale)}</TableCell>
              <TableCell className={NUM}>{formatCoverageCount(row.registeredInYear, row.companyCount, locale)}</TableCell>
              <TableCell className={NUM}>{formatCoverageCount(row.pendingApproval, row.companyCount, locale)}</TableCell>
              <TableCell className={NUM}>{formatCoverageCount(row.pendingReview, row.companyCount, locale)}</TableCell>
              <TableCell className={NUM}>{formatCoverageCount(row.complementsRequested, row.companyCount, locale)}</TableCell>
              <TableCell className={NUM}>{formatCoverageCount(row.documentsIncomplete, row.companyCount, locale)}</TableCell>
              <TableCell className={NUM}>{formatCoverageCount(row.draft, row.companyCount, locale)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-3 text-sm text-muted-foreground">{t("statusBreakdownNote")}</p>
      <p className="mt-3 text-sm text-muted-foreground">{t("entityTypeNoQuotaNote")}</p>
    </>
  );
}
