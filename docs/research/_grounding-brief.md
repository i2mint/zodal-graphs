# zodal-graph Grounding Brief

*Consolidated, self-contained reference for downstream research agents working on the zodal graph-UI renderer effort. It fuses three distilled investigations: (1) the **affordance synthesis** for twelve graph/timeline subjects, (2) the **zodal substrate** (TypeScript core/store/ui machinery) the graph facade must extend, and (3) the **backend data models** (four Python libraries) that supply the concrete graph/timeline shapes. File:line cites are preserved verbatim and are the authoritative pointers — read those source files when deeper detail is needed.*

*Downstream agents should treat this brief as their sole grounding context. The three "Key files" / "Source file" blocks at the end of each section list the absolute paths backing every claim.*

---

## File-1 affordance synthesis

*Synthesis of `graph-affordances-analysis.md`, the affordances catalog feeding the renderer effort. ~340 raw per-subject affordances were normalized into a stable catalog and a 12-subject × affordance matrix. **Headline finding: affordances cleave by UI regime, not by subject** — each subject lives in one or two regimes, so a small number of capability-keyed renderer families covers the whole fleet.*

### (a) The 11 normalized affordance clusters

- **A. Structural CRUD** — add/delete/edit-label node, set-node-type, edit-node-properties, add/delete/label/retype edge, reverse-edge, upsert-by-stable-id.
- **B. Typed ports & connection validation** (meshed-class) — see (b). The hardest cluster to source off-the-shelf.
- **C. Graph-level composition** — extract-subgraph, merge/compose, diff, collapse-to-super-node, collapse-to-reusable-component, expand-node-to-subgraph, curry/partial, save-scene, fork/clone, simplify.
- **D. Traversal / graph-theory (UI-gestural)** — find-path, critical-path, cycle highlight, topological-order, ancestors/descendants, neighbors, ego/k-hop, roots-and-leaves, connected-component color, articulation/bridge, MST overlay, community color, centrality sizing, interval-relation query.
- **E. Execution / dynamics** — run-graph, run-partial, step-through, watch-values-flow, recompute-downstream, inspect-scope, incremental-recompute, cost-gate, human-approval, step-status/retries, run-force-simulation, tune-forces.
- **F. Provenance / lineage / history** — see (b) overlays.
- **G. Navigation / viewport** — pan, zoom, fit, zoom-to, rect/lasso select, drag, pin, focus, hover-popup, context-menu.
- **H. Filtering / search / aggregation** — filter-by-attribute, compound-filter, by-type/tier, search-locate, brush histogram/category, brush/scrub time, style-by-attribute, legends, cluster-color, label management, sampling, grey-out.
- **I. Representation & view-switching ("not-a-graph")** — switch-to-table/matrix/node-link/timeline/form/point-cloud, pipeline-stepper, pick-representation, convert-between-representations, apply-layout, switch-render-format.
- **J. Import / export** — import/export format, export-as-image, build-knn-from-vectors.
- **K. Graph-DB / query** — run-query, visual-query-builder, page/limit, schema-meta-graph, save-query-favorite, commit-edits-to-db.

### The six UI regimes (subjects + signature affordances)

1. **large-sparse viz** — big sparse graphs, per-element metadata largely non-displayable; viewport/nav, style-by-attribute, crossfilter, sampling, force-sim, neighbor-expand dominate; structural editing rare.
2. **small-rich editor (typed ports + execution)** — small graphs whose metadata must be visible AND operable; structural CRUD, typed ports, layout, path/cycle highlight, image export.
3. **table-or-matrix / not-a-graph** — table/matrix/timeline/form view-switching, representation conversion, value-editing forms; the correct surface is often *not* a node-link diagram.
4. **executable-DAG / pipeline dynamics** — graph is a program: run/step/watch-values, incremental recompute, cost-gate, status/retry, approval. Splits into **dataflow value-watching on-canvas** vs **linear pipeline steppers**.
5. **graph-DB / query explorer** — server-backed live graph; query → expand-on-click → accrete subgraph; query editor + paging + schema meta-graph + commit-to-store.
6. **provenance / lineage / timeline** — read-mostly lineage ledger; mark-changed → highlight stale downstream; replay/time-travel; diff/fork siblings; interval-tier timeline.

### (b) The two tool-deciding affordances (deepest research warranted)

**1. Typed-port connection-with-validation** (cluster B) — essentially **meshed-only**, the hardest thing to source off-the-shelf; only **React Flow** (typed handles + `isValidConnection`) and **Rete.js** do it well. Affordance names in this cluster:
- `connect-to-specific-input-port`
- `rebind-argument-source`
- `validate-connection-by-type`
- `swap-node-function-with-check`
- `flag-unbound-port`
- `edit-port-defaults-and-types`

**2. Renderer-agnostic traversal/provenance overlays** — a networkx-class compute backend feeding highlights (path, ancestors/descendants, stale-set) into *whatever* node-link renderer is active; modeled once, not per renderer. The signature provenance gesture (mark changed → highlight stale downstream) reuses the same ancestor/descendant traversal as executable DAGs. Affordance names here:
- **Traversal (D):** `find-path-between-two-nodes`, `highlight-critical-or-longest-path`, `detect-and-highlight-cycles`, `topological-order`, `highlight-ancestors-descendants`, `highlight-neighbors`, `expand-ego-or-k-hop-neighborhood`, `mark-roots-and-leaves`, `color-by-connected-component`, `flag-articulation-or-bridge`, `overlay-minimum-spanning-tree`, `detect-and-color-communities`, `run-centrality-to-size-or-color`, `interval-relation-query`.
- **Provenance (F):** `inspect-node-provenance`, `highlight-downstream-impacted`, `flag-stale-derivatives`, `view-decision-or-audit-log`, `follow-derived-from-link`, `replay-state-at-time`, `browse-version-history`, `view-provenance-with-dry-run`.

