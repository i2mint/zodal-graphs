/**
 * Tests for the composable tester predicates and the `makeTester` factory.
 */

import { describe, it, expect } from 'vitest';
import { resolveGraphCapabilities } from '@zodal/graph-core';
import {
  makeTester,
  PRIORITY,
  INELIGIBLE,
  isTypedPortGraph,
  wantsEditing,
  scaleAtMost,
  scaleAtLeast,
  viewIs,
  viewRequested,
  supportsView,
  allOf,
  anyOf,
  not,
} from '../src/index.js';

const ports = resolveGraphCapabilities({ typedPorts: true, canEditNode: true });
const plain = resolveGraphCapabilities({});

describe('predicates', () => {
  it('isTypedPortGraph', () => {
    expect(isTypedPortGraph(ports, {})).toBe(true);
    expect(isTypedPortGraph(plain, {})).toBe(false);
  });

  it('wantsEditing honours intent over declared capability', () => {
    expect(wantsEditing(ports, {})).toBe(true); // canEditNode
    expect(wantsEditing(ports, { intent: 'view' })).toBe(false); // explicit view wins
    expect(wantsEditing(plain, { intent: 'edit' })).toBe(true); // explicit edit wins
  });

  it('scale predicates treat unknown nodeCount permissively for atMost, strictly for atLeast', () => {
    expect(scaleAtMost(2000)(plain, {})).toBe(true); // unknown ⇒ not disqualified
    expect(scaleAtMost(2000)(plain, { nodeCount: 5000 })).toBe(false);
    expect(scaleAtLeast(2000)(plain, {})).toBe(false); // unknown ⇒ not "at least"
    expect(scaleAtLeast(2000)(plain, { nodeCount: 5000 })).toBe(true);
  });

  it('viewIs is permissive (eligibility), viewRequested is strict (bonus)', () => {
    expect(viewIs('node-link')(plain, {})).toBe(true); // no view requested ⇒ eligible
    expect(viewIs('node-link')(plain, { view: 'table' })).toBe(false);
    expect(viewRequested('table')(plain, {})).toBe(false); // no view ⇒ no bonus
    expect(viewRequested('table')(plain, { view: 'table' })).toBe(true);
  });

  it('supportsView reads the declared view list', () => {
    const withTimeline = resolveGraphCapabilities({ views: ['node-link', 'timeline'] });
    expect(supportsView('timeline')(withTimeline, {})).toBe(true);
    expect(supportsView('matrix')(withTimeline, {})).toBe(false);
  });

  it('combinators allOf / anyOf / not', () => {
    expect(allOf(isTypedPortGraph, wantsEditing)(ports, {})).toBe(true);
    expect(allOf(isTypedPortGraph, scaleAtLeast(10))(ports, {})).toBe(false);
    expect(anyOf(isTypedPortGraph, scaleAtLeast(10))(ports, {})).toBe(true);
    expect(not(isTypedPortGraph)(plain, {})).toBe(true);
  });
});

describe('makeTester', () => {
  it('returns INELIGIBLE when the eligibility gate fails', () => {
    const t = makeTester({ eligible: scaleAtMost(100) });
    expect(t(plain, { nodeCount: 500 })).toBe(INELIGIBLE);
  });

  it('sums base + bonus bands for matching predicates', () => {
    const t = makeTester({
      base: PRIORITY.DEFAULT,
      bonuses: [
        [isTypedPortGraph, PRIORITY.LIBRARY],
        [wantsEditing, PRIORITY.LIBRARY],
      ],
    });
    expect(t(ports, {})).toBe(PRIORITY.DEFAULT + PRIORITY.LIBRARY + PRIORITY.LIBRARY);
    expect(t(plain, {})).toBe(PRIORITY.DEFAULT); // no bonuses apply
  });

  it('defaults base to DEFAULT when omitted', () => {
    expect(makeTester({})(plain, {})).toBe(PRIORITY.DEFAULT);
  });
});
