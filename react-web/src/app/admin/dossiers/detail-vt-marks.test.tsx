import { createTestQueryClient, renderWithProviders, navigationMock } from "@/test/render";
import { loadOnefopSchema } from "@/test/schema";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { AdminDossier, DossierDiagnostic } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { explainedFindingsKey } from "@/components/admin/DossierExplainFinding";
import SubmissionDetailPage from "./[id]/page";

const DOSSIER = {
  id: "vt-1", submissionId: "VT-2026-0001", revision: 2, formType: "VOCATIONAL_TRAINING", status: "PENDING_REVIEW",
  updatedAt: "2026-10-01T10:00:00.000Z", region: "Centre", department: "Mfoundi", subdivision: null,
  submissionDate: "2026-09-30T10:00:00.000Z", reviewedAt: null, rejectionReason: null, quarterCode: "2026-T3",
  taxNumber: null, cnpsNumber: null, registrationNumber: null, respondent: null, enterpriseDetail: null,
  cooperativeDetail: null, ctdDetail: null, ongDetail: null, administrationDetail: null, projectProgramDetail: null,
  vocationalTrainingDetail: {}, rawData: {},
} as unknown as AdminDossier;

const vtWarning = (id: string, code: string, description: string) => ({
  id, ruleCode: code, ruleFamily: "VT_COHERENCE", isBlocking: false, description,
  observedValue: "Incohérence détectée", expectedValue: "Égalité requise",
});

const DIAGNOSTIC = {
  submissionId: "VT-2026-0001", axis1Status: "PENDING_REVIEW", axis2BlockingCount: 0, axis2WarningCount: 3,
  axis3Eligibility: "BLOCKED", blockingAnomalies: [],
  warningAnomalies: [
    vtWarning("a", "VT_DIPLOMA_ACADEMIC_PRO_MISMATCH", "Effectif total des apprenants par diplôme académique (4.1: 12, hommes) ne correspond pas au total par diplôme professionnel (4.2: 10, hommes)."),
    vtWarning("b", "VT_DIPLOMA_ACADEMIC_PRO_MISMATCH", "Effectif total des apprenants par diplôme académique (4.1: 5, femmes) ne correspond pas au total par diplôme professionnel (4.2: 6, femmes)."),
    vtWarning("c", "VT_TRAINER_AGE_MISMATCH", "Effectif des formateurs par diplôme professionnel (8.2: 4, hommes) ne correspond pas au total par tranche d'âge (8.3: 3, hommes)."),
  ],
} as unknown as DossierDiagnostic;

function Harness() {
  navigationMock.params = { id: "vt-1" };
  navigationMock.searchParams = new URLSearchParams();
  return <SubmissionDetailPage />;
}

function renderVt() {
  useAuthStore.setState({ status: "authenticated", user: { id: "user-1", role: "ADMIN_ONEFOP" } as never });
  const queryClient = createTestQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false, gcTime: Infinity, staleTime: Infinity }, mutations: { retry: false, gcTime: 0 } });
  return renderWithProviders(<Harness />, {
    locale: "en",
    queryClient,
    queryData: [
      [["admin", "dossier", "vt-1", false], DOSSIER],
      [["admin", "diagnostic", "vt-1", false], DIAGNOSTIC],
      [["admin", "dossier-claim-state", "vt-1"], { id: "c", questionnaireId: "vt-1", assigneeId: "user-1", status: "PENDING_REVIEW", eligible: true }],
      [[...explainedFindingsKey("vt-1")], { total: 0, items: [] }],
      [["onefop-schema"], loadOnefopSchema()],
    ],
  });
}

test("each VT finding is numbered, lists both tables' totals by sex, and links to the tables", () => {
  const { container } = renderVt();
  const entries = [...container.querySelectorAll("#dossier-verify .is-numbered")] as HTMLElement[];
  assert.equal(entries.length, 2);
  const diploma = entries[0];
  const links = [...diploma.querySelectorAll(".cam-dossier-finding-compare a")].map((a) => [a.textContent?.replace(/\s+/g, " ").trim(), a.getAttribute("href")]);
  assert.deepEqual(links, [
    ["Table 4.1 12", "#dossier-vt-4-1"], ["Table 4.2 10", "#dossier-vt-4-2"],
    ["Table 4.1 5", "#dossier-vt-4-1"], ["Table 4.2 6", "#dossier-vt-4-2"],
  ]);
  assert.notEqual(entries[0].style.borderInlineStartColor, entries[1].style.borderInlineStartColor);
});

test("the tables a VT finding compares carry its number, and each link has a table to land on", () => {
  const { container } = renderVt();
  const table = (code: string) => container.querySelector(`#dossier-vt-${code}`) as HTMLElement | null;
  for (const code of ["4-1", "4-2", "8-2", "8-3"]) assert.ok(table(code), `table ${code} is on the page`);
  assert.equal(table("4-1")!.querySelector("dt")?.textContent?.trim().charAt(0), "1");
  assert.equal(table("8-3")!.querySelector("dt")?.textContent?.trim().charAt(0), "2");
  assert.ok((table("4-2")!.querySelector("dd") as HTMLElement).style.boxShadow.includes("--cam-anomaly-1"));
  assert.equal((table("4-5")?.querySelector("dd") as HTMLElement | undefined)?.style.boxShadow ?? "", "", "an uncompared table is plain");
});
