
import { describe, it, expect, beforeEach } from 'vitest'

import { proxifyStore, RAW_VALUE } from '../../lib/helpers/new-proxify-store'
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

      proxy.links = { nested: { test: 1000, otherProp: 'other' } } as any

      await sleep(20)

      const linksProxy2 = proxy.links

      expect(linksProxy1).toBe(linksProxy2)
    })
  })

  describe('proxy traps', () => {
    it('_$fieldPath identifies proxified object', async () => {
      const initial = { user: { name: 'test' } }
      const proxy = proxifyStore(store$$, initial)

      // @ts-expect-error - internal field for testing
      expect(proxy._$fieldPath).toBe('root')
      // @ts-expect-error - internal field for testing
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

    it('$value clone is mutation-independent from the underlying proxy', async () => {
      const initial = { user: { name: 'test', nested: { age: 25 } } }
      const proxy = proxifyStore(store$$, initial) as MutableStoreValue<{ user: { name: string; nested: { age: number } } }>

      const value = proxy.$value

      // Mutate the clone returned by $value
      value.user.name = 'MUTATED'
      value.user.nested = { age: 999 }

      // The underlying proxy must not be affected by the clone mutation
      expect(proxy.user.name).toBe('test')
      expect(proxy.user.nested.age).toBe(25)
    })

    it('$value returns plain objects even when nested proxies have been created', async () => {
      const initial = { a: { b: { c: 1 } } }
      const proxy = proxifyStore(store$$, initial) as MutableStoreValue<{ a: { b: { c: number } } }>

      // Access nested property to create the nested proxy
      expect(proxy.a.b.c).toBe(1)

      // @ts-expect-error - internal field for testing
      expect(proxy.a.b._$fieldPath).toBe('root.a.b')

      // Now $value must return fully plain objects, not proxies
      const value = proxy.$value

      expect(typeof value.a).toBe('object')
      // @ts-expect-error - internal field for testing
      expect(value.a._$fieldPath).toBeUndefined()
      expect(typeof value.a.b).toBe('object')
      // @ts-expect-error - internal field for testing
      expect(value.a.b._$fieldPath).toBeUndefined()
      expect(value.a.b.c).toBe(1)
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

    it('reassigning a nested object with content-equal but reordered keys does not notify', async () => {
      const initial = { address: { city: 'Madrid', zip: '28001' } }
      const proxy = proxifyStore(
        store$$,
        initial, { afterChange: (c) => { capturedChanges.push(...c) } }) as MutableStoreValue<typeof initial>

      // Access it once so the reassignment goes through the existing child proxy
      void proxy.address.city

      proxy.address = { zip: '28001', city: 'Madrid' }

      await sleep(20)

      expect(capturedChanges.length).toBe(0)
      expect(proxy.address.city).toBe('Madrid')
    })

    it('setting entire store preserves functions', async () => {
      function testFn (): number { return 42 }

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

    it('repeated reads return the same bound function reference', async () => {
      const initial = {
        name: 'test',
        getName () {
          return this.name
        },
      }
      const proxy = proxifyStore(store$$, initial)

      expect(proxy.getName).toBe(proxy.getName)
    })

    it('cached bound function keeps `this.prop` reads and writes reactive', async () => {
      const initial = {
        count: 0,
        increment () {
          this.count = this.count + 1
        },
      }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      // Two calls: the second one goes through the cached bound function
      proxy.increment()
      proxy.increment()

      await sleep(20)

      expect(proxy.count).toBe(2)
      expect(capturedChanges.length).toBe(2)
      expect(capturedChanges[0].change.fieldPath).toBe('count')
      expect(capturedChanges[1].change.newValue).toBe(2)
    })

    it('reassigning a function property re-binds to the new function', async () => {
      const initial = {
        name: 'test',
        getName () {
          return this.name
        },
      }
      const proxy = proxifyStore(store$$, initial) as MutableStoreValue<typeof initial>

      const previousBound = proxy.getName

      proxy.getName = function () { return `new-${this.name}` }

      await sleep(20)

      expect(proxy.getName).not.toBe(previousBound)
      expect(proxy.getName()).toBe('new-test')
    })

    it('cached bound function reads the CURRENT value after `$value` replacement', async () => {
      const initial = {
        count: 0,
        getCount () {
          return this.count
        },
      }
      const proxy = proxifyStore(store$$, initial) as MutableStoreValue<typeof initial>

      const boundBefore = proxy.getCount

      proxy.$value = { count: 50 } as any

      await sleep(20)

      // Root functions are preserved on replacement and, being the same raw
      // function, the cached binding is reused — reading the new value
      expect(proxy.getCount).toBe(boundBefore)
      expect(boundBefore()).toBe(50)
    })

    it('nested function keeps `this` reactive after its parent object is reassigned', async () => {
      const initial = {
        counter: {
          value: 1,
          increment () {
            this.value = this.value + 1
          },
        },
      }
      const proxy = proxifyStore(
        store$$,
        initial, { afterChange: (c) => { capturedChanges.push(...c) } }) as MutableStoreValue<typeof initial>

      // Reassign the parent object (through the existing child proxy path)
      void proxy.counter.value
      proxy.counter = {
        value: 10,
        increment () {
          this.value = this.value + 5
        },
      }

      await sleep(20)
      capturedChanges = []

      proxy.counter.increment()

      await sleep(20)

      expect(proxy.counter.value).toBe(15)
      expect(capturedChanges.length).toBe(1)
      expect(capturedChanges[0].change.fieldPath).toBe('counter.value')
    })
  })

  describe('emitted fieldPath edge cases', () => {
    it('a top-level field literally named `root` emits fieldPath "root"', async () => {
      const initial = { root: 1 }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      proxy.root = 2

      await sleep(20)

      // Known limitation: it collides with the whole-store sentinel in select
      expect(capturedChanges[0].change.fieldPath).toBe('root')
    })

    it('a nested write under a field named `root` emits "root.<key>"', async () => {
      const initial = { root: { x: 1 } }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      proxy.root.x = 2

      await sleep(20)

      expect(capturedChanges[0].change.fieldPath).toBe('root.x')
    })
  })

  describe('internal raw access', () => {
    it('RAW_VALUE returns the raw wrapped object, not a proxy', () => {
      const rawUser = { name: 'test' }
      const initial = { user: rawUser }
      const proxy = proxifyStore(store$$, initial) as any

      expect(proxy[RAW_VALUE]).toBe(initial)
      expect(proxy.user[RAW_VALUE]).toBe(rawUser)
      expect(proxy.user[RAW_VALUE]._$fieldPath).toBeUndefined()
    })

    it('JSON.stringify(proxy) reflects the new value after `$value` replacement', async () => {
      const initial = { name: 'before' }
      const proxy = proxifyStore(store$$, initial) as MutableStoreValue<{ name: string }>

      expect(JSON.stringify(proxy)).toBe('{"name":"before"}')

      proxy.$value = { name: 'after' }

      await sleep(20)

      expect(JSON.stringify(proxy)).toBe('{"name":"after"}')
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

    it('storeValue contains parent object in change (raw data, without Proxy instances)', async () => {
      const initial = { user: { name: 'test' } }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      capturedChanges = []

      proxy.user.name = 'changed'

      await sleep(20)

      expect(capturedChanges.length).toBeGreaterThan(0)
      expect(capturedChanges[0].storeValue).toBeDefined()
      // storeValue exposes the raw store data (kept clean of Proxy instances)
      expect(capturedChanges[0].storeValue.user).toBe(initial.user)
      expect(capturedChanges[0].storeValue.user.name).toBe('changed')
    })

    it('nested objects are automatically proxified on access', async () => {
      const initial = { a: { b: { value: 1 } } }
      const proxy = proxifyStore(store$$, initial)

      const nested = proxy.a.b

      expect(nested.value).toBe(1)
      // @ts-expect-error - internal field for testing
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
      const initial: { items: Array<{ a?: number; b?: number }> } = { items: [{ a: 1 }, { b: 2 }] }
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

  describe('clean raw data (child-proxy cache)', () => {
    it('accessing nested objects does not write Proxy instances into the raw data', async () => {
      const rawUser = { name: 'test', nested: { age: 25 } }
      const initial = { user: rawUser }
      const proxy = proxifyStore(store$$, initial)

      // Force nested proxy creation at two levels
      expect(proxy.user.nested.age).toBe(25)

      // The raw data must keep the original references untouched
      expect(initial.user).toBe(rawUser)
      expect(initial.user.nested).toBe(rawUser.nested)
    })

    it('keeps the same child proxy when reassigning a content-equal object', async () => {
      const initial = { links: { nested: { test: 1 } } }
      const proxy = proxifyStore(store$$, initial)

      const linksProxy1 = proxy.links

      proxy.links = { nested: { test: 1 } }

      await sleep(20)

      expect(proxy.links).toBe(linksProxy1)
    })

    it('assigning a store proxy into another field stores its raw value, not the Proxy', async () => {
      const initial = { a: { x: 1 }, b: null } as any
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      proxy.b = proxy.a

      await sleep(20)

      // Raw slot holds the raw object (shared with `a`), not a Proxy
      expect(initial.b).toBe(initial.a)
      expect(initial.b._$fieldPath).toBeUndefined()

      capturedChanges = []
      proxy.b.x = 5

      await sleep(20)

      // Writing through `b` emits its own fieldPath and mutates the shared raw
      expect(capturedChanges[0].change.fieldPath).toBe('b.x')
      expect(proxy.a.x).toBe(5)
    })

    it('aliased objects reachable from two fields get their own fieldPath each', async () => {
      const shared = { x: 1 }
      const initial = { a: shared, b: shared }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      proxy.a.x = 2

      await sleep(20)

      expect(capturedChanges[0].change.fieldPath).toBe('a.x')

      capturedChanges = []
      proxy.b.x = 3

      await sleep(20)

      expect(capturedChanges[0].change.fieldPath).toBe('b.x')
    })

    it('same property name at different nesting levels gets independent proxies', async () => {
      const initial = { test: { data: { value: 1 }, item: { data: { value: 2 } } } }
      const proxy = proxifyStore(store$$, initial, { afterChange: (c) => { capturedChanges.push(...c) } })

      const outerData = proxy.test.data
      const innerData = proxy.test.item.data

      // Independent proxies with correct values and fieldPaths (each level
      // has its own childProxies Map, so the `data` key cannot collide)
      expect(outerData).not.toBe(innerData)
      expect(outerData.value).toBe(1)
      expect(innerData.value).toBe(2)
      // @ts-expect-error - internal field for testing
      expect(outerData._$fieldPath).toBe('root.test.data')
      // @ts-expect-error - internal field for testing
      expect(innerData._$fieldPath).toBe('root.test.item.data')

      // Cache identity is stable per level (no cross-level overwrite)
      expect(proxy.test.data).toBe(outerData)
      expect(proxy.test.item.data).toBe(innerData)

      // Writes emit their own fieldPath and do not cross-contaminate
      proxy.test.data.value = 10

      await sleep(20)

      expect(capturedChanges[0].change.fieldPath).toBe('test.data.value')
      expect(proxy.test.item.data.value).toBe(2)

      capturedChanges = []
      proxy.test.item.data.value = 20

      await sleep(20)

      expect(capturedChanges[0].change.fieldPath).toBe('test.item.data.value')
      expect(proxy.test.data.value).toBe(10)

      // Reassigning one of them re-points only its own cached proxy
      proxy.test.data = { value: 99 }

      await sleep(20)

      expect(proxy.test.data).toBe(outerData)
      expect(proxy.test.data.value).toBe(99)
      expect(proxy.test.item.data.value).toBe(20)
    })
  })

  describe('$$value internal setter', () => {
    it('merges top-level store functions like $value does', async () => {
      const initial = {
        count: 1,
        increment () { this.count = this.count + 1 },
      } as any
      const proxy = proxifyStore(store$$, initial)

      // Fresh value without the store functions (like a useStore initialValue result)
      proxy.$$value = { id: 'subscriber-1', newValue: { count: 10 } }

      await sleep(20)

      expect(proxy.count).toBe(10)
      expect(typeof proxy.increment).toBe('function')

      proxy.increment()

      await sleep(20)

      expect(proxy.count).toBe(11)
    })

    it('does not notify the subscriber that originated the change, but notifies the rest', async () => {
      const initial = { value: 0 }
      const proxy = proxifyStore(store$$, initial) as any

      const notifiedA: Array<any> = []
      const notifiedB: Array<any> = []

      store$$.subscribe({ id: 'A', next: (c) => { notifiedA.push(c) } })
      store$$.subscribe({ id: 'B', next: (c) => { notifiedB.push(c) } })

      proxy.$$value = { id: 'A', newValue: { value: 5 } }

      await sleep(20)

      expect(notifiedA.length).toBe(0)
      expect(notifiedB.length).toBe(1)
    })
  })

  describe('circular structures (max call stack regression)', () => {
    it('does not overflow when the store holds a DOM-element-like object with circular fibers', async () => {
      // React stamps `__reactFiber$xyz` on DOM nodes, pointing into the
      // circular fiber tree (child.return === parent)
      const fiberParent: any = { tag: 5, stateNode: {}, child: null, sibling: null }
      const fiberChild: any = { tag: 5, stateNode: {}, child: null, return: fiberParent }

      fiberParent.child = fiberChild

      const domElementLike = { __reactFiber$abc123: fiberChild, __reactProps$abc123: { onClick: () => {} } }

      const initial = { el: domElementLike, count: 0 } as any
      const proxy = proxifyStore(store$$, initial)

      expect(() => proxy.$value).not.toThrow()
      expect(() => JSON.stringify(proxy)).not.toThrow()
      // `$value` setter compares previous/new values traversing both of them
      expect(() => { proxy.$value = { el: domElementLike, count: 1 } }).not.toThrow()

      await sleep(20)

      expect(proxy.count).toBe(1)
    })

    it('does not overflow when an aliased proxy is assigned into its own subtree', async () => {
      const initial = { a: { x: 1, child: null } } as any
      const proxy = proxifyStore(store$$, initial)

      proxy.a.child = proxy.a

      await sleep(20)

      expect(() => proxy.$value).not.toThrow()
      expect(() => JSON.stringify(proxy)).not.toThrow()

      const value = proxy.$value

      expect(value.a.x).toBe(1)
      // The cycle is cut instead of cloned infinitely
      expect(value.a.child).toBe(null)
    })
  })
})
