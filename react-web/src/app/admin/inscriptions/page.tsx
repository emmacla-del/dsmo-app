"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";
import { enGB, fr } from "react-day-picker/locale";
import { useAuthStore } from "@/lib/auth-store";
import {
  approveUser,
  listCompanyRegistrations,
  rejectUser,
  requestComplements,
  type ApproveUserOptions,
  type CompanyRegistrationItem,
  type CompanyRegistrationsResult,
} from "@/lib/user-directory";
import { applyRegistrationDecision, type RegistrationDecisionStatus } from "@/lib/registration-queue-cache";
import { ENTITY_TYPE_OPTION_KEYS, hasRealNiu } from "@/lib/companies-directory";
import { asUiLocale } from "@/lib/register-i18n";
import { respondentFunctionLabel } from "@/lib/display-labels";
import { APPROVAL_ROLES, DIRECTORY_ROLES } from "@/lib/roles";
import {
  approvalGate,
  inscriptionsHref,
  registrationMethodBadgeClass,
  registrationMethodLabel,
  verificationFlags,
  verificationRows,
  type VerificationMarks,
  REGISTRATION_OVERDUE_DEFAULT_DAYS,
  daysWaiting,
} from "@/lib/inscriptions";
import { useTerritoryDepartments, useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { DataState, DataStateRow } from "@/components/admin/DataState";
import { FilterTableHead, FilterTableOptions } from "@/components/admin/FilterTableHead";
import { NOT_PROVIDED, count, resolveDataState, stamp } from "@/lib/admin-data-state";
import { CoveragePanel } from "@/components/admin/CoveragePanel";
import { doualaCalendarYear, parseYearParam } from "@/lib/pilotage-targets";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const PAGE_SIZE = 8;

/** The console tones, as Badge variants. */
type Tone = "neutral" | "success" | "warning" | "danger" | "info";

// API entity types, labelled through ENTITY_TYPE_OPTION_KEYS (the public
// wizard's labels, no administrative codes).
const ENTITY_TYPE_VALUES = ["ENTREPRISE", "COOPERATIVE", "CTD", "ONG", "ADMINISTRATION", "PROJECT_PROGRAM", "VOCATIONAL_TRAINING"];

// Company column names as the correction form presents them, so a reviewer
// reads the diff in the applicant's own words: keys under
// adminInscriptionsPage.field. An unmapped key falls back to itself rather
// than being hidden.
const FIELD_KEYS = new Set([
  "name", "taxNumber", "mainActivity", "secondaryActivity", "parentCompany", "address", "phone", "email",
  "cnpsNumber", "fax", "socialCapital", "entityType", "region", "department", "subdivision",
  "regionId", "departmentId", "subdivisionId",
]);

// The stored account status decides the badge: its label (a key under
// adminInscriptionsPage) and its tone. An unknown status shows as itself,
// neutral.
const STATUS_BADGE: Record<string, { textKey: string; tone: Tone }> = {
  PENDING_APPROVAL: { textKey: "badgePending", tone: "warning" },
  COMPLEMENTS_REQUESTED: { textKey: "badgeComplements", tone: "info" },
  ACTIVE: { textKey: "badgeApproved", tone: "success" },
  REJECTED: { textKey: "badgeRejected", tone: "danger" },
};

/**
 * registrationMethodBadgeClass() answers in `cam-badge-*` class names, and
 * /admin/utilisateurs still renders them that way. Rather than change a
 * helper two pages share, its answer is translated here.
 */
const CAM_BADGE_TONE: Record<string, Tone> = {
  "cam-badge-success": "success",
  "cam-badge-info": "info",
  "cam-badge-neutral": "neutral",
};

const REGISTRATION_METHOD_VALUES = [
  "SELF_REGISTRATION",
  "ADMIN_CREATED",
  "ASSISTED",
];

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function dateBoundary(date: Date, endOfDay = false): string {
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  // Registration dates follow the Cameroon calendar (Africa/Douala, UTC+1),
  // regardless of the reviewer's browser timezone.
  return `${dateKey}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+01:00`;
}

function formatQueueDate(date: Date, locale: "fr" | "en"): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

// Suspense because useSearchParams() requires it in the app router.
export default function InscriptionsPage() {
  return (
    <Suspense fallback={null}>
      <InscriptionsContent />
    </Suspense>
  );
}

function InscriptionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // /admin/equipe's "Voir les inscriptions" arrives with ?createdBy=<userId>:
  // every file that agent registered, so the status filter starts at "ALL"
  // rather than the review queue — the équipe card counts every status.
  const createdBy = searchParams.get("createdBy")?.trim() ?? "";
  const requestedStatus = searchParams.get("status") ?? "";
  const statusOptions = ["ALL", "PENDING_APPROVAL", "COMPLEMENTS_REQUESTED", "OVERDUE", "ACTIVE", "REJECTED"];
  const initialStatus = statusOptions.includes(requestedStatus) ? requestedStatus : createdBy ? "ALL" : "";
  // The coverage ranking links a region here (?region=<Region.name>), the
  // same vocabulary this page's own filter options use. It only seeds the
  // filter: changing it afterwards is local state, as every other filter is,
  // and the backend re-checks the region against the reader's jurisdiction.
  const initialRegion = searchParams.get("region")?.trim() ?? "";
  const initialDepartment = searchParams.get("department")?.trim() ?? "";
  // Two views of registrations: the review queue, and coverage against the
  // registration-campaign targets (moved here from /admin/cibles, which
  // forwards its old ?vue=couverture links). Both live in the URL, so a
  // reload keeps the view and the year.
  const vue: "file" | "couverture" = searchParams.get("vue") === "couverture" ? "couverture" : "file";
  const year = parseYearParam(searchParams.get("annee")) ?? doualaCalendarYear();
  const currentQuery = searchParams.toString();
  const role = useAuthStore((s) => s.user?.role);
  const canReadQueue = !!role && APPROVAL_ROLES.includes(role);
  // Same four roles the backend's POST /auth/admin/register-company accepts.
  const canRegisterAssisted = !!role && DIRECTORY_ROLES.includes(role);
  const queryClient = useQueryClient();
  const { regions: territoryRegions } = useTerritoryRegions();
  const tRoot = useTranslations();
  const t = useTranslations("adminInscriptionsPage");
  const locale = asUiLocale(useLocale());
  useEffect(() => {
    document.title = `${vue === "couverture" ? t("viewCoverage") : t("pageTitle")} | CAMLEAP`;
  }, [t, vue]);
  const entityLabel = (value: string | null) =>
    value && ENTITY_TYPE_OPTION_KEYS[value] ? tRoot(ENTITY_TYPE_OPTION_KEYS[value]) : value ?? "—";
  const fieldLabel = (field: string) => (FIELD_KEYS.has(field) ? t(`field.${field}`) : field);
  // An empty or absent before/after reads as a dash rather than as "null".
  const diffValue = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "string") return ENTITY_TYPE_OPTION_KEYS[value] ? tRoot(ENTITY_TYPE_OPTION_KEYS[value]) : value;
    return String(value);
  };

  const [organisationInput, setOrganisationInput] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [region, setRegion] = useState(initialRegion);
  const [department, setDepartment] = useState(initialDepartment);
  // The department list follows the chosen region; unscoped it is every
  // department, and the server narrows to the reader's territory regardless.
  const { departments: territoryDepartments } = useTerritoryDepartments(region || null);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [typeFilter, setTypeFilter] = useState("");
  const [registrationMethod, setRegistrationMethod] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [pendingDateRange, setPendingDateRange] = useState<DateRange | undefined>();
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState<CompanyRegistrationItem | null>(null);
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | "REQUEST_COMPLEMENTS">("APPROVE");
  const [comment, setComment] = useState("");
  const [centralChecked, setCentralChecked] = useState(false);
  // The reviewer's ✓/✗ per verified row. A row absent from the map is
  // unanswered, which is neither ✓ nor ✗.
  const [marks, setMarks] = useState<VerificationMarks>({});
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOrganisation(organisationInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [organisationInput]);

  const from = dateRange === "30"
    ? daysAgo(30)
    : dateRange === "90"
      ? daysAgo(90)
      : dateRange === "custom" && customDateRange?.from
        ? dateBoundary(customDateRange.from)
        : undefined;
  const to = dateRange === "custom" && customDateRange?.to
    ? dateBoundary(customDateRange.to, true)
    : undefined;

  // "OVERDUE" is a view of the queue, not a stored status: files the
  // reviewers have left waiting past the threshold set in /admin/parametres.
  const overdueOnly = statusFilter === "OVERDUE";
  const queueQuery = useQuery({
    queryKey: ["auth", "company-registrations", organisation, statusFilter, typeFilter, region, department, from, to, createdBy, registrationMethod, page],
    queryFn: () =>
      listCompanyRegistrations({
        organisation,
        status: overdueOnly ? undefined : statusFilter || undefined,
        overdue: overdueOnly || undefined,
        createdBy: createdBy || undefined,
        entityType: typeFilter || undefined,
        region: region || undefined,
        department: department || undefined,
        registrationMethod: registrationMethod || undefined,
        from,
        to,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: canReadQueue && vue === "file",
  });

  const closeReview = () => {
    setReviewing(null);
    setDecision("APPROVE");
    setComment("");
    setCentralChecked(false);
    setMarks({});
  };

  // The decided row and the counters change the moment the server confirms,
  // then the refetch has the last word (defect 20, as defect 9 did for the
  // file page): in-flight reads are cancelled so an older answer cannot
  // overwrite the decision.
  const done = (text: string, id: string, status: RegistrationDecisionStatus) => {
    const queue = { queryKey: ["auth", "company-registrations"] };
    void queryClient.cancelQueries(queue).then(() => {
      // Per cached page, not setQueriesData: each one was fetched under its
      // own status filter — key[3], the `statusFilter` in the key built
      // above — and a decision that moves the file out of that view has to
      // take it off that page, not restyle it in place.
      for (const query of queryClient.getQueryCache().findAll(queue)) {
        const view = query.queryKey[3];
        queryClient.setQueryData<CompanyRegistrationsResult>(query.queryKey, (page) =>
          applyRegistrationDecision(page, id, status, typeof view === "string" ? view : undefined),
        );
      }
      void queryClient.invalidateQueries(queue);
    });
    setNotice({ tone: "success", text });
    closeReview();
  };

  const failed = (e: Error) => setNotice({ tone: "error", text: e.message });

  const approveMutation = useMutation({
    mutationFn: ({ id, options }: { id: string; options: ApproveUserOptions }) => approveUser(id, options),
    onSuccess: (_data, { id }) => done(t("approvedNotice"), id, "ACTIVE"),
    onError: failed,
  });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectUser(id, reason),
    onSuccess: (_data, { id }) => done(t("rejectedNotice"), id, "REJECTED"),
    onError: failed,
  });
  const complementsMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) => requestComplements(id, message),
    onSuccess: (_data, { id }) => done(t("complementsNotice"), id, "COMPLEMENTS_REQUESTED"),
    onError: failed,
  });

  const rows = reviewing ? verificationRows(reviewing, locale) : [];
  const gate = approvalGate(rows, marks, locale);
  // Why Approuver cannot be confirmed yet, shown in the dialog next to the
  // decision; null once it can. The server enforces the same rules.
  const approveBlocked = !reviewing
    ? null
    : gate.message ??
      (reviewing.requiresCentralStructureCheck && !centralChecked
        ? t("centralCheckRequired")
        : null);

  const handleDecisionSubmit = () => {
    if (!reviewing) return;
    if (decision === "APPROVE") {
      if (approveBlocked) return;
      approveMutation.mutate({
        id: reviewing.id,
        options: { centralStructureConfirmed: centralChecked, ...verificationFlags(rows, marks) },
      });
    } else if (decision === "REJECT") {
      if (!comment.trim()) {
        setNotice({ tone: "error", text: t("rejectReasonRequired") });
        return;
      }
      rejectMutation.mutate({ id: reviewing.id, reason: comment.trim() });
    } else {
      if (!comment.trim()) {
        setNotice({ tone: "error", text: t("complementsMessageRequired") });
        return;
      }
      complementsMutation.mutate({ id: reviewing.id, message: comment.trim() });
    }
  };

  // The region filter is applied by the API, inside the reviewer's own
  // territory scope, so paging and the totals stay consistent with it.
  const items = queueQuery.data?.items ?? [];
  // null until the queue answers: a tile never shows a zero it has not read.
  const counts = queueQuery.data?.counts ?? null;
  // The threshold the server applied, so the labels match the flags.
  const overdueDays = queueQuery.data?.overdueDays ?? REGISTRATION_OVERDUE_DEFAULT_DAYS;
  const total = queueQuery.data?.total ?? 0;
  const pendingMutation = approveMutation.isPending || rejectMutation.isPending || complementsMutation.isPending;
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  const tableState = resolveDataState({
    roleAllowed: canReadQueue,
    isLoading: queueQuery.isLoading,
    isError: queueQuery.isError,
    error: queueQuery.error,
    rowCount: queueQuery.data ? items.length : null,
  });

  const registrationStatusSegments = counts ? [
    { key: "pending", label: t("statusPending"), value: counts.pending, tone: "pending" },
    { key: "complements", label: t("statusComplements"), value: counts.complements, tone: "correction" },
    { key: "approved", label: t("statusApproved"), value: counts.approved, tone: "approved" },
    { key: "rejected", label: t("statusRejected"), value: counts.rejected, tone: "rejected" },
  ] : [];
  const registrationStatusTotal = registrationStatusSegments.reduce((total, segment) => total + segment.value, 0);
  const hasActiveQueueFilters = Boolean(
    organisationInput.trim() || organisation || region || department || statusFilter || typeFilter ||
    registrationMethod || dateRange !== "all" || createdBy,
  );
  const clearQueueFilters = () => {
    setOrganisationInput("");
    setOrganisation("");
    setRegion("");
    setDepartment("");
    setStatusFilter("");
    setTypeFilter("");
    setRegistrationMethod("");
    setDateRange("all");
    setCustomDateRange(undefined);
    setPendingDateRange(undefined);
    setPage(1);
    const params = new URLSearchParams(currentQuery);
    params.delete("createdBy");
    params.delete("status");
    // Also the region the coverage ranking may have seeded, or clearing the
    // filters would leave it in the URL to come back on the next reload.
    params.delete("region");
    params.delete("department");
    router.replace(inscriptionsHref(params.toString(), "file"));
  };

  return (
    <div className="cam-admin-page cam-admin-workflow-page">
      {/* One tab bar, not two stacked rows plus a breadcrumb.
          The heading names the hub and the tabs name the destinations inside
          it, so nothing is said twice: the breadcrumb was a single segment
          repeating the rail, and the old <h1> repeated whichever tab was
          active. The two views of this page and the sibling register are one
          level to the reader, so they are one row. */}
      <AdminPageHeader
        title={tRoot("adminNav.hubs.inscriptions")}
        subtitle={t("dashboardSubtitle")}
        tabs={[
          { label: t("viewQueue"), href: inscriptionsHref(currentQuery, "file"), isActive: vue === "file" },
          { label: t("viewCoverage"), href: inscriptionsHref(currentQuery, "couverture"), isActive: vue === "couverture" },
          { label: tRoot("adminNav.routes.etablissements"), href: "/admin/etablissements" },
        ]}
        actions={
          <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
            <AdminHeaderActions showCampaignPill={false} />
            {canRegisterAssisted && (
              <Button asChild size="sm">
                <Link href="/admin/inscriptions/nouvelle">
                  {tRoot("adminNav.routes.nouvelleInscription")}
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {vue === "couverture" && (
        <CoveragePanel year={year} onYearChange={(next) => router.replace(inscriptionsHref(currentQuery, "couverture", { annee: next }))} />
      )}

      {vue === "file" && (<>
      {createdBy && (
        <Alert role="status" variant="info" className="my-4 flex items-center gap-3">
          <span>
            {t("createdByFilter")}{" "}
            <strong>{items.find((i) => i.createdBy === createdBy)?.createdByName ?? t("selectedOfficer")}</strong>
          </span>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="ms-auto h-auto px-0"
            onClick={() => {
              setStatusFilter("");
              setPage(1);
              router.replace(inscriptionsHref(currentQuery, "file", { createdBy: null }));
            }}
          >
            {t("removeFilter")}
          </Button>
        </Alert>
      )}

      {notice && (
        <Alert
          role={notice.tone === "error" ? "alert" : "status"}
          variant={notice.tone === "error" ? "destructive" : "success"}
          className="my-4 flex items-center gap-3"
        >
          <span>{notice.text}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ms-auto size-7"
            aria-label={t("closeAriaLabel")}
            onClick={() => setNotice(null)}
          >
            <X />
          </Button>
        </Alert>
      )}

      {/* Files the reviewers have not decided in time. The national
          administration may decide any file; this is where it sees which. */}
      {!!counts?.overdue && !overdueOnly && (
        <Alert role="status" variant="warning" className="my-4 flex items-center gap-3">
          <span>{t("overdueNotice", { count: counts.overdue, days: overdueDays })}</span>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="ms-auto h-auto px-0"
            onClick={() => { setStatusFilter("OVERDUE"); setPage(1); }}
          >
            {t("overdueShow")}
          </Button>
        </Alert>
      )}

      {canReadQueue && (
        <section className="cam-dash-block cam-dash-panel" aria-labelledby="registration-status-title">
          <div className="cam-dash-block-head">
            <h2 id="registration-status-title" className="cam-dash-block-title">{t("statusDistributionTitle")}</h2>
            <span className="cam-dash-context">{t("statusDistributionContext")}</span>
          </div>
          {queueQuery.isError ? (
            <DataState
              state="error"
              resource={t("registrationStatusResource")}
              error={queueQuery.error}
              onRetry={() => queueQuery.refetch()}
            />
          ) : queueQuery.isLoading || !counts ? (
            <DataState state="loading" resource={t("registrationStatusResource")} dense />
          ) : registrationStatusTotal === 0 ? (
            <DataState state="empty" resource={t("registrationStatusResource")} dense />
          ) : (
            <>
              <div
                className="cam-dash-status-bar"
                role="img"
                aria-label={t("statusDistributionAria", {
                  pending: counts.pending,
                  complements: counts.complements,
                  approved: counts.approved,
                  rejected: counts.rejected,
                })}
              >
                {/* The width is the datum, so it stays an inline style. */}
                {registrationStatusSegments.map((segment) => (
                  <span
                    key={segment.key}
                    className={`cam-dash-status-segment is-${segment.tone}`}
                    style={{ width: `${(segment.value / registrationStatusTotal) * 100}%` }}
                  />
                ))}
              </div>
              <ul className="cam-dash-status-legend">
                {registrationStatusSegments.map((segment) => (
                  <li key={segment.key}>
                    <span className={`cam-dash-status-swatch is-${segment.tone}`} aria-hidden="true" />
                    <span className="cam-dash-status-label">{segment.label}</span>
                    <strong>{count(segment.value, locale)}</strong>
                  </li>
                ))}
              </ul>
              <p className="cam-dash-context cam-registration-overdue-summary">
                {t("overdueSummary", { count: count(counts.overdue, locale), days: overdueDays })}
              </p>
            </>
          )}
        </section>
      )}

      <Card>
        <CardContent>
          {hasActiveQueueFilters && (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={clearQueueFilters}>
                {t("clearFilters")}
              </Button>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <FilterTableHead label={t("organisationColumn")} filterLabel={t("filterColumn", { column: t("organisationColumn") })} active={!!organisation}>
                  {(close) => (
                    <div className="grid gap-2">
                      <Label htmlFor="queue-organisation-filter">{t("organisationFilterLabel")}</Label>
                      <Input
                        id="queue-organisation-filter"
                        value={organisationInput}
                        onChange={(event) => setOrganisationInput(event.target.value)}
                        placeholder={t("organisationFilterPlaceholder")}
                        onKeyDown={(event) => { if (event.key === "Enter") close(); }}
                      />
                    </div>
                  )}
                </FilterTableHead>
                <FilterTableHead label={t("establishmentTypeColumn")} filterLabel={t("filterColumn", { column: t("establishmentTypeColumn") })} active={!!typeFilter}>
                  {(close) => (
                    <FilterTableOptions
                      label={t("typeFilterLabel")}
                      value={typeFilter}
                      onChange={(value) => { setTypeFilter(value); setPage(1); }}
                      onSelect={close}
                      options={[
                        { value: "", label: t("allTypes") },
                        ...ENTITY_TYPE_VALUES.map((value) => ({ value, label: entityLabel(value) })),
                      ]}
                    />
                  )}
                </FilterTableHead>
                {/* One column shows "Région / Département", so it carries both
                    selectors rather than splitting the cell in two. The
                    department list follows the chosen region; with no region
                    chosen it is every department, which the server still
                    narrows to the reader's own territory. */}
                <FilterTableHead label={t("regionColumn")} filterLabel={t("filterColumn", { column: t("regionColumn") })} active={!!region || !!department}>
                  {(close) => (
                    <div className="grid gap-3">
                      <FilterTableOptions
                        label={t("regionColumn")}
                        value={region}
                        onChange={(value) => { setRegion(value); setDepartment(""); setPage(1); }}
                        onSelect={close}
                        options={[
                          { value: "", label: t("allRegions") },
                          ...territoryRegions.map((item) => ({ value: item, label: item })),
                        ]}
                      />
                      <FilterTableOptions
                        label={t("departmentColumn")}
                        value={department}
                        onChange={(value) => { setDepartment(value); setPage(1); }}
                        onSelect={close}
                        options={[
                          { value: "", label: t("allDepartments") },
                          ...territoryDepartments.map((item) => ({ value: item, label: item })),
                        ]}
                      />
                    </div>
                  )}
                </FilterTableHead>
                <FilterTableHead label={t("submissionDateColumn")} filterLabel={t("filterColumn", { column: t("submissionDateColumn") })} active={dateRange !== "all"} contentClassName="w-[19rem] p-3">
                  {(close) => (
                    <div className="grid gap-3">
                      <div className="grid gap-1" role="group" aria-label={t("dateFilterLabel")}>
                        {[
                          { value: "all", label: t("allDates") },
                          { value: "30", label: t("last30Days") },
                          { value: "90", label: t("last90Days") },
                        ].map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            variant={dateRange === option.value ? "secondary" : "ghost"}
                            size="sm"
                            className="w-full justify-start"
                            aria-pressed={dateRange === option.value}
                            onClick={() => {
                              setDateRange(option.value);
                              setCustomDateRange(undefined);
                              setPendingDateRange(undefined);
                              setPage(1);
                              close();
                            }}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                      <div className="border-t pt-3">
                        <p className="mb-2 text-sm font-medium">{t("customDateRange")}</p>
                        <DayPicker
                          mode="range"
                          selected={pendingDateRange}
                          onSelect={setPendingDateRange}
                          locale={locale === "fr" ? fr : enGB}
                          disabled={{ after: new Date() }}
                          className="mx-auto"
                          classNames={{
                            months: "flex",
                            month: "space-y-3",
                            month_caption: "relative flex h-8 items-center justify-center",
                            caption_label: "text-sm font-medium",
                            nav: "flex items-center gap-1",
                            button_previous: "absolute left-0 inline-flex size-8 items-center justify-center rounded-md border border-input bg-background hover:bg-accent",
                            button_next: "absolute right-0 inline-flex size-8 items-center justify-center rounded-md border border-input bg-background hover:bg-accent",
                            month_grid: "w-full border-collapse",
                            weekdays: "flex",
                            weekday: "w-9 rounded-md text-center text-[0.8rem] font-normal text-muted-foreground",
                            weeks: "mt-2 flex flex-col gap-1",
                            week: "flex w-full",
                            day: "relative size-9 p-0 text-center text-sm focus-within:z-20 [&:has([aria-selected])]:bg-accent/60",
                            day_button: "inline-flex size-9 items-center justify-center rounded-md p-0 font-normal hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                            range_start: "rounded-l-md bg-accent",
                            range_end: "rounded-r-md bg-accent",
                            range_middle: "rounded-none bg-accent/60",
                            today: "font-semibold text-primary",
                            outside: "text-muted-foreground opacity-50",
                            disabled: "text-muted-foreground opacity-40",
                          }}
                        />
                        <p className="mt-2 min-h-5 text-xs text-muted-foreground" aria-live="polite">
                          {pendingDateRange?.from
                            ? pendingDateRange.to
                              ? `${formatQueueDate(pendingDateRange.from, locale)} – ${formatQueueDate(pendingDateRange.to, locale)}`
                              : t("selectEndDate")
                            : t("selectDateRange")}
                        </p>
                        <div className="mt-2 flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            disabled={!pendingDateRange?.from || !pendingDateRange.to}
                            onClick={() => {
                              if (!pendingDateRange?.from || !pendingDateRange.to) return;
                              setCustomDateRange(pendingDateRange);
                              setDateRange("custom");
                              setPage(1);
                              close();
                            }}
                          >
                            {t("applyDateRange")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </FilterTableHead>
                <FilterTableHead label={t("registrationSourceColumn")} filterLabel={t("filterColumn", { column: t("registrationSourceColumn") })} active={!!registrationMethod || !!createdBy}>
                  {(close) => (
                    <FilterTableOptions
                      label={t("registrationMethodFilterLabel")}
                      value={registrationMethod}
                      onChange={(value) => { setRegistrationMethod(value); setPage(1); }}
                      onSelect={close}
                      options={[
                        { value: "", label: t("allRegistrationMethods") },
                        ...REGISTRATION_METHOD_VALUES.map((value) => ({
                          value,
                          label: registrationMethodLabel(value, locale) ?? value,
                        })),
                      ]}
                    />
                  )}
                </FilterTableHead>
                <FilterTableHead label={t("registrationStatusColumn")} filterLabel={t("filterColumn", { column: t("registrationStatusColumn") })} active={!!statusFilter}>
                  {(close) => (
                    <FilterTableOptions
                      label={t("statusFilterLabel")}
                      value={statusFilter}
                      onChange={(value) => { setStatusFilter(value); setPage(1); }}
                      onSelect={close}
                      options={[
                        { value: "", label: t("statusInQueue") },
                        { value: "ALL", label: t("statusAll") },
                        { value: "PENDING_APPROVAL", label: t("statusPending") },
                        { value: "COMPLEMENTS_REQUESTED", label: t("statusComplements") },
                        { value: "OVERDUE", label: t("statusOverdue", { days: overdueDays }) },
                        { value: "ACTIVE", label: t("statusApproved") },
                        { value: "REJECTED", label: t("statusRejected") },
                      ]}
                    />
                  )}
                </FilterTableHead>
                <TableHead scope="col">{t("duplicatesColumn")}</TableHead>
                <TableHead scope="col">{t("actionColumn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Loading, failure, no access and "nothing matches" are four
                  distinct renders. */}
              <DataStateRow
                colSpan={8}
                state={tableState}
                resource={tRoot("adminNav.routes.inscriptions")}
                error={queueQuery.error}
                onRetry={() => queueQuery.refetch()}
                title={
                  tableState === "loading"
                    ? tRoot("common.loading")
                    : tableState === "error"
                      ? t("loadError")
                      : tableState === "forbidden"
                        ? t("noQueueAccess")
                        : tableState === "empty"
                          ? t("emptyTitle")
                          : undefined
                }
              />
              {items.map((item) => {
                const badge = STATUS_BADGE[item.status];
                return (
                  <TableRow key={item.id}>
                    <TableHead scope="row" className="h-auto whitespace-normal font-medium text-foreground">{item.organisation}</TableHead>
                    <TableCell>{entityLabel(item.entityType)}</TableCell>
                    <TableCell>{[item.region, item.department].filter(Boolean).join(" / ")}</TableCell>
                    <TableCell className="whitespace-nowrap">{stamp(item.submittedAt, true, locale)}</TableCell>
                    <TableCell>
                      {/* An assisted or admin-created file names its author; a
                          self-service one has none, which reads as the method
                          badge alone rather than as a missing name. */}
                      {item.createdByName && <span className="block text-muted-foreground">{item.createdByName}</span>}
                      <MethodBadge method={item.registrationMethod} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge?.tone ?? "neutral"}>
                        {badge ? t(badge.textKey) : item.status}
                      </Badge>
                      {item.overdue && (
                        <Badge variant="danger" className="mt-1 flex w-fit">
                          {t("overdueBadge", { days: daysWaiting(item.waitingSince) ?? overdueDays })}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{item.duplicateHints.length > 0 ? count(item.duplicateHints.length, locale) : NOT_PROVIDED}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => { setNotice(null); setReviewing(item); }}
                      >
                        {t("reviewButton")}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Only once the queue has answered (G10) and has rows: "0–0 sur 0"
          read as a count nobody had read while loading, and repeats the
          table's own empty state once loaded. */}
      {queueQuery.data && total > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-4 py-4 text-sm text-muted-foreground">
          <span>
            {t("showingRange", { start: count(start, locale), end: count(end, locale), total: count(total, locale) })}
          </span>
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            {t("previousButton")}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={end >= total} onClick={() => setPage((current) => current + 1)}>
            {t("nextButton")}
          </Button>
        </div>
      )}
      </>)}

      <AdminDialog
        open={!!reviewing}
        onClose={closeReview}
        title={t("reviewTitle", { organisation: reviewing?.organisation || "" })}
        eyebrow={t("reviewEyebrow")}
        footer={
          <>
            <Button type="button" variant="outline" onClick={closeReview} disabled={pendingMutation}>
              {tRoot("common.cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleDecisionSubmit}
              disabled={pendingMutation || (decision === "APPROVE" && !!approveBlocked)}
              aria-describedby={decision === "APPROVE" && approveBlocked ? "inscription-approve-blocked" : undefined}
            >
              {pendingMutation ? "…" : t("confirmButton")}
            </Button>
          </>
        }
      >
        {reviewing && (
          <div className="flex flex-col gap-3">
            {/* The dialog is modal, so the page-level notice sits behind it:
                a refused decision is repeated here, where the reviewer is. */}
            {notice?.tone === "error" && (
              <Alert variant="destructive">
                <span>{notice.text}</span>
              </Alert>
            )}
            <p className="m-0">{t("typeLine")} <strong>{entityLabel(reviewing.entityType)}</strong> — {reviewing.region} / {reviewing.department}</p>
            <p className="m-0">{t("niuLine", { niu: hasRealNiu(reviewing.taxNumber) ? reviewing.taxNumber ?? NOT_PROVIDED : NOT_PROVIDED })}</p>
            <p className="m-0">{t("registeredOnLine", { date: stamp(reviewing.submittedAt, true, locale) })}</p>
            {reviewing.duplicateHints.length > 0 && (
              <Alert role="status" variant="warning" className="block">
                {reviewing.duplicateHints.map((hint) => <p key={hint} className="m-0">{hint}</p>)}
              </Alert>
            )}
            {reviewing.lastResubmission && (
              <div>
                <p className="mt-0 mb-1">
                  <strong>{t("correctionsSent")}</strong> {t("correctionsSentOn", { date: stamp(reviewing.lastResubmission.at, true, locale) })}
                </p>
                {Object.keys(reviewing.lastResubmission.changes).length === 0 ? (
                  <p className="m-0">{t("resubmittedUnchanged")}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">{t("fieldColumn")}</TableHead>
                        <TableHead scope="col">{t("beforeColumn")}</TableHead>
                        <TableHead scope="col">{t("afterColumn")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(reviewing.lastResubmission.changes).map(([field, diff]) => (
                        <TableRow key={field}>
                          <TableHead scope="row" className="h-auto whitespace-normal font-medium text-foreground">{fieldLabel(field)}</TableHead>
                          <TableCell>{diffValue(diff.before)}</TableCell>
                          <TableCell>{diffValue(diff.after)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
            <h3 className="mt-2 mb-0 text-sm font-semibold text-foreground">{t("toVerifyTitle")}</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t("itemColumn")}</TableHead>
                  <TableHead scope="col">{t("declaredValueColumn")}</TableHead>
                  <TableHead scope="col">{t("verificationColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableHead scope="row" className="h-auto whitespace-normal font-medium text-foreground">{row.label}</TableHead>
                    <TableCell>{row.value ?? <span className="text-muted-foreground">{t("notRecorded")}</span>}</TableCell>
                    <TableCell>
                      {/* No value selected = not answered yet. An empty value
                          cannot be attested, so its ✓ is disabled. */}
                      <RadioGroup
                        aria-label={t("verificationAriaLabel", { label: row.label })}
                        className="flex flex-wrap gap-3"
                        value={marks[row.key] ?? ""}
                        onValueChange={(value) => setMarks((current) => ({ ...current, [row.key]: value as "ok" | "ko" }))}
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem id={`verify-${row.key}-ok`} value="ok" disabled={row.value === null} />
                          <Label htmlFor={`verify-${row.key}-ok`} className="font-normal">{t("compliant")}</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem id={`verify-${row.key}-ko`} value="ko" />
                          <Label htmlFor={`verify-${row.key}-ko`} className="font-normal">{t("nonCompliant")}</Label>
                        </div>
                      </RadioGroup>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div>
              <h3 className="mt-2 mb-0 text-sm font-semibold text-foreground">{t("respondentTitle")}</h3>
              <p className="cam-admin-choice-hint m-0">{t("respondentNote")}</p>
            </div>
            <dl className="cam-admin-kv">
              <div>
                <dt>{t("nameLabel")}</dt>
                <dd>{[reviewing.respondentFirstName, reviewing.respondentLastName].filter(Boolean).join(" ") || NOT_PROVIDED}</dd>
              </div>
              <div><dt>{t("functionLabel")}</dt><dd>{respondentFunctionLabel(reviewing.respondentFunction, locale) || NOT_PROVIDED}</dd></div>
              <div>
                <dt>{t("phoneLabel")}</dt>
                <dd>{[reviewing.respondentPhone, reviewing.respondentPhone2].filter(Boolean).join(" · ") || NOT_PROVIDED}</dd>
              </div>
              <div><dt>{t("loginEmailLabel")}</dt><dd>{reviewing.email}</dd></div>
              <div>
                <dt>{t("registeredByLabel")}</dt>
                <dd>
                  {reviewing.createdByName && <div>{reviewing.createdByName}</div>}
                  <MethodBadge method={reviewing.registrationMethod} />
                </dd>
              </div>
            </dl>
            {reviewing.requiresCentralStructureCheck && (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="inscription-central-check"
                  checked={centralChecked}
                  onCheckedChange={(c) => setCentralChecked(c === true)}
                />
                <Label htmlFor="inscription-central-check" className="font-normal leading-snug">
                  {t("centralConfirmed")}
                </Label>
              </div>
            )}
            <RadioGroup
              aria-label={t("decisionAriaLabel")}
              className="flex flex-col gap-2"
              value={decision}
              onValueChange={(value) => setDecision(value as typeof decision)}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="decision-approve" value="APPROVE" />
                <Label htmlFor="decision-approve" className="font-normal">{t("approveAccount")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="decision-reject" value="REJECT" />
                <Label htmlFor="decision-reject" className="font-normal">{t("rejectAccount")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="decision-complements" value="REQUEST_COMPLEMENTS" />
                <Label htmlFor="decision-complements" className="font-normal">{t("requestComplements")}</Label>
              </div>
            </RadioGroup>
            {decision === "APPROVE" && approveBlocked && (
              <p id="inscription-approve-blocked" role="status" className="cam-admin-choice-hint m-0">
                {approveBlocked}
              </p>
            )}
            {decision !== "APPROVE" && (
              <div className="grid gap-2">
                <Label htmlFor="inscription-decision-comment">
                  {decision === "REJECT" ? t("rejectReasonLabel") : t("complementsMessageLabel")}
                </Label>
                <Textarea
                  id="inscription-decision-comment"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
            )}
          </div>
        )}
      </AdminDialog>
    </div>
  );
}

/** The registration-method badge, or a dash for a row that predates tracking. */
function MethodBadge({ method }: { method: string | null }) {
  const label = registrationMethodLabel(method, asUiLocale(useLocale()));
  if (!label) return <span className="text-muted-foreground">{NOT_PROVIDED}</span>;
  return <Badge variant={CAM_BADGE_TONE[registrationMethodBadgeClass(method)] ?? "neutral"}>{label}</Badge>;
}
