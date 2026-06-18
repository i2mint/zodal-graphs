/**
 * Tests for the P1 connection-validation seam — fully headless (no React). This is the load-bearing
 * logic: it must reject type-incompatible and unknown-port wires, allow valid ones, and degrade to
 * permissive when the graph doesn't ask for validation.
 */

import { describe, it, expect } from 'vitest';
import type { CanonicalGraph } from '@zodal/graph-core';
import { resolveGraphCapabilities, nodeId } from '@zodal/graph-core';
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
    const always = makeIsValidConnection(portGraph(), typed, { compatible: () => true });
    expect(always(conn('f1', 'out', 'f2', 'y'))).toBe(true); // custom fn permits the string target
    const never = makeIsValidConnection(portGraph(), typed, { compatible: () => false });
    expect(never(conn('f1', 'out', 'f2', 'x'))).toBe(false);
  });

  it('can reject untyped ports when allowUntypedPorts is false', () => {
    const strict = makeIsValidConnection(portGraph(), typed, { allowUntypedPorts: false });
    expect(strict(conn('f1', 'out', 'f3', 'in'))).toBe(false); // f3.in has no declared type
  });
});

describe('makeIsValidConnection — adversarial cases', () => {
  const valid = makeIsValidConnection(portGraph(), typed);

  it('rejects a self-connection (same-node dependency cycle)', () => {
    expect(valid(conn('f2', 'out', 'f2', 'x'))).toBe(false); // f2.out → f2.x
    expect(valid(conn('f1', null, 'f1', null))).toBe(false); // null/null self-loop
  });

  it('rejects out→out direction confusion (target handle names an out-port)', () => {
    expect(valid(conn('f1', 'out', 'f2', 'out'))).toBe(false); // f2.out is an OUT port, not an input
  });

  it('treats an Edge-shaped arg (extra fields) the same as a Connection', () => {
    const edgeLike = { id: 'e', data: {}, source: 'f1', sourceHandle: 'out', target: 'f2', targetHandle: 'x' };
    expect(valid(edgeLike)).toBe(true);
    expect(valid({ ...edgeLike, targetHandle: 'y' })).toBe(false); // number → string
  });

  it('rejects a connection to a zero-port node with a null handle', () => {
    const g: CanonicalGraph = {
      directed: true,
      multigraph: true,
      nodes: [
        { id: nodeId('src'), kind: 'func', ports: [{ port: 'out', direction: 'out', type: { base: 'number' } }] },
        { id: nodeId('bare'), kind: 'entity' }, // no ports
      ],
      edges: [],
      graph: {},
    };
    const v = makeIsValidConnection(g, typed);
    expect(v(conn('src', 'out', 'bare', null))).toBe(false);
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
