import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TABLE_LABEL_COL_PX,
  TABLE_MAX_DATA_COL_PX,
  TABLE_MAX_WIDTH_PX,
  TABLE_MIN_DATA_COL_PX,
  TABLE_WIDEST_DATA_COL_COUNT,
  tableMinWidthPx,
  tablePreferredWidthPx,
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

test("the scrolling floor is unchanged", () => {
  assert.equal(tableMinWidthPx(9), TABLE_LABEL_COL_PX + 9 * TABLE_MIN_DATA_COL_PX);
  assert.equal(tableMinWidthPx(9, 0), 9 * TABLE_MIN_DATA_COL_PX);
});
