import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import type { QueryClient } from "@tanstack/react-query";
import {
  renderWithProviders,
  cleanup,
  screen,
  waitFor,
} from "@/test/render";
import { DossierClaimPanel, dossierClaimStateKey, dossierReviewProgressKey } from "./DossierClaimPanel";
import type { DossierClaimState, DossierReviewProgressPage } from "@/lib/api-client";

const dossierId = "dossier-1";
const userId = "agent-1";
const initialClaim: DossierClaimState = {
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
const emptyProgress: DossierReviewProgressPage = { submissionId: dossierId, items: [] };

const queryClients = new Set<QueryClient>();

function renderPanel(ui: ReturnType<typeof panel>, options: Parameters<typeof renderWithProviders>[1]) {
  const rendered = renderWithProviders(ui, options);
  queryClients.add(rendered.queryClient);
  return rendered;
}

afterEach(async () => {
  cleanup();
  for (const queryClient of queryClients) {
    await queryClient.cancelQueries();
    queryClient.clear();
  }
  queryClients.clear();
});

function panel(revision: number | null = 7) {
  return (
    <DossierClaimPanel
      dossierId={dossierId}
      userId={userId}
      role="ADMIN_ONEFOP_SUBMISSIONS"
      revision={revision}
    />
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function claimResponse(values: Partial<DossierClaimState> = {}): DossierClaimState {
  return {
    ...initialClaim,
    assigneeId: userId,
    assigneeName: "Agent One",
    activityTracked: true,
    lastActivityAt: "2026-10-30T10:00:00.000Z",
    expiresAt: "2026-10-30T22:00:00.000Z",
    ...values,
  };
}

function responseFor(url: string, method: string, values: { claim?: DossierClaimState; progress?: DossierReviewProgressPage } = {}) {
  if (url.endsWith("/claim-state")) return jsonResponse(values.claim ?? claimResponse());
  if (url.endsWith("/review-progress")) return jsonResponse(values.progress ?? emptyProgress);
  if (url.endsWith("/assign")) return jsonResponse({ id: dossierId, assigneeId: userId, assigneeName: "Agent One" });
  return jsonResponse({ revision: 8, assigneeId: userId, note: "Reviewed the financial evidence." });
}

function seedQueries(queryData: Array<[readonly unknown[], unknown]> = []) {
  return [
    [dossierClaimStateKey(dossierId), initialClaim] as [readonly unknown[], unknown],
    [dossierReviewProgressKey(dossierId), emptyProgress] as [readonly unknown[], unknown],
    ...queryData,
  ];
}

test("claim action refreshes ownership from the server and does not submit a client revision", async () => {
  const originalFetch = globalThis.fetch;
  const patchBodies: unknown[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (method === "PATCH" && url.endsWith("/assign")) patchBodies.push(JSON.parse(String(init?.body)));
    return responseFor(url, method, { claim: claimResponse() });
  }) as typeof fetch;

  try {
    const { user, queryClient } = renderPanel(panel(), {
      locale: "en",
      queryData: seedQueries([[["admin", "questionnaires", "list", "submissions"], { items: [] }]]),
    });
    await user.click(screen.getByRole("button", { name: "Claim for me" }));
    await screen.findByText("Claim state updated. The dossier is refreshing.");
    await screen.findByText("Agent One");
    assert.deepEqual(patchBodies, [{ assigneeId: userId }]);
    assert.equal(queryClient.getQueryState(["admin", "questionnaires", "list", "submissions"])?.isInvalidated, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("release action sends null and refreshes the effective owner from the server", async () => {
  const originalFetch = globalThis.fetch;
  const patchBodies: unknown[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/assign") && init?.method === "PATCH") {
      patchBodies.push(JSON.parse(String(init.body)));
      return jsonResponse({ id: dossierId, assigneeId: null, assigneeName: null, expiresAt: null, lastActivityAt: null });
    }
    if (url.endsWith("/claim-state")) return jsonResponse({ ...initialClaim, assigneeId: null });
    return responseFor(url, init?.method ?? "GET", { claim: claimResponse() });
  }) as typeof fetch;

  try {
    const { user } = renderPanel(panel(), {
      locale: "en",
      queryData: seedQueries([[dossierClaimStateKey(dossierId), claimResponse()]]),
    });
    await user.click(screen.getByRole("button", { name: "Release claim" }));
    await screen.findByText("Claim state updated. The dossier is refreshing.");
    await screen.findByText("No active reviewer");
    assert.deepEqual(patchBodies, [{ assigneeId: null }]);
    assert.ok(screen.getByRole("button", { name: "Claim for me" }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a revision-bound progress note submits the exact loaded revision and preserves the returned revision", async () => {
  const originalFetch = globalThis.fetch;
  const requestBodies: unknown[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/review-progress") && init?.method === "POST") {
      requestBodies.push(JSON.parse(String(init.body)));
      return jsonResponse({
        submissionId: dossierId,
        assigneeId: userId,
        note: "Reviewed the financial evidence.",
        actorId: userId,
        lastActivityAt: "2026-10-30T11:00:00.000Z",
        expiresAt: "2026-10-30T23:00:00.000Z",
        updatedAt: "2026-10-30T11:00:00.000Z",
        revision: 8,
      });
    }
    return responseFor(url, init?.method ?? "GET", {
      claim: claimResponse(),
      progress: { submissionId: dossierId, items: [{ id: "progress-1", actorId: userId, createdAt: "2026-10-30T11:00:00.000Z", progressType: "NOTE", note: "Reviewed the financial evidence.", anomalyId: null }] },
    });
  }) as typeof fetch;

  try {
    const { user, queryClient } = renderPanel(panel(7), {
      locale: "en",
      queryData: seedQueries([
        [["admin", "dossier", dossierId, false], { id: dossierId, revision: 7 }],
        [dossierClaimStateKey(dossierId), claimResponse()],
      ]),
    });
    await user.type(screen.getByLabelText("Review progress note (10–2000 characters)"), "Reviewed the financial evidence.");
    await user.click(screen.getByRole("button", { name: "Save progress" }));
    await screen.findByText("Progress saved. The dossier revision and claim state are refreshing.");
    await waitFor(() => assert.equal(queryClient.getQueryData<{ revision: number }>(["admin", "dossier", dossierId, false])?.revision, 8));
    assert.deepEqual(requestBodies, [{ note: "Reviewed the financial evidence.", expectedRevision: 7 }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a stale progress conflict refreshes server data, informs the reviewer, and never retries the mutation", async () => {
  const originalFetch = globalThis.fetch;
  let mutationCount = 0;
  let claimRefreshCount = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/review-progress") && init?.method === "POST") {
      mutationCount += 1;
      return jsonResponse({ statusCode: 409, message: "Dossier modified" }, 409);
    }
    if (url.endsWith("/claim-state")) {
      claimRefreshCount += 1;
      return jsonResponse(claimResponse());
    }
    return responseFor(url, init?.method ?? "GET", { claim: claimResponse() });
  }) as typeof fetch;

  try {
    const { user } = renderPanel(panel(7), {
      locale: "en",
      queryData: seedQueries([[dossierClaimStateKey(dossierId), claimResponse()]]),
    });
    await user.type(screen.getByLabelText("Review progress note (10–2000 characters)"), "Reviewed the financial evidence.");
    await user.click(screen.getByRole("button", { name: "Save progress" }));
    await screen.findByText("The dossier changed. Your note was not saved; the latest data is loading. Review it before submitting again.");
    await waitFor(() => assert.ok(claimRefreshCount > 0));
    assert.equal(mutationCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("effective ownership controls available actions when server state changes", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => responseFor(String(input), init?.method ?? "GET")) as typeof fetch;
  try {
    const { queryClient } = renderPanel(panel(), {
      locale: "en",
      queryData: seedQueries([[dossierClaimStateKey(dossierId), claimResponse()]]),
    });
    assert.ok(screen.getByRole("button", { name: "Release claim" }));
    queryClient.setQueryData(dossierClaimStateKey(dossierId), claimResponse({ assigneeId: "agent-2", assigneeName: "Agent Two" }));
    await screen.findByText("Agent Two");
    assert.equal(screen.queryByRole("button", { name: "Release claim" }), null);
    assert.equal(screen.queryByRole("button", { name: "Claim for me" }), null);
    assert.equal(screen.queryByRole("button", { name: "Save progress" }), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("expired or non-claimable server states do not offer review actions", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => responseFor(String(input), init?.method ?? "GET")) as typeof fetch;
  try {
    renderPanel(panel(), {
      locale: "en",
      queryData: seedQueries([[dossierClaimStateKey(dossierId), claimResponse({ assigneeId: null, assigneeName: null, expired: true })]]),
    });
    assert.ok(await screen.findByText("The previous claim expired after inactivity. This dossier can be claimed again."));
    assert.ok(screen.getByRole("button", { name: "Claim for me" }));
    assert.equal(screen.queryByRole("button", { name: "Save progress" }), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("duplicate claim submission is prevented while the request is pending", async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  let resolveRequest: ((response: Response) => void) | undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/assign") && init?.method === "PATCH") {
      requestCount += 1;
      return new Promise<Response>((resolve) => { resolveRequest = resolve; });
    }
    return responseFor(url, init?.method ?? "GET", { claim: claimResponse() });
  }) as typeof fetch;

  try {
    const { user } = renderPanel(panel(), { locale: "en", queryData: seedQueries() });
    const button = screen.getByRole("button", { name: "Claim for me" });
    await user.click(button);
    await screen.findByRole("button", { name: "Saving…" });
    assert.equal((screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement).disabled, true);
    await user.click(screen.getByRole("button", { name: "Saving…" }));
    assert.equal(requestCount, 1);
    resolveRequest?.(jsonResponse({ id: dossierId, assigneeId: userId, assigneeName: "Agent One" }));
    await screen.findByText("Claim state updated. The dossier is refreshing.");
    await screen.findByText("Agent One");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

