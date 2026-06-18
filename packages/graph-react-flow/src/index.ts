/**
 * @zodal/graph-react-flow — the React Flow typed-port editor renderer for zodal-graphs.
 *
 * The small-rich editor regime: a node-link canvas where ports are first-class typed handles and a
 * connection is validated at drag time against the canonical port types (`makeIsValidConnection`,
 * driven by graph-core's `portTypeCompatible`). Register it into a `@zodal/graph-ui` registry with
 * `createReactFlowRendererEntry`.
 *
 * This root entry pulls React + @xyflow/react (it re-exports the components). For the React-free
 * core (`makeIsValidConnection`, `lookupPort`, `reactFlowCapabilities`,
 * `createReactFlowRendererEntry`), import `@zodal/graph-react-flow/headless` instead.
 */

export * from './headless.js';
export * from './components.js';
