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

function Harness({ returnTo, openApprove = false, focusVerify = false }: { returnTo?: string; openApprove?: boolean; focusVerify?: boolean }) {
  navigationMock.params = { id: DOSSIER.id };
  navigationMock.searchParams = new URLSearchParams({
    ...(returnTo ? { returnTo } : {}),
    ...(openApprove ? { openApprove: "1" } : {}),
    ...(focusVerify ? { focus: "verify" } : {}),
  });
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

function renderOpenApprove(diagnostic: DossierDiagnostic) {
  useAuthStore.setState({ status: "authenticated", user: { id: "user-1", role: "ADMIN_ONEFOP" } as never });
  const queryClient = createTestQueryClient();
  return renderWithProviders(<Harness returnTo="/admin/dossiers?vue=submissions&queueView=mine" openApprove />, {
    locale: "en",
    queryClient,
    queryData: [
      [["admin", "dossier", DOSSIER.id, false], CORRECTION_DOSSIER],
      [["admin", "diagnostic", DOSSIER.id, false], diagnostic],
      [["admin", "dossier-claim-state", DOSSIER.id], CLAIM],
      [["onefop-schema"], loadOnefopSchema()],
    ],
  });
}

test("Valider on a file with a blocking anomaly stays on the workspace and says why", async () => {
  renderOpenApprove({
    ...DIAGNOSTIC,
    axis2BlockingCount: 1,
    blockingAnomalies: [{ ruleCode: "S4_TOTAL", description: "Total does not match", observedValue: 48, expectedValue: 52 }],
  });
  await waitFor(() => assert.ok(screen.getByText("Resolve all blocking issues before approval.")));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(screen.queryByRole("dialog"), null, "no approval dialog on a blocked file");
  assert.equal((screen.getByRole("button", { name: "Endorse" }) as HTMLButtonElement).disabled, true);
  assert.deepEqual(navigationMock.replaced.filter((href) => href.includes("preview")), [], "never sent back to the old drawer");
});

test("Valider on a clean file opens the approval dialog in the workspace", async () => {
  renderOpenApprove(DIAGNOSTIC);
  await waitFor(() => assert.ok(screen.getByRole("dialog")));
});

const FINDINGS: DossierDiagnostic = {
  ...DIAGNOSTIC,
  axis2BlockingCount: 1,
  axis2WarningCount: 1,
  blockingAnomalies: [{ ruleCode: "VT_TOTAL", ruleFamily: "VT_COHERENCE", description: "Blocking total mismatch", observedValue: 48, expectedValue: 52 }],
  warningAnomalies: [{ ruleCode: "S22_SUBSET", ruleFamily: "COHERENCE", description: "Advisory subset above total", observedValue: 3, expectedValue: 2 }],
};

function renderWorkspace(options: { diagnostic?: DossierDiagnostic; dossier?: AdminDossier; progress?: unknown; focusVerify?: boolean } = {}) {
  useAuthStore.setState({ status: "authenticated", user: { id: "user-1", role: "ADMIN_ONEFOP" } as never });
  return renderWithProviders(<Harness focusVerify={options.focusVerify} />, {
    locale: "en",
    queryClient: createTestQueryClient(),
    queryData: [
      // ENTREPRISE is the stored form type the schema maps; the suite's
      // ENTERPRISE fixture renders no questionnaire sections.
      [["admin", "dossier", DOSSIER.id, false], { ...(options.dossier ?? CORRECTION_DOSSIER), formType: "ENTREPRISE" }],
      [["admin", "diagnostic", DOSSIER.id, false], options.diagnostic ?? FINDINGS],
      [["admin", "dossier-claim-state", DOSSIER.id], CLAIM],
      [["admin", "dossier-review-progress", DOSSIER.id], options.progress ?? { submissionId: DOSSIER.id, items: [] }],
      [["onefop-schema"], loadOnefopSchema()],
    ],
  });
}

test("the rail counts the open findings and every link in its index reaches a section on the page", () => {
  const { container } = renderWorkspace();
  const rail = screen.getByRole("navigation", { name: "Dossier section index" });
  assert.ok(container.textContent?.includes("1 blocking"));
  assert.ok(container.textContent?.includes("1 warnings"));
  const targets = [...rail.querySelectorAll("a")].map((link) => link.getAttribute("href") ?? "");
  assert.equal(targets[0], "#dossier-verify", "« To verify » comes first");
  assert.equal(targets.at(-1), "#dossier-history", "« Notes and history » comes last");
  assert.ok(targets.length > 3, "the questionnaire sections are listed");
  for (const target of targets) assert.ok(container.querySelector(target), `${target} exists on the page`);
  assert.ok(rail.textContent?.includes("To verify · 2"));
});

test("« To verify » lists blocking findings before warnings, each with its observed and expected values", () => {
  renderWorkspace();
  const findings = document.getElementById("dossier-verify")!;
  const text = findings.textContent ?? "";
  assert.ok(text.indexOf("Blocking total mismatch") < text.indexOf("Advisory subset above total"));
  assert.ok(findings.querySelector(".is-blocking")?.textContent?.includes("Blocking total mismatch"));
  assert.ok(findings.querySelector(".is-warning")?.textContent?.includes("Advisory subset above total"));
  assert.ok(text.includes("48") && text.includes("52"));
});

test("notes and the file's milestones form one list in « Notes and history », newest first", () => {
  renderWorkspace({
    dossier: DOSSIER,
    diagnostic: DIAGNOSTIC,
    progress: { submissionId: DOSSIER.id, items: [{ id: "n1", actorId: "user-1", createdAt: "2026-10-02T09:00:00.000Z", progressType: "NOTE", note: "Checked the regional totals.", anomalyId: null }] },
  });
  const history = document.getElementById("dossier-history")!;
  const lists = history.querySelectorAll("ul");
  assert.equal(lists.length, 1, "one list, not two");
  const items = [...lists[0].querySelectorAll("li")].map((item) => item.textContent ?? "");
  assert.ok(items[0].includes("Checked the regional totals."), "the newest entry, the note, comes first");
  assert.ok(items[1].includes("Administrative endorsement granted"));
  assert.ok(items[2].includes("Declaration received by the central server"));
});

test("arriving from « Examine issues » scrolls to « To verify »", async () => {
  const scrolled: string[] = [];
  const original = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = function scrollIntoView(this: HTMLElement) { scrolled.push(this.id); };
  try {
    renderWorkspace({ focusVerify: true });
    await waitFor(() => assert.ok(scrolled.includes("dossier-verify")));
  } finally {
    HTMLElement.prototype.scrollIntoView = original;
  }
});

test("every questionnaire section of an enterprise file is open: nothing to expand", () => {
  const { container } = renderWorkspace();
  const sections = container.querySelectorAll(".cam-dossier-answer-column [id^='dossier-section-']");
  assert.ok(sections.length > 1, "several sections are on the page");
  for (const details of container.querySelectorAll(".cam-dossier-answer-column details")) {
    assert.equal((details as HTMLDetailsElement).open, true, "no section is collapsed");
  }
});
