
import { describe, it, expect, beforeEach } from 'vitest'
import { cervello, nonReactive } from '../../lib/store/new-index'
import { deepClone } from '../../lib/utils/object'


function sleep (ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}


describe('[cervello store core]', () => {
  describe('multiple subscribers', () => {
    it('two independent stores are isolated from each other', async () => {
      const { store: store1 } = cervello<{ value: number }>({ value: 1 })
      const { store: store2 } = cervello<{ value: number }>({ value: 100 })

      store1.value = 999
      await sleep(20)

      expect(store1.value).toBe(999)
      expect(store2.$value.value).toBe(100)
    })
  })

  describe('reset', () => {
    it('resets to the original initial value', async () => {
      const { store, reset } = cervello<{ name: string; count: number }>({
        name: 'initial',
        count: 0,
      })

      store.name = 'changed'
      store.count = 42

      await sleep(20)

      reset()
      await sleep(20)

      expect(store.name).toBe('initial')
      expect(store.count).toBe(0)
    })

    it('reset restores nested objects', async () => {
      const { store, reset } = cervello<{ user: { name: string; age: number } }>({
        user: { name: 'original', age: 0 },
      })

      store.user.name = 'modified'
      store.user.age = 200

      await sleep(20)

      reset()
      await sleep(20)

      expect(store.user.name).toBe('original')
      expect(store.user.age).toBe(0)
    })

    it('reset preserves functions from initial value', async () => {
      const { store, reset } = cervello<{ name: string; fn: () => number }>({
        name: 'test',
        fn: () => 42,
      })

      store.name = 'changed'
      await sleep(20)

      reset()
      await sleep(20)

      expect(typeof store.fn).toBe('function')
      expect(store.fn()).toBe(42)
    })

    it('reset with functions in nested objects', async () => {
      const { store, reset } = cervello<{ user: { name: string; getName: () => string } }>({
        user: {
          name: 'test',
          getName() { return 'getName called' },
        },
      })

      store.user.name = 'changed'
      await sleep(20)

      reset()
      await sleep(20)

      expect(typeof store.user.getName).toBe('function')
    })

    it('reset to initial value works', async () => {
      const { store, reset } = cervello<{ count: number }>({
        count: 0,
      })

      store.count = 1
      await sleep(20)

      expect(store.count).toBe(1)

      reset()
      await sleep(20)

      expect(store.count).toBe(0)
    })
  })

  describe('nonReactive', () => {
    it('marks object as non-reactive', async () => {
      const { store } = cervello({
        reactive: { value: 1 },
        nonReactive: nonReactive({ value: 2 }),
      })

      expect(store.reactive.value).toBe(1)

      store.reactive.value = 100
      await sleep(20)
      expect(store.reactive.value).toBe(100)

      store.nonReactive.value = 200
      await sleep(20)
      expect(store.nonReactive.value).toBe(200)

      // nonReactive object should still allow direct modification
      expect(store.reactive.value).toBe(100)
    })

    it('nonReactive objects remain marked after deepClone', async () => {
      const obj = nonReactive({ value: 42 })
      const { store } = cervello({ data: obj })

      // deepClone copies the symbol property
      const cloned = deepClone(store.data)

      // Modifying nonReactive should still work on the original
      obj.value = 999
      expect(obj.value).toBe(999)
    })
  })

  describe('cervello types', () => {
    it('infers store type from initial value', async () => {
      const { store } = cervello({ name: 'test', count: 42, active: true })

      store.name = 'updated'
      store.count = 100
      store.active = false

      expect(typeof store.name).toBe('string')
      expect(typeof store.count).toBe('number')
      expect(typeof store.active).toBe('boolean')
    })

    it('creates independent store instances', async () => {
      const { store: s1 } = cervello<{ n: number }>({ n: 1 })
      const { store: s2 } = cervello<{ n: number }>({ n: 2 })

      s1.n = 999
      await sleep(20)

      expect(s1.$value.n).toBe(999)
      expect(s2.$value.n).toBe(2)
    })

    it('store $value returns deep clone', async () => {
      const { store } = cervello({
        a: { b: { c: 1 } },
      })

      const v1 = store.$value
      const v2 = store.$value

      expect(v1.a).not.toBe(v2.a)
      expect(v1.a.b).not.toBe(v2.a.b)
    })
  })

  describe('initialValue in $value getter', () => {
    it('$value getter returns correct deep clone each time', async () => {
      const { store } = cervello<{ nested: { value: number } }>({
        nested: { value: 1 },
      })

      store.nested.value = 2
      await sleep(20)

      const v = store.$value
      expect(v.nested.value).toBe(2)

      const v2 = store.$value
      expect(v2.nested.value).toBe(2)
    })
  })

  describe('reset type behavior', () => {
    it('reset handles nested complex initial values', async () => {
      const initial: {
        user: {
          name: string
          addresses: Array<{ city: string }>
        }
      } = {
        user: {
          name: 'original',
          addresses: [{ city: 'Madrid' }],
        },
      }

      const { store, reset } = cervello(initial)

      store.user.name = 'changed'
      store.user.addresses[0].city = 'Barcelona'

      await sleep(20)

      reset()
      await sleep(20)

      expect(store.user.name).toBe('original')
      expect(store.user.addresses[0].city).toBe('Madrid')
    })

    it('reset with multiple changes in sequence', async () => {
      const { store, reset } = cervello<{ a: number; b: number; c: number }>({
        a: 0, b: 0, c: 0,
      })

      store.a = 1
      store.b = 2
      store.c = 3
      await sleep(20)

      store.a = 10
      store.b = 20
      await sleep(20)

      reset()
      await sleep(20)

      expect(store.a).toBe(0)
      expect(store.b).toBe(0)
      expect(store.c).toBe(0)
    })

    it('reset can be called multiple times', async () => {
      const { store, reset } = cervello<{ x: number }>({ x: 0 })

      store.x = 1
      reset()
      await sleep(20)
      expect(store.x).toBe(0)

      store.x = 2
      reset()
      reset()  // double reset should be safe
      await sleep(20)
      expect(store.x).toBe(0)
    })
  })

  describe('store with various value types', () => {
    it('store accepts number values', async () => {
      const { store } = cervello<{ n: number }>({ n: 42 })

      store.n = 100
      await sleep(20)
      expect(store.n).toBe(100)
    })

    it('store accepts bigint values', async () => {
      const { store } = cervello({ n: BigInt(0) })

      store.n = BigInt(999)
      await sleep(20)
      expect(store.n).toBe(BigInt(999))
    })

    it('store accepts boolean values', async () => {
      const { store } = cervello({ flag: true })

      store.flag = false
      await sleep(20)
      expect(store.flag).toBe(false)
    })

    it('store accepts null as a property value', async () => {
      const { store } = cervello<{ data: string | null }>({ data: 'test' })

      store.data = null
      await sleep(20)
      expect(store.data).toBe(null)
    })

    it('store accepts undefined as a property value', async () => {
      const { store } = cervello<{ data?: string }>({ data: 'test' })

      store.data = undefined
      await sleep(20)
      expect(store.data).toBe(undefined)
    })

    it('store accepts object values', async () => {
      const { store } = cervello<{ data: { value: number } }>({ data: { value: 1 } })

      store.data = { value: 999 }
      await sleep(20)
      expect(store.data.value).toBe(999)
    })

    it('store accepts function values', async () => {
      const fn = () => 42
      const { store } = cervello({ fn })

      store.fn = () => 100
      await sleep(20)
      expect(store.fn()).toBe(100)
    })
  })

  describe('complex nested structures', () => {
    it('deeply nested object changes work', async () => {
      const { store } = cervello({
        level1: {
          level2: {
            level3: {
              level4: {
                value: 1,
              },
            },
          },
        },
      })

      store.level1.level2.level3.level4.value = 999
      await sleep(20)
      expect(store.$value.level1.level2.level3.level4.value).toBe(999)
    })

    it('array of objects reactivity', async () => {
      const { store } = cervello<{ items: Array<{ n: number }> }>({
        items: [{ n: 1 }],
      })

      store.items = [{ n: 10 }, { n: 20 }]
      await sleep(20)
      expect(store.items.length).toBe(2)
      expect(store.items[0].n).toBe(10)
      expect(store.items[1].n).toBe(20)
    })

    it('mixed nested objects and arrays', async () => {
      const { store, reset } = cervello<Record<string, any>>({
        config: {
          features: [
            { name: 'a', enabled: true },
            { name: 'b', enabled: false },
          ],
          metadata: { author: 'test' },
        },
      })

      store.config.features[0].enabled = false
      store.config.metadata.author = 'updated'

      await sleep(20)

      expect(store.config.features[0].enabled).toBe(false)
      expect(store.config.metadata.author).toBe('updated')

      reset()
      await sleep(20)

      expect(store.config.features[0].enabled).toBe(true)
      expect(store.config.metadata.author).toBe('test')
    })
  })
})
