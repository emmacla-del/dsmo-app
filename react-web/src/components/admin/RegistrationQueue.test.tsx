import { renderWithProviders, screen, waitFor, within, navigationMock } from "@/test/render";
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { useAuthStore } from "@/lib/auth-store";
import { RegistrationQueue } from "./RegistrationQueue";

const ME = "agent-me";

function row(id: string, values: Record<string, unknown> = {}) {
  return {
    id,
    companyId: `c-${id}`,
    establishmentId: `EN26-${id}`,
    organisation: `Organisation ${id}`,
    entityType: "ENTREPRISE",
    region: "Littoral",
    department: "Wouri",
    subdivision: "Douala 1er",
    submittedAt: "2026-10-22T08:00:00.000Z",
    assigneeId: null,
    status: "PENDING_APPROVAL",
    ...values,
  };
}

function page(items: unknown[], total = items.length) {
  return { items, total, page: 1, pageSize: 20, counts: {}, countsView: "queue", overdueDays: 7 };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

interface Calls { lists: URLSearchParams[]; patches: Array<{ url: string; body: unknown }> }

/** Routes the queue's requests: the two one-row summaries, the list, the claim. */
function installFetch(handlers: {
  available?: () => Response;
  mine?: () => Response;
  others?: () => Response;
  list?: (params: URLSearchParams) => Response;
  claim?: () => Response;
} = {}): Calls {
  const calls: Calls = { lists: [], patches: [] };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://test.invalid");
    if (url.pathname.endsWith("/locations/structure")) {
      return json([{ name: "Littoral", departments: [{ name: "Wouri", subdivisions: [{ name: "Douala 1er" }] }] }, { name: "Centre", departments: [] }]);
    }
    if (init?.method === "PATCH") {
      calls.patches.push({ url: url.pathname, body: JSON.parse(String(init.body)) });
      return handlers.claim?.() ?? json({ id: "r1", companyId: "c-r1", assigneeId: ME, assigneeName: "Me" });
    }
    if (url.pathname.endsWith("/auth/company-registrations")) {
      const params = url.searchParams;
      if (params.get("pageSize") === "1") {
        if (params.get("assignedToOthers") === "true") return handlers.others?.() ?? json(page([row("o1", { assigneeId: "colleague" })], 4));
        return params.get("unassigned") === "true"
          ? handlers.available?.() ?? json(page([row("old", { submittedAt: "2026-10-22T08:00:00.000Z" })], 3))
          : handlers.mine?.() ?? json(page([row("m1", { assigneeId: ME })], 1));
      }
      calls.lists.push(params);
      return handlers.list?.(params) ?? json(page([row("r1"), row("r2", { submittedAt: null })]));
    }
    return json({});
  }) as typeof fetch;
  return calls;
}

