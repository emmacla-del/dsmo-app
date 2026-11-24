import {
  hasDossierOtherFilters,
  dossierQueueViewFilters,
  parseDossierAssignment,
  parseDossierFlag,
  parseDossierPeriod,
  parseDossierQuarter,
  parseDossierQueueView,
  parseDossierQuality,
  parseDossierSort,
  parseDossierStatusFilter,
  parseDossierVue,
  legacyCompletedDossierHref,
  resolveDossierQueueView,
  type DossierQueueView,
} from "./admin-url";

export interface DossierNeighbourQuery {
  hasListContext: boolean;
  view: DossierQueueView | null;
  filters: {
    status?: string;
    statuses?: string;
    formType?: string;
    region?: string;
    department?: string;
    period?: string;
    campaignId?: string;
    quarterCode?: string;
    late?: boolean;
    overdue?: boolean;
    quality?: "clean" | "warnings" | "blocking";
    search?: string;
    companyId?: string;
    assignment?: "me" | "unassigned" | "other";
    sort?: "oldest";
    includeArchived?: boolean;
  };
}

/** Translate the saved queue return URL into the exact list filters for neighbours. */
export function dossierNeighbourQuery(returnTo: string, readOnly = false): DossierNeighbourQuery {
  const initial = new URL(returnTo, "https://camleap.invalid");
  const url = parseDossierVue(initial.searchParams.get("vue")) === "completed"
    ? new URL(legacyCompletedDossierHref(initial.searchParams.toString()), "https://camleap.invalid")
    : initial;
  const params = url.searchParams;
  const hasListContext = url.pathname === "/admin/dossiers" && (
    params.has("vue") || params.has("queueView") || [...params.keys()].some((key) => key.startsWith("submissions"))
  );
  const suffix = "submissions";
  const value = (key: string) => params.get(`${suffix}${key[0].toUpperCase()}${key.slice(1)}`);
  const status = parseDossierStatusFilter(value("status"));
  const terminalSelection = status === "COMPLETED" || status === "ALL" || status === "APPROVED" || status === "REJECTED" || status === "SUPERSEDED";
  const assignment = parseDossierAssignment(value("assignment")) || (parseDossierFlag(value("assignedToMe")) ? "me" : "");
  const requested = parseDossierQueueView(params.get("queueView"));
  const hasOtherFilters = hasDossierOtherFilters(value, params.get("campaignId"));
  const view = resolveDossierQueueView({ requested, status, assignment, hasOtherFilters, readOnly });
  const viewFilters = view ? dossierQueueViewFilters(view) : null;
  const effectiveAssignment = terminalSelection ? "" : viewFilters?.assignment ?? (
    view === "pending" && assignment === "other" ? "other" : viewFilters ? "" : assignment
  );
  const campaignId = params.get("campaignId")?.trim() ?? "";
  const groupedStatuses = status === "COMPLETED"
    ? "APPROVED,REJECTED,SUPERSEDED"
    : status === "ALL"
      ? "PENDING_REVIEW,CORRECTION_REQUESTED,APPROVED,REJECTED,SUPERSEDED"
      : undefined;
  const filters: DossierNeighbourQuery["filters"] = {
    ...(viewFilters ? { status: viewFilters.status } : groupedStatuses ? { statuses: groupedStatuses } : status ? { status } : {}),
    ...(value("formType")?.trim() ? { formType: value("formType")!.trim() } : {}),
    ...(value("region")?.trim() ? { region: value("region")!.trim() } : {}),
    ...(value("department")?.trim() ? { department: value("department")!.trim() } : {}),
    ...(parseDossierPeriod(value("period")) ? { period: parseDossierPeriod(value("period")) } : {}),
    ...(campaignId ? { campaignId } : {}),
    ...(!campaignId && parseDossierQuarter(value("quarterCode")) ? { quarterCode: parseDossierQuarter(value("quarterCode"))! } : {}),
    ...(parseDossierFlag(value("late")) ? { late: true } : {}),
    ...(!terminalSelection && parseDossierFlag(value("overdue")) ? { overdue: true } : {}),
    ...(parseDossierQuality(value("quality")) ? { quality: parseDossierQuality(value("quality")) as "clean" | "warnings" | "blocking" } : {}),
    ...(value("search")?.trim() ? { search: value("search")!.trim() } : {}),
    ...(value("companyId")?.trim() ? { companyId: value("companyId")!.trim() } : {}),
    ...(effectiveAssignment ? { assignment: effectiveAssignment } : {}),
    ...(parseDossierSort(value("sort")) ? { sort: "oldest" as const } : {}),
    ...(parseDossierFlag(value("includeArchived")) ? { includeArchived: true } : {}),
  };
  return { hasListContext, view, filters };
}
