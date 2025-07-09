
type Noop = () => void


type Observer<T> = {
  id: string
  next: (value: T, subscriberId?: string) => void
}

type Subscription = {
  unsubscribe: Noop
}

export type CacheableSubject<T> = {
  // getValue: () => T
  subscribe: (value: Observer<T>) => Subscription
  // unSubscribeAll: Noop
} & Omit<Observer<T>, 'id'>



export function createCacheableSubject<T> (/* defaultValue: T/*, getValueOnSubscribe = false */): CacheableSubject<T> {
  let isFlushing = false
  let itemsToFlush: Array<{ newValue: T, subscriberId?: string }> = []

  let observerList: Array<Observer<T>> = []
  // let value = defaultValue

  // const getValue = (): T => value

  const next = (newValue: T, subscriberId?: string): void => {
    // value = newValue

    itemsToFlush.push({ newValue, subscriberId })

    if (!isFlushing) {
      isFlushing = true

      void Promise.resolve().then(() => {
        observerList.forEach((o) => {
          // Filter changes that were sent by the same subscriberId (initialValue function call)
          const nonInitiallySentBySubscriber = itemsToFlush.filter(item => item.subscriberId !== o.id)

          if (!nonInitiallySentBySubscriber.length) return

          o.next(nonInitiallySentBySubscriber.map(i => i.newValue) as T)
        })
        itemsToFlush = []
        isFlushing = false
      })

      // void Promise.resolve(subscriberId).then((subscriberId) => {
      //   console.log('//// promise.resolve then', { subscriberId: s.id })
      //   observerList.forEach((o) => {
      //     console.log('//// CacheableSubject (forEach) flushing', { observerId: o.id, subscriberId: s.id })
      //     if (o.id === subscriberId) return
      //
      //     o.next(itemsToFlush as T)
      //   })
      //   itemsToFlush = []
      //   isFlushing = false
      // })

      // void Promise.resolve().then(() => {
      //   console.log('//// promise.resolve then')
      //   observerList.forEach((o) => {
      //     const nonInitiallySentBySubscriber = itemsToFlush.filter(item => item.subscriberId !== o.id)
      //
      //     if (nonInitiallySentBySubscriber.length === 0) return
      //
      //     o.next(nonInitiallySentBySubscriber.map(i => i.newValue) as T)
      //   })
      //   itemsToFlush = []
      //   isFlushing = false
      // })
    }
  }

  const subscribe = (observer: Observer<T>): Subscription => {
    // Push cached value on subscribe
    // if (getValueOnSubscribe) observer.next(value)

    // Store the observer to be notified
    observerList.push(observer)

    return {
      unsubscribe: () => {
        observerList = observerList.filter(o => o !== observer)
      },
    }
  }

  // const unSubscribeAll = (): void => {
  //   observerList = []
  // }

  return {
    // getValue,
    next,
    subscribe,
    // unSubscribeAll,
  }
}
