/**
 * Test setup: stub the WebGL globals that the `sigma` package references at MODULE-LOAD time, so it
 * can be imported under happy-dom (which has no WebGL). Actual context creation still fails at
 * runtime → `SigmaView`'s try/catch renders the error overlay, which is the path the render tests
 * exercise. Harmless for the node-env headless tests (they never touch these globals).
 */

class WebGLStub {}
const g = globalThis as unknown as Record<string, unknown>;
g.WebGL2RenderingContext ??= WebGLStub;
g.WebGLRenderingContext ??= WebGLStub;
