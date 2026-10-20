// src/lib/onefop-submission.ts
//
// Real backend wiring for drafts and final submission — src/onefop/
// onefop.controller.ts (draft) and src/questionnaires/
// questionnaires.controller.ts (submit), both read directly this session.
import { API_BASE_URL, ApiError, apiFetch, getToken, localeHeader } from "./api-client";
import { cleanHiddenDependentFields, localized, type FormData, type OnefopEntity } from "./onefop-schema";
import { locateIssue } from "./wizard-navigation";
import { sectionNavTitle, sectionNumberFromId } from "./onefop-section-title";
import { applyQuizDerivedTableSemantics, tableNumericCellKeys } from "@/components/modern-jobs/scope/QuizSemantics";

export interface ActiveQuarter {
  isOpen: boolean;
  code: string | null;
  label?: string;
  deadline?: string;
  message?: string;
  /** The round's data-collection period — what the questionnaire's
   *  period-based questions refer to (lib/campaign-period.ts). */
  periodStart?: string | null;
  periodEnd?: string | null;
}

export function getActiveQuarter() {
  return apiFetch<ActiveQuarter>("/onefop/active-quarter");
}

// Prisma's OnefopEntityType enum (schema.prisma) — used by both the draft
// endpoint (all 7 values valid) and the submit endpoint (only the first 4
// are accepted by OnefopSubmissionDto's @IsIn, see SUBMIT_ENTITY_TYPES
// below). Same mapping as Flutter's entityTypeString().
const BACKEND_ENTITY_TYPE: Record<string, string> = {
  enterprise: "ENTREPRISE",
  entreprise: "ENTREPRISE",
  cooperative: "COOPERATIVE",
  ctd: "CTD",
  ong: "ONG",
  ngo: "ONG",
  administration: "ADMINISTRATION",
  projectProgram: "PROJECT_PROGRAM",
  project_program: "PROJECT_PROGRAM",
  project: "PROJECT_PROGRAM",
  vocationalTraining: "VOCATIONAL_TRAINING",
  vocational_training: "VOCATIONAL_TRAINING",
  vt: "VOCATIONAL_TRAINING",
  vtc: "VOCATIONAL_TRAINING",
};

// All 7 entity types are supported by the backend questionnaires pipeline
// (src/questionnaires/questionnaires.service.ts).
const SUBMIT_SUPPORTED = new Set([
  "enterprise",
  "entreprise",
  "cooperative",
  "ctd",
  "ong",
  "ngo",
  "administration",
  "projectProgram",
  "project_program",
  "project",
  "vocationalTraining",
  "vocational_training",
  "vt",
  "vtc",
]);

export function supportsBackendSubmission(entityType: string): boolean {
  return SUBMIT_SUPPORTED.has(entityType);
}

/**
 * The row POST /onefop/draft returns — a SubmissionDraft upsert
 * (onefop.service.ts saveDraft). The model has no `id`: its primary key is
 * @@unique([establishmentId, quarterCode]). No caller reads the body today;
 * this type exists so a future one cannot reach for a field that is not there.
 */
export interface SavedDraft {
  establishmentId: string;
  quarterCode: string;
  entityType: string;
  draftData: unknown;
  lastSavedAt: string;
  savedByUserId: string | null;
  completionScore: number | null;
  missingFields: string[];
  createdAt: string;
  updatedAt: string;
}

/** The browser's cap on a keepalive request body, with room for headers. */
const KEEPALIVE_MAX_BYTES = 60 * 1024;

