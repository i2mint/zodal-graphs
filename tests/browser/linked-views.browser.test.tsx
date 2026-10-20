/**
 * Linked views in a real browser: one shared view store drives the table, the timeline, sigma and
 * React Flow, and a gesture in one lens repaints the others. This is the check that was run by hand
 * for #53, kept in CI so a regression in the real DOM (React Flow event wiring, sigma's WebGL
 * events, the visx brush gesture) is caught.
 */

import '@xyflow/react/dist/style.css';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { resolveGraphCapabilities, type CanonicalGraph } from '@zodal/graph-core';
import { createGraphViewStore, type GraphViewStore } from '@zodal/graph-ui';
import { GraphTable } from '@zodal/graph-table';
import { filterWindow, TimelineView, toNumber } from '@zodal/graph-timeline';
import { SigmaView } from '@zodal/graph-sigma';
import { GraphFlowView } from '@zodal/graph-react-flow';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const graph: CanonicalGraph = {
  directed: true,
  multigraph: false,
  graph: {},
  nodes: [
    { id: 'w1', kind: 'entity', data: { tier: 'words', start: 0, end: 2 }, position: { x: 0, y: 0 } },
    { id: 'w2', kind: 'entity', data: { tier: 'words', start: 3, end: 5 }, position: { x: 200, y: 0 } },
    { id: 'w3', kind: 'entity', data: { tier: 'words', start: 8, end: 10 }, position: { x: 400, y: 0 } },
    { id: 'alice', kind: 'entity', position: { x: 200, y: 150 } },
  ],
  edges: [
    { id: 'a-w1', source: 'alice', target: 'w1' },
    { id: 'a-w3', source: 'alice', target: 'w3' },
  ],
};

const TIMELINE = { width: 600, height: 160, margin: { top: 8, right: 0, bottom: 28, left: 100 } };

let host: HTMLDivElement;
let root: Root;
let view: GraphViewStore;
const pageErrors: string[] = [];
const onError = (event: ErrorEvent) => pageErrors.push(String(event.message));

const box = (style: Partial<CSSStyleDeclaration>, ...children: ReturnType<typeof createElement>[]) =>
  createElement('div', { style: { width: '500px', height: '300px', position: 'relative', ...style } as never }, ...children);

// Keep sigma's WebGL frames readable, so a repaint can be detected through `toDataURL`.
const getContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, options?: object) {
  const preserve = type.startsWith('webgl') ? { ...options, preserveDrawingBuffer: true } : options;
  return getContext.call(this, type as never, preserve as never);
} as typeof getContext;

beforeAll(async () => {
  window.addEventListener('error', onError);
  host = document.createElement('div');
  document.body.appendChild(host);
  view = createGraphViewStore();
  root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        'div',
        null,
        createElement(GraphTable, { graph, view }),
        createElement('div', { 'data-testid': 'timeline' }, createElement(TimelineView, { graph, view, ...TIMELINE })),
        box({}, createElement('div', { 'data-testid': 'sigma', style: { width: '100%', height: '100%' } }, createElement(SigmaView, { graph, view }))),
        box({}, createElement('div', { 'data-testid': 'flow', style: { width: '100%', height: '100%' } }, createElement(GraphFlowView, { graph, capabilities: resolveGraphCapabilities({}), view }))),
      ),
    );
  });
  await settle();
});

afterAll(() => {
  act(() => root.unmount());
  HTMLCanvasElement.prototype.getContext = getContext;
  host.remove();
  window.removeEventListener('error', onError);
});

/** Let React commit and the browser paint (sigma renders on animation frames). */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

const row = (id: string) => [...document.querySelectorAll('tr.zodal-table__row')].find((tr) => tr.textContent?.includes(id)) as HTMLElement;
const flowNode = (id: string) => document.querySelector<HTMLElement>(`[data-testid="flow"] .react-flow__node[data-id="${id}"]`)!;
const timelineRect = (id: string) => document.querySelector<SVGRectElement>(`[data-testid="timeline"] rect[data-id="${id}"]`)!;

/** Fire a mouse or pointer event at a point, on whatever element is there (as a real pointer would). */
function mouse(type: string, x: number, y: number, target?: Element): void {
  const el = target ?? document.elementFromPoint(x, y)!;
  const init = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: /up$/.test(type) ? 0 : 1, view: window };
  el.dispatchEvent(type.startsWith('pointer') ? new PointerEvent(type, { ...init, pointerId: 1, isPrimary: true, pointerType: 'mouse' }) : new MouseEvent(type, init));
}

