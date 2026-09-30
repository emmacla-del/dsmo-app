// src/lib/api-client.ts
//
// Phase 0 proof: talks to the existing NestJS backend exactly as Flutter
// does today — bearer JWT in an Authorization header (src/auth/jwt.strategy.ts
// uses ExtractJwt.fromAuthHeaderAsBearerToken(), not cookies). This is a
// deliberate deviation from the plan's aspirational "prefer httpOnly
// cookies" note: switching the auth transport is a real backend/security
// decision, not something to bundle silently into the first coexistence
// proof. Revisit only as its own explicit slice.
//
// No production backend origin is hardcoded elsewhere in this app — this is
// the single source, matching how lib/data/api_client.dart centralizes it
// on the Flutter side.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "development" ||
  (typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"))
    ? "http://localhost:3001/api"
    : "https://dsmo-app-2.onrender.com/api");

import type { Department, RegisterCompanyResult, Region, Sector, Subdivision, User } from "./user-types";

const TOKEN_STORAGE_KEY = "camleap.access_token";
const CACHED_USER_KEY = "camleap.cached_user";

// Mirrors api_client.dart's setToken(token, {persist}): "remember me" picks
// localStorage (survives browser restarts), otherwise sessionStorage
// (cleared when the tab closes). Both are read on lookup so a token written
// under either survives a mode switch mid-session.
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem(TOKEN_STORAGE_KEY) ??
    sessionStorage.getItem(TOKEN_STORAGE_KEY)
  );
}

export function setToken(token: string, remember: boolean = true): void {
  if (remember) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } else {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

// Best-effort offline fallback, same purpose as ApiClient.cacheUser in
// Flutter: lets a returning user with no connectivity see their last-known
// profile instead of being stranded on the login screen.
export function cacheUser(user: User): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
}

export function getCachedUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(CACHED_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function clearCachedUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CACHED_USER_KEY);
}

export class ApiError extends Error {
  public status: number;
  public body?: unknown;

  constructor(
    status: number,
    message: string,
    // Raw JSON body of the error response. Kept alongside `message` because
    // questionnaires.service.ts's submit endpoint has two distinct failure
    // shapes — a bilingual { message, missingFields } object, and (today,
    // taken first) a raw class-validator ValidationError[] with no top-level
    // .message at all — and callers that want field-level detail (see
    // formatValidationErrors below) need the original body, not just
    // whatever string this class happened to fall back to.
    body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    // body is an array for the raw class-validator rejection shape (see
    // questionnaires.service.ts's `throw new BadRequestException(dataErrors)`)
    // — arrays have no .message, so that case must not silently collapse to
    // res.statusText the way body?.message would.
    const message =
      (!Array.isArray(body) && body?.message) || res.statusText || `HTTP ${res.status}`;
    throw new ApiError(res.status, message, body);
  }

