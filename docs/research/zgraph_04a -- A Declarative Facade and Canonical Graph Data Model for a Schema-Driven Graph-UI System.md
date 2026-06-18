# A Declarative Facade and Canonical Graph Data Model for a Schema-Driven Graph-UI System

*Author: Thor Whalen — Technical research survey, June 2026*

## TL;DR

- **Adopt a thin, neutral, node-link canonical hub** — a graphology-shaped `{ attributes, nodes:[{key,attributes}], edges:[{key,source,target,attributes,undirected}] }` envelope, extended with a first-class `ports` array on nodes and `sourcePort`/`targetPort` fields on edges. This is the single serializable source of truth (SSOT) from which thin adapters project React Flow, Cytoscape.js, Sigma/graphology, ELK, GEXF/GraphML, and networkx node-link. Every renderer/back-end format is reachable by a pure function from this hub.
- **Keep three concerns physically separate and independently serializable**: (1) **topology** (the canonical hub: nodes, edges, ports), (2) **schema/affordances** (Zod v4 schemas + `z.registry()` metadata declaring node/edge/port types and graph-level capabilities), and (3) **presentation/overlays** (a Mapbox-/Vega-Lite-style "style spec" layer carrying selection, styling, layout positions, and traversal/provenance overlays). Switching renderers preserves intent because intent never lives inside a renderer's own format.
- **Select renderers by a capability-ranked registry** modeled on `navigator.mediaCapabilities.decodingInfo()` and content negotiation: each renderer publishes a `getCapabilities()` descriptor, the facade computes required capabilities from declared affordances + runtime signals (node count, ports present, editing enabled), and ranks candidates. **Primary recommendation: build the thin facade on the graphology hub + xyflow/React Flow (typed-port editing, <~1–2k nodes) with Sigma.js/graphology (WebGL, tens of thousands+) as the scale fallback.** Wrap, don't rebuild.

## Key Findings

1. **No existing JSON graph format models typed ports as first-class citizens except ELK and the node-editor families.** graphology, JSON Graph Format (JGF), Cytoscape.js, networkx node-link, GraphML and GEXF all model only node→node edges. Port-level connections (React Flow `sourceHandle`/`targetHandle`, Rete sockets, ComfyUI `[nodeId, slot]` links, NodeGraphQt `{"out":[id,port],"in":[id,port]}`) are a near-universal convention but are *renderer-specific extensions*. The one mature interchange format with native ports is **Eclipse ELK's JSON** (`ports:[…]` on nodes; edges via `sources`/`targets` that may name ports). The canonical hub therefore must carry ports explicitly and degrade gracefully when projecting to port-less formats.

2. **graphology's serialized format is the best neutral hub** because it is (a) a documented, stable, round-trippable JSON shape; (b) backed by a full in-memory `Graph` object with directed/undirected/mixed and multigraph support; (c) the data layer Sigma.js already consumes — Sigma.js is, per its README, "an open-source JavaScript library aimed at visualizing graphs of thousands of nodes and edges using WebGL … built on top of graphology"; and (d) trivially bijective with networkx node-link and JGF. Cytoscape.js and React Flow shapes are *renderer* formats (they fuse position/style into the topology) and make poorer neutral hubs.

3. **Zod v4 gives you exactly the primitives this design needs**: `z.discriminatedUnion` for node/edge/port type tagging, `z.registry()` / `.meta()` for attaching renderer-agnostic capability metadata *without polluting the validated data*, `z.toJSONSchema()` for back-end/SSOT export, recursive getters for nested/compound graphs, and branded types for `NodeId`/`PortId`/`EdgeId` nominal safety.

4. **Renderer scale thresholds are real and should drive selection.** The most-cited concrete numbers trace to Timothy Lin's Cylynx comparison citing yWorks: "Using a 2015 macbook, SVG performance … reaches 2k nodes and 2k edges. Canvas performance reaches the limit at 5k nodes and 5k edges while WebGL is usable until 10k nodes and 11k edges." yWorks' own docs add that WebGL "is more suitable for larger graphs (from 1,000 nodes upwards)." At the extreme, Cosmograph (per Nikita Rokotyan in *Nightingale*) shows "a network visualization that has 133K nodes and 321K edges" and is described as "capable of visualizing networks that have a million nodes and edges, and that's not the limit!" The selection rule must treat "typed-port editing" and "scale class" as largely orthogonal capability axes — you rarely get both in one renderer.

