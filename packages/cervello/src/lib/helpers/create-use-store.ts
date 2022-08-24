
import { useMemo } from 'react'
import { useSyncExternalStore } from 'use-sync-external-store/shim/index.js'

import { subscribeForReactHook } from '../utils/subscribe-for-react'
import { proxifyStore } from './proxify-store'

import type { BehaviorSubject } from 'rxjs'



export function createUseStore <T> (store$$: BehaviorSubject<T>): () => T {
  const subscribe = subscribeForReactHook(store$$)
  const getValue = store$$.getValue.bind(store$$)


  // USE STORE HOOK -------------------------------------------------
  const useStore = (): T => {
    const store = useSyncExternalStore(subscribe, getValue, getValue)

    const cachedStore = useMemo(() => proxifyStore(store$$, store), [store])

    return cachedStore
  }


  return useStore
}
