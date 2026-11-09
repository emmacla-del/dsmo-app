import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";

import { applyRegistrationClaim } from "./user-directory";

const key = ["auth", "company-registration", "r1"];
const claim = { assigneeId: "agent-1", assigneeName: "Agent Un" };

test("a claim shows on a review page already in the cache", () => {
  const client = new QueryClient();
  client.setQueryData(key, { id: "r1", organisation: "Test", assigneeId: null, assigneeName: null });

  applyRegistrationClaim(client, "r1", claim);

  assert.deepEqual(client.getQueryData(key), { id: "r1", organisation: "Test", ...claim });
  assert.equal(client.getQueryState(key)?.isInvalidated, true);
});

test("releasing a file clears the assignee", () => {
  const client = new QueryClient();
  client.setQueryData(key, { id: "r1", ...claim });

  applyRegistrationClaim(client, "r1", { assigneeId: null, assigneeName: null });

  assert.deepEqual(client.getQueryData(key), { id: "r1", assigneeId: null, assigneeName: null });
});

test("a file not yet opened gets no invented cache entry", () => {
  const client = new QueryClient();

  applyRegistrationClaim(client, "r1", claim);

  assert.equal(client.getQueryData(key), undefined);
});
