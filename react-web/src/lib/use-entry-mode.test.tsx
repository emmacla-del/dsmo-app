import { act, renderHook } from "@/test/render";
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ENTRY_MODE_STORAGE_KEY, useEntryMode } from "./use-entry-mode";

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

test("first visit: Guidé on a phone", () => {
  phoneViewport();
  const { result } = renderHook(() => useEntryMode());
  assert.equal(result.current[0], "guided");
});

test("a remembered choice wins over the viewport default", () => {
  phoneViewport();
  localStorage.setItem(ENTRY_MODE_STORAGE_KEY, "grid");
  const { result } = renderHook(() => useEntryMode());
  assert.equal(result.current[0], "grid");
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
