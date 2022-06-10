import type { BehaviorSubject } from 'rxjs'



export function proxifyStore <T extends Record<string | symbol, any>> (store$$: BehaviorSubject<T>, storeObject: T): T {
  if (typeof storeObject !== 'object') throw new Error('Store must be an object')

  return new Proxy<T>(
    storeObject,
    {
      get: function (target: T, prop: string | symbol): any {
        const currentStore = store$$.value as any

        if (prop in currentStore) {
          if (typeof currentStore[prop] === 'function') {
            return currentStore[prop].bind(proxifyStore(store$$, currentStore))
          }

          return currentStore[prop]
        }

        return Reflect.get(target, prop)
      },
      set: function (target: T, prop: string | symbol, value: any) {
        const currentStore = store$$.value as any

        const clonedStore = Object.assign({}, currentStore)
        clonedStore[prop] = value

        store$$.next(clonedStore)

        return Reflect.set(target, prop, value)
      },
    },
  )
}
