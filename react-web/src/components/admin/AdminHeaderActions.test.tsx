import { renderWithProviders, screen } from "@/test/render";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { useAuthStore } from "@/lib/auth-store";
import { useActiveCampaign } from "./AdminHeaderActions";

// Defect 24 (2026-10-16 VT run): while the dashboard loaded, the campaign card
// said "Inactive — No collection campaign is currently active" although one
// was: the campaign was "not loading" before its request had even started.

function Probe() {
  const { isLoading, activeCampaign } = useActiveCampaign();
  return <p>{isLoading ? "loading" : activeCampaign ? `active ${activeCampaign.code}` : "none"}</p>;
}

afterEach(() => useAuthStore.setState({ status: "loading", user: null }));

test("the active campaign is loading until the user is known, never 'none'", () => {
  useAuthStore.setState({ status: "loading", user: null });
  renderWithProviders(<Probe />);
  assert.ok(screen.getByText("loading"));
});

test("with the user known, the answer decides: active, or none", () => {
  useAuthStore.setState({ status: "authenticated", user: { id: "a", email: "a@x.cm", role: "SUPER_ADMIN" } as never });
  const { unmount } = renderWithProviders(<Probe />, {
    queryData: [[["campaigns", "ACTIVE"], [{ id: "c1", code: "QUARTERLY_2026_T4_001", name: "X", status: "ACTIVE" }]]],
  });
  assert.ok(screen.getByText("active QUARTERLY_2026_T4_001"));
  unmount();
  renderWithProviders(<Probe />, { queryData: [[["campaigns", "ACTIVE"], []]] });
  assert.ok(screen.getByText("none"));
});
