/**
 * Shared internal helpers for the pure adapters. Not part of the public API.
 */

/** Return a shallow copy of `obj` with all `undefined`-valued keys removed. */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}
