
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'

import { nonReactiveObjectSymbol } from '../../types/shared'
import { proxifyStore } from '../helpers/new-proxify-store'
import { deepClone } from '../utils/object'
import { createCacheableSubject } from '../utils/subject'

import type { FieldPath, StoreChange } from '../../types/shared'




export type CervelloOptions<StoreValue extends Record<string, any>> = {
  beforeChange?: (storeChange: StoreChange<StoreValue>) => unknown | undefined
  afterChange?: (storeChange: Array<StoreChange<StoreValue>>) => void
}

export type CervelloUseStoreOptions<StoreValue extends Record<string, any>> = {
  initialValue?: (currentStore: StoreValue) => StoreValue,
  setValueOnMount?: (currentStore: StoreValue) => Promise<StoreValue>,
  select?:
  | Array<FieldPath<StoreValue>>
  | (() => Array<FieldPath<StoreValue>>)
  onChange?: (storeChange: Array<StoreChange<StoreValue>>) => void
}

type StoreValueMutable<T extends Record<string, any>> = {
  $value: T
} & T








export function nonReactive <T extends Record<string, any>> (initialValue: T): T {
  Object.defineProperty(initialValue, nonReactiveObjectSymbol, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false,
  })

  return initialValue
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

  const proxiedStore = proxifyStore(
    store$$ as any,
    clonedInitialValue,
    { beforeChange, afterChange },
  ) as StoreValueMutable<StoreValue>


  return {
    store: proxiedStore,
    reset: () => {
      proxiedStore.$value = deepClone(initialValue)
    },
    useStore: (options) => {
      const initialValue = options?.initialValue?.apply(proxiedStore, [proxiedStore.$value])
      const initialValueSet = useRef(false)

      if (!initialValueSet.current && initialValue && initialValue !== proxiedStore) {
        initialValueSet.current = true
        proxiedStore.$value = initialValue
      }

      const selectFieldPaths = useRef(
        (typeof options?.select === 'function'
          ? options?.select?.() // .map(fp => `root.${fp}`)
          : options?.select) // ?.map(fp => `root.${fp}`))
          ?? [],
      )

      const selectedFieldPathsForNestedObjects = useRef(
        selectFieldPaths.current
          .filter(fp => fp.includes('.*'))
          .map(fp => fp.replace('.*', '')),
      )


      useLayoutEffect(() => {
        if (options?.setValueOnMount) {
          void options.setValueOnMount(proxiedStore.$value).then((value) => {
            proxiedStore.$value = value
          }).catch((err) => {
            console.error('Error setting initial value on mount', err)
          })
        }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])


      useSyncExternalStore(
        (onStoreChange) => {
          const subscription = store$$.subscribe({
            next: (sc) => {
              const storeChanges = Array.isArray(sc)
                ? sc as Array<StoreChange<StoreValue>>
                : [sc]

              if (!options?.select) {
                onStoreChange()
                options?.onChange?.(storeChanges)

                return
              }

              if (storeChanges.some(nextChange => (
                nextChange.change.fieldPath === 'root'
                || selectFieldPaths.current.includes(nextChange.change.fieldPath))
                || selectedFieldPathsForNestedObjects.current
                  .find(fp => nextChange.change.fieldPath.startsWith(fp)),
              )) {
                onStoreChange()
                options?.onChange?.(storeChanges)
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
