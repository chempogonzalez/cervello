import { useEffect, useRef, useState } from 'react'
import { distinctUntilChanged } from 'rxjs'

import { proxifyStore } from './proxify-store'

import type { BehaviorSubject } from 'rxjs'



type ObjectFromAttributes<T, Attributes extends Array<keyof T>> = {
  [k in Attributes[number]]: T[k]
}

function getPartialObjectFromAttributes <T> (attributes: Array<keyof T>, store: T): any {
  return attributes.reduce<any>((acc, curr) => {
    acc[curr] = store[curr]
    return acc
  }, {})
}


export function createUseSelect <T> (store$$: BehaviorSubject<T>) {
  //
  return <Attributes extends Array<keyof T>>(...selectors: Attributes): ObjectFromAttributes<T, Attributes> => {
    const [store, setStore] = useState<any>(() => {
      const selectedStore = getPartialObjectFromAttributes(selectors, store$$.value)
      return proxifyStore(store$$, selectedStore)
    })
    const isFirstTime = useRef(true)


    useEffect(() => {
      const subscription = store$$.pipe(distinctUntilChanged((prev, curr) => {
        let isEqual = true
        selectors.forEach((selector) => {
          if (typeof curr[selector] === 'object' && isEqual) {
            if (JSON.stringify(prev[selector]) !== JSON.stringify(curr[selector])) {
              isEqual = false
            }
          } else {
            if (prev[selector] !== curr[selector] && isEqual) {
              isEqual = false
            }
          }
        })

        return isEqual
      })).subscribe((partialStore) => {
        if (isFirstTime.current) {
          isFirstTime.current = false
        } else {
          const selectedStore = getPartialObjectFromAttributes(selectors, partialStore)
          setStore(proxifyStore(store$$, selectedStore))
        }
      })


      return () => subscription.unsubscribe()
    }, [selectors.length])


    return store
  }
}
