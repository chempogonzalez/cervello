
import { nonReactiveObjectSymbol } from '../../types/shared'
import { INTERNAL_VALUE_PROP } from '../helpers/constants'


/**
 * Structural clone for nonReactive() subtrees: preserves complex values
 * (Date, Map, Set) and keeps circular references/aliases intact by mapping
 * each source object to its clone. Functions, React nodes and any other
 * class instance (DOM elements included, via the constructor check) are
 * kept by reference — they cannot be cloned safely
 */
function cloneNonReactive (obj: any, refs: WeakMap<object, any>): any {
  if (!obj || typeof obj !== 'object') return obj

  if (refs.has(obj)) return refs.get(obj)

  if (obj instanceof Date) return new Date(obj.getTime())

  if (isReactObjectLikeNode(obj)) return obj

  if (Array.isArray(obj)) {
    const arr: Array<any> = []

    refs.set(obj, arr)
    obj.forEach((item, idx) => { arr[idx] = cloneNonReactive(item, refs) })

    return arr
  }

  if (obj instanceof Map) {
    const map = new Map()

    refs.set(obj, map)
    obj.forEach((v, k) => { map.set(cloneNonReactive(k, refs), cloneNonReactive(v, refs)) })

    return map
  }

  if (obj instanceof Set) {
    const set = new Set()

    refs.set(obj, set)
    obj.forEach((v) => { set.add(cloneNonReactive(v, refs)) })

    return set
  }

  // Other class instances cannot be cloned generically: keep them by reference
  if (obj.constructor && obj.constructor !== Object) return obj

  const o: Record<PropertyKey, any> = {}

  refs.set(obj, o)
  Object.entries(obj).forEach(([key, value]) => { o[key] = cloneNonReactive(value, refs) })
  Object.getOwnPropertySymbols(obj).forEach((symbol) => { o[symbol] = obj[symbol] })

  return o
}


/**
 * Clones all the provided object and nested properties and it also
 * iterates nested arrays to deepClone them
 *
 * Circular references are considered invalid store values, so they are cut
 * to `null` instead of recursing forever. The exceptions are React
 * elements/nodes (kept by reference) and nonReactive()-wrapped objects,
 * which are cloned structurally so complex values (Date, Map, Set, circular
 * references...) survive intact — this keeps the store copy decoupled from
 * the caller's object and allows reset() to restore the initial state
 *
 * @param obj - base object to be cloned
 * @param ancestors - objects of the current traversal path, to detect cycles
 * @returns new cloned object with new reference
 */
