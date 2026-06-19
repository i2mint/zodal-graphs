/**
 * Rational time — `{ v, r }` meaning the value `v` over resolution `r` (i.e. `v / r`).
 *
 * Annotation timelines (lacing, ELAN/Praat, audio/music alignment) need sample-accurate time, so
 * the model layer is rational rather than floating-point: a frame `1234` at rate `48000` is exactly
 * `{ v: 1234, r: 48000 }`, comparable and subtractable without rounding drift. A plain number `n` is
 * accepted everywhere and treated as `{ v: n, r: 1 }`. The denominator is normalized positive so
 * cross-multiplication comparison is sign-safe.
 */

export interface RationalTime {
  v: number;
  r: number;
}

export type TimeInput = number | RationalTime;

/** Construct a normalized rational time (`r > 0`). */
export function rational(v: number, r = 1): RationalTime {
  if (r === 0) throw new Error('graph-timeline: rational time resolution must be non-zero');
  return r < 0 ? { v: -v, r: -r } : { v, r };
}

/** Coerce a number or rational to a normalized {@link RationalTime}. */
export function toRational(t: TimeInput): RationalTime {
  return typeof t === 'number' ? { v: t, r: 1 } : rational(t.v, t.r);
}

/** The floating-point value `v / r` (lossy — for display / scales, not comparison). */
export function toNumber(t: RationalTime): number {
  return t.v / t.r;
}

/** Compare `a` and `b` exactly via cross-multiplication: `-1` if a<b, `0` if equal, `1` if a>b. */
export function compareTime(a: RationalTime, b: RationalTime): number {
  const lhs = a.v * b.r;
  const rhs = b.v * a.r;
  return lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
}

export const timeEquals = (a: RationalTime, b: RationalTime): boolean => compareTime(a, b) === 0;
export const timeLt = (a: RationalTime, b: RationalTime): boolean => compareTime(a, b) < 0;
export const timeLte = (a: RationalTime, b: RationalTime): boolean => compareTime(a, b) <= 0;
export const timeGt = (a: RationalTime, b: RationalTime): boolean => compareTime(a, b) > 0;
export const timeGte = (a: RationalTime, b: RationalTime): boolean => compareTime(a, b) >= 0;

/** `a - b`, exact. */
export function subTime(a: RationalTime, b: RationalTime): RationalTime {
  return rational(a.v * b.r - b.v * a.r, a.r * b.r);
}

/** `min(a, b)` / `max(a, b)`. */
export const minTime = (a: RationalTime, b: RationalTime): RationalTime => (timeLte(a, b) ? a : b);
export const maxTime = (a: RationalTime, b: RationalTime): RationalTime => (timeGte(a, b) ? a : b);