export function saveDraftToBackend(
  entityType: string,
  quarterCode: string,
  draftData: FormData,
  entity?: OnefopEntity | null,
  /**
   * `keepalive` lets the request finish after the page is gone, for the save
   * sent when the respondent closes the tab (use-onefop-server-save.ts). The
   * browser caps a keepalive body at 64 KiB, so a draft above that is sent
   * as an ordinary request — which survives a tab switch, though not a
   * close.
   */
  options?: { keepalive?: boolean },
) {
  // The draft is the respondent's working form, as the local copy holds it,
  // quiz answers included (D7). Only hidden follow-ups are dropped. The
  // quiz's derived zeros are NOT written here: they belong to the submission
  // payload alone (QuizSemantics), and a draft carrying them reopened a table
  // already "answered" with 0 once the quiz said Yes to it (audit C4).
  const prepared = entity ? cleanHiddenDependentFields(entity, draftData) : { ...draftData };

  const body = JSON.stringify({
    quarterCode,
    entityType: BACKEND_ENTITY_TYPE[entityType] ?? entityType,
    draftData: prepared,
  });
  const keepalive = Boolean(options?.keepalive) && body.length <= KEEPALIVE_MAX_BYTES;

  return apiFetch<SavedDraft>("/onefop/draft", { method: "POST", body, keepalive });
}

/**
 * Loads a remote draft saved on the backend (GET /onefop/draft).
 * Allows a respondent to recover their work-in-progress draft
 * across devices, browsers, or after clearing local storage (D7 fix).
 */
export async function fetchBackendDraft(
  entityType: string,
  quarterCode: string,
): Promise<FormData | null> {
  try {
    const drafts = await apiFetch<Array<{
      quarterCode: string;
      entityType: string;
      draftData: FormData;
      lastSavedAt?: string;
    }>>("/onefop/draft");
    if (!Array.isArray(drafts)) return null;
    const targetType = (BACKEND_ENTITY_TYPE[entityType] ?? entityType).toUpperCase();
    const match = drafts.find(
      (d) =>
        d.quarterCode === quarterCode &&
        (d.entityType?.toUpperCase() === targetType ||
          d.entityType?.toLowerCase() === entityType.toLowerCase()),
    );
    return match?.draftData ?? null;
  } catch {
    return null;
  }
}

/**
 * POST /onefop/preview (questionnaires.controller.ts) — a JWT-protected but
 * otherwise non-mutating endpoint: it runs the same normalizeFlatKeys() +
 * per-entity pdf-data-mapper.service.ts mapping the real submission path
 * uses, then renders the official Handlebars template
 * (src/pdf/templates/dynamic/<entity>.hbs) through OnefopPuppeteerService
 * and returns the raw PDF bytes. Nothing is written to the database and no
 * submission round needs to be open — this is Phase 5.6's "print/PDF
 * output" requirement met by reusing the exact PDF pipeline already trusted
 * in production, rather than reimplementing official-fidelity print layout
 * in the browser (which the plan explicitly warns against: "Do not generate
 * visually convenient PDFs that alter the official declaration structure").
 * quarterCode may be omitted — the backend falls back to today's calendar
 * quarter for this preview-only path (see surveyYearFromQuarterCode).
 */
/**
 * The data actually sent for a final submission (and its PDF preview).
 *
 * Table statuses and confirmed zeros come only from the Preliminary
 * Declaration Quiz (QuizSemantics.applyQuizDerivedTableSemantics): a quiz
 * "No" yields NONE with every applicable cell 0, a "Yes" yields REPORTED
 * with de-selected categories 0. An empty table is never turned into NONE
 * here — the old empty-table → NONE fallback recorded unanswered tables as
 * certified zeros. Without the entity schema nothing is derived.
 */
export function prepareSubmissionData(entity: OnefopEntity | null | undefined, data: FormData): FormData {
  if (!entity) return { ...data };
  const cleaned = cleanHiddenDependentFields(entity, data);
  return applyQuizDerivedTableSemantics(entity, cleaned);
}

/** The exact JSON body POSTed to /onefop/submit. */
export function buildSubmitPayload(
  backendEntityType: string,
  quarterCode: string,
  data: FormData,
  isDraft: boolean,
  entity: OnefopEntity | null | undefined,
  formId: string,
) {
  return {
    formId,
    entityType: backendEntityType,
    quarterCode,
    data: prepareSubmissionData(entity, data),
    isDraft,
  };
}

