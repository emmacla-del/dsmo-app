import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./api-client";
import { formatSubmissionError, saveDraftToBackend, submitDeclaration } from "./onefop-submission";

function respondWith(status: number, body: unknown) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })) as typeof fetch;
}

// The server answers a retry of the same formId with its original success, so
// a 409 always means a different declaration already exists for the quarter.
test("a 409 from /onefop/submit reaches the caller as an error, never as a success", async () => {
  const original = globalThis.fetch;
  try {
    respondWith(409, {
      statusCode: 409,
      message: "Une déclaration est déjà en cours pour ce trimestre. / A declaration already exists for this quarter.",
    });
    await assert.rejects(
      submitDeclaration("enterprise", "QUARTERLY_2026_T3", {}, false, null, "form-1"),
      (err: unknown) => err instanceof ApiError && err.status === 409,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("a successful submission returns the server's own reference", async () => {
  const original = globalThis.fetch;
  try {
    respondWith(201, { success: true, submissionId: "srv-42", message: "Formulaire soumis avec succès" });
    const result = await submitDeclaration("enterprise", "QUARTERLY_2026_T3", {}, false, null, "form-1");
    assert.equal(result.submissionId, "srv-42");
  } finally {
    globalThis.fetch = original;
  }
});

// ── The draft save sent when the respondent closes the page (audit R2) ───

function recordRequest() {
  const calls: RequestInit[] = [];
  globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
    calls.push(init);
    return new Response(JSON.stringify({ ok: true }), { status: 201, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return calls;
}

test("a draft saved on leaving is sent keepalive, so closing the tab does not cancel it", async () => {
  const original = globalThis.fetch;
  try {
    const calls = recordRequest();
    await saveDraftToBackend("vocationalTraining", "QUARTERLY_2026_T4", { VT1_2: "Waltz" }, null, { keepalive: true });
    assert.equal(calls[0].keepalive, true);
  } finally {
    globalThis.fetch = original;
  }
});

test("an ordinary save is not keepalive", async () => {
  const original = globalThis.fetch;
  try {
    const calls = recordRequest();
    await saveDraftToBackend("vocationalTraining", "QUARTERLY_2026_T4", { VT1_2: "Waltz" }, null);
    assert.equal(calls[0].keepalive, false);
  } finally {
    globalThis.fetch = original;
  }
});

test("a draft too big for a keepalive body is sent as an ordinary request, not dropped", async () => {
  const original = globalThis.fetch;
  try {
    const calls = recordRequest();
    const big: Record<string, string> = {};
    for (let i = 0; i < 3000; i++) big[`cell_${i}`] = "0123456789012345678901234567890";
    await saveDraftToBackend("vocationalTraining", "QUARTERLY_2026_T4", big, null, { keepalive: true });
    assert.ok(String(calls[0].body).length > 60 * 1024, "the body is over the browser's cap");
    assert.equal(calls[0].keepalive, false, "sent anyway, without keepalive");
  } finally {
    globalThis.fetch = original;
  }
});

// ── The draft holds the working form, not the submission payload (audit C4) ─

test("a draft saved to the account carries no zeros the quiz derived", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const schema = JSON.parse(
    readFileSync(join(process.env.REACT_WEB_ROOT ?? process.cwd(), "public", "schemas", "onefop.schema.json"), "utf-8"),
  );
  const { DEFAULT_SCOPE } = await import("@/components/modern-jobs/scope/ScopeTypes");
  const scope = {
    ...DEFAULT_SCOPE,
    applications: true, application_csp: ["cadres"], application_age: ["15_24"],
    recruit: false, primo_seekers: false, primo_workers: false, departures: false,
    interns: false, skills_needs: false, training_needs: false,
  };
  const original = globalThis.fetch;
  try {
    const calls = recordRequest();
    await saveDraftToBackend("enterprise", "QUARTERLY_2026_T4", { _scopeConfig: scope, s21q01_cadres_male_15_24: 4 }, schema.entities.enterprise);
    const sent = JSON.parse(String(calls[0].body)).draftData as Record<string, unknown>;
    assert.deepEqual(sent._scopeConfig, scope, "the quiz answers are kept");
    assert.equal(sent.s21q01_cadres_male_15_24, 4, "a typed figure is kept");
    const zeros = Object.entries(sent).filter(([, v]) => v === 0).map(([k]) => k);
    assert.deepEqual(zeros, [], "the recruitment table the quiz closed was zero-filled into the draft");
    assert.equal(sent.S22Q01_RESPONSE_STATUS, undefined, "no status was invented that the form did not hold");
  } finally {
    globalThis.fetch = original;
  }
});

// ── A refused submission names its tables, never their keys (audit C5) ────

test("C5. refused cells are named by table and section, with no internal key", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const schema = JSON.parse(
    readFileSync(join(process.env.REACT_WEB_ROOT ?? process.cwd(), "public", "schemas", "onefop.schema.json"), "utf-8"),
  );
  const entity = schema.entities.enterprise;
  const { DEFAULT_SCOPE } = await import("@/components/modern-jobs/scope/ScopeTypes");
  const scope = {
    ...DEFAULT_SCOPE,
    applications: true, application_csp: ["execution"], application_age: ["25_34"],
    recruit: false, primo_seekers: false, primo_workers: false,
    departures: true, departure_reasons: ["demission"],
    interns: false, skills_needs: false, training_needs: false,
  };
  const data = { _scopeConfig: scope, _scopeCsp: ["execution"], _scopeAge: ["25_34"] };
  const refused = [
    "s21q01_workers_male_25_34",
    "s21q01_workers_female_25_34",
    "s3q01_cadres_dismissal_male", // a category the quiz did not keep: never on screen
    "zz_not_in_the_form",
  ];
  const error = new ApiError(400, "Le formulaire contient des tableaux … (4 cellule(s) : s21q01_workers_male_25_34, +3)", {
    statusCode: 400,
    missingMatrixCells: refused,
  });

  const detail = formatSubmissionError(error, "fr", { entity, data });
  assert.match(detail.summary, /n'a pas été transmise/);
  assert.equal(detail.targets?.length, 1, "the two S2.1 cells are one table");
  assert.equal(detail.targets?.[0].fieldId, "S21Q01");
  assert.equal(detail.items.length, 2);
  assert.match(detail.items[1], /^2 élément\(s\)/, "the two cells the respondent cannot reach are counted, not listed");
  assert.match(detail.items[1], /assistance ONEFOP/);
  for (const line of [detail.summary, ...detail.items]) {
    assert.doesNotMatch(line, /s21q01|s3q01|zz_/i, `a key reached the screen: ${line}`);
  }

  const en = formatSubmissionError(error, "en", { entity, data });
  assert.match(en.summary, /was not sent/);
  assert.match(en.items[1], /ONEFOP support/);
});

test("C5. without the form, refused cells are counted, still never listed by key", () => {
  const error = new ApiError(400, "…", { missingMatrixCells: ["s3q01_cadres_dismissal_male"] });
  const detail = formatSubmissionError(error, "fr");
  assert.deepEqual(detail.targets, []);
  assert.equal(detail.items.length, 1);
  assert.doesNotMatch(detail.items[0], /s3q01/);
});

test("C5. every form names a refused table, never its key", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const schema = JSON.parse(
    readFileSync(join(process.env.REACT_WEB_ROOT ?? process.cwd(), "public", "schemas", "onefop.schema.json"), "utf-8"),
  );
  for (const name of ["enterprise", "cooperative", "ctd", "ong", "administration", "projectProgram", "vocationalTraining"]) {
    const entity = schema.entities[name];
    const table = entity.sections
      .flatMap((s: { fields: { id: string; table?: { matrix?: string[][] } }[] }) => s.fields)
      .find((f: { table?: { matrix?: string[][] } }) => f.table?.matrix?.[0]?.[0]);
    assert.ok(table, `${name} has no table`);
    const key = table.table.matrix[0][0];
    const detail = formatSubmissionError(new ApiError(400, "…", { missingMatrixCells: [key] }), "fr", { entity });
    assert.equal(detail.targets?.[0]?.fieldId, table.id, `${name}: ${key} not located`);
    assert.doesNotMatch(detail.items.join(" "), new RegExp(key, "i"), `${name}: the key reached the screen`);
  }
});
