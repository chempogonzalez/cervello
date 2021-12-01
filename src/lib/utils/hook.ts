/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { filter, map, tap, withLatestFrom } from 'rxjs'
import { useEffect, useRef, useState } from 'react'
import { proxifyStore } from './proxy'
import type { Subscription, BehaviorSubject, Subject } from 'rxjs'

interface CreateHookParams<T> {
  initialStore: T | Partial<T>
  store$$: BehaviorSubject<T>
  attributeModified$$: Subject<string | null>
}

export const createReactHook = <T>({
  initialStore,
  store$$,
  attributeModified$$,
}: CreateHookParams<T>): (() => T) => {
  const isStoreArray = Array.isArray(initialStore)

  return () => {
    /** Attributes or indexes (slices) observed from components (getters) */
    const observedAttributes = useRef<Array<string>>()

    /** Initial proxified store to be set when anybody pushes new
     * value and the component is observing some of the new pushed attributes/indexes
     */
    const [store, setStore] = useState(proxifyStore<T>({
      initialStore,
      store$$,
      attributeModified$$,
      obsAttributes: observedAttributes,
    }))

    useEffect(() => {
      let sub: Subscription

      /** If there are attributes observed (getters) */
      if (observedAttributes.current) {
        sub = attributeModified$$.pipe(
          isStoreArray
            ? (v) => v
            : filter((attributeModified) => !!(attributeModified && observedAttributes.current!.includes(attributeModified))),
          withLatestFrom(store$$),
          map(([_, store]) =>
            proxifyStore<T>({
              initialStore: store,
              obsAttributes: observedAttributes,
              store$$,
              attributeModified$$,
            }),
          ),
          tap(setStore),
        ).subscribe()
      }

      return () => sub?.unsubscribe()
    }, [observedAttributes.current])

    return store
  }
}
