---
name: zodal-graphs-dev-research-lookup
description: Use when you need to find WHICH zodal-graphs research document answers a question, or what tool/library was already chosen for a fleet role — before reading or re-litigating a decision. Triggers on "what did we pick for X", "which research doc covers Y", "why did we choose Z", "is this decided", or any task that needs the design rationale behind the canonical model, typed-port editor, traversal/provenance overlay, large-sparse renderer, table/matrix/form surfaces, or execution/stepper/timeline. Points to the routing guide and the consolidated decision table so you open the one right doc instead of all of them.
metadata:
  audience: developers
---

# zodal-graphs · research lookup

The design corpus is large (~340 KB across 12 reports + 3 consolidation docs + 3 intent
docs). **Don't read it all.** This skill routes you to the one right document.

## Two entry points (use these first)

1. **[`docs/research_guide.md`](../../docs/research_guide.md)** — the full routing index:
   `doc → what it settles → read it when`, plus a **task → doc quick lookup** table and the
   list of decisions still open. **This is your map.**
2. **[`docs/research/README.md`](../../docs/research/README.md)** — the **money summary**:
   the consolidated decision table (one chosen tool per fleet role, primary + fallback +
   license). Answers "what did we pick for X?" in one glance.

## The 30-second crosswalk

Six regimes, each a research prompt (P1–P6):

| Regime | Decision (primary) | Deep doc |
|---|---|---|
| P1 typed-port editor | React Flow (`@xyflow/react`, MIT) | `zgraph_01b` |
| P2 traversal + provenance overlay | graphology + graphology-* (MIT); networkx server tier | `zgraph_02b` |
| P3 large-sparse / GPU viz | `@cosmos.gl/graph` (MIT) / sigma / Cytoscape / deck.gl | `zgraph_03a` |
| P4 facade + canonical model **(keystone)** | `nodes_and_links` superset hub + typed `ports[]` | `zgraph_04b` (+ `04a`) |
| P5 table / matrix / form | TanStack Table + thin heat-cell matrix; RHF+zodResolver+shadcn forms | `zgraph_05b` (+ `05a`) |
| P6 execution / stepper / provenance / timeline | React Flow value-watch · XState stepper · bespoke visx timeline | `zgraph_06b` (+ `06a`) |

## The rules of the corpus

- **Decisions live in `research/README.md` + `_reconciliation.md`** — those supersede any
  single report. If two reports disagree, the reconciliation is the answer.
- **`b` reports are grounded** (pinned to zodal/meshed/linked/lacing); **`a` reports are
  surveys** (broad external landscape). `b` wins on integration; `a` is mined for external
  facts.
- **Substrate facts** (how to stay compatible with the Python backends meshed/linked/lacing)
  live in `research/_grounding-brief.md`.
- **Affordance scoping/naming** → `docs/graph-affordances-analysis.md` (§1 catalog + §2 matrix).

## Don't re-litigate settled picks

If the decision table names a tool, it's decided — build on it. The only genuinely open
choices are listed under **"Decisions still open"** in `docs/research_guide.md` (executor
boundary, matrix surface, `portTypeCompatible` depth). Everything else: proceed.

## Maintenance

This skill is a thin pointer — it should rarely change. If the *set* of research docs
changes, update the crosswalk table here and the index in `docs/research_guide.md` together.
