import { BehaviorSubject, distinctUntilChanged } from 'rxjs'

import { createUseSelector, createUseStore, proxifyStore } from '../helpers'

import type { WithoutType } from '../../types/shared'
import type { UseSelector } from '../helpers'



// const STORE_SYMBOL = '__cervello-store__'


interface CervelloStoreUseParam<StoreType> {
  onChange: (cb: (store: StoreType) => void) => void
  onPartialChange: <
    Attributes extends Array< keyof WithoutType<StoreType, Function>>
  > (selectors: Attributes, cb: (store: StoreType) => void) => void
}

/**
 * Use function which allows you to listen for changes in the store.
 */
export type CervelloUseFunction<StoreType> = (param: CervelloStoreUseParam<StoreType>) => void


interface CervelloStore<StoreType> {
  /** Reactive store */
  store: StoreType
  /** Hook to react to all changes done to 'store' */
  useStore: () => StoreType
  /** Hook to react to changes done to 'store' in all the attributes provided */
  useSelector: UseSelector<StoreType>
  /** Functions to be attached to changes in a general way (tracking, loggers, ... etc) */
  use: (...functions: Array<(useObj: CervelloStoreUseParam<StoreType>) => void>) => CervelloStore<StoreType>
}

/**
 * @note Currently not working
 */
export interface CervelloOptions {
  persist?:
  | boolean
  // | {
  //   getItem: (key: string) => any
  // }
}


/**
 * Creates a store that is reactive and can be used inside and outside of React components.
 * @param initialValue Object with the default values for the store
 *
 * @returns - { store, useStore, useSelector }
 */
export function cervello <T extends Record<any, unknown>> (initialValue: T, options?: CervelloOptions): CervelloStore<T>


/**
 * Creates a store that is reactive and can be used inside and outside of React components.
 * @param initialValue Function which returns the default values for the store
 *
 * @returns - { store, useStore, useSelector }
 */
export function cervello <T> (initialValue: () => T, options?: CervelloOptions): CervelloStore<T>







/** @internal */
export function cervello <T> (initialValue: T | (() => T), options?: CervelloOptions): CervelloStore<T> {
  const defaultValue = (typeof initialValue === 'function' ? (initialValue as any)() : initialValue) as T
  const store$$ = new BehaviorSubject<T>(defaultValue)

  const proxiedStore = proxifyStore<T>(store$$, { ...defaultValue })

  const cervelloStore = {
    store: proxiedStore,

    // TO BE SEPARATED IN cervello/react package ---------------------
    useStore: createUseStore<T>(store$$),
    useSelector: createUseSelector<T>(store$$),
    // ---------------------------------------------------------------

    use (...functionList: any) {
      functionList.forEach((func: any) => {
        func({
          onChange (cb: any) {
            // store$$.pipe(
            //   // pairwise(),
            //   // switchMap(([oldValue, newValue]) => (oldValue !== newValue ? of(newValue) : NEVER)),
            // ).subscribe((_) => cb(proxiedStore))
            store$$.subscribe((_) => cb(proxiedStore))
          },
          onPartialChange (attrs: Array<keyof T>, cb: any) {
            store$$.pipe(
              // pairwise(),
              // switchMap(([oldValue, newValue]) => (oldValue !== newValue ? of(newValue) : NEVER)),
              distinctUntilChanged((prev, curr) => {
                let isEqual = true
                attrs.forEach((selector) => {
                  const currentPropertyValue = curr[selector]
                  const prevPropertyValue = prev[selector]
                  if (isEqual) {
                    isEqual = typeof currentPropertyValue === 'object'
                      ? JSON.stringify(prevPropertyValue) === JSON.stringify(currentPropertyValue)
                      : prevPropertyValue === currentPropertyValue
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



  return cervelloStore as CervelloStore<T>
}
