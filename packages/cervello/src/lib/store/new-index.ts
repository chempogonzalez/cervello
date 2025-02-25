/* eslint-disable tsdoc/syntax */

import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'

import { proxifyStore } from '../helpers/new-proxify-store'
import { deepClone } from '../utils/object'
import { createCacheableSubject } from '../utils/subject'


/**
  *
  * @example
  * // Init usage
  * const {
  *   store,
  *   useStore,
  * } = cervello({
  *  name: 'example',
  *  lastName: 'example',
  * }, {
  *  // To change value before it's set in the store
  *  beforeChange: (store) => {
  *   console.log('beforeChange', store)
  *   return store
  *  },
  *  // For side effects
  *  afterChange: (store) => {
  *   console.log('afterChange', store)
  *   },
  * })
  *
  *
  * // Hook usage
  *
  * function Component () {
  *  const store = useStore()
  *
  *  return <div>{store.name}</div>
  * }
  *
  * // useStore options
  *
  * useStore({
  *  // To set the value for hook usage before it's set in the store
  *  // It's like useState default value
  *  initValue: () => ({ name: 'example' }),
  *  // To set the value on the store on initial render
  *  initValueOnMount: async () => ({ name: 'example' }),
  *  // Selector to listen for changes on specific attributes from the store
  *  select: (store) => [store.name],
  * })
  *
  *
  *
  * */


export type CervelloOptions<StoreValue extends Record<string, any>> = {
  beforeChange?: (storeChange: StoreChange<StoreValue>) => unknown | undefined
  afterChange?: (storeChange: Array<StoreChange<StoreValue>>) => void
}

export type CervelloUseStoreOptions<StoreValue extends Record<string, any>> = {
  initialValue?: () => StoreValue,
  setValueOnMount?: () => Promise<StoreValue>,
  select?: (() => Array<FieldPath<StoreValue>>) | Array<FieldPath<StoreValue>>
}

type StoreValueMutable<T extends Record<string, any>> = {
  $value: T
} & T



// type FieldPath<T extends Record<string, any>> = {
//   [K in keyof Required<T>]: T[K] extends Record<string, any>
//     ? K extends string
//       ? `${K}.*` | `${K}.${FieldPath<T[K]>}`
//       : never
//     : K extends string
//       ? K
//       : never
// }[keyof T]


type FieldPath<T extends Record<string, any>> = {
  [K in keyof Required<T>]: T[K] extends Record<string, any>
    ? K extends string
      ? T[K] extends Function
        ? never
        : T[K] extends Array<any>
          ? K
          : `${K}.*` | `${K}.${FieldPath<T[K]>}`
      : never
    : K extends string
      ? K
      : never
}[keyof T]



export type StoreChange<T extends Record<string, any>> = {
  change: {
    fieldPath: string
    newValue: any
    previousValue: any
  }
  storeValue: T
}


export function cervello <StoreValue extends Record<PropertyKey, any>> (
  initialValue: StoreValue,
  options?: CervelloOptions<StoreValue>,
): {
    store: StoreValueMutable<StoreValue>,
    reset: () => void,
    useStore: (options?: CervelloUseStoreOptions<StoreValue>) => StoreValueMutable<StoreValue>
  } {
  const {
    beforeChange,
    afterChange,
  } = options ?? {}

  const clonedInitialValue = deepClone(initialValue)
  const store$$ = createCacheableSubject<StoreChange<StoreValue>>(clonedInitialValue as any)
  const proxiesMap = new Map<string, StoreValueMutable<StoreValue>>()

  const proxiedStore = proxifyStore(
    store$$ as any,
    clonedInitialValue,
    proxiesMap,
    { beforeChange, afterChange },
  ) as StoreValueMutable<StoreValue>


  return {
    store: proxiedStore,
    reset: () => {
      proxiedStore.$value = deepClone(initialValue)
    },
    useStore: (options) => {
      console.log('options', options)
      // const shouldReturnInitValue = useRef(false)
      const selectFieldPaths = useRef(
        (typeof options?.select === 'function'
          ? options?.select?.().map(fp => `root.${fp}`)
          : options?.select?.map(fp => `root.${fp}`))
          ?? [],
      )
      const selectedFieldPathsForNestedObjects = useRef(
        selectFieldPaths.current
          .filter(fp => fp.includes('.*'))
          .map(fp => fp.replace('.*', '')),
      )

      useLayoutEffect(() => {
        if (options?.setValueOnMount) {
          void options.setValueOnMount().then((value) => {
            proxiedStore.$value = value
          }).catch((err) => {
            console.error('Error setting initial value on mount', err)
          })
        }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])



      const initialValue = options?.initialValue?.apply(proxiedStore)
      const initialValueSet = useRef(false)

      if (!initialValueSet.current && initialValue && initialValue !== proxiedStore) {
        initialValueSet.current = true
        proxiedStore.$value = initialValue
      }

      useSyncExternalStore(
        (onStoreChange) => {
          const subscription = store$$.subscribe({
            next: (nsv) => {
              const nextStoreValue = Array.isArray(nsv)
                ? nsv as Array<StoreChange<StoreValue>>
                : [nsv]

              console.log('nextStoreValue', nextStoreValue)
              if (!options?.select) {
                onStoreChange()
                afterChange?.(nextStoreValue)

                return
              }

              if (nextStoreValue.some(nextChange => (
                nextChange.change.fieldPath === 'root'
                || selectFieldPaths.current.includes(nextChange.change.fieldPath))
                || selectedFieldPathsForNestedObjects.current
                  .find(fp => nextChange.change.fieldPath.startsWith(fp)),
              )) {
                onStoreChange()
                afterChange?.(nextStoreValue)
              }
            },
          })

          return () => {
            subscription.unsubscribe()
          }
        },
        () => store$$.getValue(),
        () => store$$.getValue(),
      )

      return proxiedStore
    },
  }
}

