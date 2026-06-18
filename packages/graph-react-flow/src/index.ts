/**
 * @zodal/graph-react-flow — the React Flow typed-port editor renderer for zodal-graphs.
 *
 * The small-rich editor regime: a node-link canvas where ports are first-class typed handles and a
 * connection is validated at drag time against the canonical port types (`makeIsValidConnection`,
 * driven by graph-core's `portTypeCompatible`). Register it into a `@zodal/graph-ui` registry with
 * `createReactFlowRendererEntry`.
 *
 * Headless core (`makeIsValidConnection`, `lookupPort`, `reactFlowCapabilities`,
 * `createReactFlowRendererEntry`) needs no React; the `FuncNode` / `GraphFlowView` components are the
 * thin visible shell.
 */

export * from './is-valid-connection.js';
export * from './capabilities.js';
export * from './components.js';
