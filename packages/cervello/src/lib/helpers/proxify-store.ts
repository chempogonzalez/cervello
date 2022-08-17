
import type { BehaviorSubject } from 'rxjs'



const NESTED_ATTRIBUTES_SYMBOL = '$$nested-attributes'
const nestedAttrs = Symbol(NESTED_ATTRIBUTES_SYMBOL)

function assignNestedProperty (obj: any, keyPath: Array<string>, prop: string, value: unknown): any {
  keyPath.forEach((key) => { obj = obj[key] })
  obj[prop] = value
}

export function proxifyStore <T extends Record<string | symbol, any>> (store$$: BehaviorSubject<T>, storeObject: T): T {
  if (typeof storeObject !== 'object') throw new Error('Store must be an object')

  return new Proxy<T>(
    storeObject,
    {
      get: function (target: T, prop: string | symbol): any {
        const currentStore = target as any

        if (prop in currentStore) {
          if (typeof currentStore[prop] === 'function') {
            return currentStore[prop].bind(proxifyStore(store$$, currentStore))
          }

          // Return proxied object for nested reactivity
          if (currentStore[prop]
            && typeof currentStore[prop] === 'object'
            && !Array.isArray(currentStore[prop])
            && typeof prop !== 'symbol') {
            const currentNestedAttrs = target?.[nestedAttrs]
            const nestedAttrsPrefix = currentNestedAttrs ? `${currentNestedAttrs as string}.` : ''
            return proxifyStore(
              store$$,
              Object.defineProperty({
                ...currentStore[prop],
              },
              nestedAttrs,
              {
                value: `${nestedAttrsPrefix}${prop}`,
                enumerable: false,
                writable: false,
                configurable: false,
              },
              ),
            )
          }

          return currentStore[prop]
        }

        return Reflect.get(target, prop)
      },
      set: function (target: T, prop: string | symbol, value: any) {
        const currentStore = store$$.getValue() as any
        const isNestedProp = Boolean(target[nestedAttrs]?.length)


        const clonedStore = Object.assign({}, currentStore)

        if (isNestedProp) {
          const nestedAttributes = (target[nestedAttrs] as string).split('.')
          assignNestedProperty(clonedStore, nestedAttributes, prop as string, value)
        } else {
          clonedStore[prop] = value
        }

        store$$.next(clonedStore)

        return Reflect.set(target, prop, value)
      },
    },
  )
}
