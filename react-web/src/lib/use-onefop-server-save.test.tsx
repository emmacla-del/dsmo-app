import { act, renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { useState } from "react";
import { useOnefopServerSave } from "./use-onefop-server-save";

/**
 * A wizard in miniature: "Type" changes the answers (as the respondent
 * does), "Save" asks for a save (as "Save and come back later" does), and
 * the save itself is whatever the test hands it.
 */
function harness(save: (options: { keepalive: boolean }) => Promise<unknown>) {
  function Harness() {
    const [data, setData] = useState<Record<string, string>>({});
    const { state, savedAt, hasUnsavedChanges, saveNow } = useOnefopServerSave(data, save);
    return (
      <div>
        <span data-testid="state">{state}</span>
        <span data-testid="unsaved">{String(hasUnsavedChanges)}</span>
        <span data-testid="at">{savedAt ? "yes" : "no"}</span>
        <button type="button" onClick={() => setData({ VT1_2: String(Math.random()) })}>Type</button>
        <button type="button" onClick={() => void saveNow()}>Save</button>
      </div>
    );
  }
  return renderWithProviders(<Harness />);
}

const state = () => screen.getByTestId("state").textContent;
const unsaved = () => screen.getByTestId("unsaved").textContent;
const type = async (user: ReturnType<typeof harness>["user"]) => user.click(screen.getByRole("button", { name: "Type" }));
const save = async (user: ReturnType<typeof harness>["user"]) => user.click(screen.getByRole("button", { name: "Save" }));
const leave = async (event: "pagehide" | "visibilitychange") => {
  await act(async () => {
    // The jsdom window's own Event, not Node's global of the same name.
    const DomEvent = window.Event;
    if (event === "pagehide") window.dispatchEvent(new DomEvent("pagehide"));
    else document.dispatchEvent(new DomEvent("visibilitychange"));
  });
};
/** jsdom keeps the document visible; a departure makes it hidden. */
function hide() {
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
}

test("a save that lands reports the account, and the answers are no longer only local", async () => {
  const calls: Array<{ keepalive: boolean }> = [];
  const { user } = harness(async (o) => { calls.push(o); });

  await type(user);
  assert.equal(unsaved(), "true", "typed, not sent");

  await save(user);
  assert.equal(state(), "saved");
  assert.equal(unsaved(), "false");
  assert.equal(screen.getByTestId("at").textContent, "yes", "the time to show in the masthead");
  assert.deepEqual(calls, [{ keepalive: false }], "asked for, so not a closing save");
});

test("typing after a save puts the answers back on this device only", async () => {
  const { user } = harness(async () => {});
  await type(user);
  await save(user);
  assert.equal(unsaved(), "false");

  await type(user);
  assert.equal(unsaved(), "true", "the masthead stops claiming the account");
  assert.equal(state(), "saved", "the last save did land; it is simply out of date");
});

test("a save that fails says so, and a retry puts it right", async () => {
  let fail = true;
  const { user } = harness(async () => {
    if (fail) throw new Error("network down");
  });

  await type(user);
  await save(user);
  assert.equal(state(), "failed");
  assert.equal(unsaved(), "true", "nothing reached the account");

  fail = false;
  await save(user);
  assert.equal(state(), "saved");
  assert.equal(unsaved(), "false");
});

test("leaving the page sends what is not on the server, keepalive", async () => {
  const calls: Array<{ keepalive: boolean }> = [];
  const { user } = harness(async (o) => { calls.push(o); });

  await type(user);
  hide();
  await leave("pagehide");

  assert.deepEqual(calls, [{ keepalive: true }]);
  assert.equal(state(), "saved");
});

test("one departure sends one save, whichever events the browser gives", async () => {
  // The save is still in flight when the second event arrives — what the
  // browser does when it closes the page.
  const calls: Array<{ keepalive: boolean }> = [];
  let release = () => {};
  const { user } = harness((o) => {
    calls.push(o);
    return new Promise<void>((resolve) => { release = resolve; });
  });

  await type(user);
  hide();
  await leave("visibilitychange");
  await leave("pagehide");
  await act(async () => { release(); });

  assert.equal(calls.length, 1, "visibilitychange and pagehide are one departure");
});

test("leaving with nothing new sends nothing: no request per tab switch", async () => {
  const calls: unknown[] = [];
  const { user } = harness(async (o) => { calls.push(o); });

  await type(user);
  await save(user);
  hide();
  await leave("pagehide");

  assert.equal(calls.length, 1, "only the save that was asked for");
});

test("answers typed after a departure are sent by the next one", async () => {
  const calls: unknown[] = [];
  const { user } = harness(async (o) => { calls.push(o); });

  await type(user);
  hide();
  await leave("pagehide");
  await type(user);
  await leave("pagehide");

  assert.equal(calls.length, 2);
});

/** The wizard as opened: answers loaded from the account, then maybe changed. */
function loadedHarness(save: (options: { keepalive: boolean }) => Promise<unknown>, enabled = true) {
  const loaded = { VT1_2: "CFP Test" };
  function Harness() {
    const [data, setData] = useState<Record<string, string>>(loaded);
    const { hasUnsavedChanges, saveNow } = useOnefopServerSave(data, save, { baseline: loaded, enabled });
    return (
      <div>
        <span data-testid="unsaved">{String(hasUnsavedChanges)}</span>
        <button type="button" onClick={() => setData({ VT1_2: String(Math.random()) })}>Type</button>
        <button type="button" onClick={() => void saveNow()}>Save</button>
      </div>
    );
  }
  return renderWithProviders(<Harness />);
}

test("opening the wizard and leaving it unchanged sends nothing", async () => {
  const calls: unknown[] = [];
  loadedHarness(async (o) => { calls.push(o); });

  assert.equal(unsaved(), "false", "the loaded answers are already on the account");
  hide();
  await leave("pagehide");
  assert.equal(calls.length, 0);
});

test("a change to the loaded answers is still sent on leaving", async () => {
  const calls: unknown[] = [];
  const { user } = loadedHarness(async (o) => { calls.push(o); });

  await type(user);
  assert.equal(unsaved(), "true");
  hide();
  await leave("pagehide");
  assert.equal(calls.length, 1);
});

test("disabled (a submitted declaration): nothing is sent, on leaving or on request", async () => {
  const calls: unknown[] = [];
  const { user } = loadedHarness(async (o) => { calls.push(o); }, false);

  await type(user);
  assert.equal(unsaved(), "false");
  await save(user);
  hide();
  await leave("pagehide");
  assert.equal(calls.length, 0);
});
