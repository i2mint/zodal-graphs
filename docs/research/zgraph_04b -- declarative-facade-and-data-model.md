# Prompt 4 — The Declarative Facade + Canonical Graph Data Model & Serialization

> **Version note.** This is the **Claude Code "grounded" P4** deliverable. It is written *grounded* in the consolidated `_grounding-brief.md` (File 1's affordance synthesis, the existing zodal registry / capabilities / generator substrate, and the meshed / linked / lacing / dagapp data models) and pins every recommendation to a primary-source maintenance/license check. A **parallel Claude AI "deep research" run** produced a survey-focused twin of this document; where that twin goes broad on the format landscape, this one goes deep on *reconciling meshed's typed ports with node↔node graph formats* and on *how the design bolts onto zodal's existing seams*. Read them together: the twin is the literature survey; this is the design.

---

## 0. The one hard problem, stated up front

Every general-purpose graph serialization format on the market models an edge as **`{source, target}` — node-to-node**. meshed (the gold-standard subject, the only one with full cluster-B "typed ports" support) models an edge as **output-variable → a specific, named, typed, *kinded* input port of a function node**. A `FuncNode`'s `bind` dict (`meshed/base.py:131-134`) maps each internal parameter name to the external scope variable it sources from, and `self.sig = Sig(self.func)` (`base.py:267`) carries the parameter **kind** (POSITIONAL_ONLY / VAR_POSITIONAL / VAR_KEYWORD / …), **default**, and **type annotation** for each port.

A flat node-link edge list **collapses exactly this information**: it can say "node A connects to node B" but not "A's output feeds B's `path=` keyword-only port, which expects a `str`." That single dropped field — *which named port an edge binds to* — is the whole game. The canonical model's job is to carry it through serialization while still degrading to a valid plain graph for every other consumer.

The grounding brief already proposes the shape of the answer (§5 of the brief): adopt meshed's own bipartite var/func split, carried in `linked`'s `nodes_and_links` hub, with links carrying a `target_port` and func nodes carrying a typed/kinded `ports` block. This document hardens that into a concrete neutral-hub choice, a Zod-v4 schema modeling sketch, a capabilities vocabulary, a renderer-selection rule, and an adapters list — then stress-tests it against the surveyed formats.

---

## 1. Web survey — graph serialization/model formats as neutral-hub candidates

The brief named `linked`'s `nodes_and_links` as the de-facto hub for *plain* graphs. The question for the facade is whether to canonicalize on that shape or on a richer one. I surveyed seven serialization formats plus four declarative-diagram frameworks, scoring each on the dimension that actually decides the hub: **typed-port and port-level-edge representation**. Maintenance and license were verified against primary sources for everything recommended.

### 1.1 Comparison table — serialization formats

| Format | Edge model | Typed ports? | Port-level edges? | Attributes on nodes/edges | Multigraph | Dynamic/time | License | Maintenance (primary source) |
|---|---|---|---|---|---|---|---|---|
| **networkx node-link JSON** (`node_link_data`) | `{source, target}` (+ `key` for multigraph) | ✗ | ✗ (only via opaque attrs) | free-form (any attrs) | ✓ (`multigraph` flag + edge `key`) | ✗ | BSD-3-Clause | very active (NetworkX 3.6.x, 2025) [1] |
| **`linked` `nodes_and_links`** (= JSON-graph idiom) | `{source, target}` on `links` | ✗ (opaque pass-through) | ✗ | free-form, passed opaquely | implicit | ✗ | (local pkg; idiom is public domain) | local, in-scope [brief §2] |
| **JSON Graph Format (JGF)** | `{source, target, relation, directed}` | ✗ | ✗ (edges reference node IDs directly) | `metadata` object on graph/node/edge | via `relation` + multiple edges | ✗ | Apache-2.0 (LICENSE in repo) | slow: v1.0 (2019), hyperedges added 2021, ~6 open issues [2] |
| **graphology `SerializedGraph`** | `{key?, source, target, attributes?, undirected?}` | ✗ | ✗ (no reserved port schema) | free-form `attributes` object | ✓ (`options.multi`) | ✗ | MIT | active: v0.26.0 (Feb 2025), 66 releases [3][4] |
| **Cytoscape.js JSON** | `{data:{id, source, target}}` | ✗ | ✗ (compound `parent` ≠ ports) | free-form `data` + `scratch` | ✓ | ✗ | MIT | active [5] |
| **React Flow / xyflow** | `{id, source, target, sourceHandle?, targetHandle?}` | **partial** (handle id is a port; type via custom validation) | **✓** (`sourceHandle` / `targetHandle`) | free-form `data` on node/edge | ✓ (multiple handles) | ✗ | MIT | very active: `@xyflow/react` 12.11 (Jun 2026), 37k★ [6] |
| **GraphML** | `<edge source target sourceport? targetport?>` | **✓** (named `<port>` children of `<node>`) | **✓** (`sourceport` / `targetport` name a port) | typed `<data>` via `<key>` declarations | ✓ | ✗ | spec freely usable (academic/W3C-style) | stable, mature standard [7][8] |
| **GEXF** | `<edge source target weight? type?>` (+ `kind` for parallel) | ✗ | ✗ | typed `<attribute>` (XSD types) | ✓ (`kind`) | **✓ (`<spells>`, intervals/timestamps)** | CC-BY-4.0 (spec) | stable; Gephi-anchored [9][10] |

**Reading the table.** Only **two** formats represent ports at all: **GraphML** (first-class, named, with `sourceport`/`targetport` on edges — the closest thing to meshed's model in any standard) and **React Flow** (`sourceHandle`/`targetHandle`, a runtime concept that survives in serialized node/edge objects). GraphML's ports are *purely topological* — a port is a named connection point, but the standard carries no *type* or *kind* on it; you would push the type/kind into `<data>` keys. React Flow handles are likewise typeless at the protocol level (typing is enforced at connect-time by `isValidConnection`, per the brief's cluster-B note). **No standard format carries a typed, kinded port natively.** That settles the design: the typed-port payload must be a *zodal-defined enrichment* layered onto a neutral hub, not delegated to any existing format.

### 1.2 Declarative / model-driven diagram frameworks — borrow-vs-reinvent

| Framework | Model shape | Ports | Borrowable pattern | License | Maintenance |
|---|---|---|---|---|---|
| **Eclipse Sprotty / GLSP** | `SModel` / `SGraph` (`GNode`, `GEdge`, `GPort`, `GLabel`, compartments); server generates the *graphical* model from a *source* model via `GModelFactory` | **✓ first-class `GPort` with semantic meaning** | The **source-model → graphical-model split** is exactly the facade's job; ports-with-semantics validates the typed-port direction; DI-wired renderer config mirrors the registry pattern | EPL-2.0 | active (Eclipse) [11][12] |
| **D2** | text DSL → SVG; shapes, connections, containers; **connections can target sub-shapes/ports** (`a.port -> b.port`) | partial (sub-shape addressing) | declarative-text → diagram with pluggable layout engines (dagre/ELK) | MPL-2.0 | active, open-sourced Nov 2022 [13] |
| **Mermaid** | text DSL → SVG; many diagram types | ✗ | ubiquitous markdown embedding; *not* a data model | MIT | very active |
| **PlantUML** | text DSL → image (needs Java) | ✗ | deep UML; heavyweight runtime | GPL/LGPL/etc. | active |
| **Rete.js** | in-memory node editor; **typed sockets** decide connectability | **✓ typed sockets** | the *other* lib (besides React Flow) that does cluster-B; confirms "socket = typed port" framing | MIT | active [14] |

**Don't-reinvent takeaway.** Sprotty/GLSP independently arrived at the **two-model architecture** the facade needs (a semantic *source* model distinct from a renderer-facing *graphical* model) **and** at first-class semantic ports — strong external validation, but it is a Java/Eclipse-anchored, DI-heavy, server-centric stack that does *not* fit a headless, serializable, Zod-described, React-renderer-agnostic facade. We **borrow the architecture, not the code**. D2 and Mermaid are *output* targets (export adapters), not data models. Rete.js and React Flow are *renderers* the registry should select — not hubs.

---

## 2. Hub recommendation

### Primary hub: a **zodal canonical graph document** — bipartite-split node-link, superset of `linked`'s `nodes_and_links`, with a typed-port enrichment block

The canonical *serialized* model is **`nodes_and_links` with three additive, namespaced enrichments** — chosen because (a) `linked` already converts it to/from `edgelist`, `networkx_digraph`, dataframes, adjacency, etc. for free (the brief's round-trip machinery, `linked/cast.py:8-21`), (b) it is the lowest-common-denominator that every surveyed format down-converts to without loss of topology, and (c) every enrichment lives under a reserved key (`ports`, `portRef`, `zodal`) that plain consumers ignore — `linked` passes unknown attributes through opaquely (brief §5).

The three enrichments:

1. **Bipartite node `kind`** — each node declares `kind: "var" | "func" | "entity"` so meshed's variable/function split survives. (`entity` is the general default for non-meshed graphs.)
2. **A typed-port block on func nodes** — `ports: [{port, param, type, kind, default, required, direction}]`, derived from `sig.ch_names(**bind)` (`base.py:418-433`). This is the single field flat node-link drops.
3. **A `portRef` on links** — `{source, target, sourcePort?, targetPort?}`. `targetPort` is the external input-port name an edge binds to; `sourcePort` the output port (meshed has one `out` per func, so `sourcePort` is usually elided but available for multi-output backends).

### Fallback hub: **GraphML** (for interchange beyond the zodal ecosystem)

When a graph must leave the zodal ecosystem to a tool that already understands ports (yEd, GLSP-based editors), **GraphML is the fallback serialization** — it is the *only* standard with native named ports + `sourceport`/`targetport`. The adapter maps `ports[].port → <port name=…>` and `link.targetPort → edge/@targetport`, pushing `type`/`kind`/`default` into `<data>` keys declared once at graph level. We do **not** make GraphML primary because XML is a poor fit for a TypeScript/JSON/Zod facade and it cannot natively type a port — but it is the right *escape hatch* for cross-tool port-aware interchange.

> **Net:** primary hub = JSON `nodes_and_links` superset (port-aware via reserved keys, free interop via `linked`); fallback hub = GraphML (port-aware standard, for leaving the ecosystem). React Flow's `{nodes, edges, sourceHandle, targetHandle}` is **not a hub** — it is the highest-fidelity *renderer adapter* because its handle model is the closest renderer-side analog to typed ports.

---

## 3. The typed-port representation (canonical model, in-memory + serialized)

This is the load-bearing design. The model reconciles meshed's named/typed argument ports with node↔node formats by making **ports first-class on nodes** and **edges reference ports by name**, while keeping a valid `{source, target}` topology underneath for every non-port-aware consumer.

### 3.1 In-memory shape (TypeScript, the facade's working model)

```ts
/** A typed, kinded connection point on a node. Mirrors one parameter of meshed's Sig. */
interface GraphPort {
  /** External port name — meshed's bind value (sig.ch_names(**bind)). Unique within the node. */
  port: string;
  /** Internal parameter name on the wrapped function (meshed FuncNode param). */
  param?: string;
  /** The port's data type. A Zod type *reference* (registry id) or a JSON type tag. */
  type?: PortTypeRef;          // see §4.3 — resolves to a zodal field affordance
  /** Argument kind — drives connection arity & validation. */
  kind?: 'positional_only' | 'positional_or_keyword' | 'keyword_only'
       | 'var_positional' | 'var_keyword';
  /** Whether the port must be bound for the node to be runnable. */
  required?: boolean;
  /** Default value when unbound (renders as an editable field, per dagapp). */
  default?: unknown;
  /** 'in' (consumes) | 'out' (produces). meshed func nodes have many 'in', one 'out'. */
  direction: 'in' | 'out';
}

interface GraphNode<TData = Record<string, unknown>> {
  id: string;
  /** Bipartite discriminator: meshed var/func split, or generic 'entity'. */
  kind: 'var' | 'func' | 'entity';
  /** The node's *type* — names a NodeTypeDefinition (see §4.1) whose Zod schema drives affordances. */
  type?: string;
  /** Typed ports. Empty for var/entity nodes that connect "as a whole". */
  ports?: GraphPort[];
  /** Node payload — validated against the NodeTypeDefinition's data schema. */
  data?: TData;
  /** Optional layout/presentation hint (renderer-agnostic; see §6). */
  position?: { x: number; y: number };
}

interface GraphEdge<TData = Record<string, unknown>> {
  id: string;
  source: string;            // node id — always present (valid plain-graph topology)
  target: string;            // node id — always present
  sourcePort?: string;       // names an 'out' port on source (elided for single-output nodes)
  targetPort?: string;       // names an 'in' port on target — THE field flat node-link drops
  type?: string;             // names an EdgeTypeDefinition
  data?: TData;
}

interface CanonicalGraph<N = unknown, E = unknown> {
  directed: boolean;
  multigraph: boolean;
  nodes: GraphNode<N>[];
  edges: GraphEdge<E>[];
  /** Graph-level metadata: schema refs, capabilities, overlays, layout. */
  graph: GraphMeta;
}
```

### 3.2 Serialized shape (the JSON on the wire — `nodes_and_links` superset)

```jsonc
{
  "directed": true,
  "multigraph": false,
  "nodes": [
    { "id": "x", "kind": "var" },
    { "id": "y", "kind": "var" },
    {
      "id": "add", "kind": "func", "type": "FuncNode",
      "ports": [
        { "port": "x", "param": "a", "type": "number", "kind": "positional_or_keyword", "required": true,  "direction": "in" },
        { "port": "y", "param": "b", "type": "number", "kind": "keyword_only",          "required": false, "default": 0, "direction": "in" },
        { "port": "out", "type": "number", "direction": "out" }
      ],
      "data": { "funcRef": "mypkg.ops:add", "out": "z", "func_label": "add" }
    }
  ],
  "links": [
    { "id": "e1", "source": "x", "target": "add", "targetPort": "x" },
    { "id": "e2", "source": "y", "target": "add", "targetPort": "y" },
    { "id": "e3", "source": "add", "target": "z", "sourcePort": "out" }
  ],
  "graph": {
    "zodal": {
      "schemaRefs": { "FuncNode": "…", "number": "…" },
      "capabilities": { /* §5 */ },
      "overlays": { /* §6 */ },
      "layout": { /* §6 */ }
    }
  }
}
```

**Why this round-trips and why it degrades gracefully.** `links` keep `{source, target}` as node IDs, so `linked.convert_graph` → `edgelist` / `networkx_digraph` / dataframes works unchanged (the brief's free interop). A consumer that ignores `ports`/`targetPort` sees a valid bipartite graph (the same lossy string view `meshed.dag.graph_ids` already produces, `dag.py:1189-1212`). A meshed-aware consumer reconstructs `FuncNode`s via `from_dict` + a `funcRef` resolver, rebuilding `bind` from `links` where `targetPort` + the func's port `param` give the `{param: source_var}` mapping. The var nodes are the **named rendezvous points** that let "which output feeds which input" survive — exactly the brief's §5 conclusion, now typed.

**Lacing & dagapp layer cleanly on top (no new node kinds).** Interval/tier/provenance annotations attach to nodes via the overlays block (§6), keyed by node id (lacing's `NodeRef.scene_path`), carrying half-open rational time `{v, r}`, a `tier`, a typed `body`, and PROV-O `was_derived_from` (itself a derivation sub-DAG over node ids). dagapp's `{value, arg_type, widget, range}` is **derivable from a `var` node's resolved port type** — it is a presentation projection, not stored state.

---

## 4. Zod v4 schema-modeling sketch

The facade **reuses zodal's existing field-affordance inference** (the brief's substrate §1): node/port *types* are ordinary Zod object/scalar schemas, so `defineCollection`'s 6-layer merge, the `.meta()` + WeakMap `affordanceRegistry` channel, and the `RendererRegistry` predicates all apply unchanged. Graph-ness is expressed as **`.meta()` annotations that ride the registry** (so they survive `.optional()`/`.default()` wrapping, per `registry.ts:51-90`) plus a thin `defineGraph` facade analogous to `defineCollection`.

### 4.1 Node types — a Zod object per node type; edges/ports declared via `.meta()`

```ts
import { z } from 'zod';
import { affordanceRegistry } from '@zodal/core';

// A node TYPE is just a Zod object schema. Its fields flow through the SAME
// inference pipeline as a collection's fields (getTypeDefaults → refineBy* → meta → registry).
const TaskNode = z.object({
  id: z.uuid(),
  title: z.string(),
  status: z.enum(['todo', 'doing', 'done']),     // → filterable:'select', groupable:true (free, from inference)
  estimate: z.number().min(0),                    // → filterable:'range'
}).meta({
  graph: {
    nodeType: 'Task',
    kind: 'entity',                               // 'var' | 'func' | 'entity'
    labelField: 'title',
  },
});
```

### 4.2 Edge types — declared as relations, riding the same `.meta()` channel as `belongsTo`/`hasMany`

```ts
// Edge TYPES are declared once at graph level, OR as relation fields on a node schema.
// A relation field is a reference (ContentRef-analog), not inline data — the brief's §3 precedent.
const dependsOnPort = z.string();                 // inner schema FIRST...
affordanceRegistry.register(dependsOnPort, {      // ...register BEFORE wrapping (Zod v4 .meta() loss fix)
  graph: { edgeType: 'dependsOn', relation: 'hasMany', targetNodeType: 'Task', direction: 'out' },
});

const TaskNodeWithDeps = TaskNode.extend({
  dependsOn: dependsOnPort.array().optional(),    // wrapping is now safe; registry keyed on inner identity
});
```

### 4.3 Port types — a port is a typed parameter; its type is a Zod schema, kind/required ride `.meta()`

```ts
// For meshed-class func nodes, ports are derived from a Sig but MODELED as a Zod object
// whose KEYS are port names and whose VALUES are the port's type schema.
const addPorts = z.object({
  x: z.number(),                                  // port 'x' : number
  y: z.number().default(0),                       // port 'y' : number, default 0 → required:false
}).meta({
  graph: {
    nodeType: 'FuncNode', kind: 'func',
    ports: {
      x: { param: 'a', kind: 'positional_or_keyword', direction: 'in' },
      y: { param: 'b', kind: 'keyword_only',          direction: 'in' },
    },
    output: { port: 'out', type: 'number' },
    funcRef: 'mypkg.ops:add',
  },
});
// Port type, required, default, enumValues, numericBounds all come from zodal's EXISTING
// getZodBaseType / getNumericBounds / getEnumValues introspection — nothing new to infer.
```

### 4.4 Graph-level affordances — `defineGraph`, analogous to `defineCollection`

```ts
import { defineGraph } from '@zodal/graph';   // the new facade

const taskGraph = defineGraph({
  nodeTypes: { Task: TaskNodeWithDeps },
  edgeTypes: { dependsOn: { source: 'Task', target: 'Task', portAware: false } },
  affordances: {
    editable: true,                 // structural CRUD on (cluster A)
    typedPorts: false,              // no meshed-class ports here (cluster B)
    executable: false,              // not a runnable DAG (cluster E)
    provenance: false,              // no lineage overlay (cluster F)
    traversal: ['ancestors', 'descendants', 'find-path'],  // cluster D overlays to expose
    defaultView: 'node-link',       // 'node-link' | 'table' | 'timeline' | 'matrix' | 'form'
  },
});
// Returns a GraphDefinition carrying: resolved node/edge/port affordances (reusing
// ResolvedFieldAffordance), getCapabilities(), and the generators that emit renderer config.
```

**What is genuinely new vs. reused.** *Reused:* the entire field-inference pipeline, `affordanceRegistry`, `ResolvedFieldAffordance` (its index signature `types.ts:341` carries `graph.*` metadata), the `RendererRegistry`/tester scoring, the generator pattern, the framework-agnostic state store. *New:* `defineGraph` (facade), the `graph.*` `.meta()` whitelist additions in `extractAffordancesFromMeta` (`inference.ts:423`), a small set of `RendererTester` predicates (`hasTypedPorts`, `isExecutable`, `nodeCountAtLeast`), and the canonical-graph serializer/adapters.

---

## 5. Graph capabilities vocabulary + renderer-selection rule

### 5.1 `GraphCapabilities` — analogous to `ProviderCapabilities` / `getCapabilities()`

Declared by a graph definition *and* reported honestly by a graph data provider (the brief's honest-capability-reporting principle). Drives both renderer selection and which affordances the UI exposes.

```ts
interface GraphCapabilities {
  // --- Structure (cluster A) ---
  canAddNode: boolean;
  canDeleteNode: boolean;
  canEditNode: boolean;
  canAddEdge: boolean;
  canDeleteEdge: boolean;
  canReverseEdge: boolean;
  // --- Typed ports (cluster B — the tool-deciding capability) ---
  typedPorts: boolean;              // nodes carry typed/kinded ports
  validatesConnections: boolean;    // connect-time type checking (isValidConnection-class)
  // --- Composition (cluster C) ---
  canExtractSubgraph: boolean;      // universal: appears in every regime
  canCollapseToComponent: boolean;  // meshed round-trip
  // --- Execution / dynamics (cluster E) ---
  executable: boolean;              // graph is a runnable program
  canStep: boolean;
  watchesValues: boolean;           // dataflow value-watching on-canvas
  // --- Provenance / lineage (cluster F) ---
  hasProvenance: boolean;           // was_derived_from lineage present
  canTimeTravel: boolean;           // replay-state-at-time
  // --- Traversal overlays (cluster D — renderer-agnostic) ---
  traversal: TraversalKind[];       // which overlays the compute backend can produce
  // --- Representation (cluster I) ---
  views: GraphView[];               // 'node-link' | 'table' | 'matrix' | 'timeline' | 'form'
  // --- Scale (drives renderer family) ---
  scaleClass: 'small' | 'medium' | 'large' | 'huge';  // <50 | <2k | <50k | 50k+
  // --- Interval/time (cluster — lacing) ---
  hasIntervals: boolean;            // interval-keyed annotations (timeline)
}
```

`DEFAULT_GRAPH_CAPABILITIES` mirrors `DEFAULT_CAPABILITIES` (`capabilities.ts:45-56`): read-only, no ports, not executable, `views: ['node-link','table']`, `scaleClass:'small'`. A provider omitting `getGraphCapabilities()` is assumed minimal.

### 5.2 The renderer-selection rule (declared capabilities × runtime signals)

Selection is the existing `RendererRegistry.resolve` mechanism (linear scan, highest tester score wins, PRIORITY bands `tester.ts:15-26`) — *no registry change*. We add graph-aware testers that read `GraphCapabilities` + **runtime signals** (live node count, whether ports are present, editing toggle, provenance presence, scale class) off the resolve `context`. Renderer families are the brief's five (§e).

**The rule, in priority order (each line is a tester returning a PRIORITY band on match, `-1` otherwise):**

1. **`views` excludes `node-link` (the table/timeline-native regimes)** → **TanStack Table** (the universal 12/12 surface) or **Timeline-track** renderer if `hasIntervals`. `OVERRIDE` band — an explicit non-graph `defaultView` always wins. *(lacing, dagapp form-first, the "not-a-graph" regime.)*
2. **`typedPorts && validatesConnections && canEditNode && scaleClass==='small'`** → **React Flow** (typed handles + `isValidConnection` — the only family that does cluster-B). `APP` band. **Rete.js** is the alternate for pure dataflow. *(meshed, ij edit-slice, graph_dbs edit-slice.)*
3. **`executable && watchesValues && scaleClass==='small'`** → **React Flow** with value-watch overlay; if `!watchesValues && canStep` and linear topology → **stepper + form** renderer. `APP` band. *(executable-DAG dynamics; aw/muvid/coact linear steppers.)*
4. **`scaleClass` rises (`medium`→`large`→`huge`) AND editing/ports drop** → **Cytoscape.js** (medium, built-in algorithms) → **sigma.js** (large, lighter) → **cosmograph** (huge, GPU). `LIBRARY` band, score increasing with scale. *(cosmograph, linked k-NN, large graph_dbs scenes, networkx-laid-out large graphs.)*
5. **Fallback when node-link adds nothing** (e.g. `nodeCount` tiny, no edges, or all metadata non-displayable inline) → **TanStack Table**. `FALLBACK` band. *(aw's flat point cloud, degenerate cases.)*

**Two cross-cutting rules that are renderer-agnostic, not a renderer choice:**
- **Traversal & provenance overlays** (clusters D & F: path, ancestors/descendants, stale-set, critical-path, communities, centrality) are computed once by a **networkx-class backend** and emitted as **highlight/style data** (§6) that *whatever* node-link renderer is currently selected consumes. They are modeled once, never per renderer — the brief's central bet.
- **The graph-DB explorer is a composition of (1)+(2)**, not a sixth family: React Flow scene + TanStack results table + a query editor + paging + schema meta-graph. The selection rule naturally produces this by resolving the scene region and the result region independently.

---

## 6. Renderer-agnostic overlay / selection / styling / layout config (serializable data)

All of this is **plain serializable data in `graph.zodal.overlays` / `.layout`** — any renderer consumes it; no renderer owns it. This is what lets traversal/provenance be modeled once.

```ts
interface GraphOverlays {
  /** Result of a traversal/provenance computation: node/edge id → visual role. */
  highlights: {
    /** e.g. 'path' | 'ancestors' | 'descendants' | 'stale' | 'cycle' | 'critical-path' | 'community' */
    layer: string;
    nodes: Record<string /*nodeId*/, HighlightRole>;   // 'primary' | 'related' | 'dimmed' | 'stale' | ...
    edges?: Record<string /*edgeId*/, HighlightRole>;
  }[];
}

interface GraphSelection {
  nodes: string[];                  // selected node ids (drives extract-subgraph universally)
  edges: string[];
  /** A named, saved selection → reusable "scene"/subgraph (cluster C). */
  name?: string;
}

interface GraphStyling {
  /** Style-by-attribute: declarative mapping from a node/port field to a visual channel. */
  rules: {
    target: 'node' | 'edge' | 'port';
    field: string;                  // a resolved affordance field name
    channel: 'color' | 'size' | 'shape' | 'opacity' | 'stroke';
    scale: { kind: 'categorical' | 'linear' | 'threshold'; domain?: unknown[]; range: unknown[] };
  }[];
  legends?: { field: string; title: string }[];
}

interface GraphLayout {
  /** Layout is a HINT carried as data; renderers may honor or recompute. */
  algorithm: 'preset' | 'dagre' | 'elk' | 'force' | 'circular' | 'hierarchical';
  /** When 'preset', positions come from node.position; else algorithm params here. */
  params?: Record<string, unknown>;
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
}
```

The styling `rules` reuse resolved field affordances (enum values, numeric bounds) the existing generators already compute, so `style-by-attribute` is "free" once a field is resolvable. Selection feeds `extract-subgraph` (the single highest-leverage affordance — appears in *every* regime). Layout is a hint, not state — a renderer with its own layout engine (React Flow + dagre, cosmograph's force-sim) may override it; a `preset` layout pins positions from `node.position`.

---

## 7. Adapters list (canonical hub ↔ existing formats/renderers)

| Adapter | Direction | Port fidelity | Notes |
|---|---|---|---|
| **`linked` `nodes_and_links`** | both | full (superset) | Native — the hub *is* this shape plus reserved keys. Free transitive interop to edgelist/networkx/dataframes/adjacency. |
| **meshed `FuncNode`/`DAG`** | both | full | `to_dict`/`from_dict` + `funcRef` resolver; `bind` reconstructed from `links.targetPort` + port `param`. The canonical source of typed ports. |
| **networkx node-link** | both | lossy (ports→opaque attrs) | Drop ports into node attrs; topology exact. Round-trip via `linked`. [1] |
| **React Flow / xyflow** | both | **high (handle = port)** | `port → handle id`; `targetPort → edge.targetHandle`. Highest-fidelity *renderer* adapter. Typing enforced via generated `isValidConnection`. [6] |
| **Rete.js** | both | high (socket = port) | Alternate dataflow renderer; `port type → socket`. [14] |
| **Cytoscape.js JSON** | both | lossy (no ports) | `{data:{id,source,target}}`; compound `parent` ≠ ports. Medium-scale viz + built-in algorithms. [5] |
| **graphology `SerializedGraph`** | both | lossy (ports→attributes) | MIT, active; good for sigma.js viz pipeline. [3][4] |
| **GraphML** | both | **full (native ports)** | The fallback hub; `<port name>` + `sourceport`/`targetport`; type/kind into `<data>`. For leaving the ecosystem. [7][8] |
| **GEXF** | export-mostly | lossy (no ports) | CC-BY; use for Gephi + **dynamic/timeline** via `<spells>` (lacing intervals). [9][10] |
| **JGF** | both | lossy (no ports) | Apache-2.0; generic JSON interchange; hyperedge support if needed. [2] |
| **D2 / Mermaid** | export-only | partial / none | Output adapters for static diagram-as-code; D2 sub-shape addressing approximates ports. [13] |
| **TanStack Table column/row** | export (view projection) | n/a | The 12/12 universal table view: nodes→rows, or edges→edge-list rows; reuses zodal's existing `toColumnDefs`. |
| **lacing annotation store** | both | n/a (overlay) | Interval/tier/provenance overlays keyed by node id; rational `{v,r}` time, Allen relations, PROV-O `was_derived_from`. |

---

## 8. Prior-art / don't-reinvent assessment

- **Hub format — don't invent a new graph JSON.** `nodes_and_links` is a public idiom that `linked` already canonicalizes and converts to ~12 forms. We add three reserved keys, not a new format. ✓ reuse.
- **Typed ports — no standard carries them typed; *one* (GraphML) carries them named.** Confirmed by the survey: ports are a zodal enrichment, not a delegated feature. Sprotty/GLSP's first-class `GPort` and Rete.js's typed sockets validate the *concept*; React Flow handles validate the *renderer mapping*. We borrow the concept, implement the typed payload ourselves. ✓ justified new work, externally validated.
- **Source-model vs graphical-model split — already invented by Sprotty/GLSP.** Their `GModelFactory` (source → graphical) is exactly the facade→renderer-config generator. We adopt the *architecture* (a semantic canonical model distinct from renderer-facing config), reject the *stack* (EPL, Java, Eclipse, InversifyJS-DI, server-centric). ✓ borrow pattern.
- **Renderers — don't build a graph renderer.** React Flow (typed handles + validation), Rete.js (dataflow), Cytoscape.js / sigma.js / cosmograph (viz at scale), TanStack Table (the universal table), vis-timeline/D3 (timeline) all exist and are the registry's selectable targets. The facade *selects and feeds* them; it renders nothing itself. ✓ reuse-over-rebuild, the project's core principle.
- **Inference / registry / state — already in zodal.** The facade is a *thin* extension of `defineCollection`'s machinery, not a parallel system. ✓ reuse.
- **Layout — don't write a layout engine.** dagre/ELK (used by React Flow, D2, Sprotty) and force engines (cosmograph) are carried as a `GraphLayout` *hint*; renderers run their own. ✓ reuse.

**The genuinely new surface is small and well-bounded:** `defineGraph`, the `graph.*` `.meta()` whitelist, ~3 renderer testers, the canonical serializer + adapters, and the renderer-agnostic overlay/styling/selection/layout data shapes. Everything else is borrowed or reused.

---

## 9. Risks / unknowns

1. **`funcRef` resolution is out of scope but load-bearing.** The canonical model serializes a *reference* to a function (qualname / import-path / content hash), not the function. Round-tripping a runnable meshed DAG requires a resolver the consumer supplies. Cross-language (Python meshed ↔ TS facade) makes this acutely hard: a TS facade cannot *execute* a Python `FuncNode`. **Open question:** is the TS facade ever the *executor*, or only the *editor/viewer* that hands a serialized graph back to a Python runtime? The brief implies the latter for meshed/dagapp; confirm.

2. **Typed-port *validation* semantics are not in any serialization format.** GraphML/React Flow carry *which* port; *whether a connection is type-valid* (cluster-B `validate-connection-by-type`) is a runtime predicate. We can *generate* an `isValidConnection` from Zod types, but structural type compatibility (is `z.number()` connectable to `z.number().min(0)`? to `z.union([z.number(), z.string()])`?) needs a defined subtyping rule. **Unknown:** the compatibility relation over Zod v4 types — likely a new small module, possibly reusing zodal introspection but no existing precedent.

3. **Variadic ports (`*args`/`**kwargs`).** meshed `handle_variadics` (`base.py:108`) normalizes these, but a variadic port has *unbounded* arity. The `kind: 'var_positional' | 'var_keyword'` tag captures it, but how a renderer draws "N handles for one `*args` port" and how edges address `args[0]` vs `args[1]` is unspecified. React Flow needs distinct handle ids per slot. **Unknown:** addressing scheme for variadic port slots.

4. **Bipartite var/func vs. plain entity graphs — one model, two mental models.** Forcing every graph into a var/func split is wrong for non-meshed graphs (a social network has no "var" nodes). The `kind: 'entity'` escape works, but mixing `entity` + `func` + `var` in one graph (e.g. graph_dbs results piped into a meshed pipeline) needs a clear rule for when ports apply. **Risk:** the bipartite enrichment leaks complexity into the common (portless) case if not carefully defaulted.

5. **Overlay scale.** Renderer-agnostic highlight data is `Record<nodeId, role>`. For cosmograph-scale graphs (100k–1M nodes) this map is itself huge; shipping it as JSON per-overlay is infeasible. **Unknown:** at `scaleClass: 'huge'`, overlays likely need a compute-on-the-renderer or columnar/typed-array representation, not a JSON record — a different mechanism than small-graph overlays.

6. **Timeline integration is the thinnest off-the-shelf path.** The brief flags the timeline-track renderer (lacing/nw) as most likely to need bespoke glue; GEXF `<spells>` and vis-timeline exist but neither speaks rational `{v,r}` time or Allen relations. **Risk:** the interval/Allen overlay may need a custom renderer + a custom adapter, the largest bespoke-build risk in the whole facade.

7. **Codegen round-trip for graph metadata.** The brief warns (substrate §4) that relation metadata must be added to *both* `extractAffordancesFromMeta`'s whitelist *and* `FIELD_PROP_ORDER` or it won't round-trip through `toCode`. The `graph.*` block is nested; whether the existing codegen serializes nested meta objects faithfully is unverified. **Unknown — verify against `codegen.ts`.**

8. **License compatibility of the *fallback* path.** GraphML's spec is freely usable and GEXF is CC-BY-4.0 (attribution-only) — both fine to *implement against*. No copyleft risk in any recommended primary path (all MIT/BSD/Apache). ✓ no known blocker, but GEXF's CC-BY attribution should be noted in docs if we ship a GEXF adapter.

---

## References

[1] [NetworkX — `node_link_data` documentation (node-link JSON format)](https://networkx.org/documentation/stable/reference/readwrite/generated/networkx.readwrite.json_graph.node_link_data.html). NetworkX 3.6.x, BSD-3-Clause, actively maintained (2025).

[2] [JSON Graph Specification (JGF) — jsongraph/json-graph-specification](https://github.com/jsongraph/json-graph-specification). Apache-2.0; v1.0 (2019), hyperedges added 2021; no port support, edges reference node IDs directly. Spec site: [jsongraphformat.info](https://jsongraphformat.info/).

[3] [Graphology — Serialization (`SerializedGraph` shape)](https://graphology.github.io/serialization.html). `attributes`/`nodes`/`edges`/`options`; edges carry `key`/`source`/`target`/`attributes`/`undirected`; no reserved port schema.

[4] [Graphology — GitHub repository](https://github.com/graphology/graphology). MIT license; v0.26.0 (Feb 2025), 66 releases — actively maintained.

[5] [Cytoscape.js — official documentation (elements JSON, compound `parent`)](https://js.cytoscape.org/). MIT; `{data:{id,source,target}}`; compound nodes via `parent`, no native ports.

[6] [React Flow / xyflow — Handles (ports) documentation](https://reactflow.dev/learn/customization/handles) and [xyflow GitHub repository](https://github.com/xyflow/xyflow). MIT; `@xyflow/react` 12.11 (Jun 2026), 37k★ — very actively maintained; `sourceHandle`/`targetHandle` = port-level edges.

[7] [GraphML Primer — Ports section (Brandes et al.)](https://www.inf.uni-konstanz.de/exalgo/publications/belp-g-13.pdf). First-class `<port name>` children of `<node>`; edges carry optional `sourceport`/`targetport`.

[8] [yFiles — Ports in The Graph Model (GraphML port semantics)](https://docs.yworks.com/yfiles-html/dguide/graph/graph_model-ports.html). Ports identified by unique `name` within a node; edges connect to ports by name.

[9] [GEXF File Format — Gephi Desktop Documentation](https://docs.gephi.org/desktop/User_Manual/Import/GEXF_File_Format/). XSD-typed attributes; dynamic graphs via `<spells>` (intervals/timestamps).

[10] [GEXF Format Specifications — gephi/gexf (GitHub)](https://github.com/gephi/gexf). Spec licensed CC-BY-4.0; no native ports.

[11] [Eclipse GLSP — Graphical Model (GModel: GNode, GEdge, GPort)](https://eclipse.dev/glsp/documentation/gmodel/) and [Sprotty — Eclipse project page](https://projects.eclipse.org/projects/ecd.sprotty). EPL-2.0; SModel/SGraph with first-class semantic `GPort`; source-model → graphical-model via `GModelFactory`.

[12] [Eclipse GLSP — "How to handle ports" (Discussion #371)](https://github.com/eclipse-glsp/glsp/discussions/371). Confirms ports carry semantic meaning ("it makes a difference to which port an edge is connected").

[13] [D2 — terrastruct/d2 (declarative diagram language)](https://github.com/terrastruct/d2) and [D2 FAQ](https://d2lang.com/tour/faq/). MPL-2.0 (language/CLI/dagre+ELK layouts/themes); open-sourced Nov 2022; sub-shape connection addressing approximates ports.

[14] [Rete.js — Sockets (typed connections) documentation](https://retejs.org/docs/concepts/editor/) and [retejs/rete (GitHub)](https://github.com/retejs/rete). MIT; typed sockets decide connectability — the other JS lib (besides React Flow) supporting cluster-B typed-port editing.