export async function fetchDeclarationPreviewPdf(
  entityType: string,
  data: Record<string, unknown>,
  quarterCode?: string | null,
  locale?: "fr" | "en",
  entity?: OnefopEntity | null,
): Promise<Blob> {
  const token = getToken();
  const normalizedType =
    entityType === "entreprise" ? "enterprise" :
    (entityType === "project" || entityType === "project_program") ? "projectProgram" :
    (entityType === "vt" || entityType === "vocational_training" || entityType === "vtc") ? "vocationalTraining" :
    (entityType === "ngo") ? "ong" :
    entityType;

  const preparedData = prepareSubmissionData(entity, data);
  const res = await fetch(`${API_BASE_URL}/onefop/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...localeHeader(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ entityType: normalizedType, quarterCode, data: preparedData, locale }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, (body && !Array.isArray(body) && body.message) || res.statusText, body);
  }
  return res.blob();
}

/**
 * Loads the official declaration preview directly as HTML (bypassing headless Chrome).
 * Fast, offline-ready, 100% pixel-accurate, and allows direct browser print-to-PDF.
 */
export async function fetchDeclarationPreviewHtml(
  entityType: string,
  data: Record<string, unknown>,
  quarterCode?: string | null,
  locale?: "fr" | "en",
  entity?: OnefopEntity | null,
): Promise<string> {
  const token = getToken();
  const normalizedType =
    entityType === "entreprise" ? "enterprise" :
    (entityType === "project" || entityType === "project_program") ? "projectProgram" :
    (entityType === "vt" || entityType === "vocational_training" || entityType === "vtc") ? "vocationalTraining" :
    (entityType === "ngo") ? "ong" :
    entityType;

  const preparedData = prepareSubmissionData(entity, data);
  const res = await fetch(`${API_BASE_URL}/onefop/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...localeHeader(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      entityType: normalizedType,
      quarterCode,
      data: preparedData,
      locale,
      format: "html",
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, (body && !Array.isArray(body) && body.message) || res.statusText, body);
  }
  return res.text();
}

export interface SubmitResult {
  success: boolean;
  submissionId: string;
  message: string;
}

export function submitDeclaration(
  entityType: string,
  quarterCode: string,
  data: Record<string, unknown>,
  isDraft: boolean,
  entity?: OnefopEntity | null,
  formId?: string,
) {
  const backendEntityType = BACKEND_ENTITY_TYPE[entityType];
  if (!supportsBackendSubmission(entityType) || !backendEntityType) {
    return Promise.reject(
      new Error(`Backend submission does not support entity type "${entityType}".`),
    );
  }
  // P4 / N1: formId must be generated once per wizard session by the caller and
  // reused on every retry so the backend can enforce idempotency.
  const stableFormId = formId ?? crypto.randomUUID();
  return apiFetch<SubmitResult>("/onefop/submit", {
    method: "POST",
    body: JSON.stringify(
      buildSubmitPayload(backendEntityType, quarterCode, data, isDraft, entity, stableFormId),
    ),
  });
  // A retry of the same formId is answered by the server with its original
  // success (questionnaires.service.ts idempotency check). A 409 therefore
  // always means a *different* declaration already exists for the quarter,
  // and must reach the respondent as the error it is — never as a success.
}

/** One advisory coherence flag, as the server words and stores it. */
export interface CoherenceFlag {
  code: string;
  message: string;
}

/**
 * The advisory coherence flags a final submission of `data` would raise,
 * computed by the server's own rules without saving anything (defect 25 of
 * the 2026-10-16 VT run: the respondent never saw them). Advisory only
 * (CLAUDE.md §7): the caller lets the respondent confirm and submit.
 */
