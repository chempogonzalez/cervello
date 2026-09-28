import React, { StrictMode } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { act, render, screen } from 'vitest-react'

import { cervello } from '../lib/store/new-index'




async function sleep (ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}


/**
 * Lock-in tests for the intended StrictMode semantics, so future refactors
 * cannot silently change them:
 * - `initialValue` is render-phase code, so StrictMode double-invokes it
 *   (same contract as useState initializers); the second run finds the store
 *   already seeded and the comparer turns it into a no-op
 * - `setValueOnMount` runs once per effect mount — twice under StrictMode,
 *   which is React's contract for mount effects — and the store converges
 * - the subscription survives StrictMode's unsubscribe/resubscribe cycle
 */
describe('[StrictMode]', () => {
  it('initialValue is double-invoked but an idempotent seed converges', async () => {
    const { store, useStore } = cervello({ count: 0 })
    const initialValue = vi.fn((s: { count: number }) => ({ ...s, count: 5 }))

    function App (): JSX.Element {
      const s = useStore({ initialValue })

      return <p data-testid='count'>{s.count}</p>
    }

    render(<StrictMode><App /></StrictMode>)

    await act(async () => { await sleep(20) })

    // React discards the first render pass in StrictMode (fresh hook state),
    // so the callback runs once per pass; the second pass produces the same
    // value and the comparer makes the reseed a no-op
    expect(initialValue).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('count').textContent).toBe('5')
    expect(store.count).toBe(5)
  })


  it('afterChange for an initialValue seed never runs during the render phase', async () => {
    let rendering = false
    const seenWhileRendering: Array<boolean> = []

    const { useStore } = cervello({ count: 0 }, {
      afterChange: () => { seenWhileRendering.push(rendering) },
    })

    function App (): JSX.Element {
      rendering = true

      const s = useStore({ initialValue: s => ({ ...s, count: 5 }) })
      const view = <p data-testid='count'>{s.count}</p>

      rendering = false

      return view
    }

    render(<StrictMode><App /></StrictMode>)

    await act(async () => { await sleep(20) })

    expect(screen.getByTestId('count').textContent).toBe('5')
    // Fired once (the second StrictMode seed is content-equal), outside the render
    expect(seenWhileRendering).toEqual([false])
  })


  it('setValueOnMount runs on each effect mount (twice) and the store converges', async () => {
    const { useStore } = cervello({ status: 'initial' })
    const setValueOnMount = vi.fn(async (s: { status: string }) => ({ ...s, status: 'loaded' }))

    function App (): JSX.Element {
      const s = useStore({ setValueOnMount })

      return <p data-testid='status'>{s.status}</p>
    }

    render(<StrictMode><App /></StrictMode>)

    await act(async () => { await sleep(30) })

    // React intentionally double-invokes mount effects in StrictMode; the
    // second (content-equal) resolution is a no-op thanks to the comparer
    expect(setValueOnMount).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('status').textContent).toBe('loaded')
  })


  it('subscription survives the StrictMode unsubscribe/resubscribe cycle', async () => {
    const { store, useStore } = cervello({ count: 0 })
    const renderCounter = vi.fn()

    function App (): JSX.Element {
      const s = useStore()

      renderCounter()

      return <p data-testid='count'>{s.count}</p>
    }

    render(<StrictMode><App /></StrictMode>)

    await act(async () => { await sleep(20) })

    renderCounter.mockClear()

    await act(async () => {
      store.count = 10
      await sleep(20)
    })

    expect(screen.getByTestId('count').textContent).toBe('10')
    // One committed re-render for the change (StrictMode double-invokes it)
    expect(renderCounter).toHaveBeenCalledTimes(2)
  })
})