### (c) Per-subject → regime mapping

| Subject | Primary regime(s) | Notes |
|---|---|---|
| **meshed** | small-rich editor / executable-DAG | Gold standard; bipartite FuncNode/var-node, typed ports via `i2.Sig`, fully runnable, collapse-to-reusable-component round-trip. The only subject with full cluster-B support. |
| **ij** | small-rich editor + code-analysis + provenance | NetworkX-backed DiagramIR; broadest graph-theory surface, but **no typed ports, no connect-time validation, no execution**. |
| **linked** | table-or-matrix \| large-sparse viz | Headless representation/codec hub (12+ formats), k-NN from vectors; sits *upstream* of any UI. No editing/execution. |
| **dagapp** | executable-DAG (small-rich on values, read-only structure) | Streamlit facade over a fixed meshed DAG; form-first value calculator, static Graphviz schematic. |
| **aw** | executable-DAG (degenerate/linear) | Agentic data-prep pipeline; linear stepper with status/retry/approval; cosmograph hand-off is a flat point cloud (no edges). |
| **nw** | provenance | Per-project lineage DAG (`was_derived_from`); stale-after freshness; timeline + per-tier tables. |
| **muvid** | executable-DAG (linear pipeline) | Song-to-video orchestrator; fixed staged chain + per-shot fan-out; stage-progress checklist + render table. |
| **coact** | executable-DAG (weak) / provenance | Agent-stack glue; linear COMPLETE→REALIZE→PUBLISH stepper; topology delegated outward. Form/wizard + provenance/diff panel. |
| **lacing** | table-or-matrix / weak | Interval-keyed standoff annotations; Allen-relation queries; timeline + tier tracks + table — node-link is the *wrong* surface. |
| **graph_dbs** (theme) | graph-DB (large-sparse viz + small-rich inspect + table hybrid) | Query→expand→accrete-scene loop; co-equal results table; schema meta-graph; commit-to-DB. |
| **cosmograph** | large-sparse viz | GPU force-directed, 100k–1M+ points; force-sim control, crossfilter panels, sampling; metadata not shown inline. The opposite extreme from meshed. |
| **networkx** | large-sparse viz + executable-DAG (topology-only) + table-or-matrix | Canonical compute/interchange layer behind a renderer; authoritative algorithm catalog; no execution, no typed ports. |

### (d) Universal affordances (capability vocabulary, recurrence-ranked)

- **`switch-to-table-view` — 12/12 subjects** (the single strongest signal). Every regime has a moment where the table *is* the right surface (graph_dbs/Neo4j Browser toggle table↔graph; linked offers the same graph as edge-table, matrix, or diagram). Makes zodal's existing TanStack-Table backbone a **first-class graph view, non-negotiable, not an afterthought**.
- **`edit-node-properties` — 11/12**, but regime-dependent in *meaning*: node-editor gesture (meshed, ij, graph_dbs), form field (dagapp, coact, nw), bulk array re-supply (cosmograph). Shared name, different renderer.
- **`add-node` — ~10/12.**
- **`export-to-format` / `import-from-format` / `convert-between-representations` — ~9/12**, recurring across every backend touching serialized graphs → motivates a shared representation/codec layer (linked- and networkx-style).
- **Highest cross-regime leverage (model once, reuse everywhere):** `extract-subgraph` (appears in *every* regime — one "scene/selection → subgraph" concept), `find-path-between-two-nodes` (5/12, four backends, same gesture), `highlight-neighbors` / `expand-ego-or-k-hop` (6/12, editor+DB+viz), `style-by-attribute`, `switch-to-node-link-view` (8/12).

### (e) Renderer families + renderer-selection logic File 1 proposes

**Five renderer families cover all twelve subjects:**
1. **TanStack Table** — universal table/matrix/result-frame/edge-list/status lens (all 12 subjects).
2. **React Flow** — small-rich editor with **typed handles + `isValidConnection`** (the meshed-class differentiator); serves meshed, ij, graph_dbs edit-slice, networkx-rendered DAGs. **Rete.js** is the specialized dataflow alternative.
3. **cosmograph + sigma.js / Cytoscape.js** — large-sparse GPU viz; one tool serves cosmograph, linked k-NN, graph_dbs-large scenes, networkx-laid-out large graphs. (sigma.js = lighter open option; Cytoscape.js = medium graphs + built-in algorithms.)
4. **A stepper + form renderer** built on **zodal's existing collection-UI primitives** (forms + state) — covers the form-first executable + provenance subjects (dagapp, aw, muvid, coact, nw) with no node-link canvas. "Mostly already in zodal's wheelhouse, not a graph problem."
5. **A timeline-track renderer** (lacing/nw) — interval tiers + Allen-relation brushing; off-the-shelf options thinnest here (vis-timeline, custom D3) — flagged as most likely to need bespoke glue.

The **graph-DB explorer is a composition of (1)+(2)**, not a sixth tool: it reuses the node-link editor for the scene and the table backbone for results, adding only a Cypher/Gremlin editor + paging + schema meta-graph.

