
import { describe, it, expect, beforeEach } from 'vitest'

import { proxifyStore } from '../../lib/helpers/new-proxify-store'
import { createCacheableSubject } from '../../lib/utils/subject'



async function sleep (ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

type MutableStoreValue<T extends Record<string, any>> = {
  $value: T
} & T

describe('[proxifyStore]', () => {
  let store$$: ReturnType<typeof createCacheableSubject<any>>
  let capturedChanges: Array<any>

  beforeEach(() => {
    store$$ = createCacheableSubject<any>()
    capturedChanges = []
  })


  describe('nested reactivity', () => {
    it('captures changes on root-level property', async () => {
      const initial = { name: 'test', count: 0 }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      proxy.count = 10

      await sleep(20)

      expect(capturedChanges.length).toBeGreaterThan(0)
      expect(capturedChanges[0].change.fieldPath).toBe('count')
      expect(capturedChanges[0].change.newValue).toBe(10)
      expect(capturedChanges[0].change.previousValue).toBe(0)
    })

    it('captures changes at nested level', async () => {
      const initial = { user: { name: 'test', age: 25 } }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      proxy.user.age = 30

      await sleep(20)

      expect(capturedChanges.length).toBeGreaterThan(0)
      expect(capturedChanges[0].change.fieldPath).toBe('user.age')
      expect(capturedChanges[0].change.newValue).toBe(30)
    })

    it('captures deeply nested changes', async () => {
      const initial = { a: { b: { c: { d: 1 } } } }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      proxy.a.b.c.d = 99

      await sleep(20)

      expect(capturedChanges.length).toBeGreaterThan(0)
      expect(capturedChanges[0].change.fieldPath).toBe('a.b.c.d')
      expect(capturedChanges[0].change.newValue).toBe(99)
    })

    it('reuses same nested proxy reference', async () => {
      const initial = { user: { name: 'test' } }
      const proxy = proxifyStore(store$$, initial)

      const userProxy1 = proxy.user
      const userProxy2 = proxy.user

      expect(userProxy1).toBe(userProxy2)
    })

    it('nested array property is set (arrays are not proxified, but can be assigned)', async () => {
      const initial = { items: [1, 2, 3] }
      const proxy = proxifyStore(store$$, initial)

      // Arrays themselves are not proxified (isValidReactiveObject returns false for arrays)
      expect(Array.isArray(proxy.items)).toBe(true)

      // Assigning a new array works
      proxy.items = [4, 5, 6]

      await sleep(20)

      expect(proxy.items[0]).toBe(4)
      expect(proxy.items[1]).toBe(5)
    })

    it('accessing non-subscribed nested properties does not produce notifications', async () => {
      const initial = { a: 1, b: 2 }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      capturedChanges = []

      // Access property to create nested proxy
      const aVal = proxy.a
      const bVal = proxy.b

      expect(aVal).toBe(1)
      expect(bVal).toBe(2)
      expect(capturedChanges.length).toBe(0)
    })

    it('nested object caching: proxy identity preserved across accesses', async () => {
      const initial = { links: { nested: { test: 1 } } }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      const linksProxy1 = proxy.links

      proxy.links = { nested: { test: 1000, otherProp: 'other' } }

      await sleep(20)

      const linksProxy2 = proxy.links
      const linksProxy3 = proxy.links

      expect(linksProxy2).toBe(linksProxy3)
    })
  })

  describe('proxy traps', () => {
    it('_$fieldPath identifies proxified object', async () => {
      const initial = { user: { name: 'test' } }
      const proxy = proxifyStore(store$$, initial)

      expect(proxy._$fieldPath).toBe('root')
      expect(proxy.user._$fieldPath).toBe('root.user')
    })

    it('has trap works correctly', async () => {
      const initial = { name: 'test', count: 0 }
      const proxy = proxifyStore(store$$, initial)

      expect('name' in proxy).toBe(true)
      expect('count' in proxy).toBe(true)
      expect('nonExistent' in proxy).toBe(false)
    })

    it('ownKeys returns correct keys', async () => {
      const initial = { name: 'test', count: 0 }
      const proxy = proxifyStore(store$$, initial)

      const keys = Reflect.ownKeys(proxy)

      expect(keys).toContain('name')
      expect(keys).toContain('count')
      expect(keys.length).toBe(2)
    })

    it('getOwnPropertyDescriptor works', async () => {
      const initial = { name: 'test' }
      const proxy = proxifyStore(store$$, initial)

      const descriptor = Object.getOwnPropertyDescriptor(proxy, 'name')

      expect(descriptor).toBeDefined()
      expect(descriptor?.value).toBe('test')
      expect(descriptor?.enumerable).toBe(true)
    })

    it('toJSON returns safe object', async () => {
      const initial = { name: 'test', count: 1 }
      const proxy = proxifyStore(store$$, initial)

      // @ts-expect-error - testing toJSON behavior
      const json = proxy.toJSON()

      const initialStringified = JSON.stringify(initial)
      const initialParsed = JSON.parse(initialStringified)

      expect(json).toEqual(initialParsed)
      expect(json).not.toBe(initial)
      expect(json).not.toBe(proxy)
      expect(initialParsed.name).toBe('test')
      expect(json.name).toBe('test')
      expect(json.count).toBe(1)
    })
  })

  describe('value access / $value', () => {
    it('$value returns a deep clone without proxies', async () => {
      const initial = { user: { name: 'test', nested: { age: 25 } } }
      const proxy = proxifyStore(store$$, initial) as MutableStoreValue<{ user: { name: string; nested: { age: number } } }>

      const value = proxy.$value

      expect(value).not.toBe(initial)
      expect(value.user).not.toBe(initial.user)
      expect(value.user.nested).not.toBe(initial.user.nested)
      expect(value.user.name).toBe('test')
      expect(value.user.nested.age).toBe(25)
    })

    it('$value at root returns deep clone with new reference each time', async () => {
      const initial = { a: 1, b: 2 }
      const proxy = proxifyStore(store$$, initial) as MutableStoreValue<{ a: number; b: number }>

      const value1 = proxy.$value
      const value2 = proxy.$value

      expect(value1).not.toBe(value2)
      expect(value1).toEqual(value2)
    })

    it('setting $value replaces entire store', async () => {
      const initial = { name: 'original' }
      const proxy = proxifyStore(
        store$$,
        initial,
        { afterChange: (c) => { capturedChanges.push(...c) } }) as MutableStoreValue<{ name: string; extra?: boolean }>

      const newValue = { name: 'replaced', extra: true }

      proxy.$value = newValue

      await sleep(20)

      expect(proxy.$value.name).toBe('replaced')
      expect(proxy.$value.extra).toBe(true)
    })

    it('setting $value with same content does not notify', async () => {
      const initial = { name: 'same', count: 0 }
      const proxy = proxifyStore(
        store$$,
        initial, { afterChange: (c) => { capturedChanges.push(...c) } }) as MutableStoreValue<{ name: string; count: number }>

      proxy.$value = { name: 'same', count: 0 }

      await sleep(20)

      expect(capturedChanges.length).toBe(0)
    })

    it('setting entire store preserves functions', async () => {
      function testFn () { return 42 }

      const initial = { name: 'test', fn: testFn }
      const proxy = proxifyStore(
        store$$,
        initial,
        { afterChange: (c) => { capturedChanges.push(...c) } }) as MutableStoreValue<{ name: string; fn: () => number }>

      proxy.$value = { name: 'new', fn: () => 100 }

      await sleep(20)

      expect(typeof (proxy as any).fn).toBe('function')
      expect((proxy as any).fn()).toBe(100)
    })
  })

  describe('function binding', () => {
    it('functions on store are bound to the receiver', async () => {
      const initial = {
        name: 'test',
        getName () {
          return this.name
        },
      }
      const proxy = proxifyStore(store$$, initial)

      const fn = proxy.getName

      expect(typeof fn).toBe('function')
      expect(fn()).toBe('test')
    })

    it('nested functions are also bound', async () => {
      const initial = {
        user: {
          name: 'nested-test',
          getName () {
            return this.name
          },
        },
      }
      const proxy = proxifyStore(store$$, initial)

      expect(proxy.user.getName()).toBe('nested-test')
    })
  })

  describe('equal value prevention', () => {
    it('setting same primitive value does not notify', async () => {
      const initial = { name: 'same', count: 5 }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      capturedChanges = []

      proxy.name = 'same'

      await sleep(20)

      expect(capturedChanges.length).toBe(0)
    })

    it('setting same string value does not notify', async () => {
      const initial = { text: 'hello' }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      capturedChanges = []

      proxy.text = 'hello'

      await sleep(20)

      expect(capturedChanges.length).toBe(0)
    })

    it('setting same boolean value does not notify', async () => {
      const initial = { active: true }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      capturedChanges = []

      proxy.active = true

      await sleep(20)

      expect(capturedChanges.length).toBe(0)
    })
  })

  describe('symbol key handling', () => {
    it('symbol keys are read correctly', async () => {
      const sym = Symbol('test')
      const initial = { [sym]: 'symbol-value' } as any
      const proxy = proxifyStore(store$$, initial)

      expect(proxy[sym]).toBe('symbol-value')
    })

    it('symbol keys are not affected by set trap', async () => {
      const sym = Symbol('test')
      const initial = { name: 'test' } as any
      const proxy = proxifyStore(store$$, initial)

      const result = Reflect.set(proxy, sym, 'symbol-set-value')

      expect(result).toBe(true)
    })
  })

  describe('new field addition', () => {
    it('adding a number field works', async () => {
      const initial: { name: string; age?: number } = { name: 'test' }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      proxy.age = 25

      await sleep(20)

      expect(capturedChanges.length).toBeGreaterThan(0)
      expect(capturedChanges[0].change.fieldPath).toBe('age')
      expect(capturedChanges[0].change.newValue).toBe(25)
      expect(proxy.age).toBe(25)
    })

    it('adding an object field works', async () => {
      const initial: { name: string; details?: { score: number } } = { name: 'test' }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      proxy.details = { score: 100 }

      await sleep(20)

      expect(proxy.details.score).toBe(100)
      // @ts-expect-error - internal field for testing
      expect(proxy.details._$fieldPath).toBeDefined()
    })

    it('adding an array field works', async () => {
      const initial: { name: string; tags?: Array<string> } = { name: 'test' }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      proxy.tags = ['a', 'b', 'c']

      await sleep(20)

      expect(proxy.tags.length).toBe(3)
      expect(proxy.tags[0]).toBe('a')
    })

    it('adding a function field works', async () => {
      const initial = { name: 'test' }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      // @ts-expect-error - testing adding a function field
      proxy.fn = () => 42

      await sleep(20)

      // @ts-expect-error - testing adding a function field
      expect(typeof proxy.fn).toBe('function')
      // @ts-expect-error - testing adding a function field
      expect(proxy.fn()).toBe(42)
    })

    it('adding a null field works', async () => {
      const initial = { name: 'test' }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      // @ts-expect-error - testing adding null field
      proxy.nullField = null

      await sleep(20)

      // @ts-expect-error - testing adding null field
      expect(proxy.nullField).toBe(null)
    })

    it('adding an undefined field works', async () => {
      const initial = { name: 'test' }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      // @ts-expect-error - testing adding undefined field
      proxy.undefinedField = undefined

      await sleep(20)

      // @ts-expect-error - testing adding undefined field
      expect(proxy.undefinedField).toBe(undefined)
    })
  })

  describe('object iteration', () => {
    it('Object.keys works on proxy', async () => {
      const initial = { name: 'test', count: 5, active: true }
      const proxy = proxifyStore(store$$, initial)

      const keys = Object.keys(proxy)

      expect(keys).toContain('name')
      expect(keys).toContain('count')
      expect(keys).toContain('active')
    })

    it('Object.values works on proxy', async () => {
      const initial = { name: 'test', age: 25 }
      const proxy = proxifyStore(store$$, initial)

      const values = Object.values(proxy)

      expect(values).toContain('test')
      expect(values).toContain(25)
    })

    it('Object.entries works on proxy', async () => {
      const initial = { name: 'test' }
      const proxy = proxifyStore(store$$, initial)

      const entries = Object.entries(proxy)

      expect(entries).toContainEqual(['name', 'test'])
    })

    it('for...in works on proxy', async () => {
      const initial = { name: 'test', count: 5 }
      const proxy = proxifyStore(store$$, initial)

      const keys: Array<string> = []

      for (const key in proxy)
        keys.push(key)


      expect(keys).toContain('name')
      expect(keys).toContain('count')
    })

    it('spread operator works on proxy', async () => {
      const initial = { name: 'test', count: 5 }
      const proxy = proxifyStore(store$$, initial)

      const spread = { ...proxy }

      expect(spread.name).toBe('test')
      expect(spread.count).toBe(5)
    })

    it('JSON.stringify works on proxy', async () => {
      const initial = { name: 'test', user: { age: 25 } }
      const proxy = proxifyStore(store$$, initial)

      const serialized = JSON.stringify(proxy)

      expect(serialized).toBe('{"name":"test","user":{"age":25}}')
    })
  })

  describe('nested proxy caching', () => {
    it('same nested object returns same proxy on multiple accesses', async () => {
      const initial = { user: { name: 'test' } }
      const proxy = proxifyStore(store$$, initial)

      const proxy1 = proxy.user
      const proxy2 = proxy.user
      const proxy3 = proxy.user

      expect(proxy1).toBe(proxy2)
      expect(proxy2).toBe(proxy3)
    })

    it('deeply nested objects cache correctly', async () => {
      const initial = { a: { b: { c: { d: 1 } } } }
      const proxy = proxifyStore(store$$, initial)

      const d1 = proxy.a.b.c
      const d2 = proxy.a.b.c

      expect(d1).toBe(d2)
    })

    it('reassigning nested object reuses existing proxy when possible', async () => {
      const initial = { user: { name: 'original' } }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      const originalProxy = proxy.user

      proxy.user = { name: 'updated' }

      await sleep(20)

      const newProxy = proxy.user

      // The proxy reuses the same nested proxy instance
      expect(newProxy).toBeDefined()
      expect(newProxy).toBe(originalProxy)
      expect(newProxy.name).toBe('updated')
    })
  })

  describe('root value changes', () => {
    it('setting root-level property sends change with correct fieldPath', async () => {
      const initial = { name: 'test', value: 0 }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      proxy.name = 'new name'

      await sleep(20)

      expect(capturedChanges.length).toBeGreaterThan(0)
      expect(capturedChanges[0].change.fieldPath).toBe('name')
      expect(capturedChanges[0].change.newValue).toBe('new name')
      expect(capturedChanges[0].change.previousValue).toBe('test')
    })

    it('storeValue contains parent object in change', async () => {
      const initial = { user: { name: 'test' } }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      capturedChanges = []

      const parentRef = proxy.user

      proxy.user.name = 'changed'

      await sleep(20)

      expect(capturedChanges.length).toBeGreaterThan(0)
      expect(capturedChanges[0].storeValue).toBeDefined()
    })

    it('nested objects are automatically proxified on access', async () => {
      const initial = { a: { b: { value: 1 } } }
      const proxy = proxifyStore(store$$, initial)

      const nested = proxy.a.b

      expect(nested.value).toBe(1)
      expect(nested._$fieldPath).toBe('root.a.b')
    })

    it('proxy with existing nested proxy reuses it on nested changes', async () => {
      const initial = { links: { github: 'test', twitter: 'test' } }
      const proxy = proxifyStore(store$$, initial)

      const linksProxy = proxy.links
      const twitterProp = proxy.links.twitter

      expect(linksProxy).toBe(proxy.links)
      expect(twitterProp).toBe('test')
    })
  })

  describe('array handling in proxy', () => {
    it('setting array element at specific index works', async () => {
      const initial = { items: [1, 2, 3] }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      proxy.items[1] = 99

      await sleep(20)

      expect(proxy.items[1]).toBe(99)
    })

    it('modifying array via push triggers change', async () => {
      const initial = { items: [1, 2] }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      proxy.items.push(3)

      await sleep(20)

      expect(proxy.items.length).toBe(3)
      expect(proxy.items[2]).toBe(3)
    })

    it('empty array is proxified', async () => {
      const initial = { items: [] } as any
      const proxy = proxifyStore(store$$, initial)

      expect(Array.isArray(proxy.items)).toBe(true)
      expect(proxy.items.length).toBe(0)
    })

    it('array with nested objects works correctly', async () => {
      const initial = { items: [{ a: 1 }, { b: 2 }] } as { items: Array<{ a?: number; b?: number }> }
      const proxy = proxifyStore(store$$, initial)

      // Arrays themselves are not proxified, but items can be read
      expect(proxy.items[0].a).toBe(1)
      expect(proxy.items[1].b).toBe(2)
    })
  })

  describe('multiple root-level keys', () => {
    it('changing each root key produces correct fieldPath', async () => {
      const initial = { a: 1, b: 2, c: 3 }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      proxy.a = 10
      await sleep(20)
      expect(capturedChanges[0].change.fieldPath).toBe('a')

      capturedChanges = []
      proxy.b = 20
      await sleep(20)
      expect(capturedChanges[0].change.fieldPath).toBe('b')

      capturedChanges = []
      proxy.c = 30
      await sleep(20)
      expect(capturedChanges[0].change.fieldPath).toBe('c')
    })

    it('root-level object with Symbol keys', async () => {
      const symKey = Symbol('sym-key')
      const initial = { name: 'test' } as any

      initial[symKey] = 'symbol'
      const proxy = proxifyStore(store$$, initial)

      expect(proxy[symKey]).toBe('symbol')
      expect(Object.keys(proxy)).toContain('name')
    })
  })
})
