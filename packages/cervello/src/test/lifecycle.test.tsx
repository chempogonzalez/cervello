import React, { useLayoutEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { cervello } from '../index'




async function sleep (ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Burn synchronous time so the commit exceeds the scheduler's ~5ms frame
// budget and React yields BEFORE running the passive-effects task — that
// yield is the microtask checkpoint where the subject flush drains
const burn = (ms: number): void => {
  const start = performance.now()

  while (performance.now() - start < ms) { /* busy wait */ }
}


/**
 * These tests run WITHOUT act(): act() flushes passive effects before draining
 * microtasks, hiding the missed-update window. In production, when a commit
 * takes longer than the scheduler frame budget (~5ms — routine in real apps),
 * React yields between the commit and the passive-effects task; the subject's
 * microtask flush drains in that gap, BEFORE components subscribe, so any
 * change emitted during the commit is silently lost.
 */
describe('[useStore lifecycle - production effect ordering (no act)]', () => {
  let previousActEnvironment: unknown
  let container: HTMLDivElement

  beforeEach(() => {
    previousActEnvironment = (globalThis as any).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = false
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment
    container.remove()
  })


  it('does not miss a change flushed between render and subscription', async () => {
    const { store, useStore } = cervello({ status: 'initial' })

    function Reader (): JSX.Element {
      const s = useStore()

      return <p>{s.status}</p>
    }

    function Writer (): null {
      useLayoutEffect(() => {
        store.status = 'changed'
        burn(10)
      }, [])

      return null
    }

    const root = createRoot(container)

    try {
      root.render(<><Reader /><Writer /></>)
      await sleep(100)

      expect(container.textContent).toBe('changed')
    } finally {
      root.unmount()
    }
  })


  it('components rendered before an initialValue seeder receive the seeded value', async () => {
    const { useStore } = cervello({ count: 0 })

    function Reader (): JSX.Element {
      const s = useStore()

      return <p>{s.count}</p>
    }

    // The seed is emitted during Seeder's render, before anyone subscribes
    function Seeder (): null {
      useStore({ initialValue: s => ({ ...s, count: 5 }) })

      useLayoutEffect(() => { burn(10) }, [])

      return null
    }

    const root = createRoot(container)

    try {
      root.render(<><Reader /><Seeder /></>)
      await sleep(100)

      expect(container.textContent).toBe('5')
    } finally {
      root.unmount()
    }
  })


  it('a handler that sets local state and then writes to the store renders the component ONCE', async () => {
    const { store, useStore } = cervello({ count: 0 })
    let renders = 0

    function App (): JSX.Element {
      const [open, setOpen] = useState(false)
      const s = useStore()

      renders++

      return (
        <button
          onClick={() => {
            // React renders this SyncLane update in its own microtask, BEFORE
            // the subject flush; that render already reads the new store
            // value, so the flush must not force a second render
            setOpen(true)
            store.count = 1
          }}
        >
          {String(open)}:{s.count}
        </button>
      )
    }

    const root = createRoot(container)

    try {
      root.render(<App />)
      await sleep(50)

      expect(renders).toBe(1)

      container.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await sleep(50)

      expect(container.textContent).toBe('true:1')
      expect(renders).toBe(2)
    } finally {
      root.unmount()
    }
  })
})
