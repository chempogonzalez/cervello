/* eslint-disable @typescript-eslint/no-invalid-void-type */
import type { Observable } from './observable'
import type { Subscription } from './subscription'




export interface Observer<T> {
  next: (value: T) => void
  error: (value: any) => void
  complete: () => void
}

export type UnaryFunction<T, R> = (source: T) => R

export type OperatorFunction<T, R> = UnaryFunction<Observable<T>, Observable<R>>

export type TeardownLogic = Subscription | UnSubscribable | void | (() => void)

export interface UnSubscribable {
  unsubscribe: () => void
}
