/**
 * Priority bands for renderer testers — named tiers instead of magic numbers (mirrors zodal's
 * `@zodal/ui`). A tester returns a band (optionally summed with bonuses); the registry picks the
 * highest-scoring renderer. Specialization outranks generics because a more specific tester
 * returns a higher band.
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
  /** A hard override that should win unless ineligible. */
  OVERRIDE: 200,
} as const;

export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

/** A tester returns this to opt OUT entirely (the renderer cannot render the graph at all). */
export const INELIGIBLE = -1;
