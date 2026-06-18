# P1 — Typed-Port Node-Link Editor Libraries

> Claude Code grounded — full library survey done here AND adversarially verified against primary sources (npm/GitHub/docs). Maps onto the canonical model + GraphCapabilities from the P4 report.

This is the **typed-port editor** deliverable for the zodal-graph facade. Its job is to pick the JavaScript/React library that best implements affordance **cluster B** — *typed ports + connect-time validation* — the single hardest-to-source capability in the whole fleet and the meshed-class differentiator (grounding brief §b, §e). Everything here is pinned to the canonical graph model and the `GraphCapabilities` vocabulary established in the P4 report (`04-declarative-facade-and-data-model.md`): the `var` / `func` / `entity` node split, the typed/kinded `GraphPort` on func nodes, the `GraphEdge.targetPort` field that flat node-link otherwise drops, and the capability keys `typedPorts`, `validatesConnections`, `canCollapseToComponent`, `watchesValues`, `executable`, `canStep`, `hasProvenance`, `traversal`, `views`, `scaleClass`, `hasIntervals`.

The decisive design fact from P4 §1.1 is reproduced here because it governs every recommendation below: **no node-link library — and no serialization standard — carries a *typed, kinded* port natively.** GraphML carries a *named* port (topological only); React Flow and Rete carry a *runtime* port (handle / socket). The *type* and the *connect-time validity rule* are always a zodal-defined enrichment. So the question this report answers is not "which library type-checks for us" — none fully does — but "which library gives the cleanest seam to *drive* typed ports and connection validation **from a Zod schema** while staying headless, serializable, and React-renderer-agnostic."

---

## 1. The capability axes (a–g)

The survey scores each candidate on seven port/editor axes, plus the facade-fit axes (headless/declarative, license, bundle). The axes map directly onto P4's `GraphCapabilities`:

- **(a) Multiple addressable ports per node** — does a node carry several named connection points an edge can bind to? Maps to `GraphPort[]` on a node and `GraphEdge.targetPort` (`typedPorts` precondition).
- **(b) Connect-time connection validation** — can a connection be rejected *at drag time* by a predicate? Maps to `validatesConnections` and the `isValidConnection`-class hook.
- **(c) Per-node custom rendering** — can a node render arg names / types / defaults / value overlays richly (the metadata-rich meshed `func` node)? Maps to the small-rich-editor regime.
- **(d) Sub-flows / groups + collapse-to-component** — nesting, and the meshed collapse-to-reusable-component round-trip. Maps to `canCollapseToComponent`.
- **(e) Execution / value overlay** — a dataflow engine or value-watch on canvas. Maps to `executable`, `canStep`, `watchesValues`.
- **(f) Controlled, serializable state** — is graph state a plain external config object (SSOT) that drives the view, round-tripping to the canonical `nodes_and_links` superset?
- **(g) Auto-layout** — dagre / ELK / force layout as renderer-agnostic data (the P4 `GraphLayout` hint).

---

## 2. Comparison table — libraries × capabilities

Legend: ✅ first-class / built-in · ⚙️ supported but **you supply the logic** · 🔶 recipe/example, not a primitive · ➕ via plugin · ✗ not supported. Versions and licenses are primary-source-verified (npm registry / GitHub / vendor docs) as of the June 2026 reference date.

