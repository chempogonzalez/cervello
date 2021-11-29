import type { MutableRefObject } from 'react'
import type { BehaviorSubject, Subject } from 'rxjs'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function proxyHandlerGenerator <T, K extends keyof T> (
  attributes: MutableRefObject<Array<string> | undefined> | null,
  store$$: BehaviorSubject<T>,
  attributeModified$$: Subject<string | null>,
) {
  return {
    get: function (_: any, prop: string): T[K] | null {
      const { value: currentStore } = store$$

      if (prop in currentStore) {
        const observedAttributes = attributes?.current ?? []
        if (attributes && !observedAttributes.includes(prop)) {
          observedAttributes.push(prop)

          // TODO: review if assignement can be removed
          attributes.current = observedAttributes
        }

        return (currentStore as any)[prop] as T[K]
      }
      return null
    },
    set: function (_: any, prop: string, value: any) {
      const { value: currentStore } = store$$

      if (prop in currentStore) {
        if (Array.isArray(currentStore)) {
          const newArrayToPush = [...currentStore] as Array<unknown>
          newArrayToPush[+prop] = value
          store$$.next(newArrayToPush as unknown as T)
        } else {
          store$$.next({ ...currentStore, [prop]: value })
        }
        attributeModified$$.next(prop)
      }
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