/** A sigma fingerprint: every layer (WebGL nodes/edges, 2D labels) read back as data URLs. */
function sigmaPixels(): string {
  const canvases = [...document.querySelectorAll<HTMLCanvasElement>('[data-testid="sigma"] canvas')];
  return canvases.map((c) => c.toDataURL()).join('|');
}

describe('linked views in a real browser', () => {
  it('renders every lens without page errors', () => {
    expect(document.querySelectorAll('tr.zodal-table__row')).toHaveLength(4);
    expect(timelineRect('w1')).toBeTruthy();
    expect(document.querySelectorAll('[data-testid="sigma"] canvas').length).toBeGreaterThan(0);
    expect(flowNode('w1')).toBeTruthy();
    expect(pageErrors).toEqual([]);
  });

  it('ticking a table row selects it in React Flow and the timeline, and repaints sigma', async () => {
    const before = sigmaPixels();
    await act(async () => {
      (row('w2').querySelector('input[type="checkbox"]') as HTMLInputElement).click();
    });
    await settle();
    expect(view.getState().selection.nodes).toEqual(['w2']);
    expect(flowNode('w2').className).toContain('selected');
    expect(timelineRect('w2').getAttribute('class')).toContain('zodal-timeline__annotation--selected');
    expect(sigmaPixels()).not.toEqual(before);
    await act(async () => view.clearSelection());
  });

  it('dragging the timeline brush filters the other lenses; clearing filters resets the brush', async () => {
    const overlay = document.querySelector('[data-testid="timeline"] .visx-brush-overlay')!;
    const r = overlay.getBoundingClientRect();
    const y = r.top + r.height / 2;
    const before = sigmaPixels();
    // One step per act: visx swaps in its drag handlers on the re-render after pointerdown.
    for (const [type, x, target] of [
      ['pointerdown', r.left + r.width * 0.3, overlay],
      ['pointermove', r.left + r.width * 0.45, undefined],
      ['pointermove', r.left + r.width * 0.55, undefined],
      ['pointerup', r.left + r.width * 0.55, undefined],
    ] as const) {
      await act(async () => mouse(type, x, y, target));
    }
    await settle();
    // The time axis is [0, 10] over the brush's width: the drag covers about [3, 5.5] (visx pads ~2px).
    const window = filterWindow(view.getState().filters.timeline);
    expect(window && toNumber(window.start)).toBeCloseTo(3, 0);
    expect(window && toNumber(window.end)).toBeCloseTo(5.5, 0);
    expect(row('w1').dataset.dimmed).toBe('true');
    expect(row('w2').dataset.dimmed).toBeUndefined();
    expect(row('w3').dataset.dimmed).toBe('true');
    expect(flowNode('w3').className).toContain('zodal-flow--dimmed');
    expect(sigmaPixels()).not.toEqual(before);

    await act(async () => view.clearFilters());
    await settle();
    expect(row('w3').dataset.dimmed).toBeUndefined();
    expect(flowNode('w3').className).not.toContain('zodal-flow--dimmed');
    const selection = document.querySelector('[data-testid="timeline"] .visx-brush-selection');
    expect(Number(selection?.getAttribute('width') ?? 0)).toBe(0);
  });

  it('a React Flow click selects the table row; hover marks it; a sigma stage click clears', async () => {
    await act(async () => {
      flowNode('w1').click();
    });
    await settle();
    expect(view.getState().selection.nodes).toEqual(['w1']);
    expect(row('w1').dataset.selected).toBe('true');

    await act(async () => {
      flowNode('w2').dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
      flowNode('w2').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    expect(view.getState().hovered).toEqual({ kind: 'node', id: 'w2' });
    expect(row('w2').className).toContain('zodal-table__row--hovered');

    const stage = document.querySelector('[data-testid="sigma"] .sigma-mouse')!;
    const s = stage.getBoundingClientRect();
    await act(async () => {
      mouse('mousedown', s.left + 3, s.top + 3, stage);
      mouse('mouseup', s.left + 3, s.top + 3, stage);
      mouse('click', s.left + 3, s.top + 3, stage);
    });
    await settle();
    expect(view.getState().selection.nodes).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
