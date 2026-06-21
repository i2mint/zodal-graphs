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
} from '@xyflow/react';
import { useCallback, useMemo, type ReactElement } from 'react';
import type { CanonicalGraph, GraphCapabilities, ReactFlowNodeData } from '@zodal/graph-core';
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
}

/** Render a canonical graph as an editable React Flow canvas with generated connection validation. */
export function GraphFlowView({ graph, capabilities }: GraphFlowViewProps): ReactElement {
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

  const [nodes, , onNodesChange] = useNodesState(seedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(seedEdges);

  // Generated from the canonical port types; assignable to React Flow's predicate without a cast
  // because our Connection covers the Edge | Connection it passes.
  const isValidConnection: RFIsValidConnection = useMemo(
    () => makeIsValidConnection(graph, capabilities),
    [graph, capabilities],
  );
  const onConnect = useCallback<OnConnect>((connection) => setEdges((eds) => addEdge(connection, eds)), [setEdges]);

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
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        fitView
      />
    </div>
  );
}