| Library | (a) Multi ports | (b) Connect-time validation | (c) Custom node render | (d) Sub-flows / collapse | (e) Exec / value overlay | (f) Controlled serializable state | (g) Auto-layout | Headless / declarative | License | Bundle |
|---|---|---|---|---|---|---|---|---|---|---|
| **React Flow / xyflow** (`@xyflow/react` 12.11.0) | ✅ many `<Handle>`, id = port name → `targetPort` | ⚙️ `isValidConnection(c)=>boolean` — **hook given, type predicate is yours** | ✅ best-in-class (arbitrary React component) | ⚙️ groups via `parentId`/`extent`; 🔶 collapse = Pro example + `useExpandCollapse` hook | ✗ no engine; ⚙️ trivially rendered in custom node, you own propagation | ✅ fully controlled `{nodes,edges}` arrays, `toObject()` — best SSOT fit | ➕ documented dagre + ELK integration | ✅ controlled-array model, plain serializable state | MIT | moderate (React + lib) |
| **Rete.js v2** (`rete` 2.0.6 + plugins) | ✅ inputs/outputs each carry a `Socket` (= typed port) | ✅ **same-socket-only by DEFAULT**; customize via `isCompatibleWith` + `addPipe('connectioncreate')` | ✅ via framework render plugins (react/vue/angular/svelte) | ✗ no first-class collapse-to-node in core (plugin/community territory) | ✅ built-in `rete-engine` (dataflow + control-flow) | ⚙️ import/export, but state lives in the `NodeEditor` object graph — more imperative than a controlled array | ➕ `rete-auto-arrange-plugin` (ELK) | 🔶 plugin-architected, more stateful/imperative than controlled SSOT | MIT | larger (plugin set) |
| **Litegraph.js** (`litegraph.js` 0.7.18 / GitHub 1.0) | ✅ `addInput/addOutput(name,type)`; in=1 link, out=many | ✅ **built-in type checking**; rejects incompatible slot types unless one side is wildcard (`type 0`/NONE) | ✗ Canvas2D `onDraw*` — imperative, weak fit for rich React metadata UI | ⚙️ visual collapse + `Subgraph` node type; dated API | ✅ has an execution model | ⚙️ serializable but Canvas/imperative model | ➕ limited | ✗ Canvas2D, not declarative/headless React | MIT | small, self-contained |
| **BaklavaJS** (`baklavajs` 2.8.1) | ✅ typed node interfaces | ✅ `@baklavajs/interface-types` — connect only chosen type pairs, optional value conversion | ✅ (Vue) | ⚙️ partial | ✅ engine plugin | ⚙️ `@baklavajs/core` usable headless (plugins à-la-carte) | ➕ | ⚙️ headless via `@baklavajs/core`, **but renderer is Vue** — mismatch for a React facade | MIT | moderate |
| **GoJS** (`gojs`, commercial) | ✅ native typed ports | ✅ native `linkValidation` | ✅ | ✅ **native collapse/expand groups** | ⚙️ | ✅ serializable model | ✅ | ✅ most feature-complete | **proprietary** (~US$3,995/dev, per-seat) — **FAILS permissive-license requirement** | — |

**Reading the table — the cluster-B split.** Three libraries do connect-time validation in fundamentally different ways, and the difference is the whole story:

- **React Flow gives you the *hook*, not the *type check*.** `isValidConnection: (edge: Edge \| Connection) => boolean` is developer-supplied (verified against the API reference and the official validation example). React Flow's handles are **typeless at the protocol level** — a handle `id` *is* a port (it maps to the canonical `targetPort`), but the *type* is not carried by the library; you attach it via `node.data` / handle-id convention and compare types inside your predicate. So "React Flow rejects type-incompatible wires" is true **only because the facade writes that predicate** — which is exactly what we want, because the facade *generates* that predicate from Zod port types (see §4).
- **Rete rejects type-incompatible wires *by default*** — the inverse default from React Flow. Sockets are not compatible unless they are the *same* socket (or you opt in via `isCompatibleWith`); rejection is enforced through a `connectioncreate` pipe (`addPipe`). This is the truest off-the-shelf cluster-B behavior, and it comes bundled with a real dataflow engine (`rete-engine`).
- **Litegraph type-checks natively** too (slot `type` strings, with `type 0`/NONE as a wildcard), but its Canvas2D imperative rendering is a poor fit for rich React metadata nodes and a headless declarative facade.

---

## 3. Primary recommendation + fallback

### Primary: **React Flow / xyflow (`@xyflow/react`)**

React Flow is the recommended typed-port editor for the facade's **small-rich editor** branch — exactly the P4 §5.2 *rule 2* target: `typedPorts && validatesConnections && canEditNode && scaleClass === 'small'`. The reasons are structural, not incidental:

