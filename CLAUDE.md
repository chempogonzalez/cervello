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
Each proxy keeps the object it wraps in a closure variable (`raw`; the root's is the whole store); the Proxy target is just an empty shell. Key behaviors:
- **`store.prop = x`** — `set` trap writes through and emits a `StoreChange` with a dotted `fieldPath` (`'address.city'`, root-relative).
- **`store.$value`** (get) returns a **deep clone** — mutating it does nothing. `store.$value = obj` (set) replaces the whole store with a **deep clone** of `obj` (no aliasing with the caller's object; proxies spread into it via `{ ...store }` are unwrapped) and, at root, merges preserved top-level functions (`rootFunctions`) back in. `reset()` therefore passes `initialValue` straight through (the setter clones).
- **`store.$$value = { id, newValue }`** — internal-only setter that emits a change while excluding subscriber `id` (used so a component setting `initialValue` doesn't re-notify itself). Clones and merges `rootFunctions` back in, same as `$value`. Its `afterChange` call is deferred with `queueMicrotask` (seeds are render-phase writes; user hooks must never run inside a React render).
- **Lazy nested proxification, live views**: nested objects are wrapped into child proxies on first access (get trap), not upfront — so `store.address.city = x` is reactive even if `address` started as a plain object. A child proxy is a **live view of `parent[key]`**: it keeps its last known `raw` and re-resolves it through the parent chain (`revalidate()`: `opts.parent()` → `parent[key]`) whenever the store version moved since it last looked. The check is inlined in the get trap as a plain property compare (`store$$.state.version !== seenVersion`, no call — measured: the hot path is within noise of the pre-6.0 numbers, ~6.9M vs 7.1M deep reads/s); unchanged version = no walk. Hence a captured handle (`const { address } = useStore()`) keeps reading/writing the live data after the field, an ancestor or the whole store (`$value`/`reset()`/seed) is reassigned. If its slot stops being a valid reactive object (null, primitive, array, `nonReactive`, element) the proxy is **detached**: reads return its last raw, writes are **dropped** (no emission); it reconnects when the slot holds an object again. Child proxies are cached per proxy in a `Map` of `{ proxy, raw }` entries (never written into the raw data; `raw` is only a read fast-path key) and entries are never dropped, so **child identity survives reassigning the field and replacing the whole store**. `revalidate()` stores `seenVersion` before walking, which doubles as the re-entrancy guard (self/mutually injected proxies resolve back into it and get the current raw).
- **Injected proxies are healed**: a proxy of this store found inside the raw data (`store.a = { ...store.a }` spreads child proxies; `store.a = { inner: store.b }`) is replaced by the raw it wraps on first access (parent get trap or the child's own resolve), so the raw stays Proxy-free and writes emit at the **read path**. Top-level assignments unwrap `RAW_VALUE` eagerly in the set trap.
- **Content-equal writes do not notify**: setting the same primitive, a content-equal `$value`, or a plain object with content-equal data — **unconditionally**, whether or not the field was ever read — is a no-op: no write, no notification. Arrays, `nonReactive` objects and React elements always notify (their content can hide reference-only differences). Equality is structural (`contentComparer` → `deepEqualJson`): early-exit co-traversal with JSON semantics (`undefined`/function-valued keys skipped, complex leaves opaque, cycles only equal if both sides cycle) except that key order is irrelevant and `NaN === NaN`. React/DOM nodes compare through their `safeToJson` projection. Consequence: an object whose only difference is a function-valued key is "equal" and its write is skipped.
- **Emitted `fieldPath`s** use a per-proxy precomputed prefix (root-relative). Known limitation: a top-level field literally named `root` emits `'root'`, the same string as the whole-store sentinel; `select: ['root']` then also re-renders on whole-store changes (over-render, safe — the exact-path check runs before the ancestor refinement).
- **Function reads are bound and cached**: the get trap binds function values to the proxy (so `this.prop` inside store functions stays reactive) and caches the binding in a per-proxy `WeakMap` keyed by the raw function — repeated reads return the same reference; reassigning the property re-binds.
- **`nonReactive(obj)`** stamps `nonReactiveObjectSymbol`; `isValidReactiveObject` then returns false so the object is never wrapped. React elements / React fiber-like nodes are also excluded from proxification and from cloning.
- **Usage conditions (by design, do not "fix")**: complex objects (`Date`, `Map`, `Set`, class instances) are not supported as reactive values — `deepClone` flattens them. Circular references are invalid store values; `deepClone`/`safeToJson` cut cycles to `null` (WeakSet ancestor tracking) instead of overflowing the stack. **The supported escape hatch is `nonReactive()`**: any complex or circular object MUST work wrapped in it (e.g. `nonReactive({ value: new Date() })`). `deepClone` clones nonReactive subtrees **structurally** (`cloneNonReactive`): `Date`/`Map`/`Set` and internal cycles/aliases are preserved; functions, React nodes, DOM elements and other class instances stay by reference; the nonReactive mark survives the clone. So the store works on a decoupled copy, the caller's object stays pristine, and **`reset()` restores nonReactive content to its `cervello()` initial state like everything else**. `safeToJson` still traverses them (cycle-guarded) so `JSON.stringify(store)` keeps working.

### Batching (`utils/subject.ts`)
`createCacheableSubject` collects `next()` values in a list and flushes them **once per microtask** via `queueMicrotask`, delivering each subscriber an array of the changes it didn't originate. This coalesces multiple synchronous mutations into a single re-render. **Consequence for tests:** changes are async — tests `await sleep(...)` (a local helper) before asserting; there is no synchronous flush. Flush details: when no queued change carries a `subscriberId` (the common case), all observers receive **the same array instance** — callbacks must not mutate it; the observer list is snapshotted before delivery, so an observer unsubscribed synchronously mid-flush still receives that batch. Each observer is called through `deliver()`: an observer that throws is isolated (the error is re-thrown from its own microtask so it still reaches `window.onerror`) and the remaining observers and later flushes are unaffected — `isFlushing` can never get stuck. The subject also exposes `version()` — a monotonic counter bumped per `next()` at write time — used by `useStore` to recover changes flushed before its subscription existed, and the same counter as a plain field (`state.version`) for the proxy hot path.

### `useStore` (`new-index.ts`)
Subscribes to the subject and forces re-render via a counter. Options:
- **`select`**: `Array<FieldPath<T>>` or `() => Array<FieldPath<T>>` — re-render only when a listed path changes. `'address.*'` wildcards match `address` itself and any nested path under it. Exact/wildcard-descendant matches are path-level (the set trap already guaranteed a content change). **Ancestor changes are value-refined**: when a change arrives at an ancestor of a selected path — including `'root'` from `$value`/`reset()` — the selected slice (wildcards use their base) is extracted from the change's `previousValue`/`newValue` via `getValueAtPath` and compared with `contentComparer`; the component only re-renders if it differs. The comparison happens at flush time against the live raw, so several same-microtask writes are seen in their final converged state. Recommend `select` for hot components: without it, every subscribed component re-renders on every change.
- **`initialValue(currentStore)`**: seed a per-mount value via the internal `$$value` setter (no self-notify). It is render-phase code: StrictMode double-invokes it (keep it idempotent — the comparer makes an identical reseed a no-op).
- **`setValueOnMount(currentStore): Promise<T>`**: async one-time mount effect; errors handled via `.catch`. Runs on each effect mount (twice under StrictMode, by React's contract — no ref guard, deliberately); a resolution after unmount still writes to the (global) store.
- **`onChange(changes)`**: fires alongside re-render on relevant changes. When the `select` filter matches, it receives the **whole batch**, including non-selected changes coalesced into the same microtask; it does not fire for batches with no matching change, nor for gap-recovered changes (below).
- `afterChange` (on `cervello()` options) is the only store-level lifecycle hook. It fires synchronously at write time for **every** subject emission: field writes, root `$value` replacement (so `reset()` too) and `$$value` seeds. Content-equal writes never emit, so they never fire it.

Missed-update recovery: subscription happens in a passive effect, and when a commit exceeds the scheduler frame budget React yields before running passive effects — the microtask flush lands in that gap, before the subscription exists. `useStore` captures `store$$.version()` on every render (after the `initialValue` seed, so a component's own seed doesn't self-trigger) and, on subscribing, forces one re-render if the version moved.

Render dedupe (the inverse check): at flush time the observer compares `store$$.version()` with the version seen at the component's last render and **skips `reRender()` when they match** — the component already rendered after every write flushed so far (typical case: a handler calls `setState` then writes to the store; React renders the SyncLane update in its own microtask before the subject flush, and that render read the store live). `onChange` still fires. Same idea as `checkIfSnapshotChanged` in `useSyncExternalStore`. Sound because React never discards a render without re-attempting its lanes.

React scheduling facts (verified against React 18.2 sources, do not re-investigate): a store write inside a discrete event handler makes the flush's `setState` land on **SyncLane** (`window.event` is still set during the microtask checkpoint → `getCurrentEventPriority()` → Discrete), so the re-render commits before paint; writes from async callbacks land on **DefaultLane** (Scheduler task, batched with any other pending setState). `startTransition` around a store write has no effect (the update is created in a later microtask, outside the scope). Covered by `src/test/lifecycle.test.tsx`, which runs **without `act()`** (act flushes passive effects before microtasks — the opposite of production ordering — so act-wrapped tests can't catch this class of bug).

Accepted/known behaviors (documented, do not "fix"): under time-sliced renders a write can land between yielded siblings — transient, converges at the next flush (a per-render snapshot would cost a deep clone per render); on SSR, `initialValue` runs during server render and mutates the module-scoped global store — per-request isolation requires calling `cervello()` per request.

### Types (`types/shared.ts`)
`FieldPath<T>` recursively derives the valid dotted path literals (with `.*` wildcards) for `select`, excluding function-valued and array-element paths. `StoreChange<T>` carries `{ change: { fieldPath, newValue, previousValue }, storeValue }`.

## Build & release
- Built with **microbundle** (not vite/rollup), formats `esm,cjs` only → `dist/cervello.{esm.js,cjs}` (+ sourcemaps) and `types/index.d.ts`. Only `dist/` and `types/` are published; source is not.
- Run `pnpm build` after changes to regenerate type declarations.
- Peer dep: `react >= 18.2.0`.
