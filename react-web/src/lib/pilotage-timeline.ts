// Campaign return totals and weekly submission/review activity timelines.
//
// The returns timeline counts exactly as /returns does. The weekly activity
// series comes from actual submission and audit-event dates.
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

export interface CampaignReturnsActivityDay {
  date: string;
  submitted: number;
  approved: number;
  correctionRequested: number;
}

export interface CampaignReturnsActivity {
  campaign: CampaignReturnsTimeline["campaign"];
  timeZone: string;
  days: CampaignReturnsActivityDay[];
}

export function getCampaignReturnsTimeline(campaignId: string) {
  return apiFetch<CampaignReturnsTimeline>(
    `/admin/pilotage/campaigns/${encodeURIComponent(campaignId)}/returns/timeline`,
  );
}

export function getCampaignReturnsActivity(campaignId: string) {
  return apiFetch<CampaignReturnsActivity>(
    `/admin/pilotage/campaigns/${encodeURIComponent(campaignId)}/returns/activity`,
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

/**
 * Computes 3 to 6 neat integer tick values from 0 up to yMax.
 */
export function computeYTicks(yMax: number): number[] {
  if (yMax <= 0) return [0];
  if (yMax <= 4) return Array.from({ length: yMax + 1 }, (_, i) => i);
  const rawStep = yMax / 4;
  const power = 10 ** Math.floor(Math.log10(rawStep));
  let step = power;
  for (const factor of [1, 2, 5, 10]) {
    if (factor * power >= rawStep) {
      step = factor * power;
      break;
    }
  }
  const ticks: number[] = [];
  for (let v = 0; v <= yMax; v += step) {
    ticks.push(v);
  }
  if (ticks[ticks.length - 1] !== yMax) {
    ticks.push(yMax);
  }
  return ticks;
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
  /** The cumulative smooth line (tension 0.25, monotonic). */
  line: string;
  /** Start of the line, for area fill. */
  start: { x: number; y: number };
  /** End of the line, for the direct label. */
  end: { x: number; y: number; value: number };
  /** The steady-pace reference, or null. */
  pace: { x1: number; y1: number; x2: number; y2: number } | null;
  markers: ChartMarker[];
  yTicks: Array<{ y: number; value: number }>;
  xTicks: Array<{ x: number; date: string }>;
  /** Midpoint X coordinate for each day. */
  dayMidX: number[];
  /** Left edge of each day, then the right edge of the last one. */
  dayX: number[];
  yMax: number;
  domain: { start: number; end: number };
}

/**
 * Builds an SVG cubic-Bézier path matching Chart.js line chart tension (0.25).
 * Uses monotonic tangent clamping so cumulative non-decreasing values never dip.
 */
function smoothSpline(
  pts: ReadonlyArray<{ x: number; y: number }>,
  tension = 0.25,
): string {
  if (pts.length === 0) return "";
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  if (pts.length === 1) return d;
  if (pts.length === 2) {
    return `${d} L${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`;
  }
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];

    let cp1x = p1.x + (p2.x - p0.x) * tension;
    let cp1y = p1.y + (p2.y - p0.y) * tension;
    let cp2x = p2.x - (p3.x - p1.x) * tension;
    let cp2y = p2.y - (p3.y - p1.y) * tension;

    // In SVG, y is inverted (smaller y = higher value).
    // For non-decreasing cumulative values, p1.y >= p2.y.
    if (p1.y === p2.y) {
      // Flat segment: keep control points perfectly horizontal
      cp1y = p1.y;
      cp2y = p2.y;
    } else {
      // Clamp control points between p1.y and p2.y to avoid any overshoot
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      cp1y = Math.max(minY, Math.min(maxY, cp1y));
      cp2y = Math.max(minY, Math.min(maxY, cp2y));
    }

    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Builds a smooth SVG path for a sampled cumulative series. */
export function cumulativeSeriesPath(points: ReadonlyArray<{ x: number; y: number }>): string {
  return smoothSpline(points, 0.25);
}

/**
 * Builds an SVG cubic-Bézier path through arbitrary series points
 * (rising and falling) matching Chart.js line tension (0.25).
 */
export function cardinalSplinePath(
  pts: ReadonlyArray<{ x: number; y: number }>,
  tension = 0.25,
): string {
  if (pts.length === 0) return "";
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  if (pts.length === 1) return d;
  if (pts.length === 2) {
    return `${d} L${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`;
  }
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

/**
 * Lays the series out in `box` (pixels). The x domain runs from the first
 * day to the later of the last day and the deadlines, so the time left is
 * visible; the y domain from 0 to the pace's target (the registered stock)
 * or the total, whichever is higher, and to a round number above the total
 * when there is no target.
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
  const yMax = paceTarget > 0 ? Math.max(timeline.total, paceTarget) : niceMax(Math.max(timeline.total, 1));
  const y = (v: number) => box.top + plotH - (v / yMax) * plotH;

  const dayX = days.map((d) => x(doualaDayStart(d.date)));
  dayX.push(x(lastDayEnd));
  const dayMidX = days.map((_, i) => (dayX[i] + dayX[i + 1]) / 2);

  // Collect data points up to "now" (Cameroon day)
  const stopAt = x(Math.min(lastDayEnd, Math.max(now, doualaDayStart(days[days.length - 1].date))));
  const pts: Array<{ x: number; y: number; cumulative: number }> = [];
  for (let i = 0; i < days.length; i++) {
    const mid = dayMidX[i];
    if (mid > stopAt && i > 0 && days[i].cumulative === days[i - 1].cumulative) {
      break;
    }
    pts.push({ x: mid, y: y(days[i].cumulative), cumulative: days[i].cumulative });
  }

  if (pts.length === 0) {
    pts.push({ x: dayMidX[0], y: y(0), cumulative: 0 });
  }

  const path = smoothSpline(pts, 0.25);
  const lastPt = pts[pts.length - 1];

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

  const yTicks = computeYTicks(yMax).map((value) => ({ value, y: y(value) }));

  // Generate evenly spaced date ticks across the domain (approx. every 120-160px)
  const tickCount = Math.min(5, Math.max(2, Math.floor(plotW / 140)));
  const xTicks: Array<{ x: number; date: string }> = [];
  for (let i = 0; i < tickCount; i++) {
    const t = start + (i / (tickCount - 1)) * (end - start);
    const d = new Date(t);
    const dateStr = d.toISOString().slice(0, 10);
    xTicks.push({ x: x(t), date: dateStr });
  }

  return {
    line: path,
    start: { x: pts[0].x, y: pts[0].y },
    end: { x: lastPt.x, y: lastPt.y, value: lastPt.cumulative },
    pace,
    markers,
    yTicks,
    xTicks,
    dayMidX,
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
