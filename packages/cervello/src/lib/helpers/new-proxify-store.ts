
import { contentComparer, deepClone, isValidReactiveObject, safeToJson } from '../utils/object'

import type { StoreChange } from '../../types/shared'
import type { CacheableSubject } from '../utils/subject'



// INFO: !Internal only.
// Read through a proxy of this store, returns the raw object it currently wraps
export const RAW_VALUE = Symbol('rawValue')


export function proxifyStore <T extends Record<string | symbol, any>> (
  store$$: CacheableSubject<StoreChange<T>>,
  objectToProxify: T,
  opts: {
    nestedFieldPath?: string
    // Nested proxies only: the parent's `live` resolver, the parent proxy
    // itself and the key this proxy sits under
    parent?: () => any
    parentProxy?: any
    key?: PropertyKey
    // Live raw of the whole store (for `storeValue` in emitted changes)
    rootRaw?: () => any
    afterChange?: (storeChange: Array<StoreChange<T>>) => void
  } = {},
): T {
  const fieldPath = opts.nestedFieldPath ?? 'root'
  const isRoot = opts.parent === undefined
  const key = opts.key as PropertyKey

  // Emitted paths are root-relative: precomputing the prefix (dropping the
  // leading 'root.') avoids a string scan + replace on every write
  const emitPrefix = isRoot ? '' : `${fieldPath.slice(5)}.`

  // The Proxy target is just a shell: the data lives in the `raw` closure
  const shell = {} as unknown as T

  // Child proxies are cached here (keyed by property name) instead of being
  // written back into the raw data, so the store data never holds Proxy
  // instances. Entries are never dropped: a child proxy is a live view of
  // `parent[key]` (see `resolveRaw`), so its identity survives reassigning the
  // field and even replacing the whole store. The raw the slot held when the
  // entry was last refreshed is kept for the read fast path
  const childProxies = new Map<PropertyKey, { proxy: any, raw: any }>()

  // Raw object this proxy currently wraps (the root's is the whole store)
  let raw: any = objectToProxify
  let isDetached = false
  // Store version a nested proxy last resolved its slot at
  // every store mutation bumps it, so while it is unchanged `raw` is still the live one
  // and reads pay a single property compare (no call)
  let seenVersion = -1

  // Cold path (nested proxies, after a store write)
  // re-read the slot on the parent's live raw.
  // When the field, an ancestor or the whole store
  // ($value / reset / initialValue seed) was reassigned, a captured handle
  // keeps reading and writing the live data instead of a disconnected
  // object. Proxies of this store injected as data (e.g.
  // `store.a = { ...store.a }` spreads child proxies) are healed on the way
  const revalidate = (): void => {
    // Set before walking
    // healing a proxy reads through its traps, which may
    // resolve back into this one (self or mutual injection) — the re-entry
    // then sees an up-to-date version and answers with the current raw
    seenVersion = store$$.state.version

    // The root IS the live data: nothing to walk (keeps the hot-path check
    // below free of an `isRoot` branch)
    if (isRoot) return

    const parent = opts.parent!()
    let liveValue = parent === undefined ? undefined : parent[key]

    if (liveValue !== raw && isValidReactiveObject(liveValue)) {
      const injected = liveValue[RAW_VALUE]

      if (injected) parent[key] = liveValue = injected

      raw = liveValue
    }

    // The slot no longer holds an object (null, primitive, array,
    // nonReactive, React element) or an ancestor is gone
    isDetached = liveValue !== raw
  }

  const resolveRaw = (): any => {
    if (store$$.state.version !== seenVersion) revalidate()

    return raw
  }

  // Same as `resolveRaw` but undefined when this path no longer exists in the store
  // writes through a detached proxy are dropped instead of emitting a
  // change that is not in the store
  const liveRawObject = (): any => {
    const value = resolveRaw()

    return isDetached ? undefined : value
  }

  const rootRaw = opts.rootRaw ?? ((): any => raw)

  // Created once per proxy (a fresh closure per read was allocated before)
  const toJson = (): any => safeToJson(resolveRaw())

  // Bound functions are cached per raw function so repeated reads return the
  // same reference (stable identity for React deps) instead of re-binding on
  // every access. Keyed by the raw function: reassigning the property to a
  // different function re-binds automatically
  const boundFunctions = new WeakMap<(...args: Array<any>) => any, (...args: Array<any>) => any>()

  const rootFunctions = isRoot
    ? Object.fromEntries(Object.entries(objectToProxify).filter(([,v]) => typeof v === 'function'))
    : {}

  const emit = (change: StoreChange<T>): void => {
    store$$.next(change)
    opts.afterChange?.([change])
  }

  return new Proxy(shell, {
    get (_, propName, receiver) {
      // Inlined `resolveRaw()`: this is the hottest path of the library
      if (store$$.state.version !== seenVersion) revalidate()

      const target = raw

      if (typeof propName === 'symbol') {
        if (propName === RAW_VALUE) return target

        return target[propName]
      }

      // INFO: !Internal only.
      // Used to get the fieldPath of the object (it means it's a proxified object)
      if (propName === '_$fieldPath') return fieldPath

      // Called when the object is converted to JSON or string (i.e. JSON.stringify).
      // safeToJson removes react-elements with circular references before
      // stringifying to prevent JSON.stringify(storeProxy) from failing
      if (propName === 'toJSON') return toJson

      // Get the whole store value without proxies
      if (propName === '$value')
        return deepClone(target)

      let propertyValue = target[propName]

      if (typeof propertyValue === 'function') {
        let boundFunction = boundFunctions.get(propertyValue)

        if (!boundFunction) {
          // Bound to the proxy (receiver), so `this.prop` inside store
          // functions keeps reading/writing through the traps (reactive)
          boundFunction = (propertyValue as () => any).bind(receiver)
          boundFunctions.set(propertyValue, boundFunction)
        }

        return boundFunction
      }

      if (propertyValue !== null && typeof propertyValue === 'object') {
        const entry = childProxies.get(propName)

        if (entry !== undefined && entry.raw === propertyValue) return entry.proxy

        // Check if it's correct to be a reactive object
        // & is not a circular reference or the same object
        if (isValidReactiveObject(propertyValue) && propertyValue !== target) {
          // Proxy of this store injected as data by the user: heal the slot
          // with the raw object it wraps, so the store data stays Proxy-free
          const injectedProxy = propertyValue[RAW_VALUE]

          if (injectedProxy) target[propName] = propertyValue = injectedProxy

          // Reassigned field: keep the child's identity (it resolves the new
          // raw on its own) and just refresh the fast-path key
          if (entry !== undefined) {
            entry.raw = propertyValue

            return entry.proxy
          }

          const child = proxifyStore(
            store$$ as any,
            propertyValue,
            {
              nestedFieldPath: `${fieldPath}.${propName}`,
              parent: liveRawObject,
              parentProxy: receiver,
              key: propName,
              rootRaw,
              afterChange: opts.afterChange,
            },
          )

          childProxies.set(propName, { proxy: child, raw: propertyValue })

          return child
        }
      }

      return propertyValue
    },


    set (_, propName, newValue) {
      if (typeof propName === 'symbol') return true

      // Keep raw data clean: if a proxy of this store is assigned as a value,
      // store the raw object it wraps instead of the Proxy instance (the
      // typeof guard lets primitive writes skip the symbol-prop lookup)
      const value = newValue !== null && typeof newValue === 'object'
        ? newValue[RAW_VALUE] ?? newValue
        : newValue

      // INFO: !Internal only.
      // Used to set the value of the store without notifying the current subscriber (value.id)
      if (propName === '$$value' && isRoot) {
        const previousValue = raw

        // Same merge as `$value`: top-level store functions are preserved when
        // the new value (e.g. from useStore's initialValue) does not include them
        raw = Object.assign({}, rootFunctions, deepClone(value.newValue))

        const seedChange = {
          storeValue: raw,
          change: {
            fieldPath: 'root' as any,
            newValue: value.newValue,
            previousValue,
          },
        }

        store$$.next(seedChange, value.id)

        // Seeds are render-phase writes (useStore's initialValue): the hook is
        // deferred so user code never runs inside a React render
        if (opts.afterChange) queueMicrotask(() => { opts.afterChange!([seedChange]) })

        return true
      }

      if (propName === '$value') {
        // Nested: replacing this object is a plain write into the parent
        if (!isRoot) {
          opts.parentProxy[key] = value

          return true
        }

        const previousValue = raw

        if (value === previousValue || contentComparer(value, previousValue)) return true

        // Cloned like the initial value: the store never aliases the caller's
        // object and any proxies spread into it (`{ ...store }`) are unwrapped.
        // Object.assign instead of spread: it avoids shipping Babel's
        // `_extends` helper in the bundle
        raw = Object.assign({}, rootFunctions, deepClone(value))

        emit({
          storeValue: raw,
          change: {
            fieldPath: 'root' as any,
            newValue: value,
            previousValue,
          },
        })

        return true
      }

      const validRawObject = liveRawObject()

      // Detached handle (its path is gone from the store): drop the write
      if (validRawObject === undefined) return true

      const previousValue = validRawObject[propName]

      if (previousValue === value) return true

      // Content-equal object writes are no-ops (arrays, nonReactive objects
      // and React elements always notify)
      if (isValidReactiveObject(value) && contentComparer(value, previousValue)) return true

      validRawObject[propName] = value

      emit({
        storeValue: rootRaw(),
        change: {
          fieldPath: (emitPrefix + propName) as any,
          newValue: value,
          previousValue,
        },
      })

      return true
    },

    has (_, p) {
      return Reflect.has(resolveRaw(), p)
    },

    ownKeys () {
      return Reflect.ownKeys(resolveRaw())
    },

    getOwnPropertyDescriptor (_, p) {
      return Reflect.getOwnPropertyDescriptor(resolveRaw(), p)
    },

  })
}