**Renderer-selection logic (the unifying bet):** a **Zod-described affordance set + a `RendererRegistry` of ranked renderers keyed on `getCapabilities()`**. The *same declaration* (e.g. "DAG with typed ports, executable, with provenance") picks **React Flow when ports+editing present**, **falls back to Cytoscape/sigma/cosmograph as scale rises and editing drops**, and **degrades to TanStack-Table when node-link adds nothing**. Provenance and traversal affordances (path/ancestors/descendants/stale-set) are **renderer-agnostic overlays** computed by a networkx-class backend and drawn as highlights on whatever node-link renderer is active — modeled once, not per renderer.

*Source file: `zodal-graphs/docs/graph-affordances-analysis.md` (714 lines).*

---

## zodal substrate to extend (TS)

*This distills the existing zodal core/store/ui machinery, with file:line cites, organized around the five areas the graph facade extends.*

### (1) `defineCollection` + Zod v4 inference + the `.meta()` / `affordanceRegistry` pattern

**Entry point.** `defineCollection<TSchema extends z.ZodObject<any>>(schema, config?)` returns a `CollectionDefinition<TSchema>` (`core/src/collection.ts:165`). The definition object carries the source `schema`, resolved collection-level `affordances`, a `fieldAffordances: Record<string, ResolvedFieldAffordance>` map, `operations`, `idField`, `labelField`, and a suite of query methods: `getVisibleFields`, `getSearchableFields`, `getFilterableFields`, `getSortableFields`, `getGroupableFields`, `getOperations`, `describe`, `explain`, plus bifurcation helpers `getContentFields`/`getMetadataFields`/`hasBifurcation` (`core/src/collection.ts:75-137`). The CollectionDefinition interface comment explicitly states each `fieldAffordances` entry is fully resolved so it "can be passed directly to `registry.resolve(field, context)` without a cast" (`collection.ts:82-91`) — this is the seam the graph facade reuses.

**Per-field resolution is a 6-layer merge** (`core/src/collection.ts:282-315`, `inference.ts:392-416`):
1. **Type defaults** — `getTypeDefaults(zodType)` maps base types to `FieldAffordance` constants (`inference.ts:196-223`; e.g. `STRING_FIELD_DEFAULTS` at `inference.ts:121`, number → `filterable: 'range'`, enum → `filterable: 'select', groupable: true`).
2. **Validation refinements** — `refineByValidations` reads Zod checks/formats (email → `editWidget: 'email'`, uuid → `editable: false, filterable: 'exact'`) (`inference.ts:230-282`).
3. **Name heuristics** — `refineByFieldName` uses regex patterns: `id`→hidden+exact, `createdAt`→not editable, `password`→`readable:false`+hidden, and crucially `CONTENT_ROLE_PATTERNS`/`CONTENT_ROLE_SUFFIX` → `storageRole: 'content'` (`inference.ts:288-377`).
4. **`.meta()` annotations** — `getZodMeta(schema)` calls `schema.meta()` with no args (Zod v4 returns the metadata); `extractAffordancesFromMeta` pulls a whitelist of affordance keys plus a nested `meta.affordances` object and standard `title`/`description` (`inference.ts:80-89, 405-449`).
5. **Affordance registry** — `defaultRegistry.get(fieldSchema)` (`collection.ts:294`).
6. **Explicit config** — `config.fields[key]` overrides (`collection.ts:297`).

The merge is plain object spread: `{ ...inferred, ...registryOverrides, ...explicitOverrides }`, then finalized with `title` (humanized fallback), `zodType: getZodBaseType(...)`, `zodDef: fieldSchema._zod?.def`, and `storageRole ?? 'metadata'` (`collection.ts:298-311`).

**Zod v4 introspection helpers** (all exported from core, `index.ts:53-63`) — the only sanctioned way to read schema internals, needed by any graph-aware inference:
- `getZodBaseType` unwraps `optional`/`nullable`/`default` via `schema._zod?.def.innerType` recursively (`inference.ts:21-31`).
- `unwrapZodSchema`, `hasZodCheck` (reads `def.checks[].kind` and `def.format`), `getEnumValues` (Zod v4 uses `def.entries` object, not `values`) (`inference.ts:34-78`).
- `getNumericBounds` reads instance props `minValue`/`maxValue` with a checks-array fallback (`inference.ts:92-115`).

**The `.meta()` loss problem and the registry fix.** `.optional()`/`.nullable()`/`.default()` each return a *new* schema instance, discarding `.meta()` (`registry.ts:1-19`). `createAffordanceRegistry()` solves this with a `WeakMap<z.ZodType, Partial<FieldAffordance>>` keyed by object identity; `get()` checks the schema directly then recursively unwraps wrapper `def.innerType` to find a registration on the *inner* schema (`registry.ts:51-90`). So you `affordanceRegistry.register(innerSchema, {...})` *before* wrapping. A global singleton `affordanceRegistry` is exported (`registry.ts:93`). Note `clear()` is effectively a no-op on a WeakMap (`registry.ts:84-89`). **Graph relevance:** relationship metadata (e.g. a `belongsTo`/`hasMany` edge declaration) most naturally rides this same `.meta()` + registry channel so it survives wrapping, and `extractAffordancesFromMeta`'s whitelist (`inference.ts:423-431`) is where new graph-affordance keys would be registered.

**Traced inference** (`inferFieldAffordancesWithTrace`, `inference.ts:481-578`) reruns all layers recording an `InferenceStep[]` per `TRACED_PROPS`, powering `explain()`. The layer enum is `'type'|'refinement'|'name'|'meta'|'registry'|'config'` (`types.ts:412`). A graph facade adding a layer would extend this enum and the trace logic.

### (2) RendererRegistry / RendererEntry — exact shape and ranking

