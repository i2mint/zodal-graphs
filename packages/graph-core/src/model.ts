/**
 * Canonical graph data model — the keystone hub every zodal-graphs package consumes.
 *
 * This is the in-memory working model. It is a node-link superset (graphology- /
 * `nodes_and_links`-shaped) with two enrichments that flat node-link formats drop:
 *
 * 1. a bipartite node `kind` (`var` / `func` / `entity`), so meshed-style function/value
 *    graphs round-trip; and
 * 2. first-class typed/kinded `ports[]` on nodes plus `sourcePort` / `targetPort` on edges,
 *    so a connection can bind to a *specific named input port* (the meshed gold standard).
 *
 * Three layers stay physically separate (see `presentation.ts` and `capabilities.ts`):
 * topology (this file) · schema + affordances (Zod + capabilities) · presentation
 * (overlays / styling / selection / layout). Renderer formats that fuse position/selection
 * into topology must strip it back out into the presentation layer on the way in.
 */

// ===========================================================================
// Branded ids — distinct string types so a node id can't be passed where an
// edge id is expected. Construct via the helpers; they are plain strings at runtime.
// ===========================================================================

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type NodeId = Brand<string, 'NodeId'>;
export type PortId = Brand<string, 'PortId'>;
export type EdgeId = Brand<string, 'EdgeId'>;

/** Smart constructors — validate non-empty so a malformed wire id fails loudly at the boundary
 *  rather than silently producing a dangling reference. (They are the only way to brand an id.) */
export const nodeId = (id: string): NodeId => brandId('nodeId', id) as NodeId;
export const portId = (id: string): PortId => brandId('portId', id) as PortId;
export const edgeId = (id: string): EdgeId => brandId('edgeId', id) as EdgeId;

function brandId(kind: string, id: string): string {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`${kind}: id must be a non-empty string (got ${JSON.stringify(id)})`);
  }
  return id;
}

// ===========================================================================
// Node / port / edge shapes
// ===========================================================================

/** Bipartite discriminator. `entity` is the common portless case; `func`/`var` model
 *  meshed-style computation graphs (functions and the named values that flow between them). */
export type NodeKind = 'var' | 'func' | 'entity';

export type PortDirection = 'in' | 'out';

/** Mirrors a Python `inspect.Parameter.kind` (the meshed `Sig` parameter classes). */
export type PortKind =
  | 'positional_only'
  | 'positional_or_keyword'
  | 'keyword_only'
  | 'var_positional'
  | 'var_keyword';

/**
 * One typed, kinded port on a node — mirrors one meshed `Sig` parameter (for `in` ports)
 * or the node's output (for `out` ports). `port` is unique within its node and equals the
 * meshed `bind` value; it becomes the renderer handle id so `targetHandle === targetPort`.
 */
export interface GraphPort {
  /** External port name, unique within the node. = meshed bind value / renderer handle id. */
  port: string;
  /** Internal parameter name on the wrapped function, when it differs from `port`. */
  param?: string;
  /** Reference to this port's type (see `port-type.ts`). Drives connect-time validation. */
  type?: PortTypeRef;
  /** Python parameter kind, when modeling a function signature. */
  kind?: PortKind;
  required?: boolean;
  default?: unknown;
  direction: PortDirection;
}

/**
 * A reference (not the function itself) to the callable a `func` node wraps. Carries a
 * `lang` tag and optional content hash so a `FuncRefResolver` can map it to a runnable
 * callable. Pure-TS funcRefs resolve to JS directly; other languages resolve via a
 * consumer-supplied resolver (e.g. Pyodide/WASM or a backend). The engine lives in
 * `@zodal/graph-runtime`; only these types live here.
 */
export interface FuncRef {
  /** Qualname / import-path / module:function reference. */
  ref: string;
  /** Source language. Open string so new runtimes can be added. */
  lang: 'ts' | 'py' | (string & {});
  /** Optional content hash for cache-keying / integrity. */
  hash?: string;
}

/**
 * An opaque, invocable function returned by a {@link FuncRefResolver}.
 *
 * **Calling convention used by `@zodal/graph-runtime`:** the engine invokes the callable with
 * exactly ONE positional argument — an object of the node's inputs keyed by parameter name
 * (`{ [port.param ?? port.port]: value }`) — and expects it to return the value (one out-port) or an
 * object keyed by out-port name (several out-ports). So a resolved callable looks like
 * `({ x, y }) => x + y`, NOT `(x, y) => x + y`.
 */
export type Callable = (...args: unknown[]) => unknown;

/**
 * Maps a `FuncRef` to a runnable {@link Callable}. The resolver is the SINGLE dispatch point: the
 * runtime does not branch on `funcRef.lang`, so the resolver maps any language (`ts`, `py`, …) to a
 * callable — pure-TS directly, Python-backed via Pyodide/WASM or a backend. Implemented by
 * `@zodal/graph-runtime` consumers.
 */
export type FuncRefResolver = (funcRef: FuncRef) => Callable | Promise<Callable>;

export interface GraphNode<TData = unknown> {
  id: NodeId;
  kind: NodeKind;
  /** Names a node type definition (a Zod schema registered with `defineGraph`). */
  type?: string;
  ports?: GraphPort[];
  /** The callable a `func` node wraps, if any. */
  funcRef?: FuncRef;
  data?: TData;
  /** Layout hint only — authoritative position lives in the presentation layer. */
  position?: { x: number; y: number };
}

export interface GraphEdge<TData = unknown> {
  id: EdgeId;
  source: NodeId;
  target: NodeId;
  /** Output port on `source` this edge leaves from. */
  sourcePort?: string;
  /** Input port on `target` this edge binds to — THE field flat node-link formats drop. */
  targetPort?: string;
  type?: string;
  data?: TData;
}

/** Graph-level metadata bag. `zodal` namespaces facade state so foreign keys pass through. */
export interface GraphMeta {
  zodal?: {
    schemaRefs?: Record<string, string>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** The canonical in-memory graph. `directed`/`multigraph` are structural facts about it. */
export interface CanonicalGraph<N = unknown, E = unknown> {
  directed: boolean;
  multigraph: boolean;
  nodes: GraphNode<N>[];
  edges: GraphEdge<E>[];
  graph: GraphMeta;
}

// `PortTypeRef` is defined in `port-type.ts` (and exported from the barrel there).
import type { PortTypeRef } from './port-type.js';

// ===========================================================================
// Small constructors / guards
// ===========================================================================

/** Create an empty canonical graph with sensible defaults (directed, non-multi). */
export function emptyGraph<N = unknown, E = unknown>(
  overrides: Partial<CanonicalGraph<N, E>> = {},
): CanonicalGraph<N, E> {
  return {
    directed: true,
    multigraph: false,
    nodes: [],
    edges: [],
    graph: {},
    ...overrides,
  };
}

export const isFuncNode = (node: GraphNode): boolean => node.kind === 'func';
export const hasPorts = (node: GraphNode): boolean => (node.ports?.length ?? 0) > 0;
