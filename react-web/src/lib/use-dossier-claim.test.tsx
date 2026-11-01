import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import type { QueryClient } from "@tanstack/react-query";
import { renderWithProviders, cleanup, screen } from "@/test/render";
import type { DossierClaimState } from "@/lib/api-client";
import { DossierBarClaim } from "@/components/admin/DossierBarClaim";
import { dossierClaimStateKey, useDossierClaim } from "./use-dossier-claim";

// The claim behaviour the decision bar relies on, moved here from the claim
// panel's tests when the panel lost its claim control (plan, Phase 3).
const dossierId = "dossier-1";
const userId = "agent-1";
const role = "ADMIN_ONEFOP_SUBMISSIONS";
const free: DossierClaimState = {
  submissionId: dossierId,
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
  lastActivityAt: "2026-10-30T10:00:00.000Z",
  expiresAt: "2026-10-30T22:00:00.000Z",
};

function Bar() {
  const { claimStateQuery, claimMutation, actionNotice } = useDossierClaim(dossierId);
  return (
    <div>
      {claimStateQuery.data && (
        <DossierBarClaim
          claim={claimStateQuery.data}
          userId={userId}
          role={role}
          readOnly={false}
          busy={claimStateQuery.isFetching || claimMutation.isPending}
          saving={claimMutation.isPending}
          onChange={(assigneeId) => claimMutation.mutate(assigneeId)}
        />
      )}
      {actionNotice && <p role="status">{actionNotice}</p>}
    </div>
  );
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const clients = new Set<QueryClient>();
afterEach(async () => {
  cleanup();
  for (const client of clients) {
    await client.cancelQueries();
    client.clear();
  }
  clients.clear();
});

function renderBar(initial: DossierClaimState, extra: Array<[readonly unknown[], unknown]> = []) {
  const rendered = renderWithProviders(<Bar />, {
    locale: "en",
    queryData: [[dossierClaimStateKey(dossierId), initial], ...extra],
  });
  clients.add(rendered.queryClient);
  return rendered;
}

test("claiming sends only the reviewer, no client revision, and refreshes the queue and the claim from the server", async () => {
  const originalFetch = globalThis.fetch;
  const bodies: unknown[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/assign") && init?.method === "PATCH") {
      bodies.push(JSON.parse(String(init.body)));
      return json({ id: dossierId, assigneeId: userId, assigneeName: "Agent One" });
    }
    if (url.endsWith("/claim-state")) return json(mine);
    return json({});
  }) as typeof fetch;
  try {
    const { user, queryClient } = renderBar(free, [[["admin", "questionnaires", "list", "submissions"], { items: [] }]]);
    await user.click(screen.getByRole("button", { name: "Claim for me" }));
    await screen.findByText("Claim state updated. The dossier is refreshing.");
    await screen.findByRole("button", { name: "Release claim" });
    assert.deepEqual(bodies, [{ assigneeId: userId }]);
    assert.equal(queryClient.getQueryState(["admin", "questionnaires", "list", "submissions"])?.isInvalidated, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("releasing sends null and shows the file free again, as the server reports it", async () => {
  const originalFetch = globalThis.fetch;
  const bodies: unknown[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/assign") && init?.method === "PATCH") {
      bodies.push(JSON.parse(String(init.body)));
      return json({ id: dossierId, assigneeId: null, assigneeName: null });
    }
    if (url.endsWith("/claim-state")) return json(free);
    return json({});
  }) as typeof fetch;
  try {
    const { user } = renderBar(mine);
    await user.click(screen.getByRole("button", { name: "Release claim" }));
    await screen.findByText("Claim state updated. The dossier is refreshing.");
    await screen.findByRole("button", { name: "Claim for me" });
    assert.deepEqual(bodies, [{ assigneeId: null }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a second click while the claim request is pending sends nothing", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  let resolve: ((response: Response) => void) | undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/assign") && init?.method === "PATCH") {
      requests += 1;
      return new Promise<Response>((done) => { resolve = done; });
    }
    if (url.endsWith("/claim-state")) return json(mine);
    return json({});
  }) as typeof fetch;
  try {
    const { user } = renderBar(free);
    await user.click(screen.getByRole("button", { name: "Claim for me" }));
    const saving = await screen.findByRole("button", { name: "Saving…" }) as HTMLButtonElement;
    assert.equal(saving.disabled, true);
    await user.click(saving);
    assert.equal(requests, 1);
    resolve?.(json({ id: dossierId, assigneeId: userId, assigneeName: "Agent One" }));
    await screen.findByText("Claim state updated. The dossier is refreshing.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a claim conflict says so and reloads the claim from the server", async () => {
  const originalFetch = globalThis.fetch;
  let claimReads = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/assign") && init?.method === "PATCH") return json({ statusCode: 409, message: "Claimed by someone else" }, 409);
    if (url.endsWith("/claim-state")) {
      claimReads += 1;
      return json({ ...mine, assigneeId: "agent-2", assigneeName: "Agent Two" });
    }
    return json({});
  }) as typeof fetch;
  try {
    const { user } = renderBar(free);
    await user.click(screen.getByRole("button", { name: "Claim for me" }));
    await screen.findByText("Claimed by Agent Two");
    assert.ok(claimReads > 0);
    assert.equal(screen.queryByRole("button", { name: "Claim for me" }), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
