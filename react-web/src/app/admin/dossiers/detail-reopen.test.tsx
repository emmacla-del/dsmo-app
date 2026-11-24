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

test("a background refetch leaves the bar's decisions on screen and usable", async () => {
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
      // No flicker when the reviewer returns to the window: the server's
      // revision check, not a greyed button, refuses a decision on a stale file.
      assert.equal((screen.getByRole("button", { name }) as HTMLButtonElement).disabled, false, `${name} stays usable`);
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
  assert.ok(container.textContent?.includes("1 warning"));
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

// Layout v2 (spec §4C, 2026-11-02): a section with a finding stays open; a
// section without one folds, and is still on the page and in the index.
test("sections with a finding are open; the others fold and stay on the page", () => {
  const { container } = renderWorkspace();
  const sections = [...container.querySelectorAll(".cam-dossier-answer-column [id^='dossier-section-']")];
  assert.ok(sections.length > 1, "several sections are on the page");
  for (const section of sections) {
    const flagged = section.querySelector(".cam-dossier-field-flag") !== null;
    if (flagged) assert.ok(!(section instanceof HTMLDetailsElement) || section.open, `${section.id} has a finding and is open`);
    if (section instanceof HTMLDetailsElement && !flagged) assert.equal(section.classList.contains("is-quiet"), true, `${section.id} folds as a quiet section`);
  }
});

test("a rule fired for men, women and total is one finding, worded, with links to the tables it compares", () => {
  const diagnostic: DossierDiagnostic = {
    ...DIAGNOSTIC,
    axis2WarningCount: 3,
    warningAnomalies: (["male", "female", "total"] as const).map((sex, index) => ({
      ruleCode: "S22Q03_DIPLOMA_MISMATCH",
      ruleFamily: "COHERENCE",
      description: `Répartition des recrutements par diplôme (S22Q03: 0, ${sex}) ne correspond pas au total (S22Q01+S22Q02: ${index + 1}, ${sex}).`,
      observedValue: 0,
      expectedValue: index + 1,
    })),
  };
  const { container } = renderWorkspace({ diagnostic });
  const findings = document.getElementById("dossier-verify")!;
  assert.ok(findings.textContent?.includes("To verify · 1"), "three anomalies, one rule, one thing to check");
  assert.ok(findings.textContent?.includes("Recruitment broken down by diploma"), "worded in the reader's language");
  assert.ok(!/S22Q0d/.test(findings.textContent ?? ""), "no variable code in the finding");
  const links = [...findings.querySelectorAll(".cam-dossier-finding-targets a")].map((link) => link.getAttribute("href") ?? "");
  assert.deepEqual(links, ["#dossier-field-S22Q03", "#dossier-field-S22Q01", "#dossier-field-S22Q02"]);
  for (const href of links) assert.ok(container.querySelector(href), `${href} exists on the page`);
});

test("the header names the form type in words and shows the short reference", () => {
  const { container } = renderWorkspace();
  const header = container.querySelector("header")!;
  assert.ok(header.textContent?.includes("Company"), "the registration wording for the form type");
  assert.ok(!header.textContent?.includes("ENTREPRISE"), "no stored code");
  assert.ok(document.getElementById("dossier-structure")?.textContent?.includes("Littoral"), "Section 1's location sits in Identification");
});

test("a flagged table is marked where it sits, and the rail shows which section holds it", () => {
  const diagnostic: DossierDiagnostic = {
    ...DIAGNOSTIC,
    axis2WarningCount: 1,
    warningAnomalies: [{
      ruleCode: "S22Q04_PERMANENT_EXCEEDS_TOTAL",
      ruleFamily: "COHERENCE",
      description: "Recrutements permanents de personnes en situation de handicap (S22Q04: 3, male) supérieurs au total des recrutements permanents (S22Q01: 2, male).",
      observedValue: 3,
      expectedValue: 2,
    }],
  };
  // The figures behind the warning: 3 men with a disability, 2 men recruited.
  // A stored warning the figures do not show is not placed on tables.
  const dossier = { ...CORRECTION_DOSSIER, rawData: { s22q01_total_male_total: 2, s22q04_total_permanent_male: 3 } };
  const { container } = renderWorkspace({ diagnostic, dossier });
  const disability = container.querySelector("#dossier-field-S22Q04")!;
  assert.ok(disability.classList.contains("is-flagged"), "the table carries the mark");
  const notice = disability.querySelector(".cam-dossier-field-flag")!;
  assert.ok(notice.textContent?.includes("Permanent recruitment of people with a disability"), "the finding is said above the table");
  assert.equal(notice.querySelector("a")?.getAttribute("href"), "#dossier-verify", "and leads back to the list");
  assert.ok(container.querySelector("#dossier-field-S22Q01")?.classList.contains("is-flagged"), "the total it is compared with is marked too");
  assert.equal(container.querySelector("#dossier-field-S21Q01")?.classList.contains("is-flagged"), false, "an unconcerned table is not");
  const rail = screen.getByRole("navigation", { name: "Dossier section index" });
  assert.ok(rail.querySelector(".cam-dossier-rail-flag"), "the rail marks the section holding the flagged tables");
});
