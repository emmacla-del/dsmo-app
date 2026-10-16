import "@/test/render";
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { useAuthStore } from "./auth-store";
import { getCachedUser, getToken, setToken } from "./api-client";

// F10: signing out while the profile request (/auth/me) is still in flight
// must not let its late answer sign the user back in or re-cache the profile.

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  localStorage.clear();
  sessionStorage.clear();
  useAuthStore.setState({ status: "loading", user: null });
});

/** fetch that answers /auth/me only when `release` is called. */
function deferredMe(user: Record<string, unknown>) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  globalThis.fetch = (async () => {
    await gate;
    return new Response(JSON.stringify(user), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return () => release();
}

const USER = { id: "u-1", email: "walti@gmail.com", role: "COMPANY", status: "ACTIVE" };

test("a profile answer arriving after sign-out is discarded", async () => {
  setToken("token-1");
  const release = deferredMe(USER);
  const restoring = useAuthStore.getState().restore();

  useAuthStore.getState().logout();
  release();
  await restoring;

  assert.equal(getToken(), null);
  assert.equal(getCachedUser(), null, "the profile is not cached again");
  assert.equal(useAuthStore.getState().status, "unauthenticated", "the user stays signed out");
});

test("a late refresh does not re-cache a signed-out user's profile", async () => {
  setToken("token-1");
  const release = deferredMe(USER);
  const refreshing = useAuthStore.getState().refreshUser();

  useAuthStore.getState().logout();
  release();
  await refreshing;

  assert.equal(getCachedUser(), null);
  assert.equal(useAuthStore.getState().user, null);
});

test("without a sign-out, the profile is restored and cached as before", async () => {
  setToken("token-1");
  const release = deferredMe(USER);
  const restoring = useAuthStore.getState().restore();
  release();
  await restoring;

  assert.equal(useAuthStore.getState().status, "authenticated");
  assert.equal(getCachedUser()?.email, "walti@gmail.com");
});

test("defect 8: 401 response resets in-memory auth store and clears tokens", async () => {
  setToken("token-valid");
  useAuthStore.setState({ status: "authenticated", user: USER as any });

  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({ statusCode: 401, message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const { apiFetch } = await import("./api-client");
  await assert.rejects(() => apiFetch("/admin/pilotage/queues"), {
    name: "ApiError",
    status: 401,
  });

  assert.equal(getToken(), null, "access token must be cleared on 401");
  assert.equal(getCachedUser(), null, "cached user must be cleared on 401");
  assert.equal(useAuthStore.getState().status, "unauthenticated", "auth store status must be unauthenticated");
  assert.equal(useAuthStore.getState().user, null, "auth store user must be null");
});

test("defect 8: 403 response does not reset in-memory auth store (401 and 403 distinct)", async () => {
  setToken("token-valid");
  useAuthStore.setState({ status: "authenticated", user: USER as any });

  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({ statusCode: 403, message: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const { apiFetch } = await import("./api-client");
  await assert.rejects(() => apiFetch("/admin/super-secret"), {
    name: "ApiError",
    status: 403,
  });

  assert.equal(getToken(), "token-valid", "access token must NOT be cleared on 403");
  assert.equal(useAuthStore.getState().status, "authenticated", "auth store must remain authenticated on 403");
});

test("defect 8: 401 on /auth/login does not trigger logout interceptor", async () => {
  useAuthStore.setState({ status: "unauthenticated", user: null });

  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({ statusCode: 401, message: "Invalid credentials" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const { login } = await import("./api-client");
  await assert.rejects(() => login("bad@test.cm", "wrong-password"), {
    name: "ApiError",
    status: 401,
  });
});

// ── 2026-10-16 re-test: a backend restart signed the admin out ──────────
// At boot, only the server refusing the token (401/403) ends the session.
// "Server unreachable" (apiFetch's ApiError with status 0) and a 5xx do not.

import { cacheUser } from "./api-client";
import { RESTORE_RETRY_DELAYS_MS } from "./auth-store";

const unreachable = (() => Promise.reject(new TypeError("Failed to fetch"))) as typeof fetch;
const answering = (status: number, body: unknown = { statusCode: status }) =>
  (async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })) as typeof fetch;

for (const [name, fetchImpl] of [
  ["the server cannot be reached", unreachable],
  ["the server answers 502", answering(502)],
  ["the server answers 500", answering(500)],
] as const) {
  test(`${name}: the session survives with the cached profile`, async () => {
    setToken("token-1");
    cacheUser(USER as any);
    globalThis.fetch = fetchImpl;
    await useAuthStore.getState().restore();
    assert.equal(getToken(), "token-1", "the token is kept");
    assert.equal(getCachedUser()?.email, USER.email, "the cached profile is kept");
    assert.equal(useAuthStore.getState().status, "authenticated");
    assert.equal(useAuthStore.getState().user?.email, USER.email);
  });
}

for (const status of [401, 403]) {
  test(`the server refuses the token (${status}): signed out`, async () => {
    setToken("token-1");
    cacheUser(USER as any);
    globalThis.fetch = answering(status);
    await useAuthStore.getState().restore();
    assert.equal(getToken(), null);
    assert.equal(getCachedUser(), null);
    assert.equal(useAuthStore.getState().status, "unauthenticated");
  });
}

test("no cached profile and the server briefly unreachable: it tries again and signs in", async () => {
  setToken("token-1");
  let calls = 0;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    ++calls === 1 ? unreachable(input, init) : answering(200, USER)(input, init)) as typeof fetch;
  await useAuthStore.getState().restore();
  assert.equal(calls, 2);
  assert.equal(useAuthStore.getState().status, "authenticated");
  assert.equal(getCachedUser()?.email, USER.email);
});

test("no cached profile and the server stays unreachable: sign-in is shown, but the token is kept", async () => {
  const saved = [...RESTORE_RETRY_DELAYS_MS];
  RESTORE_RETRY_DELAYS_MS.splice(0, RESTORE_RETRY_DELAYS_MS.length, 1, 1);
  try {
    setToken("token-1");
    let calls = 0;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      calls++;
      return unreachable(input, init);
    }) as typeof fetch;
    await useAuthStore.getState().restore();
    assert.equal(calls, 3, "the first try and two retries");
    assert.equal(useAuthStore.getState().status, "unauthenticated");
    assert.equal(getToken(), "token-1", "never refused, so not discarded");
  } finally {
    RESTORE_RETRY_DELAYS_MS.splice(0, RESTORE_RETRY_DELAYS_MS.length, ...saved);
  }
});
