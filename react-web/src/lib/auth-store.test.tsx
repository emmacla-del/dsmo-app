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
