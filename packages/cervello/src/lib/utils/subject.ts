type Observer<T> = {
  id: string
  // Changes are always delivered in batches (one flush per microtask)
  next: (values: Array<T>) => void
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
  next: (value: T, subscriberId?: string) => void
  version: () => number
}

export function createCacheableSubject<T> (): CacheableSubject<T> {
  let isScheduled = false
  let isFlushing = false
  // Monotonic write counter, bumped at write time (not flush time) so a
  // subscriber can detect changes emitted before its subscription existed
  let version = 0
  // True when any queued item carries a subscriberId (self-notification
  // exclusion needed): tracked at write time to pick the flush fast path
  let hasIds = false
  const observerList: Array<Observer<T>> = []
  let updateList: Array<FlushItem<T>> = []


  /** Pushes a new value to the subject and schedules a flush if not already scheduled or flushing.
    * `newValue`:
    *     The new value to be emitted to subscribers.
    *
    * `subscriberId`: (Optional)
    *    identifier for the subscriber that triggered the update, used to prevent self-notifications. (usage in initialValue)
    */
  function next (newValue: T, subscriberId?: string): void {
    version++

    if (subscriberId !== undefined) hasIds = true
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



  // Hoisted (instead of a fresh closure per scheduled flush) and reused by
  // every queueMicrotask call
  function flush (): void {
    isScheduled = false

    if (isFlushing || updateList.length === 0) return

    isFlushing = true

    // Snapshot by swap (no copy): new updates arriving while flushing are
    // collected into a fresh list
    const changesSnapshot = updateList
    const snapshotHasIds = hasIds

    updateList = []
    hasIds = false

    // Snapshot the observers too: a synchronous unsubscribe from inside a
    // callback must not shift the delivery loop and skip an observer
    const observersSnapshot = observerList.slice()

    // Plain indexed loops: for...of over arrays makes the build ship Babel's
    // iterator-interop helpers, which weigh more than this whole module
    if (!snapshotHasIds) {
      // Fast path (the common case): no self-notification exclusions, so all
      // observers with an id share ONE values array instead of allocating a
      // filtered copy each. Observers without id are excluded, exactly like
      // the filtered path does (undefined === undefined)
      const values: Array<T> = []

      for (let i = 0; i < changesSnapshot.length; i++)
        values.push(changesSnapshot[i].newValue)

      for (let i = 0; i < observersSnapshot.length; i++) {
        if (observersSnapshot[i].id !== undefined)
          observersSnapshot[i].next(values)
      }
    } else {
      for (let i = 0; i < observersSnapshot.length; i++) {
        const observer = observersSnapshot[i]
        const filtered: Array<T> = []

        for (let j = 0; j < changesSnapshot.length; j++) {
          if (changesSnapshot[j].subscriberId !== observer.id)
            filtered.push(changesSnapshot[j].newValue)
        }

        if (filtered.length > 0)
          observer.next(filtered)
      }
    }

    isFlushing = false

    // Re-check if there are new updates that came in during the flush
    if (updateList.length > 0)
      scheduleFlush()
  }


  function scheduleFlush (): void {
    if (isScheduled || isFlushing || updateList.length === 0) return
    isScheduled = true

    queueMicrotask(flush)
  }




  return { next, subscribe, version: () => version }
}
