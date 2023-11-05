/* eslint-disable @typescript-eslint/ban-types */
import { useRef, useSyncExternalStore } from 'react'

import { INTERNAL_VALUE_PROP } from './constants'
import { contentComparer, deepClone, getPartialObjectFromProperties } from '../utils'

import type { ObjectFromAttributes, UseSelector, WithoutType } from '../../types/shared'
import type { CacheableSubject } from '../utils/subject'



const isServerSymbol = Symbol.for('_isServer')


export function createStoreSelectorHook<T> (store$$: CacheableSubject<T>, proxiedStore: any, type: 'full' | 'slice'): UseSelector<T> {
  const serverInitialValue = Object.assign({}, (store$$.getValue() as any)[INTERNAL_VALUE_PROP], { [isServerSymbol]: true })


  // SELECTOR HOOK -------------------------------------------------
  const useStoreWithSelectors = <Attributes extends Array<keyof WithoutType<T, Function>>>(
    selectors: Attributes,
    isEqualFunction?: (previousState: ObjectFromAttributes<T, Attributes>, currentState: ObjectFromAttributes<T, Attributes>) => boolean,
  ): T => {
    const prevSlice = useRef< ObjectFromAttributes<T, Attributes> | null >(
      type === 'full'
        ? null
        // To avoid the first render to be always different even
        // if store changed other than selected attributes
        : getPartialObjectFromProperties(selectors, (store$$.getValue() as any)?.[INTERNAL_VALUE_PROP]),
    )

    const store = useSyncExternalStore(
      (onStoreChange) => {
        const subscription = store$$.subscribe({
          next: (v) => {
            if (type === 'full') {
              onStoreChange()

              return
            }

            // Partial store section ------------------------------------------------------------------
            const currentSlice = getPartialObjectFromProperties(selectors, (v as any)?.[INTERNAL_VALUE_PROP])

            const compareWithPreviousStore = (isEqualFunction ?? contentComparer as any)

            const isEquals = compareWithPreviousStore(prevSlice.current, currentSlice)

            if (!isEquals) {
              /**
               * Update previous slice with deepClone to avoid storing direct store$$ value reference.
               * This solve reference/value problems when changing the store object
               * (proxy.set is changing the target object which is 'v' here)
               */
              prevSlice.current = deepClone(currentSlice)
              onStoreChange()
            }
            // ----------------------------------------------------------------------------------------
          },
        })

        return () => { subscription.unsubscribe() }
      },
      () => store$$.getValue(),
      () => serverInitialValue,
    )


    const isServerStore = Object.getOwnPropertySymbols(store).includes(isServerSymbol)

    return isServerStore ? store : proxiedStore
  }

  return useStoreWithSelectors
}
