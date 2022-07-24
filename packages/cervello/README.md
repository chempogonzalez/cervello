# Cervello
> (Beta version) - Working on it to be have SSR integration (hydration) and better documentation

#### `746 Bytes of bundle size for now!! `
Simplest and truly reactive state manager for React


## 🚀 **Features**
- ⚡️ Optimized and super performant
- ⚛️ Truly reactive on item change
- ✅ Super simple and minimalistic API
- 🐨 Listen to attributes or items lazily
- 👌 No unnecessary re-renders
- 🔑 Typescript support

## 📦 **Install**
```zsh
# NPM install as a dependency
npm install cervello

# YARN install as a dependency
yarn add cervello
```


## 💻 **Usage**
The `cervello` function allows you to create a new store in an easy way.
1. Define the store name
2. Set the initial value _`(the type will be inferred based on this value)`_

```ts
// - store-example.ts
import { cervello } from 'cervello'


/** Export it with the names you prefer to be used/imported */
/**
 * The cervello function returns a store with the given name and 2 hooks
 * to be reactive and change the store value
 * 
 * Object returned => { storeNameProvided, useStore, useSelect }
 */
export const {
  exampleStore,                    // The store object
  useStore: useExampleStore,  // The hook to use the store
  useSelect: useExampleSelect // The hook to use the selectors (part of the store)
} = cervello(
   'exampleStore',    /* store name */
   { count: 0 }  /* initial value */
)
```


Use it in your components. They don't need to know about each other. They can be in different pages or locations:
```tsx
import { useExampleStore } from './store-example'

const CounterLabel = () => {
  const { count } = useExampleStore()

  return (<span>{ count }</span>)
}
```


```tsx
import { exampleStore } from './store-example'

const CounterButton = () => (
  // This makes all the components using the store (i.e.: CounterLabel)
  // to be reactive and re-renders with the new value
  <button onClick={e => exampleStore.count += 1}>
    Increment
  </button>
)
```


#### 🔖 Changing the store
```ts
const CounterLabel = () => {
  /**
   * If you want to just listen for changes, then you can destructure the value but...
   *
   * IMPORTANT!: In order to change reactively any store attribute, you must use 
   *             the object returned from the `useStore` hook without destructuring
   * */
  const exampleStore = useExampleStore()

  // Destructured just to be listened if changes
  const { count } = exampleStore

  // In order to be reactive, you MUST use the object when you change a value
  const increment = () => exampleStore.count += 1

  return (
    <div>
      <span>{ count }</span>
      <button onClick={increment}> Increment </button>
    </div>
  )
}

```

## USE FUNCTION
The use function allows you to implement side effects due to a change in a the store
```ts
import type { UseFunction } from '@cervello/react'

const logger: UseFunction<'testStore', typeof testStore> = ({ $onChange }): void => {
  $onChange((store) => {
    console.log('Store changed to :>>', store)
  })
}


const { testStore } =
  cervello('testStore', { test: 'test', count: -1 })
    .use(logger, /* other use functions */)   // Adds the logger to the store
  
```

#### Use function callback object
```ts
import type { UseFunction } from '@cervello/react'

const logger: UseFunction<'testStore', typeof testStore> = ({ testStore, $onPartialChange, $onChange }): void => {
  // Listen to all the changes happened in the store
  $onChange((store) => {
    console.log('Store changed to :>>', store)
  });

  // Listen to the changes happened in the store's attributes provided
  $onPartialChange(['test', 'count'], (store) => {
    store.count += 1
  })
}
```