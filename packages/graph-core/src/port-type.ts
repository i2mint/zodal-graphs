/**
 * Port type references and the connect-time type-compatibility rule.
 *
 * `portTypeCompatible` is one of only two genuinely-new modules in zodal-graphs: no graph
 * serialization format and no library defines connect-time *type validity* for a wire
 * (formats carry *which* port an edge binds to via `targetPort`; deciding *whether* the
 * connection is type-valid is unsolved prior art). The facade generates this predicate from
 * the ports' Zod types and feeds it to a renderer's `isValidConnection` hook.
 *
 * **This is v0 — deliberately conservative** (exact base-type match + wildcard + a few safe
 * wideners). It must never *silently permit* an invalid wire, so when in doubt it returns
 * `false`. Widen toward covariance / refinement-aware / full structural subtyping only when a
 * real case demands it (the executor decision makes this load-bearing: invalid wires become
 * runtime errors). See `docs/dev-plan.md` §8.
 */

import type { ZodType } from 'zod';
import { getZodBaseType } from '@zodal/core';

/**
 * A structural descriptor of a port's type, derived from a Zod schema (or authored directly
 * for non-Zod backends). Kept intentionally small for v0.
 */
export interface PortTypeRef {
  /** Zod base type name, e.g. `'number' | 'string' | 'boolean' | 'object' | 'array' | 'union'`. */
  base: string;
  /** `true` for `unknown` / `any` — accepts and is accepted by anything. */
  wildcard?: boolean;
  optional?: boolean;
  nullable?: boolean;
  /** Member types when `base === 'union'` (best-effort; may be absent). */
  options?: PortTypeRef[];
}

const WILDCARD_BASES = new Set(['unknown', 'any']);

/**
 * Bases whose *token alone* fully determines the type, so token equality is a sound
 * compatibility check. Composite bases (`object`, `array`, `tuple`, `record`, `map`, `set`,
 * `literal`, `enum`, …) are deliberately EXCLUDED: PortTypeRef does not yet capture their inner
 * shape/value, so two structurally-disjoint composites (`number[]` vs `string[]`) must NOT be
 * called compatible under v0's "when in doubt, reject" mandate.
 */
const SCALAR_BASES = new Set([
  'number',
  'string',
  'boolean',
  'bigint',
  'date',
  'null',
  'undefined',
  'symbol',
  'int',
  'float',
  'nan',
]);

/** Sentinel base for a schema whose type could not be introspected — compatible only with a
 *  wildcard, never silently permissive. Distinct from a genuine `unknown`/`any` wildcard. */
const UNRESOLVED = '__unresolved__';

/**
 * Derive a {@link PortTypeRef} from a Zod schema. Wrapper flags (optional/nullable/default) and
 * unions are read from the raw Zod `def` (reliable across zod v4); the leaf base type is read via
 * `@zodal/core`'s `getZodBaseType` (the facade's single source of truth), falling back to the raw
 * def and finally to a conservative {@link UNRESOLVED} sentinel. Fully guarded: an unreadable
 * schema yields a NON-wildcard sentinel — never an accept-anything wildcard.
 */
export function portTypeRefFromZod(schema: ZodType): PortTypeRef {
  try {
    const def = readDef(schema);
    // Wrappers & unions come from the RAW def — never via getZodBaseType, which may itself unwrap
    // optional/nullable/default (hiding the flag we must record) or return a generic fallback.
    const raw = rawTypeName(def);

    if (raw === 'optional') return { ...portTypeRefFromZodInner(def?.innerType), optional: true };
    if (raw === 'nullable') return { ...portTypeRefFromZodInner(def?.innerType), nullable: true };
    if (raw === 'default' || raw === 'prefault') return portTypeRefFromZodInner(def?.innerType);
    if (raw === 'union' && Array.isArray(def?.options)) {
      return { base: 'union', options: (def.options as ZodType[]).map((o) => portTypeRefFromZod(o)) };
    }

    const ref: PortTypeRef = { base: resolveBase(schema, raw) };
    // A genuine wildcard requires the REAL def type to say `unknown`/`any` — NOT a getZodBaseType
    // fallback (which returns 'unknown' for unreadable input and would wrongly accept any wire).
    if (WILDCARD_BASES.has(raw)) ref.wildcard = true;
    return ref;
  } catch {
    // Introspection failed — conservative non-wildcard sentinel, compatible only with itself / a wildcard.
    return { base: UNRESOLVED };
  }
}

