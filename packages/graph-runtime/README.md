# @zodal/graph-runtime

> The in-browser **dataflow execution engine** for zodal-graphs func graphs — run, step, and
> incrementally recompute a computation graph.

Executes a func graph in topological order over a value scope, driven by a `FuncRefResolver` that
maps each node's `funcRef` to a runnable callable. Pure-TS refs resolve to JS functions directly;
Python-backed refs resolve via a consumer-supplied resolver (Pyodide/WASM or a backend). This
realizes the project's "full in-browser execution is a first-class goal" decision.

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
their single input through; `entity` / funcRef-less nodes are skipped. A cyclic graph throws (no
topological order).

## Scope (this checkpoint)

**Built + tested:** `buildExecutionPlan` (topo + input bindings), `run`, `runSteps` (step /
watch-values), `recompute` (incremental downstream re-execution), value events, multi-output
distribution, var pass-through, cycle rejection. **Deferred:** provenance capture, cost
estimation/gating, human-in-the-loop approval, async fan-out, and the concrete Python resolver
implementations (Pyodide / backend-delegating).

## Status

Pre-1.0, under active development. Part of the zodal-graphs monorepo.
