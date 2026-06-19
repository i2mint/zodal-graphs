/**
 * Half-open intervals `[start, end)` over rational time, and Allen's 13 interval relations.
 *
 * No JS/TS library implements Allen's 13 relations natively, so this is the hand-written glue the
 * research calls for. Intervals are half-open: `start <= end`, and `start === end` is a zero-measure
 * INSTANT conceptually at `start`. `allen(a, b)` returns the single relation between two intervals
 * (endpoint algebra, correct for proper intervals); `intersects` and `relate` are the unambiguous
 * query helpers a brushing timeline actually uses (and they handle instants correctly).
 */

import type { RationalTime, TimeInput } from './time.js';
import { compareTime, timeLt, timeLte, toRational } from './time.js';

export interface Interval {
  start: RationalTime;
  end: RationalTime;
}

/** The 13 Allen relations (a relates to b). Inverses are paired (precedes/preceded-by, …). */
export type AllenRelation =
  | 'precedes'
  | 'meets'
  | 'overlaps'
  | 'finished-by'
  | 'contains'
  | 'starts'
  | 'equals'
  | 'started-by'
  | 'during'
  | 'finishes'
  | 'overlapped-by'
  | 'met-by'
  | 'preceded-by';

/** Construct a half-open interval; throws if `end < start`. */
export function interval(start: TimeInput, end: TimeInput): Interval {
  const s = toRational(start);
  const e = toRational(end);
  if (compareTime(e, s) < 0) {
    throw new Error('graph-timeline: interval end must be >= start (half-open [start, end))');
  }
  return { start: s, end: e };
}

/** A zero-measure interval (`start === end`) — an instant. */
export function isInstant(i: Interval): boolean {
  return compareTime(i.start, i.end) === 0;
}

const INVERSE: Record<AllenRelation, AllenRelation> = {
  precedes: 'preceded-by',
  meets: 'met-by',
  overlaps: 'overlapped-by',
  'finished-by': 'finishes',
  contains: 'during',
  starts: 'started-by',
  equals: 'equals',
  'started-by': 'starts',
  during: 'contains',
  finishes: 'finished-by',
  'overlapped-by': 'overlaps',
  'met-by': 'meets',
  'preceded-by': 'precedes',
};

/** The converse relation: `allen(a, b) === inverse(allen(b, a))`. */
export function inverse(relation: AllenRelation): AllenRelation {
  return INVERSE[relation];
}

/**
 * The single Allen relation of `a` to `b`. Endpoint algebra — proven mutually-exclusive,
 * exhaustive, and inverse-consistent for proper intervals. Two coincident instants are special-cased
 * to `equals` (so `allen(a,b) === inverse(allen(b,a))` holds for them); other instant/boundary cases
 * follow the endpoint rules and may read as `meets`/`met-by`. **For instant-aware "is it inside /
 * overlapping" questions use {@link intersects} / {@link within} / {@link disjoint}**, which honor
 * the half-open `[start, end)` semantics; `allen` is the relation *algebra*, not the overlap test.
 */
export function allen(a: Interval, b: Interval): AllenRelation {
  // Two zero-measure instants relate purely by their point — and `equals` is self-inverse.
  if (isInstant(a) && isInstant(b)) {
    const c = compareTime(a.start, b.start);
    return c < 0 ? 'precedes' : c > 0 ? 'preceded-by' : 'equals';
  }
  const aEndVsBStart = compareTime(a.end, b.start);
  if (aEndVsBStart < 0) return 'precedes';
  if (aEndVsBStart === 0) return 'meets';
  const aStartVsBEnd = compareTime(a.start, b.end);
  if (aStartVsBEnd > 0) return 'preceded-by';
  if (aStartVsBEnd === 0) return 'met-by';

  // The intervals genuinely overlap; classify by their start and end comparisons.
  const ss = compareTime(a.start, b.start);
  const ee = compareTime(a.end, b.end);
  if (ss < 0) return ee < 0 ? 'overlaps' : ee === 0 ? 'finished-by' : 'contains';
  if (ss === 0) return ee < 0 ? 'starts' : ee === 0 ? 'equals' : 'started-by';
  return ee < 0 ? 'during' : ee === 0 ? 'finishes' : 'overlapped-by';
}

/** Does `a` relate to `b` by any of `relations`? */
export function relate(a: Interval, b: Interval, relations: readonly AllenRelation[]): boolean {
  return relations.includes(allen(a, b));
}

/**
 * Do `a` and `b` share any time? Unambiguous (unlike `allen` boundary cases) and instant-correct:
 * an instant at `t` intersects `[s, e)` iff `s <= t < e`.
 */
export function intersects(a: Interval, b: Interval): boolean {
  if (isInstant(a) && isInstant(b)) return compareTime(a.start, b.start) === 0; // same instant
  if (isInstant(a)) return timeLte(b.start, a.start) && timeLt(a.start, b.end);
  if (isInstant(b)) return timeLte(a.start, b.start) && timeLt(b.start, a.end);
  return timeLt(a.start, b.end) && timeLt(b.start, a.end);
}

/** Allen relations that mean "a is within b" — valid for PROPER intervals; for instants use {@link within}. */
export const WITHIN: readonly AllenRelation[] = ['during', 'starts', 'finishes', 'equals'];

/** Allen relations that mean "a and b are disjoint" — valid for PROPER intervals; for instants use {@link disjoint}. */
export const DISJOINT: readonly AllenRelation[] = ['precedes', 'meets', 'preceded-by', 'met-by'];

/**
 * Is `a`'s whole range contained in `b`? Instant-correct (an instant `[t,t)` is within `b` iff it is
 * IN `b`, i.e. `b.start <= t < b.end`). Prefer this over `relate(a, b, WITHIN)`, which mis-handles
 * instants on a parent's start/end boundary.
 */
export function within(a: Interval, b: Interval): boolean {
  if (isInstant(a)) return intersects(a, b);
  return timeLte(b.start, a.start) && timeLte(a.end, b.end);
}

/** Do `a` and `b` NOT share any time? The instant-correct complement of {@link intersects}. */
export function disjoint(a: Interval, b: Interval): boolean {
  return !intersects(a, b);
}
