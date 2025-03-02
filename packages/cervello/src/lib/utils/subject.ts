
export type Noop = () => void


export type Observer<T> = {
  next: (value: T) => void
}

export type Subscription = {
  unsubscribe: Noop
}

export type CacheableSubject<T> = {
  getValue: () => T
  subscribe: (value: Observer<T>) => Subscription
  unSubscribeAll: Noop
} & Observer<T>


const WITH_FLUSHING = true

export function createCacheableSubject<T> (defaultValue: T, getValueOnSubscribe = false): CacheableSubject<T> {
  let isFlushing = false
  let itemsToFlush: Array<T> = []

  let observerList: Array<Observer<T>> = []
  let value = defaultValue

  const getValue = (): T => value

  const next = (newValue: T): void => {
    value = newValue

    if (!WITH_FLUSHING) {
      observerList.forEach((o) => { o.next(newValue) })

      return
    }

    itemsToFlush.push(newValue)
    // observerList.forEach((o) => { o.next(newValue) })

    if (!isFlushing) {
      isFlushing = true
      void Promise.resolve().then(() => {
        observerList.forEach((o) => { o.next(itemsToFlush as T) })
        itemsToFlush = []
        isFlushing = false
      })
    }
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

