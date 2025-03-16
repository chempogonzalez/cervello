/* eslint-disable @typescript-eslint/ban-types */
export type WithoutType<T, V, WithNever = {
  [K in keyof T]: Exclude<T[K], undefined> extends V
    ? never
    : (T[K] extends Record<string, unknown>
        ? WithoutType<T[K], V>
        : T[K])
}> = Pick<WithNever, {
  [K in keyof WithNever]: WithNever[K] extends never ? never : K
}[keyof WithNever]>



export type ObjectFromAttributes<T, Attributes extends Array< keyof WithoutType<T, Function> > > = {
  [k in Attributes[number]]: T[k]
}

export type Maybe<T> = T | undefined



export type UseSelector<T> = <Attributes extends Array< Exclude<keyof WithoutType<T, Function>, '$value'> >>(
  selectors: Attributes,
  isEqualFunction?: (previousState: ObjectFromAttributes<T, Attributes>, currentState: ObjectFromAttributes<T, Attributes>) => boolean,
) => T

export type FieldPath<T extends Record<string, any>> = {
  [K in keyof Required<T>]: T[K] extends Record<string, any>
    ? K extends string

      ? T[K] extends Function
        ? never
        : T[K] extends Array<any>
          ? K
          : `${K}.*` | `${K}.${FieldPath<T[K]>}`
      : never
    : K extends string
      ? K
      : never
}[keyof T]

export const nonReactiveObjectSymbol = Symbol('nonReactiveObject')
export type StoreChange<T extends Record<string, any>> = {
  change: {
    fieldPath: FieldPath<T>
    newValue: any
    previousValue: any
  }
  storeValue: T
}
