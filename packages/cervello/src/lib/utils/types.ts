export type ObjectFromAttributes<T, Attributes extends Array<keyof T>> = {
  [k in Attributes[number]]: T[k]
}
export const test = true
export {}
