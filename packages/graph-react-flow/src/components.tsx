/**
 * The React shells — the visible surface of the typed-port editor.
 *
 * Still thin this checkpoint (visual styling, real layout, collapse↔expand, and the value-watch
 * overlay are deferred), but genuinely editable: `GraphFlowView` seeds React Flow's controlled
 * node/edge state, wires `onConnect` through the generated `isValidConnection`, and memoizes its
 * derivations. `FuncNode` renders one `<Handle>` per port (handle id = port name, so
 * `targetHandle === targetPort`).
 *
 * Consumers must import `@xyflow/react/dist/style.css` (or supply their own) AND give the view a
 * parent with a definite height — React Flow renders into its parent's box. A graph with no nodes
 * renders an empty state instead of an empty canvas.
 *
 * Linked views: give `GraphFlowView` the shared `view` store (`@zodal/graph-ui`'s
 * `createGraphViewStore`) and the store owns the selection: a click on a node or edge selects it
 * (shift-click toggles it), a click on the pane clears it, hovering sets the shared hover, and the
 * canvas draws the shared state — React Flow's own `selected` for the selection, the
 * `zodal-flow--hovered` / `zodal-flow--dimmed` classes (dimmed is also faded inline) for hover and
 * what only `'fade'` filters drop, and React Flow's `hidden` for what a `'hide'` filter removes.
 * React Flow's own box (drag) selection does not reach the store yet, so it does nothing with a
 * `view`; deleting an element drops it from the shared selection.
 */

import {
  addEdge,
  Handle,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type IsValidConnection as RFIsValidConnection,
  type Node,
  type NodeProps,
  type NodeTypes,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactElement } from 'react';
import type { CanonicalGraph, GraphCapabilities, ReactFlowNodeData } from '@zodal/graph-core';
import type { GraphViewStore } from '@zodal/graph-ui';
import { useLinkedView, type LinkedView } from '@zodal/graph-ui/react';
import { toReactFlow } from '@zodal/graph-core';
import { makeIsValidConnection } from './is-valid-connection.js';

/** A metadata-rich function node: a `<Handle>` per typed port, in/out on opposite sides. */
export function FuncNode({ data }: NodeProps): ReactElement {
  const d = data as unknown as ReactFlowNodeData;
  const ports = d.ports ?? [];
  const inputs = ports.filter((p) => p.direction === 'in');
  const outputs = ports.filter((p) => p.direction === 'out');
  return (
    <div className="zodal-func-node">
      {inputs.map((p) => (
        <Handle key={`in-${p.port}`} id={p.port} type="target" position={Position.Left} />
      ))}
      <div className="zodal-func-node__title">{d.funcRef?.ref ?? d.kind}</div>
      {outputs.map((p) => (
        <Handle key={`out-${p.port}`} id={p.port} type="source" position={Position.Right} />
      ))}
    </div>
  );
}

const nodeTypes: NodeTypes = { func: FuncNode };

export interface GraphFlowViewProps {
  graph: CanonicalGraph;
  capabilities: GraphCapabilities;
  /** The shared view store (linked views): it owns the selection; clicks and hover write to it. */
  view?: GraphViewStore;
}

/** Opacity of an element only `'fade'` filters drop. */
const DIMMED_OPACITY = 0.3;

/** How one element shows the shared state: React Flow's `selected` / `hidden`, plus classes. */
function decorate<T extends Node | Edge>(element: T, kind: 'node' | 'edge', linked: LinkedView): T {
  const { selection, hovered } = linked.state;
  const selected = (kind === 'node' ? selection.nodes : selection.edges).includes(element.id);
  const hidden = (kind === 'node' ? linked.hidden.nodes : linked.hidden.edges).has(element.id);
  const kept = linked.kept && (kind === 'node' ? linked.kept.nodes : linked.kept.edges);
  const dimmed = kept !== undefined && !kept.has(element.id) && !selected; // selection outranks dimming
  const isHovered = hovered?.kind === kind && hovered.id === element.id;
  const className = [element.className, isHovered && 'zodal-flow--hovered', dimmed && 'zodal-flow--dimmed']
    .filter(Boolean)
    .join(' ');
  const style: CSSProperties | undefined = dimmed ? { ...element.style, opacity: DIMMED_OPACITY } : element.style;
  return { ...element, selected, hidden, className: className || undefined, style };
}

