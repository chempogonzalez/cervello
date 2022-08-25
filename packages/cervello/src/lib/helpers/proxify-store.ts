
import { deepClone, isEqualObject } from '../utils'

import type { BehaviorSubject } from 'rxjs'



const NESTED_ATTRIBUTES_SYMBOL = '$$p-a' // parent-attributes
const nestedAttrs = Symbol(NESTED_ATTRIBUTES_SYMBOL)

function assignNestedProperty (obj: any, keyPath: Array<string>, prop: string, value: unknown): any {
  keyPath.forEach((key) => { obj = obj[key] })
  obj[prop] = value
}

export function proxifyStore <T extends Record<string | symbol, any>> (store$$: BehaviorSubject<T>, storeObject: T, proxiedNestedObjectMap: any): T {
  if (typeof storeObject !== 'object') throw new Error('Store must be an object')

  return new Proxy<T>(
    storeObject,
    {
      get: function (target: T, prop: string | symbol): any {
        const currentStore = target
        const valueByProp = currentStore[prop]

        if (prop in currentStore) {
          if (typeof valueByProp === 'function') {
            return valueByProp.bind(proxifyStore(store$$, currentStore, proxiedNestedObjectMap))
          }

          // Return proxied object for nested reactivity
          if (valueByProp
            && typeof valueByProp === 'object'
            && !Array.isArray(valueByProp)
            && typeof prop !== 'symbol'
          ) {
            const currentNestedAttrs = target?.[nestedAttrs]
            const nestedAttrsPrefix = currentNestedAttrs ? `${currentNestedAttrs as string}.` : ''

            const cacheKey = `${nestedAttrsPrefix}-${prop}`
            if (proxiedNestedObjectMap[cacheKey]) return proxiedNestedObjectMap[cacheKey]

            const proxiedNestedObject = proxifyStore(
              store$$,
              Object.defineProperty(
                valueByProp,
                nestedAttrs,
                {
                  value: `${nestedAttrsPrefix}${prop}`,
                  enumerable: false,
                  writable: false,
                  configurable: false,
                },
              ),
              proxiedNestedObjectMap,
            )

            proxiedNestedObjectMap[cacheKey] = proxiedNestedObject

            return proxiedNestedObject
          }

          return valueByProp
        }

        return Reflect.get(target, prop)
      },
      set: function (target: T, prop: string | symbol, value: any) {
        const currentStore = store$$.getValue() as any
        const isNestedProp = Boolean(target[nestedAttrs]?.length)
        let clonedStore = deepClone<any>(currentStore)

        if (isNestedProp) {
          const nestedAttributes = (target[nestedAttrs] as string).split('.')
          assignNestedProperty(clonedStore, nestedAttributes, prop as string, value)
        } else {
          if (prop === '$value') clonedStore = value
          else clonedStore[prop] = value
        }

        if (!isEqualObject(currentStore, clonedStore)) {
          store$$.next(clonedStore)
        }

        return true
      },
    },
  )
}
