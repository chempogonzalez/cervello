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
  } else {
    Object.entries(obj).forEach(([key, value]) => {
      newObj[key] = deepClone(value)
    })
  }
  return newObj as T
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
