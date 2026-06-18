# Prompt 5 — Table / Matrix / Form Surfaces (Grounded Fit)

> Claude Code grounded — the MATRIX/HEATMAP-viewer library survey is DELEGATED to a parallel Claude AI deep-research run. This report covers the grounded fit: per-node FORMS, the VIEW-SWITCHING UX, the TanStack-Table-as-universal-lens question, and the integration against zodal-ui-shadcn. It ends with a requirements checklist to score the Claude AI matrix survey against.

---

## 0. Scope and grounding

This report sits one layer below the canonical facade design in [`04-declarative-facade-and-data-model.md`](./04-declarative-facade-and-data-model.md). Where P4 fixes the canonical graph document, the typed-port representation, the `GraphCapabilities` vocabulary, and the renderer-selection rule, P5 answers a narrower, concrete question: **how does the facade render the non-node-link surfaces — per-node forms, the table/matrix lens, and the act of switching between lenses — by reusing what zodal-ui-shadcn and `@zodal/ui` already ship?**

Three grounding facts from the brief and P4 anchor everything below:

1. **`switch-to-table-view` is the single strongest affordance signal — 12/12 subjects** (grounding brief §(d)). Every regime has a moment where a table *is* the right surface. This makes zodal's existing TanStack-Table backbone a first-class graph view, not an afterthought.
2. **`@zodal/ui` already emits `FormFieldConfig`** (`ui/src/generators/form-config.ts:12-43`) and **zodal-ui-shadcn already ships stateless form renderers** (`form-renderers.ts:93-130`) resolved via `createShadcnRegistry().resolve(field, {mode:'form'})`. The form problem is therefore *not* "pick a form library" — it is "supply the one missing piece: form state + validation + submit."
3. **The state store is framework-agnostic and already TanStack-Table-compatible** (`ui/src/state/store.ts:24-43`): `rowSelection`, `columnFilters`, `globalFilter`, `sorting`, `pagination` are the cross-lens-shared state. View-switching is modeled by adding one pure field, not a new store.

The canonical capability names this report uses are P4's verbatim: `typedPorts`, `validatesConnections`, `canCollapseToComponent`, `watchesValues`, `executable`, `canStep`, `hasProvenance`, `traversal`, `views` (`'node-link' | 'table' | 'matrix' | 'timeline' | 'form'`), `scaleClass`, `hasIntervals` (P4 §5.1). The canonical node model is var/func/entity with a named-port block (P4 §3).

---

## 1. Per-node FORM approaches — comparison table (verified)

The "per-node form" is the surface for the form-first regimes (dagapp value calculators, aw/coact/nw form+wizard panels, and the `form` member of the `views` capability). The candidates were verified against primary sources; **where the verifier's verdict and the survey disagree, the verifier wins** (noted inline).

| Approach | Consumes zodal `FormFieldConfig` + `RendererRegistry`? | Zod v4 validation | License | Maintenance (verified) | Verdict |
|---|---|---|---|---|---|
| **react-hook-form + @hookform/resolvers `zodResolver` + shadcn Form** | **Yes — fully.** RHF supplies only state/validation/submit; widget choice stays with zodal's registry (`form-renderers.ts:93-130`). The missing piece, nothing more. | **Confirmed.** `@hookform/resolvers` v5.1.0 "support Zod 4, Zod v4 mini, and retains compatibility with Zod v3" (#777); latest v5.4.0 (2026-05-21). Fits zodal's pinned `zod ^4.3.6` (peer `^3.24.0 \|\| ^4.0.0`). | MIT (both packages) — verified | **Active.** RHF v7.79.0 (2026-06-13), resolvers v5.4.0 (2026-05-21). Both not archived, no copyleft. | **RECOMMENDED PRIMARY.** Cleanest reuse of the substrate. |
| **shadcn AutoForm (vantezzen/autoform)** | **No — bypasses both.** Owns widget selection from the raw Zod schema; does not read zodal's emitted `FormFieldConfig` or the `RendererRegistry`, so it skips the affordance pipeline (`editWidget`, content→file, `immutableAfterCreate`, `order`). | **Confirmed supported** (verifier *refutes* the survey's "unverified"): `@autoform/zod` v5.0.0, peer `zod ^3.25.0 \|\| ^4.0.0`; known open bug "Error shown in wrong field in Zod 4 Array schema." | MIT — verified (README is authoritative; **no root LICENSE file**, package.json omits `license` — metadata gap) | **Yellow flag — stale.** Repo last pushed 2025-08-15 (~10 months stale as of 2026-06); 35 open issues. The real risk is maintenance, *not* Zod 4. | Fallback / quick-start only; do not adopt where `FormFieldConfig` reuse matters. |
| **@rjsf/core (react-jsonschema-form)** | **No — zero reuse.** JSON-Schema-native; requires a `z.toJSONSchema()` conversion per node and a parallel widget/theming system. Heavy AJV dependency. | n/a (validates JSON Schema via AJV; 0 Zod hits in repo) | Apache-2.0 — verified | **Very active.** v6.6.2 (2026-06-06), 284 releases. | Rejected for this facade — only consider if a backend already speaks JSON Schema. |
| **Formily (alibaba/formily)** | **No — zero reuse.** Own reactive core + own JSON-Schema dialect + Ant/Fusion adapters; Zod is only a side validation option. Highest integration cost. | n/a (own schema; not Zod-native) | MIT — verified | **Stale into 2026.** Latest v2.3.6 (2025-05-15); no 2026 releases (~12 months at time of writing). | Rejected as a dependency. Its field-reaction model is worth borrowing *conceptually* for dagapp successor-recompute (see §4). |