export function previewCoherence(entityType: string, data: Record<string, unknown>, entity?: OnefopEntity | null) {
  const backendEntityType = BACKEND_ENTITY_TYPE[entityType] ?? entityType;
  return apiFetch<{ flags: CoherenceFlag[] }>("/onefop/coherence-preview", {
    method: "POST",
    body: JSON.stringify({ entityType: backendEntityType, data: prepareSubmissionData(entity, data) }),
  }).then((r) => r?.flags ?? []);
}

// Raw shape of a single class-validator error, as questionnaires.service.ts
// throws it directly (`throw new BadRequestException(dataErrors)`, no
// wrapping) when its manual `validate()` call against the nested
// Enterprise/Cooperative/.../Dto fails. This is the failure path a real
// final-submit attempt hits today (confirmed by an actual live 400 during
// this session) — the friendlier bilingual `{message, missingFields}` shape
// (enforceFinalRequiredFields, same service) runs later and is never
// reached while the class-validator check still rejects first.
interface RawValidationError {
  property: string;
  constraints?: Record<string, string>;
  children?: RawValidationError[];
}

function flattenValidationErrors(errors: RawValidationError[], prefix = ""): string[] {
  const out: string[] = [];
  for (const err of errors) {
    const path = prefix ? `${prefix}.${err.property}` : err.property;
    if (err.constraints) {
      for (const msg of Object.values(err.constraints)) out.push(`${path}: ${msg}`);
    }
    if (err.children?.length) out.push(...flattenValidationErrors(err.children, path));
  }
  return out;
}

/** A place in the form a refused submission points to: one table. */
export interface SubmissionErrorTarget {
  sectionIndex: number;
  fieldId: string;
  /** What the respondent reads: the question or table, and its section. */
  label: string;
}

export interface SubmissionErrorDetail {
  summary: string;
  items: string[];
  /** The tables the server refused, when they can be found in the form. */
  targets?: SubmissionErrorTarget[];
}

/** The form the refused declaration came from, to name what the server lists by key. */
export interface SubmissionErrorContext {
  entity?: OnefopEntity | null;
  data?: FormData;
}

/**
 * The server lists the table cells it refused by internal key
 * (s3q01_cadres_demission_male). Section 8 keeps those keys off a respondent's screen, so each one is
 * located in the form and named by its own question or table, once per table,
 * with its section — the wizard links each to the place to correct (audit C5).
 * A key that is not in the form, or a table cell the wizard does not show
 * under the quiz answers given, cannot be corrected by the respondent: they
 * are told so and pointed to ONEFOP, never shown the key.
 */
function describeRefusedKeys(
  keys: readonly string[],
  locale: "fr" | "en",
  { entity, data }: SubmissionErrorContext,
): { targets: SubmissionErrorTarget[]; unreachable: number } {
  const targets: SubmissionErrorTarget[] = [];
  const byField = new Map<string, SubmissionErrorTarget>();
  let unreachable = 0;
  if (!entity) return { targets, unreachable: keys.length };
  const shownCells = new Map<string, Set<string>>();
  for (const key of keys) {
    const location = locateIssue(entity.sections, key);
    if (!location) {
      unreachable++;
      continue;
    }
    const { field, sectionIndex } = location;
    const isCell = key.toLowerCase() !== field.id.toLowerCase() && key.toLowerCase() !== (field.paperCode ?? "").toLowerCase();
    if (isCell && field.table && data && !/_(desc|text)$|_domain/i.test(key)) {
      let shown = shownCells.get(field.id);
      if (!shown) {
        shown = new Set(tableNumericCellKeys(field, data, true).map((k) => k.toLowerCase()));
        shownCells.set(field.id, shown);
      }
      if (shown.size > 0 && !shown.has(key.toLowerCase())) {
        unreachable++;
        continue;
      }
    }
    if (byField.has(field.id)) continue;
    const section = entity.sections[sectionIndex];
    const number = sectionNumberFromId(section.id, sectionIndex);
    const sectionName = sectionNavTitle(section.id, section.title ? localized(section.title, locale) : "", number, locale, data);
    const name = field.label ? localized(field.label, locale) : "";
    const where = `Section ${number}, ${sectionName}`;
    const target = {
      sectionIndex,
      fieldId: field.id,
      label: name ? `${where}${locale === "fr" ? " : " : ": "}${name}` : where,
    };
    byField.set(field.id, target);
    targets.push(target);
  }
  // In the order of the form, not of the server's list.
  const position = (t: SubmissionErrorTarget) =>
    entity.sections[t.sectionIndex].fields.findIndex((f) => f.id === t.fieldId);
  targets.sort((a, b) => a.sectionIndex - b.sectionIndex || position(a) - position(b));
  return { targets, unreachable };
}

