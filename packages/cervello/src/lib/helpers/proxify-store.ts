import { deepClone, isObject, okTarget } from '../utils'
import { INTERNAL_VALUE_PROP } from './constants'

import type { CacheableSubject } from '../utils/subject'



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

      const propertyValue = Reflect.get(target, prop)

      if (shouldProxifyNestedObj && isObject(propertyValue)) {
        /**  Check if cached to return instead of re-create new proxy */
        const cachedValue = proxiedNestedObjectMap[prop]
        if (cachedValue) return cachedValue

        const proxied = proxifyStore(store$$ as any, propertyValue, proxiedNestedObjectMap, shouldProxifyNestedObj)
        // const proxied = proxifyStore(store$$ as any, { $$value$$: propertyValue }, proxiedNestedObjectMap, shouldProxifyNestedObj)


        /**  Store in cache the proxiedObject */
        proxiedNestedObjectMap[prop] = proxied

        return proxied
      }


      return propertyValue
    },



    set (t, prop, value) {
      const isRootTarget = Object.hasOwn(t, INTERNAL_VALUE_PROP)

      /** Reset store */
      if (prop === '$value' && isRootTarget) {
        const newValue = deepClone(value)
        proxiedNestedObjectMap = {}
        Reflect.set(t, INTERNAL_VALUE_PROP, newValue)
        store$$.next(newValue)
        return true
      }

      const target = okTarget(t)
      const propValue = Reflect.get(target, prop)

      /**  If new value is the same as the current one */
      if (propValue === value) return true


      /**  Set value to target reference */
      Reflect.set(target, prop, value)

      /**
       * Override nested proxied object in
       * cache proxying the new value passed in
       */
      if (shouldProxifyNestedObj && isObject(propValue) && proxiedNestedObjectMap[prop]) {
        // TODO: check if --- proxiedNestedObjectMap[prop].$value = value --- is possible instead of recreating new nested
        // proxiedNestedObjectMap[prop].$value = value
        const proxied = proxifyStore(store$$ as any, value, proxiedNestedObjectMap, shouldProxifyNestedObj)
        proxiedNestedObjectMap[prop] = proxied
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
