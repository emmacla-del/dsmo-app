import { createTestQueryClient, renderWithProviders, screen, navigationMock } from "@/test/render";
import { loadOnefopSchema } from "@/test/schema";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { AdminDossier, DossierDiagnostic } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import SubmissionDetailPage from "./[id]/page";

const DOSSIER: AdminDossier = {
  id: "dossier-1",
  submissionId: "SUB-2026-0001",
  formType: "ENTERPRISE",
  status: "APPROVED",
  updatedAt: "2026-10-01T10:00:00.000Z",
  region: "Littoral",
  department: "Wouri",
  subdivision: null,
  submissionDate: "2026-09-30T10:00:00.000Z",
  reviewedAt: "2026-10-01T10:00:00.000Z",
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
};

const DIAGNOSTIC: DossierDiagnostic = {
  submissionId: DOSSIER.submissionId,
  axis1Status: "APPROVED",
  axis2BlockingCount: 0,
  axis2WarningCount: 0,
  axis3Eligibility: "READY",
  blockingAnomalies: [],
  warningAnomalies: [],
};

function Harness() {
  navigationMock.params = { id: DOSSIER.id };
  return <SubmissionDetailPage />;
}

function renderDetail() {
  useAuthStore.setState({
    status: "authenticated",
    user: { id: "user-1", role: "ADMIN_ONEFOP" } as never,
  });

  // A mutation schedules its removal after React Query's 5-minute default,
  // which would hold the test process open. This test creates its own client
  // so the mutation is released at once.
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
      [["onefop-schema"], loadOnefopSchema()],
    ],
  });
}

test("clicking Reopen for correction opens the reason and attestation dialog", async () => {
  const { user } = renderDetail();

  await user.click(screen.getByRole("button", { name: "Reopen for correction" }));

  const dialog = screen.getByRole("dialog");
  assert.ok(dialog.hasAttribute("open") || (dialog as HTMLDialogElement).open);
  assert.ok(screen.getByText("Reason for reopening"));
  assert.ok(screen.getByPlaceholderText(/What the respondent must correct/));
  assert.ok(screen.getByText(/this endorsed file must be corrected/));
});

test("confirming the dialog reopens this dossier for correction through the API", async () => {
  const requests: Array<{ url: string; body: unknown }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    const body = url.includes("/reopen-for-correction")
      ? { success: true }
      : url.includes("/diagnostic")
        ? DIAGNOSTIC
        : DOSSIER;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const { user } = renderDetail();

    await user.click(screen.getByRole("button", { name: "Reopen for correction" }));
    await user.type(screen.getByLabelText("Reason for reopening"), "Le fichier doit être corrigé.");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Confirm reopening" }));

    assert.ok(await screen.findByText(/The file was reopened/));

    const reopen = requests.find((request) => request.url.endsWith("/reopen-for-correction"));
    assert.ok(reopen, "the reopen endpoint was not called");
    assert.ok(reopen.url.includes(`/admin/questionnaires/${DOSSIER.id}/reopen-for-correction`));
    assert.deepEqual(reopen.body, {
      reason: "Le fichier doit être corrigé.",
      certified: true,
      expectedRevision: DOSSIER.updatedAt,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
