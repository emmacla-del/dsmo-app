import { renderWithProviders } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { PasswordRequirementHint } from "./PasswordRequirementHint";

function hintText(password: string): string {
  const { container } = renderWithProviders(<PasswordRequirementHint id="pw-rules" password={password} />);
  const region = container.querySelector("#pw-rules");
  assert.ok(region, "the described-by target is always there");
  return region.textContent ?? "";
}

test("nothing is said before anything is typed", () => {
  assert.equal(hintText(""), "");
});

test("a short password is asked for 8 characters, even when it is otherwise strong", () => {
  assert.equal(hintText("Ab1!"), "Utilisez au moins 8 caractères.");
});

test("8 lowercase letters are asked for a capital, a digit or a symbol", () => {
  assert.match(hintText("abcdefgh"), /^Ajoutez une majuscule, un chiffre ou un symbole/);
});

test("an acceptable password gets no hint: Abcdefgh (one of the three is enough)", () => {
  assert.equal(hintText("Abcdefgh"), "");
});

test("an acceptable password gets no hint: abcdefg1 (one of the three is enough)", () => {
  assert.equal(hintText("abcdefg1"), "");
});

test("an acceptable password gets no hint: abcdefg! (one of the three is enough)", () => {
  assert.equal(hintText("abcdefg!"), "");
});
