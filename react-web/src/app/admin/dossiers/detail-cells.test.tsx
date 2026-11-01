import { createTestQueryClient, renderWithProviders, screen, navigationMock, waitFor } from "@/test/render";
import { loadOnefopSchema } from "@/test/schema";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { AdminDossier, DossierDiagnostic } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { explainedFindingsKey } from "@/components/admin/DossierExplainFinding";
import SubmissionDetailPage from "./[id]/page";

// jsdom has neither scrollIntoView nor CSS.escape; the jump to a cell uses both.
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
(globalThis as { CSS?: { escape: (value: string) => string } }).CSS ??= { escape: (value: string) => value };

// 4 men recruited on permanent contracts, none temporary, but 2 men by diploma.
const RECRUITED = {
  S22Q01_RESPONSE_STATUS: "REPORTED",
  s22q01_workers_male_25_34: 4, s22q01_workers_male_total: 4,
  s22q01_total_male_25_34: 4, s22q01_total_male_total: 4, s22q01_total_total_total: 4,
  S22Q02_RESPONSE_STATUS: "NONE",
  S22Q03_RESPONSE_STATUS: "REPORTED",
  s22q03_workers_bac_male_25_34: 2, s22q03_workers_bac_male_total: 2,
  s22q03_workers_total_male_25_34: 2, s22q03_workers_total_male_total: 2, s22q03_workers_total_total_total: 2,
};

function dossier(rawData: Record<string, unknown>) {
  return {
    id: "dossier-1", submissionId: "SUB-2026-0001", revision: 3, formType: "ENTREPRISE", status: "PENDING_REVIEW",
    updatedAt: "2026-10-01T10:00:00.000Z", region: "Littoral", department: "Wouri", subdivision: null,
    submissionDate: "2026-09-30T10:00:00.000Z", reviewedAt: null, rejectionReason: null, quarterCode: "2026-T3",
    taxNumber: null, cnpsNumber: null, registrationNumber: null, respondent: null, enterpriseDetail: {},
    cooperativeDetail: null, ctdDetail: null, ongDetail: null, administrationDetail: null,
    projectProgramDetail: null, vocationalTrainingDetail: null, rawData,
  } as unknown as AdminDossier;
}

const warning = (sex: string, observed: number, expected: number) => ({
  id: `w-${sex}`, ruleCode: "S22Q03_DIPLOMA_MISMATCH", ruleFamily: "COHERENCE", isBlocking: false,
  description: `Répartition (S22Q03: ${observed}, ${sex}) ne correspond pas (S22Q01+S22Q02: ${expected}, ${sex}).`,
  observedValue: String(observed), expectedValue: String(expected),
});

const DIAGNOSTIC = {
  submissionId: "SUB-2026-0001", axis1Status: "PENDING_REVIEW", axis2BlockingCount: 0, axis2WarningCount: 2,
  axis3Eligibility: "BLOCKED", blockingAnomalies: [], warningAnomalies: [warning("male", 2, 4), warning("total", 2, 4)],
} as unknown as DossierDiagnostic;

function Harness() {
  navigationMock.params = { id: "dossier-1" };
  navigationMock.searchParams = new URLSearchParams();
  return <SubmissionDetailPage />;
}

function renderDetail(rawData: Record<string, unknown>, diagnostic: DossierDiagnostic = DIAGNOSTIC, explained: unknown[] = []) {
  useAuthStore.setState({ status: "authenticated", user: { id: "user-1", role: "ADMIN_ONEFOP" } as never });
  const queryClient = createTestQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false, gcTime: Infinity, staleTime: Infinity }, mutations: { retry: false, gcTime: 0 } });
  return renderWithProviders(<Harness />, {
    locale: "en",
    queryClient,
    queryData: [
      [["admin", "dossier", "dossier-1", false], dossier(rawData)],
      [["admin", "diagnostic", "dossier-1", false], diagnostic],
      [["admin", "dossier-claim-state", "dossier-1"], { id: "c", questionnaireId: "dossier-1", assigneeId: "user-1", status: "PENDING_REVIEW", eligible: true }],
      [[...explainedFindingsKey("dossier-1")], { total: explained.length, items: explained }],
      [["onefop-schema"], loadOnefopSchema()],
    ],
  });
}

const marked = (container: HTMLElement, key: string) =>
  Boolean((container.querySelector(`[data-coherence-cell="${key}"]`) as HTMLElement | null)?.style.boxShadow);

test("the figures behind a finding are marked in both tables, and only those", () => {
  const { container } = renderDetail(RECRUITED);
  assert.ok(marked(container, "s22q01_total_male_total"), "the permanent recruitment total");
  assert.ok(marked(container, "s22q03_workers_total_male_total"), "the diploma total it is compared with");
  assert.equal(marked(container, "s22q01_workers_male_25_34"), false, "a detail cell the rule does not compare");
  // The compare line: each table's figure, as a link.
  // The compare line, one row per sex (men and total here): each table's figure, as a link.
  assert.equal(screen.getAllByRole("button", { name: "Recruitment by diploma 2" }).length, 2);
  assert.equal(screen.getAllByRole("button", { name: "Permanent recruitment 4" }).length, 2);
  assert.equal(container.querySelector(".cam-dossier-finding-stale"), null);
});

test("the note on a marked figure gives the comparison and the connected table, and offers no « This is correct »", async () => {
  const { user, container } = renderDetail(RECRUITED);
  await user.click(container.querySelector('[data-coherence-cell="s22q01_total_male_total"]') as HTMLElement);
  const note = await waitFor(() => {
    const dialog = screen.getByRole("dialog");
    return dialog.textContent ?? "";
  });
  assert.ok(/Recruitment by diploma|Permanent recruitment/.test(note), "names a connected table");
  assert.ok(!/This is correct/.test(container.ownerDocument.body.textContent ?? ""), "a reviewer cannot hide the mark");
});