**Tester type** (`ui/src/registry/tester.ts:44-55`):
```ts
type RendererTester = (field: ResolvedFieldAffordance, context: RendererContext) => number;
interface RendererEntry<TComponent = unknown> { tester: RendererTester; renderer: TComponent; name?: string; }
interface RendererContext { mode: 'cell' | 'form' | 'filter'; [key: string]: unknown; }
```
A tester returns a **numeric priority score**; `> 0` means match, `-1` (or any value ≤ best) means no win. **Higher score wins.**

**PRIORITY bands** (`tester.ts:15-26`): `FALLBACK:1, DEFAULT:10, LIBRARY:50, APP:100, OVERRIDE:200`. Predicates return these constants on match, `-1` otherwise: `zodTypeIs`→DEFAULT, `hasRefinement` (reads `field.zodDef.checks[].kind` or `.format`)→LIBRARY, `fieldNameMatches`→LIBRARY, `metaMatches`→APP, `editWidgetIs`→OVERRIDE, `storageRoleIs`→LIBRARY (`tester.ts:62-104`). Combinators: `and(...)` **sums** scores (returns `-1` if any tester fails), `or(...)` returns the **max** (`tester.ts:110-135`).

**Registry** (`ui/src/registry/registry.ts:14-100`): `createRendererRegistry<TComponent>()` returns `{ entries, register, resolve, explain }`. It is **user-supplied, not a global singleton** (`registry.ts:5`). `resolve(field, context)` is a single linear scan tracking `bestScore`/`bestRenderer`, starting `bestScore = -1`, returns the highest-scoring renderer or `null` (`registry.ts:72-85`). Tie-break: **first registered wins** (strict `>`). `explain` returns all entries with scores sorted descending (`registry.ts:87-98`). **Graph relevance:** a relation field renderer (e.g. a reference-picker, an edge-table cell) is just another `RendererEntry` whose tester inspects graph metadata on `ResolvedFieldAffordance` and returns a `LIBRARY`/`APP` score; no registry change needed — only new predicates analogous to `storageRoleIs`.

### (3) `getCapabilities()` / `ProviderCapabilities` and `ResolvedFieldAffordance`

**`DataProvider<T>`** (`store/src/data-provider.ts:39-78`): seven required methods — `getList`, `getOne`, `create`, `update`, `updateMany`, `delete`, `deleteMany` — plus optional `upsert?`, `getCapabilities?`, `subscribe?`, and the bifurcation pair `getContent?`/`setContent?`. `getList(params: GetListParams)` where `GetListParams = { sort?: SortingState[]; filter?: FilterExpression; search?: string; pagination?: { page; pageSize } }` returns `GetListResult<T> = { data: T[]; total: number }` (`data-provider.ts:16-26`).

**`ProviderCapabilities`** (`store/src/capabilities.ts:11-42`):
```ts
{ canCreate, canUpdate, canDelete, canBulkUpdate, canBulkDelete, canUpsert: boolean;
  serverSort: boolean | string[];     // true=all fields, string[]=specific
  serverFilter: boolean | string[];
  serverSearch: boolean; serverPagination: boolean;
  filterOperators?: Record<string, FilterOperator[]>;   // per-field operator support
  paginationStyle?: 'offset' | 'cursor';
  realtime?: boolean;
  bifurcated?: boolean; contentFields?: string[]; }
```
`getCapabilities?` is optional; when absent, `DEFAULT_CAPABILITIES` (all CRUD true, all server-side `false`, `canUpsert:false`) is assumed (`capabilities.ts:45-56`, `data-provider.ts:56-58`). This honest server-vs-client reporting is zodal's stated differentiator (`capabilities.ts:1-7`). **Graph relevance:** a graph-capable provider would extend `ProviderCapabilities` with edge-traversal/join flags (analogous to `bifurcated`/`contentFields`), and `getList` filter translation would need to express relation predicates via the existing `FilterExpression` AST.

**`FilterExpression`** (`core/src/types.ts:379-405`): a recursive AST — leaf `FilterCondition = { field; operator: FilterOperator; value }` or `{ and: [] } | { or: [] } | { not: ... }`. `FilterOperator` is a Prisma-style union including `arrayContains`/`arrayContainsAny`/`in`/`notIn`/`isNull` (`types.ts:379-391`).

**`ResolvedFieldAffordance`** (`core/src/types.ts:326-342`) extends `FieldAffordance` (the full vocabulary at `types.ts:43-125`) but makes the core booleans non-nullable and **always populates** `title: string`, `zodType: string`, `zodDef: unknown`, `storageRole: FieldStorageRole`. It carries an index signature `[key: string]: unknown` (`types.ts:341`) — the explicit extensibility hook the graph facade uses to attach relation metadata without changing the base type. `FieldStorageRole = 'metadata' | 'content'` and `ContentRef` (`types.ts:132-164`) are the precedent for "this field's value isn't inline data but a reference" — directly analogous to a foreign-key/edge reference.

### (4) Headless config-object shapes the generators emit

All three generators are pure (schema/affordances → plain config; no React). They consume `CollectionDefinition` and use `getEnumValues`/`getNumericBounds` from core.

**`ColumnConfig`** (`ui/src/generators/column-defs.ts:16-63`, emitted by `toColumnDefs`): TanStack-Table-shaped — `id`, `header`, `accessorKey`, boolean feature flags (`enableSorting`, `enableColumnFilter`, `enableGlobalFilter`, `enableGrouping`, `enableHiding`, `enableResizing`), sizing (`size`/`minSize`/`maxSize`), `sortingFn`/`sortDescFirst`/`filterFn` (string names mapped via `inferSortFnName`/`inferFilterFnName`, `column-defs.ts:66-95`), and a `meta` bag carrying `zodType`, `filterType`, `editable`, `inlineEditable`, `displayFormat`, `badge`, `copyable`, `truncate`, `tooltip`, `enumValues`, `numericBounds`, `pinned`, and bifurcation fields `storageRole`/`isContentRef` (`column-defs.ts:45-62, 155-170`). `toColumnDefs` injects a leading `select` column when `selectable` and a trailing `actions` column when item-scoped operations exist (`column-defs.ts:108-194`).

