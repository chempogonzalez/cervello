/* eslint-disable @typescript-eslint/ban-types */
import { useRef } from 'react'
import { useSyncExternalStore } from 'use-sync-external-store/shim/index.js'

import { contentComparer, getPartialObjectFromProperties } from '../utils'
import { INTERNAL_VALUE_PROP } from './constants'

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
    const prevSlice = useRef< ObjectFromAttributes<T, Attributes> | null >(null)

    const store = useSyncExternalStore(
      (onStoreChange) => {
        const subscription = store$$.subscribe({
          next: (v) => {
            if (type === 'full') return onStoreChange()

            const currentSlice = getPartialObjectFromProperties(selectors, (v as any)?.[INTERNAL_VALUE_PROP])

            const compareWithPreviousStore = (isEqualFunction ?? contentComparer as any)

            const isEquals = compareWithPreviousStore(prevSlice.current, currentSlice)
            if (!isEquals) {
              prevSlice.current = currentSlice
              onStoreChange()
            }
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
