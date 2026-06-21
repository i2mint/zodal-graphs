/**
 * Test setup: stub the WebGL globals that the `sigma` package reads at MODULE-LOAD time, so it can be
 * IMPORTED under happy-dom (which has no WebGL). The stub only enables the import — it does NOT
 * provide a working context. The actual failure the render tests exercise is `canvas.getContext`
 * returning null at runtime, which makes `new Sigma(...)` throw; `SigmaView`'s try/catch then renders
 * the error overlay. Harmless for the node-env headless tests (they never touch these globals).
 */

class WebGLStub {}
const g = globalThis as unknown as Record<string, unknown>;
g.WebGL2RenderingContext ??= WebGLStub;
g.WebGLRenderingContext ??= WebGLStub;
