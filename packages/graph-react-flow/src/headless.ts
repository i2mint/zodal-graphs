/**
 * The React-free core of @zodal/graph-react-flow, importable without React or @xyflow/react.
 *
 * Use `@zodal/graph-react-flow/headless` from a Node/server validation script or from graph-ui's
 * pure capability ranking. The root entry additionally re-exports the React components (and so
 * pulls React + @xyflow/react).
 */

export * from './is-valid-connection.js';
export * from './capabilities.js';
