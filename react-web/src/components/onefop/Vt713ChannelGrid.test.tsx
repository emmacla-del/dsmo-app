import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { useState } from "react";
import { Vt713ChannelGrid } from "./Vt713ChannelGrid";
import { schemaField } from "@/test/schema";
import type { FormData } from "@/lib/onefop-schema";

const STAKEHOLDERS = ["VT7_7", "VT7_8", "VT7_9", "VT7_10", "VT7_11"].map((id) => schemaField("vocationalTraining", id));
const OTHERS = new Map(STAKEHOLDERS.map((s) => [s.id, schemaField("vocationalTraining", `${s.id}_OTHER`)]));

function renderGrid(initial: FormData = {}) {
  let latest: FormData = initial;
  function Harness() {
    const [data, setData] = useState<FormData>(initial);
    latest = data;
    return (
      <Vt713ChannelGrid
        stakeholders={STAKEHOLDERS}
        otherFields={OTHERS}
        data={data}
        onChange={(id, value) =>
          setData((d) => {
            const next = { ...d };
            if (value === undefined) delete next[id];
            else next[id] = value;
            return next;
          })
        }
        issueByFieldId={new Map()}
        sectionId="section7_vocationalTraining"
        compact={false}
      />
    );
  }
  const result = renderWithProviders(<Harness />);
  return { ...result, data: () => latest };
}

test("one row per channel and one column per stakeholder, every cell named for screen readers", () => {
  renderGrid();
  for (const name of ["Élèves", "Personnel Enseignant", "Parents/Tuteurs", "Conseil d'établissement"]) {
    assert.ok(screen.getByRole("columnheader", { name }));
  }
  assert.ok(screen.getByRole("rowheader", { name: "WhatsApp" }));
  assert.equal(screen.getAllByRole("checkbox").length, 9 * 5);
  assert.ok(screen.getByRole("checkbox", { name: "Élèves — WhatsApp" }));
});

test("ticks are stored as the stakeholder's codes, in list order; the last untick clears the answer", async () => {
  const { user, data } = renderGrid();
  await user.click(screen.getByRole("checkbox", { name: "Élèves — WhatsApp" }));
  await user.click(screen.getByRole("checkbox", { name: "Élèves — Lettre / correspondance officielle" }));
  assert.deepEqual(data().VT7_7, ["01", "06"]);
  assert.equal(data().VT7_8, undefined, "another stakeholder is untouched");

  await user.click(screen.getByRole("checkbox", { name: "Élèves — WhatsApp" }));
  await user.click(screen.getByRole("checkbox", { name: "Élèves — Lettre / correspondance officielle" }));
  assert.equal("VT7_7" in data(), false);
});

test("« Autre » opens that stakeholder's précisez under the grid", async () => {
  const { user } = renderGrid();
  assert.equal(screen.queryByLabelText(/Autre canal, précisez — Parents/), null);
  await user.click(screen.getByRole("checkbox", { name: "Parents/Tuteurs — Autre (préciser)" }));
  assert.ok(screen.getByLabelText(/Autre canal, précisez — Parents/));
  assert.equal(screen.queryByLabelText(/Autre canal, précisez — Élèves/), null);
});
