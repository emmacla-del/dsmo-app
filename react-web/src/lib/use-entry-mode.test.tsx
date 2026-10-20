import { act, renderHook } from "@/test/render";
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ENTRY_MODE_STORAGE_KEY, useEntryMode, useIsPhoneViewport } from "./use-entry-mode";

const realMatchMedia = window.matchMedia;
afterEach(() => {
  localStorage.clear();
  window.matchMedia = realMatchMedia;
});

function phoneViewport() {
  window.matchMedia = ((query: string) =>
    ({ ...realMatchMedia(query), matches: query.includes("max-width: 767px") })) as typeof window.matchMedia;
}

test("first visit: Tableau on a wide screen", () => {
  const { result } = renderHook(() => useEntryMode());
  assert.equal(result.current[0], "grid");
});

test("a phone is Guidé", () => {
  phoneViewport();
  const { result } = renderHook(() => useEntryMode());
  assert.equal(result.current[0], "guided");
  assert.equal(renderHook(() => useIsPhoneViewport()).result.current, true, "and says so, so the switch is not offered");
});

// A phone has one mode, not a default one: a grid of cells is not a form a
// thumb can fill, whatever this browser last chose on a bigger screen.
test("a remembered Tableau is ignored on a phone, and kept for a wider screen", () => {
  phoneViewport();
  localStorage.setItem(ENTRY_MODE_STORAGE_KEY, "grid");
  const { result } = renderHook(() => useEntryMode());
  assert.equal(result.current[0], "guided");
  assert.equal(localStorage.getItem(ENTRY_MODE_STORAGE_KEY), "grid", "the choice is left alone");
});

test("a remembered choice wins over the default on a wider screen", () => {
  localStorage.setItem(ENTRY_MODE_STORAGE_KEY, "guided");
  const { result } = renderHook(() => useEntryMode());
  assert.equal(result.current[0], "guided");
  assert.equal(renderHook(() => useIsPhoneViewport()).result.current, false);
});

test("switching is remembered and every table on the page follows it", () => {
  const first = renderHook(() => useEntryMode());
  const second = renderHook(() => useEntryMode());

  act(() => first.result.current[1]("guided"));

  assert.equal(localStorage.getItem(ENTRY_MODE_STORAGE_KEY), "guided");
  assert.equal(first.result.current[0], "guided");
  assert.equal(second.result.current[0], "guided");
});

test("an unknown stored value is ignored", () => {
  localStorage.setItem(ENTRY_MODE_STORAGE_KEY, "spreadsheet");
  const { result } = renderHook(() => useEntryMode());
  assert.equal(result.current[0], "grid");
});
