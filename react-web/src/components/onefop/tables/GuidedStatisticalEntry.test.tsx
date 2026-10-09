import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { useState } from "react";
import { GuidedStatisticalEntry } from "./GuidedStatisticalEntry";
import { getModernJobsTableDefinition } from "./definitions/modernJobsTableDefinitions";
import { schemaField } from "@/test/schema";
import type { FormData } from "@/lib/onefop-schema";

// S4Q01 (interns by internship type x sex) from the real schema: each guided
// question asks a total, then the number of women, the men being deduced.
const field = schemaField("enterprise", "S4Q01");

const WHOLE_NUMBER = "Saisissez un nombre entier (ex. 12)";

/** Renders the guided entry over a live data object, recording every commit. */
function renderGuided(initial: FormData = {}) {
  const commits: Array<Record<string, unknown>> = [];
  function Harness() {
    const [data, setData] = useState<FormData>(initial);
    const definition = getModernJobsTableDefinition(field, data);
    assert.ok(definition, "S4Q01 has an adaptive definition");
    return (
      <GuidedStatisticalEntry
        definition={definition}
        data={data}
        onChange={(key, value) => {
          commits.push({ [key]: value });
          setData((d) => ({ ...d, [key]: value }));
        }}
        onBatchChange={(updates) => {
          commits.push(updates);
          setData((d) => ({ ...d, ...updates }));
        }}
      />
    );
  }
  const result = renderWithProviders(<Harness />);
  return { ...result, commits };
}

const totalInput = () => screen.getByRole("textbox", { name: "Nombre total" }) as HTMLInputElement;

/** Every value the entry has stored, merged in commit order. */
const stored = (commits: Array<Record<string, unknown>>) =>
  Object.assign({}, ...commits) as Record<string, unknown>;

for (const refused of ["2.5", "-3", "12abc"]) {
  test(`a total of "${refused}" is kept as typed, flagged, and never stored as a number`, async () => {
    const { user, commits } = renderGuided();
    const input = totalInput();

    await user.click(input);
    await user.paste(refused);

    const alert = screen.getByRole("alert");
    assert.equal(alert.textContent, WHOLE_NUMBER);
    assert.equal(input.value, refused, "what was typed stays on screen");
    assert.equal(input.getAttribute("aria-invalid"), "true");
    assert.equal(input.getAttribute("aria-describedby"), alert.id, "the message describes the field");
    assert.ok(
      Object.values(stored(commits)).every((v) => v === null),
      `only cleared cells, no number: ${JSON.stringify(stored(commits))}`,
    );
  });
}

// Typed key by key, "2.5" used to become 25: "2" was accepted, "." refused
// (the field fell back to "2"), then "5" was appended. The typed text now
// stays as typed and the question holds no answer until it is a count.
for (const [typed, notThis] of [["2.5", 25], ["-3", 3]] as const) {
  test(`typing "${typed}" key by key never ends as ${notThis}`, async () => {
    const { user, commits } = renderGuided();
    const input = totalInput();
    await user.type(input, typed);

    assert.equal(input.value, typed);
    assert.equal(screen.getByRole("alert").textContent, WHOLE_NUMBER);
    const values = Object.values(stored(commits));
    assert.ok(!values.includes(notThis), `${notThis} was never stored: ${JSON.stringify(stored(commits))}`);
    assert.ok(values.every((v) => v === null), "the question holds no answer while the text is not a count");
  });
}

test("after a refusal, a whole number is accepted and the message goes away", async () => {
  const { user } = renderGuided();
  const input = totalInput();
  await user.click(input);
  await user.paste("2.5");
  assert.ok(screen.getByRole("alert"));

  await user.clear(input);
  await user.type(input, "4");
  assert.equal(input.value, "4");
  assert.equal(screen.queryByRole("alert"), null);
  assert.equal(input.getAttribute("aria-invalid"), "false");
});

test("Aucun (0) commits an explicit zero for the total and both sexes, not a blank", async () => {
  const { user, commits } = renderGuided();
  await user.click(screen.getAllByRole("button", { name: "Aucun (0)" })[0]);

  assert.equal(commits.length, 1);
  const values = Object.values(commits[0]);
  assert.ok(values.length >= 2);
  assert.ok(values.every((v) => v === 0), `every committed cell is 0: ${JSON.stringify(commits[0])}`);
});

test("a number of women that is not a whole number is kept as typed and the men are not deduced from it", async () => {
  const { user, commits } = renderGuided();
  await user.type(totalInput(), "5");
  const women = screen.getByRole("textbox", { name: "Parmi eux, combien de femmes ?" }) as HTMLInputElement;

  await user.click(women);
  await user.paste("2.5");
  assert.equal(screen.getByRole("alert").textContent, WHOLE_NUMBER);
  assert.equal(women.value, "2.5");
  const afterRefusal = stored(commits);
  assert.ok(
    Object.values(afterRefusal).every((v) => v === null),
    `neither sex is stored from "2.5": ${JSON.stringify(afterRefusal)}`,
  );

  await user.clear(women);
  await user.type(women, "2");
  const last = commits.at(-1) ?? {};
  const committed = Object.entries(last).sort(([a], [b]) => a.localeCompare(b));
  assert.deepEqual(
    committed.map(([, v]) => v).sort(),
    [2, 3, 5],
    `women 2, men deduced 3, total 5: ${JSON.stringify(last)}`,
  );
});
