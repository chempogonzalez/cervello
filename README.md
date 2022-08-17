# Cervello
<a href="https://bundlephobia.com/package/@cervello/react@latest"><img src="https://img.shields.io/bundlephobia/minzip/@cervello/react?color=red&label=BundlePhobia%20size&style=flat-square"></a>
<a href="https://www.npmjs.com/package/@cervello/react"><img src="https://img.shields.io/npm/v/@cervello/react?color=yellow&style=flat-square"></a>

> (Beta version) - Working on SSR,persist options and documentation page




🤯 Simplest and truly reactive state manager for React


## 🚀 **Features**
- ⚛️ Truly reactive on item change
- ✅ Super simple and minimalistic API
- 🐨 Listen to attributes or items lazily
- 👌 No unnecessary re-renders
- 🔑 Typescript support

## 📦 **Install**
```bash
# NPM
npm install @cervello/react

# YARN
yarn add @cervello/react

# PNPM
pnpm add @cervello/react
```


## 💻 **Usage**
The `cervello` function allows you to create a new store in an easy way.
Just set the initial value _`(the type will be inferred based on this value)`_ and you have it

```ts
// - store-example.ts
import { cervello } from '@cervello/react'


/**
 * The cervello function returns a reactive store and 2 hooks
 * to be ready to changes inside react components
 *
 */
export const {
  store,       // The store object
  useStore,    // The hook to use the store
  useSelector, // The hook to use the selectors (part of the store)
} = cervello({ count: 0 })
```


### 🟢 `store`
The store object that you can use `inside or outside react components` to modify the store. It will automatically notify all the components listening for changes

```tsx
import { store } from './store-example'

/**
 * It can be used outside the react components
 * It will notify all the components listening for changes 
 */
const increment = () => { store.count++ }

const CounterButton = () => (
  /**
   * This makes all the components using the store (i.e.: CounterLabel)
   * to be reactive and re-renders with the new value
   */
  <button onClick={increment}>
    Increment
  </button>
)
```

### 🟢 `useStore`

React hook that allows you to have a reactive store which re-renders when a new value was set
```tsx
import { useStore } from './store-example'

const CounterLabel = () => {
  const { count } = useStore()

  return (<span>{ count }</span>)
}
```

### 🟢 `useSelector`

React hook that allows you to have a reactive store which re-renders when a new value was set on properties you specified
- _Parameters_:
  - `selectors`: an array of store properties to be watched
  - `isEqualFunction`: a custom function to compare the new value with the old one
```tsx
import { useSelector } from './store-example'

const CounterLabel = () => {
  /**
   * This will re-render just only when the property `count` changes
   */
  const { count } = useSelector(['count'])

  return (<span>{ count }</span>)
}
```
----
### 🟣 The `Use` function
The use function allows you to implement side effects due to a store change
#### 🔽 Example
```ts
import type { UseFunction } from '@cervello/react'

const logger: UseFunction<typeof store> = ({ onChange }): void => {
  onChange((store) => {
    console.log('[Store-changed] to ==>', store)
  })
}


const { store } = cervello({
  name: 'chempo',
  surname: 'gonzalez'
}).use(logger, /* ... */)
  
```

#### 🗳️ Use function - `utility functions`
```ts
import type { UseFunction } from '@cervello/react'

const logger: UseFunction<typeof store> = ({ onChange, onPartialChange }): void => {
  // Listen to all the changes happened in the store
  onChange((store) => {
    console.log('Store changed to :>>', store)
  });

  // Listen to the changes happened in the store's attributes provided
  onPartialChange(['name'], (store) => {
    console.log('Name has changed to:', store.name)
  })
}
```
------
<br>

## 💡 Features out-of-the-box
###  **`💠 Nested objects reactivity`**
You can change a nested property of an object and it will be notified automatically

```jsx
import { store } from './other-example'

const AddressChanger = () => {
  return (
    <button onClick={() => { store.address.street = 'New street' }}>
      Change street to Seville
    </button>
  )
}
```

```tsx
import { useSelector } from './other-example'

// Component listening for address object changes
const Address = () => {
  const { address } = useSelector(['address'])
  const { street, city } = address
  return (
    <div>
      <span>{ street }</span>
      <span>{ city }</span>
    </div>
  )
}
```




## 🤓 Happy Code

> Created with Typescript! ⚡ and latin music 🎺🎵

### This README.md file has been written keeping in mind

- [GitHub Markdown](https://guides.github.com/features/mastering-markdown/)
- [Emoji Cheat Sheet](https://www.webfx.com/tools/emoji-cheat-sheet/)
