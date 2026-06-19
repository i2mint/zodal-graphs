/**
 * Port type references and the connect-time type-compatibility rule.
 *
 * `portTypeCompatible` is one of only two genuinely-new modules in zodal-graphs: no graph
 * serialization format and no library defines connect-time *type validity* for a wire (formats
 * carry *which* port an edge binds to via `targetPort`; deciding *whether* the connection is
 * type-valid is unsolved prior art). The facade generates this predicate from the ports' Zod types
 * and feeds it to a renderer's `isValidConnection` hook.
 *
 * **Semantics: covariant subtyping.** `portTypeCompatible(out, into)` is true iff every value `out`
 * can produce is acceptable to `into` — i.e. `out`'s value-set ⊆ `into`'s. It never *silently
 * permits* an invalid wire: when a type can't be introspected it is rejected, not waved through.
 * Beyond the wildcard / optional / nullable / union basics it now does structural subtyping:
 * numeric-refinement range containment, object width+depth subtyping, array element covariance,
 * tuple elementwise covariance, and enum/literal value-set subset (incl. enum → its primitive base).
 * String length refinements and refinement *inclusivity* nuance remain deferred (treated as
 * unconstrained).
 */

import type { ZodType } from 'zod';
import { getEnumValues, getNumericBounds, getZodBaseType } from '@zodal/core';

export interface NumericConstraints {
  min?: number;
  max?: number;
}

/** A structural descriptor of a port's type, derived from a Zod schema (or authored directly). */
export interface PortTypeRef {
  /** Zod base type name, e.g. `'number' | 'string' | 'object' | 'array' | 'enum' | 'union'`. */
  base: string;
  /** `true` for `unknown` / `any` — accepts and is accepted by anything. */
  wildcard?: boolean;
  optional?: boolean;
  nullable?: boolean;
  /** Member types when `base === 'union'`. */
  options?: PortTypeRef[];
  /** Numeric refinement bounds (number/int/float/bigint). */
  numeric?: NumericConstraints;
  /** Element type when `base === 'array'`. */
  element?: PortTypeRef;
  /** Element types when `base === 'tuple'`. */
  tuple?: PortTypeRef[];
  /** Field types when `base === 'object'`. */
  shape?: Record<string, PortTypeRef>;
  /** Optional field names (object). */
  optionalKeys?: string[];
  /** Allowed values (enum / literal). */
  values?: readonly unknown[];
  /** The primitive base of `values` (e.g. an enum of strings has `valueBase: 'string'`). */
  valueBase?: string;
}

const WILDCARD_BASES = new Set(['unknown', 'any']);

/** Bases whose token alone fully determines compatibility (no inner shape to compare). */
const SCALAR_BASES = new Set(['string', 'boolean', 'date', 'symbol', 'null', 'undefined', 'nan', 'void']);
const NUMERIC_BASES = new Set(['number', 'int', 'float', 'bigint']);
const VALUE_SET_BASES = new Set(['enum', 'literal']);

/** Sentinel base for an un-introspectable schema — compatible only with a wildcard, never permissive. */
const UNRESOLVED = '__unresolved__';

// === derivation ===========================================================

/** Derive a {@link PortTypeRef} from a Zod schema; an unreadable schema yields a conservative sentinel. */
export function portTypeRefFromZod(schema: ZodType): PortTypeRef {
  try {
    const def = readDef(schema);
    const raw = rawTypeName(def);

    if (raw === 'optional') return { ...portTypeRefFromZodInner(def?.innerType), optional: true };
    if (raw === 'nullable') return { ...portTypeRefFromZodInner(def?.innerType), nullable: true };
    if (raw === 'default' || raw === 'prefault') return portTypeRefFromZodInner(def?.innerType);
    if (raw === 'union' && Array.isArray(def?.options)) {
      return { base: 'union', options: (def.options as ZodType[]).map((o) => portTypeRefFromZod(o)) };
    }

    const ref: PortTypeRef = { base: resolveBase(schema, raw) };
    if (WILDCARD_BASES.has(raw)) ref.wildcard = true;
    captureStructure(ref, schema, def);
    return ref;
  } catch {
    return { base: UNRESOLVED };
  }
}

