/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable no-prototype-builtins */
import type { MutableRefObject } from 'react'
import type { BehaviorSubject, Subject } from 'rxjs'



function proxyHandlerGenerator <T, K extends keyof T> (
  attributes: MutableRefObject<Array<string> | undefined> | null,
  store$$: BehaviorSubject<T>,
  attributeModified$$: Subject<string | null>,
) {
  return {
    get: function (_: any, prop: string): T[K] | null {
      const currentStore = store$$.value as any
      console.log('PROP------------------------', prop)
      if (prop in currentStore) {
        const observedAttributes = [...(attributes?.current ?? [])]

        if (attributes
          && !observedAttributes.includes(prop)
          && currentStore.hasOwnProperty(prop)
        ) {
          observedAttributes.push(prop)
          attributes.current = observedAttributes
        }
        return currentStore[prop] as T[K]
      }
      return null
    },
    set: function (_: any, prop: any, value: any) {
      const currentStore = store$$.value as any

      currentStore[prop] = value
      store$$.next(currentStore)

      const checker = Array.isArray(currentStore) ? (!isNaN(+prop) && +prop >= 0) : true

      console.log('setting', { prop, value })
      /** Trigger change in subscription to sync values listened by hook */
      if (currentStore.hasOwnProperty(prop) && checker) attributeModified$$.next(prop)

      return true
    },
  }
}






/** ---------------------------------------------------- */
interface ProxifyStoreParams<T> {
  initialStore: T | Partial<T>
  obsAttributes?: (MutableRefObject<Array<string> | undefined> | null)
  store$$: BehaviorSubject<T>
  attributeModified$$: Subject<string | null>
}


export const proxifyStore = <T>({
  initialStore,
  obsAttributes = null,
  store$$,
  attributeModified$$,
}: ProxifyStoreParams<T>): T => (
    new Proxy(
      initialStore,
      proxyHandlerGenerator<T, keyof T>(obsAttributes, store$$, attributeModified$$),
    )
  )
