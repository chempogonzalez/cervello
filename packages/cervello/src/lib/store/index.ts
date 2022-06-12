import { BehaviorSubject } from 'rxjs'

import { createUseSelect, createUseStore, proxifyStore } from '../helpers'

import type { ObjectFromAttributes } from '../../types/shared'



const STORE_SYMBOL = '__cervello-store__'

type CervelloStore<StoreName extends string, StoreType> = {
  [k in StoreName]: StoreType
} & {
  useStore: () => StoreType
  useSelect: <Attributes extends Array<keyof StoreType>>(...selectors: Attributes) => ObjectFromAttributes<StoreType, Attributes>
}




export function cervello <StoreName extends string, T> (storeName: StoreName, initialValue: T): CervelloStore<StoreName, T> {
  // Unique symbol to be used to keep a reference of the BehaviourSubject
  const storeSymbol = Symbol(STORE_SYMBOL)


  const store$$ = new BehaviorSubject<T>(initialValue)




  const proxiedStore = proxifyStore(store$$, {
    [storeSymbol]: store$$,
    ...initialValue,
  })

  const cervelloStore = {
    [storeName]: proxiedStore,
    useStore: createUseStore<T>(store$$),
    useSelect: createUseSelect<T>(store$$),
  }

  return cervelloStore as CervelloStore<StoreName, T>
}
