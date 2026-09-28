
import { describe, it, expect, vi } from 'vitest'

import { createCacheableSubject } from '../../lib/utils/subject'



async function sleep (ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}


describe('[CacheableSubject]', () => {
  // Observers always receive a batched Array<T>: changes are collected and
  // flushed once per microtask

  describe('basic subscribe / next', () => {
    it('observer receives a batched array on next', async () => {
      const subject = createCacheableSubject<string>()
      const receivedItems: Array<Array<string>> = []

      subject.subscribe({
        id: 'sub-1',
        next: (value) => { receivedItems.push(value) },
      })

      subject.next('hello')
      await sleep(20)

      expect(receivedItems.length).toBe(1)
      expect(receivedItems[0]).toEqual(['hello'])
    })

    it('multiple sync next() calls batch into one array', async () => {
      const subject = createCacheableSubject<number>()
      const receivedItems: Array<Array<number>> = []

      subject.subscribe({
        id: 'sub-1',
        next: (value) => { receivedItems.push(value) },
      })

      subject.next(1)
      subject.next(2)
      subject.next(3)
      await sleep(20)

      expect(receivedItems.length).toBe(1)
      expect(receivedItems[0]).toEqual([1, 2, 3])
    })

    it('observer without id is auto-filtered by its own updates', async () => {
      const subject = createCacheableSubject<number>()
      const receivedItems: Array<Array<number>> = []

      // @ts-expect-error - no id field, runtime will set id = undefined
      subject.subscribe({ next: (value: Array<number>) => { receivedItems.push(value) } })

      // An observer with id=undefined gets auto-filtered because next() also uses undefined
      subject.next(1)
      await sleep(20)

      expect(receivedItems).toEqual([])
    })
  })

  describe('batching / microtask flush', () => {
    it('no flush happens synchronously after next()', async () => {
      const subject = createCacheableSubject<number>()
      const receivedItems: Array<Array<number>> = []

      subject.subscribe({
        id: 'sub-1',
        next: (value) => { receivedItems.push(value) },
      })

      subject.next(1)

      // Immediately after next — no flush yet
      expect(receivedItems.length).toBe(0)
    })

    it('multiple sync next() calls batch into single array', async () => {
      const subject = createCacheableSubject<string>()
      const receivedItems: Array<Array<string>> = []

      subject.subscribe({
        id: 'sub-1',
        next: (value) => { receivedItems.push(value) },
      })

      subject.next('a')
      subject.next('b')
      subject.next('c')

      await sleep(20)

      expect(receivedItems.length).toBe(1)
      expect(receivedItems[0]).toEqual(['a', 'b', 'c'])
    })

    it('nested next() calls batch correctly', async () => {
      const subject = createCacheableSubject<string>()
      const receivedItems: Array<Array<string>> = []

      subject.subscribe({
        id: 'sub-1',
        next: (value) => { receivedItems.push(value) },
      })

      subject.next('a')
      subject.next('b')
      subject.next('c')
      subject.next('d')

      await sleep(20)

      expect(receivedItems.length).toBe(1)
      expect(receivedItems[0]).toEqual(['a', 'b', 'c', 'd'])
    })

    it('next() after flush starts a new batch', async () => {
      const subject = createCacheableSubject<number>()
      const receivedItems: Array<Array<number>> = []

      subject.subscribe({
        id: 'sub-1',
        next: (value) => { receivedItems.push(value) },
      })

      subject.next(1)
      await sleep(20)

      expect(receivedItems.length).toBe(1)
      expect(receivedItems[0]).toEqual([1])

      subject.next(2)
      subject.next(3)
      await sleep(20)

      expect(receivedItems.length).toBe(2)
      expect(receivedItems[1]).toEqual([2, 3])
    })

    it('no notification for next before any subscribe', () => {
      const subject = createCacheableSubject<number>()

      expect(() => { subject.next(42) }).not.toThrow()
    })
  })

  describe('subscriber deduplication', () => {
    it('subscriber with matching id does not receive its own update', async () => {
      const subject = createCacheableSubject<string>()
      const receivedItems: Array<Array<string>> = []

      subject.subscribe({
        id: 'sub-1',
        next: (value) => { receivedItems.push(value) },
      })

      subject.next('hello', 'sub-1')
      await sleep(20)

      expect(receivedItems.length).toBe(0)
    })

    it('different subscribers all receive update from general next()', async () => {
      const subject = createCacheableSubject<number>()
      const sub1Received: Array<Array<number>> = []
      const sub2Received: Array<Array<number>> = []

      subject.subscribe({
        id: 'sub-1',
        next: (value) => { sub1Received.push(value) },
      })

      subject.subscribe({
        id: 'sub-2',
        next: (value) => { sub2Received.push(value) },
      })

      subject.next(42)
      await sleep(20)

      expect(sub1Received).toEqual([ [42] ])
      expect(sub2Received).toEqual([ [42] ])
    })

    it('subscriber excluded only for matching id', async () => {
      const subject = createCacheableSubject<string>()
      const receivedItems: Array<Array<string>> = []

      subject.subscribe({
        id: 'my-sub',
        next: (value) => { receivedItems.push(value) },
      })

      subject.next('x', 'other-sub')
      await sleep(20)

      expect(receivedItems).toEqual([ ['x'] ])
    })

    it('general updates (no subscriberId) reach all subscribers', async () => {
      const subject = createCacheableSubject<boolean>()
      const sub1Received: Array<Array<boolean>> = []
      const sub2Received: Array<Array<boolean>> = []

      subject.subscribe({
        id: 'sub-1',
        next: (value) => { sub1Received.push(value) },
      })
      subject.subscribe({
        id: 'sub-2',
        next: (value) => { sub2Received.push(value) },
      })

      subject.next(true, undefined)
      await sleep(20)

      expect(sub1Received).toEqual([ [true] ])
      expect(sub2Received).toEqual([ [true] ])
    })

    it('mixed: some updates from subscriber, some from global', async () => {
      const subject = createCacheableSubject<number>()
      const sub1Received: Array<Array<number>> = []
      const sub2Received: Array<Array<number>> = []

      subject.subscribe({
        id: 'sub-1',
        next: (value) => { sub1Received.push(value) },
      })
      subject.subscribe({
        id: 'sub-2',
        next: (value) => { sub2Received.push(value) },
      })

      subject.next(1, 'sub-1') // sub-1 excluded
      subject.next(2, 'sub-2') // sub-2 excluded
      subject.next(3) // both receive

      await sleep(20)

      // sub-1: excluded from 1, receives 2 and 3 = [2, 3]
      // sub-2: receives 1, excluded from 2, receives 3 = [1, 3]
      expect(sub1Received).toEqual([ [2, 3] ])
      expect(sub2Received).toEqual([ [1, 3] ])
    })
  })

  describe('unsubscribe', () => {
    it('unsubscribed observer does not receive future updates', async () => {
      const subject = createCacheableSubject<string>()
      const receivedItems: Array<Array<string>> = []

      const sub = {
        id: 'sub-1',
        next: (value: Array<string>) => { receivedItems.push(value) },
      }

      const subscription = subject.subscribe(sub)

      subscription.unsubscribe()

      subject.next('after unsubscribe')
      await sleep(20)

      expect(receivedItems.length).toBe(0)
    })

    it('unsubscribe multiple times is safe (idempotent)', () => {
      const subject = createCacheableSubject<number>()
      const sub = { id: 'sub-1', next: () => {} }
      const subscription = subject.subscribe(sub)

      subscription.unsubscribe()
      expect(() => { subscription.unsubscribe() }).not.toThrow()
    })

    it('other subscribers still receive updates after one unsubscribes', async () => {
      const subject = createCacheableSubject<string>()
      const sub1Received: Array<Array<string>> = []
      const sub2Received: Array<Array<string>> = []

      const sub1 = {
        id: 'sub-1',
        next: (value: Array<string>) => { sub1Received.push(value) },
      }
      const sub2 = {
        id: 'sub-2',
        next: (value: Array<string>) => { sub2Received.push(value) },
      }

      const s1 = subject.subscribe(sub1)

      subject.subscribe(sub2)

      s1.unsubscribe()

      subject.next('after')
      await sleep(20)

      expect(sub1Received).toEqual([])
      expect(sub2Received).toEqual([ ['after'] ])
    })
  })

  describe('multiple observers', () => {
    it('all observers receive same batched update', async () => {
      const subject = createCacheableSubject<number>()
      const sub1Received: Array<Array<number>> = []
      const sub2Received: Array<Array<number>> = []
      const sub3Received: Array<Array<number>> = []

      subject.subscribe({
        id: 'sub-1',
        next: (value) => { sub1Received.push(value) },
      })
      subject.subscribe({
        id: 'sub-2',
        next: (value) => { sub2Received.push(value) },
      })
      subject.subscribe({
        id: 'sub-3',
        next: (value) => { sub3Received.push(value) },
      })

      subject.next(1)
      subject.next(2)
      await sleep(20)

      expect(sub1Received).toEqual([ [1, 2] ])
      expect(sub2Received).toEqual([ [1, 2] ])
      expect(sub3Received).toEqual([ [1, 2] ])
    })

    it('each observer gets deduped updates from own id', async () => {
      const subject = createCacheableSubject<number>()
      const sub1Received: Array<Array<number>> = []
      const sub2Received: Array<Array<number>> = []

      subject.subscribe({
        id: 'sub-1',
        next: (value) => { sub1Received.push(value) },
      })
      subject.subscribe({
        id: 'sub-2',
        next: (value) => { sub2Received.push(value) },
      })

      subject.next(1, 'sub-1')
      subject.next(2, 'sub-2')
      await sleep(20)

      expect(sub1Received).toEqual([ [2] ])
      expect(sub2Received).toEqual([ [1] ])
    })
  })

  describe('edge cases', () => {
    it('unsubscribe prevents memory leak in observer list', async () => {
      const subject = createCacheableSubject<string>()
      const receivedItems: Array<Array<string>> = []

      const sub = {
        id: 'survivor',
        next: (value: Array<string>) => { receivedItems.push(value) },
      }

      const subscription = subject.subscribe(sub)

      // Unsubscribe 100 other observers
      for (let i = 0; i < 100; i++) {
        const s = subject.subscribe({ id: `temp-${i}`, next: () => {} })

        s.unsubscribe()
      }

      subscription.unsubscribe() // Also unsubscribe the survivor

      subject.next('survivor')
      await sleep(20)

      expect(receivedItems.length).toBe(0)
    })

    it('next before any subscribe does not throw', () => {
      const subject = createCacheableSubject<number>()

      expect(() => { subject.next(42) }).not.toThrow()
    })

    it('values are passed correctly across multiple batches', async () => {
      const subject = createCacheableSubject<{ type: string; value: number }>()
      const receivedBatches: Array<Array<{ type: string; value: number }>> = []

      subject.subscribe({
        id: 'sub-1',
        next: (value) => { receivedBatches.push(value) },
      })

      subject.next({ type: 'a', value: 1 })
      subject.next({ type: 'a', value: 2 })
      await sleep(20)

      subject.next({ type: 'b', value: 3 })
      await sleep(20)

      // observer.next receives the array of items directly (not wrapped in another array)
      expect(receivedBatches.length).toBe(2)
      expect(receivedBatches[0]).toEqual([{ type: 'a', value: 1 }, { type: 'a', value: 2 }])
      expect(receivedBatches[1]).toEqual([{ type: 'b', value: 3 }])
    })

    it('updates during microtask delay are all captured', async () => {
      const subject = createCacheableSubject<number>()
      const receivedItems: Array<Array<number>> = []

      subject.subscribe({
        id: 'sub-1',
        next: (value) => { receivedItems.push(value) },
      })

      for (let i = 0; i < 1000; i++)
        subject.next(i)


      await sleep(20)

      expect(receivedItems.length).toBe(1)
      expect(receivedItems[0]).toHaveLength(1000)
      expect(receivedItems[0][0]).toBe(0)
      expect(receivedItems[0][999]).toBe(999)
    })
  })

  describe('type safety', () => {
    it('createCacheableSubject infers type from subscribe', () => {
      const subject = createCacheableSubject<{ id: number; name: string }>()

      subject.subscribe({
        id: 'sub-1',
        next: (value) => {
          // value is { id: number; name; string }
          expect(typeof value[0].id).toBe('number')
          expect(typeof value[0].name).toBe('string')
        },
      })

      subject.next({ id: 1, name: 'test' })
    })

    it('returns both subscribe and next methods', () => {
      const subject = createCacheableSubject<string>()

      expect(typeof subject.subscribe).toBe('function')
      expect(typeof subject.next).toBe('function')
    })
  })

  describe('version', () => {
    it('increments synchronously per next() call, not per flush', async () => {
      const subject = createCacheableSubject<number>()

      expect(subject.version()).toBe(0)

      subject.next(1)
      subject.next(2)
      subject.next(3)

      // Bumped at write time, before any flush has run
      expect(subject.version()).toBe(3)

      await sleep(20)

      // The flush itself does not bump the version
      expect(subject.version()).toBe(3)
    })

    it('is not affected by subscribe/unsubscribe', () => {
      const subject = createCacheableSubject<number>()
      const subscription = subject.subscribe({ id: 'sub-1', next: () => {} })

      expect(subject.version()).toBe(0)

      subscription.unsubscribe()

      expect(subject.version()).toBe(0)
    })
  })

  describe('error isolation', () => {
    it('an observer that throws neither blocks the other observers nor the next flush', async () => {
      const subject = createCacheableSubject<number>()
      const received: Array<Array<number>> = []
      const rethrown: Array<unknown> = []
      const realQueueMicrotask = queueMicrotask

      // The subject re-throws observer errors from their own microtask (so
      // they reach window.onerror): capture them here instead of failing the run
      vi.stubGlobal('queueMicrotask', (cb: () => void) => {
        realQueueMicrotask(() => {
          try { cb() } catch (err) { rethrown.push(err) }
        })
      })

      try {
        subject.subscribe({ id: 'thrower', next: () => { throw new Error('boom') } })
        subject.subscribe({ id: 'ok', next: (values) => { received.push(values) } })

        subject.next(1)
        await sleep(20)

        expect(received).toEqual([ [1] ])
        expect(rethrown.length).toBe(1)
        expect((rethrown[0] as Error).message).toBe('boom')

        // The store is not stuck: the next write still flushes
        subject.next(2)
        await sleep(20)

        expect(received).toEqual([ [1], [2] ])
        expect(rethrown.length).toBe(2)
      } finally {
        vi.unstubAllGlobals()
      }
    })
  })
})
