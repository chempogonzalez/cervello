
import { contentComparer, deepClone, isValidReactiveObject, safeToJson } from '../utils/object'

import type { StoreChange } from '../../types/shared'
import type { CacheableSubject } from '../utils/subject'



const ROOT_VALUE = Symbol('value')

// INFO: !Internal only.
// Read through a proxy of this store, returns the raw object it currently wraps
export const RAW_VALUE = Symbol('rawValue')


export function proxifyStore <T extends Record<string | symbol, any>> (
  store$$: CacheableSubject<StoreChange<T>>,
  objectToProxify: T,
  opts: {
    nestedFieldPath?: string
    parentObjectToProxify?: any
    afterChange?: (storeChange: Array<StoreChange<T>>) => void
  } = {},
): T {
  const fieldPath = opts.nestedFieldPath ?? 'root'

  // Emitted paths are root-relative: precomputing the prefix (dropping the
  // leading 'root.') avoids a string scan + replace on every write
  const emitPrefix = fieldPath === 'root' ? '' : `${fieldPath.slice(5)}.`

  const objectWithRootValue = {
    [ROOT_VALUE]: objectToProxify,
  } as unknown as T

  // Child proxies are cached here (keyed by property name) instead of being
  // written back into the raw data, so the store data never holds Proxy
  // instances and clones/serializations traverse plain objects without traps.
  // The raw value each proxy wraps is cached alongside it: revalidating with
  // `entry.raw` avoids re-entering the child's get trap on every read
  const childProxies = new Map<PropertyKey, { proxy: any, raw: any }>()

  // Created once per proxy (a fresh closure per read was allocated before);
  // reads the live root so it stays correct after `$value` replacement
  const toJson = (): any => safeToJson((objectWithRootValue as any)[ROOT_VALUE])

  // Bound functions are cached per raw function so repeated reads return the
  // same reference (stable identity for React deps) instead of re-binding on
  // every access. Keyed by the raw function: reassigning the property to a
  // different function re-binds automatically
  const boundFunctions = new WeakMap<(...args: Array<any>) => any, (...args: Array<any>) => any>()

  const rootFunctions = fieldPath === 'root'
    ? Object.fromEntries(Object.entries(objectToProxify).filter(([,v]) => typeof v === 'function'))
    : {}

  return new Proxy(objectWithRootValue, {
    get (targetObject, propName, receiver) {
      const target = targetObject[ROOT_VALUE]

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

      const propertyValue = target[propName]

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
        // Cache first: while the entry wraps the current raw value, repeated
        // reads keep the same proxy identity and skip every probe below
        const cachedEntry = childProxies.get(propName)

        if (cachedEntry !== undefined && cachedEntry.raw === propertyValue) return cachedEntry.proxy

        // Check if it's correct to be a reactive object
        // & is not a circular reference or the same object
        if (isValidReactiveObject(propertyValue) && propertyValue !== target) {
          // Proxy of this store injected as data by the user: return it untouched
          if (propertyValue[RAW_VALUE]) return propertyValue

          // Create a new proxified object
          const proxiedNestedObject = proxifyStore(
            store$$ as any,
            propertyValue,
            {
              nestedFieldPath: `${fieldPath}.${propName}`,
              parentObjectToProxify: opts.parentObjectToProxify ?? target,
              afterChange: opts.afterChange,
            },
          )

          childProxies.set(propName, { proxy: proxiedNestedObject, raw: propertyValue })

          return proxiedNestedObject
        }
      }

      return propertyValue
    },


    set (parentObject, key, newValue) {
      if (typeof key === 'symbol') return true

      // Keep raw data clean: if a proxy of this store is assigned as a value,
      // store the raw object it wraps instead of the Proxy instance (the
      // typeof guard lets primitive writes skip the symbol-prop lookup)
      const value = newValue !== null && typeof newValue === 'object'
        ? newValue[RAW_VALUE] ?? newValue
        : newValue

      // INFO: !Internal only.
      // Used to set the value of the store without notifying the current subscriber (value.id)
      if (key === '$$value') {
        const previousValue = parentObject[ROOT_VALUE];

        // Same merge as `$value`: top-level store functions are preserved when
        // the new value (e.g. from useStore's initialValue) does not include them
        (parentObject as any)[ROOT_VALUE] = Object.assign({}, rootFunctions, value.newValue)
        childProxies.clear()

        const seedChange = {
          storeValue: parentObject[ROOT_VALUE],
          change: {
            fieldPath: 'root' as any,
            newValue: value.newValue,
            previousValue,
          },
        }

        store$$.next(seedChange, value.id)
        opts.afterChange?.([seedChange])

        return true
      }

      if (key === '$value') {
        const previousValue = parentObject[ROOT_VALUE]

        if (value === previousValue) return true

        if (contentComparer(value, previousValue)) return true

        if (fieldPath !== 'root') {
          (parentObject as any)[ROOT_VALUE] = value
          childProxies.clear()
        } else {
          // Object.assign instead of spread: it avoids shipping Babel's
          // `_extends` helper in the bundle
          (parentObject as any)[ROOT_VALUE] = Object.assign({}, rootFunctions, value)
          childProxies.clear()

          const rootChange = {
            // To be disabled for performance and send same store reference
            // storeValue: JSON.parse(JSON.stringify(targetObject[ROOT_VALUE])),
            storeValue: parentObject[ROOT_VALUE],
            change: {
              fieldPath: 'root' as any,
              newValue: value,
              previousValue,
            },
          }

          store$$.next(rootChange)
          opts.afterChange?.([rootChange])
        }

        return true
      }

      const realInnerObject = parentObject[ROOT_VALUE]
      const previousValue = realInnerObject[key]


      if (previousValue === value) return true

      const existingEntry = childProxies.get(key)

      // New object values, check if the field has already a proxy created to use it instead of recreating a new instance
      if (isValidReactiveObject(value) && existingEntry) {
        existingEntry.proxy.$value = value

        const newRaw = existingEntry.proxy[RAW_VALUE]

        // Same contract as `$value`: the child keeps its previous raw object
        // when the new value is content-equal, so nothing changed — skip the
        // write and the (previously spurious) notification
        if (newRaw === previousValue) return true

        existingEntry.raw = newRaw
        realInnerObject[key] = newRaw
      } else {
        if (existingEntry) childProxies.delete(key)
        realInnerObject[key] = value
      }


      const nextStoreChange = {
        // To be disabled for performance and send same store reference
        // storeValue: JSON.parse(JSON.stringify(opts?.parentObjectToProxify ?? target)),
        storeValue: opts?.parentObjectToProxify ?? realInnerObject,
        change: {
          fieldPath: (emitPrefix + key) as any,
          newValue: value,
          previousValue,
        },
      }

      store$$.next(nextStoreChange)
      opts.afterChange?.([nextStoreChange])

      return true
    },

    has (t, p) {
      return Reflect.has(t[ROOT_VALUE], p)
    },

    ownKeys (t) {
      return Reflect.ownKeys(t[ROOT_VALUE])
    },

    getOwnPropertyDescriptor (t, p) {
      return Reflect.getOwnPropertyDescriptor(t[ROOT_VALUE], p)
    },

  })
}
