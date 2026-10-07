import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  LOGIN_IDENTIFIER_KEY,
  saveLoginIdentifier,
  takeLoginIdentifier,
} from "@/lib/login-handoff";

// A minimal in-memory Storage standing in for the browser's sessionStorage.
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => (data.has(k) ? data.get(k)! : null),
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

const g = globalThis as { window?: unknown };

function withWindow(sessionStorage: Storage | (() => never)) {
  g.window =
    typeof sessionStorage === "function"
      ? Object.defineProperty({}, "sessionStorage", { get: sessionStorage })
      : { sessionStorage };
}

afterEach(() => {
  delete g.window;
});

test("the saved identifier is returned once, then gone", () => {
  const store = memoryStorage();
  withWindow(store);
  saveLoginIdentifier("  a.mbarga@example.cm ");
  assert.equal(store.getItem(LOGIN_IDENTIFIER_KEY), "a.mbarga@example.cm");
  assert.equal(takeLoginIdentifier(), "a.mbarga@example.cm");
  assert.equal(takeLoginIdentifier(), null);
});

test("a blank identifier is not stored", () => {
  const store = memoryStorage();
  withWindow(store);
  saveLoginIdentifier("   ");
  assert.equal(store.getItem(LOGIN_IDENTIFIER_KEY), null);
});

test("no window (server render) is a no-op", () => {
  assert.doesNotThrow(() => saveLoginIdentifier("a@example.cm"));
  assert.equal(takeLoginIdentifier(), null);
});

test("a storage that throws on access is a no-op", () => {
  withWindow(() => {
    throw new Error("SecurityError");
  });
  assert.doesNotThrow(() => saveLoginIdentifier("a@example.cm"));
  assert.equal(takeLoginIdentifier(), null);
});
