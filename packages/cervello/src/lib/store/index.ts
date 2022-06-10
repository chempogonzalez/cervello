import { BehaviorSubject } from 'rxjs'

import { createUseSelect, createUseStore, proxifyStore } from '../helpers'



type ObjectFromAttributes<T, Attributes extends Array<keyof T>> = {
  [k in Attributes[number]]: T[k]
}



const STORE_SYMBOL = '__cervello-store__'

type CervelloStore<StoreName extends string, StoreType> = {
  [k in StoreName]: StoreType
} & {
  useStore: () => StoreType
  useSelect: <Attributes extends Array<keyof StoreType>>(...selectors: Attributes) => ObjectFromAttributes<StoreType, Attributes>
}




export function cervello <StoreName extends string, T> (storeName: StoreName, initialValue: T): CervelloStore<StoreName, T> {
  const store$$ = new BehaviorSubject<T>(initialValue)

  const storeSymbol = Symbol(STORE_SYMBOL)

  const proxifiedStore = proxifyStore(store$$, {
    [storeSymbol]: store$$,
    ...initialValue,
  })

  const cervelloStore = {
    [storeName]: proxifiedStore,
    useStore: createUseStore<T>(store$$),
    useSelect: createUseSelect<T>(store$$),
  }

  return cervelloStore as CervelloStore<StoreName, T>
}