/** Best-effort capture of refinement / shape detail; a capture failure leaves the bare base. */
function captureStructure(ref: PortTypeRef, schema: ZodType, def: ZodDef): void {
  try {
    if (NUMERIC_BASES.has(ref.base)) {
      const bounds = safeNumericBounds(schema);
      if (bounds && (bounds.min !== undefined || bounds.max !== undefined)) ref.numeric = bounds;
      return;
    }
    if (ref.base === 'array') {
      const element = def.element;
      if (isSchema(element)) ref.element = portTypeRefFromZod(element);
      return;
    }
    if (ref.base === 'tuple') {
      if (Array.isArray(def.items)) ref.tuple = def.items.map((it) => portTypeRefFromZod(it as ZodType));
      return;
    }
    if (ref.base === 'object') {
      const shape = def.shape;
      if (shape && typeof shape === 'object') {
        ref.shape = {};
        ref.optionalKeys = [];
        for (const [key, value] of Object.entries(shape)) {
          if (!isSchema(value)) continue;
          const fieldRef = portTypeRefFromZod(value);
          ref.shape[key] = fieldRef;
          if (fieldRef.optional) ref.optionalKeys.push(key);
        }
      }
      return;
    }
    if (ref.base === 'enum') {
      const values = safeEnumValues(schema);
      if (values) {
        ref.values = values;
        ref.valueBase = 'string';
      }
      return;
    }
    if (ref.base === 'literal') {
      const values = readLiteralValues(def);
      if (values && values.length > 0) {
        ref.values = values;
        ref.valueBase = typeof values[0];
      }
    }
  } catch {
    /* leave the bare base — still a usable, conservative ref */
  }
}

// === compatibility ========================================================

/**
 * Covariant connect-time compatibility: can a value leaving `out` legally flow into `into`?
 *
 *  1. either side is a wildcard                              → compatible
 *  2. `out` may be `undefined`/`null` and `into` is not      → INcompatible (would leak)
 *  3. unions resolve covariantly                             → every source alt fits some target alt
 *  4. value-set on both sides (enum/literal)                 → `out`'s values ⊆ `into`'s
 *  5. value-set `out` into its primitive base                → ok (checking numeric bounds if any)
 *  6. same base → structural subtyping (numeric range / object shape / array element / tuple)
 *  7. otherwise                                              → INcompatible
 */
export function portTypeCompatible(out: PortTypeRef, into: PortTypeRef): boolean {
  if (out.wildcard || into.wildcard) return true;
  if (out.optional && !into.optional) return false;
  if (out.nullable && !into.nullable) return false;

  const o = stripFlags(out);
  const i = stripFlags(into);

  const oUnion = o.options && o.options.length > 0;
  const iUnion = i.options && i.options.length > 0;
  if (oUnion && iUnion) return o.options!.every((a) => i.options!.some((b) => portTypeCompatible(a, b)));
  if (iUnion) return i.options!.some((opt) => portTypeCompatible(o, opt));
  if (oUnion) return o.options!.every((opt) => portTypeCompatible(opt, i));

  const oValueSet = VALUE_SET_BASES.has(o.base);
  const iValueSet = VALUE_SET_BASES.has(i.base);
  if (oValueSet && iValueSet) return valueSetSubset(o, i);
  if (oValueSet && o.valueBase === i.base) return valueSetToPrimitive(o, i);

  if (o.base !== i.base) return false;

  if (NUMERIC_BASES.has(o.base)) return numericSubset(o.numeric, i.numeric);
  if (o.base === 'object') return objectSubset(o, i);
  if (o.base === 'array') return arraySubset(o, i);
  if (o.base === 'tuple') return tupleSubset(o, i);
  return SCALAR_BASES.has(o.base); // string/boolean/date/… — base match suffices (length refinements deferred)
}

/** out's numeric range ⊆ into's (into looser-or-equal). Unconstrained into accepts anything. */
function numericSubset(out: NumericConstraints | undefined, into: NumericConstraints | undefined): boolean {
  if (!into) return true;
  const outMin = out?.min ?? -Infinity;
  const outMax = out?.max ?? Infinity;
  const intoMin = into.min ?? -Infinity;
  const intoMax = into.max ?? Infinity;
  return intoMin <= outMin && outMax <= intoMax;
}

