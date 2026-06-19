/**
 * Tests for ELAN tier stereotype validation: included-in containment + subdivision disjointness.
 */

import { describe, it, expect } from 'vitest';
import { interval, validateTier, validateTiers, type Annotation, type Tier } from '../src/headless.js';

const ann = (id: string, tier: string, start: number, end: number): Annotation => ({ id, tier, interval: interval(start, end) });

describe('validateTier — included-in', () => {
  const tier: Tier = { id: 'words', stereotype: 'included-in', parent: 'phrase' };
  const parents = [ann('p1', 'phrase', 0, 10)];

  it('passes when every child is within a parent annotation', () => {
    const children = [ann('w1', 'words', 1, 3), ann('w2', 'words', 4, 9)];
    expect(validateTier(tier, children, parents)).toEqual([]);
  });

  it('flags a child that escapes its parent', () => {
    const children = [ann('w1', 'words', 1, 3), ann('w2', 'words', 8, 12)]; // w2 extends past parent end
    const violations = validateTier(tier, children, parents);
    expect(violations.map((v) => v.annotation)).toEqual(['w2']);
  });
});

describe('validateTier — time-subdivision (contained AND disjoint)', () => {
  const tier: Tier = { id: 'syll', stereotype: 'time-subdivision', parent: 'word' };
  const parents = [ann('word1', 'word', 0, 10)];

  it('passes for contiguous, non-overlapping, contained subdivisions', () => {
    const children = [ann('s1', 'syll', 0, 4), ann('s2', 'syll', 4, 7), ann('s3', 'syll', 7, 10)];
    expect(validateTier(tier, children, parents)).toEqual([]);
  });

  it('flags overlapping subdivisions', () => {
    const children = [ann('s1', 'syll', 0, 5), ann('s2', 'syll', 4, 8)]; // overlap 4..5
    const violations = validateTier(tier, children, parents);
    expect(violations.some((v) => v.reason.includes('overlaps'))).toBe(true);
  });
});

describe('validateTier — unconstrained stereotypes', () => {
  it('a `none` tier never violates', () => {
    const tier: Tier = { id: 'free', stereotype: 'none' };
    const children = [ann('a', 'free', 0, 5), ann('b', 'free', 3, 8)]; // overlapping is fine for none
    expect(validateTier(tier, children)).toEqual([]);
  });

  it('a `symbolic-subdivision` tier is not interval-validated (no time)', () => {
    const tier: Tier = { id: 'sym', stereotype: 'symbolic-subdivision', parent: 'p' };
    const children = [ann('a', 'sym', 0, 5), ann('b', 'sym', 3, 8)]; // overlap not flagged for symbolic
    expect(validateTier(tier, children, [ann('p', 'p', 0, 10)])).toEqual([]);
  });
});

describe('validateTier — instant (zero-measure) children', () => {
  it('accepts an instant child exactly at the parent start boundary (instant-correct containment)', () => {
    const tier: Tier = { id: 'pts', stereotype: 'included-in', parent: 'p' };
    const children: Annotation[] = [{ id: 'pt', tier: 'pts', interval: interval(3, 3) }]; // instant at parent start
    expect(validateTier(tier, children, [ann('p1', 'p', 3, 8)])).toEqual([]); // was a false violation
  });

  it('flags two coincident-instant annotations as overlapping on a subdivision tier', () => {
    const tier: Tier = { id: 's', stereotype: 'time-subdivision', parent: 'p' };
    const children: Annotation[] = [
      { id: 'a', tier: 's', interval: interval(5, 5) },
      { id: 'b', tier: 's', interval: interval(5, 5) },
    ];
    const violations = validateTier(tier, children, [ann('p1', 'p', 0, 10)]);
    expect(violations.some((v) => v.reason.includes('overlaps'))).toBe(true);
  });
});

describe('validateTiers (whole model)', () => {
  it('reports only tiers with violations', () => {
    const tiers: Tier[] = [
      { id: 'phrase', stereotype: 'none' },
      { id: 'words', stereotype: 'included-in', parent: 'phrase' },
    ];
    const annotations = [ann('p1', 'phrase', 0, 10), ann('w1', 'words', 1, 3), ann('wBad', 'words', 8, 12)];
    const result = validateTiers(tiers, annotations);
    expect([...result.keys()]).toEqual(['words']);
    expect(result.get('words')?.[0].annotation).toBe('wBad');
  });
});
