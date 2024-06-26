# Cervello

[![npm version](https://img.shields.io/npm/v/@cervello/react?color=blue&style=flat-square)](https://www.npmjs.com/package/@cervello/react)
[![bundle-size](https://img.shields.io/bundlephobia/minzip/@cervello/react/latest?color=orange&style=flat-square)](https://bundlephobia.com/package/@cervello/react@latest)

<a href="https://www.cervello.dev">
<img src="https://github.com/chempogonzalez/cervello/blob/main/assets/emoji-logo.png" style="display:block;">
</a>

> 🤯 Simplest and truly reactive state manager for React _(just 1.5kb)_

<br>
<br>

<a href="https://www.cervello.dev">
  <p align="center">
      <strong>📖 Documentation website</strong>
  </p>
</a>

<br>

## 🚀 **Features**

- ⚛️ Truly reactive on store change like normal objects without functions **_(nested properties too 🚀!!)_**
- ✅ Super simple and minimalistic API
- 🐨 Listen properties lazily
- 👌 No unnecessary re-renders
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

The `cervello` function allows you to create a new store in an easy way.
Just set the initial value _`(the type will be inferred based on this value)`_ and you have it!

```ts
// - store-example.ts
import { cervello } from '@cervello/react'

export const {
  store,       // Reactive store object
  useStore,    // Hook to listen for store changes
  useSelector, // Hook to listen for changes on parts of the store
  reset,       // Function to reset the store to initial value
} = cervello({
  count: 0,
  isModalOpen: false,
  /* ... */
})


// With the store object you can use it outside of React components
const increment = () => { store.count++ }


const Button = () => {
  const { count } = useStore() // Listen for changes on the whole store
  return (
    <button onClick={increment}>
      {count}
    </button>
  )
}

const ButtonWithSelector = () => {
  const { count } = useSelector(['count']) // Listen for changes just on 'count' property
  return (
    <button onClick={increment}>
      {count}
    </button>
  )
}
```

<br>
<br>

---------

### To see more in depth explanations or API references and more examples:  📖 [Documentation website](https://www.cervello.dev)

--------

<br>

> Created with Typescript! ⚡ and latin music 🎺🎵
