/**
 * Tests for the P1 connection-validation seam — fully headless (no React). This is the load-bearing
 * logic: it must reject type-incompatible and unknown-port wires, allow valid ones, and degrade to
 * permissive when the graph doesn't ask for validation.
 */

import { describe, it, expect } from 'vitest';
import { resolveGraphCapabilities } from '@zodal/graph-core';
import { makeIsValidConnection, lookupPort, type Connection } from '../src/is-valid-connection.js';
import { portGraph } from './fixtures.js';

const typed = resolveGraphCapabilities({ typedPorts: true, validatesConnections: true });
const conn = (
  source: string | null,
  sourceHandle: string | null,
  target: string | null,
  targetHandle: string | null,
): Connection => ({ source, sourceHandle, target, targetHandle });

describe('makeIsValidConnection (typed ports + validation)', () => {
  const valid = makeIsValidConnection(portGraph(), typed);

  it('allows a number → number connection', () => {
    expect(valid(conn('f1', 'out', 'f2', 'x'))).toBe(true);
  });

  it('rejects a number → string connection', () => {
    expect(valid(conn('f1', 'out', 'f2', 'y'))).toBe(false);
  });

  it('rejects a connection to an unknown node or port', () => {
    expect(valid(conn('f1', 'out', 'f2', 'nope'))).toBe(false);
    expect(valid(conn('f1', 'out', 'nope', 'x'))).toBe(false);
    expect(valid(conn('f1', 'wrong', 'f2', 'x'))).toBe(false);
  });

  it('rejects when source or target is null', () => {
    expect(valid(conn(null, 'out', 'f2', 'x'))).toBe(false);
    expect(valid(conn('f1', 'out', null, 'x'))).toBe(false);
  });

  it('is permissive when a port carries no declared type', () => {
    expect(valid(conn('f1', 'out', 'f3', 'in'))).toBe(true); // f3.in has no type
  });

  it('uses the sole port of a direction when the handle is null (unambiguous)', () => {
    expect(valid(conn('f1', null, 'f3', null))).toBe(true);
  });

  it('rejects a null handle when the direction is ambiguous', () => {
    expect(valid(conn('f1', 'out', 'f2', null))).toBe(false); // f2 has two in-ports
  });

  it('honours a custom port-compatibility function', () => {
    const always = makeIsValidConnection(portGraph(), typed, () => true);
    expect(always(conn('f1', 'out', 'f2', 'y'))).toBe(true); // custom fn permits the string target
    const never = makeIsValidConnection(portGraph(), typed, () => false);
    expect(never(conn('f1', 'out', 'f2', 'x'))).toBe(false);
  });
});

describe('makeIsValidConnection (validation off ⇒ always valid)', () => {
  it('allows everything when typedPorts is false', () => {
    const caps = resolveGraphCapabilities({ typedPorts: false, validatesConnections: false });
    const valid = makeIsValidConnection(portGraph(), caps);
    expect(valid(conn('f1', 'out', 'f2', 'y'))).toBe(true); // would be invalid if validated
  });

  it('allows everything when validatesConnections is false even with typedPorts', () => {
    const caps = resolveGraphCapabilities({ typedPorts: true, validatesConnections: false });
    const valid = makeIsValidConnection(portGraph(), caps);
    expect(valid(conn('f1', 'out', 'f2', 'y'))).toBe(true);
  });
});

describe('lookupPort', () => {
  const g = portGraph();
  const f1 = g.nodes.find((n) => n.id === 'f1');
  const f2 = g.nodes.find((n) => n.id === 'f2');

  it('finds a port by name + direction', () => {
    expect(lookupPort(f2, 'x', 'in')?.port).toBe('x');
    expect(lookupPort(f2, 'out', 'out')?.port).toBe('out');
  });

  it('returns undefined for the wrong direction or an unknown node', () => {
    expect(lookupPort(f2, 'x', 'out')).toBeUndefined();
    expect(lookupPort(undefined, 'x', 'in')).toBeUndefined();
  });

  it('falls back to the sole port of a direction when the handle is null', () => {
    expect(lookupPort(f1, null, 'out')?.port).toBe('out');
  });

  it('returns undefined for an ambiguous null handle', () => {
    expect(lookupPort(f2, null, 'in')).toBeUndefined(); // x and y are both inputs
  });
});
