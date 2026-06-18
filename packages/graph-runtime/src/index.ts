/**
 * @zodal/graph-runtime — the in-browser dataflow execution engine for zodal-graphs func graphs.
 *
 * Realizes the project's "full in-browser execution is a first-class goal" decision: execute a func
 * graph in topological order over a scope, driven by a `FuncRefResolver` (from `@zodal/graph-core`)
 * that maps each node's `funcRef` to a runnable callable. Pure-TS refs resolve directly; Python-backed
 * refs resolve via a consumer-supplied resolver (Pyodide/WASM or a backend).
 *
 *  - `run` — execute the whole graph, returning the value scope.
 *  - `runSteps` — async generator yielding each node's outputs (step / watch-values-flow).
 *  - `recompute` — re-run only the nodes downstream of a change.
 *  - `buildExecutionPlan` — the topo order + input bindings the runner walks.
 */

export * from './plan.js';
export * from './run.js';
