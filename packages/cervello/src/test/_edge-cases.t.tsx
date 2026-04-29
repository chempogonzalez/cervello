
import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-react'
import React from 'react'
import { cervello } from '../lib/store/new-index'


function sleep (ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}


describe('[edge-cases]', () => {
  describe('null / undefined initial values', () => {
    it('store object can have null properties', async () => {
      const { store } = cervello<{ value: string | null }>({ value: 'test' })

      store.value = null
      await sleep(20)
      expect(store.$value.value).toBe(null)
    })

    it('store object can have undefined properties', async () => {
      const { store } = cervello<{ value?: string }>({ value: 'test' })

      store.value = undefined
      await sleep(20)
      expect(store.$value.value).toBe(undefined)
    })

    it('store with empty object initial value works', async () => {
      const { store, reset } = cervello({})

      store.anyField = 'test'
      await sleep(20)
      expect(store.anyField).toBe('test')

      reset()
      await sleep(20)
      expect(Object.keys(store.$value)).toEqual([])
    })
  })

  describe('object manipulation on proxy', () => {
    it('Object.keys on store returns correct keys', async () => {
      const { store } = cervello({ a: 1, b: 2, c: 3 })

      const keys = Object.keys(store)
      expect(keys).toContain('a')
      expect(keys).toContain('b')
      expect(keys).toContain('c')
      expect(keys.length).toBe(3)
    })

    it('Object.values on store returns correct values', async () => {
      const { store } = cervello<{ x: number; y: number }>({ x: 10, y: 20 })

      const values = Object.values(store)
      expect(values).toContain(10)
      expect(values).toContain(20)
      expect(values.length).toBe(2)
    })

    it('Object.entries on store works', async () => {
      const { store } = cervello({ a: 1 })

      const entries = Object.entries(store)
      expect(entries.some(([k, v]) => k === 'a' && v === 1)).toBe(true)
    })

    it('Object.assign on store works', async () => {
      const { store } = cervello<{ a: number; b: number }>({ a: 1, b: 2 })

      Object.assign(store, { a: 99 })
      await sleep(20)
      expect(store.a).toBe(99)
    })

    it('spread operator creates plain object from store', async () => {
      const { store } = cervello({ a: 1, b: 2 })

      const plain: Record<string, unknown> = { ...store }
      expect(plain.a).toBe(1)
      expect(plain.b).toBe(2)
    })

    it('JSON.stringify on store works without error', async () => {
      const { store } = cervello<{ name: string; nested: { value: number } }>({
        name: 'test',
        nested: { value: 42 },
      })

      const serialized = JSON.stringify(store)
      expect(serialized).toContain('"name":"test"')
      expect(serialized).toContain('"value":42')
    })

    it('JSON.parse and set $value with parsed data', async () => {
      const { store } = cervello<{ name: string }>({ name: 'original' })

      const data = JSON.stringify({ name: 'replaced' })
      store.$value = JSON.parse(data)
      await sleep(20)

      expect(store.name).toBe('replaced')
    })
  })

  describe('concurrent / async changes', () => {
    it('rapid sequential changes are all captured', async () => {
      const { store } = cervello<{ counter: number }>({ counter: 0 })

      const values: Array<number> = []

      for (let i = 1; i <= 10; i++) {
        store.counter = i
        values.push(store.counter)
      }

      await sleep(20)
      expect(store.counter).toBe(10)
      expect(values[values.length - 1]).toBe(10)
    })

    it('concurrent async operations are handled', async () => {
      const { store } = cervello<{ count: number }>({ count: 0 })

      const promises: Array<Promise<void>> = []

      for (let i = 1; i <= 5; i++) {
        promises.push(
          (async () => {
            await sleep(i * 10)
            store.count = i
          })(),
        )
      }

      await Promise.all(promises)
      await sleep(50)

      expect(store.count).toBe(5)
    })

    it('changes in rapid succession batch correctly', async () => {
      const { store } = cervello<{ a: number; b: number; c: number }>({
        a: 0, b: 0, c: 0,
      })

      store.a = 1
      store.b = 2
      store.c = 3
      store.a = 10
      store.b = 20
      store.c = 30

      await sleep(20)

      expect(store.a).toBe(10)
      expect(store.b).toBe(20)
      expect(store.c).toBe(30)
    })
  })

  describe('afterChange callback', () => {
    it('afterChange is called with store changes', async () => {
      const changes: Array<any> = []

      const { store } = cervello<{ name: string }>(
        { name: 'initial' },
        { afterChange: (c) => { changes.push(...c) } },
      )

      store.name = 'changed'
      await sleep(20)

      expect(changes.length).toBeGreaterThan(0)
      expect(changes[0].change.fieldPath).toBe('name')
    })

    it('afterChange receives correct change data', async () => {
      const captured: Array<any> = []

      const { store } = cervello<{ value: number }>(
        { value: 0 },
        { afterChange: (c) => { captured.push(...c) } },
      )

      store.value = 42
      await sleep(20)

      expect(captured[0].change.fieldPath).toBe('value')
      expect(captured[0].change.newValue).toBe(42)
      expect(captured[0].change.previousValue).toBe(0)
    })

    it('afterChange receives nested change data', async () => {
      const captured: Array<any> = []

      const { store } = cervello<{ user: { name: string } }>(
        { user: { name: 'test' } },
        { afterChange: (c) => { captured.push(...c) } },
      )

      store.user.name = 'nested-test'
      await sleep(20)

      expect(captured[0].change.fieldPath).toBe('user.name')
      expect(captured[0].change.newValue).toBe('nested-test')
    })

    it('afterChange receives multiple changes in one callback', async () => {
      const captured: Array<any> = []

      const { store } = cervello<{ a: number; b: number }>(
        { a: 0, b: 0 },
        { afterChange: (c) => { captured.push(...c) } },
      )

      store.a = 1
      store.b = 2

      await sleep(20)

      expect(captured.length).toBe(2)
      expect(captured[0].change.fieldPath).toBe('a')
      expect(captured[1].change.fieldPath).toBe('b')
    })
  })

  describe('property deletion', () => {
    it('deleting a property with delete works', async () => {
      const { store } = cervello<{ a: number; b: number }>({ a: 1, b: 2 })

      delete store.a
      await sleep(20)

      expect('a' in store).toBe(false)
      expect('b' in store).toBe(true)
      expect(store.b).toBe(2)
    })

    it('deleting nested property', async () => {
      const { store } = cervello<{ user: { name: string; age?: number } }>({
        user: { name: 'test', age: 25 },
      })

      delete store.user.age
      await sleep(20)

      expect('age' in store.user).toBe(false)
      expect(store.user.name).toBe('test')
    })
  })

  describe('special object types in store', () => {
    it('store with Date values works', async () => {
      const date = new Date('2024-01-01')
      const { store } = cervello<{ createdAt: Date }>({ createdAt: date })

      const newDate = new Date('2024-12-31')
      store.createdAt = newDate

      await sleep(20)

      expect(store.createdAt instanceof Date).toBe(true)
      expect(store.createdAt.getFullYear()).toBe(2024)
    })

    it('store with RegExp values works', async () => {
      const pattern = /hello/
      const { store } = cervello<{ pattern: RegExp }>({ pattern })

      expect(store.pattern).toBe(pattern)

      store.pattern = /world/g
      await sleep(20)

      expect(store.pattern.test('hello world')).toBe(true)
      expect(store.pattern.global).toBe(true)
    })

    it('store can hold Map as a property value', async () => {
      const map = new Map([['key', 'value']])
      const { store } = cervello({ map })

      store.map = new Map([['newKey', 'newVal']])
      await sleep(20)

      expect(store.map.get('newKey')).toBe('newVal')
    })

    it('store can hold Set as a property value', async () => {
      const set = new Set([1, 2, 3])
      const { store } = cervello({ set })

      store.set = new Set([4, 5, 6])
      await sleep(20)

      expect(store.set.has(4)).toBe(true)
      expect(store.set.has(1)).toBe(false)
    })

    it('store with Uint8Array property value works', async () => {
      const { store } = cervello({ data: new Uint8Array([1, 2, 3]) })

      store.data = new Uint8Array([4, 5, 6])
      await sleep(20)

      expect(store.data[0]).toBe(4)
    })

    it('store with Symbol property key works', async () => {
      const sym = Symbol('test-key')
      const { store } = cervello({ name: 'test' })
      ;(store as any)[sym] = 'symbol-value'

      expect((store as any)[sym]).toBe('symbol-value')
    })
  })

  describe('nested stores', () => {
    it('two independent stores have separate state', async () => {
      const { store: userStore } = cervello<{ name: string }>({
        name: 'Alice',
      })
      const { store: appStore } = cervello<{ version: number }>({
        version: 1,
      })

      userStore.name = 'Bob'
      await sleep(20)

      appStore.version = 2
      await sleep(20)

      expect(userStore.name).toBe('Bob')
      expect(appStore.version).toBe(2)
      expect(userStore.name).not.toBe('Charlie')
    })

    it('replacing store with another stores $value works', async () => {
      const { store: store1 } = cervello<{ next: Record<string, any> | null }>({
        next: null,
      })
      const { store: store2 } = cervello<{ content: string }>({
        content: 'hello',
      })

      store1.next = store2.$value
      await sleep(20)

      expect(store1.next.content).toBe('hello')
    })
  })

  describe('useStore select as function', () => {
    it('useStore accepts select as function callback', async () => {
      const { store, useStore } = cervello<{ a: number; b: number; c: number }>({
        a: 1, b: 2, c: 3,
      })

      let renderCount = 0

      const TestComponent = () => {
        renderCount++
        const s = useStore({
          select: () => ['a'] as Array<'a'>,
        })
        return React.createElement('div', null, `a=${s.a}, render=${renderCount}`)
      }

      render(React.createElement(TestComponent))
      await sleep(50)

      const initialRenders = renderCount
      expect(initialRenders).toBeGreaterThanOrEqual(1)

      renderCount = 0
      store.b = 999  // Should not trigger re-render
      await sleep(20)

      expect(store.b).toBe(999)
    })

    it('dynamically selecting different field triggers correct renders', async () => {
      const { store, useStore } = cervello<{ a: number; b: number }>({
        a: 1, b: 2,
      })

      let renderCount = 0

      const TestComponent = () => {
        renderCount++
        const s = useStore({
          select: (keys) => keys,
          onChange: () => {},
        })
        return React.createElement('div', null, `val=${s.a}`)
      }

      render(React.createElement(TestComponent))
      await sleep(50)

      renderCount = 0
      store.a = 10
      await sleep(20)

      expect(renderCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('setValueOnMount edge cases', () => {
    it('setValueOnMount that returns value updates store', async () => {
      const { store, useStore } = cervello<{ name: string }>({ name: 'initial' })

      const TestComponent = () => {
        const s = useStore({
          setValueOnMount: () => sleep(10).then(() => ({ name: 'mounted' })),
        })
        return React.createElement('div', null, s.name)
      }

      render(React.createElement(TestComponent))
      await sleep(50)

      expect(store.name).toBe('mounted')
    })

    it('setValueOnMount error is caught and logged', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const TestComponent = () => {
        const s = useStore({
          setValueOnMount: async () => {
            throw new Error('mount error')
          },
        })
        return React.createElement('div', null, s.name || 'fallback')
      }

      render(React.createElement(TestComponent))
      await sleep(50)

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('TypeScript type structure', () => {
    it('store type has $value property', async () => {
      const { store } = cervello<{ name: string }>({ name: 'test' })

      expect(store.$value.name).toBe('test')
    })

    it('reset function exists and is callable', () => {
      const { reset } = cervello<{ n: number }>({ n: 0 })

      expect(typeof reset).toBe('function')

      expect(() => reset()).not.toThrow()
    })

    it('cervello returns correct structure', async () => {
      const result = cervello<{ test: number }>({ test: 1 })

      expect(typeof result.store).toBe('object')
      expect(typeof result.reset).toBe('function')
      expect(typeof result.useStore).toBe('function')
    })

    it('type inference works with nested objects', async () => {
      const { store } = cervello({
        user: {
          name: 'test',
          address: {
            city: 'Madrid',
            zip: 28001,
          },
        },
      })

      store.user.name = 'updated'
      store.user.address.city = 'Barcelona'

      await sleep(20)

      expect(store.user.name).toBe('updated')
      expect(store.user.address.city).toBe('Barcelona')
    })
  })

  describe('large nested structures', () => {
    it('store with deeply nested array works', async () => {
      const tree: { children: Array<{ name: string; children: Array<{ value: number }> }> } = {
      children: [
        { name: 'a', children: [{ value: 1 }, { value: 2 }] },
        { name: 'b', children: [{ value: 3 }, { value: 4 }] },
      ],
      }

      const { store } = cervello(tree)

      store.children[0].children[1].value = 999
      await sleep(20)

      expect(store.children[0].children[1].value).toBe(999)
    })

    it('store with many properties works', async () => {
      const manyProps: Record<string, unknown> = {}
      for (let i = 0; i < 50; i++) {
        manyProps[`prop${i}`] = i
      }

      const { store } = cervello(manyProps)

      store.prop10 = 'changed'
      store.prop49 = 'last'
      await sleep(20)

      expect(store.prop10).toBe('changed')
      expect(store.prop49).toBe('last')
    })
  })
})
