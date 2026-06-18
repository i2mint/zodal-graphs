/**
 * Tests for the connect-time type rule (`portTypeCompatible`) and its Zod derivation.
 * The rule must never silently permit an invalid wire — these tests pin the conservative v0
 * behaviour, including the safe wideners (wildcard, optional/nullable, unions).
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { PortTypeRef } from '../src/index.js';
import { portTypeCompatible, portTypeRefFromZod } from '../src/index.js';

const num: PortTypeRef = { base: 'number' };
const str: PortTypeRef = { base: 'string' };
const unknown: PortTypeRef = { base: 'unknown', wildcard: true };

describe('portTypeCompatible (v0, conservative)', () => {
  it('compatible on exact base match', () => {
    expect(portTypeCompatible(num, num)).toBe(true);
  });

  it('incompatible on differing base', () => {
    expect(portTypeCompatible(num, str)).toBe(false);
  });

  it('wildcard accepts and is accepted by anything', () => {
    expect(portTypeCompatible(num, unknown)).toBe(true);
    expect(portTypeCompatible(unknown, str)).toBe(true);
  });

  it('an optional source cannot flow into a non-optional target', () => {
    expect(portTypeCompatible({ base: 'number', optional: true }, num)).toBe(false);
  });

  it('an optional/nullable target accepts a required source', () => {
    expect(portTypeCompatible(num, { base: 'number', optional: true })).toBe(true);
    expect(portTypeCompatible(num, { base: 'number', nullable: true })).toBe(true);
  });

  it('a union target accepts a source matching any member', () => {
    expect(portTypeCompatible(num, { base: 'union', options: [num, str] })).toBe(true);
    expect(portTypeCompatible({ base: 'boolean' }, { base: 'union', options: [num, str] })).toBe(false);
  });

  it('a union source is compatible only if every member fits the target', () => {
    expect(portTypeCompatible({ base: 'union', options: [num, str] }, str)).toBe(false);
    expect(portTypeCompatible({ base: 'union', options: [num, num] }, num)).toBe(true);
  });
});

describe('portTypeRefFromZod (reuses @zodal/core introspection)', () => {
  it('reads primitive base types', () => {
    expect(portTypeRefFromZod(z.number()).base).toBe('number');
    expect(portTypeRefFromZod(z.string()).base).toBe('string');
    expect(portTypeRefFromZod(z.boolean()).base).toBe('boolean');
  });

  it('marks unknown/any as wildcard', () => {
    expect(portTypeRefFromZod(z.unknown()).wildcard).toBe(true);
    expect(portTypeRefFromZod(z.any()).wildcard).toBe(true);
  });

  it('records the optional flag without losing the inner base', () => {
    const ref = portTypeRefFromZod(z.number().optional());
    expect(ref.base).toBe('number');
    expect(ref.optional).toBe(true);
  });

  it('records the nullable flag', () => {
    const ref = portTypeRefFromZod(z.number().nullable());
    expect(ref.base).toBe('number');
    expect(ref.nullable).toBe(true);
  });

  it('end-to-end: number → number connects, number → string does not', () => {
    const outNum = portTypeRefFromZod(z.number());
    expect(portTypeCompatible(outNum, portTypeRefFromZod(z.number()))).toBe(true);
    expect(portTypeCompatible(outNum, portTypeRefFromZod(z.string()))).toBe(false);
  });

  it('degrades to a permissive wildcard rather than throwing on odd input', () => {
    // A non-schema object must not crash the model author.
    const ref = portTypeRefFromZod({} as unknown as z.ZodType);
    expect(ref.wildcard).toBe(true);
  });
});