**`FormFieldConfig`** (`ui/src/generators/form-config.ts:12-43`, emitted by `toFormConfig(collection, mode: 'create'|'edit')`): `name`, `label`, `type` (widget, via `inferFormWidgetType` — `editWidget` wins, content→`'file'`, else type-mapped; `form-config.ts:46-65`), `required`, `disabled`, `hidden`, `placeholder`, `helpText`, `defaultValue`, `options?: {label,value}[]` (from enums), `order`, `zodType`, and content fields `isContentField`/`acceptMimeTypes`/`maxSize`. Mode-aware skip logic at `form-config.ts:81-88` (e.g. `immutableAfterCreate` skipped on edit), sorted by `order` (`form-config.ts:121`).

**`FilterFieldConfig`** (`ui/src/generators/filter-config.ts:12-25`, emitted by `toFilterConfig`): `name`, `label`, `filterType: FilterType`, `options?`, `bounds?: {min,max}` (for range), `zodType`. Iterates `collection.getFilterableFields()`; non-string `filterable` defaults to `'search'` (`filter-config.ts:38-67`).

Two further emitters worth noting for graph: **`toPrompt`** produces an LLM-facing markdown spec (data-shape table, capability list, filter config, operations, UI hints — `ui/src/prompt.ts:15-181`), and **`toCode`** serializes the resolved config back to a TypeScript `CollectionConfig` literal with ordered field props and `diffOnly` mode (`ui/src/codegen.ts:60-110`). A graph facade adding relation fields must extend `FIELD_PROP_ORDER` (`codegen.ts:40-49`) and `extractAffordancesFromMeta`'s whitelist together, or relation metadata won't round-trip through codegen.

### (5) UI state store shape

`createCollectionStore<T>(collection)` (`ui/src/state/store.ts:96-226`) is **framework-agnostic** — it returns `{ initialState, actions, selectors }` of *pure* functions usable with Zustand/Redux/useReducer; a Zustand adapter (`createZustandStoreSlice`) and granular slices are layered on top and exported separately (`ui/src/index.ts:35-52`).

**`CollectionState<T>`** (`store.ts:24-43`), TanStack-Table-compatible: data (`items: T[]`, `totalCount`, `loading`, `error`), table state (`sorting: SortingState[]`, `columnFilters: ColumnFilter[]`, `globalFilter: string`, `pagination: PaginationState` `{pageIndex,pageSize}`, `rowSelection: Record<string,boolean>`, `columnVisibility: Record<string,boolean>`, `columnOrder: string[]`, `grouping: string[]`), and `contentLoading: Record<string, Record<string,boolean>>` (per-item/per-field, for bifurcated providers).

**`CollectionActions<T>`** (`store.ts:49-65`): pure `(state, ...args) => newState` setters for every field, plus `clearSelection`, `selectAll`, `reset`, `setContentLoading`. Filter/global-filter setters reset `pageIndex` to 0 (`store.ts:138-143`).

**Initial state** is derived from collection affordances: page size from `affordances.pagination`, initial `sorting` from `affordances.defaultSort`, `columnVisibility`/`columnOrder` from per-field `visible`/`hidden`/`order` (`store.ts:99-128`, helpers `store.ts:232-246`).

**`selectors`** (`store.ts:197-223`): `getSelectedItems`, `getSelectedCount`, `getPageCount`, `isAllSelected`, `hasSelection`, `getVisibleItems` (client-side slice). **Graph relevance:** the `contentLoading` nested map is the precedent for tracking async per-field side data; a graph facade tracking lazily-loaded related entities (expanded edges, neighbor lists) would add an analogous `relationLoading`/expansion-state field plus pure actions, leaving the TanStack-compatible core untouched.

### Extension seams for zodal-graph (summary)

- **(a)** the `.meta()` + WeakMap `affordanceRegistry` channel for wrap-surviving relation metadata, plus `extractAffordancesFromMeta`'s key whitelist (`inference.ts:423`);
- **(b)** the `ResolvedFieldAffordance` index signature (`types.ts:341`) and `FieldStorageRole`/`ContentRef` precedent for "reference, not inline value";
- **(c)** new `RendererTester` predicates (mirroring `storageRoleIs`) — no registry change;
- **(d)** `ProviderCapabilities` extension fields + `FilterExpression` AST for relation queries;
- **(e)** generator `meta` bags + `FIELD_PROP_ORDER` / codegen round-trip;
- **(f)** `CollectionState.contentLoading` precedent for relation/expansion state.

### Key files (absolute)

- `zodal/packages/core/src/{collection,inference,registry,types,index}.ts`
- `zodal/packages/store/src/{data-provider,capabilities,index}.ts`
- `zodal/packages/ui/src/{codegen,prompt,index}.ts`, `ui/src/registry/{registry,tester}.ts`, `ui/src/state/store.ts`, `ui/src/generators/{column-defs,form-config,filter-config}.ts`

---

## Backend data models (Python)

*This distills the core data structures of four Python backends and maps each to a neutral, round-trippable graph/timeline model. The central question for the canonical model is how **meshed's named, typed ports** survive a flat node-link serialization — addressed in §1 and §5.*

