/**
 * Tests for half-open intervals + Allen's 13 relations + intersects + inverse, over rational time.
 */

import { describe, it, expect } from 'vitest';
import { compareTime, rational, subTime, toNumber } from '../src/headless.js';
import { allen, intersects, interval, inverse, isInstant, relate, type AllenRelation } from '../src/headless.js';

// Each row: a, b, and the expected relation of a to b.
const CASES: Array<[[number, number], [number, number], AllenRelation]> = [
  [[0, 2], [3, 5], 'precedes'],
  [[0, 3], [3, 5], 'meets'],
  [[0, 4], [3, 6], 'overlaps'],
  [[0, 6], [3, 6], 'finished-by'],
  [[0, 8], [3, 6], 'contains'],
  [[3, 5], [3, 8], 'starts'],
  [[3, 6], [3, 6], 'equals'],
  [[3, 8], [3, 6], 'started-by'],
  [[4, 5], [3, 8], 'during'],
  [[5, 8], [3, 8], 'finishes'],
  [[4, 8], [3, 6], 'overlapped-by'],
  [[5, 8], [3, 5], 'met-by'],
  [[6, 8], [3, 5], 'preceded-by'],
];

describe('allen — the 13 relations', () => {
  it.each(CASES)('%j vs %j → %s', (a, b, expected) => {
    expect(allen(interval(a[0], a[1]), interval(b[0], b[1]))).toBe(expected);
  });

  it('every relation is the inverse of its converse: allen(a,b) === inverse(allen(b,a))', () => {
    for (const [a, b] of CASES) {
      const ab = allen(interval(a[0], a[1]), interval(b[0], b[1]));
      const ba = allen(interval(b[0], b[1]), interval(a[0], a[1]));
      expect(ab).toBe(inverse(ba));
    }
  });

  it('covers all 13 relations exactly once across the fixture', () => {
    expect(new Set(CASES.map((c) => c[2])).size).toBe(13);
  });
});

describe('intersects (instant-correct)', () => {
  it('proper intervals share time iff their ranges overlap', () => {
    expect(intersects(interval(0, 4), interval(3, 6))).toBe(true);
    expect(intersects(interval(0, 3), interval(3, 6))).toBe(false); // half-open: touching ≠ overlapping
  });

  it('an instant at t is inside [s, e) iff s <= t < e', () => {
    expect(intersects(interval(5, 5), interval(3, 8))).toBe(true);
    expect(intersects(interval(8, 8), interval(3, 8))).toBe(false); // half-open end is exclusive
    expect(intersects(interval(3, 8), interval(3, 3))).toBe(true); // symmetric
  });

  it('isInstant detects zero-measure intervals', () => {
    expect(isInstant(interval(5, 5))).toBe(true);
    expect(isInstant(interval(5, 6))).toBe(false);
  });
});

describe('relate + interval construction', () => {
  it('relate matches a relation set', () => {
    expect(relate(interval(4, 5), interval(3, 8), ['during', 'starts'])).toBe(true);
    expect(relate(interval(0, 2), interval(3, 8), ['during', 'starts'])).toBe(false);
  });

  it('rejects an interval with end < start', () => {
    expect(() => interval(5, 3)).toThrow(/end must be >= start/);
  });
});

describe('rational time', () => {
  it('compares exactly via cross-multiplication', () => {
    expect(compareTime({ v: 1, r: 2 }, { v: 2, r: 3 })).toBe(-1); // 0.5 < 0.667
    expect(compareTime({ v: 2, r: 4 }, { v: 1, r: 2 })).toBe(0); // 0.5 === 0.5
  });

  it('normalizes a negative denominator', () => {
    expect(rational(1, -2)).toEqual({ v: -1, r: 2 });
  });

  it('subtracts exactly', () => {
    expect(toNumber(subTime({ v: 3, r: 4 }, { v: 1, r: 4 }))).toBe(0.5); // 3/4 - 1/4 = 1/2
  });

  it('drives sample-accurate intervals', () => {
    // frame 1234 at 48kHz vs frame 1235 — distinct, comparable without float drift
    expect(allen(interval({ v: 0, r: 48000 }, { v: 1234, r: 48000 }), interval({ v: 1234, r: 48000 }, { v: 2000, r: 48000 }))).toBe('meets');
  });
});
