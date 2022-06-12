type ObjectFromAttributes<T, Attributes extends Array<keyof T>> = {
  [k in Attributes[number]]: T[k]
}

export type { ObjectFromAttributes }