export function deepClone <T> (obj: T, ancestors = new WeakSet<object>()): T {
  if (!obj || typeof obj !== 'object')
    return obj

  if ((obj as any)[nonReactiveObjectSymbol]) {
    const cloned = cloneNonReactive(obj, new WeakMap())

    // Keep the mark when the wrapper itself is an exotic object (Map, array...)
    // whose clone branch does not copy symbol properties
    if (!cloned[nonReactiveObjectSymbol]) cloned[nonReactiveObjectSymbol] = true

    return cloned
  }

  if (ancestors.has(obj))
    return null as T

  let newObj = {} as any

  if (Array.isArray(obj)) {
    ancestors.add(obj)
    newObj = obj.map(item => deepClone(item, ancestors))
    ancestors.delete(obj)
  } else if (!isReactObjectLikeNode(obj)) {
    ancestors.add(obj)
    Object.entries(obj).forEach(([key, value]) => {
      newObj[key] = deepClone(value, ancestors)
    })
    Object.getOwnPropertySymbols(obj).forEach((symbol) => {
      newObj[symbol] = (obj as any)[symbol]
    })
    ancestors.delete(obj)
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
// export function deepClone2 <T> (obj: T): T {
//   const refs: Array<any> = []
//   const refsNew: Array<any> = []
//
//   const constructorHandlers = new Map()
//
//   constructorHandlers.set(Date, (o: string | number | Date) => new Date(o))
//   constructorHandlers.set(Map, (o: Iterable<unknown> | ArrayLike<unknown>, fn: any) => new Map(cloneArray(Array.from(o), fn)))
//   constructorHandlers.set(Set, (o: Iterable<unknown> | ArrayLike<unknown>, fn: any) => new Set(cloneArray(Array.from(o), fn)))
//
//   let handler = null
//
//   return clone(obj)
//
//   function cloneArray (a: any, fn: any): any {
//     const keys = Object.keys(a)
//     const a2 = new Array(keys.length) as any
//
//     for (let i = 0; i < keys.length; i++) {
//       const k = keys[i]
//       const cur = a[k]
//
//       if (typeof cur !== 'object' || cur === null) {
//         a2[k] = cur
//       } else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) {
//         a2[k] = handler(cur, fn)
//       // } else if (ArrayBuffer.isView(cur)) {
//       //   a2[k] = copyBuffer(cur)
//       } else {
//         const index = refs.indexOf(cur)
//
//         if (index !== -1)
//           a2[k] = refsNew[index]
//         else
//           a2[k] = fn(cur)
//       }
//     }
//
//     return a2
//   }
//
//   function clone (o: any): any {
//     if (typeof o !== 'object' || o === null) return o
//     if (Array.isArray(o)) return cloneArray(o, clone)
//     if (o.constructor !== Object && (handler = constructorHandlers.get(o.constructor)))
//       return handler(o, clone)
//
//     const o2 = {} as any
//
//     refs.push(o)
//     refsNew.push(o2)
//
//
//     Object.getOwnPropertySymbols(o).forEach((symbol) => {
//       o2[symbol] = (o)[symbol]
//     })
//
//     for (const k in o) {
//       if (!Object.hasOwnProperty.call(o, k)) continue
//       const cur = o[k]
//
//
//       if (typeof cur !== 'object' || cur === null) {
//         o2[k] = cur
//       } else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) {
//         o2[k] = handler(cur, clone)
//       // } else if (ArrayBuffer.isView(cur)) {
//       //   o2[k] = copyBuffer(cur)
//       } else {
//         const i = refs.indexOf(cur)
//
//         if (i !== -1)
//           o2[k] = refsNew[i]
//         else
//           o2[k] = clone(cur)
//       }
//     }
//     refs.pop()
//     refsNew.pop()
//
//
//     return o2
//   }
// }

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



const stringify = (obj: any): string => JSON.stringify(safeToJson(obj))

/**
 * Compare 2 provided objects by stringifying them
 * (safe against circular references and React internals via safeToJson)
 * @param a - first object
 * @param b - second object
 * @returns boolean
 */
export const contentComparer = (a: any, b: any): boolean => stringify(a) === stringify(b)




export function safeToJson (obj: any, ancestors = new WeakSet<object>()): Record<string, any> {
  if (typeof obj !== 'object' || obj == null)
    return obj

  // Circular reference: cut the cycle to keep the traversal finite
  if (ancestors.has(obj))
    return null as any

  if (Array.isArray(obj)) {
    ancestors.add(obj)
    const arr = obj.map(item => safeToJson(item, ancestors))

    ancestors.delete(obj)

    return arr
  }

  if (isReactElement(obj)) {
    ancestors.add(obj)
    const element = { props: safeToJson(obj.props, ancestors), type: typeof obj.type === 'string' ? obj.type : '' }

    ancestors.delete(obj)

    return element
  }

  if (globalThis?.HTMLElement && obj instanceof globalThis.HTMLElement) return { type: '[HTMLElement]', content: obj.innerHTML }

  // React internals (fibers, containers...) are huge and circular: treat them
  // as opaque values instead of traversing them (same rule as deepClone)
  if (isReactObjectLikeNode(obj))
    return { type: '[ReactNode]' }

  const o: Record<string, any> = {}

  ancestors.add(obj)

  Object.entries(obj).forEach(([key, v]) => {
    o[key] = safeToJson(v, ancestors)
  })

  ancestors.delete(obj)

  return o
}
