import { bench, describe } from 'vitest'

import { createCacheableSubject } from '../../lib/utils/subject'




describe('subject flush', () => {
  const subject = createCacheableSubject<number>()

  for (let i = 0; i < 100; i++)
    subject.subscribe({ id: `observer-${i}`, next: () => {} })

  bench('100 observers, 100 next() per flush cycle', async () => {
    for (let i = 0; i < 100; i++) subject.next(i)

    // The flush microtask was queued before this continuation, so awaiting
    // a resolved promise guarantees the flush has run
    await Promise.resolve()
  })
})