**Verifier corrections folded in:** (a) AutoForm's Zod v4 support is *confirmed*, not "unverified" as the survey framed it — the live risk is staleness; (b) AutoForm's MIT license is confirmed via README despite a metadata gap. Neither correction changes the recommendation, which rests on substrate reuse, not on AutoForm's risk profile.

---

## 2. Recommended per-node form approach — wiring `FormFieldConfig` to react-hook-form

The recommendation is **react-hook-form + `@hookform/resolvers` `zodResolver` + the shadcn Form primitives**, because it adds *only* the piece zodal lacks and changes nothing about widget selection.

### 2.1 What already exists (do not rebuild)

- `@zodal/ui`'s `toFormConfig(collection, mode)` emits an ordered `FormFieldConfig[]` (`form-config.ts:12-43`): `name`, `label`, `type` (widget, via `inferFormWidgetType` — `editWidget` wins, content→`'file'`, else type-mapped, `form-config.ts:46-65`), `required`, `disabled`, `hidden`, `placeholder`, `helpText`, `defaultValue`, `options`, `order`, `zodType`, plus content fields. Mode-aware skip logic (e.g. `immutableAfterCreate` skipped on edit, `form-config.ts:81-88`).
- zodal-ui-shadcn's form renderers (`form-renderers.ts:93-130`) are **stateless** `{ field: { value, onChange }, config }` components, resolved per-field by `createShadcnRegistry().resolve(field, { mode: 'form' })`. The registry already owns widget choice for every dagapp widget (number / slider / range / text / select / list).

### 2.2 The exactly-one missing piece

react-hook-form supplies **state + validation + submit** and *nothing else*:

- `useForm({ resolver: zodResolver(nodeSchema), defaultValues })` runs the **same Zod node schema** (e.g. `TaskNode` / the `addPorts` object from P4 §4) that the canonical model already carries. No second source of truth.
- For each emitted `FormFieldConfig`, RHF's `Controller` (or shadcn's `FormField`, which wraps `Controller`) provides the `{ value, onChange }` pair. That pair is handed straight to the zodal-registry-resolved widget — the same `{ field, config }` contract the stateless renderer already expects.

The wiring is therefore a thin loop:

```ts
const form = useForm({ resolver: zodResolver(nodeSchema), defaultValues });
const config = toFormConfig(nodeCollection, mode);            // @zodal/ui — already exists
const registry = createShadcnRegistry();                       // zodal-ui-shadcn — already exists

config.fields.map((fc) => (
  <Controller
    name={fc.name}
    control={form.control}
    render={({ field }) => {
      const resolved = nodeCollection.fieldAffordances[fc.name];   // ResolvedFieldAffordance
      const Widget = registry.resolve(resolved, { mode: 'form' }); // registry owns widget choice
      return <Widget field={field} config={fc} />;                 // RHF state → zodal widget
    }}
  />
));
```

The key property: **RHF never selects a widget.** `FormFieldConfig.type` → resolved `RendererEntry` is decided by zodal's registry exactly as today. RHF binds state to whatever widget the registry returns. This preserves the entire affordance pipeline (`editWidget`, content→`'file'`, `order`, skip logic) untouched.

### 2.3 Two grounded gotchas to carry into implementation

