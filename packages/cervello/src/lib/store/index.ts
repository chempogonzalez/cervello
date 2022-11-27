/* eslint-disable @typescript-eslint/ban-types */
import { createStoreSelectorHook, proxifyStore } from '../helpers'
import { INTERNAL_VALUE_PROP } from '../helpers/constants'
import {
  contentComparer,
  deepClone,
  getPartialObjectFromProperties,
  createCacheableSubject,
  okTarget,
} from '../utils'

import type { Maybe, UseSelector, WithoutType } from '../../types/shared'



interface CervelloStoreUseParam<StoreType> {
  onChange: (cb: (store: StoreType) => void) => void
  onPartialChange: <
    Attributes extends keyof WithoutType<StoreType, Function>,
    R extends Exclude<Attributes, '$value'>,
    ArrayOfAttributes extends Array <R>,
  > (selectors: ArrayOfAttributes, cb: (store: StoreType) => void) => void
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
  /** Resets the value to the initial value passed in */
  reset: () => void
  /** Functions to be attached to changes in a general way (tracking, loggers, ... etc) */
  use: (...functions: Array<(useObj: CervelloStoreUseParam<StoreType>) => void>) => CervelloStore<StoreType>
}


export interface CervelloOptions {
  reactiveNestedObjects: boolean
}


/**
 * Creates a store that is reactive and can be used inside and outside of React components.
 * @param initialValue - Object with the default values for the store
 *
 * @returns - \{ store, useStore, useSelector \}
 */
export function cervello <T> (initialValue: T, options?: CervelloOptions): CervelloStore<T & { $value: Maybe<T> }>


/**
 * Creates a store that is reactive and can be used inside and outside of React components.
 * @param initialValue - Function which returns the default values for the store
 *
 * @returns  \{ store, useStore, useSelector \}
 */
export function cervello <T> (initialValue: () => T, options?: CervelloOptions): CervelloStore<T & { $value: Maybe<T> }>


/** @internal */
export function cervello <T> (
  initialValue: T | (() => T),
  options: CervelloOptions = { reactiveNestedObjects: true },
): CervelloStore<T & { $value: Maybe<T> }> {
  const defaultValue: T = typeof initialValue === 'function' ? (initialValue as any)() : initialValue


  const clonedInitialValue = { [INTERNAL_VALUE_PROP]: deepClone(defaultValue) } as any as T

  /**
   * Object map to keep reference of nested object proxies created
   * to avoid problems with reference equality (i.e.: useEffect dependencies array)
   */
  const proxiedNestedObjectMap: any = {}

  const store$$ = createCacheableSubject(clonedInitialValue, false) as any
  const proxiedStore = proxifyStore<T>(store$$, clonedInitialValue, proxiedNestedObjectMap, options.reactiveNestedObjects)

  const cervelloStore = {
    store: proxiedStore,
    reset () {
      (proxiedStore as any).$value = defaultValue
    },

    // TO BE SEPARATED IN cervello/react package --------------------------------
    useStore: createStoreSelectorHook<T>(store$$, proxiedStore, 'full'),
    useSelector: createStoreSelectorHook<T>(store$$, proxiedStore, 'slice'),
    // --------------------------------------------------------------------------

    use (...functionList: any) {
      functionList.forEach((func: any) => {
        func({
          onChange (cb: any) {
            store$$.subscribe({ next: (_: any) => { cb(proxiedStore) } })
          },
          onPartialChange (attrs: Array<keyof T>, cb: any) {
            let prevSlice: any = getPartialObjectFromProperties(attrs, okTarget(clonedInitialValue))
            store$$.subscribe({
              next: (v: T) => {
                const target = okTarget(v)
                const currentSlice = getPartialObjectFromProperties(attrs, target)

                const isEquals = contentComparer(prevSlice, currentSlice)
                if (!isEquals) {
                  cb(proxiedStore)
                  prevSlice = deepClone(currentSlice)
                }
              },
            })
          },
        })
      })
      return this
    },
  } as any



  return cervelloStore as CervelloStore<T & { $value: Maybe<T> }>
}
