# Cervello

[![npm version](https://img.shields.io/npm/v/@cervello/react?color=blue&style=flat-square)](https://www.npmjs.com/package/@cervello/react)
[![bundle-size](https://img.shields.io/bundlephobia/minzip/@cervello/react/latest?color=orange&style=flat-square)](https://bundlephobia.com/package/@cervello/react@latest)

<a href="https://www.cervello.dev">
<img src="https://github.com/chempogonzalez/cervello/blob/main/assets/emoji-logo.png" style="display:block;">
</a>

> 🤯 Simple, reactive, tiny and performant state-management library for React _(just 1.5kb)_

<br>
<br>

<a href="https://www.cervello.dev">
  <p align="center">
      <strong>📖 Documentation website</strong>
  </p>
</a>

<br>

## 🚀 **Features**

- ⚛️ Reactive with store object changes **_(nested properties too 🚀!!)_**
- ✅ Simple & minimalistic API
- 🚀 Batched updates and optimized re-renders
- 🐨 Lazy listen nested properties
- 🔒 Immutable changes
- 🔑 Typescript support

## 📦 **Install**

```bash
# NPM
npm install @cervello/react

# PNPM
pnpm add @cervello/react

# YARN
yarn add @cervello/react
```

## 💻 **Quick Usage**

<!-- The `cervello` function allows you to create a new store in an easy way. -->
<!-- Just set the initial value _`(the type will be inferred based on this value)`_ and you have it! -->

It's **as simple as reassign a new value** to the store properties. <br/>It will notify all the components using `useStore` hook to re-render with the new value.

```ts
// - store-example.ts
import { cervello } from '@cervello/react'

export const {
  store,       // Object with reactive changes
  useStore,    // Hook to listen for store or partial store changes
  reset,       // Function to reset the store to initial value
} = cervello({
  fullName: 'Cervello Store',
  address: {
    city: 'Huelva',
    /* ... */
  },
})


// Change value from anywhere
store.address.city = 'Sevilla'


// Listen for changes from components
function Address() {
  const { address } = useStore()
  return (<p>City: {address.city}</p>)
}


// Just listen for changes in the `city` property
const AddressWithSelector = () => {
  const { address } = useStore({
    select: ['address.city']
  })

  return (<p>City: {address.city}</p>)
}
```

## 💡 **Good to know**

- **Batched changes**: mutations are coalesced and flushed once per microtask. `onChange`/`afterChange` receive the whole batch as an array (don't mutate it — it may be shared between subscribers).
- **No spurious updates**: assigning content-equal values (same primitive, or a plain object with the same content — key order doesn't matter) does not notify or re-render. Arrays, `nonReactive` objects and React elements always notify. A component that already rendered after a write (e.g. a handler that calls `setState` and then writes to the store) is not re-rendered again by that write.
- **Nested objects are live views**: `const { address } = useStore()` (or `const a = store.address`) keeps pointing at the store's current data even after `store.address = {...}`, `store.$value = {...}` or `reset()`, so writing through it always updates the store. If its path stops being an object (`store.address = null`), writes through the old handle are dropped.
- **`$value` is always a copy**: reading `store.$value` returns a deep clone, and `store.$value = obj` (like `cervello(obj)` and `reset()`) stores a deep clone of `obj` — mutating `obj` afterwards does not touch the store. Prefer `{ ...store.$value, x }` over `{ ...store, x }` when building a new value.
- **Hot components**: pass `select: ['path', 'nested.*']` to `useStore` so the component only re-renders for those paths; without it, it re-renders on every store change. Exact paths match their own writes; `'address.*'` also matches anything nested under `address`. When an **ancestor** is reassigned (`store.address = {...}`, `store.$value = {...}` or `reset()`), the selected slice is compared by content and the component only re-renders if it actually changed. Rule: a component must only **read** the paths it selects — a non-selected field read in render is never refreshed.
- **`afterChange` fires on every emission**: field writes, whole-store replacement (`store.$value = ...`, `reset()`) and `initialValue` seeds — content-equal writes never emit, so they never fire it either. For seeds it is deferred to a microtask (never inside a React render). A subscriber (`onChange`) that throws does not stop the other subscribers nor later updates: the error is re-thrown asynchronously.
- **StrictMode**: `initialValue` is render-phase code (double-invoked in dev — keep it idempotent) and `setValueOnMount` runs on each effect mount, per React's contract.
- **SSR**: the store is module-scoped. For per-request isolation, call `cervello()` per request and share it via context.
- **Complex values** (`Date`, `Map`, `Set`, class instances, circular refs): wrap them with `nonReactive(...)` — they are kept intact (and restored by `reset()`) but don't trigger reactivity.

<br>
<br>

---------

### To see more in depth explanations or API references and more examples:  📖 [Documentation website](https://www.cervello.dev)

--------

<br>

> Created with Typescript! ⚡ and latin music 🎺🎵