  // 204/empty-body responses (none in this surface today, but apiFetch is
  // shared) would throw on .json() — guard defensively.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// ── Auth ──────────────────────────────────────────────────────────────
// Mirrors lib/providers/auth_provider.dart's AuthNotifier one-to-one so the
// two frontends' auth behavior stays provably equivalent (Phase 1 gate:
// "authentication works end-to-end").

export type LoginResult =
  | { requiresTwoFactor: true; challengeToken: string }
  | { access_token: string; user: User };

export function login(email: string, password: string) {
  return apiFetch<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function verifyTwoFactor(challengeToken: string, code: string) {
  return apiFetch<{ access_token: string; user: User }>("/auth/2fa/verify", {
    method: "POST",
    body: JSON.stringify({ challengeToken, code }),
  });
}

export function getMe() {
  return apiFetch<User>("/auth/me");
}

export function logoutRequest(): void {
  clearToken();
  clearCachedUser();
}

// Self-service reset via security questions — the live "forgot password"
// flow (ForgotPasswordScreen in Flutter). The plain email-token
// /auth/forgot-password endpoint exists on the backend and in
// auth_provider.dart but is never called from any Flutter screen — confirmed
// dead client-side surface, not ported here for the same reason
// lib/onefop_form_models.dart isn't touched.
export function getResetQuestions(login: string) {
  return apiFetch<{ questions: { key: string; question: string }[] }>(
    "/auth/reset/questions",
    { method: "POST", body: JSON.stringify({ login }) },
  );
}

export function verifyResetAnswers(
  login: string,
  answers: Record<string, string>,
  newPassword: string,
) {
  return apiFetch<{ message: string }>("/auth/reset/verify", {
    method: "POST",
    body: JSON.stringify({ login, answers, newPassword }),
  });
}

// Admin-mediated reset: consumes the token a SUPER_ADMIN emailed via
// POST /auth/admin/reset-password (see ResetPasswordScreen in Flutter).
export function resetPasswordWithToken(token: string, newPassword: string) {
  return apiFetch<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

export function verifyEmailToken(token: string) {
  return apiFetch<{ message: string }>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function resendVerification() {
  return apiFetch<{ message: string }>("/auth/resend-verification", {
    method: "POST",
  });
}

// ── Sectors (Phase 1's one low-consequence admin screen) ────────────────

export function getSectors() {
  return apiFetch<Sector[]>("/sectors");
}

// ── Registration (company wizard) ────────────────────────────────────
// Ported from register_screen.dart / register_steps.dart — see
// register-constants.ts and register-options.ts for the per-entity-type
// field set and static option lists this consumes.

export function checkEmailAvailable(email: string) {
  return apiFetch<{ available: boolean }>(`/auth/check-email?email=${encodeURIComponent(email)}`);
}

export function getRegions() {
  return apiFetch<Region[]>("/locations/regions");
}

export function getDepartmentsByRegion(regionId: string) {
  return apiFetch<Department[]>(`/locations/regions/${encodeURIComponent(regionId)}/departments`);
}

export function getSubdivisionsByDepartment(departmentId: string) {
  return apiFetch<Subdivision[]>(`/locations/departments/${encodeURIComponent(departmentId)}/subdivisions`);
}

// Every field is optional here except the handful RegisterCompanyDto itself
// requires (email/password/companyName/region/address) — callers build this
// from EntityConfig's fields, which differ per entity type (see
// register-constants.ts), so most of the shape is inherently sparse per
// submission rather than always-present.
export interface RegisterCompanyPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "COMPANY";
  region?: string;
  department?: string;
  subdivision?: string;
  area?: string;
  entityType?: string;
  companyName: string;
  taxNumber?: string;
  mainActivity?: string;
  address: string;
  parentCompany?: string;
  secondaryActivity?: string;
  cnpsNumber?: string;
  socialCapital?: number;
  legalStatus?: string;
  cooperativeType?: string;
  yearOfCreation?: string;
  ctdType?: string;
  mainMission?: string;
  registrationNumber?: string;
  trainingDomains?: string;
  branch?: string;
  poBox?: string;
  phone?: string;
  phone2?: string;
  sigle?: string;
  cfpType?: string;
  educationSystem?: string;
  functionalStatus?: string;
  nonFunctionalReason?: string;
  nonFunctionalReasonOther?: string;
  promoterName?: string;
  promoterSex?: string;
  promoterPhone1?: string;
  promoterPhone2?: string;
  sectorId?: string;
  respondentFunction?: string;
  respondentPhone?: string;
  respondentPhone2?: string;
}

export function registerCompany(payload: RegisterCompanyPayload) {
  return apiFetch<RegisterCompanyResult>("/auth/register-company", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── DSMO Company profile ──────────────────────────────────────────────────
export interface CompanyProfile {
  id: string;
  name?: string;
  parentCompany?: string;
  mainActivity?: string;
  secondaryActivity?: string;
  region?: string;
  department?: string;
  subdivision?: string;
  address?: string;
  fax?: string;
  taxNumber?: string;
  cnpsNumber?: string;
  socialCapital?: number;
  totalEmployees?: number;
  menCount?: number;
  womenCount?: number;
  lastYearTotal?: number;
  // Backend enum spelling (ENTREPRISE/COOPERATIVE/...) — see
  // register-constants.ts's parseCompanyEntityType for the schema-registry
  // key this maps to. Set at registration; null only for accounts that
  // predate entity-type tracking (see home_screen.dart's fallback picker).
  entityType?: string | null;
  [key: string]: unknown;
}

export function getMyCompany() {
  return apiFetch<CompanyProfile>("/dsmo/company");
}

// Mirrors ApiClient.saveCompanyProfile (Dart) — required fields per
// RegisterCompanyProfileDto (src/dsmo/dto/register-company-profile.dto.ts):
// name/taxNumber/mainActivity/region/department/address; everything else,
// entityType included, is optional. Used both by the DSMO declaration
// wizard's autofill-on-change flow and by the one-time entity-type
// fallback in NewDeclarationDialog.
export interface SaveCompanyProfilePayload {
  name: string;
  taxNumber: string;
  mainActivity: string;
  region: string;
  department: string;
  address: string;
  parentCompany?: string;
  secondaryActivity?: string;
  cnpsNumber?: string;
  fax?: string;
  socialCapital?: number;
  subdivision?: string;
  entityType?: string;
}

export function saveCompanyProfile(payload: SaveCompanyProfilePayload) {
  return apiFetch<CompanyProfile>("/dsmo/company", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── DSMO Declarations history ─────────────────────────────────────────────
export interface DsmoDeclaration {
  id: string;
  status: string;
  year?: number;
  pdfUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export function getMyDeclarations() {
  return apiFetch<DsmoDeclaration[]>("/dsmo/declarations");
}

// ── ONEFOP Submissions history ────────────────────────────────────────────
export interface OnefopSubmission {
  id: string;
  status: string;
  entityType?: string;
  quarterCode?: string;
  period?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export function getMyOnefopSubmissions() {
  return apiFetch<OnefopSubmission[]>("/onefop/submissions");
}

// ── DSMO Declaration submission ───────────────────────────────────────────
export interface DsmoMovementPayload {
  movementType: "RECRUITMENT" | "PROMOTION" | "DISMISSAL" | "RETIREMENT" | "DEATH";
  cat1_3: number;
  cat4_6: number;
  cat7_9: number;
  cat10_12: number;
  catNonDeclared: number;
}

export interface DsmoDeclarationPayload {
  year: number;
  fillingDate: string;
  companyData: {
    name: string;
    parentCompany?: string | null;
    mainActivity?: string;
    secondaryActivity?: string | null;
    region?: string;
    department?: string;
    subdivision?: string;
    address: string;
    fax?: string | null;
    taxNumber: string;
    cnpsNumber?: string | null;
    socialCapital?: number | null;
    totalEmployees: number;
    menCount?: number | null;
    womenCount?: number | null;
    lastYearTotal?: number | null;
    lastYearMenCount?: number | null;
    lastYearWomenCount?: number | null;
  };
  movements: DsmoMovementPayload[];
  qualitative: {
    hasTrainingCenter: boolean;
    recruitmentPlansNext: boolean;
    camerounisationPlan: boolean;
    usesTempAgencies: boolean;
    tempAgencyDetails?: string | null;
  };
}

export function submitDsmoDeclaration(payload: DsmoDeclarationPayload) {
  return apiFetch<DsmoDeclaration>("/dsmo/declaration", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── DSMO Draft ────────────────────────────────────────────────────────────
export function saveDsmoDraft(year: number, draftData: unknown) {
  return apiFetch<{ success: boolean }>("/dsmo/declaration/draft", {
    method: "POST",
    body: JSON.stringify({ year, draftData }),
  });
}

export function getDsmoDraft() {
  return apiFetch<{ year?: number; draftData?: unknown; updatedAt?: string } | null>(
    "/dsmo/declaration/draft",
  );
}

export function deleteDsmoDraft() {
  return apiFetch<{ success: boolean }>("/dsmo/declaration/draft", {
    method: "DELETE",
  });
}

// ── DSMO Declaration PDF ──────────────────────────────────────────────────
// Returns the redirect URL (the server does a 302 redirect to Supabase).
// We just open this URL directly in a new tab.
export function getDeclarationPdfUrl(id: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "";
  return `${base}/dsmo/declarations/${encodeURIComponent(id)}/pdf/1`;
}

// ── Find identifier (Retrouver mon identifiant) ───────────────────────────
export interface FindIdentifierResult {
  establishmentId?: string;
  matricule?: string;
  [key: string]: unknown;
}

export function findIdentifier(payload: {
  companyName: string;
  taxNumber: string;
  phone: string;
}) {
  return apiFetch<FindIdentifierResult>("/auth/identifier/find", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Admin Pilotage & Eligibility Engine ──────────────────────────────────
export interface DossierDiagnostic {
  submissionId: string;
  axis1Status: string;
  axis2BlockingCount: number;
  axis2WarningCount: number;
  axis3Eligibility: "READY" | "EXCLUDED";
  exclusionReason?: string;
  blockingAnomalies: any[];
  warningAnomalies: any[];
}

export interface PilotageQueues {
  blockingAnomaliesCount: number;
  pendingNationalVisasCount: number;
  pendingRegionalVisasCount: number;
  pendingDivisionalVisasCount: number;
  correctionsUnderReviewCount: number;
  statisticallyReadyCount: number;
  totalSubmissionsCount: number;
  /** Per-status counts over the caller's whole territory (server-side). */
  statusCounts: Record<"PENDING_REVIEW" | "APPROVED" | "CORRECTION_REQUESTED" | "REJECTED", number>;
  approvedCount: number;
  /** Per stored region value; null = no region recorded. */
  regionCounts: Array<{ region: string | null; count: number }>;
}

export function getPilotageQueues() {
  return apiFetch<PilotageQueues>("/admin/questionnaires/pilotage/queues");
}

export interface AdminQuestionnairesPage {
  items: any[];
  /** Count of the whole filtered query (territory + status + type + period + region + search, drafts excluded), not of this page. */
  total: number;
}

// TODO(backend, S): delete QuestionnairesService.getAllQuestionnaires in a follow-up — dead code since 40529d79 (GET /admin/questionnaires now uses listForAdmin)
export function listAdminQuestionnaires(
  params: {
    status?: string; formType?: string; period?: string; region?: string; search?: string;
    limit?: number; offset?: number;
  } = {},
) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.formType) query.set("formType", params.formType);
  if (params.period) query.set("period", params.period);
  if (params.region) query.set("region", params.region);
  if (params.search) query.set("search", params.search);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));
  const qs = query.toString();
  return apiFetch<AdminQuestionnairesPage>(`/admin/questionnaires${qs ? `?${qs}` : ""}`);
}

export function getDossierDiagnostic(id: string) {
  return apiFetch<DossierDiagnostic>(`/admin/questionnaires/${encodeURIComponent(id)}/diagnostic`);
}

export function approveDossier(id: string) {
  return apiFetch<unknown>(`/admin/questionnaires/${encodeURIComponent(id)}/approve`, {
    method: "PATCH",
  });
}

export function rejectDossier(id: string, reason: string) {
  return apiFetch<unknown>(`/admin/questionnaires/${encodeURIComponent(id)}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export function requestCorrectionDossier(id: string, comments: string) {
  return apiFetch<unknown>(`/admin/questionnaires/${encodeURIComponent(id)}/request-correction`, {
    method: "PATCH",
    body: JSON.stringify({ comments }),
  });
}

export function bulkVisaDeclarations(payload: { submissionIds: string[]; certified: boolean; notes?: string }) {
  return apiFetch<{
    success: boolean;
    processedCount: number;
    rejectedCount: number;
    approvedIds: string[];
    rejectedItems: Array<{ id: string; reason: string }>;
    timestamp: string;
  }>("/admin/questionnaires/bulk-visa", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function bulkRejectDeclarations(payload: { submissionIds: string[]; certified: boolean; reason: string }) {
  return apiFetch<{
    success: boolean;
    processedCount: number;
    rejectedCount: number;
    rejectedIds: string[];
    rejectedItems: Array<{ id: string; reason: string }>;
    timestamp: string;
  }>("/admin/questionnaires/bulk-reject", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listAnomaliesRegistry(params: { submissionId?: string; status?: string; isBlocking?: boolean; limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams();
  if (params.submissionId) query.set("submissionId", params.submissionId);
  if (params.status) query.set("status", params.status);
  if (params.isBlocking !== undefined) query.set("isBlocking", String(params.isBlocking));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  const qs = query.toString();
  return apiFetch<{ total: number; items: any[] }>(`/admin/questionnaires/anomalies/registry${qs ? `?${qs}` : ""}`);
}

export function resolveAnomaly(id: string, payload: { resolutionType: string; resolutionNote: string; evidenceUrl?: string }) {
  return apiFetch<any>(`/admin/questionnaires/anomalies/${encodeURIComponent(id)}/resolve`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getSpssManifest(filters: Record<string, any> = {}) {
  return apiFetch<{ sps: string }>("/data-management/export/submissions/spss/manifest", {
    method: "POST",
    body: JSON.stringify(filters),
  });
}

// Shared by the three export downloads. A bare fetch() failure only says
// "Failed to fetch", which hides whether the API is down, the endpoint is
// missing from the deployed version, or the session expired — each gets its
// own actionable message here, naming the server that was contacted.
async function downloadExportBlob(path: string, filters: Record<string, any>, label: string): Promise<Blob> {
  const token = getToken();
  let host = API_BASE_URL;
  try {
    host = new URL(API_BASE_URL).host;
  } catch {
    // keep the raw base URL
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(filters),
    });
  } catch {
    throw new ApiError(
      0,
      `le serveur ${host} est injoignable. Vérifiez que l'API est démarrée et accessible, puis réessayez.`,
    );
  }

  if (!res.ok) {
    let serverMessage: string | undefined;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") serverMessage = body.message;
    } catch {
      // non-JSON error body
    }
    if (res.status === 401) {
      throw new ApiError(401, "votre session a expiré. Reconnectez-vous puis relancez l'export.");
    }
    if (res.status === 403) {
      throw new ApiError(403, "votre rôle ne permet pas cet export.");
    }
    if (res.status === 404) {
      throw new ApiError(404, `l'export ${label} n'existe pas sur le serveur ${host} : la version de l'API déployée ne le propose pas encore.`);
    }
    throw new ApiError(res.status, serverMessage || `échec du téléchargement ${label} (HTTP ${res.status}).`);
  }

  try {
    return await res.blob();
  } catch {
    throw new ApiError(0, "le téléchargement a été interrompu avant la fin. Réessayez ou réduisez le périmètre de l'extraction.");
  }
}

export function downloadSpssCsvBlob(filters: Record<string, any> = {}): Promise<Blob> {
  return downloadExportBlob("/data-management/export/submissions/spss/csv", filters, "CSV SPSS");
}

export function downloadSpssSavBlob(filters: Record<string, any> = {}): Promise<Blob> {
  return downloadExportBlob("/data-management/export/submissions/spss/sav", filters, "SPSS (.sav)");
}

export function downloadExcelWorkbookBlob(filters: Record<string, any> = {}): Promise<Blob> {
  return downloadExportBlob("/data-management/export/submissions/excel", filters, "Excel (.xlsx)");
}
