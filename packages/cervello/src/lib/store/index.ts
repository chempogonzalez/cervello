import { BehaviorSubject, distinctUntilChanged, NEVER, of, pairwise, switchMap } from 'rxjs'

import { createUseSelect, createUseStore, proxifyStore } from '../helpers'

import type { ObjectFromAttributes } from '../../types/shared'



// const STORE_SYMBOL = '__cervello-store__'




type CervelloStoreUseParam<StoreName extends string, StoreType> = {
  [k in StoreName]: StoreType
} & {
  $onChange: (cb: (store: StoreType) => void) => void
  $onPartialChange: <
    Attributes extends Array<keyof StoreType>
  > (selectors: Attributes, cb: (store: StoreType) => void) => void
}


export type CervelloUseFunction<StoreName extends string, StoreType> = (param: CervelloStoreUseParam<StoreName, StoreType>) => void


type CervelloStore<StoreName extends string, StoreType> = {
  [k in StoreName]: StoreType
} & {
  useStore: () => StoreType
  useSelect: <Attributes extends Array<keyof StoreType>>(...selectors: Attributes) => ObjectFromAttributes<StoreType, Attributes>
  use: (...functions: Array<(useObj: CervelloStoreUseParam<StoreName, StoreType>) => void>) => CervelloStore<StoreName, StoreType>
}




export function cervello <
  StoreName extends string,
  T
> (storeName: StoreName, initialValue: T): CervelloStore<StoreName, T> {
  // Unique symbol to be used to keep a reference of the BehaviourSubject
  // const storeSymbol = Symbol(STORE_SYMBOL)


  const store$$ = new BehaviorSubject<T>(initialValue)

  const proxiedStore = proxifyStore(store$$, { ...initialValue })

  const cervelloStore = {
    [storeName]: proxiedStore,

    // TO BE SEPARATED IN cervello/react package ---------------------
    useStore: createUseStore<T>(store$$),
    useSelect: createUseSelect<T>(store$$),
    // ---------------------------------------------------------------

    use (...functionList: any) {
      functionList.forEach((func: any) => {
        func({
          [storeName]: proxiedStore,
          $onChange (cb: any) {
            store$$.pipe(
              pairwise(),
              switchMap(([oldValue, newValue]) => (oldValue !== newValue ? of(newValue) : NEVER)),
            ).subscribe((_) => cb(proxiedStore))
          },
          $onPartialChange (attrs: Array<keyof T>, cb: any) {
            store$$.pipe(
              pairwise(),
              switchMap(([oldValue, newValue]) => (oldValue !== newValue ? of(newValue) : NEVER)),
              distinctUntilChanged((prev, curr) => {
                let isEqual = true
                attrs.forEach((selector) => {
                  if (typeof curr[selector] === 'object' && isEqual) {
                    if (JSON.stringify(prev[selector]) !== JSON.stringify(curr[selector])) {
                      isEqual = false
                    }
                  } else {
                    if (prev[selector] !== curr[selector] && isEqual) {
                      isEqual = false
                    }
                  }
                })
                return isEqual
              }),
            ).subscribe((_) => cb(proxiedStore))
          },
        })
      })
      return this
    },
  } as any



  return cervelloStore as CervelloStore<StoreName, T>
}
