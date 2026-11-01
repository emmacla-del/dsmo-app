import { createTestQueryClient, renderWithProviders, screen, navigationMock, waitFor } from "@/test/render";
import { loadOnefopSchema } from "@/test/schema";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { AdminDossier, DossierDiagnostic } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { explainedFindingsKey } from "@/components/admin/DossierExplainFinding";
import SubmissionDetailPage from "./[id]/page";

const DOSSIER = {
  id: "dossier-1",
  submissionId: "SUB-2026-0001",
  revision: 7,
  formType: "ENTREPRISE",
  status: "PENDING_REVIEW",
  updatedAt: "2026-10-01T10:00:00.000Z",
  region: "Littoral",
  department: "Wouri",
  subdivision: null,
  submissionDate: "2026-09-30T10:00:00.000Z",
  reviewedAt: null,
  rejectionReason: null,
  quarterCode: "2026-T3",
  taxNumber: null,
  cnpsNumber: null,
  registrationNumber: null,
  respondent: null,
  enterpriseDetail: {},
  cooperativeDetail: null,
  ctdDetail: null,
  ongDetail: null,
  administrationDetail: null,
  projectProgramDetail: null,
  vocationalTrainingDetail: null,
  rawData: {},
} as unknown as AdminDossier;
const CLAIM = { id: "claim-1", questionnaireId: DOSSIER.id, assigneeId: "user-1", status: "PENDING_REVIEW", eligible: true };

const warning = (id: string, sex: string, expected: number) => ({
  id,
  ruleCode: "S22Q04_PERMANENT_EXCEEDS_TOTAL",
  ruleFamily: "COHERENCE",
  isBlocking: false,
  description: `Recrutements (S22Q04: 3, ${sex}) supérieurs (S22Q01: ${expected}, ${sex}).`,
  observedValue: "3",
  expectedValue: String(expected),
});

const DIAGNOSTIC = {
  submissionId: DOSSIER.submissionId,
  axis1Status: "PENDING_REVIEW",
  axis2BlockingCount: 1,
  axis2WarningCount: 2,
  axis3Eligibility: "BLOCKED",
  blockingAnomalies: [{ id: "b1", ruleCode: "MANDATORY_FIELD_MISSING", ruleFamily: "COMPLETENESS", isBlocking: true, description: "Champ manquant", observedValue: "", expectedValue: "" }],
  warningAnomalies: [warning("w-female", "female", 1), warning("w-male", "male", 2)],
} as unknown as DossierDiagnostic;

// renderWithProviders resets the navigation mock, so the route is set at render time.
function Harness() {
  navigationMock.params = { id: DOSSIER.id };
  navigationMock.searchParams = new URLSearchParams();
  return <SubmissionDetailPage />;
}

function renderDetail() {
  useAuthStore.setState({ status: "authenticated", user: { id: "user-1", role: "ADMIN_ONEFOP" } as never });
  const queryClient = createTestQueryClient();
  queryClient.setDefaultOptions({
    queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
    mutations: { retry: false, gcTime: 0 },
  });
  return renderWithProviders(<Harness />, {
    locale: "en",
    queryClient,
    queryData: [
      [["admin", "dossier", DOSSIER.id, false], DOSSIER],
      [["admin", "diagnostic", DOSSIER.id, false], DIAGNOSTIC],
      [["admin", "dossier-claim-state", DOSSIER.id], CLAIM],
      [[...explainedFindingsKey(DOSSIER.id)], { total: 0, items: [] }],
      [["onefop-schema"], loadOnefopSchema()],
    ],
  });
}

test("« Explain » is offered on a warning to the claim holder, never on a blocking finding", () => {
  renderDetail();
  // One warning rule (raised for men and women) → one button; the blocking finding gets none.
  assert.equal(screen.getAllByRole("button", { name: "Explain" }).length, 1);
});

test("explaining closes every row of the finding, one revision after the other, with the note", async () => {
  const originalFetch = globalThis.fetch;
  const resolved: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/anomalies/") && url.endsWith("/resolve")) {
      resolved.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
      return new Response(JSON.stringify({ id: "x" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    // The reload after saving: the file again, its warnings now closed.
    const body = url.includes("/diagnostic") ? { ...DIAGNOSTIC, warningAnomalies: [] }
      : url.includes("/anomalies/registry") ? { total: 0, items: [] }
      : url.includes("claim") ? CLAIM
      : url.includes("review-progress") ? []
      : url.includes("neighbours") ? { previous: null, next: null }
      : DOSSIER;
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const { user } = renderDetail();
    await user.click(screen.getByRole("button", { name: "Explain" }));
    const save = screen.getByRole("button", { name: "Save the explanation" }) as HTMLButtonElement;
    assert.equal(save.disabled, true, "no note, no save");
    await user.type(screen.getByPlaceholderText(/confirmed by phone/), "Confirmed with the HR manager by phone.");
    await user.click(save);
    await waitFor(() => assert.equal(resolved.length, 2));
    // Men before women, whatever order the server listed them in.
    assert.ok(resolved[0].url.includes("/anomalies/w-male/resolve"));
    assert.ok(resolved[1].url.includes("/anomalies/w-female/resolve"));
    assert.deepEqual(resolved.map((call) => call.body.expectedRevision), [7, 8]);
    assert.ok(resolved.every((call) => call.body.resolutionType === "REVIEWER_EXPLANATION"));
    assert.ok(resolved.every((call) => call.body.resolutionNote === "Confirmed with the HR manager by phone."));
    assert.ok(!resolved.some((call) => call.url.includes("/anomalies/b1/")), "the blocking finding is untouched");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
