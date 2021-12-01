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
The `cervello` function let's you initialize it with a *string, number, object or array (Map is currently in develop)*. It provides you the following processed array:
```ts
[
  /** - First Item:
   *    Reactive value to be used to set items (reactively)
   *    producing updates in components listening values
   *    from the hook
   * 
   *    (Mainly to be used outside react components)
   */
  reactiveValue,

  /** - Second Item:
   *    React hook.
   *    It returns the reactiveValue and makes a re-render only if
   *    it has changed to keep it synchronized
   */
  useCervello
]
```
> **IMPORTANT:** You can **only destructure** when you are getting an attribute/item. If you need to **set a new value it must be done without destructuring** to ensure reactivity

### 🤓 Examples
#### ☀️ Global store
```ts
// - store.ts
import { cervello } from 'cervello'


/** Export it with the names you prefer to be used/imported */
export const [store, useStore] = cervello(
  {
    count: 0,
    //...more attributes
  })
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


#### 🔖 Local store/state
```tsx
import { cervello } from 'cervello'

/** escape first item result because we only need the hook */
const [, useCityList] = cervello(['Seville', 'Huelva'])

const Example = () => {
  const cityList = useCityList()

  return (
    <ul>
      {cityList.map((city) => (
        <li>{city}</li>
      ))}
    </ul>

    <button onClick={e => cityList.push('Cadiz')}>
      Add Cadiz
    </button>
  )
}
```

#### 📝 String or number state
As string and number couldn't be proxified in a simpler manner they need to be used with **".value"** attribute (similarly as "useRef with *.current*)"

```tsx
import { cervello } from 'cervello'

const [, useHelloString] = cervello('Hello')

const HelloWorld = () => {
  const helloString = useHelloString()

  return (
    <p>{helloString.value}</p>
    <button onClick={e => helloString.value += ' World'}>
      Add "world"
    </button>
  )
}

```