### 1. meshed — the typed-port / FuncNode computational graph

#### Core structure: `FuncNode`

`meshed.base.FuncNode` (base.py:126-233) is a dataclass wrapping a callable so it can operate in a network. Its fields:
- `func: Callable` — the wrapped function
- `name: str` — the node's identity in the network (base.py:227)
- `bind: dict` — **the crux**: `{func_argname: scope_name, ...}` mapping each of the function's *internal* parameter names to the *external* variable name it sources from (base.py:131-134, 228)
- `out: str` — the variable name the result is written to (base.py:229)
- `func_label`, `names_maker`, `node_validator` — display + naming policy

The key insight (base.py:171-178): **`bind` maps FROM the wrapped function's argument names TO scope names.** Any argument not in `bind` is auto-completed to bind to its own name (`_complete_dict_with_iterable_of_required_keys`, base.py:272). So a `FuncNode` is a fully-specified assignment statement `out = func(...inputs sourced by bind...)` that executes against a `scope` dict (base.py:333-341: reads bound inputs from scope, calls func, writes `scope[self.out] = output`).

#### Typed ports come from the signature

`self.sig = Sig(self.func)` (base.py:267) captures the full `i2.Signature` — parameter names, **kinds** (POSITIONAL_ONLY, VAR_POSITIONAL, VAR_KEYWORD, etc.), **defaults**, and **type annotations**. So each input "port" is not just a name but a typed, kinded parameter. `dot_lines` (base.py:418-433) renames the sig params through `bind` (`self.sig.ch_names(**self.bind)`) to get the externally-named ports, and `param_to_dot_definition` (base.py:483-492) encodes kind into the label (`*args`, `**kwargs`, `name=` for defaulted). `handle_variadics` (base.py:108) normalizes variadic functions before wrapping.

#### The graph representation: bipartite var/func dict

`_func_nodes_to_graph_dict` (base.py:553-560) builds the canonical adjacency dict `self.graph`:
```python
for f in func_nodes:
    for src_name in f.bind.values():   # each bound INPUT var → this func node
        add_edge(g, src_name, f)
    add_edge(g, f, f.out)              # this func node → its OUTPUT var
```
This is a **bipartite directed graph**: variable-name nodes (strings) alternate with FuncNode objects. An edge from output var of one node to an input var of another is *implicit* — it exists when `f1.out == some value in f2.bind`. Edges are matched by **name identity on the variable nodes** (dag.py:486: "edges of the DAG are defined by matching `out` TO `bind`").

#### DAG

`meshed.dag.DAG` (dag.py:445-526) is a dataclass holding `func_nodes`. `__post_init__`:
- builds `self.graph` via the bipartite dict (dag.py:504)
- `topological_sort`s it (dag.py:505), then `_separate_func_nodes_and_var_nodes` (dag.py:507)
- synthesizes `self.__signature__` from root var nodes (dag.py:509-513) — so the DAG **is itself a callable with a typed signature**
- computes `self.roots` (input var names = signature names) and `self.leafs` (output var names)

`graph_ids` (dag.py:1189-1212) is the **stringified** view: `{from_node_id: [to_node_ids]}` where FuncNodes are replaced by their `.name`. This is the most directly serializable form. itools (itools.py) supplies the standard graph algebra over the dict: `successors`, `predecessors`, `ancestors`, `descendants`, `root_nodes`, `leaf_nodes`, `topological_sort`, `edges`, `nodes`.

#### Collapse-to-component (subgraph as a FuncNode)

A `DAG` is callable, iterable over its FuncNodes, and carries a signature — so a whole DAG can be wrapped as a single `FuncNode(dag, ...)` and nested. `__getitem__` (dag.py:641) / `_ordered_subgraph_nodes` (dag.py:763-769) extract a subgraph by `descendants ∩ ancestors` between selected endpoints (dag.py:771-780), returning a new `DAG`. Union via `__add__`/`__radd__` (dag.py:1214-1255) concatenates func_nodes. `FuncNode.to_dict`/`from_dict` (base.py:368-375) give exact round-trip of a single node's init args.

### 2. linked — multi-representation graph hub with converters

`linked` is a **conversion fabric**, not a single model. Built on `i2.castgraph.TransformationGraph` (cast.py:48-51), it registers graph *kinds* as nodes and *converters* as edges, then routes any source→target conversion by shortest weighted path.

#### The ~12 registered kinds (cast.py:8-21)

1. `nodes_and_links` — `{'nodes': [{'id':...}], 'links': [{'source':..., 'target':...}]}` (the **hub format**, JSON graph standard)
2. `edgelist` — numpy `(n_edges, 2)` `[source, target]` indices
3. `weighted_edgelist` — numpy `(n_edges, 3)` `[source, target, weight]`
4. `minidot` — string DSL `"1 -> 2\n2,3 -> 5,6"`
5. `adjacency_matrix` — dense `(n,n)` numpy
6. `sparse_adjacency` — scipy sparse matrix
7. `adjacency_list` — `{node: [neighbors]}` dict
8. `networkx_graph` — `nx.Graph` (undirected)
9. `networkx_digraph` — `nx.DiGraph` (directed)
10. `edges_dataframe` — pandas DF with source/target columns
11. `nodes_dataframe` — pandas DF of node metadata
12. `graph_dataframes` — `{'edges': df, 'nodes': df}`

#### Mechanics

