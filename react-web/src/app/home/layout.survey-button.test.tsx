import { renderWithProviders, screen, navigationMock, act } from "@/test/render";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import HomeLayout from "./layout";
import {
  activeQuarterQueryOptions,
  meQueryOptions,
  myCompanyQueryOptions,
  mySubmissionsQueryOptions,
  unreadNotificationCountQueryOptions,
} from "@/lib/shared-queries";

// Defect 23 (2026-10-16 VT run): /home showed two green "Take the survey"
// buttons, the rail's and the survey card's. One primary action per screen
// (§11): the rail keeps it on the other pages only.

const approvedUser = { id: "u1", email: "cfp@example.cm", role: "COMPANY", status: "ACTIVE", firstName: "Aline", lastName: "Testeur" };

afterEach(() => localStorage.clear());

test("the rail's survey button is shown away from /home, and not on /home", async () => {
  localStorage.setItem("camleap.access_token", "test-token");
  const ui = (
    <HomeLayout>
      <p>page</p>
    </HomeLayout>
  );
  const { rerender } = renderWithProviders(ui, {
    locale: "en",
    queryData: [
      [meQueryOptions.queryKey, approvedUser],
      [myCompanyQueryOptions.queryKey, { name: "CFP Test", entityType: "VOCATIONAL_TRAINING" }],
      [activeQuarterQueryOptions.queryKey, { code: "QUARTERLY_2026_T4_001", isOpen: true }],
      [mySubmissionsQueryOptions.queryKey, { dsmo: [], onefop: [] }],
      [unreadNotificationCountQueryOptions.queryKey, 0],
    ],
  });
  navigationMock.pathname = "/home/messages";
  rerender(ui);
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
  assert.ok(screen.queryByRole("button", { name: /Take the survey/ }), "on another page the rail offers it");

  navigationMock.pathname = "/home";
  rerender(ui);
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
  assert.equal(screen.queryByRole("button", { name: /Take the survey/ }), null, "on /home the card carries it");
});
