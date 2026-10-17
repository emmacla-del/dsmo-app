// The pilotage progress chart: cumulative declarations received per Cameroon
// calendar day, from GET /admin/pilotage/campaigns/:id/returns/timeline.
//
// The server counts exactly as /returns does, so the last `cumulative` is the
// headline `totals.received`. This module holds the geometry the chart draws,
// pure and testable: time runs on the Africa/Douala day (UTC+1, no DST), and
// the "steady pace" reference is a straight line from 0 at the campaign start
// to the registered stock at the effective deadline. It is a reference, not a
// forecast.

import { apiFetch } from "./api-client";

export interface CampaignReturnsTimelineDay {
  /** YYYY-MM-DD, the Douala calendar day. */
  date: string;
  received: number;
  cumulative: number;
}

export interface CampaignReturnsTimeline {
  campaign: {
    id: string;
    name: string;
    code: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    deadline: string | null;
    extendedDeadline: string | null;
  };
  timeZone: string;
  total: number;
  days: CampaignReturnsTimelineDay[];
}

export function getCampaignReturnsTimeline(campaignId: string) {
  return apiFetch<CampaignReturnsTimeline>(
    `/admin/pilotage/campaigns/${encodeURIComponent(campaignId)}/returns/timeline`,
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The instant a Douala calendar day begins (midnight UTC+1). */
export function doualaDayStart(day: string): number {
  return Date.parse(`${day}T00:00:00+01:00`);
}

/** A round axis maximum: 1, 2 or 5 times a power of ten, at least `value`. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) {
    if (step * power >= value) return step * power;
  }
  return 10 * power;
}

export interface PaceReading {
  /** Declarations a steady pace would have brought in by `now`. */
  expected: number;
  received: number;
  ahead: boolean;
}

/**
 * Where a steady pace from the start to the effective deadline would stand
 * now. Null when there is no start, no deadline, no registered stock, or the
 * deadline does not follow the start.
 */
export function paceReading(
  timeline: CampaignReturnsTimeline,
  registeredStock: number | null | undefined,
  now: number,
): PaceReading | null {
  const { startDate, deadline, extendedDeadline } = timeline.campaign;
  const end = extendedDeadline ?? deadline;
  if (!startDate || !end || !registeredStock || registeredStock <= 0) return null;
  const start = Date.parse(startDate);
  const stop = Date.parse(end);
  if (!(stop > start)) return null;
  const share = Math.min(1, Math.max(0, (now - start) / (stop - start)));
  const expected = Math.round(registeredStock * share);
  return { expected, received: timeline.total, ahead: timeline.total >= expected };
}

export interface ChartBox {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ChartMarker {
  kind: "deadline" | "extended";
  x: number;
  date: string;
}

export interface ChartGeometry {
  /** The cumulative step line. */
  line: string;
  /** End of the line, for the direct label. */
  end: { x: number; y: number; value: number };
  /** The steady-pace reference, or null. */
  pace: { x1: number; y1: number; x2: number; y2: number } | null;
  markers: ChartMarker[];
  yTicks: Array<{ y: number; value: number }>;
  /** Left edge of each day, then the right edge of the last one. */
  dayX: number[];
  yMax: number;
  domain: { start: number; end: number };
}

/**
 * Lays the series out in `box` (pixels). The x domain runs from the first
 * day to the later of the last day and the deadlines, so the time left is
 * visible; the y domain from 0 to a round number above both the total and
 * the pace's target.
 */
export function chartGeometry(
  timeline: CampaignReturnsTimeline,
  registeredStock: number | null | undefined,
  box: ChartBox,
  now: number,
): ChartGeometry | null {
  const { days } = timeline;
  if (days.length === 0) return null;

  const start = doualaDayStart(days[0].date);
  const lastDayEnd = doualaDayStart(days[days.length - 1].date) + DAY_MS;
  const { deadline, extendedDeadline, startDate } = timeline.campaign;
  const bounds = [lastDayEnd, deadline, extendedDeadline]
    .map((v) => (typeof v === "string" ? Date.parse(v) : v))
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const end = Math.max(...bounds, start + DAY_MS);

  const plotW = Math.max(1, box.width - box.left - box.right);
  const plotH = Math.max(1, box.height - box.top - box.bottom);
  const x = (t: number) => box.left + ((t - start) / (end - start)) * plotW;

  const effective = extendedDeadline ?? deadline;
  const paceTarget = registeredStock && registeredStock > 0 && effective && startDate ? registeredStock : 0;
  const yMax = niceMax(Math.max(timeline.total, paceTarget, 1));
  const y = (v: number) => box.top + plotH - (v / yMax) * plotH;

  const dayX = days.map((d) => x(doualaDayStart(d.date)));
  dayX.push(x(lastDayEnd));

  // Step-after: each day's arrivals rise at the day's start, then hold. The
  // line stops at the end of today, not at the end of the axis.
  const stopAt = x(Math.min(lastDayEnd, Math.max(now, doualaDayStart(days[days.length - 1].date))));
  let path = `M${dayX[0].toFixed(1)},${y(0).toFixed(1)}`;
  let previous = 0;
  days.forEach((day, i) => {
    if (day.cumulative !== previous) {
      path += ` L${dayX[i].toFixed(1)},${y(previous).toFixed(1)} L${dayX[i].toFixed(1)},${y(day.cumulative).toFixed(1)}`;
      previous = day.cumulative;
    }
  });
  path += ` L${stopAt.toFixed(1)},${y(previous).toFixed(1)}`;

  let pace: ChartGeometry["pace"] = null;
  if (paceTarget > 0 && effective && startDate) {
    const paceStart = Date.parse(startDate);
    const paceEnd = Date.parse(effective);
    if (paceEnd > paceStart) {
      pace = { x1: x(paceStart), y1: y(0), x2: x(paceEnd), y2: y(paceTarget) };
    }
  }

  const markers: ChartMarker[] = [];
  if (deadline) markers.push({ kind: "deadline", x: x(Date.parse(deadline)), date: deadline });
  if (extendedDeadline && extendedDeadline !== deadline) {
    markers.push({ kind: "extended", x: x(Date.parse(extendedDeadline)), date: extendedDeadline });
  }

  const yTicks = [0, yMax / 2, yMax]
    .filter((v) => Number.isInteger(v))
    .map((value) => ({ value, y: y(value) }));

  return {
    line: path,
    end: { x: stopAt, y: y(previous), value: previous },
    pace,
    markers,
    yTicks,
    dayX,
    yMax,
    domain: { start, end },
  };
}

/** The day under a pointer at `px`, or null outside the series. */
export function dayIndexAt(dayX: readonly number[], px: number): number | null {
  if (dayX.length < 2 || px < dayX[0] || px > dayX[dayX.length - 1]) return null;
  for (let i = 0; i < dayX.length - 1; i++) {
    if (px < dayX[i + 1]) return i;
  }
  return dayX.length - 2;
}