1. **Its serialized shape is the canonical model, almost 1:1.** React Flow state is `{ nodes: [{id, type, data, position, parentId}], edges: [{id, source, target, sourceHandle, targetHandle, data}] }`. This maps directly onto P4's `GraphNode` / `GraphEdge`, with **`sourceHandle = sourcePort`** and **`targetHandle = targetPort`** — i.e. React Flow's handle model is the closest renderer-side analog to the typed port, and it natively carries the one field flat node-link drops. P4 §7 already lists it as the **highest-fidelity renderer adapter** for precisely this reason.
2. **Fully controlled, plain-serializable state = the SSOT/headless ideal.** Nodes and edges are external config arrays that *drive* the view; `toObject()` serializes for save. This is the best fit for the facade's config-driven, headless, "config object → renderer" principle — better than Rete's stateful `NodeEditor` object graph.
3. **Best-in-class custom node rendering** — nodes are arbitrary React components, so a meshed `func` node can render its arg names, types, defaults, and (with the facade owning propagation) value overlays. This is the strongest fit for metadata-rich nodes (axis c).
4. **The validation hook is the *right* seam.** Because React Flow does **not** itself type-check, the facade supplies a generated `isValidConnection` derived from the Zod port types — which is exactly how P4 §4 / §5.1 wants `validatesConnections` implemented: facade-implemented, not delegated.
5. **Maintenance & license are clean.** Primary-source verified: `@xyflow/react` **12.11.0**, **MIT**, npm-modified **2026-06-01**, ~37k★, commercial Pro tier funding maintenance, frequent releases. React Flow 12 shipped as `@xyflow/react` (rename from `reactflow`).

### Fallback / alternate: **Rete.js v2**

Rete is the **alternate for the pure executable-dataflow branch** (P4 §5.2 rules 2–3, the `executable && watchesValues` path), *not* the default small-rich editor. It wins where React Flow needs the most facade-authored glue and loses where the facade most wants control:

- **Wins:** sockets *are* typed ports and reject by default (truest off-the-shelf cluster-B), and `rete-engine` natively models "node = function, run the graph, watch values" — almost a direct match for meshed's `FuncNode` + `DAG.call` and the `watchesValues` capability.
- **Loses:** the engine *couples editing to an execution model* the facade may not want (P4 §9 risk 1 — the TS facade is likely the *editor/viewer* that hands execution back to a Python meshed runtime, in which case the engine is unwanted weight); and state lives in Rete's imperative `NodeEditor` object graph rather than a controlled serializable array, which is further from the facade's SSOT ideal.
- **Maintenance caveat (verifier downgrade — see §5):** Rete is **maintained but slow**, not "actively maintained" in the high-frequency sense. Primary-source versions: `rete` 2.0.6 (npm-modified Jun 2025), `rete-react-plugin` 2.1.0 (Aug 2025), `rete-engine` 2.1.1, `rete-auto-arrange-plugin` 2.0.2 — releases ~9–12 months apart, community far smaller than React Flow's. The v2 line is current with no abandonment signal, but factor the cadence into any dependency decision.

