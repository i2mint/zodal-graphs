/**
 * @zodal/graph-sigma — the large-sparse WebGL viz renderer for zodal-graphs.
 *
 * sigma.js over the graphology hub: it renders big graphs (graph-ui's degrade target when the
 * small-rich editor opts out on scale) and draws `@zodal/graph-compute` overlays by id. Register it
 * into a `@zodal/graph-ui` registry with `createSigmaRendererEntry`.
 *
 * This root entry pulls React + sigma. For the React-free core (`sigmaCapabilities`,
 * `createSigmaRendererEntry`, the overlay-styling functions), import `@zodal/graph-sigma/headless`.
 */

export * from './headless.js';
export * from './components.js';
