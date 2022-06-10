/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { useRef, useState } from 'react'
import { filter, map, tap, withLatestFrom } from 'rxjs'

import { proxifyStore } from './proxy'
import { useIsomorphicEffect } from './use-isomorphic-effect'

import type { Subscription, BehaviorSubject, Subject } from 'rxjs'



const ALL_OBJECT_PROXY_ATTRIBUTES = '__all'

const initializerAttributeValue = (generatedId?: string): string => generatedId
  ? `${ALL_OBJECT_PROXY_ATTRIBUTES}_${generatedId}`
  : ALL_OBJECT_PROXY_ATTRIBUTES

interface CreateHookParams<T> {
  initialStore: T | Partial<T>
  store$$: BehaviorSubject<T>
  attributeModified$$: Subject<string | null>
}

// TODO: Move types to shared folder
type InitialValueOrCb<T> = T | ((reactiveData: T) => void)

// TODO: Move function to utils
const isCallback = (func: unknown): func is Function => {
  return typeof func === 'function'
}


export const createReactHook = <T>({
  initialStore,
  store$$,
  attributeModified$$,
}: CreateHookParams<T>): ((initialValueOrCallback?: InitialValueOrCb<T>, str?: string) => T) => {
  const isStoreArray = Array.isArray(initialStore)

  return (initialValueOrCallback?: InitialValueOrCb<T>, str?: string) => {
    /** Attributes or indexes (slices) observed from components (getters) */
    const observedAttributes = useRef<Array<string>>()
    const currentGeneratedId = useRef(initialValueOrCallback && `${Date.now()}${Math.ceil(Math.random() * 100)}`)

    /** Initial proxified store to be set when anybody pushes new
     * value and the component is observing some of the new pushed attributes/indexes
     */
    const [store, setStore] = useState(() => {
      const proxifiedStore = proxifyStore<T>({
        initialStore: (initialValueOrCallback && !isCallback(initialValueOrCallback))
          ? initialValueOrCallback
          : initialStore,
        store$$,
        attributeModified$$,
        obsAttributes: observedAttributes,
      })

      if (initialValueOrCallback) {
        if (!isCallback(initialValueOrCallback)) {
          // console.log('NOT CALLBACK' + str!)
          store$$.next(initialValueOrCallback)
          // attributeModified$$.next(initializerAttributeValue(currentGeneratedId.current))
        }
      }

      return proxifiedStore
    })

    // useEffect(() => {
    //   if (initialValueOrCallback) {
    //     if (isCallback(initialValueOrCallback)) {
    //       initialValueOrCallback(proxifyStore<T>({
    //         initialStore: (initialValueOrCallback && !isCallback(initialValueOrCallback))
    //           ? initialValueOrCallback
    //           : initialStore,
    //         store$$,
    //         attributeModified$$,
    //       }))
    //     }
    //   }
    // }, [])
    useIsomorphicEffect(() => {
      if (initialValueOrCallback) {
        if (!isCallback(initialValueOrCallback)) {
          console.log('NOT CALLBACK' + str!)
          // store$$.next(initialValueOrCallback)
          attributeModified$$.next(initializerAttributeValue(currentGeneratedId.current))
        }
      }
    }, [])

    useIsomorphicEffect(() => {
      let sub: Subscription
      console.log(`[START] - UseEffect ${str}`)

      /** If there are attributes observed (getters) */
      if (observedAttributes.current) {
        sub = attributeModified$$.pipe(
          tap((v) => console.log(`${str} attribute`, v, isStoreArray)),

          // Short-circuit for first time subscribe if initialValue is provided
          filter((v) => v !== initializerAttributeValue(currentGeneratedId.current)),

          // Filter by attribute if store value is not an array
          isStoreArray
            ? (v) => v
            : filter((attributeModified) =>
              attributeModified === ALL_OBJECT_PROXY_ATTRIBUTES
                ? true
                : !!(attributeModified && observedAttributes.current!.includes(attributeModified)),
            ),
          tap((v) => console.log(`${str} after fILTERS`, v)),
          withLatestFrom(store$$),
          tap((v) => console.log(`${str} withlatestfrom`, v)),
          map(([_, store]) =>
            proxifyStore<T>({
              initialStore: store,
              obsAttributes: observedAttributes,
              store$$,
              attributeModified$$,
            }),
          ),

          tap(setStore),
          tap(() => console.log('AFTER SETSTORE', str)),
        ).subscribe()
      }

      return () => {
        console.log(`[END] - UseEffect ${str}`)
        sub?.unsubscribe()
      }
    }, [])

    return store
  }
}