test("a stored finding the figures no longer show is said so, and nothing is marked", () => {
  const agree = { ...RECRUITED, s22q03_workers_bac_male_25_34: 4, s22q03_workers_bac_male_total: 4, s22q03_workers_total_male_25_34: 4, s22q03_workers_total_male_total: 4, s22q03_workers_total_total_total: 4 };
  const { container } = renderDetail(agree);
  assert.ok(container.querySelector(".cam-dossier-finding-stale")?.textContent?.includes("these totals agree"));
  assert.equal(marked(container, "s22q01_total_male_total"), false);
  assert.equal(screen.queryByRole("button", { name: /Permanent recruitment/ }), null);
  assert.equal(container.querySelector(".cam-dossier-field-flag"), null, "no « Check here » on tables that agree");
});

test("a figure in the compare line jumps to it and opens its note", async () => {
  const { user } = renderDetail(RECRUITED);
  await user.click(screen.getAllByRole("button", { name: "Recruitment by diploma 2" })[0]);
  await waitFor(() => assert.ok(screen.getByRole("dialog")), { timeout: 3000 });
});

const NO_FINDING = { ...DIAGNOSTIC, axis2WarningCount: 0, warningAnomalies: [] } as unknown as DossierDiagnostic;

test("a gap in the figures with no stored finding is detected on review, marked, and not offered « Explain »", () => {
  const { container } = renderDetail(RECRUITED, NO_FINDING);
  const verify = container.querySelector("#dossier-verify")!;
  assert.ok(verify.textContent?.includes("Detected on review · 1"));
  assert.ok(verify.textContent?.includes("The breakdown by diploma counts 2 men, but permanent and temporary recruitment count 4 men."));
  assert.ok(verify.textContent?.includes("« Re-run the checks » records them"));
  assert.equal(screen.queryByRole("button", { name: "Explain" }), null, "nothing stored, nothing to explain");
  assert.ok(marked(container, "s22q01_total_male_total"));
  assert.ok(marked(container, "s22q03_workers_total_male_total"));
  assert.ok(container.textContent?.includes("1 detected on review"), "the rail counts it");
  assert.ok(!verify.textContent?.includes("No anomaly detected"), "never « conforme » while a gap is shown");
});

test("a gap a reviewer has already explained is not detected again", () => {
  const explainedRow = { ruleCode: "S22Q03_DIPLOMA_MISMATCH", description: "x", resolutionNote: "Confirmé par téléphone", resolvedAt: "2026-10-20T10:00:00.000Z", resolvedBy: null };
  const { container } = renderDetail(RECRUITED, NO_FINDING, [explainedRow]);
  assert.ok(!container.querySelector("#dossier-verify")?.textContent?.includes("Detected on review"));
  assert.equal(marked(container, "s22q01_total_male_total"), false);
});

test("figures that agree and no finding: nothing is marked and the file reads as conforming", () => {
  const agree = { ...RECRUITED, s22q03_workers_bac_male_25_34: 4, s22q03_workers_bac_male_total: 4, s22q03_workers_total_male_25_34: 4, s22q03_workers_total_male_total: 4, s22q03_workers_total_total_total: 4 };
  const { container } = renderDetail(agree, NO_FINDING);
  assert.equal([...container.querySelectorAll("[data-coherence-cell]")].filter((td) => (td as HTMLElement).style.boxShadow).length, 0);
  assert.ok(container.querySelector("#dossier-verify")?.textContent?.includes("No anomaly detected"));
});

test("each finding has its own number and colour, in the list and on its figures", () => {
  // Gap 1: diploma (2 men) vs recruitment (4 men). Gap 2: 5 men with a disability, more than the 4 recruited.
  const data = { ...RECRUITED, S22Q04_RESPONSE_STATUS: "REPORTED", s22q04_total_permanent_male: 5 };
  const disability = {
    id: "w-dis", ruleCode: "S22Q04_PERMANENT_EXCEEDS_TOTAL", ruleFamily: "COHERENCE", isBlocking: false,
    description: "Recrutements permanents de personnes en situation de handicap (S22Q04: 5, male) supérieurs au total des recrutements permanents (S22Q01: 4, male).",
    observedValue: "5", expectedValue: "4",
  };
  const diagnostic = { ...DIAGNOSTIC, axis2WarningCount: 3, warningAnomalies: [...(DIAGNOSTIC.warningAnomalies as unknown[]), disability] } as unknown as DossierDiagnostic;
  const { container } = renderDetail(data, diagnostic);
  const entries = [...container.querySelectorAll("#dossier-verify .is-numbered")] as HTMLElement[];
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((entry) => entry.querySelector(".cam-dossier-finding-title")?.textContent?.trim().charAt(0)), ["1", "2"]);
  assert.notEqual(entries[0].style.borderInlineStartColor, entries[1].style.borderInlineStartColor, "two colours");
  const cell = (key: string) => container.querySelector(`[data-coherence-cell="${key}"]`) as HTMLElement;
  assert.ok(cell("s22q03_workers_total_male_total").style.boxShadow.includes("--cam-anomaly-1"));
  assert.ok(cell("s22q04_total_permanent_male").style.boxShadow.includes("--cam-anomaly-2"));
  // The permanent total takes part in both: it carries both numbers.
  assert.ok(/1.*2/.test(cell("s22q01_total_male_total").textContent ?? ""));
});
