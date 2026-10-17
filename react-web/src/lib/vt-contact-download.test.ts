import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, downloadVtContactCsvBlob, downloadVtContactSavBlob, getVtContactManifest } from "./api-client";

// The VT contact file (1.15, 1.16, 2.1.12) left the anonymous dataset in v11;
// /admin/diffusion downloads it from its own restricted routes.
function capture(status = 200, body: BodyInit = "x", type = "application/octet-stream") {
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: unknown, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(body, { status, headers: { "Content-Type": type } });
  }) as unknown as typeof fetch;
  return calls;
}

test("the contact .sav and .csv come from the restricted vt-contact routes, with the filters", async () => {
  const original = globalThis.fetch;
  try {
    const calls = capture();
    await downloadVtContactSavBlob({ region: "Littoral" });
    await downloadVtContactCsvBlob({ region: "Littoral" });
    assert.match(calls[0].url, /\/data-management\/export\/vt-contact\/sav$/);
    assert.match(calls[1].url, /\/data-management\/export\/vt-contact\/csv$/);
    for (const c of calls) {
      assert.equal(c.init.method, "POST");
      assert.deepEqual(JSON.parse(String(c.init.body)), { region: "Littoral" });
    }
  } finally {
    globalThis.fetch = original;
  }
});

test("the contact .sps is asked for under the CSV's saved name", async () => {
  const original = globalThis.fetch;
  try {
    const calls = capture(200, JSON.stringify({ sps: "GET DATA.", contactVersion: 1 }), "application/json");
    const manifest = await getVtContactManifest("onefop_coordonnees_x.csv");
    assert.match(calls[0].url, /\/data-management\/export\/vt-contact\/manifest$/);
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { csvFilename: "onefop_coordonnees_x.csv" });
    assert.equal(manifest.sps, "GET DATA.");
  } finally {
    globalThis.fetch = original;
  }
});

test("a download the server cannot record (503) reaches the page with the server's message", async () => {
  const original = globalThis.fetch;
  try {
    capture(503, JSON.stringify({ message: "Le téléchargement n'a pas pu être enregistré ; réessayez dans un instant." }), "application/json");
    await assert.rejects(downloadVtContactSavBlob({}), (e: unknown) =>
      e instanceof ApiError && e.status === 503 && e.message.includes("n'a pas pu être enregistré"));
  } finally {
    globalThis.fetch = original;
  }
});