1. **shadcn's Form surface has shifted.** The survey and the verifier both cite the older shadcn pattern (`FormField` / `FormItem` / `FormControl` / `FormMessage`). The current shadcn docs (verified 2026-06) lead with React Hook Form's `Controller` composed with a newer `Field` / `FieldLabel` / `FieldError` set, spreading `field` onto the input, while still also documenting the `FormField`-wrapper path. The *substance is unchanged* — `Controller` binds `field.{value,onChange}` — but the facade's shadcn binding should target whichever primitive the project's pinned shadcn version ships, not assume `FormField` exists. [4]
2. **The resolver typing gotcha (verifier).** `@hookform/resolvers` issue #799 is **still open** (not "later fixed" as the survey implied). It is a TypeScript-inference annoyance — passing an explicit `useForm<Schema>()` generic alongside `zodResolver` raises a type error — **not** a runtime validation breakage. Workaround: drop the explicit generic and rely on resolver type inference. Adopting the primary recommendation introduces `react-hook-form` + `@hookform/resolvers` as new deps, since **zodal-ui-shadcn does not currently declare them** (verifier).

---

## 3. TanStack Table as universal lens — verdict

**Verdict: TanStack Table is the right universal table/matrix/result-frame/edge-list/status lens, and the grounding-brief's "12/12, non-negotiable" framing holds.** It is verified MIT, actively maintained (repo pushed 2026-06-17; v8 stable line maintained — latest v8.21.x; v9 in active beta, v9.0.0-beta.15 on 2026-06-17). zodal already emits `ColumnConfig` (`column-defs.ts:16-63`) in TanStack-Table shape and the state store (`store.ts:24-43`) is TanStack-compatible by construction, so the table lens is *already wired* — nodes→rows, or edges→edge-list rows, reusing `toColumnDefs`.

**But "universal table lens" is not "universal matrix lens."** Three gaps must be named so the delegated matrix survey is scoped against reality:

1. **No built-in virtualization.** TanStack Table ships *no* virtualization API; it produces the logical row model and you pair it with TanStack Virtual (or react-window / Virtuoso). With that pairing it scales smoothly to 50k+ rows rendering only ~10-20 DOM rows. [2][3] This is fine for a tall edge/node *list*, but a dense N×N adjacency *matrix* needs **two-dimensional** (row *and* column) virtualization — TanStack Table virtualizes rows well; column virtualization for a wide matrix is the less-trodden path and a real integration cost.
2. **No native heat/color encoding.** A matrix/heatmap surface needs per-cell color scales driven by cell value. TanStack Table has no concept of this; it would live in the cell renderer, fed by the `GraphStyling.rules` channel mapping from P4 §6 (`channel: 'color'`, `scale`). The encoding is data the facade already models; the *renderer* of that data in a cell grid is not something TanStack provides.
3. **No native reorderable rows/cols as a matrix primitive.** TanStack supports column ordering/pinning, but matrix *seriation* (reordering both axes to reveal block structure) is an application concern on top, not a table feature.

**Conclusion:** TanStack Table is the universal *table* lens and the correct substrate to *integrate a matrix viewer against* (shared row model, shared column defs, shared selection/filter state). It is **not, by itself, the matrix/heatmap viewer.** That viewer is the delegated survey's subject — and it should be judged in part on how cleanly it sits on (or interoperates with) the TanStack row model rather than forking a parallel data path.

---

## 4. Matrix / heatmap viewer — DELEGATED to the Claude AI survey

The library survey for the dense matrix / heatmap / adjacency-grid viewer is **delegated to a parallel Claude AI deep-research run**. This report does not pick that library. Instead it fixes the **evaluation requirements** the Claude AI results must be scored against, so the two reports reconcile cleanly. Each requirement ties back to the grounded substrate or to a P4 capability.

**Score every matrix-viewer candidate the Claude AI survey returns against this checklist:**

