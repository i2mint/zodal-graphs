/**
 * Shared internal helpers for the pure adapters. Not part of the public API.
 */

/**
 * Return a copy of `obj` with all `undefined`-valued keys removed, **preserving the type**.
 * Unlike a `Partial<T>` return, this keeps `T` so call sites cannot silently drop a required
 * field and re-widen via a cast — a forgotten required key fails to type-check at the call.
 */
export function compact<T extends object>(obj: T): T {
  const out = {} as T;
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

/**
 * Deep-clone a value so adapters never alias the caller's mutable sub-objects (ports arrays,
 * data bags, graph meta). Uses `structuredClone` when available, falling back to a JSON
 * round-trip for older runtimes.
 */
export function deepClone<T>(value: T): T {
  if (value === undefined || value === null) return value;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
