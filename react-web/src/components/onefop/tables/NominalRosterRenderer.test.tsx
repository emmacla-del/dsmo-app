import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { NominalRosterRenderer } from "./NominalRosterRenderer";
import { buildVt88TrainerRosterDefinition } from "./StatisticalTableDefinition";
import { schemaField } from "@/test/schema";
import type { FormData } from "@/lib/onefop-schema";

// 8.8's Guided half: the list of trainers already saved. What it says about
// each one is coded (sex, status), so it has to read in the locale on screen.
const definition = buildVt88TrainerRosterDefinition(schemaField("vocationalTraining", "VT8_8"));

function trainer(slotIndex: number, values: Record<string, unknown>): FormData {
  const { cellKeys } = definition.slots[slotIndex];
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [cellKeys[key], value]));
}

function render(data: FormData, locale: "fr" | "en") {
  return renderWithProviders(
    <NominalRosterRenderer definition={definition} data={data} onChange={() => {}} />,
    { locale },
  );
}

const NDI = { lastName: "Ndi", firstName: "Paul", sex: "1", trainerStatus: "3" };

test("a saved trainer's line reads in French", () => {
  render(trainer(0, NDI), "fr");

  assert.ok(screen.getByText("Homme · Permanent"));
});

test("a saved trainer's line reads in English, not French", () => {
  render(trainer(0, NDI), "en");

  assert.ok(screen.getByText("Man · Permanent"));
  assert.equal(screen.queryByText(/Homme/), null);
});

test("the line names the administrative staff answer when it is yes", () => {
  render(trainer(0, { ...NDI, isAdminPersonnel: true }), "en");

  assert.ok(screen.getByText("Man · Permanent · Administrative staff"));
});

test("one trainer is a trainer, two are trainers", () => {
  const { unmount } = render(trainer(0, NDI), "en");
  assert.ok(screen.getByText("1 trainer of 14."));
  unmount();

  render({ ...trainer(0, NDI), ...trainer(1, { lastName: "Abena", sex: "2" }) }, "en");
  assert.ok(screen.getByText("2 trainers of 14."));
});

test("one trainer counts in French too", () => {
  render(trainer(0, NDI), "fr");

  assert.ok(screen.getByText("1 formateur sur 14."));
});

// The add/edit form asks the paper's questions in the paper's own order, and
// keeps the band it prints over the two qualifications (p.19, "Si formateur/
// If teacher") — they are a trainer's to answer, not an administrator's.
function withForm(locale: "fr" | "en", check: () => void) {
  const { unmount } = render({}, locale);
  try {
    check();
  } finally {
    unmount();
  }
}

const asked = () =>
  Array.from(document.querySelectorAll(".cam-question")).map((el) => el.textContent!.trim());

test("the questions follow the paper's order, the qualifications last", () => {
  withForm("fr", () => {
    const expected = [
      "Nom",
      "Prénom",
      "Sexe",
      "Statut",
      "Personnel administratif",
      "Diplôme académique",
      "Diplôme professionnel",
    ];
    const shown = asked();
    assert.equal(shown.length, expected.length);
    expected.forEach((label, i) => assert.ok(shown[i].startsWith(label), `${i}: ${shown[i]}`));
  });
});

test("the two qualifications are grouped under the band, in the locale on screen", () => {
  withForm("en", () => {
    const band = screen.getByText("If teacher");
    assert.equal(band.tagName, "LEGEND");
    assert.deepEqual(
      Array.from(band.closest("fieldset")!.querySelectorAll(".cam-question")).map((el) => el.textContent!.trim()),
      ["Academic diploma", "Vocational diploma"],
    );
  });
});

// Saving a row: the form owes the same answers validation owes for a row
// begun (the name, the first name, the sex), so it can no longer save a row
// that Suivant will stop.
test("Save refuses a row that still owes a required answer, and names them", async () => {
  const writes: Array<[string, unknown]> = [];
  const { user, unmount } = renderWithProviders(
    <NominalRosterRenderer definition={definition} data={{}} onChange={(key, value) => writes.push([key, value])} />,
    { locale: "fr" },
  );
  try {
    await user.type(screen.getByLabelText("Nom"), "Ndi");
    await user.click(screen.getByRole("button", { name: "Enregistrer le formateur" }));

    assert.deepEqual(writes, [], "nothing was written");
    // Said under each of them, and announced once.
    assert.deepEqual(
      Array.from(document.querySelectorAll(".cam-roster-error")).map((el) => el.textContent),
      ["Veuillez renseigner le Prénom.", "Veuillez renseigner le Sexe."],
    );
    assert.equal(
      document.querySelector('[role="status"]')!.textContent,
      "Veuillez renseigner le Prénom.",
    );
  } finally {
    unmount();
  }
});

test("no answer of 8.8 calls itself optional any more", () => {
  withForm("fr", () => {
    assert.equal(document.querySelector(".cam-roster-optional"), null);
  });
});