/** Render a canonical graph as an editable React Flow canvas with generated connection validation. */
export function GraphFlowView({ graph, capabilities, view }: GraphFlowViewProps): ReactElement {
  const linked = useLinkedView(graph, view);
  const initial = useMemo(() => toReactFlow(graph), [graph]);

  const seedNodes = useMemo<Node[]>(
    () =>
      initial.nodes.map((n, i) => ({
        id: n.id,
        type: n.type ?? 'func', // preserve the canonical node type; default to the func shell
        position: n.position ?? { x: 0, y: i * 80 }, // default stack — a real layout pass is deferred
        data: n.data as unknown as Record<string, unknown>,
      })),
    [initial],
  );
  const seedEdges = useMemo<Edge[]>(
    () =>
      initial.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
      })),
    [initial],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(seedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(seedEdges);

  // useNodesState/useEdgesState only read their arg on first mount; re-seed when the graph changes
  // (otherwise the canvas — and the empty-state check below — go stale on a new `graph` prop).
  useEffect(() => {
    setNodes(seedNodes);
    setEdges(seedEdges);
  }, [seedNodes, seedEdges, setNodes, setEdges]);

  // Generated from the canonical port types; assignable to React Flow's predicate without a cast
  // because our Connection covers the Edge | Connection it passes.
  const isValidConnection: RFIsValidConnection = useMemo(
    () => makeIsValidConnection(graph, capabilities),
    [graph, capabilities],
  );
  const onConnect = useCallback<OnConnect>((connection) => setEdges((eds) => addEdge(connection, eds)), [setEdges]);

  // With a store, the store owns selection: React Flow's own 'select' changes are dropped (the click
  // handlers below write the store, and `decorate` draws it back as `selected`).
  // A deleted element leaves the shared selection too.
  const handleNodesChange = useCallback<OnNodesChange>(
    (changes) => {
      if (!view) return onNodesChange(changes);
      onNodesChange(changes.filter((c) => c.type !== 'select'));
      const removed = new Set(changes.flatMap((c) => (c.type === 'remove' ? [c.id] : [])));
      if (removed.size > 0) view.setSelection({ nodes: view.getState().selection.nodes.filter((id) => !removed.has(id)) });
    },
    [onNodesChange, view],
  );
  const handleEdgesChange = useCallback<OnEdgesChange>(
    (changes) => {
      if (!view) return onEdgesChange(changes);
      onEdgesChange(changes.filter((c) => c.type !== 'select'));
      const removed = new Set(changes.flatMap((c) => (c.type === 'remove' ? [c.id] : [])));
      if (removed.size > 0) view.setSelection({ edges: view.getState().selection.edges.filter((id) => !removed.has(id)) });
    },
    [onEdgesChange, view],
  );
  const shown = useMemo(
    () => (linked ? { nodes: nodes.map((n) => decorate(n, 'node', linked)), edges: edges.map((e) => decorate(e, 'edge', linked)) } : { nodes, edges }),
    [nodes, edges, linked],
  );
  const pointer = useMemo(
    () =>
      view
        ? {
            onNodeClick: (event: ReactMouseEvent, node: Node) => view.pick({ kind: 'node', id: node.id }, event.shiftKey),
            onEdgeClick: (event: ReactMouseEvent, edge: Edge) => view.pick({ kind: 'edge', id: edge.id }, event.shiftKey),
            onPaneClick: () => view.clearSelection(),
            onNodeMouseEnter: (_: ReactMouseEvent, node: Node) => view.setHovered({ kind: 'node', id: node.id }),
            onNodeMouseLeave: () => view.setHovered(null),
            onEdgeMouseEnter: (_: ReactMouseEvent, edge: Edge) => view.setHovered({ kind: 'edge', id: edge.id }),
            onEdgeMouseLeave: () => view.setHovered(null),
          }
        : {},
    [view],
  );

  if (nodes.length === 0) {
    return (
      <div className="zodal-graph-flow zodal-graph-flow--empty" style={{ width: '100%', height: '100%' }}>
        No nodes to display.
      </div>
    );
  }

  return (
    <div className="zodal-graph-flow" style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={shown.nodes}
        edges={shown.edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        {...pointer}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        fitView
      />
    </div>
  );
}
