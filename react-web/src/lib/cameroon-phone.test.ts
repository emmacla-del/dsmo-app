import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidCameroonPhone, normalizeCameroonPhone } from "./cameroon-phone";

test("nine digits starting with 6 or 2 are valid", () => {
  assert.equal(isValidCameroonPhone("677123456"), true);
  assert.equal(isValidCameroonPhone("222123456"), true);
});

test("too short, wrong prefix or letters are refused", () => {
  assert.equal(isValidCameroonPhone("45675456"), false); // the stored test value
  assert.equal(isValidCameroonPhone("12345"), false);
  assert.equal(isValidCameroonPhone("377123456"), false);
  assert.equal(isValidCameroonPhone("6771234ab"), false);
  assert.equal(isValidCameroonPhone(""), false);
});

test("spacing and the country prefix are tolerated and removed", () => {
  assert.equal(normalizeCameroonPhone("6 77 12 34 56"), "677123456");
  assert.equal(normalizeCameroonPhone("+237 677 12 34 56"), "677123456");
  assert.equal(normalizeCameroonPhone("00237677123456"), "677123456");
  assert.equal(normalizeCameroonPhone("237677123456"), "677123456");
  assert.equal(isValidCameroonPhone("6.77-12-34-56"), true);
});