Each kind is registered with an `isa` predicate for auto-detection (cast.py:59-100) — e.g. `_is_nodes_and_links_dict` checks for `'nodes'`+`'links'` keys; `_is_edgelist` checks `ndim==2, shape[1]==2`. Converters are registered as **directed, costed edges** between kinds via `register_transformation(src, dst, cost)` (cast.py:164-183) — e.g. networkx_graphs.py:406-416 registers four edges among `edgelist`/`networkx_digraph`/`nodes_and_links` at cost 0.3. Most datasrc modules register conversions only **to/from the hub** (`nodes_and_links` or `edgelist`); transitive paths are found automatically.

Public API (cast.py): `convert_graph(obj, to_kind, from_kind=None)` (auto-detects source via predicates if `from_kind` omitted), `graph_converter(from, to)` (returns a reusable transformer fn), `graph_kinds()`, `reachable_from_kind()`, `sources_for_kind()`. Missing-dependency converters degrade gracefully via `contextlib.suppress` (cast.py:198-214).

**For the canonical model, linked already supplies the answer for plain graphs**: `nodes_and_links` is the neutral interchange format, and the converter graph is exactly the round-trip machinery. The gap is that node/link attributes beyond `id`/`source`/`target` are passed through opaquely — there is no schema for *typed ports* (see §5).

### 3. lacing — the interval / timeline annotation model

#### Rational time foundation (`lacing.time`)

`RationalTime` (time.py:30-268) — a point in time as exact `value/rate` seconds (never float). `__slots__=('_value','_rate')`, immutable. Equality/ordering compare via `Fraction` so different rates are comparable (`RationalTime(24000) == RationalTime(1,1)`, time.py:37). Wire format: `{"v": int, "r": int}` (time.py:245-250). `DEFAULT_RATE = 24000` (LCM covers common video rates exactly, time.py:22). Float is a one-way escape hatch (`to_seconds`, time.py:168-170). Pydantic core-schema integration serializes via `to_wire` (time.py:252-268).

`TimeInterval` (time.py:271-363) — a **half-open `[start, end)`** pair of `RationalTime`. Constructor enforces `start <= end`; `start == end` is a valid **point annotation**, not degenerate (time.py:272-276, 304). Wire format `{"start": {...}, "end": {...}}` (time.py:326-334).

#### Allen relations (`lacing.allen`)

`AllenRelation` (allen.py:40-79) — the canonical **13 interval relations** as a str-Enum keyed by Allen's symbols (`<`, `>`, `m`, `mi`, `o`, `oi`, `s`, `si`, `d`, `di`, `f`, `fi`, `=`), with an `inverse()` map (allen.py:60-79). Each relation is a pure predicate over two `TimeInterval`s (allen.py:85+), defined exactly on half-open boundaries (e.g. `meets` = `a.end == b.start`, which is NOT intersection since half-open intervals share zero measure at a boundary, allen.py:6-9).

#### Tiers / tracks (`lacing.tier`)

`Tier` (tier.py:37-127) — a **named annotation layer**, pure metadata that does *not* own annotations (the store is keyed by interval; annotations carry their tier name as a field — ELAN TIME_ORDER indirection, tier.py:40-43). Fields: `name`, `stereotype`, `parent` (name of parent tier), `metadata`. `TierStereotype` (tier.py:15-34) adopts **ELAN's five stereotypes verbatim**: `NONE`, `TIME_SUBDIVISION` (children partition parent, no gaps/overlap), `INCLUDED_IN` (within parent, gaps allowed), `SYMBOLIC_SUBDIVISION` (ordered, no times), `SYMBOLIC_ASSOCIATION` (1-1, exact interval). `validate_tier_constraint` (tier.py:129-227) is a pure function returning violation messages per stereotype.

#### Annotation envelope (`lacing.model`)

`Annotation` (model.py:102-131) — one envelope, typed body. Fields: `id: UUID`, `tier: str`, `reference: Reference`, `body: dict` (validated by `body_schema_uri` via semver, model.py:110-117), `provenance: Provenance`, `confidence: float|None`. A `Reference` is a discriminated union on `kind` (model.py:63): `MediaRef` (asset_id + interval), `NodeRef` (scene_path + interval — **a path into a scene/document graph**), `AnnotationRef` (target annotation id + optional sub-interval — annotations annotating annotations). `Provenance` (model.py:71-96) is a W3C PROV-O subset: `was_generated_by`, `was_attributed_to`, `was_derived_from: list[UUID]`, `generated_at_time`, `activity`.

**Timeline model summary**: tiers/tracks = named (optionally parent-linked, stereotyped) layers; annotations = `(half-open rational interval) → typed body` items referencing media regions *or graph node paths*; relations between intervals via the 13 Allen predicates. `NodeRef` and `was_derived_from` are the bridges into a graph/provenance model.

### 4. dagapp — form-first DAG (per-node value forms)

`dagapp` renders a meshed `DAG` as a Streamlit form-driven calculator. It has **no graph model of its own** — it consumes meshed's `DAG.graph`, `.roots`, `.leafs`, `.var_nodes`, `.func_nodes`, `.sig` directly (utils.py imports `meshed.itools.successors`).

