import type { BehaviorSubject } from 'rxjs'



const NESTED_ATTRIBUTES_SYMBOL = '___nested-attributes___'
const nestedAttrs = Symbol(NESTED_ATTRIBUTES_SYMBOL)

export function proxifyStore <T extends Record<string | symbol, any>> (store$$: BehaviorSubject<T>, storeObject: T): T {
  if (typeof storeObject !== 'object') throw new Error('Store must be an object')

  return new Proxy<T>(
    storeObject,
    {
      get: function (target: T, prop: string | symbol): any {
        const currentStore = target as any
        // console.log('get', { target, prop, in: prop in currentStore })

        // Problem with nested proxies because of currentStore is the root object
        if (prop in currentStore) {
          if (typeof currentStore[prop] === 'function') {
            return currentStore[prop].bind(proxifyStore(store$$, currentStore))
          }

          // console.log('------', prop, typeof currentStore[prop] === 'object', !Array.isArray(currentStore[prop]))
          // TODO:  add pseudo identifier in order to return
          // TODO: the same object with a identifier of the level and the name of the property
          if (typeof currentStore[prop] === 'object' && !Array.isArray(currentStore[prop]) && typeof prop !== 'symbol') {
            // console.log('returning proxified object', prop)
            return proxifyStore(
              store$$,
              {
                ...currentStore[prop],
                [nestedAttrs]: `${(target?.[nestedAttrs]) ?? ''}${prop}`,
              })
          }

          return currentStore[prop]
        }

        return Reflect.get(target, prop)
      },
      set: function (target: T, prop: string | symbol, value: any) {
        // Write a merge deep nested objects function (as 'deepmerge lib')
        console.log('set', { target, prop, value })
        const currentStore = store$$.getValue() as any

        const clonedStore = Object.assign({}, currentStore)
        clonedStore[prop] = value

        store$$.next(clonedStore)

        return Reflect.set(target, prop, value)
      },
    },
  )
}
