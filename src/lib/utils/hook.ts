/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { filter, map, switchMap, tap, of, combineLatest, startWith } from 'rxjs'
import type { Subscription, BehaviorSubject, Subject } from 'rxjs'
import { useEffect, useRef, useState } from 'react'
import { proxifyStore } from '.'

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
  const store$ = combineLatest([
    store$$,
    attributeModified$$.pipe(startWith(null)),
  ])


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
        sub = store$
          .pipe(
            filter(([_, attributeModified]) =>
              attributeModified === null
                ? false
                : observedAttributes.current!.includes(attributeModified),
            ),
            switchMap(([store, _]) =>
              of(observedAttributes.current!.reduce<Partial<T>>((acc, curr) => {
                if (curr in store) {
                  (acc as any)[curr] = (store as any)[curr]
                }
                return acc
              }, {})),
            ),
            map((processedStore: Partial<T>) =>
              proxifyStore<T>({
                initialStore: processedStore,
                obsAttributes: observedAttributes,
                store$$,
                attributeModified$$,
              }),
              // new Proxy(
              //   processedStore,
              //   proxyHandlerGenerator(
              //     observedAttributes,
              //     store$$,
              //     attributeModified$$,
              //   ),
              // ),
            ),
            tap(setStore),
          )
          .subscribe()
      }

      return () => sub?.unsubscribe()
    }, [observedAttributes.current])

    return store
  }
}
