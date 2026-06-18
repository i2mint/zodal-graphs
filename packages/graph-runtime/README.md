# @zodal/graph-runtime

> The in-browser **dataflow execution engine** for zodal-graphs func graphs — run, step, and
> incrementally recompute a computation graph.

Executes a func graph in topological order over a value scope, driven by a `FuncRefResolver` that
maps each node's `funcRef` to a runnable callable. The runtime does **not** branch on `funcRef.lang`
— the resolver is the single dispatch point (pure-TS returns a JS function; Python-backed bridges to
Pyodide/WASM or a backend). This realizes the project's "full in-browser execution is a first-class
goal" decision.

## Install

```bash
pnpm add @zodal/graph-runtime
```

`@zodal/graph-core` comes transitively.

## Use

```ts
import { run, runSteps, recompute } from '@zodal/graph-runtime';

// A resolver maps each node's funcRef to a callable. The callable receives one object of inputs
// keyed by parameter name and returns the value (one out-port) or { [outPort]: value } (several).
const resolver = (fr) => ({ source5: () => 5, inc: ({ x }) => x + 1 }[fr.ref]);

const { scope } = await run(graph, { resolver, onValue: (e) => console.log(e) });
// scope: nodeId → { outPort → value }

for await (const step of runSteps(graph, { resolver })) {
  // step: { node, outputs, index } — watch values flow / step through execution
}

// Re-run ONLY the nodes downstream of a change:
const next = await recompute(graph, { resolver, inputs: { in: { v: 20 } } }, scope, ['in']);
// next.recomputed → the re-executed nodes (the changed set + its descendants)
```

Seed input ports with no incoming edge via `inputs: { nodeId: { inPort: value } }`. `var` nodes pass
their single input through (seed key = its in-port name, or `value` if it has none). `entity` /
funcRef-less nodes are skipped.

**It fails loudly, never silently corrupts:** a cyclic graph, fan-in (two edges into one in-port), a
var node with multiple incoming edges, an edge that omits `sourcePort` from a multi-out-port source,
a multi-out callable returning a non-object, and an unbound `required` input all throw with a
descriptive error.

## Scope (this checkpoint)

**Built + tested:** `buildExecutionPlan` (topo + bindings + eager ambiguity rejection), `run`,
`runSteps` (step / watch-values), `recompute` (incremental downstream re-execution that preserves a
re-run node's own seeds), value events, multi-output distribution, var pass-through, and the
fail-loud validations above. **Known limitation:** the object calling convention assumes
keyword-compatible parameters — Python positional-only / `*args` / `**kwargs` kinds (`PortKind`) are
not yet expressible. **Deferred:** provenance capture, cost estimation/gating, human-in-the-loop
approval, positional/var-positional argument binding, and the concrete Python resolver
implementations (Pyodide / backend-delegating).

## Status

Pre-1.0, under active development. Part of the zodal-graphs monorepo.
