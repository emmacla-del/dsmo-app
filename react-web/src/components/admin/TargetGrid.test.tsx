import assert from "node:assert/strict";
import test from "node:test";
import { TargetGrid } from "./TargetGrid";
import { renderWithProviders, screen } from "@/test/render";
import { initDrafts, type NormalizedRegion, type RegionDraft } from "@/lib/pilotage-target-payload";

const region: NormalizedRegion = {
  regionId: "centre",
  name: "Centre",
  mode: "REGION",
  target: 25,
  departments: [
    { departmentId: "mfoundi", name: "Mfoundi", target: null },
    { departmentId: "mbam", name: "Mbam", target: null },
  ],
  byEntityType: {},
};

function renderGrid(onDraftChange: (draft: RegionDraft) => void, onToggle = () => {}) {
  return renderWithProviders(
    <TargetGrid
      regions={[region]}
      drafts={initDrafts([region])}
      onDraftChange={(_, draft) => onDraftChange(draft)}
      onClearRegion={() => {}}
      centralInput=""
      onCentralChange={() => {}}
      showCentral={false}
      canWrite
      expanded={new Set()}
      onToggle={onToggle}
    />,
  );
}

test("quota editor shows only rows for the selected method", () => {
  renderGrid(() => {});

  assert.equal((screen.getByRole("textbox", { name: "Quota régional Centre" }) as HTMLInputElement).value, "25");
  assert.equal(screen.queryByText("Mfoundi"), null);
  assert.match(screen.getByText(/Choisissez un seul mode de quota par région/).textContent ?? "", /Seul le mode choisi/);
});

test("changing a populated region quota requires confirmation and opens its department rows", async () => {
  const changes: RegionDraft[] = [];
  let toggles = 0;
  const { user } = renderGrid((draft) => changes.push(draft), () => { toggles += 1; });

  await user.click(screen.getByRole("radio", { name: "Par département" }));
  assert.equal(screen.getByRole("dialog").textContent?.includes("Centre"), true);
  assert.equal(changes.length, 0);

  await user.click(screen.getByRole("button", { name: "Garder le mode actuel" }));
  assert.equal(changes.length, 0);

  await user.click(screen.getByRole("radio", { name: "Par département" }));
  await user.click(screen.getByRole("button", { name: "Changer de mode" }));

  assert.equal(changes.at(-1)?.mode, "DEPARTMENT");
  assert.equal(toggles, 1);
});