1. **Reorderable rows AND columns** — supports manual reorder and ideally programmatic seriation (block-structure reveal). Maps to the matrix view of `extract-subgraph` / community structure (traversal overlays, P4 §6).
2. **Large-matrix virtualization (2-D)** — virtualizes *both* axes, not just rows. Must stay responsive at the `scaleClass` the graph declares (`medium`→`large`); honest about where it falls over. (TanStack Virtual handles rows; the matrix viewer must handle columns too — §3 gap.)
3. **Color / heat encoding** — per-cell value→color scale (categorical, linear, threshold), driven by data, not hardcoded. Must accept the `GraphStyling.rules` shape from P4 §6 (`channel: 'color'`, `scale: { kind, domain, range }`) rather than inventing a parallel styling API.
4. **Cell tooltips / hover detail** — per-cell hover popups (the `hover-popup` affordance, brief cluster G), since matrix cells carry edge weight / relation metadata not otherwise displayable inline.
5. **Zod-driven config** — the viewer's column/cell/axis config must be derivable from (or accept) zodal's emitted config, not require a separate schema. Ideally consumes `ResolvedFieldAffordance` (its index signature, `types.ts:341`) the same way the table lens does.
6. **Clean TanStack-Table integration** — sits on the shared TanStack row model and shared `columnFilters` / `rowSelection` / `globalFilter` state (`store.ts:24-43`) rather than forking a parallel data path. A candidate that demands its own data pipeline scores lower because it breaks the cross-lens selection/filter bridge (§5).
7. **Permissive license** — MIT / Apache-2.0 / BSD. **FLAG any copyleft (GPL/LGPL/AGPL) or commercial/source-available license** per the project health bar. Verify against the primary repo, not a blog.
8. **Maintenance health** — recent releases/commits, responsive issues, not archived (the same bar applied to the form candidates in §1; e.g. AutoForm was flagged for ~10-month staleness even with confirmed Zod 4 support).

**Reconciliation rule:** if the Claude AI survey recommends a matrix viewer that fails (5), (6), or (7), prefer building a thin heat-cell renderer *on TanStack Table* (per §3) over adopting it — the substrate-reuse and license bars dominate. Where the Claude AI survey's license/maintenance findings conflict with a primary-source verification, the primary source wins (same policy applied to the form candidates here).

---

## 5. The VIEW-SWITCHING pattern — grounded in the state store + `views` capability

**Recommendation: model the active view as one more pure field on the framework-agnostic state store, exactly mirroring how `sorting` / `pagination` are modeled today.** This is the survey's "extend CollectionState with activeView" candidate, and it is sound because it changes nothing about the store's architecture.

### 5.1 The store extension

`createCollectionStore<T>(collection)` (`store.ts:96-226`) returns pure `{ initialState, actions, selectors }`. `CollectionState` (`store.ts:24-43`) already holds the **cross-lens-shared state**: `rowSelection`, `columnFilters`, `globalFilter`, `sorting`, `pagination`. Add:

- `activeView: GraphView` — where `GraphView` is the canonical `views` capability member (`'node-link' | 'table' | 'matrix' | 'timeline' | 'form'`, P4 §5.1).
- `setActiveView(state, view)` — a pure setter mirroring `setSorting` etc. (`store.ts:49-65`).

The renderer for the active view is then picked by the **existing** `RendererRegistry.resolve` mechanism keyed on `GraphCapabilities.views` + `scaleClass` + `typedPorts` (P4 §5.2 selection rule, PRIORITY bands `tester.ts:15-26`) — no registry change, no new resolve path.

### 5.2 Selection is the bridge between lenses

The reason this works without per-lens state duplication is that **`rowSelection` node-ids map 1:1 to `GraphSelection.nodes`** (P4 §6):

- A row selected in the **table** lens stays highlighted as `'primary'` in the **node-link** overlay (`GraphOverlays.highlights`, P4 §6).
- The same selection scopes the per-node **form** lens (§2) to the selected node, and selects the row/column band in the **matrix** lens (§4).
- `extract-subgraph` — the single highest-leverage affordance (appears in *every* regime, brief §(d)) — reads `GraphSelection.nodes` identically regardless of which lens produced the selection.

### 5.3 Filters are renderer-agnostic

`columnFilters` / `globalFilter` carry the same `FilterExpression` AST (`types.ts:379-405`) that every lens honors: it dims rows in the table, greys nodes in node-link, and narrows the matrix. One filter declaration, every lens consistent — no per-lens filter translation.

### 5.4 Per-view async sub-state has a precedent

If a lens needs lazily-loaded side data (e.g. the matrix lens fetching cell weights, or a node-link lens expanding neighbors), the precedent is `CollectionState.contentLoading` — the per-item/per-field nested map already used for bifurcated providers (`store.ts:24-43`, brief substrate §5). A view-specific `relationLoading` / expansion-state field follows the same pure-action pattern, leaving the TanStack-compatible core untouched.

**Net:** view-switching is a one-field, one-action store extension plus the existing registry selection rule. Selection and filters are shared by construction because they already live on the store as renderer-agnostic state; the lenses are pure projections of the same `CollectionState`.

---

## 6. Risks / unknowns

