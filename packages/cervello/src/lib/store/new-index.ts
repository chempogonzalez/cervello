
import { useEffect, useId, useRef, useState } from 'react'

import { nonReactiveObjectSymbol } from '../../types/shared'
import { proxifyStore } from '../helpers/new-proxify-store'
import { contentComparer, deepClone } from '../utils/object'
import { createCacheableSubject } from '../utils/subject'

import type { FieldPath, StoreChange } from '../../types/shared'





export type CervelloOptions<StoreValue extends Record<string, any>> = {
  afterChange?: (storeChange: Array<StoreChange<StoreValue>>) => void
}

export type CervelloUseStoreOptions<StoreValue extends Record<string, any>> = {
  initialValue?: (currentStore: StoreValue) => StoreValue | null,
  setValueOnMount?: (currentStore: StoreValue) => Promise<StoreValue>,
  select?:
  | Array<FieldPath<StoreValue>>
  | (() => Array<FieldPath<StoreValue>>)
  onChange?: (storeChange: Array<StoreChange<StoreValue>>) => void
}

type MutableStoreValue<T extends Record<string, any>> = {
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
    store: MutableStoreValue<StoreValue>,
    reset: () => void,
    useStore: (options?: CervelloUseStoreOptions<StoreValue>) => MutableStoreValue<StoreValue>
  } {
  const {
    afterChange,
  } = options ?? {}

  const clonedInitialValue = deepClone(initialValue)

  const store$$ = createCacheableSubject<StoreChange<StoreValue>>()

  const proxiedStore = proxifyStore(
    store$$ as any,
    clonedInitialValue,
    { afterChange },
  ) as MutableStoreValue<StoreValue>


  return {
    store: proxiedStore,
    reset: () => {
      proxiedStore.$value = deepClone(initialValue)
    },
    useStore: (options) => {
      const subscriberId = useId()
      const isInitialValueSet = useRef(false)
      const [, setRenderCount] = useState(0)

      // Latest options are read through this ref by the subscription (created
      // once per mount), so callbacks like `onChange` are never stale closures
      const optionsRef = useRef(options)

      optionsRef.current = options

      // useState-like semantics: `initialValue` runs only on the first render
      // (SSR included), so the store traversals it needs (clone + compare)
      // are paid once per mount instead of on every re-render
      if (!isInitialValueSet.current) {
        isInitialValueSet.current = true

        const initialValue = options?.initialValue?.(proxiedStore.$value)

        if (initialValue && !contentComparer(initialValue, proxiedStore.$value))
          (proxiedStore as any).$$value = { id: subscriberId, newValue: initialValue }
      }

      // `select` is frozen from the first render (computed lazily, once)
      const selectFieldPaths = useRef<Array<FieldPath<StoreValue>> | null>(null)

      if (selectFieldPaths.current === null) {
        selectFieldPaths.current = (
          typeof options?.select === 'function'
            ? options.select()
            : options?.select
        ) ?? []
      }

      const selectedFieldPathsForNestedObjects = useRef<Array<string> | null>(null)

      if (selectedFieldPathsForNestedObjects.current === null) {
        selectedFieldPathsForNestedObjects.current = selectFieldPaths.current
          .filter(fp => fp.includes('.*'))
          .map(fp => fp.replace('.*', ''))
      }

      const reRender = (): void => {
        setRenderCount(p => p + 1)
      }


      useEffect(() => {
        if (options?.setValueOnMount) {
          void options.setValueOnMount(proxiedStore.$value).then((value) => {
            proxiedStore.$value = value
          }).catch((err) => {
            console.error('Error setting initial value on mount', err)
          })
        }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])


      // Same implementation as useSyncExternalStore but with useEffect.
      // Subscribed once per mount: `select` is frozen from the first render
      // and the latest callbacks are read through `optionsRef`
      useEffect(() => {
        const subscription = store$$.subscribe({
          id: subscriberId,
          next: (sc) => {
            const storeChanges = Array.isArray(sc)
              ? sc as Array<StoreChange<StoreValue>>
              : [sc]

            const currentOptions = optionsRef.current

            if (!currentOptions?.select) {
              reRender()
              currentOptions?.onChange?.(storeChanges)

              return
            }

            if (storeChanges.some(nextChange => (
              nextChange.change.fieldPath === 'root'
                || (selectFieldPaths.current ?? []).includes(nextChange.change.fieldPath))
                || (selectedFieldPathsForNestedObjects.current ?? []).find(fp => nextChange.change.fieldPath.startsWith(fp)),
            )) {
              reRender()
              currentOptions?.onChange?.(storeChanges)
            }
          },
        })

        return () => {
          subscription.unsubscribe()
        }

      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      return proxiedStore
    },
  }
}
