
import { deepClone, isReactElement, isValidReactiveObject } from '../utils/object'

import type { StoreChange } from '../../types/shared'
import type { CacheableSubject } from '../utils/subject'



// @ts-expect-error - Object.hasOwn is not defined in older Safari's browsers
('hasOwn' in Object) || (Object.hasOwn = Object.call.bind(Object.hasOwnProperty))

const ROOT_VALUE = Symbol('value')


export function proxifyStore <T extends Record<string | symbol, any>> (
  store$$: CacheableSubject<StoreChange<T>>,
  objectToProxify: T,
  opts: {
    nestedFieldPath?: string
    parentObjectToProxify?: any
    // beforeChange?: (storeChange: StoreChange<T>) => any
    afterChange?: (storeChange: Array<StoreChange<T>>) => void
  } = {},
): T {
  const fieldPath = opts.nestedFieldPath ?? 'root'

  const objectWithRootValue = {
    [ROOT_VALUE]: objectToProxify,
  } as unknown as T

  const rootFunctions = fieldPath === 'root'
    ? Object.fromEntries(Object.entries(objectToProxify).filter(([,v]) => typeof v === 'function'))
    : {}

  return new Proxy(objectWithRootValue, {
    get (targetObject, propName, receiver) {
      // INFO: !Internal only.
      // Used to get the fieldPath of the object (it means it's a proxified object)
      if (propName === '_$fieldPath') return fieldPath

      const isRootTarget = Object.hasOwn(targetObject, ROOT_VALUE)
      const target = isRootTarget ? targetObject[ROOT_VALUE] : targetObject


      // Called when the object is converted to JSON or string (i.e. JSON.stringify)
      if (propName === 'toJSON') {
        return () => {
          // Remove react-elements with circular which have circular references
          // before stringifying to prevent JSON.stringify(storeProxy) from failing
          return safeToJson(target)
          // return removeCircularReferences(target)
        }
      }

      // Get the whole store value without proxies
      if (propName === '$value')
        return deepClone(target)
        // return target



      const propertyValue = Reflect.get(target, propName, receiver)

      if (typeof propName === 'symbol') return propertyValue

      if (typeof propertyValue === 'function')
        return (propertyValue as () => any).bind(receiver)


      // Check if it's correct to be a reactive object
      // & is not a circular reference or the same object
      if (isValidReactiveObject(propertyValue) && propertyValue !== target) {
        // const newNestedFieldPath = `${fieldPath}.${propName}`

        // If it's already a proxified object, return it
        // if (propertyValue._$fieldPath === newNestedFieldPath) return propertyValue
        if (propertyValue._$fieldPath) return propertyValue

        // Create a new proxified object
        const proxiedNestedObject = proxifyStore(
          store$$ as any,
          propertyValue,
          {
            nestedFieldPath: `${fieldPath}.${propName}`,
            parentObjectToProxify: opts.parentObjectToProxify ?? target,
            // beforeChange: opts.beforeChange,
            afterChange: opts.afterChange,
          },
        )

        return target[propName] = proxiedNestedObject
      }

      return propertyValue
    },


    set (parentObject, key, newValue, receiver) {
      if (typeof key === 'symbol') return true

      const value = newValue
      const isRootTarget = Object.hasOwn(parentObject, ROOT_VALUE)

      // INFO: !Internal only.
      // Used to set the value of the store without notifying the store
      if (isRootTarget && key === '$$value') {
        const previousValue = parentObject[ROOT_VALUE];

        (parentObject as any)[ROOT_VALUE] = value.newValue

        store$$.next({
          storeValue: value.newValue,
          change: {
            fieldPath: 'root' as any,
            newValue: value.newValue,
            previousValue,
          },
        }, value.id)

        return true
      }

      if (isRootTarget && key === '$value') {
        const previousValue = parentObject[ROOT_VALUE]

        if (value === previousValue) return true

        if (JSON.stringify(safeToJson(value)) === JSON.stringify(safeToJson(previousValue))) return true
        // if (safeStringify(value) === safeStringify(previousValue)) return true

        if (fieldPath !== 'root') {
          (parentObject as any)[ROOT_VALUE] = value
        } else {
          (parentObject as any)[ROOT_VALUE] = {
            ...rootFunctions,
            ...value,
          }
          store$$.next({
            // To be disabled for performance and send same store reference
            // storeValue: JSON.parse(JSON.stringify(targetObject[ROOT_VALUE])),
            storeValue: parentObject[ROOT_VALUE],
            change: {
              fieldPath: 'root' as any,
              newValue: value,
              previousValue,
            },
          })
        }

        return true
      }

      const realInnerObject = isRootTarget ? parentObject[ROOT_VALUE] : parentObject
      const previousValue = Reflect.get(realInnerObject, key, receiver)


      if (previousValue === value) return true


      // New object values, check if the field has already a proxy created to use it instead of reacreating a new instance
      if (isValidReactiveObject(value) && previousValue?._$fieldPath)
        previousValue.$value = value
      else
        Reflect.set(realInnerObject, key, value, realInnerObject)


      const nextStoreChange = {
        // To be disabled for performance and send same store reference
        // storeValue: JSON.parse(JSON.stringify(opts?.parentObjectToProxify ?? target)),
        storeValue: opts?.parentObjectToProxify ?? realInnerObject,
        change: {
          fieldPath: `${fieldPath}.${key}`.replace('root.', '') as any,
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


// function getDeepUnproxiedObject (obj: any): any {
//   if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
//     if (obj[ROOT_VALUE]?.[ROOT_VALUE]) {
//       console.warn('Circular reference detected in getDeepUnproxiedObject')
//
//       return '[Circular reference]'
//     }
//
//
//     const r = Object.fromEntries(
//       Object.entries(obj).map(([key, value]) => {
//         // console.log('____________________getDeepUnproxiedObject', key, value, value.constructor.name)
//         if (value && typeof value === 'object' && !Array.isArray(value)) {
//           if (key === 'links') console.log('getDeepUnproxiedObject', key, value)
//
//           // If it's a proxied object, get the unproxied value
//           return [key, getDeepUnproxiedObject(value)]
//         }
//
//         return [key, value]
//       }),
//     )
//
//
//     return r
//   }
//
//   return obj
// }

// function safeStringify (obj: any): string {
//   // use removeCircularReferences to avoid circular references
//   // const cleanedObj = removeCircularReferences(obj)
//   return JSON.stringify(safeToJson(obj))
//   //
//   // return JSON.stringify(
//   //   obj,
//   //   (_key, value) => {
//   //     if (Array.isArray(value)) return value.map(i => safeStringify(i))
//   //
//   //     if (isReactElement(value)) {
//   //       // console.log('React element detected', value)
//   //
//   //       return { props: safeStringify(value.props), type: typeof value.type === 'string' ? value.type : '' }
//   //     }
//   //
//   //     if (globalThis?.HTMLElement && value instanceof globalThis.HTMLElement) return { type: '[HTMLElement]', content: value.innerHTML }
//   //
//   //     // console.log('Value', value)
//   //
//   //     return value
//   //   })
// }


function safeToJson (obj: any): Record<string, any> {
  const o: Record<string, any> = {}

  if (typeof obj !== 'object' || obj == null)
    return obj

  if (Array.isArray(obj))
    return obj.map(item => safeToJson(item))

  if (isReactElement(obj))
    return { props: safeToJson(obj.props), type: typeof obj.type === 'string' ? obj.type : '' }

  if (globalThis?.HTMLElement && obj instanceof globalThis.HTMLElement) return { type: '[HTMLElement]', content: obj.innerHTML }

  Object.entries(obj).forEach(([key, v]) => {
    o[key] = safeToJson(v)
  })

  return o
}


// function removeCircularReferences (obj: any): any {
//   const seen = new WeakSet()
//
//   function traverse (value: any): any {
//     if (value && typeof value === 'object') {
//       // If the object has already been seen, it's a circular reference
//       if (seen.has(value))
//         return null
//
//       seen.add(value)
//
//       if (Array.isArray(value))
//         return value.map(traverse)
//
//
//       const result: any = {}
//
//       for (const key in value) {
//         if (Object.prototype.hasOwnProperty.call(value, key)) {
//           if (key === '_owner' && value.$$typeof) continue
//
//           result[key] = traverse(value[key])
//         }
//       }
//
//       return result
//     }
//
//     // Return primitive values as-is
//     return value
//   }
//
//   return traverse(obj)
// }