1. **New dependencies in zodal-ui-shadcn.** The primary form recommendation adds `react-hook-form` + `@hookform/resolvers` (verifier: neither is currently declared). Low risk — both MIT, both verified active — but it is a real dependency-surface change to land in the satellite package.
2. **shadcn Form primitive drift (§2.3).** The facade's shadcn binding must target the project's pinned shadcn version's actual primitives (newer `Controller` + `Field` vs. older `FormField` wrapper). Pinning matters; assume neither blindly. [4]
3. **Resolver typing gotcha (#799, still open).** TypeScript-inference annoyance with explicit `useForm<Schema>` generics; runtime validation is fine. Documented workaround exists (drop the generic). Track the issue.
4. **2-D matrix virtualization is the real cost (§3).** TanStack Virtual covers rows; a dense matrix needs column virtualization too. This is the single most likely place the "table is universal" claim strains, and it is precisely what the delegated matrix survey must report honestly on (checklist item 2).
5. **AutoForm staleness if chosen as fallback.** ~10-month push gap and 35 open issues including an open Zod 4 array-field bug. Acceptable only for throwaway/quick-start forms where `FormFieldConfig` reuse is explicitly not required.
6. **Matrix-viewer / TanStack data-path fork.** If the delegated survey's winner demands its own data pipeline (failing checklist item 6), the cross-lens selection/filter bridge (§5) breaks and the view-switching guarantee weakens. Prefer a thin heat-cell renderer on TanStack Table in that case (§4 reconciliation rule).
7. **`form` lens for a *graph* node vs. a collection row.** zodal's `toFormConfig` was built for collection items; a graph node's *ports* (P4 §4.3, a Zod object whose keys are port names) flow through the same inference, but the per-port form (dagapp's `{value, arg_type, widget, range}`) is a projection of the resolved port type. Verifying that `toFormConfig` handles a port-object schema as cleanly as a flat node schema is unconfirmed and should be checked against `form-config.ts` before committing the form lens to func nodes.

---

## References

[1] [React Hook Form — GitHub repository](https://github.com/react-hook-form/react-hook-form). MIT; v7.79.0 (2026-06-13), not archived, actively maintained — verified via GitHub API.

[2] [Virtualization Guide — TanStack Table v8 Docs](https://tanstack.com/table/v8/docs/guide/virtualization). TanStack Table ships no built-in virtualization; pairs with TanStack Virtual / react-window for 50k+ row datasets rendering only the visible subset.

[3] [TanStack Virtual — official site](https://tanstack.com/virtual/latest). MIT; the row/column virtualizer paired with TanStack Table; row virtualization is well-trodden, 2-D (column) virtualization is the harder path for dense matrices.

[4] [shadcn/ui — Building forms with React Hook Form and Zod](https://ui.shadcn.com/docs/forms/react-hook-form). Uses `zodResolver` to validate against Zod schemas; current docs lead with React Hook Form's `Controller` composed with `Field`/`FieldLabel`/`FieldError`, while still documenting the `FormField` wrapper path.

[5] [@hookform/resolvers — v5.1.0 release notes (Zod 4 support)](https://github.com/react-hook-form/resolvers/releases/tag/v5.1.0). "support Zod 4, Zod v4 mini, and retains compatibility with Zod v3" (#777); latest v5.4.0 (2026-05-21), MIT — verified.

[6] [@hookform/resolvers — issue #799 (Zod v4 + explicit useForm generic typing)](https://github.com/react-hook-form/resolvers/issues/799). Still OPEN; a TypeScript-inference annoyance, not a runtime breakage; workaround is to drop the explicit `useForm<Schema>` generic.

[7] [vantezzen/autoform — GitHub repository](https://github.com/vantezzen/autoform). MIT (per README; no root LICENSE file, package.json omits license — metadata gap); `@autoform/zod` v5.0.0 peer `zod ^3.25.0 || ^4.0.0` (Zod 4 confirmed); repo last pushed 2025-08-15 (~10 months stale), 35 open issues.

[8] [rjsf-team/react-jsonschema-form — GitHub repository](https://github.com/rjsf-team/react-jsonschema-form). Apache-2.0; v6.6.2 (2026-06-06), 284 releases; JSON-Schema-native (AJV), not Zod — verified.

[9] [alibaba/formily — GitHub repository](https://github.com/alibaba/formily). MIT; latest v2.3.6 (2025-05-15), no 2026 releases (~12 months stale); own reactive core + JSON-Schema dialect, not Zod-native — verified.

[10] [TanStack/table — GitHub repository](https://github.com/TanStack/table). MIT; repo pushed 2026-06-17, v8 stable maintained + v9 in active beta (v9.0.0-beta.15) — verified.
