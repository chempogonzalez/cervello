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

<br>
<br>

---------

### To see more in depth explanations or API references and more examples:  📖 [Documentation website](https://www.cervello.dev)

--------

<br>

> Created with Typescript! ⚡ and latin music 🎺🎵
