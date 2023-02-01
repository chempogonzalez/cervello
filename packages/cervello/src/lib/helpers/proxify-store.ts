/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-dynamic-delete */
import { deepClone, isObject, okTarget } from '../utils'
import { INTERNAL_VALUE_PROP } from './constants'

import type { CacheableSubject } from '../utils/subject'



const nestedPath = Symbol.for('nestedPath')




export function proxifyStore <T> (store$$: CacheableSubject<T>, objectToProxify: T, proxiedNestedObjectMap: any, shouldProxifyNestedObj: boolean): T

export function proxifyStore <T extends Record<string | symbol, any>> (
  store$$: CacheableSubject<T>,
  objectToProxify: T,
  proxiedNestedObjectMap: any,
  shouldProxifyNestedObj: boolean,
): T {
  if (typeof objectToProxify !== 'object') throw new Error('Store must be an object')

  /**  Proxify object and push value to subject */
  return new Proxy(objectToProxify, {
    get (t, prop) {
      const target = okTarget(t)

      /**
       * Return actual object when toJSON
       * is called instead of $$value$$
       */
      if (prop === 'toJSON') return () => target

      const propertyValue = target[prop]

      if (shouldProxifyNestedObj && isObject(propertyValue) && typeof prop !== 'symbol') {
        const isRootTarget = Object.hasOwn(t, INTERNAL_VALUE_PROP)
        const propNestedPath = isRootTarget ? prop : `${target[nestedPath]}.${prop}`

        /**  Check if cached to return instead of re-create new proxy */
        const cachedValue = proxiedNestedObjectMap[propNestedPath]
        if (cachedValue) return cachedValue

        /**  Set the nestedPath symbol to keep track of proxied */
        propertyValue[nestedPath] = propNestedPath

        const proxied = proxifyStore(store$$ as any, propertyValue, proxiedNestedObjectMap, shouldProxifyNestedObj)


        /**  Store in cache the proxiedObject */
        proxiedNestedObjectMap[propNestedPath] = proxied

        return proxied
      }


      return propertyValue
    },



    set (t, prop, newValue) {
      const isRootTarget = Object.hasOwn(t, INTERNAL_VALUE_PROP)

      /** Reset store */
      if (prop === '$value' && isRootTarget) {
        const newClonedValue = deepClone(newValue)
        proxiedNestedObjectMap = {}
        Reflect.set(t, INTERNAL_VALUE_PROP, newClonedValue)
        store$$.next(newClonedValue)
        return true
      }


      const target = okTarget(t)
      const propValue = target[prop]

      /**  If new value is the same as the current one */
      if (propValue === newValue) return true

      /**
       * Override nested proxied object in
       * cache proxying the new value passed in
      */
      if (shouldProxifyNestedObj && isObject(newValue) && typeof prop !== 'symbol') {
        // TODO: check if --- proxiedNestedObjectMap[prop].$value = value --- is possible instead of recreating new nested
        // proxiedNestedObjectMap[prop].$value = value

        const propNestedPath = isRootTarget ? prop : `${target[nestedPath]}.${prop}`
        const newClonedValue = deepClone(newValue)

        newClonedValue[nestedPath] = propNestedPath

        const proxied = proxifyStore(store$$ as any, newClonedValue, proxiedNestedObjectMap, shouldProxifyNestedObj)

        // Remove nested object props from cache
        // nestedPath: 'a.b.c': remove -> 'a.b.c.d' -> 'a.b.c.d.e'
        Object.keys(proxiedNestedObjectMap).forEach((cachedProxyKey: string) => {
          if (cachedProxyKey.startsWith(propNestedPath)) delete proxiedNestedObjectMap[cachedProxyKey]
        })

        proxiedNestedObjectMap[propNestedPath] = proxied

        target[prop] = newClonedValue
      } else {
        target[prop] = newValue
      }

      /** Push new store object (new reference for immutability) */
      store$$.next(Object.assign({}, store$$.getValue()))

      return true
    },




    has (t, p) {
      return Reflect.has(okTarget(t), p)
    },

    ownKeys (t) {
      return Reflect.ownKeys(okTarget(t))
    },

    getOwnPropertyDescriptor (t, p) {
      return Reflect.getOwnPropertyDescriptor(okTarget(t), p)
    },



  }) as any
}
