
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector'


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

  // const subscribeWithSelectors = (selectors: Array<keyof T>): (onStoreChange: () => void) => () => void => {
  //   return (onStoreChange: () => void): (() => void) => {
  //     const subscription = store$$.subscribe(onStoreChange)
  //     // console.log('1- FUNCTION OF SUBSCRIBE')
  //     // const subscription = store$$.pipe(distinctUntilChanged((prev, curr) => {
  //     //   let isEqual = true
  //     //   selectors.forEach((selector) => {
  //     //     if (typeof curr[selector] === 'object' && isEqual) {
  //     //       if (JSON.stringify(prev[selector]) !== JSON.stringify(curr[selector])) {
  //     //         isEqual = false
  //     //       }
  //     //     } else {
  //     //       if (prev[selector] !== curr[selector] && isEqual) {
  //     //         isEqual = false
  //     //       }
  //     //     }
  //     //   })
  //     //   console.log('1- FUNCTION OF distinctUntilChanged', { isEqual })

  //     //   return isEqual
  //     // })).subscribe(onStoreChange)

  //     return () => {
  //       subscription.unsubscribe()
  //     }
  //   }
  // }




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
        : JSON.stringify(prev) === JSON.stringify(curr),

    )

    return proxifyStore(store$$ as any, store)
  }

  return useSelector
}
