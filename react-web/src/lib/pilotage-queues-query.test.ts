import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import { PILOTAGE_QUEUES_KEY, pilotageQueuesOptions } from "./pilotage-queues-query";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function countRequests(): string[] {
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ countsView: "queue" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return urls;
}

test("screens opening together share one request", async () => {
  const urls = countRequests();
  const client = new QueryClient();
  await Promise.all([client.fetchQuery(pilotageQueuesOptions()), client.fetchQuery(pilotageQueuesOptions("queue", true))]);
  assert.equal(urls.length, 1);
  assert.match(urls[0], /\/pilotage\/queues\?view=queue$/);
});

test("the completed tab keeps its own figures, per archive choice", async () => {
  const urls = countRequests();
  const client = new QueryClient();
  await client.fetchQuery(pilotageQueuesOptions("completed", false));
  await client.fetchQuery(pilotageQueuesOptions("completed", true));
  assert.deepEqual(urls.map((url) => url.split("?")[1]), ["view=completed&includeArchived=false", "view=completed&includeArchived=true"]);
});

test("every queue key sits under the prefix decisions invalidate", () => {
  for (const options of [pilotageQueuesOptions(), pilotageQueuesOptions("completed", true)]) {
    assert.deepEqual(options.queryKey.slice(0, PILOTAGE_QUEUES_KEY.length), [...PILOTAGE_QUEUES_KEY]);
  }
});
