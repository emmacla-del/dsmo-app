import { renderWithProviders, screen } from "@/test/render";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import HomeLandingPage from "./page";
import { activeQuarterQueryOptions, meQueryOptions, myCompanyQueryOptions, mySubmissionsQueryOptions } from "@/lib/shared-queries";

// 2026-10-16 re-test (defect 23 note): while the filings loaded, the survey
// card said "expected before the deadline · Take the survey" for about 5 s,
// to a centre that had already filed. Until they load, it says Loading.

const user = { id: "u1", email: "cfp@example.cm", role: "COMPANY", status: "ACTIVE", firstName: "Aline", lastName: "Testeur" };
const base: Array<[readonly unknown[], unknown]> = [
  [meQueryOptions.queryKey, user],
  [myCompanyQueryOptions.queryKey, { name: "CFP Test", entityType: "VOCATIONAL_TRAINING" }],
  [activeQuarterQueryOptions.queryKey, { code: "QUARTERLY_2026_T4_001", isOpen: true }],
];

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("while the filings load, the card neither says the survey is expected nor offers to take it", () => {
  // The filings request never answers within the test.
  globalThis.fetch = (() => new Promise<Response>(() => {})) as typeof fetch;
  renderWithProviders(<HomeLandingPage />, { locale: "en", queryData: base });
  assert.equal(screen.queryByText(/expected before the deadline/), null);
  assert.equal(screen.queryByRole("button", { name: /Take the survey/ }), null);
  assert.ok(screen.getAllByText("Loading…").length > 0);
});

test("once loaded with no filing, the card asks for the survey", () => {
  renderWithProviders(<HomeLandingPage />, {
    locale: "en",
    queryData: [...base, [mySubmissionsQueryOptions.queryKey, { dsmo: [], onefop: [] }]],
  });
  assert.ok(screen.getByText(/expected before the deadline/));
  assert.ok(screen.getByRole("button", { name: /Take the survey/ }));
});
