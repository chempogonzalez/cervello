
import { contentComparer, deepClone, isValidReactiveObject, safeToJson } from '../utils/object'

import type { StoreChange } from '../../types/shared'
import type { CacheableSubject } from '../utils/subject'



const ROOT_VALUE = Symbol('value')

// INFO: !Internal only.
// Read through a proxy of this store, returns the raw object it currently wraps
const RAW_VALUE = Symbol('rawValue')


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

  const objectWithRootValue = {
    [ROOT_VALUE]: objectToProxify,
  } as unknown as T

  // Child proxies are cached here (keyed by property name) instead of being
  // written back into the raw data, so the store data never holds Proxy
  // instances and clones/serializations traverse plain objects without traps
  const childProxies = new Map<PropertyKey, any>()

  const rootFunctions = fieldPath === 'root'
    ? Object.fromEntries(Object.entries(objectToProxify).filter(([,v]) => typeof v === 'function'))
    : {}

  return new Proxy(objectWithRootValue, {
    get (targetObject, propName, receiver) {
      // INFO: !Internal only.
      // Used to get the fieldPath of the object (it means it's a proxified object)
      if (propName === '_$fieldPath') return fieldPath

      const target = targetObject[ROOT_VALUE]

      if (propName === RAW_VALUE) return target

      // Called when the object is converted to JSON or string (i.e. JSON.stringify)
      if (propName === 'toJSON') {
        return () => {
          // Remove react-elements with circular which have circular references
          // before stringifying to prevent JSON.stringify(storeProxy) from failing
          return safeToJson(target)
        }
      }

      // Get the whole store value without proxies
      if (propName === '$value')
        return deepClone(target)



      const propertyValue = Reflect.get(target, propName, receiver)

      if (typeof propName === 'symbol') return propertyValue

      if (typeof propertyValue === 'function')
        return (propertyValue as () => any).bind(receiver)


      // Check if it's correct to be a reactive object
      // & is not a circular reference or the same object
      if (isValidReactiveObject(propertyValue) && propertyValue !== target) {
        // Proxy of this store injected as data by the user: return it untouched
        if (propertyValue[RAW_VALUE]) return propertyValue

        // Reuse the cached proxy while it wraps the current raw value, so the
        // reference identity is kept between accesses
        const cachedProxy = childProxies.get(propName)

        if (cachedProxy?.[RAW_VALUE] === propertyValue) return cachedProxy

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

        childProxies.set(propName, proxiedNestedObject)

        return proxiedNestedObject
      }

      return propertyValue
    },


    set (parentObject, key, newValue, receiver) {
      if (typeof key === 'symbol') return true

      // Keep raw data clean: if a proxy of this store is assigned as a value,
      // store the raw object it wraps instead of the Proxy instance
      const value = newValue?.[RAW_VALUE] ?? newValue

      // INFO: !Internal only.
      // Used to set the value of the store without notifying the current subscriber (value.id)
      if (key === '$$value') {
        const previousValue = parentObject[ROOT_VALUE];

        // Same merge as `$value`: top-level store functions are preserved when
        // the new value (e.g. from useStore's initialValue) does not include them
        (parentObject as any)[ROOT_VALUE] = Object.assign({}, rootFunctions, value.newValue)
        childProxies.clear()

        store$$.next({
          storeValue: parentObject[ROOT_VALUE],
          change: {
            fieldPath: 'root' as any,
            newValue: value.newValue,
            previousValue,
          },
        }, value.id)

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
          store$$.next({
            // To be disabled for performance and send same store reference
            // storeValue: JSON.parse(JSON.stringify(targetObject[ROOT_VALUE])),
            storeValue: parentObject[ROOT_VALUE],
            change: {
              fieldPath: 'root' as any,
              newValue: value,
              previousValue,
            },
          })
        }

        return true
      }

      const realInnerObject = parentObject[ROOT_VALUE]
      const previousValue = Reflect.get(realInnerObject, key, receiver)


      if (previousValue === value) return true

      const existingChildProxy = childProxies.get(key)

      // New object values, check if the field has already a proxy created to use it instead of recreating a new instance
      if (isValidReactiveObject(value) && existingChildProxy) {
        existingChildProxy.$value = value
        // Point the raw slot to whatever the child proxy wraps now (it keeps
        // its previous raw object when the new value is content-equal)
        Reflect.set(realInnerObject, key, existingChildProxy[RAW_VALUE], realInnerObject)
      } else {
        if (existingChildProxy) childProxies.delete(key)
        Reflect.set(realInnerObject, key, value, realInnerObject)
      }


      const nextStoreChange = {
        // To be disabled for performance and send same store reference
        // storeValue: JSON.parse(JSON.stringify(opts?.parentObjectToProxify ?? target)),
        storeValue: opts?.parentObjectToProxify ?? realInnerObject,
        change: {
          fieldPath: `${fieldPath}.${key}`.replace('root.', '') as any,
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
