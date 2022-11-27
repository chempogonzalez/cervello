
export type Noop = () => void


export interface Observer<T> {
  next: (value: T) => void
}

export interface Subscription {
  unsubscribe: Noop
}

export type CacheableSubject<T> = {
  getValue: () => T
  subscribe: (value: Observer<T>) => Subscription
  unSubscribeAll: Noop
} & Observer<T>



export function createCacheableSubject<T> (defaultValue: T, getValueOnSubscribe = true): CacheableSubject<T> {
  let observerList: Array<Observer<T>> = []
  let value = defaultValue

  const getValue = (): T => value

  const next = (newValue: T): void => {
    value = newValue
    observerList.forEach((o) => { o.next(newValue) })
  }

  const subscribe = (observer: Observer<T>): Subscription => {
    // Push cached value on subscribe
    if (getValueOnSubscribe) observer.next(value)
    // Store the observer to be notified
    observerList.push(observer)
    return {
      unsubscribe: () => {
        observerList = observerList.filter(o => o !== observer)
      },
    }
  }

  const unSubscribeAll = (): void => {
    observerList = []
  }

  return {
    getValue,
    next,
    subscribe,
    unSubscribeAll,
  }
}