5. **The "separate style layer" pattern is well-proven** — Mapbox GL style spec (source vs. `layout`/`paint`, data-driven expressions), Vega-Lite (data vs. marks vs. encoding channels), Cytoscape.js selector/style, GEXF `viz:` namespace, and ELK `layoutOptions`. Borrow the *separation* and the *data-driven expression* idea; avoid adopting any one vendor's full vocabulary.

## Details

### Q1 — Canonical data model (with a concrete typed-port representation)

**Format comparison.** The candidate hub formats divide into *neutral topology formats* and *renderer formats*:

| Format | Shape (core) | Directed/Multi | Attributes | Native ports? | Style/position in topology? | Round-trip fidelity | Verdict as neutral hub |
|---|---|---|---|---|---|---|---|
| **graphology serialized** | `{attributes, nodes:[{key,attributes}], edges:[{key,source,target,attributes,undirected}]}` | mixed + multigraph | per-element `attributes` bag | no (add via convention) | no (kept in attributes only if you choose) | high (backed by live Graph object) | **Best hub** |
| **JSON Graph Format (JGF)** | `{graph:{nodes:{id:{…}}, edges:[{source,target,…}], metadata}}` | directed flag | `metadata` objects everywhere | no | no | high; JSON-Schema-validated; child schemas | Strong standard alt. |
| **networkx node-link** | `{directed,multigraph,graph,nodes:[{id,…}],links:[{source,target,key}]}` | yes/yes | inline on node/link | no | no | high (Python SSOT) | Best Python bridge |
| **Cytoscape.js** | `{elements:{nodes:[{data,position,…}],edges:[{data:{source,target}}]}}` | via data | `data` bag + `position`,`selected`,`classes` | no (compound `parent` only) | **yes (position/selected fused)** | medium (style separate) | Renderer, not hub |
| **React Flow / xyflow** | `nodes:[{id,type,position,data}]`, `edges:[{id,source,target,sourceHandle,targetHandle,data}]` | directed | `data` bag | **yes (handles + sourceHandle/targetHandle)** | **yes (position fused)** | medium | Renderer; port reference model to copy |
| **GraphML** | XML `<graph><node><edge>` + typed `<key>` attrs | directed/undirected | typed keys | **ports (`<port>`) in spec, weakly supported** | no (separate) | medium (XML) | Archival/interchange |
| **GEXF** | XML; `<nodes><edges>` + `viz:` namespace | yes | typed `<attribute>` | no (hierarchy only) | **yes (`viz:position/color/size`)** | medium | Archival + viz hints |
| **ELK JSON** | `{id,children:[{ports:[…]}],edges:[{sources,targets}]}` | layout-oriented | `layoutOptions` | **yes (first-class `ports`)** | yes (computed x/y/size) | high for layout | Layout sidecar, not topology hub |

**Recommended canonical hub.** Use the graphology envelope as the spine and extend it minimally so ports are first-class. A concrete, serializable shape:

```jsonc
{
  "attributes": { "directed": true, "schemaId": "FlowGraph@1", "scaleClass": "interactive" },
  "nodes": [
    {
      "key": "n1",
      "attributes": { "type": "Transform", "label": "Scale", "data": { "factor": 2 } },
      "ports": [
        { "id": "in",  "direction": "in",  "portType": "Number" },
        { "id": "out", "direction": "out", "portType": "Number", "multiple": true }
      ]
    }
  ],
  "edges": [
    {
      "key": "e1",
      "source": "n1", "sourcePort": "out",
      "target": "n2", "targetPort": "in",
      "undirected": false,
      "attributes": { "type": "DataFlow" }
    }
  ]
}
```

**Why this representation of typed ports.** The decisive empirical finding from surveying React Flow, Rete.js, Litegraph/ComfyUI, NodeGraphQt, Blender geometry nodes, Eclipse GLSP/Sprotty, and ELK is that *every* port-capable system reduces a port-level connection to **a pair of `(node_id, port_id)` references** plus a per-port *type token*:

