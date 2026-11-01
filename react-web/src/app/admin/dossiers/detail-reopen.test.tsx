import { createTestQueryClient, renderWithProviders, screen, navigationMock, waitFor } from "@/test/render";
import { loadOnefopSchema } from "@/test/schema";
import { test } from "node:test";
import assert from "node:assert/strict";
import { act } from "@testing-library/react";
import type { AdminDossier, DossierDiagnostic } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import SubmissionDetailPage from "./[id]/page";

const DOSSIER: AdminDossier = {
  id: "dossier-1",
  submissionId: "SUB-2026-0001",
  revision: 7,
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
const CORRECTION_DOSSIER: AdminDossier = { ...DOSSIER, status: "PENDING_REVIEW", reviewedAt: null };
const CLAIM = { id: "claim-1", questionnaireId: DOSSIER.id, assigneeId: "user-1", status: "PENDING_REVIEW", eligible: true };

const DIAGNOSTIC: DossierDiagnostic = {
  submissionId: DOSSIER.submissionId,
  axis1Status: "APPROVED",
  axis2BlockingCount: 0,
  axis2WarningCount: 0,
  axis3Eligibility: "READY",
  blockingAnomalies: [],
  warningAnomalies: [],
};

function Harness({ returnTo }: { returnTo?: string }) {
  navigationMock.params = { id: DOSSIER.id };
  navigationMock.searchParams = new URLSearchParams(returnTo ? { returnTo } : undefined);
  return <SubmissionDetailPage />;
}

function renderDetail(returnTo?: string, dossier = DOSSIER) {
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

  return renderWithProviders(<Harness returnTo={returnTo} />, {
    locale: "en",
    queryClient,
    queryData: [
      [["admin", "dossier", DOSSIER.id, false], dossier],
      [["admin", "diagnostic", DOSSIER.id, false], DIAGNOSTIC],
      [["admin", "dossier-claim-state", DOSSIER.id], CLAIM],
      [["onefop-schema"], loadOnefopSchema()],
    ],
  });
}

test("the visible back link restores an allowlisted filtered Dossiers view", () => {
  renderDetail("/admin/dossiers?vue=completed&status=REJECTED&page=3&unknown=drop");

  assert.equal(
    screen.getByRole("link", { name: "Back" }).getAttribute("href"),
    "/admin/dossiers?vue=completed&completedStatus=REJECTED&completedPage=3",
  );
});

test("direct dossier links keep the existing list fallback", () => {
  renderDetail();

  assert.equal(screen.getByRole("link", { name: "Back" }).getAttribute("href"), "/admin/dossiers");
});

test("clicking Reopen for correction opens the reason and attestation dialog", async () => {
  const { user } = renderDetail();

  await user.click(screen.getByRole("button", { name: "Reopen for correction" }));

  const dialog = screen.getByRole("dialog");
  assert.ok(dialog.hasAttribute("open") || (dialog as HTMLDialogElement).open);
  assert.ok(screen.getByText("Reason for reopening"));
  assert.ok(screen.getByPlaceholderText(/What the respondent must correct/));
  assert.ok(screen.getByText(/this endorsed file must be corrected/));
});

test("a dossier refetch keeps an open correction dialog and its text", async () => {
  const originalFetch = globalThis.fetch;
  let releaseRefetch!: (response: Response) => void;
  let dossierCalls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes(`/admin/questionnaires/${DOSSIER.id}`) && !url.includes("diagnostic")) {
      dossierCalls += 1;
      if (dossierCalls > 1) return await new Promise<Response>((resolve) => { releaseRefetch = resolve; });
      return new Response(JSON.stringify(CORRECTION_DOSSIER), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify(DIAGNOSTIC), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  try {
    const { user, queryClient } = renderDetail(undefined, CORRECTION_DOSSIER);
    await user.click(screen.getByRole("button", { name: "Request a correction" }));
    const problemField = screen.getByLabelText("2. Problem found") as HTMLTextAreaElement;
    await user.type(problemField, "The reporting period needs clarification.");

    let refetch!: Promise<void>;
    await act(async () => {
      refetch = queryClient.invalidateQueries({ queryKey: ["admin", "dossier", DOSSIER.id, false] });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assert.ok(dossierCalls >= 1, "the dossier query should have refetched");
    assert.equal((screen.getByRole("dialog").querySelector("textarea") as HTMLTextAreaElement).value, "The reporting period needs clarification.");
    assert.ok(screen.getByRole("dialog").textContent?.includes("Request a correction"));

    await act(async () => releaseRefetch(new Response(JSON.stringify(CORRECTION_DOSSIER), { status: 200, headers: { "Content-Type": "application/json" } })));
    await refetch;
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a background refetch disables the bar's decisions instead of hiding them", async () => {
  const originalFetch = globalThis.fetch;
  let releaseRefetch!: (response: Response) => void;
  let dossierCalls = 0;
  let holdDossier = false;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes(`/admin/questionnaires/${DOSSIER.id}`) && !url.includes("diagnostic")) {
      dossierCalls += 1;
      if (holdDossier) return await new Promise<Response>((resolve) => { releaseRefetch = resolve; });
      return new Response(JSON.stringify(CORRECTION_DOSSIER), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify(DIAGNOSTIC), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  try {
    const { queryClient } = renderDetail(undefined, CORRECTION_DOSSIER);
    const decisionNames = ["Reject", "Request a correction"];
    await waitFor(() => {
      for (const name of decisionNames) assert.equal((screen.getByRole("button", { name }) as HTMLButtonElement).disabled, false);
    });
    holdDossier = true;

    let refetch!: Promise<void>;
    await act(async () => {
      refetch = queryClient.invalidateQueries({ queryKey: ["admin", "dossier", DOSSIER.id, false] });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assert.ok(dossierCalls >= 1, "the dossier query should be refetching");
    for (const name of decisionNames) {
      // Still there, so the bar does not jump; disabled until the refetch lands.
      assert.equal((screen.getByRole("button", { name }) as HTMLButtonElement).disabled, true, `${name} stays visible but disabled`);
    }

    await act(async () => releaseRefetch(new Response(JSON.stringify(CORRECTION_DOSSIER), { status: 200, headers: { "Content-Type": "application/json" } })));
    await refetch;
    await waitFor(() => {
      for (const name of decisionNames) assert.equal((screen.getByRole("button", { name }) as HTMLButtonElement).disabled, false);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
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
      expectedRevision: DOSSIER.revision,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
