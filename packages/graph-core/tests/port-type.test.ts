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

  it('union → union is compatible when every source member fits some target member', () => {
    const ns: PortTypeRef = { base: 'union', options: [num, str] };
    expect(portTypeCompatible(ns, ns)).toBe(true);
    expect(portTypeCompatible(ns, { base: 'union', options: [num, str, { base: 'boolean' }] })).toBe(true);
    expect(portTypeCompatible(ns, { base: 'union', options: [num] })).toBe(false);
  });

  it('NEVER lets a nullable source leak into a non-nullable target (the cardinal sin)', () => {
    expect(portTypeCompatible({ base: 'number', nullable: true }, num)).toBe(false);
    // even when the target is a union, the source-nullable guard runs first
    expect(
      portTypeCompatible({ base: 'number', nullable: true }, { base: 'union', options: [num, str] }),
    ).toBe(false);
    // and when the source is a union with a nullable member
    expect(
      portTypeCompatible({ base: 'union', options: [{ base: 'number', nullable: true }, num] }, num),
    ).toBe(false);
  });

  it('does NOT treat structurally-disjoint composites as compatible (conservative v0)', () => {
    expect(portTypeCompatible({ base: 'object' }, { base: 'object' })).toBe(false);
    expect(portTypeCompatible({ base: 'array' }, { base: 'array' })).toBe(false);
    expect(portTypeCompatible({ base: 'enum' }, { base: 'enum' })).toBe(false);
    expect(portTypeCompatible({ base: 'literal' }, { base: 'literal' })).toBe(false);
  });

  it('an unresolved type is conservative, not a wildcard', () => {
    const unresolved: PortTypeRef = { base: '__unresolved__' };
    expect(portTypeCompatible(unresolved, num)).toBe(false);
    expect(portTypeCompatible(num, unresolved)).toBe(false);
    expect(portTypeCompatible(unresolved, unresolved)).toBe(false);
    expect(portTypeCompatible(unresolved, unknown)).toBe(true); // wildcard still wins
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

  it('end-to-end: a nullable number output cannot wire into a plain number input', () => {
    const out = portTypeRefFromZod(z.number().nullable());
    const into = portTypeRefFromZod(z.number());
    expect(portTypeCompatible(out, into)).toBe(false);
  });

  it('end-to-end: number → number connects, number → string does not', () => {
    const outNum = portTypeRefFromZod(z.number());
    expect(portTypeCompatible(outNum, portTypeRefFromZod(z.number()))).toBe(true);
    expect(portTypeCompatible(outNum, portTypeRefFromZod(z.string()))).toBe(false);
  });

  it('degrades to a CONSERVATIVE (non-wildcard) sentinel rather than throwing on odd input', () => {
    // A non-schema object must not crash the model author — but it must NOT become a wildcard
    // that silently accepts any wire. It is only compatible with itself / a true wildcard.
    const ref = portTypeRefFromZod({} as unknown as z.ZodType);
    expect(ref.wildcard).toBeFalsy();
    expect(portTypeCompatible(ref, portTypeRefFromZod(z.number()))).toBe(false);
  });
});

