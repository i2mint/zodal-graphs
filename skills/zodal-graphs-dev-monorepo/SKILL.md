---
name: zodal-graphs-dev-monorepo
description: Use when working on the zodal-graphs MONOREPO structure or its npm PUBLISH pipeline — adding a new package, wiring package.json/tsup/tsconfig/exports, pnpm-workspace + turbo config, peer-dependency ranges on @zodal/*, the .github/workflows/ci.yml validate+publish jobs, the [publish]/[force publish] commit-message release trigger, manual version bumping, or required CI secrets. Triggers on "add a package", "set up the build", "how do we publish", "release to npm", "wire CI", or any scaffolding/release task. Read BEFORE creating a package or touching CI — the publish flow is commit-message-gated and must be modeled exactly on zodal.
metadata:
  audience: developers
---

# zodal-graphs · monorepo & publish

zodal-graphs is **one monorepo of many lightweight, tree-shakeable packages**, published
as **separate npm packages under the `@zodal` org** so consumers import only what they use.
The build/publish mechanism is modeled **exactly** on the `zodal` monorepo. Do not invent a
different release flow.

> **Hard rule from the project owner:** never `npm publish` from your machine. Publishing is
> CI-driven and gated on the owner's explicit approval for the first publish. Your job is to
> get the pipeline correct and commit; a human triggers the release.

## Repo layout

```
zodal-graphs/
  package.json              # private:true, scripts delegate to turbo, packageManager pnpm@9.x
  pnpm-workspace.yaml       # packages: [ 'packages/*' ]
  turbo.json                # build dependsOn ['^build'] outputs ['dist/**']; test/typecheck dependsOn build
  tsconfig.base.json        # ES2022, ESNext, moduleResolution bundler, strict, declaration+maps, isolatedModules, verbatimModuleSyntax
  .github/workflows/ci.yml  # validate + publish jobs (see below)
  packages/
    <pkg>/                  # one publishable @zodal/graph-* package each
      package.json
      tsup.config.ts
      tsconfig.json         # extends ../../tsconfig.base.json; sets outDir/rootDir/include
      vitest.config.ts
      src/index.ts          # barrel: value export + `export type` per module
      tests/
```

Cross-package deps inside the monorepo use `"@zodal/graph-core": "workspace:*"` (pnpm
rewrites to the published version at `pnpm publish` time). A package's dependency on the
*external* zodal core (`@zodal/core`, `@zodal/ui`, `@zodal/store`) is a **peer dependency**
with a semver range, plus a dev dependency for local builds — exactly like the satellite
packages (`zodal-ui-shadcn`, `zodal-store-fs`).

## Per-package `package.json` template

```jsonc
{
  "name": "@zodal/graph-core",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" } },
  "files": ["dist"],
  "publishConfig": { "access": "public" },
  "scripts": { "build": "tsup", "prepublishOnly": "pnpm build", "test": "vitest run", "typecheck": "tsc --noEmit" },
  "peerDependencies": { "zod": ">=4.1.13" }
}
```

- The **`exports` map must mirror tsup output.** Multi-entry packages (e.g. a `./node`
  subpath for Node-only file I/O) add the entry to `tsup.config.ts` AND a subpath here.
- Keep Node-only code (`fs`) behind a separate `./node` entry with dynamic
  `await import('node:fs/promises')` — never a top-level import in the main entry, or
  browser bundles break.

`tsup.config.ts` (uniform): `defineConfig({ entry: ['src/index.ts'], format: ['cjs','esm'], dts: true, clean: true, sourcemap: true })`.

## The publish pipeline (`.github/workflows/ci.yml`)

Single workflow, **two jobs**, identical shape to zodal:

- **`validate`** (every push/PR to `main`, unless commit msg has `[skip ci]`):
  checkout → `pnpm/action-setup@v5` → `setup-node@v6` (node 22, pnpm cache) →
  `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm build` → `pnpm test`.
- **`publish`** (`needs: validate`; runs only when **all** of: push, `ref == refs/heads/main`,
  and commit message contains `[publish]` or `[force publish]`; `permissions: contents: write`):
  checkout (fetch-depth 0) → setup-node with `registry-url: https://registry.npmjs.org` →
  install → build →
  **publish step** (`env NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`):
  `pnpm -r publish --access public $FORCE || true`
  (recursive across all workspace packages; pnpm skips versions already on npm; `|| true`
  swallows already-published errors; `FORCE=--no-git-checks` only when `[force publish]`) →
  configure SSH from `secrets.SSH_PRIVATE_KEY` → tag `v${core version}` and push the tag.

**Required secrets:** `NPM_TOKEN` (npm automation token with `@zodal` publish rights) and
`SSH_PRIVATE_KEY` (deploy key with push access for the tag). `GITHUB_TOKEN` is default.

## Versioning & releasing

- **No changesets, no semantic-release, no Lerna.** Versions are bumped **by hand** in each
  package's `package.json`.
- To cut a release: bump the relevant `version`(s), commit with **`[publish]`** in the
  message, push to `main`. CI validates then publishes. Use **`[force publish]`** only to
  bypass git checks. Use `[skip ci]` to skip validation on a no-op commit.
- A normal commit (no marker) just runs `validate` — safe to push freely.

## Conventions (from zodal)

- Factory functions, never classes. Headless: emit plain config objects, never DOM.
- Every module opens with a top-level docstring (auto-extracted for docs).
- ESM `.js` extensions on all internal imports; `import type` for type-only.
- Tests co-located per package in `tests/*.test.ts`; heavy/manual tests excluded from CI.

## Files routed into this skill (model on these)

- `zodal/.github/workflows/ci.yml` — the validate+publish workflow to clone.
- `zodal/package.json`, `zodal/pnpm-workspace.yaml`, `zodal/turbo.json`, `zodal/tsconfig.base.json` — root config.
- `zodal/packages/core/package.json`, `…/tsup.config.ts`, `…/tsconfig.json` — per-package template.
- `zodal-store-fs/` (whole repo) — the independent-package shape (peer deps, own ci.yml, contract tests) if a satellite is ever split out.

## Maintenance

If the publish flow changes (e.g. the owner later adopts changesets), update this skill and
`docs/dev-plan.md` together. Keep the workflow snippet here matched to the actual
`ci.yml` on disk.