The form-first model: every **var node becomes an input widget**, driven by its *type* (page_funcs.py, utils.py). `get_default_configs` (utils.py:378-393) maps each root node's annotation through `DFLT_ANNOT_ARGTYPE_MAP` (`int/float→"num"`, `str→"text"`, `bool→"bool"`, `list`, `dict`, utils.py:21-28) to an `arg_type`, which `ARG_TYPE_WIDGET_MAP` (utils.py:30-37) maps to a Streamlit widget (`number_input`, `slider`, `text_input`, expander...). `display_node` (utils.py:197-227) renders the widget. On change, `update_nodes` (utils.py:257-266) finds `successors(dag.graph, changed_node)` and recomputes each downstream node via `_compute_node_value` (utils.py:269-301), which respects parameter **kind** (POSITIONAL_ONLY → positional, VAR_POSITIONAL/VAR_KEYWORD → splat) using the FuncNode's signature. Values live in `st.session_state` keyed by var name — i.e. **the meshed scope dict is the Streamlit session state**. `SimplePageFunc`/`StaticPageFunc`/`VectorizePageFunc` (page_funcs.py) differ only in propagation strategy (reactive successor update vs. full recompute vs. linspace vectorization).

**Canonical-model relevance**: dagapp is a *view spec* over the meshed graph — it adds, per var node, a `(value, arg_type, widget, range)` form affordance. In a neutral model these are node-level UI/value annotations layered on the typed-port graph.

### 5. Mapping to a neutral graph model — how typed ports survive node-link serialization

A single canonical model can absorb all four. Use **`nodes_and_links` (linked's hub format) as the carrier**, enriched so meshed's typed ports are not lost.

#### The serialization problem

Naive node-link captures only `{id}` nodes and `{source, target}` links. meshed needs more: a node has *multiple named input ports*, each typed and kinded, and an edge binds *one specific output to one specific named input*. A flat edge list collapses this.

#### Recommended canonical encoding

Adopt meshed's own bipartite split as the neutral form (it is already what `DAG.graph_ids` produces, dag.py:1189-1212):
- **Two node types**: `var` nodes (data, carry id = variable name) and `func` nodes (carry id = `FuncNode.name`, plus a `ports` block).
- **`func` node payload** (round-trips `FuncNode.to_dict`, base.py:368): `name`, `out`, `func_label`, a function reference (qualname/import-path or content hash — `func` itself is not JSON-serializable), and an **explicit ports list** derived from `sig.ch_names(**bind)`: `[{port: external_name, param: internal_name, type: annotation, kind: POSITIONAL_ONLY|…, default: …, required: bool}]`. This preserves *named + typed + kinded* ports verbatim.
- **Links carry the port**: instead of bare `{source, target}`, use `{source: out_var, target: func_id, target_port: external_input_name}` for input edges and `{source: func_id, target: out_var}` for output edges. The `target_port` is what makes an edge bind to a *specific named input* rather than "the node" — this is the one field that ordinary node-link drops and that must be added.

Because edges in meshed are matched by **var-name identity** (dag.py:486), the var nodes act as named rendezvous points; serializing them explicitly (rather than inlining edges func→func) is what lets the graph round-trip without losing which output feeds which input. `graph_ids` already demonstrates the lossy string view; the canonical model is `graph_ids` plus the per-func `ports` payload plus per-link `target_port`.

#### Round-trip path

`linked.convert_graph` gives free interop to/from `edgelist`, `networkx_digraph`, `dataframes`, etc., **once meshed emits `nodes_and_links`** — register a meshed↔`nodes_and_links` converter pair carrying the port extensions in node/link attributes (linked passes unknown attributes through opaquely, cast.py:108-137, so the `ports`/`target_port` fields survive). Plain consumers see a valid graph; meshed consumers reconstruct `FuncNode`s via `from_dict` + a func resolver.

#### Timeline and form layers as node annotations

- **lacing** maps cleanly onto the same node-link substrate via `NodeRef.scene_path` (model.py:42) — annotations attach to graph nodes by path, each carrying a half-open rational `interval`, a `tier`, a typed `body`, and PROV-O `provenance`/`was_derived_from` (itself a derivation DAG). Allen relations + tier stereotypes are edge/constraint vocabularies over interval-bearing nodes. The neutral model should keep rational time (`{v, r}`) and half-open semantics rather than floats.
- **dagapp** contributes a per-`var`-node **affordance annotation** `{value, arg_type, widget, range}` — a presentation layer on the same typed ports, derivable from the port `type`.

#### Net

The neutral model is **linked's `nodes_and_links` hub, bipartite-split into `var`/`func` nodes, with links carrying `target_port`, func nodes carrying a typed/kinded `ports` block** (from meshed's `Sig`). lacing layers interval/tier/provenance annotations onto nodes (keyed by path, rational half-open time, Allen relations); dagapp layers value/widget affordances onto var nodes. This preserves meshed's typed ports through serialization — the single thing flat node-link otherwise destroys — while remaining a valid graph for every other consumer.

### Key file:line references

- **meshed FuncNode**: `meshed/base.py:126-233` (fields), `:267` (sig), `:272` (bind completion), `:333-341` (call_on_scope), `:368-375` (to_dict/from_dict), `:418-492` (typed-port dot rendering), `:553-560` (bipartite graph dict)
- **meshed DAG**: `meshed/dag.py:445-526` (dataclass + post_init), `:509-513` (synthesized signature), `:763-780` (subgraph extraction), `:1189-1212` (graph_ids)
- **linked**: `linked/cast.py:8-21` (kinds), `:59-100` (predicates), `:164-183` (converter registration), `:226-260` (convert_graph)
- **lacing**: `lacing/time.py:30-268` (RationalTime), `:271-363` (TimeInterval half-open), `lacing/allen.py:40-79` (13 relations), `lacing/tier.py:15-34` (5 ELAN stereotypes), `:129-227` (constraint validation), `lacing/model.py:24-63` (References), `:71-131` (Provenance, Annotation)
- **dagapp**: `dagapp/utils.py:21-37` (type→widget maps), `:257-301` (successor recompute via meshed graph + kind-aware call), `:378-393` (annotation-driven config)
