
import { useEffect, useId, useRef, useState } from 'react'

import { nonReactiveObjectSymbol } from '../../types/shared'
import { proxifyStore, RAW_VALUE } from '../helpers/new-proxify-store'
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

        // Compared against the raw value (not `$value`): contentComparer is
        // already cycle-safe, so this skips a second full deep clone per mount
        if (initialValue && !contentComparer(initialValue, (proxiedStore as any)[RAW_VALUE]))
          (proxiedStore as any).$$value = { id: subscriberId, newValue: initialValue }
      }

      // Version of the store this render is based on. Captured AFTER the
      // `initialValue` seed so the component's own seed does not re-trigger it
      const seenVersion = useRef(0)

      seenVersion.current = store$$.version()

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
        // The trailing dot is kept ('address.*' -> 'address.') so matching is
        // a single startsWith against the dotted changed path
        selectedFieldPathsForNestedObjects.current = selectFieldPaths.current
          .filter(fp => fp.includes('.*'))
          .map(fp => fp.replace('*', ''))
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
        // Both refs are frozen from the first render, so they can be captured
        // once per subscription instead of being re-read on every notification
        const selectedPaths = selectFieldPaths.current ?? []
        const wildcardPrefixes = selectedFieldPathsForNestedObjects.current ?? []

        // Changes flushed between the render and this effect (React yields
        // before the passive-effects task when a commit exceeds the frame
        // budget) were emitted before the subscription existed — recover them
        // with one re-render, since reads through the proxy are always live
        if (store$$.version() !== seenVersion.current) reRender()

        const subscription = store$$.subscribe({
          id: subscriberId,
          next: (storeChanges) => {
            const currentOptions = optionsRef.current

            if (!currentOptions?.select) {
              reRender()
              currentOptions?.onChange?.(storeChanges)

              return
            }

            if (storeChanges.some((nextChange) => {
              const changedPath = nextChange.change.fieldPath

              if (changedPath === 'root' || selectedPaths.includes(changedPath)) return true

              // 'address.*' (kept as 'address.') matches 'address' and
              // 'address.<nested>', but not a sibling field sharing the
              // prefix (e.g. 'addressLine')
              const dottedPath = `${changedPath}.`

              return wildcardPrefixes.some(fp => dottedPath.startsWith(fp))
            })) {
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