function refusedCellsDetail(
  keys: readonly string[],
  locale: "fr" | "en" | undefined,
  context: SubmissionErrorContext,
): SubmissionErrorDetail {
  const lang = locale === "en" ? "en" : "fr";
  const { targets, unreachable } = describeRefusedKeys(keys, lang, context);
  const summary =
    lang === "en"
      ? "Your declaration was not sent: some cells are still empty in the tables below. Enter 0 where there is nothing to declare."
      : "Votre déclaration n'a pas été transmise : des cases restent vides dans les tableaux ci-dessous. Saisissez 0 lorsqu'il n'y a rien à déclarer.";
  const items = targets.map((t) => t.label);
  if (unreachable > 0) {
    items.push(
      lang === "en"
        ? `${unreachable} item(s) the form does not show you were also refused. If everything above is complete, contact ONEFOP support: you cannot correct them yourself.`
        : `${unreachable} élément(s) que le formulaire ne vous présente pas ont aussi été refusés. Si tout ce qui précède est complet, contactez l'assistance ONEFOP : vous ne pouvez pas les corriger vous-même.`,
    );
  }
  return { summary, items, targets };
}

/**
 * Turns a submit-endpoint failure into a displayable summary + itemized
 * field list, covering both known backend error shapes (see
 * RawValidationError above) rather than the single opaque line
 * `ApiError.message` gave before api-client.ts started keeping the raw body.
 * With the form as context, what the server lists by key is named in the
 * respondent's words (describeRefusedKeys).
 */
export function formatSubmissionError(
  error: unknown,
  locale?: "fr" | "en",
  context: SubmissionErrorContext = {},
): SubmissionErrorDetail {
  if (!(error instanceof ApiError)) {
    return { summary: error instanceof Error ? error.message : String(error), items: [] };
  }
  if (error.status === 401) {
    return {
      summary:
        locale === "en"
          ? "Your session has expired. Please reload the page and log in again before submitting."
          : "Votre session a expiré. Veuillez recharger la page et vous reconnecter avant de soumettre.",
      items: [],
    };
  }
  const body = error.body;
  if (Array.isArray(body)) {
    const items = flattenValidationErrors(body as RawValidationError[]);
    const n = items.length;
    return {
      summary:
        locale === "fr"
          ? `Formulaire invalide (${n} problème${n > 1 ? "s" : ""}).`
          : locale === "en"
            ? `Invalid form (${n} issue${n > 1 ? "s" : ""}).`
            : `Formulaire invalide (${n} problème${n > 1 ? "s" : ""}) / Invalid form (${n} issue${n > 1 ? "s" : ""}).`,
      items,
    };
  }
  const cells = body && typeof body === "object" ? (body as { missingMatrixCells?: unknown }).missingMatrixCells : undefined;
  if (Array.isArray(cells) && cells.length > 0) {
    return refusedCellsDetail(cells.map(String), locale, context);
  }
  if (body && typeof body === "object" && Array.isArray((body as { missingFields?: unknown }).missingFields)) {
    return { summary: error.message, items: (body as { missingFields: string[] }).missingFields };
  }
  return { summary: error.message, items: [] };
}
