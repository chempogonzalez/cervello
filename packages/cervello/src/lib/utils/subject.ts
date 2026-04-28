
type Observer<T> = {
  id: string
  next: (value: T, subscriberId?: string) => void
}

type Subscription = {
  unsubscribe: () => void
}

type FlushItem<T> = {
  newValue: T
  subscriberId?: string
}

export type CacheableSubject<T> = {
  subscribe: (observer: Observer<T>) => Subscription
} & Omit<Observer<T>, 'id'>

export function createCacheableSubject<T> (): CacheableSubject<T> {
  let isScheduled = false
  let isFlushing = false
  let tick = 0
  const observerList: Array<Observer<T>> = []
  const updateList = new Map<string, FlushItem<T>>()

  const scheduleFlush = (): void => {
    if (isScheduled || isFlushing) return
    isScheduled = true

    queueMicrotask(() => {
      isScheduled = false

      if (isFlushing || updateList.size === 0) return

      isFlushing = true
      const updatesSnapshot = new Map(updateList)

      updateList.clear()

      for (const observer of observerList) {
        const filtered: Array<FlushItem<T>> = []

        for (const item of updatesSnapshot.values()) {
          if (item.subscriberId !== observer.id)
            filtered.push(item)
        }

        if (filtered.length > 0)
          observer.next(filtered.map(f => f.newValue) as T)
      }

      isFlushing = false

      if (updateList.size > 0)
        scheduleFlush()
    })
  }

  const next = (newValue: T, subscriberId?: string): void => {
    const key = `${subscriberId ?? 'g'}-${++tick}`

    updateList.set(key, { newValue, subscriberId })

    if (!isScheduled && !isFlushing)
      scheduleFlush()
  }

  const subscribe = (observer: Observer<T>): Subscription => {
    observerList.push(observer)

    return {
      unsubscribe: () => {
        const idx = observerList.indexOf(observer)

        if (idx !== -1)
          observerList.splice(idx, 1)
      },
    }
  }


  return { next, subscribe }
}
