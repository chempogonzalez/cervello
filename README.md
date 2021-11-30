# Cervello
Simplest and trully reactive state manager for React


## 🚀 **Features**
- ⚡️ Optimized and super performant
- ⚛️ Trully reactive on item change
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
The `cervello` function let's you initialize it a *string, number, object or array*. It provides you the following processed object:
```ts
[
  /** First Item:
   * Reactive value to be used to get or set items
   */
  reactiveValue,

  /** Second Item:
   * React hook to has a synchronized reactive value
   */
  useCervello
]
```

### Example (simple global store)
```ts
// - store.ts
import { cervello } from 'cervello'

const computedResult = cervello(
  {
    count: 0,
    //...more attributes
  })

/** Export it with the names you prefer to be used/imported */
export const [store, useStore] = computedResult
```



Use it in your components. They don't need to know about each other. They can be in different pages or locations:
```tsx
import { useStore } from './store'

const CounterLabel = () => {
  const { count } = useStore()

  return (<span>{ count }</span>)
} 
```


```tsx
import { store } from './store'

const CounterButton = () => (
  <button onClick={e => store.count += 1}>
    Increment
  </button>
)
```
