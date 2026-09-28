import { bench, describe } from 'vitest'

import { cervello } from '../../lib/store/new-index'




describe('proxy hot paths', () => {
  const { store: reassignStore } = cervello({ position: { x: 0, y: 0 }, other: 'value' })

  // Read once so the child proxy exists (its identity is kept across the
  // reassignments); the contentComparer runs on every object write regardless
  void reassignStore.position.x

  let i = 0

  bench('nested object reassignment (content differs)', () => {
    i++
    reassignStore.position = { x: i, y: -i }
  })

  const { store: equalStore } = cervello({ position: { x: 1, y: 2 }, other: 'value' })

  void equalStore.position.x

  bench('nested object reassignment (content equal)', () => {
    equalStore.position = { x: 1, y: 2 }
  })

  const { store: deepStore } = cervello({ a: { b: { c: { d: 1 } } } })

  bench('deep nested read (store.a.b.c.d)', () => {
    void deepStore.a.b.c.d
  })

  const wideInitial: Record<string, number> = {}

  for (let k = 0; k < 100; k++) wideInitial[`k${k}`] = k

  const { store: wideStore } = cervello(wideInitial)

  let w = 0

  bench('flat store writes (100 keys round-robin)', () => {
    w++
    wideStore[`k${w % 100}`] = w
  })
})
