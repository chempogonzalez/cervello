
import { useMemo } from 'react'
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector.js'


import { isEqualObject } from '../utils'
import { subscribeForReactHook } from '../utils/subscribe-for-react'
import { proxifyStore } from './proxify-store'

import type { ObjectFromAttributes, WithoutType } from '../../types/shared'
import type { BehaviorSubject } from 'rxjs'



export function getPartialObjectFromAttributes <T> (attributes: Array<keyof T>, store: T): any {
  return attributes.reduce<any>((acc, curr) => {
    acc[curr] = store[curr]
    return acc
  }, {})
}

export type UseSelector<T> = <Attributes extends Array< keyof WithoutType<T, Function> >>(
  selectors: Attributes,
  isEqualFunction?: (previousState: ObjectFromAttributes<T, Attributes>, currentState: ObjectFromAttributes<T, Attributes>) => boolean,
  ) => ObjectFromAttributes<T, Attributes>



export function createUseSelector <T> (store$$: BehaviorSubject<T>): UseSelector<T> {
  const subscribe = subscribeForReactHook(store$$)
  const getValue = store$$.getValue.bind(store$$)

  // USE SELECTOR HOOK -------------------------------------------------
  const useSelector = <Attributes extends Array< keyof WithoutType<T, Function> >>(
    selectors: Attributes,
    isEqualFunction?: (previousState: ObjectFromAttributes<T, Attributes>, currentState: ObjectFromAttributes<T, Attributes>) => boolean,
  ): ObjectFromAttributes<T, Attributes> => {
    const store = useSyncExternalStoreWithSelector<T, ObjectFromAttributes<T, Attributes>>(
      subscribe,
      getValue,
      getValue,
      (store) => getPartialObjectFromAttributes(selectors, store),
      (prev, curr) => isEqualFunction
        ? isEqualFunction(prev, curr)
        : isEqualObject(prev, curr),
    )

    const cachedStore = useMemo(() => proxifyStore(store$$ as any, store), [store])

    return cachedStore
  }

  return useSelector
}
