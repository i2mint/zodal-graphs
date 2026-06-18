# Choosing Components for the "NOT-A-GRAPH" Surfaces: Matrix, Form, and View-Switching

*Author: Thor Whalen*

> **Note:** This report is delivered below as publication-ready Markdown. To save it as a downloadable `.md` file, copy everything between the rules into a file named `not-a-graph-surfaces.md`.

---

## TL;DR
- For the **matrix/heatmap surface**, adopt **FINOS Perspective + regular-table** (Apache-2.0, WebAssembly engine, virtualizes billions of cells, ships a built-in view-switcher with datagrid/heatmap/treemap plugins) as PRIMARY; use **ECharts heatmap** (Apache-2.0, canvas/WebGL) as the lightweight FALLBACK. Avoid AG Grid Enterprise as the matrix engine because reordering/pivot features are behind a commercial license ($999/developer) [1][7][8][13].
- For the **per-node form surface**, adopt **react-hook-form + @hookform/resolvers (Zod resolver) + shadcn/ui `<Form>`** (all MIT, native to your stack) as PRIMARY, and add **vantezzen Autoform (`@autoform/zod` + shadcn registry)** as the FALLBACK schema-driven auto-renderer — it takes a Zod schema directly and supports Zod v3/v4 [14][15][17]. Prefer this over `@rjsf/core`, which needs a Zod→JSON-Schema conversion step [18][19].
- For **view-switching**, keep a single source of truth (a zustand store holding `selectionIds`, `filters`, and active `lens`) and *project* it into each lens rather than letting each view own state — this is the "coordinated multiple views / brushing-and-linking" pattern from InfoVis literature, and it keeps selection and filters stable across table/matrix/node-link/form [21][22][26].

## Key Findings

1. **TanStack Table is the correct universal lens for edge lists and result frames — keep it.** It is headless (TS-first, framework-agnostic, ESM), so it owns sorting/filtering/grouping/pagination logic but renders nothing itself and ships **no built-in virtualization**; you pair it with `@tanstack/react-virtual` [10][11]. That is a feature, not a gap, for the "table backbone" role. The gaps it cannot cover by itself: huge canvas-speed datasets (hundreds of thousands of live cells) and spreadsheet-style editing — for those, Glide Data Grid (MIT, canvas) is the batteries-included complement [3][12].

2. **The matrix surface is a genuinely different idiom and a maintained component exists.** A node×node adjacency/relation matrix is the *right* operable surface for dense graphs, for finding clusters/blocks via row/column reordering, and for avoiding edge-crossing "hairballs"; node-link is better for sparse graphs and path-following [4][5][6]. FINOS Perspective (with its regular-table grid) is the strongest off-the-shelf engine: Apache-2.0, virtualizes enormous matrices, supports pivots/sorts/filters and a built-in plugin switcher (datagrid ↔ heatmap ↔ treemap ↔ charts) [1][2][9].

3. **For Zod-driven forms, the manual react-hook-form + shadcn approach is primary; Autoform is the schema-driven fallback.** Autoform takes a Zod schema *directly* (no JSON Schema conversion), supports Zod v3 and v4, and has an official shadcn/ui registry [15][16][17]. `@rjsf/core` is mature and powerful but is JSON-Schema-native, so it requires a `zod-to-json-schema` / `z.toJSONSchema()` conversion step and is not shadcn-native [18][19][20]. Formily is high-performance but Alibaba/AntD-oriented and a heavier mental model [25].

4. **View-switching is a solved pattern in InfoVis: one selection model, many projections.** "Coordinated multiple views," "linked views," and "brushing-and-linking" all describe selecting in one view (brushing) and reflecting it in others (linking) [21][22]. The implementation that matches your stack: a single zustand store as the source of truth for selection + filters, with each lens subscribing to the slice it needs and writing back through actions [26].

