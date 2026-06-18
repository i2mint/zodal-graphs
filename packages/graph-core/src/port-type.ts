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
 * Derive a {@link PortTypeRef} from a Zod schema, reusing `@zodal/core`'s `getZodBaseType` so
 * the facade has one source of truth for "what is this Zod type". Fully guarded: any
 * introspection failure degrades to a permissive wildcard rather than throwing — a model
 * author should never get a crash from an exotic schema.
 */
export function portTypeRefFromZod(schema: ZodType): PortTypeRef {
  try {
    const def = readDef(schema);
    // Detect wrappers from the RAW def — never via getZodBaseType, which may itself unwrap
    // optional/nullable/default and would hide the flag we need to record.
    const wrapper = rawTypeName(def);

    if (wrapper === 'optional') {
      return { ...portTypeRefFromZodInner(def?.innerType), optional: true };
    }
    if (wrapper === 'nullable') {
      return { ...portTypeRefFromZodInner(def?.innerType), nullable: true };
    }
    if (wrapper === 'default' || wrapper === 'prefault') {
      return portTypeRefFromZodInner(def?.innerType);
    }

    const base = safeBaseType(schema, def);
    const ref: PortTypeRef = { base };
    if (WILDCARD_BASES.has(base)) ref.wildcard = true;
    if (base === 'union' && Array.isArray(def?.options)) {
      ref.options = (def.options as ZodType[]).map((o) => portTypeRefFromZod(o));
    }
    return ref;
  } catch {
    return { base: 'unknown', wildcard: true };
  }
}

/** The outer Zod type name straight from the def (no unwrapping), normalized. */
function rawTypeName(def: ZodDef): string {
  const t = def?.type ?? def?.typeName;
  return typeof t === 'string' ? t.replace(/^Zod/, '').toLowerCase() : '';
}

function portTypeRefFromZodInner(inner: unknown): PortTypeRef {
  if (inner && typeof inner === 'object') return portTypeRefFromZod(inner as ZodType);
  return { base: 'unknown', wildcard: true };
}

/** Read the base type, preferring @zodal/core; fall back to probing the def. */
function safeBaseType(schema: ZodType, def: ZodDef): string {
  try {
    const t = getZodBaseType(schema);
    if (typeof t === 'string' && t.length > 0) return t;
  } catch {
    /* fall through */
  }
  const t = def?.type ?? def?.typeName;
  return typeof t === 'string' ? t.replace(/^Zod/, '').toLowerCase() : 'unknown';
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
 * Rules (conservative — unknown ⇒ `false`):
 *  - either side is a wildcard (`unknown`/`any`)              → compatible
 *  - `out` may be undefined (optional) but `into` is not     → INcompatible
 *  - `into` is a union                                       → compatible iff `out` fits any member
 *  - `out` is a union                                        → compatible iff every member fits `into`
 *  - `into` is optional/nullable                             → widen (accepts its base type)
 *  - exact base-type match                                   → compatible
 *  - otherwise                                               → INcompatible
 */
export function portTypeCompatible(out: PortTypeRef, into: PortTypeRef): boolean {
  if (out.wildcard || into.wildcard) return true;

  // An optional source could be `undefined`; a non-optional target cannot accept that.
  if (out.optional && !into.optional) return false;

  if (into.options && into.options.length > 0) {
    return into.options.some((opt) => portTypeCompatible(stripFlags(out), opt));
  }
  if (out.options && out.options.length > 0) {
    const intoBaseRef = stripFlags(into);
    return out.options.every((opt) => portTypeCompatible(opt, intoBaseRef));
  }
  return out.base === into.base;
}

function stripFlags(ref: PortTypeRef): PortTypeRef {
  return { ...ref, optional: false, nullable: false };
}
