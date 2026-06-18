# zodal-graph

**One line:** A declarative layer where graph *affordances* are expressed once and mapped — in many ways, against many targets — to UIs, storage, and graph databases.

## Essence

`zodal-graph` is the graph specialization of `zodal`. Where zodal lets you declare a collection's shape and capabilities once (via Zod) and generates UI, state, data-access, and API interfaces from that single declaration, `zodal-graph` does the same for *graph-shaped* data: declare what a graph is and what you can do with it, and let pluggable backends realize those operations against whatever concrete system you're targeting.

The unit of design is the **affordance** — a way you might want to view or operate on graph data (add a node, connect two ports with validation, find the shortest path between A and B, collapse a sub-graph into one node, run a DAG, switch to a table view, persist to a graph DB). Affordances are declared abstractly, decoupled from any one implementation, and then **mapped to targets**.

## The problem it solves

Graphs recur across the ecosystem in radically different regimes:

- **large & sparse** — big datasets where you navigate, filter, and aggregate (cosmograph-style viz);
- **small & rich** — flowcharts and computation DAGs where you edit nodes/edges, wire typed ports, and validate connections (meshed-style);
- **executable** — DAGs you run and watch data flow through;
- **DB-backed** — graphs whose source of truth is a graph database, where operations are queries;
- **tabular** — cases where the right surface for "graph" data isn't a node-link diagram at all, but a table or matrix.

Today each of these needs bespoke wiring between a backend and some UI. `zodal-graph` removes that per-case rebuild: describe the graph and its operations once, then select adapters for the regimes you need — without reinventing the underlying tools.

## The core abstraction — three layers

1. **Model** — Zod schemas describing the graph: what nodes and edges *are*, their properties, and (where relevant) typed ports / connection points. The single source of truth.
2. **Affordances** — the declared catalog of operations and views over that model: structural CRUD, graph-level ops (merge, diff, collapse↔expand), traversals with a UI meaning (shortest/longest path, cycles, neighbors), execution, import/export, view-as. Pure declaration — no implementation baked in.
3. **Targets (adapters / renderers)** — pluggable bindings that realize affordances against a concrete system. A target may be a **UI renderer** (cosmograph for large-graph viz, a node-link editor for rich DAGs, a grid for the tabular case), a **storage backend** (in-memory, edge list, adjacency, nodes_and_links), or a **graph database** (where affordances compile to queries).

The affordance layer is the stable interface; targets are open-closed extension points. Add a new renderer or a new database backend without touching the model or the affordance catalog.

## The facade in action

One affordance, many realizations — same declaration, target-specific behavior:

| Affordance | UI renderer | Graph-DB target | In-memory store |
|---|---|---|---|
| `shortestPath(a, b)` | highlight the path on the canvas | compile to a Cypher/query plan | call the graph-lib routine |
| `connect(out, in)` + type validation | drag-to-wire with inline validation feedback | `MERGE` an edge | append to the edge list |
| `view(graph)` | node-link / large-viz / table, by regime | paginated subgraph view | tabular dump |

The caller asks for the operation; the active target decides how.

## Design commitments

- **Facade + SSOT** — declare the graph and its operations once; everything downstream derives from that declaration.
- **Open-closed via adapters** — new targets (libraries, UIs, databases) plug in without modifying the affordance layer.
- **Declarative over imperative** — affordances and schemas are data, not procedures; behavior is supplied by the chosen target.
- **Composition over inheritance** — assemble a graph interface by composing model + affordances + target(s).
- **Progressive disclosure** — a simple graph needs a minimal declaration and gets a sensible default renderer; typed ports, validation, execution, and DB backing are opt-in.
- **Don't reinvent the wheel** — adapters wrap existing, modern, well-maintained tools; zodal-graph orchestrates, it doesn't re-implement.

## What it is — and isn't

It **is** a declaration-and-mapping layer: a place to express graph affordances and bind them to targets. It **is not** a new graph engine, a new visualization library, or a new database — it is the thin, declarative facade that lets one graph declaration drive many of them.
