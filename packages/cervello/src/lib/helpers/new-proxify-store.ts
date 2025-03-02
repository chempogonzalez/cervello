import { isValidElement } from 'react'

import { nonReactiveObjectSymbol } from '../../types/shared'
import { deepClone, isObject } from '../utils/object'

import type { StoreChange } from '../../types/shared'
import type { CacheableSubject } from '../utils/subject'



// @ts-expect-error - Object.hasOwn is not defined in older Safari's browsers
('hasOwn' in Object) || (Object.hasOwn = Object.call.bind(Object.hasOwnProperty))

const ROOT_VALUE = Symbol('value')
// const FIELD_PATH = Symbol('field-path')


export function proxifyStore <T extends Record<string | symbol, any>> (
  store$$: CacheableSubject<StoreChange<T>>,
  objectToProxify: T,
  proxies: Map<string, T & { $value: T }>,
  opts: {
    nestedFieldPath?: string
    parentObjectToProxify?: any
    beforeChange?: (storeChange: StoreChange<T>) => any
    afterChange?: (storeChange: Array<StoreChange<T>>) => void
  } = { },
): T {
  const fieldPath = opts.nestedFieldPath ?? 'root'
  const objectWithRootValue = {
    [ROOT_VALUE]: objectToProxify,
    // [FIELD_PATH]: fieldPath,
  } as unknown as T

  const rootFunctions = fieldPath === 'root'
    ? Object.fromEntries(Object.entries(objectToProxify).filter(([,v]) => typeof v === 'function'))
    : {}


  // console.log('  - value proxify -> () >', { fieldPath, objectToProxify, objectWithRootValue })

  return new Proxy(objectWithRootValue, {
    get (targetObject, propName, receiver) {
      const isRootTarget = Object.hasOwn(targetObject, ROOT_VALUE)
      const target = isRootTarget ? targetObject[ROOT_VALUE] : targetObject

      // console.log('  - value get -> () >', { propName, targetObject, target })

      if (propName === 'toJSON') return () => target

      if (propName === '$value') return deepClone(target)
      const propertyValue = Reflect.get(target, propName, receiver)

      if (typeof propName === 'symbol') return propertyValue


      if (typeof propertyValue === 'function')
        return (propertyValue as () => any).bind(receiver)


      // console.log('(GET)nonReactiveObjectSymbol?', {propName},propertyValue[nonReactiveObjectSymbol], targetObject)
      if (isObject(propertyValue) && !isValidElement(propertyValue) && !propertyValue[nonReactiveObjectSymbol]) {
        const newNestedFieldPath = `${fieldPath}.${propName}`

        if (proxies.has(newNestedFieldPath)) return proxies.get(newNestedFieldPath)

        const proxiedNestedObject = proxifyStore(
          store$$ as any,
          propertyValue as any,
          proxies,
          {
            nestedFieldPath: `${fieldPath}.${propName}`,
            parentObjectToProxify: opts.parentObjectToProxify ?? target,
            beforeChange: opts.beforeChange,
            afterChange: opts.afterChange,
          },
        )

        proxies.set(newNestedFieldPath, proxiedNestedObject as any)

        return proxiedNestedObject
      }

      return propertyValue
    },


    set (targetObject, propName, newValue, receiver) {
      if (typeof propName === 'symbol') return true

      const value = newValue
      // const value = opts.beforeChange
      //   ? opts.beforeChange({
      //     change: {
      //       fieldPath: `${fieldPath}.${propName}`,
      //       newValue,
      //       previousValue: Reflect.get(receiver, propName, receiver),
      //     },
      //     storeValue: targetObject[ROOT_VALUE],
      //   }) ?? newValue
      //   : newValue

      // console.log('  - value set -> () >', { propName, value, targetObject })
      const isRootTarget = Object.hasOwn(targetObject, ROOT_VALUE)

      if (isRootTarget && propName === '$value') {
        const previousValue = targetObject[ROOT_VALUE]

        if (value === previousValue) return true
        if (JSON.stringify(value) === JSON.stringify(targetObject[ROOT_VALUE])) return true

        ;(targetObject as any)[ROOT_VALUE] = value
        // Not needed here ?  (if not root)
        // !! proxies.clear();

        if (fieldPath === 'root') {
          proxies.clear();
          // Ensure predefined functions are kept
          (targetObject as any)[ROOT_VALUE] = {
            ...rootFunctions,
            ...value,
          }
          store$$.next({
            // To be disabled for performance and send same store reference
            // storeValue: JSON.parse(JSON.stringify(targetObject[ROOT_VALUE])),
            storeValue: targetObject[ROOT_VALUE],
            change: {
              fieldPath: 'root',
              newValue: value,
              previousValue,
            },
          })
        }

        return true
      }

      const target = isRootTarget ? targetObject[ROOT_VALUE] : targetObject
      const previousValue = Reflect.get(target, propName, receiver)


      if (previousValue === value)
        return true


      // console.log('  - value set -> () >', { value: JSON.stringify({ value }), target: JSON.stringify(target) })

      // console.log('nonReactiveObjectSymbol?', {propName},target[nonReactiveObjectSymbol], targetObject)
      if (isObject(value) && !isValidElement(value) && !value[nonReactiveObjectSymbol]) {
        const newNestedFieldPath = `${fieldPath}.${propName}`

        if (!proxies.has(newNestedFieldPath)) {
          const proxiedNestedObject = proxifyStore(
            store$$ as any,
            value as any,
            proxies,
            {
              nestedFieldPath: `${fieldPath}.${propName}`,
              parentObjectToProxify: opts.parentObjectToProxify ?? target,
              beforeChange: opts.beforeChange,
              afterChange: opts.afterChange,
            },
          )

          proxies.set(newNestedFieldPath, proxiedNestedObject as any)
        } else {
          const proxiedNestedObject = proxies.get(newNestedFieldPath)!

          if (proxiedNestedObject === value) return true
          if (JSON.stringify(proxiedNestedObject) === JSON.stringify(value)) return true

          // console.log('  - value set -> () >', { fieldPath, propName, value, previousValue, target })

          // Clear all nested fields' proxies before setting new value
          for (const key of proxies.keys()) {
            if (key.startsWith(newNestedFieldPath) && key !== newNestedFieldPath)
              proxies.delete(key)
          }

          proxiedNestedObject.$value = value as any
        }
      }

      // console.log('  *- value set -> () >', { fieldPath, propName, value, previousValue, target })
      Reflect.set(target, propName, value, target)

      const nextStoreChange = {
        // To be disabled for performance and send same store reference
        // storeValue: JSON.parse(JSON.stringify(opts?.parentObjectToProxify ?? target)),
        storeValue: opts?.parentObjectToProxify ?? target,
        change: {
          fieldPath: `${fieldPath}.${propName}`,
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