5. **Licensing is the main trap, and it is concentrated in AG Grid.** AG Grid Community is MIT, but the features you would actually want for a matrix (row grouping, pivoting, range selection, server-side row model) are **AG Grid Enterprise**, which requires a paid per-developer commercial (EULA) license ($999/developer perpetual; $1,598 for the Grid+Charts bundle) and shows a watermark without a key [7][8][13]. Perspective (Apache-2.0), Glide Data Grid (MIT), TanStack Table (MIT), ECharts (Apache-2.0), nivo (MIT), visx (MIT), react-hook-form (MIT), Autoform (MIT), and rjsf (Apache-2.0) are all permissively licensed [1][3][10][8][23][14][15][18].

## Details

### 1. Matrix / relation-matrix / heatmap surface

**When a matrix is the right surface.** The empirical InfoVis literature is consistent: for dense graphs, an adjacency matrix is superior to a node-link diagram because it is compact and free of edge-crossing clutter, while node-link is better for path-following [4][5]. The foundational result is Ghoniem, Fekete & Castagliola (2005), *On the Readability of Graphs Using Node-Link and Matrix-Based Representations*: "when graphs are bigger than twenty vertices, the matrix-based visualization outperforms node-link diagrams on most tasks. Only path finding is consistently in favor of node-link diagrams" [6]. Later controlled work refines this: Alper, Bach, Henry Riche, Isenberg & Fekete, *Weighted Graph Comparison Techniques for Brain Connectivity Analysis* (CHI 2013), conclude "Our findings suggest that matrices support these tasks well, outperforming node-link diagrams" for weighted-graph comparison [24]. (Note one nuance: Okoe, Jianu & Kobourov's large crowdsourced study, ~800 participants, found that node-link diagrams *better support memorability and some connectivity tasks*, so the matrix advantage is task-dependent, strongest for dense graphs, clustering, and weighted comparison [5].) The catch: a matrix needs a good row/column permutation (seriation/optimal-leaf/Cuthill–McKee ordering) to reveal block/cluster structure, and matrices are less familiar to lay readers [4]. Matrices also cost quadratic screen space, so for very large sparse graphs you virtualize and/or aggregate. Practical guidance: offer the matrix as the operable lens for dense neighborhoods and clustering tasks, and keep node-link for sparse path-following.

**FINOS Perspective + regular-table (PRIMARY).** `regular-table` is a FINOS, Apache-2.0 custom element for async/virtual data models; it supports four virtual-scroll modes and ships an official "Two Billion Rows" example that sets exactly `NUM_ROWS = 2000000000` and `NUM_COLUMNS = 1000`, generating "data only for the window currently visible on screen" [1][2]. It supports hierarchical row and column headers (essential for an n×n matrix), style listeners (for color/heatmap encoding of cells), and event listeners (for cell tooltips and click-to-select) [1]. It is natively compatible with Perspective, a WebAssembly streaming query engine (C++ compiled to WASM, Apache Arrow ingestion) that adds user-driven pivots, filters, sorts, and expression columns, and whose `<perspective-viewer>` only consumes the data needed to render the current screen [9]. Crucially, Perspective ships a **built-in view switcher** — the same `<perspective-viewer>` flips between `datagrid`, `d3_heatmap`, `d3_treemap`, and ~10 chart plugins — which directly models your "switch the same data between lenses" requirement at the component level [27]. This is the best "reuse an existing component" answer for the matrix.

**ECharts heatmap (FALLBACK).** Apache ECharts (Apache-2.0) renders a heatmap series with canvas (and WebGL via extensions), supports `visualMap` for color encoding, native tooltips, zoom/pan, progressive/incremental rendering, and TypedArray inputs; it is widely cited as the strongest option for large/streaming datasets [23][28]. Use `echarts-for-react` as the React wrapper. The trade-off vs. Perspective: ECharts gives you a beautiful, performant *heatmap* but not a reorderable, header-rich *operable matrix* with built-in pivot/filter — you wire reordering and selection yourself.

**Other options evaluated.**
- **nivo `@nivo/heatmap`** (MIT, ~803k weekly downloads, SVG + canvas variants, custom tooltips, custom cell components) [29]. Great for small/medium matrices and quick wins; canvas variant helps scale, but it is a charting heatmap, not a virtualized operable grid.
- **visx** (MIT, Airbnb): D3 primitives (`@visx/heatmap`) for a fully bespoke matrix; maximum control, most developer time, SVG-based so you manage virtualization/scale yourself [23].
- **Glide Data Grid** (MIT, canvas, scales to millions of cells, resizable/movable columns, custom cell rendering) [3]: can be coerced into an operable matrix with colored cells and is excellent if you want the *same* canvas grid for both edge-list and matrix; you implement row/col reordering and color encoding via custom cell draw.
- **AG Grid**: Community is MIT and capable, but the matrix-relevant power (pivot, row grouping, range selection, server-side model) is **Enterprise/commercial** — flag and avoid unless already licensed [7][13].
- **Graph-specific matrix viewers** (NodeTrix, MatLink, ZAME, research prototypes) are mostly academic and not maintained npm components; treat them as design references (e.g., for in-matrix path overlays or hybrid node-link+matrix views) rather than dependencies [30].

#### Matrix / heatmap comparison

| Component | License | Maintenance / health | Virtualization / scale | Reorderable rows/cols | Color/heatmap encoding | Cell tooltips | TanStack / React / TS fit | Notes |
|---|---|---|---|---|---|---|---|---|
| **FINOS Perspective + regular-table** | Apache-2.0 | Active (OpenJS/FINOS; perspective-viewer-datagrid v3.8.0 published ~4 months ago) | Excellent — WASM engine, 2B-row virtual demo, screen-only data | Via pivots/sorts + manual column ordering | Yes — style listeners / column styling gradients | Yes — event listeners | Custom element; wraps in React; full TS | Built-in view switcher (datagrid/heatmap/treemap/charts); best operable-matrix reuse |
| **ECharts heatmap** (echarts-for-react) | Apache-2.0 | Very active, large community | High — canvas + progressive/incremental, TypedArray, WebGL ext | Manual (set axis order) | Yes — `visualMap` gradients | Yes — native | React wrapper; TS types available | Best lightweight large heatmap; not an operable grid |
| **nivo `@nivo/heatmap`** | MIT | Active (plouc); ~803k weekly dl | Medium — SVG; canvas variant scales better | Manual (data order) | Yes — color scales, custom cells | Yes — custom tooltip | React-native, TS | Easiest pretty heatmap; charting not grid |
| **visx `@visx/heatmap`** | MIT | Active (Airbnb) | Medium — SVG; you build virtualization | Manual | Yes — D3 scales | You build it | React-native primitives, TS | Max control, most effort |
| **Glide Data Grid** | MIT | Active (~5.1k stars; React 16–19) | Excellent — canvas, millions of cells | Movable columns built-in; rows manual | Via custom cell draw | Via custom overlay | Canvas; pairs with TanStack as data layer; full TS | Reuse same grid for edge-list + matrix |
| **AG Grid Community** | MIT | Very active | Excellent — built-in row/col virtualization | Column moving yes | Via cell styles | Yes | React adapter, TS | Capable but matrix power needs Enterprise |
| **AG Grid Enterprise** | Commercial (EULA, $999/dev) | Very active | Excellent + server-side row model | Yes + pivot | Yes | Yes | React adapter, TS | Per-developer paid license; watermark without key — flag |

### 2. Edge-list / result table surface (TanStack Table)

TanStack Table is a headless UI library for TS/JS, React, Vue, Solid, Svelte, Qwik: it supplies state, row models, sorting, filtering (incl. faceting/fuzzy), grouping, expanding, pagination, pinning, row selection, and column sizing/ordering/visibility — but no markup, styles, or virtualization [10]. Its own docs state the packages "do not come with any virtualization APIs or features built-in" and recommend `@tanstack/react-virtual` or react-window; the official virtualized-rows example renders 50,000 rows by combining the two [11]. This makes it the ideal universal lens for: edge-list tables, query-result frames (you control paging/limit and feed it server pages), per-step/per-shot status tables, and node/edge property tables — one mental model, fully typed columns, you own the cells.

**Where you'd reach past it.** (a) *Hundreds of thousands of live-updating cells* or constant streaming — a canvas grid like **Glide Data Grid** (MIT) keeps memory constant by drawing cells lazily on a canvas and is built to handle very high update rates ("hundreds of thousands of updates per second"), where a DOM grid (even virtualized) eventually chokes loading/unloading nodes per frame [3][12]. (b) *Spreadsheet-like editing* (fill handles, copy/paste ranges, in-cell editors at scale) — Glide has editing, resizable/movable columns, and multi-select built in [3]; **react-data-grid** (adazzle, MIT) offers frozen columns, column groups, cell editing, virtualization, ESM, and React 19 support as a middle ground [31]; **AG Grid** offers the richest editing but pushes you toward Enterprise [7]. Recommendation: keep TanStack Table as the backbone for all property/result/status tables, and introduce Glide Data Grid only for the specific surfaces that need canvas-scale or spreadsheet editing. Reuse, don't replace.

### 3. Per-node forms (Zod-driven)

Your node schema is a Zod object; you want to render typed widgets (number, slider/range, text, select, list) per node. Two viable philosophies:

**(A) Composed / manual: react-hook-form + Zod resolver + shadcn/ui `<Form>` (PRIMARY).** This is the canonical, documented shadcn pattern: define a Zod schema, wire it via `useForm({ resolver: zodResolver(schema) })`, and compose accessible fields with `<Form>/<FormField>/<FormItem>/<FormControl>/<FormMessage>` (Radix under the hood, `React.useId()` for ids, client+server validation) [14]. All MIT. Pros: total control over widget choice per field (slider/range/number/select/list), perfect shadcn/ui visual fit, type-safe `z.infer`, no schema translation layer, and it is the exact stack your team already uses (Zod, shadcn). Cons: you write one `<FormField>` per field, so a fully *generic* per-node renderer requires you to build a small mapping from Zod field → widget yourself.

**(B) Schema-driven auto-render: vantezzen Autoform (FALLBACK / accelerator).** Autoform renders a form directly from a Zod schema via `ZodProvider` + `<AutoForm>`; it is schema-/UI-agnostic with official integrations including a **shadcn/ui registry** (`npx shadcn add .../autoform.json`), and the form data is managed by react-hook-form under the hood (so you keep the same mental model and can grab the RHF instance via `onFormInit`) [15][16]. MIT-licensed. **Health (mid-2026):** ~3.5k GitHub stars; `@autoform/zod` latest **v5.0.0** (published ~Nov 2025, ~17k weekly downloads), `@autoform/react` latest **v4.0.0** (~Sept 2025, ~20k weekly downloads); ~29 open issues; **maintenance cadence has slowed** (no publish in several months at time of writing) [15][17]. **Zod compatibility:** the docs state `ZodProvider` and `fieldConfig` are "fully compatible with all Zod versions including v3, v4, and Zod Mini" — with Zod v4 you import `zod/v4` and use `.check(fieldConfig(...))`; for Zod < 3.25 you must pin `@autoform/zod@^4` [17]. **Widget coverage:** out of the box the official integrations ship string/text, number (`z.coerce.number()`), boolean (checkbox, overridable to switch), date (`z.coerce.date()`), select (`z.enum`/`z.nativeEnum`), arrays-of-objects, and nested sub-objects (accordion sections); **no native slider/range** — you add it via a custom field component / `fieldType` override [16][17]. Use Autoform to auto-generate the bulk of per-node forms, then drop to manual RHF+shadcn fields for special widgets (sliders/ranges) and complex linkage.

**(C) `@rjsf/core` (react-jsonschema-form).** Mature, Apache-2.0, large widget set and many themes (MUI, Chakra, AntD, etc.), and v6 (released around Halloween 2025) modernized it with ESM `"type":"module"` packages and React 19 support [18][20]. But it is **JSON-Schema-native**, so a Zod-first app must convert: either the old `zod-to-json-schema` package — **now unmaintained, its README stating "As of November 2025, this project will no longer be actively maintained. Zod v4 natively supports generating JSON schemas, so I recommend you switch to the new major"** — or Zod v4's native `z.toJSONSchema()` [19]. Note `z.toJSONSchema()` cannot represent some types (`z.date()`, `z.bigint()`, `z.map()`, etc.) without `override`/`unrepresentable` handling [19]. RJSF is a fine choice if you already think in JSON Schema or need its theme ecosystem; for a Zod-first, shadcn-first app it adds a conversion layer and isn't shadcn-native.

**(D) Formily (Alibaba).** MIT, ~12.2k stars, high-performance distributed field state (avoids whole-tree re-render), JSON-Schema + JSchema, form builder/designer [25]. Powerful for very large enterprise forms with heavy linkage, but it integrates Alibaba Fusion / Ant Design by default and is a heavier, different paradigm than shadcn/Zod — not the best fit here.

#### Form options comparison

| Approach | License | Zod-native vs. needs conversion | Widget coverage (number / slider / select / list) | Maintenance | shadcn/ui fit | Notes |
|---|---|---|---|---|---|---|
| **react-hook-form + Zod resolver + shadcn `<Form>`** | MIT | Native (zodResolver) | number ✓ / slider ✓ (shadcn Slider) / select ✓ / list ✓ — you choose per field | Excellent (RHF + shadcn both very active) | Perfect (it *is* the shadcn pattern) | PRIMARY; max control; you build the field→widget mapping for genericity |
| **vantezzen Autoform** | MIT | Native (`@autoform/zod`, v3/v4) | number ✓ / slider ✗ built-in (custom) / select ✓ (enum) / list ✓ (arrays of objects) | Moderate; ~3.5k stars; cadence slowed (zod v5.0.0 ~Nov 2025) | Official shadcn registry | FALLBACK; auto-renders most fields; escape-hatch to RHF |
| **@rjsf/core (rjsf)** | Apache-2.0 | Needs Zod→JSON Schema (`z.toJSONSchema()`; `zod-to-json-schema` now unmaintained) | number ✓ / slider via `ui:widget=range` / select ✓ / list ✓ | Active; v6 (~Oct 2025), React 19, ESM | Not native (MUI/Chakra/AntD themes) | Good if JSON-Schema-first; conversion layer for Zod apps |
| **Formily** | MIT | JSON Schema / JSchema (not Zod) | number ✓ / slider ✓ / select ✓ / list ✓ | Active; ~12.2k stars | Not native (Fusion/AntD) | Powerful for huge linked forms; heavier, different paradigm |

### 4. View-switching UX (one graph, many lenses)

The InfoVis name for what you want is **Coordinated Multiple Views (CMV)** with **brushing-and-linking**: a selection made in one view (brushing) is automatically reflected in the others (linking) [21][22]. This is the design behind XmdvTool, Spotfire/DEVise, Snap-Together Visualization, and Improvise [22], and is exactly how Gephi/Cytoscape couple their network view with node/edge tables [32], how Observable notebooks cross-filter cells, how Tableau coordinates dashboards, and how PerspectiveViewer/Graphistry coordinate grid and chart views [27]. Tools that linked node-link and matrix views (e.g., Burch et al., *Dynamic graph exploration by interactively linked node-link diagrams and matrix visualizations*) show insights/selection from one view driving the layout/reordering of the other [5].

**Recommended implementation for your stack.** Hold one **source of truth in a zustand store**: `selectionIds: Set<NodeId|EdgeId>`, `filters` (a typed predicate set), `lens: 'table'|'matrix'|'node-link'|'form'`, and any `ordering`/seriation. zustand fits because it is a centralized store with selective subscriptions (each lens subscribes only to the slice it needs, minimizing re-renders), needs no provider, and pairs naturally with immer for ergonomic immutable updates [26]. Each lens is a **pure projection** of that state:
- *Table* (TanStack Table): `rowSelection` is derived from `selectionIds`; `columnFilters`/`globalFilter` derived from `filters`.
- *Matrix* (Perspective/ECharts): selected rows/cols highlighted from `selectionIds`; `filters` applied as a Perspective filter or pre-filtered data; reorder writes `ordering`.
- *Node-link*: selected/highlighted nodes from `selectionIds`.
- *Form*: the "current node" is `selectionIds` of size 1 (or the focused id); editing writes back through store actions.

The golden rule: **lenses never own selection/filter state; they read from and write to the store.** Switching `lens` is then a pure re-projection, so selection and filters survive the switch for free. "Switch to table view" — the most-requested affordance — becomes a one-line `setLens('table')`. Keep the data itself (nodes/edges) in a separate normalized store or query cache (e.g., TanStack Query) so selection/filter state is decoupled from data loading.

### Zod integration sketch (shallow / conceptual)

Conceptually, treat your **Zod node schema as the single declarative contract** that drives three things by *introspection*, not duplication: (1) the **form** — map each Zod field type to a widget (`z.number()`→number or, with a `.meta()`/registry hint, a slider; `z.enum()`→select; `z.array()`→list; `z.string()`→text), either by hand in RHF+shadcn or automatically via Autoform's `ZodProvider`; (2) **table columns** — derive column defs and cell formatters from the same field types so the edge-list/property table stays in sync with the schema; and (3) **validation** — the very same schema validates edits in the form and any inline cell edits. Use Zod's metadata/registry (`.meta()`, `.describe()`) to carry UI hints (label, widget kind, min/max for sliders, tooltip text) so the schema remains the one place that knows a field is, e.g., a `0–1` slider [19]. Where a JSON-Schema consumer is unavoidable (rjsf), generate it on demand with `z.toJSONSchema()` and handle unrepresentable types via `override` [19]. No generated code is needed at runtime — each lens reads the schema shape and projects widgets/columns from it.

## Recommendations

**Matrix viewer.**
1. **PRIMARY — FINOS Perspective + regular-table.** Reasons: Apache-2.0, virtualizes massive matrices, built-in datagrid↔heatmap↔treemap switcher (covers both your "matrix" and "heatmap" asks with one dependency), pivots/filters/sorts for free, and a Python-friendly story (perspective-python uses the same C++ engine) that will resonate with a Python architect [1][9][27]. Start by feeding the adjacency/relation data as an Arrow table and rendering with the datagrid + heatmap plugins; add a seriation/reordering control (optimal-leaf or Cuthill–McKee) for cluster discovery [4].
2. **FALLBACK — ECharts heatmap (echarts-for-react).** If Perspective's WASM/custom-element integration is too heavy for a given deployment, ship an ECharts heatmap (Apache-2.0, canvas/WebGL, `visualMap`, native tooltips) and wire reordering + selection through your zustand store [23][28]. Use **nivo/heatmap** instead for small matrices where developer speed matters more than scale [29].
3. **Do NOT** base the matrix on AG Grid Enterprise (commercial license for the features you need) [7][13]. AG Grid Community or Glide Data Grid are acceptable only if you specifically want one grid engine shared across edge-list and matrix and are willing to build reordering/color encoding yourself.

**Per-node form approach.**
1. **PRIMARY — react-hook-form + `@hookform/resolvers` (Zod) + shadcn/ui `<Form>`.** It is MIT, native to your stack, fully type-safe, and gives per-field control over number/slider/range/select/list [14]. Build a small, declarative `field → widget` map keyed off Zod types + `.meta()` hints so per-node forms render generically.
2. **FALLBACK / accelerator — vantezzen Autoform (`@autoform/zod` + shadcn registry).** Use it to auto-generate the majority of per-node forms straight from the Zod schema (v3/v4 supported), then override special widgets (sliders/ranges) with custom field components [15][17]. Watch its slowed release cadence; because it sits on react-hook-form, you can always migrate fields down to the PRIMARY approach without rearchitecting.
3. **Only choose `@rjsf/core`** if you decide to standardize on JSON Schema as the wire contract; budget for `z.toJSONSchema()` conversion and unrepresentable-type handling [18][19]. **Skip Formily** unless you hit RHF performance limits on very large, heavily-linked forms [25].

**View-switching.** Implement CMV with a single zustand store (`selectionIds`, `filters`, `lens`, `ordering`) + immer; make every lens a pure projection that reads/writes the store; never let a lens own selection/filter state [22][26]. This guarantees selection and filters persist across table/matrix/node-link/form switches.

**Thresholds that would change these picks.**
- If a target deployment cannot ship WebAssembly or a custom element, drop Perspective for ECharts.
- If live cell-update rates exceed what a DOM/virtualized grid handles (≳10⁵ cells updating per second) on the *edge-list* table, introduce Glide Data Grid for that surface [3][12].
- If Autoform goes >12 months without a release or breaks on your Zod version, treat it as deprecated and fall back fully to manual RHF+shadcn.
- If you already hold an AG Grid Enterprise license org-wide, AG Grid becomes a reasonable single engine for both table and matrix.

## Risks / Unknowns
- **Perspective integration cost.** It is a WebAssembly custom element, not a plain React component; SSR needs care (dynamic import, client-only), and bundling WASM/Arrow adds build complexity [9]. The payoff (scale + built-in switcher) is large, but budget integration time.
- **Autoform maintenance drift.** ~3.5k stars but cadence has slowed (last publishes ~Sept–Nov 2025) and ~29 open issues; treat it as an accelerator on top of RHF, not a long-term load-bearing dependency [15][17]. Its split major versions (`@autoform/react`@4 vs `@autoform/zod`@5) can confuse installs.
- **`zod-to-json-schema` is now unmaintained** (author sunset announcement, Nov 2025) [19]. If you go the rjsf route, rely on Zod v4's native `z.toJSONSchema()` instead, and verify your schemas don't lean on unrepresentable types.
- **Matrix scale ceiling.** Even one-edge-per-pixel matrices top out around a few million edges; beyond that you need hierarchical aggregation (ZAME/Matrix Zoom-style) which no off-the-shelf React component provides — that would be custom work [30].
- **Reordering/seriation is on you.** None of the heatmap libraries compute a good cluster-revealing permutation; you must add optimal-leaf/Cuthill–McKee/TSP ordering for the matrix to deliver its main analytic benefit [4].
- **Glide Data Grid React 19.** It advertises React 16–19 support, but there was an open community issue requesting full React 19 dependency updates; verify peer-deps against your React version before committing [3].
- **TanStack Table v9.** Currently v8 is the stable line referenced here; a v9 is in progress. APIs are stable but watch for migration when v9 lands [10].
- **AG Grid licensing scope.** The Enterprise license is per-front-end-developer ("All Front End Developers on the project must be licensed, not just the ones directly working with AG Grid Enterprise"), and customer-facing apps additionally require a Deployment License Add-on ("You are not permitted to make your application available to external customers without a Deployment License Add-on") [8][13]. Even evaluation triggers a console watermark without a key [7]. Confirm scope before any Enterprise dependency.

## References
1. [finos/regular-table (GitHub)](https://github.com/finos/regular-table)
2. [regular-table — Two Billion Rows example](https://finos.github.io/regular-table/block/?example=two_billion_rows)
3. [glideapps/glide-data-grid (GitHub)](https://github.com/glideapps/glide-data-grid)
4. [Adjacency Matrix — Multivariate Network Visualization (Univ. of Utah VDL)](https://vdl.sci.utah.edu/mvnv/techniques/adj-matrix/)
5. [Burch et al., Dynamic graph exploration by interactively linked node-link diagrams and matrix visualizations (Springer / PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8423958/)
6. [Node-link or Adjacency Matrices: Old Question, New Insights (Okoe, Jianu, Kobourov — TVCG, PDF)](https://www2.cs.arizona.edu/~kobourov/NL-AM-TVCG18.pdf)
7. [AG Grid — Community vs. Enterprise (Licensing)](https://www.ag-grid.com/javascript-data-grid/licensing/)
8. [AG Grid — Licence and Pricing](https://www.ag-grid.com/license-pricing/)
9. [Perspective (FINOS) — React guide / overview](https://perspective.finos.org/guide/how_to/javascript/react.html)
10. [TanStack Table — Introduction (Headless UI)](https://tanstack.com/table/v8/docs/introduction)
11. [TanStack Table — Virtualization Guide](https://tanstack.com/table/v8/docs/guide/virtualization)
12. [Glide Data Grid — product site](https://grid.glideapps.com/)
13. [AG Grid Enterprise — License Purchase (ecommerce terms)](https://www.ag-grid.com/ecommerce/)
14. [shadcn/ui — React Hook Form (Form)](https://ui.shadcn.com/docs/forms/react-hook-form)
15. [vantezzen/autoform (GitHub)](https://github.com/vantezzen/autoform)
16. [Autoform — Getting Started docs](https://autoform.vantezzen.io/docs/react/getting-started)
17. [Autoform — Zod schema provider (v3/v4/Mini)](https://autoform.vantezzen.io/docs/schema-providers/zod)
18. [rjsf-team/react-jsonschema-form (GitHub)](https://github.com/rjsf-team/react-jsonschema-form)
19. [zod-to-json-schema (npm) / Zod JSON Schema docs](https://www.npmjs.com/package/zod-to-json-schema)
20. [RJSF v6.x Upgrade Guide (ESM, React 19)](https://rjsf-team.github.io/react-jsonschema-form/docs/migration-guides/v6.x%20upgrade%20guide/)
21. [Multiple Views — InfoVis:Wiki](https://infovis-wiki.net/wiki/Multiple_Views)
22. [State of the Art: Coordinated & Multiple Views in Exploratory Visualization (Roberts, PDF)](https://www.cs.kent.ac.uk/pubs/2007/2559/content.pdf)
23. [Apache ECharts — Features](https://echarts.apache.org/en/feature.html)
24. [Alper et al., Weighted Graph Comparison Techniques for Brain Connectivity Analysis (CHI 2013) — via Adjacency Matrix survey](https://vdl.sci.utah.edu/mvnv/techniques/adj-matrix/)
25. [alibaba/formily (GitHub)](https://github.com/alibaba/formily)
26. [pmndrs/zustand (GitHub)](https://github.com/pmndrs/zustand)
27. [Perspective — PerspectiveViewer plugins (Panel/HoloViz reference)](https://panel.holoviz.org/reference/panes/Perspective.html)
28. [Best React chart libraries 2026 (LogRocket — ECharts large-data guidance)](https://blog.logrocket.com/best-react-chart-libraries-2026/)
29. [@nivo/heatmap (npm)](https://www.npmjs.com/package/@nivo/heatmap)
30. [NodeTrix: Hybrid Representation for Analyzing Social Networks (arXiv)](https://arxiv.org/pdf/0705.0599)
31. [adazzle/react-data-grid (GitHub)](https://github.com/adazzle/react-data-grid)
32. [Cytoscape.js — documentation](https://js.cytoscape.org/)