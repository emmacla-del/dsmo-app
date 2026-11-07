import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";

import { decidedOrganisation } from "./user-directory";

test("the decision notice names the file from the review page's cache", () => {
  const client = new QueryClient();
  client.setQueryData(["auth", "company-registration", "r1"], { id: "r1", organisation: "Test" });

  assert.equal(decidedOrganisation(client, "r1"), "Test");
});

test("without a cached file the notice stays unnamed", () => {
  const client = new QueryClient();

  assert.equal(decidedOrganisation(client, "r1"), null);
  assert.equal(decidedOrganisation(client, null), null);
});
