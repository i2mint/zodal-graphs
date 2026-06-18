/**
 * Priority bands for renderer testers — named tiers instead of magic numbers (mirrors zodal's
 * `@zodal/ui`).
 *
 * Scores are **additive weights**, not exclusive tiers: a tester's `base` band plus its matching
 * bonus bands sum, so a specialized renderer (e.g. typed-ports + editing) intentionally outscores
 * a generic one — the same compounding `and()` does in zodal. The one hard guarantee is that
 * **`OVERRIDE` always wins unless ineligible**: it is spaced far above any realistic accumulation
 * of `base + bonuses`, so no stack of `DEFAULT`/`LIBRARY`/`APP` weights can reach it. Keep a single
 * tester's bonus sum well below the gap to the next band you don't want it to cross.
 */

export const PRIORITY = {
  /** A last-resort renderer (e.g. the table fallback) that can always render *something*. */
  FALLBACK: 1,
  /** A generic renderer with no special affinity for the graph. */
  DEFAULT: 10,
  /** A renderer specialized for a declared capability (typed ports, large scale, …). */
  LIBRARY: 50,
  /** An application-level preference (e.g. the user explicitly asked for this view). */
  APP: 100,
  /** A hard override — spaced far above any base+bonus accumulation so it always wins unless ineligible. */
  OVERRIDE: 100_000,
} as const;

export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

/** A tester returns this (or any value ≤ it) to opt OUT entirely — the renderer cannot render the graph. */
export const INELIGIBLE = -1;