- **React Flow / xyflow**: edges carry `source`,`sourceHandle`,`target`,`targetHandle`; the docs state that "A handle (also known as a 'port' in other libraries) is the attachment point where an edge connects to a node. By default, they appear as grey circles on the top, bottom, left, or right sides of a node."
- **Rete.js**: `Connection(sourceNode, 'portKey', targetNode, 'portKey')`; sockets carry a type-name and connections are allowed only between compatible sockets.
- **ComfyUI/Litegraph**: links serialize as `[link_id, upstream_node_id, output_slot, downstream_node_id, input_slot, data_type]`.
- **NodeGraphQt**: `{"out":[node_id, port_name], "in":[node_id, port_name]}` with per-port `add_accept_port_type`.
- **BaklavaJS**: connections reference per-interface IDs (`from`/`to` = NodeInterface `id`); interfaces carry a `NodeInterfaceType`.
- **Eclipse ELK**: nodes have a `ports` array; extended edges' `sources`/`targets` arrays name node *or* port ids.
- **Python `meshed`** (the function-network analogue): a `FuncNode` exposes named parameters (input "ports") and named outputs (`out`), and the DAG is wired purely by *matching var-node names* — i.e. ports are named typed slots and edges are implied by shared names. This validates modeling ports as **named, typed slots keyed within their node**, with edges referencing `(node, portName)`.

