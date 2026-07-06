# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Scope

This is a pnpm monorepo, but **only `packages/cervello/` (published as `@cervello/react`) matters.** It is the sole published package and the single source of truth. Other workspace directories (`apps/docs`, root `src/`, root `test/`) are not part of the shipped library and should generally be ignored. A more detailed development guide lives in `AGENTS.md`.

## Commands

Run from the repo root (root scripts delegate to the package via `pnpm --filter`):

```bash
pnpm build      # Build @cervello/react — cleans dist/ + types/, runs microbundle
pnpm dev        # microbundle watch — rebuild on change
pnpm test       # vitest run (CI-friendly, non-watch) on the package
pnpm lint       # ESLint, ts-standard-next rules
pnpm lint-fix   # eslint --fix
```

Inside `packages/cervello/`:

```bash
pnpm test           # vitest --watch (interactive)
pnpm test:release   # vitest run (one-shot)
```

Run a single test file / test:

```bash
cd packages/cervello
pnpm vitest run src/test/lib/proxify-store.test.ts
pnpm vitest run -t "resets to the original initial value"
```

Tests: `vitest` + `vitest-react` + `jsdom` + `@testing-library/react`. `describe`/`it`/`expect`/`test` are globals (`globals: true`).

## Architecture

The public API is three things returned from `cervello(initialValue, options)`: `store`, `useStore`, and `reset`.

**Follow the `new-` files — the others are dead code.** `src/index.ts` re-exports from `src/lib/store/new-index.ts`, and the real Proxy lives in `src/lib/helpers/new-proxify-store.ts`. The commented-out `./lib/store` import in `index.ts` is a superseded implementation; do not edit or reference it.

Data flow: `cervello()` → deep-clones the initial value → creates a `CacheableSubject` → wraps the clone in `proxifyStore()`. Every store read/write goes through the Proxy; components subscribe to the subject via `useStore`.

### The Proxy (`new-proxify-store.ts`)
The proxied object holds the real data under a private `ROOT_VALUE` symbol; the Proxy target is just a shell. Key behaviors:
- **`store.prop = x`** — `set` trap writes through and emits a `StoreChange` with a dotted `fieldPath` (`'address.city'`, root-relative).
- **`store.$value`** (get) returns a **deep clone** — mutating it does nothing. `store.$value = obj` (set) replaces the whole store and, at root, merges preserved top-level functions (`rootFunctions`) back in.
- **`store.$$value = { id, newValue }`** — internal-only setter that emits a change while excluding subscriber `id` (used so a component setting `initialValue` doesn't re-notify itself). Merges `rootFunctions` back in, same as `$value`.
- **Lazy nested proxification**: nested objects are wrapped into child proxies on first access (get trap), not upfront — so `store.address.city = x` is reactive even if `address` started as a plain object. Child proxies are cached in an internal per-proxy `Map` (never written into the raw data, so clones/serializations traverse plain objects without traps); the cache is re-validated against the current raw value via the internal `RAW_VALUE` symbol and cleared on `$value`/`$$value` replacement. Reference identity of a child proxy survives reassigning the field.
- **`nonReactive(obj)`** stamps `nonReactiveObjectSymbol`; `isValidReactiveObject` then returns false so the object is never wrapped. React elements / React fiber-like nodes are also excluded from proxification and from cloning.
- **Usage conditions (by design, do not "fix")**: complex objects (`Date`, `Map`, `Set`, class instances) are not supported as reactive values — `deepClone` flattens them. Circular references are invalid store values; `deepClone`/`safeToJson` cut cycles to `null` (WeakSet ancestor tracking) instead of overflowing the stack. **The supported escape hatch is `nonReactive()`**: any complex or circular object MUST work wrapped in it (e.g. `nonReactive({ value: new Date() })`). `deepClone` clones nonReactive subtrees **structurally** (`cloneNonReactive`): `Date`/`Map`/`Set` and internal cycles/aliases are preserved; functions, React nodes, DOM elements and other class instances stay by reference; the nonReactive mark survives the clone. So the store works on a decoupled copy, the caller's object stays pristine, and **`reset()` restores nonReactive content to its `cervello()` initial state like everything else**. `safeToJson` still traverses them (cycle-guarded) so `JSON.stringify(store)` keeps working.

### Batching (`utils/subject.ts`)
`createCacheableSubject` collects `next()` values in a list and flushes them **once per microtask** via `queueMicrotask`, delivering each subscriber an array of the changes it didn't originate. This coalesces multiple synchronous mutations into a single re-render. **Consequence for tests:** changes are async — tests `await sleep(...)` (a local helper) before asserting; there is no synchronous flush.

### `useStore` (`new-index.ts`)
Subscribes to the subject and forces re-render via a counter. Options:
- **`select`**: `Array<FieldPath<T>>` or `() => Array<FieldPath<T>>` — re-render only when a listed path (or `'root'`) changes. `'address.*'` wildcards match any nested path under `address`.
- **`initialValue(currentStore)`**: seed a per-mount value via the internal `$$value` setter (no self-notify).
- **`setValueOnMount(currentStore): Promise<T>`**: async one-time mount effect; errors handled via `.catch`.
- **`onChange(changes)`**: fires alongside re-render on relevant changes.
- `afterChange` (on `cervello()` options) is the only store-level lifecycle hook.

### Types (`types/shared.ts`)
`FieldPath<T>` recursively derives the valid dotted path literals (with `.*` wildcards) for `select`, excluding function-valued and array-element paths. `StoreChange<T>` carries `{ change: { fieldPath, newValue, previousValue }, storeValue }`.

## Build & release
- Built with **microbundle** (not vite/rollup) → `dist/cervello.{esm.js,cjs,umd.js}` (+ sourcemaps) and `types/index.d.ts`. Only `dist/` and `types/` are published; source is not.
- Run `pnpm build` after changes to regenerate type declarations.
- Peer dep: `react >= 18.2.0`.
