import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TABLE_LABEL_COL_PX,
  TABLE_MAX_DATA_COL_PX,
  TABLE_MAX_HEADING_COL_PX,
  TABLE_MAX_WIDTH_PX,
  TABLE_MIN_DATA_COL_PX,
  TABLE_WIDEST_DATA_COL_COUNT,
  spanningHeadingsOf,
  tableDataColumnWidthPx,
  tableMinWidthPx,
  tablePreferredWidthPx,
  widestTableWidthPx,
} from "./tableLayout";

// The cap exists so a three-digit count does not get a 268px cell; this
// holds the other side of it, so raising the cap cannot quietly put the
// widest tables back into horizontal scrolling on a wide screen.
test("the widest table still fits the frame at the capped column width", () => {
  const widest = tablePreferredWidthPx(
    Array.from({ length: TABLE_WIDEST_DATA_COL_COUNT }, () => TABLE_MAX_DATA_COL_PX),
  );
  assert.ok(
    widest <= TABLE_MAX_WIDTH_PX,
    `${TABLE_WIDEST_DATA_COL_COUNT} columns at ${TABLE_MAX_DATA_COL_PX}px come to ${widest}px, over the ${TABLE_MAX_WIDTH_PX}px frame`,
  );
});

test("the cap leaves room above the scrolling floor", () => {
  assert.ok(TABLE_MAX_DATA_COL_PX > TABLE_MIN_DATA_COL_PX);
});

test("a narrow table hugs its columns instead of filling the frame", () => {
  // VT 4.1: three columns. It used to stretch to the full 1025px frame.
  const threeColumns = tablePreferredWidthPx([
    TABLE_MAX_DATA_COL_PX,
    TABLE_MAX_DATA_COL_PX,
    TABLE_MAX_DATA_COL_PX,
  ]);
  assert.equal(threeColumns, TABLE_LABEL_COL_PX + 3 * TABLE_MAX_DATA_COL_PX);
  assert.ok(threeColumns < TABLE_MAX_WIDTH_PX / 2);
});

test("a trailing fixed column is counted in the preferred width", () => {
  assert.equal(
    tablePreferredWidthPx([TABLE_MAX_DATA_COL_PX], TABLE_LABEL_COL_PX, 96),
    TABLE_LABEL_COL_PX + TABLE_MAX_DATA_COL_PX + 96,
  );
});

// AdaptiveStatisticalTable splits a grouped table into column-group tabs
// once tablePreferredWidthPx exceeds the frame. Every frame between one
// block and the whole table used to scroll sideways instead, because the
// trigger was a separate 64px-per-column floor well below either.
test("a frame too narrow for the whole table still fits one column group", () => {
  // VT 4.8: nine columns in three groups of M/F/Total.
  const whole = tablePreferredWidthPx(
    Array.from({ length: TABLE_WIDEST_DATA_COL_COUNT }, () => TABLE_MAX_DATA_COL_PX),
  );
  const oneBlock = tablePreferredWidthPx([
    TABLE_MAX_DATA_COL_PX,
    TABLE_MAX_DATA_COL_PX,
    TABLE_MAX_DATA_COL_PX,
  ]);
  assert.ok(oneBlock < whole, "splitting must buy real width back");

  // Anywhere in that band the table splits and the chosen block fits.
  const frame = Math.floor((oneBlock + whole) / 2);
  assert.ok(whole > frame, "the whole table must not claim to fit");
  assert.ok(oneBlock < frame, "one block must fit without scrolling");
});

// The wizard's content column grows to this, between the reading measure
// (--vt-content-max, 760px) and TABLE_MAX_WIDTH_PX.
test("a section's column is sized by its widest table", () => {
  const READING_MEASURE = 760;
  assert.equal(widestTableWidthPx([]), 0, "a section with no table keeps the reading measure");

  // VT 4.1 (3 columns) wants less than the reading measure, so the floor wins.
  const vt41 = widestTableWidthPx([3]);
  assert.ok(vt41 > 0 && vt41 < READING_MEASURE);

  // VT 4.8 (9 columns) wants more, and still fits the frame's cap.
  const vt48 = widestTableWidthPx([9]);
  assert.ok(vt48 > READING_MEASURE);
  assert.ok(vt48 <= TABLE_MAX_WIDTH_PX);

  // A section takes its widest table, whatever order they come in.
  assert.equal(widestTableWidthPx([3, 9, 5]), vt48);
  assert.equal(widestTableWidthPx([0, 3]), vt41, "a table with no columns is ignored");
});

test("the scrolling floor is unchanged", () => {
  assert.equal(tableMinWidthPx(9), TABLE_LABEL_COL_PX + 9 * TABLE_MIN_DATA_COL_PX);
  assert.equal(tableMinWidthPx(9, 0), 9 * TABLE_MIN_DATA_COL_PX);
});

// Columns used to be pinned at one width whatever their headings said, then
// briefly sized one by one, which left a table's count columns ragged.
test("a table's columns share one width, set by its headings", () => {
  const sexOnly = tableDataColumnWidthPx(["Homme", "Femme", "Total"]);
  const rooms = tableDataColumnWidthPx(["Nombre total de locaux", "Bon état", "Mauvais état", "Provisoire"]);
  assert.ok(sexOnly < TABLE_MAX_DATA_COL_PX, "short headings make a narrow table");
  assert.ok(rooms > TABLE_MAX_DATA_COL_PX, "long headings get more than the old flat width");
  assert.equal(tableDataColumnWidthPx(["M"]), TABLE_MIN_DATA_COL_PX, "room for a count");
  assert.equal(tableDataColumnWidthPx([" "]), TABLE_MIN_DATA_COL_PX);
  assert.ok(tableDataColumnWidthPx(["x".repeat(200)]) <= TABLE_MAX_HEADING_COL_PX);
});

test("a short heading stays on one line, a long one takes two", () => {
  // "Bon état" wrapped when each column was sized for two lines.
  assert.ok(tableDataColumnWidthPx(["Bon état"]) > tableDataColumnWidthPx(["Bon"]));
  const twoLines = tableDataColumnWidthPx(["Nombre total de locaux"]);
  assert.ok(twoLines < TABLE_MAX_HEADING_COL_PX);
  assert.equal(twoLines, tableDataColumnWidthPx(["Nombre total"]), "split at the best word break");
});

test("a spanning heading fits on two lines across its columns", () => {
  const band = "Nombre de locaux selon les matériaux de construction et l'état";
  const overThree = tableDataColumnWidthPx(["M"], [{ heading: band, columns: 3 }]);
  const overOne = tableDataColumnWidthPx(["M"], [{ heading: band, columns: 1 }]);
  assert.ok(overThree > TABLE_MIN_DATA_COL_PX && overThree < overOne);
});

test("consecutive equal values make one spanning heading", () => {
  assert.deepEqual(spanningHeadingsOf([undefined, "A", "A", "B", undefined, "B"]), [
    { heading: "A", columns: 2 },
    { heading: "B", columns: 1 },
    { heading: "B", columns: 1 },
  ]);
});

// VT 4.8/4.9: nine Homme/Femme/Total columns must still show whole.
test("the widest table still fits the frame at its headings' width", () => {
  const width = tableDataColumnWidthPx(
    ["Homme", "Femme", "Total"],
    [{ heading: "Entrants", columns: 3 }, { heading: "Sortants", columns: 3 }, { heading: "Abandons", columns: 3 }],
  );
  assert.ok(tablePreferredWidthPx(Array.from({ length: 9 }, () => width)) <= TABLE_MAX_WIDTH_PX);
});