Therefore the canonical model represents ports as a **per-node keyed collection** (`ports[].id` unique within the node) carrying `direction` (`in`/`out`/`inout`) and `portType` (a token resolvable against the schema's port-type registry), and edges carry optional `sourcePort`/`targetPort`. When `sourcePort`/`targetPort` are absent, the edge is an ordinary node→node edge — so the model is a strict superset of every port-less format and degrades to them by dropping the `ports`/`*Port` fields.

**Adapters (all pure, mostly bijective except where noted):**

| Adapter | Direction | Notes / lossy points |
|---|---|---|
| `toGraphology` / `fromGraphology` | both | identity-ish; ports live in node attributes for vanilla graphology |
| `toReactFlow` / `fromReactFlow` | both | `ports`→`Handle` ids; `sourcePort`→`sourceHandle`; positions pulled from the **overlay layer**, not topology |
| `toCytoscape` / `fromCytoscape` | both | `{data, position}`; ports collapse to node (Cytoscape has no ports) → port info preserved in `data` for round-trip |
| `toSigma` (graphology) | one-way render | graphology already native; x/y from layout overlay |
| `toELK` / `fromELK` | both | **native ports**; round-trips port-level edges; returns computed x/y back into overlay |
| `toGEXF` / `toGraphML` | export | archival; ports → GraphML `<port>` (weak) or attributes; `viz:`/positions from overlay |
| `toNodeLink` / `fromNodeLink` | both | networkx bridge for Python back-ends; ports → node attribute |
| `toJGF` / `fromJGF` | both | standards-track interchange; metadata bags |

### Q2 — Schema modeling in Zod v4

The facade declares **type catalogs** (node types, edge types, port types) and **graph-level affordances** as Zod schemas; per-field affordances are inferred by reusing the existing collection-inference machinery (the same way zodal already infers field capabilities for collections). A shallow sketch (kept intentionally generic since the actual zodal code is not in view):

```ts
import * as z from "zod";

// Branded ids for nominal safety
const NodeId = z.string().brand<"NodeId">();
const PortId = z.string().brand<"PortId">();

// A registry carries renderer-agnostic capability metadata, NOT validated data
const graphMeta = z.registry<{
  capabilities: GraphCapabilities;     // see Q3 vocabulary
  portCatalog?: string[];
}>();

// Port type: a named, typed slot
const Port = z.object({
  id: PortId,
  direction: z.enum(["in", "out", "inout"]),
  portType: z.string(),                 // resolvable token, e.g. "Number"
  multiple: z.boolean().default(false),
});

// Node TYPES via discriminated union (tag = "type")
const TransformNode = z.object({
  type: z.literal("Transform"),
  data: z.object({ factor: z.number() }),
  ports: z.array(Port),
});
const SourceNode = z.object({
  type: z.literal("Source"),
  data: z.object({ uri: z.string() }),
  ports: z.array(Port),
});
const NodeSchema = z.discriminatedUnion("type", [TransformNode, SourceNode]);

// Graph-level affordances declared once, attached via registry/meta
const FlowGraph = z.object({
  attributes: z.object({ directed: z.boolean() }),
  nodes: z.array(z.object({ key: NodeId, attributes: NodeSchema })),
  edges: z.array(z.object({
    key: z.string(), source: NodeId, target: NodeId,
    sourcePort: PortId.optional(), targetPort: PortId.optional(),
  })),
}).meta({
  id: "FlowGraph@1",
  capabilities: {
    editable: true, executable: true, hasProvenance: false,
    directed: true, typedPorts: true, scaleClass: "interactive",
  },
});
```

**What to borrow / avoid from prior art:**
- **Borrow from Sprotty/GLSP**: the *graphical model is a serializable description* separate from the source model, and the server advertises which node/edge types and operations are legal — a clean precedent for "schema declares types + affordances, renderer just renders." GLSP's `GModelElementSchema` (every element has `id` + `type` used to look up a view) maps directly onto the discriminated-union `type` tag.
- **Borrow from mermaid/PlantUML/D2**: a terse declarative *authoring* surface is valuable, but these are presentation DSLs with weak data models — keep them as optional import/export skins, not the SSOT.
- **Borrow from JSON-schema-driven form/flow builders**: drive UI from schema, but avoid letting JSON-Schema's expressiveness gaps leak into the canonical model. Concretely, Zod's JSON-Schema docs list `z.bigint()`, `z.int64()`, `z.symbol()`, `z.undefined()`, `z.void()`, `z.date()`, `z.map()`, `z.set()` as "unrepresentable" types that `z.toJSONSchema()` will *throw* on unless you pass `unrepresentable: "any"` (default target is JSON Schema "Draft 2020-12"). Keep the canonical model within the representable subset.
- **Avoid**: encoding presentation (x/y, color) inside the validated node schema — that belongs in the overlay layer (Q4). Zod v4 `.meta()`/registries are explicitly designed so metadata "isn't stored inside the schema itself."

Zod v4 specifics that matter here: `z.toJSONSchema()` (native, replaces `zod-to-json-schema`) for emitting the SSOT to back-ends; recursive getters (`get subnodes(){ return z.array(NodeSchema) }`) handle compound/nested graphs; `z.globalRegistry` special-cases `id` (throws on duplicates), which is convenient for a node-type registry. **Note the union→JSON-Schema mapping evolved:** an early Zod v4 issue (#4089, Sam Chung) flagged that mapping `z.union()` to `oneOf` was "technically incorrect as Zod proceeds as soon as a single schema matches so it should be anyOf." This was subsequently fixed — as of Zod v4.1.13, `z.union()` maps to `anyOf` and `z.discriminatedUnion()` maps to `oneOf` (confirmed in issue #5807). Prefer `z.discriminatedUnion` for node/edge/port type tags both for validator performance and for clean `oneOf` output.

### Q3 — Capability-based renderer selection

**Capability vocabulary (a graph `getCapabilities()` descriptor).** Modeled on `mediaCapabilities.decodingInfo()` returning `{supported, smooth, powerEfficient}` and on plugin capability descriptors:

```ts
interface RendererCapabilities {
  renderer: string;                    // "reactflow" | "sigma" | "cytoscape" | "cosmograph" | "table"
  // hard support (boolean gates)
  typedPorts: boolean;                 // can render/edit port-level handles
  editing: boolean;                    // node/edge create/move/delete
  compoundNodes: boolean;              // nesting/containers
  directed: boolean; undirected: boolean; multigraph: boolean;
  provenanceOverlay: boolean;          // can paint traversal/provenance layers
  // soft/graded (for ranking)
  maxComfortableNodes: number;         // ~1500 (SVG) … 10_000 (canvas) … 1_000_000 (WebGL)
  layoutEngines: string[];             // ["elk","dagre","forceatlas2"]
  rendering: "svg" | "canvas" | "webgl";
  // environment split — honest reporting
  side: "client" | "server" | "hybrid";
  serverPrecompute?: string[];         // e.g. ["layout","sampling"] done server-side
}
```

**Honest capability reporting (server vs client).** Borrowing from the GLSP client/server split and Graphistry/Cosmograph's "layout computed on server/GPU, rendered in browser" model: each descriptor declares `side` and `serverPrecompute`. A renderer must not claim `maxComfortableNodes: 1_000_000` on the client unless it either (a) uses WebGL *and* (b) declares that layout is precomputed server-side or GPU-accelerated. This mirrors `decodingInfo`'s distinction between *supported* (a hard gate) and *smooth/powerEfficient* (graded quality), and content negotiation's `Accept`/server-driven selection. A crucial honesty constraint surfaced by the survey: WebGL scale renderers frequently **cannot draw ports at all** — yFiles' WebGL2 docs state plainly that "Custom styles cannot be defined and ports are not visualized at all" in WebGL rendering. So a high-`maxComfortableNodes` renderer should almost always report `typedPorts: false`.

**Selection rule (capability-ranked, like a RendererRegistry):**

```
required = deriveRequired(declaredAffordances, runtimeSignals)
   typedPorts  := schema.capabilities.typedPorts
   editing     := schema.capabilities.editable && uiMode === "edit"
   nodeCount   := topology.nodes.length
   scaleClass  := bucket(nodeCount)   // interactive | large | massive

candidates = registry.filter(c =>
   (!required.typedPorts || c.typedPorts) &&
   (!required.editing    || c.editing)    &&
   c.directed >= required.directed && c.multigraph >= required.multigraph)

rank candidates by:
   1. hard fit (all required caps satisfied)
   2. scale fit: c.maxComfortableNodes >= nodeCount   (highest priority soft signal)
   3. fidelity: prefers svg/editing for small; webgl for massive
   4. declared registry priority (tie-break)

pick = argmax(rank); if none satisfy scale → choose massive-class renderer
   and DROP editing capability (degrade to read-only view)
```

**Scale thresholds to encode** (yWorks via Cylynx: SVG≈2k, Canvas≈5k, WebGL≈10k+; yWorks docs: WebGL preferable "from 1,000 nodes upwards"; Cosmograph: 133k nodes/321k edges demonstrated, "a million nodes and edges, and that's not the limit"): `interactive ≤ ~1500` → React Flow/SVG; `large ~1.5k–10k` → Canvas (Cytoscape/vis-network) or Sigma; `massive > ~10k` → Sigma/Cosmograph/regraph WebGL, read-only with sampling/level-of-detail. Treat these as defaults to be benchmarked, not hard guarantees (the libraries' own maintainers warn that labels, edge density, and hit-testing dominate real performance).

### Q4 — Renderer-agnostic overlays & state

Keep a **separate, serializable presentation layer** keyed by the canonical ids, never fused into topology. Structure it as a Mapbox-/Vega-Lite-style spec:

```jsonc
{
  "layout": {                         // ELK-/GEXF-style positions, computed or pinned
    "engine": "elk",
    "positions": { "n1": {"x":120,"y":40}, "n2": {"x":300,"y":40} },
    "ports":     { "n1.out": {"side":"EAST"} }
  },
  "style": {                          // Cytoscape-/Mapbox-style selector→props rules
    "rules": [
      { "selector": {"type":"Transform"}, "set": {"color":"#6094CC","shape":"round"} },
      { "selector": {"attr":"weight",">":0.8}, "set": {"width": ["scale","weight",1,6]} }
    ]
  },
  "selection": { "nodes": ["n1"], "edges": [], "ports": [] },
  "overlays": [                       // traversal / provenance as data, not pixels
    { "id":"prov1","kind":"provenance",
      "highlightNodes":["n1","n2"], "highlightEdges":["e1"],
      "encoding": {"opacity":{"matched":1.0,"dimmed":0.2}} }
  ]
}
```

**Prior-art grounding for each piece:**
- **Style as selector→property rules with data-driven expressions**: Cytoscape.js's CSS-like selector/style model and Mapbox GL's `layout`/`paint` split with `["interpolate", …]`/`["match", …]` expressions. Vega-Lite's *encoding channels* (mapping data fields → visual channels with auto-scales) is the cleanest mental model: the overlay declares *what data drives what visual channel*, the renderer decides *how*.
- **Layout interchange**: ELK JSON (`layoutOptions`, computed x/y/size returned), Graphviz DOT attributes, and GEXF's `viz:position`/`viz:size`/`viz:color` namespace all demonstrate position+visual-hint stored *beside* topology. The facade stores positions in `layout.positions`; the ELK adapter both *consumes* (port sides, constraints) and *produces* (computed coordinates) this block.
- **Geo/style separation**: GeoJSON (geometry) + Mapbox style spec (appearance) is the canonical proof that one data document can feed many stylings; we replicate it with topology + style spec.

Because overlays/selection/style/layout reference only canonical ids, **switching renderers preserves intent**: React Flow reads `layout.positions` into `node.position`; Sigma reads the same into `x`/`y` attributes; Cytoscape maps `style.rules` to its stylesheet; all read the same `overlays[]` to dim/highlight a provenance path.

### Q5 — Prior art / don't-reinvent

| Framework | Declarative/schema-driven config? | Typed ports? | Capability-based renderer selection? | Target scale / rendering | Adopt or wrap? |
|---|---|---|---|---|---|
| **xyflow / React Flow** | partial (nodes/edges arrays + `nodeTypes`) | **yes** (handles, `sourceHandle`/`targetHandle`) | no | ~1–2k, SVG/DOM | **Wrap as primary port editor** |
| **Sigma.js + graphology** | data layer is graphology (our hub!) | no | no | 10k–100k+, WebGL | **Wrap as scale fallback** |
| **Eclipse GLSP** | **yes** (server advertises types/ops; serializable GModel) | **yes** (Sprotty ports) | partial (server declares capabilities) | medium, SVG | Borrow architecture; heavy (Java/Theia) |
| **Eclipse Sprotty** | **yes** (SModel schema, `type`→view) | **yes** | no | medium, SVG | Borrow model pattern |
| **Cytoscape.js** | data + selector style | no (compound only) | no | ~5k, canvas | Wrap as analysis/table-ish view |
| **Rete.js** | **yes** (typed schemes, sockets) | **yes** (typed sockets, accept rules) | no | small–medium | Reference for port typing |
| **BaklavaJS** | **yes** (`defineNode`, registry) | **yes** (`NodeInterfaceType`) | no | small–medium | Reference; could wrap for editor |
| **Litegraph.js / ComfyUI** | node-class registry | **yes** (typed slots, `[node,slot]` links) | no | medium, canvas | Reference for serialization |
| **Flume** | **yes** (`FlumeConfig.addPortType/addNodeType`) | **yes** (color-typed ports) | no | small, React | Strong declarative reference |
| **NodeGraphQt** | registry (`__identifier__`) | **yes** (`add_accept_port_type`) | no | desktop/Qt | Python-side reference |
| **AntV G6 (v5)** | **yes** (data + `node/edge/layout/behaviors` spec) | weak | no (multi-renderer: canvas/SVG/WebGL internally) | up to large, WebGL/GPU | Candidate all-in-one; heavier API |
| **Cosmograph / Cosmos** | data + options | no | no | up to ~1M, WebGL/GPU | Wrap as massive-scale fallback |
| **Reaflow / Reagraph** | **yes** (declarative React) | partial | no | small–med / large(WebGL) | Optional React alternatives |
| **vis-network** | data + options | no | no | ~5k, canvas | Optional |
| **JointJS / mxGraph(maxGraph) / draw.io** | partial | **yes** (ports) | no | medium, SVG | Heavy; diagram-editor lineage |
| **yFiles / KeyLines·ReGraph / Ogma** | API | yes (yFiles; but **not in WebGL mode**) | no | large, canvas/WebGL | Commercial; strong but proprietary |
| **G6/ngraph/VivaGraph** | data | no | no | large, WebGL | Layout/data references |

**Net "don't reinvent" judgment.** No single OSS framework gives you *all four* of {neutral round-trippable hub, Zod-schema-driven config, honest capability negotiation, renderer independence}. GLSP/Sprotty come closest architecturally (serializable model + server-advertised capabilities + ports) but impose a Java/Theia/JSON-RPC stack that conflicts with a lightweight TypeScript+Zod facade. The pragmatic path is to **own the thin facade (hub + Zod schema + capability registry)** and **wrap best-of-breed renderers** rather than adopt a monolith.

## Recommendations

**Staged plan:**

1. **Define the canonical hub now** (graphology envelope + `ports[]` + `sourcePort`/`targetPort`). Write `toGraphology`/`fromGraphology` first (near-identity), then `toReactFlow`/`fromReactFlow` and `toELK`/`fromELK` (the two that exercise ports). Benchmark fidelity by round-tripping a port-rich fixture through each adapter. *Benchmark that changes plan:* if any round-trip drops port-level edges, the hub's port contract is wrong — fix before adding more adapters.
2. **Declare schemas in Zod v4** using `z.discriminatedUnion("type", …)` for node/edge/port types and a `z.registry()` for graph capabilities. Emit `z.toJSONSchema()` as the back-end SSOT contract. Reuse existing zodal field-affordance inference for per-node/edge fields. Verify you are on Zod ≥4.1.13 so union/oneOf mapping is correct.
3. **Stand up the capability registry + selection rule.** Seed it with React Flow (`typedPorts:true, editing:true, maxComfortableNodes:~1500, svg`) and Sigma/graphology (`typedPorts:false, maxComfortableNodes:~100000, webgl`). Implement the rank-and-degrade rule (drop `editing` when forced into the massive-scale renderer).
4. **Build the overlay/style layer** as a separate document keyed by canonical ids; implement `layout.positions` consumption in both React Flow and Sigma to prove renderer independence; add one provenance overlay end-to-end.
5. **Add adapters opportunistically** (Cytoscape, GEXF/GraphML export, networkx node-link bridge) as back-end formats demand.

**Primary recommendation:** *graphology-shaped canonical hub + Zod v4 schema/registry + capability-ranked RendererRegistry*, with **React Flow/xyflow as the primary typed-port editor** and **Sigma.js + graphology as the WebGL scale fallback**.

**Fallback / alternative:** if you need one batteries-included engine that internally spans canvas→SVG→WebGL and ships layouts/behaviors, **AntV G6 v5** is the strongest single-library fallback (accepting a heavier, less neutral API and a weaker port story). For >100k-node read-only views, drop to **Cosmograph/Cosmos**.

**Thresholds that would change the recommendation:** if typed-port *editing* must work at >5k nodes simultaneously, no current OSS renderer satisfies both axes (WebGL renderers like yFiles explicitly don't draw ports) — you would split into an "edit one subgraph (React Flow) / view the whole (Sigma)" dual-view, or evaluate commercial yFiles/ReGraph. If the SSOT must be Python-first, pivot the hub to networkx node-link and treat graphology as a derived view.

## Caveats / Risks / Unknowns

- **Port support in archival formats is weak.** GraphML `<port>` exists in spec but is inconsistently supported by tools; GEXF has none. Exporting a port-rich graph to these formats is lossy — preserve ports in attributes and document the loss.
- **`union` vs `oneOf` in Zod→JSON-Schema is version-sensitive.** Early Zod v4 mapped `z.union()` to `oneOf` (semantically `anyOf`); fixed at v4.1.13 so `z.union()`→`anyOf` and `z.discriminatedUnion()`→`oneOf`. Pin/verify the Zod version, and prefer `z.discriminatedUnion`.
- **Scale numbers are device- and graph-shape-dependent.** The ~1.5k/5k/10k/1M thresholds are starting defaults; maintainers of Sigma, vis-network, and Memgraph all caution that labels, edge density, and hit-testing dominate. Benchmark on representative fixtures before promising limits.
- **Bidirectional adapter fidelity is not guaranteed for renderer formats.** Cytoscape and React Flow fuse presentation into topology; the facade must strip presentation back into the overlay layer on `fromX`, or round-trips will drift. Cytoscape itself warns about round-trip caution.
- **Capability self-reporting can lie.** Like `decodingInfo` optimistically reporting "smooth," a renderer may overstate `maxComfortableNodes`. Treat declared caps as hints; keep a runtime fallback that re-selects if frame budget is missed. Cross-check `typedPorts` against rendering mode — WebGL renderers often cannot draw ports (yFiles WebGL2: "ports are not visualized at all").
- **`meshed`-style implicit (name-matched) wiring vs explicit edges.** If the system ingests function-network graphs where edges are *implied* by shared parameter/output names, the importer must materialize explicit `(node,port)` edges into the canonical model; ambiguous name collisions are an unknown that needs a binding/`bind`-style disambiguation step (as meshed's `FuncNode(bind=…)` does).

## References

[1] [Serialization | Graphology](https://graphology.github.io/serialization.html)
[2] [JSON Graph Format Specification](https://jsongraphformat.info/)
[3] [json-graph-specification (GitHub)](https://github.com/jsongraph/json-graph-specification)
[4] [node_link_data — NetworkX documentation](https://networkx.org/documentation/stable/reference/readwrite/generated/networkx.readwrite.json_graph.node_link_data.html)
[5] [Cytoscape.js documentation](https://js.cytoscape.org/)
[6] [Handles — React Flow](https://reactflow.dev/learn/customization/handles)
[7] [Edge — React Flow API](https://reactflow.dev/api-reference/types/edge)
[8] [GEXF File Format — viz module](https://gexf.net/viz.html)
[9] [GEXF Format Specifications (GitHub)](https://github.com/gephi/gexf)
[10] [JSON Format (ELK)](https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/jsonformat.html)
[11] [elkjs (GitHub)](https://github.com/kieler/elkjs)
[12] [Introducing Zod 4](https://zod.dev/v4)
[13] [Metadata and registries | Zod](https://zod.dev/metadata)
[14] [JSON Schema | Zod](https://zod.dev/json-schema)
[15] [Eclipse GLSP — Overview & Architecture](https://eclipse.dev/glsp/documentation/architecture/)
[16] [Graphical Model · Eclipse GLSP](https://eclipse.dev/glsp/documentation/gmodel/)
[17] [Sigma.js](https://www.sigmajs.org/)
[18] [How to Visualize a Graph with a Million Nodes (Cosmograph) | Nightingale](https://nightingaledvs.com/how-to-visualize-a-graph-with-a-million-nodes/)
[19] [A Comparison of JavaScript Graph Visualisation Libraries | Cylynx](https://www.cylynx.io/blog/a-comparison-of-javascript-graph-network-visualisation-libraries/)
[20] [Sockets — Rete.js](https://rete.readthedocs.io/en/latest/Sockets/)
[21] [Connections — Rete.js](https://retejs.org/docs/guides/connections/)
[22] [meshed (PyPI)](https://pypi.org/project/meshed/)
[23] [meshed (GitHub)](https://github.com/i2mint/meshed)
[24] [Styling layers with expressions | Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/guides/styles/style-layers/)
[25] [Mapbox Style Spec](https://docs.mapbox.com/style-spec/guides/)
[26] [Encoding | Vega-Lite](https://vega.github.io/vega-lite/docs/encoding.html)
[27] [Media Capabilities (W3C)](https://www.w3.org/TR/media-capabilities/)
[28] [Using the Media Capabilities API | MDN](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capabilities_API/Using_the_Media_Capabilities_API)
[29] [Graph Serialization and Execution (ComfyUI) | DeepWiki](https://deepwiki.com/Comfy-Org/ComfyUI_frontend/3.5-graph-serialization-and-execution)
[30] [BaklavaJS — Nodes & Interfaces](https://baklava.tech/nodes/interfaces.html)
[31] [Flume — Node Editor docs](https://flume.dev/docs/node-editor/)
[32] [NodeGraphQt — Port API](http://chantonic.com/NodeGraphQt/api/port.html)
[33] [AntV G6 (GitHub)](https://github.com/antvis/g6)
[34] [Cytoscape.js and Cytoscape — User Manual](https://manual.cytoscape.org/en/stable/Cytoscape.js_and_Cytoscape.html)
[35] [v4: toJSONSchema union oneOf issue · Zod #4089 (GitHub)](https://github.com/colinhacks/zod/issues/4089)
[36] [Overview & Terms — React Flow](https://reactflow.dev/learn/concepts/terms-and-definitions)