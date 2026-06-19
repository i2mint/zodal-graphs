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
 * Beyond the wildcard / optional / nullable / union basics it does structural subtyping:
 * numeric-refinement range containment, integer-vs-float, object width+depth subtyping, array element
 * covariance, tuple elementwise covariance, and enum/literal value-set subset (incl. enum → its
 * primitive base, with the value-set's true element type). Any UNMODELED constraint on the *target*
 * (a refined string — email/min-length/regex; a numeric `multipleOf`/`.refine`) forces rejection
 * rather than a silent permit — over-rejection is conservative, a false permit is not. Still
 * conservatively rejected (no structural capture yet): `record` / `map` / `set` containers, and the
 * exact params of string refinements (so even identical refined-string ports won't auto-connect).
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
  /** The primitive base of `values`; `'__mixed__'` for a heterogeneous value-set (matches no base). */
  valueBase?: string;
  /** Integer-constrained number (`z.int()` / `z.number().int()` — int-ness lives in a format check). */
  integer?: boolean;
  /** Carries an UNMODELED constraint (string refinement, numeric `.refine()`/`multipleOf`, …). As a
   *  TARGET this forces rejection — we can't prove a source's value-set ⊆ an unmodeled constraint. */
  constrained?: boolean;
}

const WILDCARD_BASES = new Set(['unknown', 'any']);

/** Bases whose token alone fully determines compatibility (no inner shape to compare). */
const SCALAR_BASES = new Set(['string', 'boolean', 'date', 'symbol', 'null', 'undefined', 'nan', 'void']);
// zod v4 collapses `z.int()`/`.int()` to base `number` (int-ness is a format check, captured as
// `ref.integer`); `int`/`float` are kept for forward-safety but no current schema resolves to them.
const NUMERIC_BASES = new Set(['number', 'int', 'float', 'bigint']);
const VALUE_SET_BASES = new Set(['enum', 'literal']);
/** A heterogeneous enum/literal value-set — matches no primitive base, so only value-set identity can permit. */
const MIXED_VALUE_BASE = '__mixed__';

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
      captureNumericChecks(ref, def); // int-ness + opaque refinements (multipleOf / .refine)
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
      if (values && values.length > 0) {
        ref.values = values;
        ref.valueBase = deriveValueBase(values);
      }
      return;
    }
    if (ref.base === 'literal') {
      const values = readLiteralValues(def);
      if (values && values.length > 0) {
        ref.values = values;
        ref.valueBase = deriveValueBase(values);
      }
      return;
    }
    // Other scalars (string/boolean/date/…): any check is an UNMODELED constraint (email, min length,
    // regex, .refine) — record it so a refined target rejects rather than silently permitting.
    if (SCALAR_BASES.has(ref.base) && readCheckSources(def).length > 0) ref.constrained = true;
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

  if (NUMERIC_BASES.has(o.base)) {
    if (i.integer && !o.integer) return false; // float source into an int-only target — would leak non-integers
    if (i.constrained) return false; // opaque numeric refinement on the target (multipleOf / .refine) — can't prove
    return numericSubset(o.numeric, i.numeric);
  }
  if (o.base === 'object') return objectSubset(o, i);
  if (o.base === 'array') return arraySubset(o, i);
  if (o.base === 'tuple') return tupleSubset(o, i);
  // string/boolean/date/…: base match suffices ONLY if the target carries no unmodeled refinement
  // (a refined string target — email/min-length/regex — must reject, never silently permit).
  return SCALAR_BASES.has(o.base) && !i.constrained;
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

/** An enum/literal flowing into its underlying primitive base (checking numeric bounds / int, if any). */
function valueSetToPrimitive(out: PortTypeRef, into: PortTypeRef): boolean {
  if (into.constrained) return false; // refined primitive target (e.g. string.min) — can't prove values satisfy it
  if (NUMERIC_BASES.has(into.base)) {
    if (!out.values) return false;
    return out.values.every(
      (v) =>
        typeof v === 'number' &&
        Number.isFinite(v) &&
        (!into.integer || Number.isInteger(v)) &&
        (!into.numeric || numericValueInRange(v, into.numeric)),
    );
  }
  return true; // unrefined primitive target
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
  checks?: unknown;
  check?: unknown;
  format?: unknown;
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

/** Finite numeric bounds only — `getNumericBounds` returns ±Infinity for an unbounded side; drop those
 *  so `ref.numeric` is set ONLY when a real finite refinement exists (absent === unconstrained). */
function safeNumericBounds(schema: ZodType): NumericConstraints | undefined {
  try {
    const b = getNumericBounds(schema);
    if (!b || typeof b !== 'object') return undefined;
    const out: NumericConstraints = {};
    if (Number.isFinite(b.min)) out.min = b.min as number;
    if (Number.isFinite(b.max)) out.max = b.max as number;
    return out;
  } catch {
    return undefined;
  }
}

/** Detect int-ness (a format check) and opaque numeric refinements (multipleOf / `.refine`) from def checks. */
function captureNumericChecks(ref: PortTypeRef, def: ZodDef): void {
  for (const check of readCheckSources(def)) {
    const kind = checkKind(check);
    const format = checkFormat(check);
    if (/int/i.test(format) || /int/i.test(kind)) {
      ref.integer = true;
    } else if (kind === 'custom' || kind === 'multiple_of' || kind === 'number_format') {
      ref.constrained = true; // an unmodeled constraint beyond min/max — reject as a target
    }
  }
}

/** All values share a typeof → that primitive; otherwise the no-match {@link MIXED_VALUE_BASE} sentinel. */
function deriveValueBase(values: readonly unknown[]): string {
  const first = typeof values[0];
  return values.every((v) => typeof v === first) ? first : MIXED_VALUE_BASE;
}

function readChecks(def: ZodDef): unknown[] {
  return Array.isArray(def.checks) ? def.checks : [];
}

/** Check descriptors: the `def.checks` array PLUS the def itself when a zod v4 format type
 *  (`z.email`/`z.uuid`/`z.int`) carries its check/format directly on the def (no checks array). */
function readCheckSources(def: ZodDef): unknown[] {
  const sources = readChecks(def);
  if (def.check !== undefined || def.format !== undefined) return [...sources, def];
  return sources;
}

function checkKind(check: unknown): string {
  const c = check as { _zod?: { def?: { check?: string } }; def?: { check?: string }; check?: string; kind?: string };
  return c?._zod?.def?.check ?? c?.def?.check ?? c?.check ?? c?.kind ?? '';
}

function checkFormat(check: unknown): string {
  const c = check as { _zod?: { def?: { format?: string } }; def?: { format?: string }; format?: string };
  return c?._zod?.def?.format ?? c?.def?.format ?? c?.format ?? '';
}

function safeEnumValues(schema: ZodType): unknown[] | undefined {
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
