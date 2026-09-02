import { bench, describe } from 'vitest'

import { cervello } from '../../lib/store/new-index'
import { contentComparer, deepClone } from '../../lib/utils/object'




function buildLargeTree (): Record<string, any> {
  const items = []

  for (let i = 0; i < 1000; i++)
    items.push({ id: i, name: `item-${i}`, tags: [`a${i}`, `b${i}`], meta: { active: i % 2 === 0 } })

  return { items, count: items.length, settings: { theme: 'dark', locale: 'es' } }
}

describe('clone & compare', () => {
  const bigArray = []

  for (let i = 0; i < 10000; i++) bigArray.push({ id: i, value: `v${i}` })

  const { store } = cervello({ list: bigArray })

  bench('$value deep clone (10k array of small objects)', () => {
    void store.$value
  })

  const treeA = buildLargeTree()
  const treeB = buildLargeTree()

  bench('contentComparer equal large trees', () => {
    contentComparer(treeA, treeB)
  })

  const treeC = buildLargeTree()

  treeC.items[0].name = 'CHANGED'

  bench('contentComparer unequal-early large trees', () => {
    contentComparer(treeA, treeC)
  })

  const mediumTree = buildLargeTree()

  bench('deepClone medium tree (1k items)', () => {
    deepClone(mediumTree)
  })
})