/** The outer Zod type name straight from the def (no unwrapping), normalized. */
function rawTypeName(def: ZodDef): string {
  const t = def?.type ?? def?.typeName;
  return typeof t === 'string' ? t.replace(/^Zod/, '').toLowerCase() : '';
}

function portTypeRefFromZodInner(inner: unknown): PortTypeRef {
  if (inner && typeof inner === 'object') return portTypeRefFromZod(inner as ZodType);
  return { base: UNRESOLVED };
}

/** Leaf base: prefer @zodal/core's getZodBaseType; fall back to the raw def; else UNRESOLVED. */
function resolveBase(schema: ZodType, raw: string): string {
  const core = coreBaseType(schema);
  if (core && core !== 'unknown') return core; // a bare 'unknown' from core is a fallback, not trusted
  if (raw) return raw; // includes a genuine 'unknown' / 'any' (the wildcard flag is set by the caller)
  return UNRESOLVED;
}

function coreBaseType(schema: ZodType): string {
  try {
    const t = getZodBaseType(schema);
    return typeof t === 'string' ? t : '';
  } catch {
    return '';
  }
}

interface ZodDef {
  type?: string;
  typeName?: string;
  innerType?: unknown;
  options?: unknown;
}

function readDef(schema: unknown): ZodDef {
  const s = schema as { _zod?: { def?: ZodDef }; _def?: ZodDef };
  return s?._zod?.def ?? s?._def ?? {};
}

/**
 * v0 connect-time compatibility: can a value leaving `out` legally flow into `into`?
 *
 * Rules (conservative — "when in doubt, reject"):
 *  1. either side is a wildcard (`unknown`/`any`)            → compatible
 *  2. `out` may be `undefined` (optional) and `into` is not  → INcompatible  (undefined would leak)
 *  3. `out` may be `null` (nullable) and `into` is not       → INcompatible  (null would leak)
 *  4. both are unions                                        → every source member fits some target member
 *  5. only `into` is a union                                 → `out` fits some target member
 *  6. only `out` is a union                                  → every source member fits `into`
 *  7. same SCALAR base (number/string/…)                     → compatible
 *  8. otherwise (incl. composite bases & `unresolved`)       → INcompatible
 *
 * The optional/nullable leak guards (2,3) run BEFORE the union branches so they cannot be
 * bypassed by a union target, and union *members* keep their own flags so a nullable member is
 * re-checked on recursion.
 */
export function portTypeCompatible(out: PortTypeRef, into: PortTypeRef): boolean {
  if (out.wildcard || into.wildcard) return true;
  if (out.optional && !into.optional) return false;
  if (out.nullable && !into.nullable) return false;

  const o = stripFlags(out);
  const i = stripFlags(into);

  const oUnion = o.options && o.options.length > 0;
  const iUnion = i.options && i.options.length > 0;

  if (oUnion && iUnion) {
    return o.options!.every((a) => i.options!.some((b) => portTypeCompatible(a, b)));
  }
  if (iUnion) {
    return i.options!.some((opt) => portTypeCompatible(o, opt));
  }
  if (oUnion) {
    return o.options!.every((opt) => portTypeCompatible(opt, i));
  }

  // Bare token equality is sound ONLY for scalar bases; composite/unresolved bases need shape
  // info we don't yet carry, so they are conservatively rejected.
  return o.base === i.base && SCALAR_BASES.has(o.base);
}

/** Clear optional/nullable (already leak-checked) while keeping base / options / wildcard. */
function stripFlags(ref: PortTypeRef): PortTypeRef {
  if (!ref.optional && !ref.nullable) return ref;
  return { ...ref, optional: false, nullable: false };
}
