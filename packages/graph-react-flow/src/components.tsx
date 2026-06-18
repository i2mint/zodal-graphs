/**
 * Thin React shells — the visible surface of the typed-port editor.
 *
 * Deliberately minimal this checkpoint (headless-first): `FuncNode` renders one `<Handle>` per
 * port (handle id = port name, so `targetHandle === targetPort`), and `GraphFlowView` wires
 * `toReactFlow` + `makeIsValidConnection` into `<ReactFlow>`. Real layout, styling, collapse↔expand,
 * and the value-watch overlay are deferred — the tested substance is the headless core.
 *
 * Consumers must import `@xyflow/react/dist/style.css` (or supply their own) for the canvas to render.
 */

import {
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type IsValidConnection as RFIsValidConnection,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';
import type { ReactElement } from 'react';
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
  const rf = toReactFlow(graph);
  // React Flow requires a position on every node; a default stack stands in for a real layout pass.
  const nodes: Node[] = rf.nodes.map((n, i) => ({
    id: n.id,
    type: 'func',
    position: n.position ?? { x: 0, y: i * 80 },
    data: n.data as unknown as Record<string, unknown>,
  }));
  const edges: Edge[] = rf.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
  }));
  // Our predicate takes a Connection; React Flow may also pass an Edge (a superset of the fields we
  // read), so the cast is sound.
  const isValidConnection = makeIsValidConnection(graph, capabilities) as RFIsValidConnection;

  return <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} isValidConnection={isValidConnection} fitView />;
}
