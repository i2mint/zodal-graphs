/**
 * Rational time — `{ v, r }` meaning the value `v` over resolution `r` (i.e. `v / r`).
 *
 * Annotation timelines (lacing, ELAN/Praat, audio/music alignment) need sample-accurate time, so
 * the model layer is rational rather than floating-point: a frame `1234` at rate `48000` is exactly
 * `{ v: 1234, r: 48000 }`, comparable and subtractable without rounding drift. A plain number `n` is
 * accepted everywhere and treated as `{ v: n, r: 1 }`. The denominator is normalized positive (and
 * `-0` normalized to `0`) so cross-multiplication comparison is sign-safe; non-finite values are
 * rejected so a `NaN` can never masquerade as a valid, "equal" time.
 *
 * Precondition: comparison/subtraction use IEEE-double cross-products, so they are EXACT only while
 * `|v * r| < 2^53` (`Number.MAX_SAFE_INTEGER`). That is ~1086 hours of 48kHz frames in a single
 * stream; mixing very high resolutions (subTree multiplies denominators) reaches it sooner. A
 * BigInt cross-multiplication is the long-term fix; for now this is the documented safe domain.
 */

export interface RationalTime {
  v: number;
  r: number;
}

export type TimeInput = number | RationalTime;

/** Construct a normalized rational time (`r > 0`, `-0`→`0`); throws on non-finite or zero `r`. */
export function rational(v: number, r = 1): RationalTime {
  if (!Number.isFinite(v) || !Number.isFinite(r)) {
    throw new Error(`graph-timeline: rational time must be finite (got v=${v}, r=${r})`);
  }
  if (r === 0) throw new Error('graph-timeline: rational time resolution must be non-zero');
  const sign = r < 0 ? -1 : 1;
  const nv = v * sign;
  return { v: nv === 0 ? 0 : nv, r: Math.abs(r) };
}

/** Coerce a number or rational to a normalized {@link RationalTime} (validating finiteness). */
export function toRational(t: TimeInput): RationalTime {
  return typeof t === 'number' ? rational(t) : rational(t.v, t.r);
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