/** out ⊆ into structurally: out provides every required into field (covariantly); extra out fields ok. */
function objectSubset(out: PortTypeRef, into: PortTypeRef): boolean {
  if (!into.shape) return false; // base 'object' but target shape unreadable → conservative
  if (!out.shape) return false;
  for (const key of Object.keys(into.shape)) {
    const intoField = into.shape[key];
    const outField = out.shape[key];
    if (outField === undefined) {
      if (into.optionalKeys?.includes(key)) continue;
      return false;
    }
    if (!portTypeCompatible(outField, intoField)) return false;
  }
  return true;
}

/** Array element covariance; conservative when either element type is unknown. */
function arraySubset(out: PortTypeRef, into: PortTypeRef): boolean {
  if (!into.element || !out.element) return false;
  return portTypeCompatible(out.element, into.element);
}

/** Tuple elementwise covariance (same arity). */
function tupleSubset(out: PortTypeRef, into: PortTypeRef): boolean {
  if (!into.tuple || !out.tuple || out.tuple.length !== into.tuple.length) return false;
  return into.tuple.every((it, idx) => portTypeCompatible(out.tuple![idx], it));
}

/** out's allowed values ⊆ into's. */
function valueSetSubset(out: PortTypeRef, into: PortTypeRef): boolean {
  if (!into.values || !out.values) return false;
  const allowed = new Set(into.values);
  return out.values.every((v) => allowed.has(v));
}

/** An enum/literal flowing into its underlying primitive base (checking numeric bounds, if any). */
function valueSetToPrimitive(out: PortTypeRef, into: PortTypeRef): boolean {
  if (NUMERIC_BASES.has(into.base) && into.numeric) {
    if (!out.values) return false;
    return out.values.every((v) => typeof v === 'number' && numericValueInRange(v, into.numeric!));
  }
  return true; // unrefined primitive target (string length deferred)
}

function numericValueInRange(value: number, c: NumericConstraints): boolean {
  return (c.min === undefined || value >= c.min) && (c.max === undefined || value <= c.max);
}

function stripFlags(ref: PortTypeRef): PortTypeRef {
  if (!ref.optional && !ref.nullable) return ref;
  return { ...ref, optional: false, nullable: false };
}

// === zod introspection helpers ============================================

interface ZodDef {
  type?: string;
  typeName?: string;
  innerType?: unknown;
  options?: unknown;
  element?: unknown;
  items?: unknown;
  shape?: Record<string, unknown>;
  values?: unknown;
  value?: unknown;
}

function readDef(schema: unknown): ZodDef {
  const s = schema as { _zod?: { def?: ZodDef }; _def?: ZodDef };
  return s?._zod?.def ?? s?._def ?? {};
}

function rawTypeName(def: ZodDef): string {
  const t = def?.type ?? def?.typeName;
  return typeof t === 'string' ? t.replace(/^Zod/, '').toLowerCase() : '';
}

function portTypeRefFromZodInner(inner: unknown): PortTypeRef {
  if (isSchema(inner)) return portTypeRefFromZod(inner);
  return { base: UNRESOLVED };
}

function resolveBase(schema: ZodType, raw: string): string {
  const core = coreBaseType(schema);
  if (core && core !== 'unknown') return core;
  if (raw) return raw;
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

function safeNumericBounds(schema: ZodType): NumericConstraints | undefined {
  try {
    const b = getNumericBounds(schema);
    return b && typeof b === 'object' ? b : undefined;
  } catch {
    return undefined;
  }
}

function safeEnumValues(schema: ZodType): string[] | undefined {
  try {
    const v = getEnumValues(schema);
    return Array.isArray(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

function readLiteralValues(def: ZodDef): unknown[] | undefined {
  const v = def.values ?? def.value;
  if (v === undefined) return undefined;
  if (v instanceof Set) return [...v];
  if (Array.isArray(v)) return v;
  return [v];
}

function isSchema(value: unknown): value is ZodType {
  return typeof value === 'object' && value !== null && ('_zod' in value || '_def' in value);
}
