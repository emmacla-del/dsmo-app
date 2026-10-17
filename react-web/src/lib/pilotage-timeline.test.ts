// Pins the pilotage progress chart's geometry: the Douala day axis, the step
// line ending on the total, the steady-pace reference and the deadlines.
//
// Pure logic, no DOM — run with `npm test`.

import assert from "node:assert/strict";
import test from "node:test";

import {
  chartGeometry,
  dayIndexAt,
  doualaDayStart,
  niceMax,
  paceReading,
  type CampaignReturnsTimeline,
} from "./pilotage-timeline";

const BOX = { width: 400, height: 200, left: 0, right: 0, top: 0, bottom: 0 };

function timeline(over: Partial<CampaignReturnsTimeline["campaign"]> = {}, received = [0, 2, 0, 1]): CampaignReturnsTimeline {
  let cumulative = 0;
  const days = received.map((n, i) => {
    cumulative += n;
    return { date: `2026-02-0${i + 1}`, received: n, cumulative };
  });
  return {
    campaign: {
      id: "c1",
      name: "C",
      code: "C",
      status: "ACTIVE",
      // Midnight in Douala.
      startDate: "2026-01-31T23:00:00.000Z",
      endDate: null,
      deadline: "2026-02-04T23:00:00.000Z",
      extendedDeadline: null,
      ...over,
    },
    timeZone: "Africa/Douala",
    total: cumulative,
    days,
  };
}

test("a Douala day starts at 23:00 UTC the day before", () => {
  assert.equal(new Date(doualaDayStart("2026-02-01")).toISOString(), "2026-01-31T23:00:00.000Z");
});

test("niceMax rounds up to 1, 2 or 5 times a power of ten", () => {
  assert.equal(niceMax(0), 1);
  assert.equal(niceMax(3), 5);
  assert.equal(niceMax(7), 10);
  assert.equal(niceMax(12), 20);
  assert.equal(niceMax(50), 50);
});

test("the line ends on the total, and the axis runs to the deadline", () => {
  const now = Date.parse("2026-02-04T12:00:00Z");
  const g = chartGeometry(timeline(), 10, BOX, now)!;
  assert.equal(g.end.value, 3);
  // 1 to 4 February: the deadline is midnight at the end of the 4th.
  assert.equal(g.domain.end, Date.parse("2026-02-04T23:00:00.000Z"));
  assert.deepEqual(g.dayX.map((x) => Math.round(x)), [0, 100, 200, 300, 400]);
  // The pace target is the stock, so the axis reaches 10.
  assert.equal(g.yMax, 10);
  assert.deepEqual(g.pace, { x1: 0, y1: 200, x2: 400, y2: 0 });
  assert.deepEqual(g.markers.map((m) => [m.kind, Math.round(m.x)]), [["deadline", 400]]);
});

test("an extended deadline gets its own marker and moves the pace's end", () => {
  const g = chartGeometry(timeline({ extendedDeadline: "2026-02-08T23:00:00.000Z" }), 10, BOX, Date.parse("2026-02-04T12:00:00Z"))!;
  assert.deepEqual(g.markers.map((m) => m.kind), ["deadline", "extended"]);
  assert.equal(Math.round(g.pace!.x2), 400);
  assert.equal(Math.round(g.markers[0].x), 200);
});

test("no pace without a registered stock or a deadline", () => {
  assert.equal(chartGeometry(timeline(), 0, BOX, Date.now())!.pace, null);
  assert.equal(chartGeometry(timeline({ deadline: null }), 10, BOX, Date.now())!.pace, null);
  assert.equal(chartGeometry({ ...timeline(), days: [] }, 10, BOX, Date.now()), null);
});

test("pace reading compares the total with a straight line to the stock", () => {
  // Halfway between 1 and 5 February (Douala midnights): 5 of 10 expected.
  const half = Date.parse("2026-02-02T23:00:00.000Z");
  assert.deepEqual(paceReading(timeline(), 10, half), { expected: 5, received: 3, ahead: false });
  assert.deepEqual(paceReading(timeline(), 4, half), { expected: 2, received: 3, ahead: true });
  // After the deadline the whole stock is expected.
  assert.equal(paceReading(timeline(), 10, Date.parse("2026-03-01T00:00:00Z"))!.expected, 10);
  assert.equal(paceReading(timeline(), null, half), null);
});

test("the day under the pointer", () => {
  const dayX = [0, 80, 160, 240, 320];
  assert.equal(dayIndexAt(dayX, -1), null);
  assert.equal(dayIndexAt(dayX, 0), 0);
  assert.equal(dayIndexAt(dayX, 100), 1);
  assert.equal(dayIndexAt(dayX, 320), 3);
  assert.equal(dayIndexAt(dayX, 321), null);
});