**Explicitly NOT recommended:** **GoJS** (most feature-complete — native typed ports, `linkValidation`, native collapse/expand groups, serializable model — but **proprietary, ~US$3,995/developer, per-seat**; primary-source verified against the GoJS license and sales pages: "The Software is licensed, not sold… Northwoods retains all right, title, and interest." This **fails the project's permissive MIT/Apache/BSD requirement** and is flagged accordingly). **Litegraph.js** (native type-checking, but Canvas2D imperative rendering is the wrong substrate for a headless declarative React facade with rich metadata nodes; modest maintenance — last npm release `litegraph.js` 0.7.18 in Jan 2024). **BaklavaJS** (clean typed connections via `@baklavajs/interface-types`, MIT, `baklavajs` 2.8.1 from Nov 2025 — but its renderer is **Vue** (`@baklavajs/renderer-vue`); only viable for a React facade if consumed headlessly via `@baklavajs/core`, which is a heavier integration than React Flow with no offsetting benefit).

---

## 4. Driving typed ports + connection validation from a Zod schema

This is the load-bearing sketch: how the canonical model + `GraphCapabilities` from P4 turn a **Zod schema** into typed React Flow handles and a generated `isValidConnection`. It follows the meshed chain end to end — **`i2.Sig` → `GraphPort` → React Flow handle** — and shows how `typedPorts` / `validatesConnections` drive the predicate.

### 4.1 The mapping chain: meshed `Sig` → canonical `GraphPort` → renderer handle

meshed's `FuncNode` carries `self.sig = Sig(self.func)` (`base.py:267`), giving each parameter a **name, kind, default, and type annotation**; `sig.ch_names(**bind)` (`base.py:418-433`) renames the internal params to the *external* port names. P4 §3 captures this as the canonical `GraphPort`:

```ts
interface GraphPort {
  port: string;        // external name — meshed's bind value (sig.ch_names(**bind))
  param?: string;      // internal param name on the wrapped function
  type?: PortTypeRef;  // a Zod-type reference → resolves to a zodal field affordance
  kind?: 'positional_only' | 'positional_or_keyword' | 'keyword_only'
       | 'var_positional' | 'var_keyword';
  required?: boolean;
  default?: unknown;
  direction: 'in' | 'out';
}
```

The Zod side (P4 §4.3): a func node's ports are modeled as a Zod object whose **keys are port names** and whose **values are the port's type schema**, with `kind` / `param` / `direction` riding `.meta()`:

```ts
const addPorts = z.object({
  x: z.number(),               // port 'x' : number, required
  y: z.number().default(0),    // port 'y' : number, default 0 → required:false
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
```

`type`, `required`, `default`, `enumValues`, `numericBounds` all come from zodal's **existing** introspection (`getZodBaseType`, `getNumericBounds`, `getEnumValues`) — nothing new to infer. A generator walks this schema to produce one `GraphPort` per key.

### 4.2 `GraphPort` → React Flow `<Handle>` (the renderer mapping)

Each `GraphPort` becomes one React Flow `<Handle>` whose **`id` is the port name** (so `targetHandle === targetPort`), with the resolved Zod type stashed on `node.data` for the validator to read:

```tsx
// Inside a custom node component (the meshed func node).
function FuncNodeView({ data }: NodeProps<FuncNodeData>) {
  return (
    <div className="func-node">
      <header>{data.label}</header>
      {data.ports.filter(p => p.direction === 'in').map(p => (
        <label key={p.port}>
          <Handle type="target" position={Position.Left} id={p.port} />
          {p.port}: {p.type}{p.required ? '' : ` = ${String(p.default)}`}
        </label>
      ))}
      {data.ports.filter(p => p.direction === 'out').map(p => (
        <Handle key={p.port} type="source" position={Position.Right} id={p.port} />
      ))}
    </div>
  );
}
```

`node.data.ports` is the resolved `GraphPort[]`; the handle `id` carries the port name into every `Connection` React Flow emits (`{ source, sourceHandle, target, targetHandle }`).

### 4.3 `typedPorts` + `validatesConnections` → generated `isValidConnection`

Because React Flow's handles are **typeless at the protocol level**, the facade *generates* the type-compatibility predicate from the Zod port types. The capability flags from P4 §5.1 gate it:

```ts
// Generated once per graph definition from the resolved port schemas.
function makeIsValidConnection(
  graph: CanonicalGraph,
  caps: GraphCapabilities,
  portTypeCompatible: (out: PortTypeRef, into: PortTypeRef) => boolean,
): IsValidConnection {
  // If the graph declares no typed ports / no validation, accept any topological connection.
  if (!caps.typedPorts || !caps.validatesConnections) return () => true;

  return ({ source, sourceHandle, target, targetHandle }) => {
    const src = lookupPort(graph, source, sourceHandle, 'out');   // sourceHandle → sourcePort
    const dst = lookupPort(graph, target, targetHandle, 'in');    // targetHandle → targetPort
    if (!src || !dst) return false;                                // unknown port → reject
    return portTypeCompatible(src.type, dst.type);                // Zod-derived type check
  };
}

// Wired into React Flow at component level:
<ReactFlow
  nodes={nodes} edges={edges}                       // controlled, serializable SSOT (axis f)
  isValidConnection={isValidConnection}             // facade-generated (axes a + b)
  nodeTypes={{ FuncNode: FuncNodeView }}            // §4.2 custom render (axis c)
/>;
```

The chain closes: **`typedPorts: true`** means nodes carry `GraphPort[]` (so the handles exist and are addressable, axis a); **`validatesConnections: true`** activates the generated `isValidConnection` (axis b); both are **facade-implemented, not delegated to React Flow** — which is the only way to do it, since the library deliberately ships the hook without the type check. When the graph declares `typedPorts: false` (a plain `entity` graph), the predicate degrades to accept-any, and the same renderer serves the portless case with no special-casing.

`portTypeCompatible` is the **one genuinely new module** this requires — the Zod-v4 subtyping relation — flagged as an open risk below.

---

## 5. Risks / unknowns

These caveat the recommendation; the first two are the P4-flagged gaps that bear directly on cluster B. Where the survey and the adversarial verifier conflicted, the verifier's verdict is taken.

1. **The Zod-v4 subtyping / connection-validation gap (P4 §9 risk 2).** Carrying *which* port an edge binds to is solved (`targetPort`); deciding *whether a connection is type-valid* is not, because no serialization format and no library defines it. `portTypeCompatible` in §4.3 needs a defined **subtyping rule over Zod v4 types**: is `z.number()` connectable into `z.number().min(0)` (refinement — narrower target)? into `z.union([z.number(), z.string()])` (widening)? into `z.string()` (reject)? There is **no existing precedent** to reuse; this is a new small module, probably built on zodal's introspection helpers but with rules the facade must define. Treat the depth of this relation (covariance, refinements, unions, optional/nullable, structural object compatibility) as an **open design question**, not a solved one. Until it is defined, `validatesConnections` should be conservative (exact base-type match + wildcard) rather than claim full structural subtyping.

2. **Variadic `*args` / `**kwargs` port arity (P4 §9 risk 3).** meshed's `handle_variadics` (`base.py:108`) normalizes variadic functions, and the canonical `kind: 'var_positional' | 'var_keyword'` tag *records* the variadic kind — but a variadic port has **unbounded arity**, and **React Flow needs a distinct handle `id` per slot**. How the renderer draws "N handles for one `*args` port", how a new slot is added on connect, and how edges address `args[0]` vs `args[1]` (e.g. a synthetic `port` like `args[2]`) is **unspecified**. This is the sharpest renderer-side unknown for full meshed fidelity; a slot-addressing scheme must be designed before variadic func nodes are editable.

3. **Collapse-to-component is not a React Flow primitive (P4 §5.1 `canCollapseToComponent`).** Verified: React Flow's expand/collapse is a **Pro example** built on a reusable `useExpandCollapse` hook over `parentId`/`extent` grouping — **not** a native one-call primitive. The meshed collapse-to-reusable-component round-trip (`canCollapseToComponent`) must be **facade-implemented** via canonical subgraph extraction (the brief's `extract-subgraph`, the single highest-leverage affordance), not delegated to the library. Budget this as facade work, not a checkbox.

