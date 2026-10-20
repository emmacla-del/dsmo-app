import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import HomeLandingPage from "./page";
import {
  activeQuarterQueryOptions,
  meQueryOptions,
  myCompanyQueryOptions,
  myNotificationsQueryOptions,
  mySubmissionsQueryOptions,
} from "@/lib/shared-queries";

// Tidy pass on the respondent home (owner, 2026-10-20): one column, no
// cards, each fact once.

const user = { id: "u1", email: "pp@example.cm", role: "COMPANY", status: "ACTIVE", firstName: "Paul", lastName: "Nkomo" };
const company = {
  name: "Projet Emploi Jeunes",
  entityType: "PROJECT_PROGRAM",
  establishmentId: "PP26000102",
  taxNumber: "M012345678901A",
  cnpsNumber: "123456",
  subdivision: "Yaoundé 2",
  department: "Mfoundi",
  region: "Centre",
};
const current = {
  id: "s-current",
  status: "PENDING_REVIEW",
  quarterCode: "QUARTERLY_2026_T4_001",
  entityType: "PROJECT_PROGRAM",
  submittedAt: "2026-10-17T14:36:00Z",
};
const earlier = {
  id: "s-earlier",
  status: "APPROVED",
  quarterCode: "QUARTERLY_2026_T3_001",
  entityType: "PROJECT_PROGRAM",
  submittedAt: "2026-08-02T09:00:00Z",
};

function render(onefop: unknown[], messages: unknown[] = []) {
  return renderWithProviders(<HomeLandingPage />, {
    locale: "en",
    queryData: [
      [meQueryOptions.queryKey, user],
      [myCompanyQueryOptions.queryKey, company],
      [activeQuarterQueryOptions.queryKey, { code: "QUARTERLY_2026_T4_001", isOpen: true, deadline: "2026-12-31" }],
      [mySubmissionsQueryOptions.queryKey, { dsmo: [], onefop }],
      [myNotificationsQueryOptions.queryKey, messages],
    ],
  });
}

test("the identity line names the type, the sign-in ID and the place, not the NIU or CNPS", () => {
  const { unmount } = render([current]);
  assert.ok(screen.getByRole("heading", { level: 1, name: "Projet Emploi Jeunes" }));
  assert.ok(screen.getByText(/PP26000102 · Yaoundé 2, Mfoundi, Centre$/));
  assert.equal(screen.queryByText(/M012345678901A/), null);
  assert.equal(screen.queryByText(/Verified/), null);
  unmount();
});

test("the campaign's filing is shown once, and earlier ones are listed without code badges", () => {
  const { unmount } = render([current, earlier]);
  // One "Awaiting review" (the survey block), one "Approved" (the earlier list).
  assert.equal(screen.getAllByText("Awaiting review").length, 1);
  assert.ok(screen.getByRole("heading", { name: "Earlier declarations" }));
  assert.equal(screen.getAllByRole("listitem").length, 1);
  assert.equal(screen.queryByText("ONEFOP"), null);
  unmount();
});

test("with no earlier filing and no message, those sections are not drawn", () => {
  const { unmount } = render([current]);
  assert.equal(screen.queryByRole("heading", { name: "Earlier declarations" }), null);
  assert.equal(screen.queryByRole("heading", { name: "Latest messages" }), null);
  unmount();
});
