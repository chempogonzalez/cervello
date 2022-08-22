# Cervello
<img src="https://img.shields.io/npm/v/@cervello/react?color=blue&style=flat-square"></a>


<img src="../../assets/emoji-logo.png" style="display:block;">


> 🤯 Simplest and truly reactive state manager for React _(just 1.5kb)_

## 📖 [Documentation website](https://www.cervello.dev)


## 🚀 **Features**
- ⚛️ Truly reactive on store change **_(nested properties too!!)_**
- ✅ Super simple and minimalistic API
- 🐨 Listen properties lazily
- 👌 No unnecessary re-renders
- 🔒 Immutable changes
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
  reset,       // The function to reset the store 
} = cervello({ count: 0 })
```
<br>
<br>

------
###  `📖 Documentation`
------
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

<br>

### 🟢 `useStore`

React hook that allows you to have a reactive store which re-renders when a new value was set
```tsx
import { useStore } from './store-example'

const CounterLabel = () => {
  const { count } = useStore()

  return (<span>{ count }</span>)
}
```

<br>

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
<br>

### 🟢 `reset`

Function to reset the store to the initial value
```tsx
import { reset } from './store-example'

function LogoutButton() {

  const onLogoutClick = () => reset()

  return (<button onClick={onLogoutClick}>Logout</button>)
}
```

<br>


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
You can change a nested property of an object and it will be notified automatically as well without any problem

```jsx
import { store } from './other-example'

const AddressChanger = () => {
  return (
    <button onClick={() => { store.address.city = 'Seville' }}>
      Change city to Seville
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