4. **React Flow does not type-check — by design.** Verified against the API reference and validation example: `isValidConnection` is a developer-supplied predicate and handles are typeless at the protocol level. This is reframed as the *primary reason to choose React Flow* (§3/§4), but it is also a risk if mis-scoped: the facade owns 100% of the type-compatibility logic, and any bug there silently permits invalid wires. The validation surface must be tested as facade logic, not assumed from the library.

5. **Rete's maintenance is *maintained-but-slow*, not "actively maintained" (verifier downgrade).** The survey claimed Rete is "actively maintained into 2025–2026"; the verifier marked this **uncertain** and downgraded it. Primary-source confirmed: release cadence ~9–12 months (`rete` 2.0.6 Jun 2025, `rete-react-plugin` 2.1.0 Aug 2025), community far smaller than React Flow's. Directionally the survey is right (Rete is alive, v2 current, no abandonment); but if Rete becomes the executable-dataflow path, weigh the slower cadence and smaller ecosystem as a real maintenance risk. (The survey's `socket.combineWith()` API is also **v1-stale** — the v2 mechanism is `isCompatibleWith` + an `addPipe('connectioncreate')` validation pipe; the substantive "rejects by default, same-socket-only" claim holds.)

6. **`funcRef` resolution / execution locus (P4 §9 risk 1).** Independent of the editor library: the canonical model serializes a *reference* to a function, not the function. Whether the TS facade is ever the *executor* or only the *editor/viewer* that hands a serialized graph back to a Python meshed runtime is unconfirmed (P4 implies the latter). This decides whether Rete's `rete-engine` is an asset or unwanted weight — and therefore how strongly Rete competes with React Flow on the executable branch.

7. **Litegraph maintenance / version skew.** The verifier confirmed native type-checking and MIT license but noted **modest maintenance** — the GitHub LiteGraph 1.0 tag is March 2024, and the npm `litegraph.js` package lags at 0.7.18 (Jan 2024), i.e. last release ~2 years before the June 2026 reference date. Not recommended regardless (Canvas2D / imperative), but the version skew is a flag if it is ever reconsidered.

---

## REFERENCES

[1] [React Flow — `IsValidConnection` type (API reference)](https://reactflow.dev/api-reference/types/is-valid-connection). `(edge: Edge | Connection) => boolean`; developer-supplied predicate, return `false` to reject; no built-in handle type-checking.

[2] [React Flow — Connection validation example](https://reactflow.dev/examples/interaction/validation). Validation logic is written by the developer in `isValidConnection`; React Flow supplies only the hook.

[3] [React Flow — `Handle` component (ports) documentation](https://reactflow.dev/api-reference/components/handle). Multiple handles per node, each with a unique `id` = the port; `sourceHandle` / `targetHandle` carry the port on connections.

[4] [React Flow — Sub-flows (grouping) guide](https://reactflow.dev/learn/layouting/sub-flows). Grouping via `parentId` + `extent: 'parent'` + `type: 'group'`; positioning only, not collapse.

[5] [React Flow — Expand and Collapse example (Pro)](https://reactflow.dev/examples/layout/expand-collapse). Verified Pro example using a reusable `useExpandCollapse` hook — collapse-to-component is a recipe, not a primitive.

[6] [xyflow / React Flow — GitHub repository](https://github.com/xyflow/xyflow). MIT; `@xyflow/react` (rename from `reactflow`); ~37k★, commercial Pro tier funds maintenance.

[7] [`@xyflow/react` — npm registry](https://www.npmjs.com/package/@xyflow/react). Primary-source verified: version **12.11.0**, license **MIT**, last modified **2026-06-01** — very actively maintained.

[8] [Rete.js — Connections guide (v2)](https://retejs.org/docs/guides/connections/). Inputs/outputs carry sockets; connection behavior customized via presets and pipes.

[9] [Rete.js — Connection validation guide (v2)](https://retejs.org/docs/guides/validation). Sockets are **not** compatible by default; customize via `isCompatibleWith` and an `addPipe('connectioncreate')` validation pipe; returning nothing rejects the connection. (Corrects the survey's v1-stale `combineWith`.)

[10] [Rete.js — Engine concept (dataflow + control-flow)](https://retejs.org/docs/concepts/engine). Built-in execution engine; couples editing to an execution model.

[11] [`rete` — npm registry](https://www.npmjs.com/package/rete). Primary-source verified: version **2.0.6**, last modified **2025-06-30** — maintained-but-slow cadence.

[12] [`rete-react-plugin` — npm registry](https://www.npmjs.com/package/rete-react-plugin). Primary-source verified: version **2.1.0**, **MIT**, last modified **2025-08-29**; companion `rete-engine` 2.1.1, `rete-auto-arrange-plugin` 2.0.2.

[13] [Litegraph.js — guides / README (jagenjo)](https://github.com/jagenjo/litegraph.js/blob/master/guides/README.md). `addInput`/`addOutput(name, type)`; built-in slot type-checking with `type 0` (NONE) as wildcard; Canvas2D `onDraw*` rendering; MIT.

[14] [`litegraph.js` — npm registry](https://www.npmjs.com/package/litegraph.js). Primary-source verified: version **0.7.18**, license **MIT**, last modified **2024-01-08** — modest maintenance (GitHub LiteGraph 1.0 tag March 2024; npm package lags).

[15] [BaklavaJS — GitHub repository](https://github.com/newcat/baklavajs). `@baklavajs/interface-types` types node interfaces and allows connections only between chosen types; `@baklavajs/core` is headless-capable; `@baklavajs/renderer-vue` is the Vue renderer (React mismatch). MIT.

[16] [`baklavajs` — npm registry](https://www.npmjs.com/package/baklavajs). Primary-source verified: version **2.8.1**, license **MIT**, last modified **2025-11-02** — actively maintained; Vue-renderer caveat applies.

[17] [GoJS — License agreement (Northwoods Software)](https://gojs.net/latest/license.html). Verified proprietary/commercial: "The Software is licensed, not sold… Northwoods retains all right, title, and interest." Per-developer, non-transferable. **Fails the permissive MIT/Apache/BSD requirement.**

[18] [GoJS — Sales / pricing (Northwoods Software)](https://gojs.net/latest/download.html). Per-developer commercial license (~US$3,995/developer, per-seat); no runtime royalties.
