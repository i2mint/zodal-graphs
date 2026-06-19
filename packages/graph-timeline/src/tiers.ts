/**
 * ELAN-style tiers and their stereotype constraints.
 *
 * Annotations live on tiers; a tier may be linked to a parent tier with one of five ELAN
 * stereotypes. The interval constraints validated here (using the instant-correct `within` /
 * `disjoint` predicates, NOT the proper-interval Allen relation sets):
 *  - `included-in` / `time-subdivision`: each child annotation must lie WITHIN a parent annotation;
 *  - `time-subdivision`: child annotations on the tier must additionally be DISJOINT.
 *
 * Deferred / not time-validated: `time-subdivision` *coverage* (ELAN requires children to partition
 * the parent with no GAPS — only containment + disjointness are checked here); `symbolic-subdivision`
 * and `symbolic-association` carry no independent interval, so no interval constraint is applied;
 * `none` is independent.
 */

import type { Interval } from './interval.js';
import { within, disjoint } from './interval.js';

export type TierStereotype =
  | 'none'
  | 'time-subdivision'
  | 'included-in'
  | 'symbolic-subdivision'
  | 'symbolic-association';

export const TIER_STEREOTYPES: readonly TierStereotype[] = [
  'none',
  'time-subdivision',
  'included-in',
  'symbolic-subdivision',
  'symbolic-association',
];

export interface Tier {
  id: string;
  stereotype: TierStereotype;
  /** Parent tier id (for the subdivision / inclusion / association stereotypes). */
  parent?: string;
}

export interface Annotation {
  id: string;
  tier: string;
  interval: Interval;
  value?: unknown;
}

export interface TierViolation {
  annotation: string;
  reason: string;
}

/** Group annotations by their tier id. */
export function groupByTier(annotations: readonly Annotation[]): Map<string, Annotation[]> {
  const map = new Map<string, Annotation[]>();
  for (const annotation of annotations) {
    const list = map.get(annotation.tier);
    if (list) list.push(annotation);
    else map.set(annotation.tier, [annotation]);
  }
  return map;
}

/**
 * Validate the annotations on `tier` against its stereotype, given the parent tier's annotations.
 * Returns the violations (empty = valid).
 */
export function validateTier(
  tier: Tier,
  annotations: readonly Annotation[],
  parentAnnotations: readonly Annotation[] = [],
): TierViolation[] {
  const violations: TierViolation[] = [];
  const needsContainment = tier.stereotype === 'included-in' || tier.stereotype === 'time-subdivision';
  const needsDisjoint = tier.stereotype === 'time-subdivision'; // symbolic tiers carry no real interval

  if (needsContainment) {
    for (const child of annotations) {
      const contained = parentAnnotations.some((p) => within(child.interval, p.interval));
      if (!contained) {
        violations.push({ annotation: child.id, reason: `not contained within any parent annotation on "${tier.parent ?? '?'}"` });
      }
    }
  }

  if (needsDisjoint) {
    for (let i = 0; i < annotations.length; i++) {
      for (let j = i + 1; j < annotations.length; j++) {
        if (!disjoint(annotations[i].interval, annotations[j].interval)) {
          violations.push({ annotation: annotations[j].id, reason: `overlaps "${annotations[i].id}" on a subdivision tier` });
        }
      }
    }
  }

  return violations;
}

/** Validate every tier in a model. Returns `tierId → violations` (only tiers with violations). */
export function validateTiers(
  tiers: readonly Tier[],
  annotations: readonly Annotation[],
): Map<string, TierViolation[]> {
  const byTier = groupByTier(annotations);
  const result = new Map<string, TierViolation[]>();
  for (const tier of tiers) {
    const own = byTier.get(tier.id) ?? [];
    const parent = tier.parent ? (byTier.get(tier.parent) ?? []) : [];
    const violations = validateTier(tier, own, parent);
    if (violations.length > 0) result.set(tier.id, violations);
  }
  return result;
}
