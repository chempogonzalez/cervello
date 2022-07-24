import { useEffect, useRef, useState } from 'react'
import { observeOn, queueScheduler } from 'rxjs'

import { proxifyStore } from './proxify-store'

import type { BehaviorSubject } from 'rxjs'



export function createUseStore <T> (store$$: BehaviorSubject<T>): () => T {
  return () => {
    const [store, setStore] = useState<T>(proxifyStore(store$$, store$$.value))
    const isFirstTime = useRef(true)

    // TODO: Use new useSyncExternalStore API hook
    useEffect(() => {
      const subscription = store$$.pipe(observeOn(queueScheduler)).subscribe((n) => {
        if (isFirstTime.current) {
          isFirstTime.current = false
        } else {
          setStore(proxifyStore(store$$, n))
        }
      })

      return () => subscription.unsubscribe()
    }, [])


    return store
  }
}
