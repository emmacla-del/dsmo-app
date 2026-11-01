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
  parseDossierStatus,
  parseDossierVue,
  resolveDossierQueueView,
  type DossierQueueView,
} from "./admin-url";

export interface DossierNeighbourQuery {
  view: DossierQueueView | null;
  filters: {
    status?: string;
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
  const url = new URL(returnTo, "https://camleap.invalid");
  const params = url.searchParams;
  const suffix = parseDossierVue(params.get("vue")) === "completed" ? "completed" : "submissions";
  const value = (key: string) => params.get(`${suffix}${key[0].toUpperCase()}${key.slice(1)}`);
  const status = parseDossierStatus(value("status"));
  const assignment = parseDossierAssignment(value("assignment")) || (parseDossierFlag(value("assignedToMe")) ? "me" : "");
  const requested = parseDossierQueueView(params.get("queueView"));
  const hasOtherFilters = hasDossierOtherFilters(value, params.get("campaignId"));
  const view = suffix === "submissions"
    ? resolveDossierQueueView({ requested, status, assignment, hasOtherFilters, readOnly })
    : null;
  const viewFilters = view ? dossierQueueViewFilters(view) : null;
  const effectiveAssignment = viewFilters?.assignment ?? (
    view === "pending" && assignment === "other" ? "other" : viewFilters ? "" : assignment
  );
  const campaignId = params.get("campaignId")?.trim() ?? "";
  const filters: DossierNeighbourQuery["filters"] = {
    ...(viewFilters ? { status: viewFilters.status } : status ? { status } : {}),
    ...(value("formType")?.trim() ? { formType: value("formType")!.trim() } : {}),
    ...(value("region")?.trim() ? { region: value("region")!.trim() } : {}),
    ...(value("department")?.trim() ? { department: value("department")!.trim() } : {}),
    ...(parseDossierPeriod(value("period")) ? { period: parseDossierPeriod(value("period")) } : {}),
    ...(campaignId ? { campaignId } : {}),
    ...(!campaignId && parseDossierQuarter(value("quarterCode")) ? { quarterCode: parseDossierQuarter(value("quarterCode"))! } : {}),
    ...(parseDossierFlag(value("late")) ? { late: true } : {}),
    ...(parseDossierFlag(value("overdue")) ? { overdue: true } : {}),
    ...(parseDossierQuality(value("quality")) ? { quality: parseDossierQuality(value("quality")) as "clean" | "warnings" | "blocking" } : {}),
    ...(value("search")?.trim() ? { search: value("search")!.trim() } : {}),
    ...(value("companyId")?.trim() ? { companyId: value("companyId")!.trim() } : {}),
    ...(effectiveAssignment ? { assignment: effectiveAssignment } : {}),
    ...(parseDossierSort(value("sort")) ? { sort: "oldest" as const } : {}),
    ...(suffix === "completed" ? { includeArchived: params.get("completedIncludeArchived") !== "false" } : {}),
  };
  return { view, filters };
}
