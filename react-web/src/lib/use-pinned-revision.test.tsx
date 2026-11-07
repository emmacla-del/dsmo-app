import { act, renderHook } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { usePinnedRevision } from "./use-pinned-revision";

function render(initial: string | undefined) {
  return renderHook(({ settled }: { settled: string | undefined }) => usePinnedRevision(settled), {
    initialProps: { settled: initial },
  });
}

test("nothing is pinned while the first fetch is in flight", () => {
  const { result } = render(undefined);
  assert.equal(result.current[0], null);
});

test("the first settled revision is pinned", () => {
  const { result, rerender } = render(undefined);
  rerender({ settled: "rev-1" });
  assert.equal(result.current[0], "rev-1");
});

test("a background refresh does not move the revision under the reviewer's marks", () => {
  const { result, rerender } = render("rev-1");
  rerender({ settled: "rev-2" });
  assert.equal(result.current[0], "rev-1");
});

test("a deliberate reload adopts the new revision", () => {
  const { result, rerender } = render("rev-1");
  rerender({ settled: "rev-2" });
  act(() => result.current[1]("rev-2"));
  assert.equal(result.current[0], "rev-2");
});
