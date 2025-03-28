import { isValidElement } from 'react'

import { nonReactiveObjectSymbol } from '../../types/shared'
import { deepClone, isObject } from '../utils/object'

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

      if (propName === 'toJSON') return () => target

      if (propName === '$value') return deepClone(target)

      const propertyValue = Reflect.get(target, propName, receiver)

      if (typeof propName === 'symbol') return propertyValue


      if (typeof propertyValue === 'function')
        return (propertyValue as () => any).bind(receiver)


      if (isValidReactiveObject(propertyValue)) {
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

      if (isRootTarget && key === '$value') {
        const previousValue = parentObject[ROOT_VALUE]

        if (value === previousValue) return true
        if (JSON.stringify(value) === JSON.stringify(parentObject[ROOT_VALUE])) return true

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


      if (previousValue === value)
        return true


      // New object values, check if the field has already a proxy created to use it instead of reacreating a new instance
      if (isObject(value) && !isValidElement(value) && !value[nonReactiveObjectSymbol] && previousValue._$fieldPath)
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


function isValidReactiveObject <T extends Record<string, any>> (value: T): boolean {
  return isObject(value) && !isValidElement(value) && !(value as any)[nonReactiveObjectSymbol]
}
