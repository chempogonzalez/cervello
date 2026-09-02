
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

  // Indexed loops: no [key, value] tuple per property (Object.entries) nor
  // a closure per object (forEach)
  const keys = Object.keys(obj)

  for (let i = 0; i < keys.length; i++)
    o[keys[i]] = cloneNonReactive(obj[keys[i]], refs)

  const symbols = Object.getOwnPropertySymbols(obj)

  for (let i = 0; i < symbols.length; i++)
    o[symbols[i]] = obj[symbols[i]]

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

  if (Array.isArray(obj)) {
    ancestors.add(obj)
    const clonedArray = obj.map(item => deepClone(item, ancestors))

    ancestors.delete(obj)

    return clonedArray as T
  }

  // Keys are computed once and shared with the react-node check, which had
  // to allocate its own Object.keys per visited object before
  const keys = Object.keys(obj)

  if (isReactObjectLikeNode(obj, keys)) return obj

  ancestors.add(obj)

  const newObj = {} as any

  // Indexed loops (keys and symbols): no [key, value] tuple per property
  // (Object.entries) nor a closure per object (forEach) in this hot path
  for (let i = 0; i < keys.length; i++)
    newObj[keys[i]] = deepClone((obj as any)[keys[i]], ancestors)

  const symbols = Object.getOwnPropertySymbols(obj)

  for (let i = 0; i < symbols.length; i++)
    newObj[symbols[i]] = (obj as any)[symbols[i]]

  ancestors.delete(obj)

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


export function isReactObjectLikeNode (obj: unknown, precomputedKeys?: Array<string>): boolean {
  if (!isObject(obj)) return false
  if (isReactElement(obj)) return true

  // Callers traversing the object can pass their own Object.keys() result to
  // avoid allocating the key array twice per visited object
  const objKeys = precomputedKeys ?? Object.keys(obj)
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


// Nodes the JSON projection treats specially (React elements, React
// internals, DOM elements): compared through safeToJson instead of key-by-key
const isJsonExoticNode = (obj: any, keys: Array<string>): boolean => (
  isReactObjectLikeNode(obj, keys)
  || (!!globalThis?.HTMLElement && obj instanceof globalThis.HTMLElement)
)


/**
 * Structural equivalent of comparing the two safeToJson projections, with
 * early exit and zero string/tree allocations (this runs on every `$value`
 * set and nested-object reassignment): `undefined`/function-valued keys are
 * skipped (JSON drops them), such array elements compare as `null`, complex
 * leaves (Date, Map, Set...) are opaque and circular references only match
 * when both sides cycle. React/DOM nodes fall back to their safeToJson
 * projection. Key order is irrelevant and NaN equals NaN — both intended
 * divergences from the previous stringify-based comparison
 */
function deepEqualJson (a: any, b: any, aSeen: WeakSet<object> | null, bSeen: WeakSet<object> | null): boolean {
  if (a === b) return true

  if (Number.isNaN(a)) return Number.isNaN(b)

  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false

  // Circular reference (cut by the JSON traversal): equal only if both cycle
  const aCycles = !!aSeen && aSeen.has(a)
  const bCycles = !!bSeen && bSeen.has(b)

  if (aCycles || bCycles) return aCycles && bCycles

  const aIsArray = Array.isArray(a)

  if (aIsArray !== Array.isArray(b)) return false

  // Ancestor tracking is paid lazily, right before the first recursion into
  // an object-typed value: flat objects (the hot case) never touch a WeakSet
  let tracked = false

  let result = true

  if (aIsArray) {
    result = a.length === b.length

    for (let i = 0; result && i < a.length; i++) {
      const aItem = a[i] === undefined || typeof a[i] === 'function' ? null : a[i]
      const bItem = b[i] === undefined || typeof b[i] === 'function' ? null : b[i]

      if (!tracked && ((aItem && typeof aItem === 'object') || (bItem && typeof bItem === 'object'))) {
        tracked = true
        aSeen = aSeen ?? new WeakSet()
        bSeen = bSeen ?? new WeakSet()
        aSeen.add(a)
        bSeen.add(b)
      }

      result = deepEqualJson(aItem, bItem, aSeen, bSeen)
    }
  } else {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)

    if (isJsonExoticNode(a, aKeys) || isJsonExoticNode(b, bKeys)) {
      result = stringify(a) === stringify(b)
    } else {
      // Compare by key name (order-independent), skipping values JSON drops.
      // `serializableBalance` nets a's comparable keys against b's, so b
      // cannot hide extra keys behind matching ones
      let serializableBalance = 0

      for (let i = 0; result && i < aKeys.length; i++) {
        const aValue = a[aKeys[i]]

        if (aValue === undefined || typeof aValue === 'function') continue

        serializableBalance++
        const bValue = b[aKeys[i]]

        if (bValue === undefined || typeof bValue === 'function') {
          result = false
        } else {
          if (!tracked && ((aValue && typeof aValue === 'object') || (bValue && typeof bValue === 'object'))) {
            tracked = true
            aSeen = aSeen ?? new WeakSet()
            bSeen = bSeen ?? new WeakSet()
            aSeen.add(a)
            bSeen.add(b)
          }

          result = deepEqualJson(aValue, bValue, aSeen, bSeen)
        }
      }

      if (result) {
        for (let i = 0; i < bKeys.length; i++) {
          const bValue = b[bKeys[i]]

          if (bValue !== undefined && typeof bValue !== 'function') serializableBalance--
        }

        result = serializableBalance === 0
      }
    }
  }

  if (tracked) {
    (aSeen as WeakSet<object>).delete(a);
    (bSeen as WeakSet<object>).delete(b)
  }

  return result
}


/**
 * Compare 2 provided objects by content
 * (safe against circular references and React internals)
 * @param a - first object
 * @param b - second object
 * @returns boolean
 */
export const contentComparer = (a: any, b: any): boolean => deepEqualJson(a, b, null, null)




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

  // Keys computed once, shared between the react-node check and the copy
  // loop (no [key, value] tuple per property either — hot path)
  const keys = Object.keys(obj)

  // React internals (fibers, containers...) are huge and circular: treat them
  // as opaque values instead of traversing them (same rule as deepClone)
  if (isReactObjectLikeNode(obj, keys))
    return { type: '[ReactNode]' }

  const o: Record<string, any> = {}

  ancestors.add(obj)

  for (let i = 0; i < keys.length; i++)
    o[keys[i]] = safeToJson(obj[keys[i]], ancestors)

  ancestors.delete(obj)

  return o
}
