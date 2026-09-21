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

Micro-benchmarks (must run from `packages/cervello/`, not the repo root): `pnpm bench` → `vitest bench` over `src/test/bench/*.bench.ts` (proxy hot paths, subject flush, clone/compare). Run before/after any perf-sensitive change and compare.

## Architecture

The public API is three things returned from `cervello(initialValue, options)`: `store`, `useStore`, and `reset`.

**Follow the `new-` files — the others are dead code.** `src/index.ts` re-exports from `src/lib/store/new-index.ts`, and the real Proxy lives in `src/lib/helpers/new-proxify-store.ts`. The commented-out `./lib/store` import in `index.ts` is a superseded implementation; do not edit or reference it.

Data flow: `cervello()` → deep-clones the initial value → creates a `CacheableSubject` → wraps the clone in `proxifyStore()`. Every store read/write goes through the Proxy; components subscribe to the subject via `useStore`.

### The Proxy (`new-proxify-store.ts`)
The proxied object holds the real data under a private `ROOT_VALUE` symbol; the Proxy target is just a shell. Key behaviors:
- **`store.prop = x`** — `set` trap writes through and emits a `StoreChange` with a dotted `fieldPath` (`'address.city'`, root-relative).
- **`store.$value`** (get) returns a **deep clone** — mutating it does nothing. `store.$value = obj` (set) replaces the whole store and, at root, merges preserved top-level functions (`rootFunctions`) back in.
- **`store.$$value = { id, newValue }`** — internal-only setter that emits a change while excluding subscriber `id` (used so a component setting `initialValue` doesn't re-notify itself). Merges `rootFunctions` back in, same as `$value`.
- **Lazy nested proxification**: nested objects are wrapped into child proxies on first access (get trap), not upfront — so `store.address.city = x` is reactive even if `address` started as a plain object. Child proxies are cached in an internal per-proxy `Map` as `{ proxy, raw }` entries (never written into the raw data, so clones/serializations traverse plain objects without traps); the cache is re-validated by comparing `entry.raw` against the current raw value (no trap re-entry) and cleared on `$value`/`$$value` replacement. Reference identity of a child proxy survives reassigning the field.
- **Content-equal writes do not notify**: setting the same primitive, a content-equal `$value`, or reassigning a nested object with content-equal data (through an existing child proxy) is a no-op — no write, no notification. Equality is structural (`contentComparer` → `deepEqualJson`): early-exit co-traversal with JSON semantics (`undefined`/function-valued keys skipped, complex leaves opaque, cycles only equal if both sides cycle) except that key order is irrelevant and `NaN === NaN`. React/DOM nodes compare through their `safeToJson` projection.
- **Emitted `fieldPath`s** use a per-proxy precomputed prefix (root-relative). Known limitation: a top-level field literally named `root` emits `'root'`, colliding with the whole-store sentinel used by `select`.
- **Function reads are bound and cached**: the get trap binds function values to the proxy (so `this.prop` inside store functions stays reactive) and caches the binding in a per-proxy `WeakMap` keyed by the raw function — repeated reads return the same reference; reassigning the property re-binds.
- **`nonReactive(obj)`** stamps `nonReactiveObjectSymbol`; `isValidReactiveObject` then returns false so the object is never wrapped. React elements / React fiber-like nodes are also excluded from proxification and from cloning.
- **Usage conditions (by design, do not "fix")**: complex objects (`Date`, `Map`, `Set`, class instances) are not supported as reactive values — `deepClone` flattens them. Circular references are invalid store values; `deepClone`/`safeToJson` cut cycles to `null` (WeakSet ancestor tracking) instead of overflowing the stack. **The supported escape hatch is `nonReactive()`**: any complex or circular object MUST work wrapped in it (e.g. `nonReactive({ value: new Date() })`). `deepClone` clones nonReactive subtrees **structurally** (`cloneNonReactive`): `Date`/`Map`/`Set` and internal cycles/aliases are preserved; functions, React nodes, DOM elements and other class instances stay by reference; the nonReactive mark survives the clone. So the store works on a decoupled copy, the caller's object stays pristine, and **`reset()` restores nonReactive content to its `cervello()` initial state like everything else**. `safeToJson` still traverses them (cycle-guarded) so `JSON.stringify(store)` keeps working.

### Batching (`utils/subject.ts`)
`createCacheableSubject` collects `next()` values in a list and flushes them **once per microtask** via `queueMicrotask`, delivering each subscriber an array of the changes it didn't originate. This coalesces multiple synchronous mutations into a single re-render. **Consequence for tests:** changes are async — tests `await sleep(...)` (a local helper) before asserting; there is no synchronous flush. Flush details: when no queued change carries a `subscriberId` (the common case), all observers receive **the same array instance** — callbacks must not mutate it; the observer list is snapshotted before delivery, so an observer unsubscribed synchronously mid-flush still receives that batch. The subject also exposes `version()` — a monotonic counter bumped per `next()` at write time — used by `useStore` to recover changes flushed before its subscription existed.

### `useStore` (`new-index.ts`)
Subscribes to the subject and forces re-render via a counter. Options:
- **`select`**: `Array<FieldPath<T>>` or `() => Array<FieldPath<T>>` — re-render only when a listed path changes. `'address.*'` wildcards match `address` itself and any nested path under it. Exact/wildcard-descendant matches are path-level (the set trap already guaranteed a content change). **Ancestor changes are value-refined**: when a change arrives at an ancestor of a selected path — including `'root'` from `$value`/`reset()` — the selected slice (wildcards use their base) is extracted from the change's `previousValue`/`newValue` via `getValueAtPath` and compared with `contentComparer`; the component only re-renders if it differs. The comparison happens at flush time against the live raw, so several same-microtask writes are seen in their final converged state. Recommend `select` for hot components: without it, every subscribed component re-renders on every change.
- **`initialValue(currentStore)`**: seed a per-mount value via the internal `$$value` setter (no self-notify). It is render-phase code: StrictMode double-invokes it (keep it idempotent — the comparer makes an identical reseed a no-op).
- **`setValueOnMount(currentStore): Promise<T>`**: async one-time mount effect; errors handled via `.catch`. Runs on each effect mount (twice under StrictMode, by React's contract — no ref guard, deliberately); a resolution after unmount still writes to the (global) store.
- **`onChange(changes)`**: fires alongside re-render on relevant changes. When the `select` filter matches, it receives the **whole batch**, including non-selected changes coalesced into the same microtask; it does not fire for batches with no matching change, nor for gap-recovered changes (below).
- `afterChange` (on `cervello()` options) is the only store-level lifecycle hook. It fires synchronously at write time for **every** subject emission: field writes, root `$value` replacement (so `reset()` too) and `$$value` seeds. Content-equal writes never emit, so they never fire it.

Missed-update recovery: subscription happens in a passive effect, and when a commit exceeds the scheduler frame budget React yields before running passive effects — the microtask flush lands in that gap, before the subscription exists. `useStore` captures `store$$.version()` on every render (after the `initialValue` seed, so a component's own seed doesn't self-trigger) and, on subscribing, forces one re-render if the version moved. Covered by `src/test/lifecycle.test.tsx`, which runs **without `act()`** (act flushes passive effects before microtasks — the opposite of production ordering — so act-wrapped tests can't catch this class of bug).

Accepted/known behaviors (documented, do not "fix"): under time-sliced renders a write can land between yielded siblings — transient, converges at the next flush (a per-render snapshot would cost a deep clone per render); on SSR, `initialValue` runs during server render and mutates the module-scoped global store — per-request isolation requires calling `cervello()` per request.

### Types (`types/shared.ts`)
`FieldPath<T>` recursively derives the valid dotted path literals (with `.*` wildcards) for `select`, excluding function-valued and array-element paths. `StoreChange<T>` carries `{ change: { fieldPath, newValue, previousValue }, storeValue }`.

## Build & release
- Built with **microbundle** (not vite/rollup), formats `esm,cjs` only → `dist/cervello.{esm.js,cjs}` (+ sourcemaps) and `types/index.d.ts`. Only `dist/` and `types/` are published; source is not.
- Run `pnpm build` after changes to regenerate type declarations.
- Peer dep: `react >= 18.2.0`.
