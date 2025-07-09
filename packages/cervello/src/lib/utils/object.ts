/* eslint-disable no-cond-assign */

import { nonReactiveObjectSymbol } from '../../types/shared'
import { INTERNAL_VALUE_PROP } from '../helpers/constants'


/**
 * Clones all the provided object and nested properties and it also
 * iterates nested arrays to deepClone them
 *
 * @param obj - base object to be cloned
 * @returns new cloned object with new reference
 */
export function deepClone <T> (obj: T): T {
  if (!obj || typeof obj !== 'object')
    return obj

  let newObj = {} as any

  if (Array.isArray(obj)) {
    newObj = obj.map(item => deepClone(item))
  } else if (!isReactObjectLikeNode(obj)) {
    Object.entries(obj).forEach(([key, value]) => {
      newObj[key] = deepClone(value)
    })
    Object.getOwnPropertySymbols(obj).forEach((symbol) => {
      newObj[symbol] = (obj as any)[symbol]
    })
  } else {
    newObj = obj
  }

  return newObj as T
}

// function copyBuffer (cur: ArrayBufferView) {
//   if (cur instanceof Buffer)
//     return Buffer.from(cur)
//
//
//   return new cur.constructor(cur.buffer.slice(), cur.byteOffset, cur.length)
// }


// INFO: From `rfdc` (really-fast-deep-clone) package for faster cloning taking care of circular references
export function deepClone2 <T> (obj: T): T {
  const refs: Array<any> = []
  const refsNew: Array<any> = []

  const constructorHandlers = new Map()

  constructorHandlers.set(Date, (o: string | number | Date) => new Date(o))
  constructorHandlers.set(Map, (o: Iterable<unknown> | ArrayLike<unknown>, fn: any) => new Map(cloneArray(Array.from(o), fn)))
  constructorHandlers.set(Set, (o: Iterable<unknown> | ArrayLike<unknown>, fn: any) => new Set(cloneArray(Array.from(o), fn)))

  let handler = null

  return clone(obj)

  function cloneArray (a: any, fn: any): any {
    const keys = Object.keys(a)
    const a2 = new Array(keys.length) as any

    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]
      const cur = a[k]

      if (typeof cur !== 'object' || cur === null) {
        a2[k] = cur
      } else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) {
        a2[k] = handler(cur, fn)
      // } else if (ArrayBuffer.isView(cur)) {
      //   a2[k] = copyBuffer(cur)
      } else {
        const index = refs.indexOf(cur)

        if (index !== -1)
          a2[k] = refsNew[index]
        else
          a2[k] = fn(cur)
      }
    }

    return a2
  }

  function clone (o: any): any {
    if (typeof o !== 'object' || o === null) return o
    if (Array.isArray(o)) return cloneArray(o, clone)
    if (o.constructor !== Object && (handler = constructorHandlers.get(o.constructor)))
      return handler(o, clone)

    const o2 = {} as any

    refs.push(o)
    refsNew.push(o2)


    Object.getOwnPropertySymbols(o).forEach((symbol) => {
      o2[symbol] = (o)[symbol]
    })

    for (const k in o) {
      if (!Object.hasOwnProperty.call(o, k)) continue
      const cur = o[k]


      if (typeof cur !== 'object' || cur === null) {
        o2[k] = cur
      } else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) {
        o2[k] = handler(cur, clone)
      // } else if (ArrayBuffer.isView(cur)) {
      //   o2[k] = copyBuffer(cur)
      } else {
        const i = refs.indexOf(cur)

        if (i !== -1)
          o2[k] = refsNew[i]
        else
          o2[k] = clone(cur)
      }
    }
    refs.pop()
    refsNew.pop()


    return o2
  }
}

/**
 * Guard to check is variable is an object
 * @param obj - variable to be checked
 * @returns boolean
 */
export const isObject = (obj: unknown): obj is Record<string | symbol, unknown> => (
  obj !== null
  && typeof obj === 'object'
  && !Array.isArray(obj)
)


export const isReactElement = (obj: unknown): boolean => {
  if (!isObject(obj)) return false

  return !!(obj.$$typeof)
}


export function isReactObjectLikeNode (obj: unknown): boolean {
  if (!isObject(obj)) return false
  if (isReactElement(obj)) return true

  const objKeys = Object.keys(obj)
  const isReactObjNode = (objKeys.includes('tag') && objKeys.includes('containerInfo'))
        || objKeys.some(k => k.startsWith('__reactContainer'))
        || (objKeys.includes('tag') && objKeys.includes('stateNode'))

  return isReactObjNode
}


export function isValidReactiveObject <T extends Record<string, any>> (value: T): boolean {
  return isObject(value) && !isReactElement(value) && !(value as any)[nonReactiveObjectSymbol]
}



/**
 * Returns the actual target value instead of root
 * object with internals props like $$value$$
 *
 * @param target - object from subscription or proxy
 * @returns actual value
 */
export const okTarget = (target: any): any => target[INTERNAL_VALUE_PROP] ?? target




/**
 * Gets an object with just the properties requested
 * instead of the full object
 *
 * @param properties - object properties
 * @param obj - target to get the properties
 * @returns New object with just the requested properties
 */
export function getPartialObjectFromProperties<T> (properties: Array<keyof T>, obj: T): any {
  return properties.reduce<any>((acc, curr) => {
    acc[curr] = obj[curr]

    return acc
  }, {})
}



const stringify = (obj: any): string => JSON.stringify(obj)

/**
 * Compare 2 provided objects by stringing them
 * @param a - first object
 * @param b - second object
 * @returns boolean
 */
export const contentComparer = (a: any, b: any): boolean => stringify(a) === stringify(b)
