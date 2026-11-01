import { renderWithProviders, screen, cleanup } from "@/test/render";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import type { DossierClaimState } from "@/lib/api-client";
import { DossierBarClaim } from "./DossierBarClaim";

const userId = "agent-1";
const role = "ADMIN_ONEFOP_SUBMISSIONS";
const free: DossierClaimState = {
  submissionId: "dossier-1",
  status: "PENDING_REVIEW",
  eligible: true,
  assigneeId: null,
  assigneeName: null,
  expired: false,
  activityTracked: false,
  lastActivityAt: null,
  expiresAt: null,
};
const mine: DossierClaimState = {
  ...free,
  assigneeId: userId,
  assigneeName: "Agent One",
  activityTracked: true,
  lastActivityAt: "2026-11-01T08:00:00.000Z",
  expiresAt: "2026-11-01T20:00:00.000Z",
};

afterEach(() => cleanup());

function renderBar(claim: DossierClaimState, options: { readOnly?: boolean; busy?: boolean; saving?: boolean } = {}) {
  const calls: Array<string | null> = [];
  const rendered = renderWithProviders(
    <DossierBarClaim
      claim={claim}
      userId={userId}
      role={role}
      readOnly={options.readOnly ?? false}
      busy={options.busy ?? false}
      saving={options.saving ?? false}
      onChange={(assigneeId) => calls.push(assigneeId)}
    />,
  );
  return { ...rendered, calls };
}

test("a free file says so and offers to claim it for me", async () => {
  const { user, calls } = renderBar(free);
  assert.ok(screen.getByText("Dossier libre"));
  await user.click(screen.getByRole("button", { name: "Me réclamer ce dossier" }));
  assert.deepEqual(calls, [userId]);
});

test("my claim shows when it expires and offers release, which sends null", async () => {
  const { user, calls } = renderBar(mine);
  assert.ok(screen.getByText(/^Réclamé par vous · expire /));
  await user.click(screen.getByRole("button", { name: "Libérer ma réclamation" }));
  assert.deepEqual(calls, [null]);
});

test("a legacy claim with no activity time is still mine, with no expiry shown", () => {
  renderBar({ ...mine, activityTracked: false, lastActivityAt: null, expiresAt: null });
  assert.ok(screen.getByText("Réclamé par vous"));
  assert.ok(screen.getByRole("button", { name: "Libérer ma réclamation" }));
});

test("someone else's claim names them and offers no claim action", () => {
  renderBar({ ...mine, assigneeId: "agent-2", assigneeName: "Agent Two" });
  assert.ok(screen.getByText("Réclamé par Agent Two"));
  assert.equal(screen.queryByRole("button"), null);
});

test("a read-only viewer sees the holder but never a claim action", () => {
  renderBar(free, { readOnly: true });
  assert.ok(screen.getByText("Dossier libre"));
  assert.equal(screen.queryByRole("button"), null);
});

test("an expired claim says so and the file can be claimed again", () => {
  renderBar({ ...free, expired: true });
  assert.ok(screen.getByRole("status").textContent?.includes("a expiré"));
  assert.ok(screen.getByRole("button", { name: "Me réclamer ce dossier" }));
});

test("a decided file shows no claim at all", () => {
  const { container } = renderBar({ ...free, status: "APPROVED", eligible: false });
  assert.equal(container.textContent, "");
});

test("while a claim request or refresh is in flight the action waits, disabled", () => {
  renderBar(free, { busy: true, saving: true });
  const button = screen.getByRole("button", { name: "Enregistrement…" }) as HTMLButtonElement;
  assert.equal(button.disabled, true);
});

test("the expiry reads like a clock, without seconds, with the day when it is not today", async () => {
  const { claimExpiryTime } = await import("./DossierBarClaim");
  const now = new Date("2026-11-01T10:00:00");
  assert.equal(claimExpiryTime("2026-11-01T15:50:34", "fr", now), "15:50");
  const tomorrow = claimExpiryTime("2026-11-02T03:50:34", "fr", now);
  assert.ok(!/\d\d:\d\d:\d\d/.test(tomorrow), "no seconds");
  assert.ok(tomorrow.includes("2"), "the day is named");
});
