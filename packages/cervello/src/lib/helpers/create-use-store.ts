
import { useMemo } from 'react'
import { useSyncExternalStore } from 'use-sync-external-store/shim/index.js'

import { subscribeForReactHook } from '../utils/subscribe-for-react'
import { proxifyStore } from './proxify-store'

import type { BehaviorSubject } from 'rxjs'
import type { Maybe } from 'src/types/shared'



export function createUseStore <T> (store$$: BehaviorSubject<T>, proxiedNestedObjectMap: any): () => T & { $value: Maybe<T> } {
  const subscribe = subscribeForReactHook(store$$)
  const getValue = store$$.getValue.bind(store$$)


  // USE STORE HOOK -------------------------------------------------
  const useStore = (): T & { $value: Maybe<T> } => {
    const store = useSyncExternalStore(subscribe, getValue, getValue)

    const cachedStore = useMemo(() => proxifyStore(store$$, store, proxiedNestedObjectMap), [store])

    return cachedStore as T & { $value: Maybe<T> }
  }


  return useStore
}
