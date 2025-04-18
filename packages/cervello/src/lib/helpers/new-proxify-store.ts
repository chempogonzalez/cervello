import { isValidElement } from 'react'

import { nonReactiveObjectSymbol } from '../../types/shared'
import { isObject } from '../utils/object'

import type { StoreChange } from '../../types/shared'
import type { CacheableSubject } from '../utils/subject'



// @ts-expect-error - Object.hasOwn is not defined in older Safari's browsers
('hasOwn' in Object) || (Object.hasOwn = Object.call.bind(Object.hasOwnProperty))

const ROOT_VALUE = Symbol('value')


export function proxifyStore <T extends Record<string | symbol, any>> (
  store$$: CacheableSubject<StoreChange<T>>,
  objectToProxify: T,
  opts: {
    nestedFieldPath?: string
    parentObjectToProxify?: any
    // beforeChange?: (storeChange: StoreChange<T>) => any
    afterChange?: (storeChange: Array<StoreChange<T>>) => void
  } = {},
): T {
  const fieldPath = opts.nestedFieldPath ?? 'root'

  const objectWithRootValue = {
    [ROOT_VALUE]: objectToProxify,
  } as unknown as T

  const rootFunctions = fieldPath === 'root'
    ? Object.fromEntries(Object.entries(objectToProxify).filter(([,v]) => typeof v === 'function'))
    : {}

  return new Proxy(objectWithRootValue, {
    get (targetObject, propName, receiver) {
      if (propName === '_$fieldPath') return fieldPath

      const isRootTarget = Object.hasOwn(targetObject, ROOT_VALUE)
      const target = isRootTarget ? targetObject[ROOT_VALUE] : targetObject

      if (propName === 'toJSON') {
        return () => {
          // Remove circular references before stringifying
          // to prevent JSON.stringify(storeProxy) from failing
          return removeCircularReferences(target)
        }
      }

      if (propName === '$value') {
        // return deepClone(target)
        // return getUnproxiedObject(target)
        return target
      }

      const propertyValue = Reflect.get(target, propName, receiver)

      if (typeof propName === 'symbol') return propertyValue


      if (typeof propertyValue === 'function')
        return (propertyValue as () => any).bind(receiver)


      // Check if it's correct to be a reactive object
      // & is not a circular reference or the same object
      if (isValidReactiveObject(propertyValue) && propertyValue !== target) {
        const newNestedFieldPath = `${fieldPath}.${propName}`


        if (propertyValue._$fieldPath === newNestedFieldPath) return propertyValue

        const proxiedNestedObject = proxifyStore(
          store$$ as any,
          propertyValue,
          {
            nestedFieldPath: newNestedFieldPath,
            parentObjectToProxify: opts.parentObjectToProxify ?? target,
            // beforeChange: opts.beforeChange,
            afterChange: opts.afterChange,
          },
        )

        return target[propName] = proxiedNestedObject
      }

      return propertyValue
    },


    set (parentObject, key, newValue, receiver) {
      if (typeof key === 'symbol') return true

      const value = newValue
      const isRootTarget = Object.hasOwn(parentObject, ROOT_VALUE)

      // INFO: Internal only.
      // This is used to set the value of the store without notifying the store
      if (isRootTarget && key === '$$value') {
        (parentObject as any)[ROOT_VALUE] = value

        return true
      }

      if (isRootTarget && key === '$value') {
        const previousValue = parentObject[ROOT_VALUE]

        if (value === previousValue) return true

        if (safeStringify(value) === safeStringify(previousValue)) return true
        // if (JSON.stringify(value) === JSON.stringify(previousValue)) return true

        if (fieldPath !== 'root') {
          (parentObject as any)[ROOT_VALUE] = value
        } else {
          (parentObject as any)[ROOT_VALUE] = {
            ...rootFunctions,
            ...value,
          }
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

      const realInnerObject = isRootTarget ? parentObject[ROOT_VALUE] : parentObject
      const previousValue = Reflect.get(realInnerObject, key, receiver)


      if (previousValue === value) return true


      // New object values, check if the field has already a proxy created to use it instead of reacreating a new instance
      if (isObject(value) && !isValidElement(value) && !value[nonReactiveObjectSymbol] && previousValue?._$fieldPath)
        previousValue.$value = value
      else
        Reflect.set(realInnerObject, key, value, realInnerObject)


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

//
// function getUnproxiedObject (obj: any): any {
//   if (obj && typeof obj === 'object') {
//     if (obj[ROOT_VALUE]?.[ROOT_VALUE]) return '[Circular reference]'
//
//     // Check if the object is a proxy
//     if (obj[ROOT_VALUE])
//       return getUnproxiedObject(obj[ROOT_VALUE])
//
//
//     // If it's not a proxy, return the object itself
//     return obj
//   }
//
//   // If it's not an object, return it as is
//   return obj
// }



function isValidReactiveObject <T extends Record<string, any>> (value: T): boolean {
  return isObject(value) && !isValidElement(value) && !(value as any)[nonReactiveObjectSymbol]
}

function safeStringify (obj: any): string {
  // use removeCircularReferences to avoid circular references
  const cleanedObj = removeCircularReferences(obj)

  return JSON.stringify(
    cleanedObj,
    (_key, value) => {
      if (isValidElement(value))
        return { props: safeStringify(value.props), type: value.type }

      return value
    })
}

function removeCircularReferences (obj: any): any {
  const seen = new WeakSet()

  function traverse (value: any): any {
    if (value && typeof value === 'object') {
      // If the object has already been seen, it's a circular reference
      if (seen.has(value))
        return null

      seen.add(value)

      if (Array.isArray(value))
        return value.map(traverse)


      const result: any = {}

      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key))
          result[key] = traverse(value[key])
      }

      return result
    }

    // Return primitive values as-is
    return value
  }

  return traverse(obj)
}