describe('portTypeCompatible — structural widening (covariant subtyping)', () => {
  const compat = (out: z.ZodType, into: z.ZodType): boolean =>
    portTypeCompatible(portTypeRefFromZod(out), portTypeRefFromZod(into));

  it('numeric refinement covariance (constrained ⊆ looser)', () => {
    expect(compat(z.number().min(0), z.number())).toBe(true); // constrained → unconstrained
    expect(compat(z.number(), z.number().min(0))).toBe(false); // unconstrained → constrained
    expect(compat(z.number().min(0).max(10), z.number().min(0))).toBe(true); // tighter ⊆ looser
    expect(compat(z.number().min(0), z.number().min(5))).toBe(false); // [0,∞) ⊄ [5,∞)
  });

  it('array element covariance', () => {
    expect(compat(z.array(z.number()), z.array(z.number()))).toBe(true);
    expect(compat(z.array(z.number()), z.array(z.string()))).toBe(false);
    expect(compat(z.array(z.number()), z.array(z.unknown()))).toBe(true); // into element is a wildcard
  });

  it('object width + depth subtyping', () => {
    expect(compat(z.object({ a: z.number(), b: z.string() }), z.object({ a: z.number() }))).toBe(true); // extra field ok
    expect(compat(z.object({ a: z.number() }), z.object({ a: z.number(), b: z.string() }))).toBe(false); // missing required field
    expect(compat(z.object({ a: z.number() }), z.object({ a: z.number(), b: z.string().optional() }))).toBe(true); // optional target field
    expect(compat(z.object({ a: z.string() }), z.object({ a: z.number() }))).toBe(false); // field type mismatch
    expect(compat(z.object({ n: z.number().min(0) }), z.object({ n: z.number() }))).toBe(true); // recursive covariance
    expect(compat(z.object({ n: z.number() }), z.object({ n: z.number().min(0) }))).toBe(false);
  });

  it('enum / literal value-set subset', () => {
    expect(compat(z.enum(['a', 'b']), z.enum(['a', 'b', 'c']))).toBe(true); // subset
    expect(compat(z.enum(['a', 'b', 'c']), z.enum(['a', 'b']))).toBe(false); // superset
    expect(compat(z.literal('a'), z.enum(['a', 'b']))).toBe(true); // literal ∈ enum
    expect(compat(z.literal('z'), z.enum(['a', 'b']))).toBe(false);
  });

  it('enum / literal of strings flows into a plain string', () => {
    expect(compat(z.enum(['a', 'b']), z.string())).toBe(true);
    expect(compat(z.literal('x'), z.string())).toBe(true);
  });

  it('tuple elementwise covariance (same arity)', () => {
    expect(compat(z.tuple([z.number(), z.string()]), z.tuple([z.number(), z.string()]))).toBe(true);
    expect(compat(z.tuple([z.number()]), z.tuple([z.number(), z.string()]))).toBe(false); // arity mismatch
    expect(compat(z.tuple([z.number().min(0), z.string()]), z.tuple([z.number(), z.string()]))).toBe(true);
  });
});

describe('portTypeCompatible — soundness (never silently permit; critic regressions)', () => {
  const compat = (out: z.ZodType, into: z.ZodType): boolean =>
    portTypeCompatible(portTypeRefFromZod(out), portTypeRefFromZod(into));

  it('number does NOT flow into int (float would leak); int → int / int → number ok', () => {
    expect(compat(z.number(), z.number().int())).toBe(false);
    expect(compat(z.number().min(0).max(10), z.number().int())).toBe(false);
    expect(compat(z.number().int(), z.number().int())).toBe(true);
    expect(compat(z.number().int(), z.number())).toBe(true); // int ⊆ number
  });

  it('plain string does NOT flow into a refined string; refined → plain ok', () => {
    expect(compat(z.string(), z.email())).toBe(false);
    expect(compat(z.string(), z.string().min(5))).toBe(false);
    expect(compat(z.string(), z.uuid())).toBe(false);
    expect(compat(z.email(), z.string())).toBe(true); // email ⊆ string
    expect(compat(z.string(), z.string())).toBe(true); // both unrefined
  });

  it('an opaque .refine() target rejects an unconstrained source', () => {
    expect(compat(z.number(), z.number().refine((n) => n > 0))).toBe(false);
    expect(compat(z.number().min(1), z.number())).toBe(true); // unrefined target still accepts
  });

  it('a numeric / heterogeneous enum does NOT flow into a string', () => {
    expect(compat(z.enum({ Low: 1, High: 2 } as never), z.string())).toBe(false);
    expect(compat(z.literal(1), z.string())).toBe(false);
    expect(compat(z.literal(1), z.number())).toBe(true); // literal number → number ok
  });

  it('enum / literal of strings into a refined string rejects; into a plain string ok', () => {
    expect(compat(z.literal('x'), z.string().min(5))).toBe(false); // 'x' too short, and string refined → reject
    expect(compat(z.enum(['a', 'b']), z.string())).toBe(true);
    expect(compat(z.enum(['a', 'b']), z.union([z.email(), z.number()]))).toBe(false); // no sound member
  });

  it('record/map/set are conservatively rejected (no structural capture yet)', () => {
    expect(compat(z.record(z.string(), z.number()), z.record(z.string(), z.number()))).toBe(false);
  });
});