const originalFetch = globalThis.fetch;
beforeEach(() => {
  useAuthStore.setState({ status: "authenticated", user: { id: ME, role: "ADMIN_ONEFOP", region: null, department: null } as never });
  window.history.replaceState(null, "", "/admin/inscriptions");
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function renderQueue(query = "") {
  const rendered = renderWithProviders(<RegistrationQueue />, { locale: "en", queryClient: undefined });
  navigationMock.searchParams = new URLSearchParams(query);
  rendered.rerender(<RegistrationQueue />);
  return rendered;
}

test("lists pending, unclaimed registrations in five columns with the summary", async () => {
  const calls = installFetch();
  renderQueue();

  await screen.findByText("Organisation r1");
  assert.ok(screen.getByRole("heading", { level: 1, name: /^Registration applications \(Review applications and consult registrations/ }));
  const headers = screen.getAllByRole("columnheader").map((cell) => cell.textContent?.split(".")[0].trim());
  assert.deepEqual(headers, ["Organisation", "Territory", "Waiting time", "Assigned to", "Action"]);

  const available = screen.getByRole("button", { name: /Available to claim/ });
  const mine = screen.getByRole("button", { name: /Claimed by me/ });
  assert.equal(available.getAttribute("aria-pressed"), "true");
  assert.equal(mine.getAttribute("aria-pressed"), "false");
  assert.match(available.textContent ?? "", /3/);
  assert.match(mine.textContent ?? "", /1/);
  assert.ok(screen.getByText("Oldest awaiting review"));
  assert.ok(screen.getByRole("option", { name: "All registrations" }));
  assert.equal(screen.queryByRole("button", { name: /Oldest awaiting review/ }), null);

  const list = calls.lists.at(-1)!;
  assert.equal(list.get("status"), "PENDING_APPROVAL");
  assert.equal(list.get("unassigned"), "true");
  assert.equal(list.get("assignedToMe"), null);
  assert.equal(list.get("sortOrder"), "oldest");

  // No status column, no « Pending » badge, no submitted-at column.
  assert.equal(screen.queryByText("Pending"), null);
  assert.equal(screen.queryByText(/Submitted/), null);
  // A missing receipt time says so; the territory is region · division for national staff.
  assert.ok(screen.getByText("Unavailable"));
  assert.ok(screen.getAllByText("Littoral · Wouri").length >= 1);
  assert.equal(screen.getAllByRole("button", { name: /^Claim and open Organisation/ }).length, 2);
  assert.ok(screen.getByText("2 registrations"));
});

test("selecting « Claimed by me » writes the ownership view to the address", async () => {
  installFetch();
  const { user } = renderQueue("search=acme&sort=newest");
  await screen.findByText("Organisation r1");
  await user.click(screen.getByRole("button", { name: /Claimed by me/ }));
  assert.equal(window.location.search, "?vue=queue&owner=mine&search=acme&sort=newest");
});

test("rejected applications are a status filter of the same registrations page", async () => {
  const calls = installFetch({
    list: () => json(page([row("rejected", {
      establishmentId: null,
      registrationNumber: "INS-42",
      status: "REJECTED",
      rejectedAt: "2026-11-08T10:00:00.000Z",
      rejectedByName: "Awa Ndi",
      rejectionReason: "Duplicate application",
      archivedAt: null,
    })])),
  });
  renderQueue("status=REJECTED");
  await screen.findByText("Organisation rejected");

  const list = calls.lists.at(-1)!;
  assert.equal(list.get("status"), "REJECTED");
  assert.equal(list.get("view"), "organisations");
  assert.equal(list.get("unassigned"), null);
  assert.deepEqual(screen.getAllByRole("columnheader").map((cell) => cell.textContent?.trim()), [
    "Organisation", "Registration status", "Territory", "Decision", "Action",
  ]);
  const rejectedRow = screen.getByText("Organisation rejected").closest("tr")!;
  assert.ok(within(rejectedRow).getByText("Rejected"));
  assert.ok(within(rejectedRow).getByText("Duplicate application"));
  assert.ok(within(rejectedRow).getByText("Awa Ndi"));
  assert.equal(screen.queryByRole("button", { name: /Claim and open/ }), null);
  assert.ok(screen.getByRole("checkbox", { name: "Include archived records" }));
});

test("the « Claimed by me » view asks for the officer's files and offers Open review", async () => {
  const calls = installFetch({ list: () => json(page([row("m1", { assigneeId: ME })])) });
  renderQueue("owner=mine");
  await screen.findByText("Organisation m1");
  assert.equal(calls.lists.at(-1)!.get("assignedToMe"), "true");
  assert.equal(calls.lists.at(-1)!.get("unassigned"), null);
  assert.equal(screen.getByRole("button", { name: /Claimed by me/ }).getAttribute("aria-pressed"), "true");
  const tableRow = screen.getByText("Organisation m1").closest("tr")!;
  assert.ok(within(tableRow).getByText("You"));
  assert.ok(within(tableRow).getByRole("button", { name: "Open the review of Organisation m1" }));
});

test("claim and open claims on the server, once, before opening the review", async () => {
  let release: (response: Response) => void = () => {};
  const calls = installFetch({ claim: () => new Promise<Response>((resolve) => { release = resolve; }) as unknown as Response });
  const { user } = renderQueue();
  await screen.findByText("Organisation r1");

  const claim = screen.getByRole("button", { name: "Claim and open Organisation r1" });
  await user.click(claim);
  await waitFor(() => assert.equal(calls.patches.length, 1));
  // Pending: every claim button is disabled and nothing has navigated.
  for (const button of screen.getAllByRole("button", { name: /^Claim and open Organisation/ })) assert.equal((button as HTMLButtonElement).disabled, true);
  assert.deepEqual(navigationMock.pushed, []);

  release(json({ id: "r1", companyId: "c-r1", assigneeId: ME, assigneeName: "Me" }));
  await waitFor(() => assert.equal(navigationMock.pushed.length, 1));
  assert.equal(calls.patches.length, 1);
  assert.ok(calls.patches[0].url.endsWith("/auth/users/r1/assign"));
  assert.deepEqual(calls.patches[0].body, { assigneeId: ME, expectedAssigneeId: null });
  assert.match(navigationMock.pushed[0], /^\/admin\/inscriptions\/r1\?returnTo=%2Fadmin%2Finscriptions%3Fvue%3Dqueue/);
});

test("a claim taken by another officer says so, stays on the queue and refreshes it", async () => {
  const calls = installFetch({ claim: () => json({ message: "Conflict" }, 409) });
  const { user } = renderQueue();
  await screen.findByText("Organisation r1");
  const listsBefore = calls.lists.length;

  await user.click(screen.getByRole("button", { name: "Claim and open Organisation r1" }));
  await screen.findByText("This registration has just been claimed by another officer. The queue has been updated.");
  assert.deepEqual(navigationMock.pushed, []);
  await waitFor(() => assert.ok(calls.lists.length > listsBefore));
  assert.equal((screen.getByRole("button", { name: "Claim and open Organisation r1" }) as HTMLButtonElement).disabled, false);
});

test("« Claimed by colleagues » names who holds each file, its time left, and opens it without claiming", async () => {
  const soon = new Date(Date.now() + 20 * 60_000).toISOString();
  const later = new Date(Date.now() + 90 * 60_000).toISOString();
  const calls = installFetch({
    list: () => json(page([
      row("c1", { assigneeId: "colleague", assigneeName: "Awa Ndiaye", claimExpiresAt: soon }),
      row("c2", { assigneeId: "colleague-2", assigneeName: "Paul Biya", claimExpiresAt: later }),
    ])),
  });
  const { user } = renderQueue("owner=others");
  await screen.findByText("Organisation c1");
  assert.equal(calls.lists.at(-1)!.get("assignedToOthers"), "true");
  assert.equal(screen.getByRole("button", { name: /Claimed by colleagues/ }).getAttribute("aria-pressed"), "true");
  assert.match(screen.getByRole("button", { name: /Claimed by colleagues/ }).textContent ?? "", /4/);

  const first = screen.getByText("Organisation c1").closest("tr")!;
  assert.ok(within(first).getByText("Awa Ndiaye"));
  const urgent = within(first).getByText(/^Expires in \d+ mins?$/);
  assert.ok(urgent.classList.contains("is-urgent"));
  const second = screen.getByText("Organisation c2").closest("tr")!;
  assert.equal(within(second).getByText(/^Expires in 1 hr/).classList.contains("is-urgent"), false);

  // No claim from this view: Open goes to the review page, where takeover is confirmed.
  assert.equal(screen.queryByRole("button", { name: /^Claim and open/ }), null);
  await user.click(within(first).getByRole("button", { name: "Open the review of Organisation c1, handled by Awa Ndiaye" }));
  assert.equal(calls.patches.length, 0);
  assert.match(navigationMock.pushed[0], /^\/admin\/inscriptions\/c1\?returnTo=/);
});

test("a failed list is an error with Retry, never an empty queue", async () => {
  installFetch({ list: () => json({ message: "Down" }, 500) });
  renderQueue();
  await screen.findByText(/The registrations could not be loaded./);
  assert.ok(screen.getByRole("button", { name: /Retry|Réessayer/ }));
  assert.equal(screen.queryByText(/No registrations are waiting/), null);
});

test("a failed summary says the figures are unavailable instead of showing zeros", async () => {
  installFetch({ available: () => json({ message: "Down" }, 500) });
  renderQueue();
  await screen.findByText("The queue summary could not be loaded.");
  assert.equal(screen.queryByRole("button", { name: /Available to claim/ }), null);
});

test("an empty queue and a filtered list with no match read differently", async () => {
  installFetch({ list: () => json(page([])) });
  const first = renderQueue();
  await screen.findByText("No registrations are waiting to be claimed in this territory.");
  assert.equal(screen.queryByRole("button", { name: "Clear filters" }), null);
  first.unmount();

  installFetch({ list: () => json(page([])) });
  renderQueue("type=ONG");
  await screen.findByText("No registrations match these filters.");
  assert.ok(screen.getAllByRole("button", { name: "Clear filters" }).length >= 1);
});
