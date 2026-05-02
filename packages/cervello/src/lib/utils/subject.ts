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
  const observerList: Array<Observer<T>> = []
  const updateList: Array<FlushItem<T>> = []


  /** Pushes a new value to the subject and schedules a flush if not already scheduled or flushing.
    * `newValue`:
    *     The new value to be emitted to subscribers.
    *
    * `subscriberId`: (Optional)
    *    identifier for the subscriber that triggered the update, used to prevent self-notifications. (usage in initialValue)
    */
  function next (newValue: T, subscriberId?: string): void {
    updateList.push({ newValue, subscriberId })

    if (!isScheduled && !isFlushing)
      scheduleFlush()
  }


  function subscribe (observer: Observer<T>): Subscription {
    observerList.push(observer)

    return {
      unsubscribe: () => {
        const idx = observerList.indexOf(observer)

        if (idx !== -1)
          observerList.splice(idx, 1)
      },
    }
  }



  function scheduleFlush (): void {
    if (isScheduled || isFlushing || updateList.length === 0) return
    isScheduled = true

    queueMicrotask(() => {
      isScheduled = false

      if (isFlushing || updateList.length === 0) return

      isFlushing = true

      const changesSnapshot: Array<FlushItem<T>> = [...updateList]

      // After taking a snapshot of the current updates, clear the update
      // list to allow new updates to be collected while flushing
      updateList.length = 0

      for (const observer of observerList) {
        const filtered: Array<T> = []

        for (const change of changesSnapshot) {
          if (change.subscriberId !== observer.id)
            filtered.push(change.newValue)
        }

        if (filtered.length > 0)
          observer.next(filtered as T)
      }

      isFlushing = false

      // Re-check if there are new updates that came in during the flush
      if (updateList.length > 0)
        scheduleFlush()
    })
  }




  return { next, subscribe }
}
