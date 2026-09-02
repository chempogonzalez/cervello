
import { describe, it, expect } from 'vitest'

import { nonReactive } from '../../lib/store/new-index'
import {
  deepClone,
  isObject,
  isReactElement,
  isValidReactiveObject,
  contentComparer,
  safeToJson,
  getPartialObjectFromProperties,
  okTarget,
} from '../../lib/utils/object'
import { nonReactiveObjectSymbol } from '../../types/shared'


// Simple mock React element factory
function mockReactElement (type: string, props: Record<string, any> = {}): any {
  return { $$typeof: Symbol.for('react.element'), type, props }
}


// Simple mock React fiber node
function mockReactFiberNode (): any {
  return { tag: 1, containerInfo: {} }
}


describe('[deepClone]', () => {
  describe('basic types', () => {
    it('returns primitives as-is', () => {
      expect(deepClone(42)).toBe(42)
      expect(deepClone('string')).toBe('string')
      expect(deepClone(true)).toBe(true)
      expect(deepClone(null)).toBe(null)
      expect(deepClone(undefined as any)).toBe(undefined)
    })

    it('returns functions as-is', () => {
      const fn = (): number => 42

      expect(deepClone(fn)).toBe(fn)
    })
  })

  describe('objects', () => {
    it('creates a new object reference', () => {
      const obj = { name: 'test', value: 100 }
      const clone = deepClone(obj)

      expect(clone).toEqual(obj)
      expect(clone).not.toBe(obj)
    })

    it('deeply clones nested objects', () => {
      const obj = {
        a: { b: { c: { d: 42 } } },
        e: { f: 100 },
      }
      const clone = deepClone(obj)

      expect(clone).toEqual(obj)
      expect(clone.a).not.toBe(obj.a)
      expect(clone.a.b).not.toBe(obj.a.b)
      expect(clone.a.b.c).not.toBe(obj.a.b.c)
      expect(clone.a.b.c.d).toBe(42)
    })

    it('preserves symbols as keys', () => {
      const sym1 = Symbol('test1')
      const sym2 = Symbol('test2')
      const obj = {
        normal: 'value',
        [sym1]: 'symbol-value-1',
        [sym2]: 42,
      }
      const clone = deepClone(obj)

      expect(clone.normal).toBe('value')
      expect(clone[sym1]).toBe('symbol-value-1')
      expect(clone[sym2]).toBe(42)
    })

    it('handles empty objects', () => {
      const obj = {}
      const clone = deepClone(obj)

      expect(clone).toEqual({})
      expect(clone).not.toBe(obj)
    })
  })

  describe('arrays', () => {
    it('creates a new array reference', () => {
      const arr = [1, 2, 3]
      const clone = deepClone(arr)

      expect(clone).toEqual(arr)
      expect(clone).not.toBe(arr)
    })

    it('deeply clones array items', () => {
      const obj = {
        items: [
          { nested: 1 },
          { nested: 2 },
          { nested: { deep: true } },
        ],
      }
      const clone = deepClone(obj)

      expect(clone.items).not.toBe(obj.items)
      expect(clone.items[0]).not.toBe(obj.items[0])
      expect(clone.items[0].nested).toBe(1)
      expect(clone.items[2].nested.deep).toBe(true)
    })

    it('handles arrays with nested arrays', () => {
      const obj = { matrix: [ [1, 2], [3, [4, 5] ] ] }
      const clone = deepClone(obj)

      expect(clone.matrix).not.toBe(obj.matrix)
      expect(clone.matrix[1]).not.toBe(obj.matrix[1])
      expect(clone.matrix[1][1]).not.toBe(obj.matrix[1][1])
      expect(clone.matrix[1][1][1]).toBe(5)
    })

    it('handles empty arrays', () => {
      const obj = { items: [] }
      const clone = deepClone(obj)

      expect(clone.items).toEqual([])
      expect(clone.items).not.toBe(obj.items)
    })

    it('handles sparse arrays', () => {
      const arr = new Array(3) as any

      arr[0] = 1
      arr[2] = 3
      const clone = deepClone(arr)

      expect(clone[0]).toBe(1)
      expect(clone[2]).toBe(3)
    })
  })

  describe('special objects', () => {
    it('does not clone React elements', () => {
      const reactElement = mockReactElement('div', { children: 'test' })
      const obj = { el: reactElement }
      const clone = deepClone(obj)

      expect(clone.el).toBe(reactElement)
    })

    it('does not clone React fiber nodes', () => {
      const fiberNode = mockReactFiberNode()
      const obj = { fiber: fiberNode }
      const clone = deepClone(obj)

      expect(clone.fiber).toBe(fiberNode)
    })

    it('handles objects with mixed React elements and nested objects', () => {
      const reactElement = mockReactElement('span', { text: 'hello' })
      const obj = {
        element: reactElement,
        nested: { regular: true, also: 'yes' },
      }
      const clone = deepClone(obj)

      expect(clone.element).toBe(reactElement)
      expect(clone.nested).not.toBe(obj.nested)
      expect(clone.nested.regular).toBe(true)
    })

    it('cuts circular references to null instead of overflowing the call stack', () => {
      const obj: any = { name: 'test' }

      obj.self = obj // Create circular ref

      const clone = deepClone(obj)

      expect(clone.name).toBe('test')
      expect(clone.self).toBe(null)
    })

    it('cuts circular references inside nested arrays', () => {
      const obj: any = { items: [{ value: 1 }] }

      obj.items[0].parent = obj

      const clone = deepClone(obj)

      expect(clone.items[0].value).toBe(1)
      expect(clone.items[0].parent).toBe(null)
    })

    it('clones nonReactive-wrapped objects structurally (complex/circular content survives)', () => {
      const circular: any = { name: 'x' }

      circular.self = circular

      const wrapper = nonReactive({ value: new Date(), map: new Map([ ['a', 1] ]), circular })
      const obj = { wrapper, plain: { test: 1 } }

      const clone = deepClone(obj)

      // Decoupled copy that preserves complex values and the internal cycles
      expect(clone.wrapper).not.toBe(wrapper)
      expect(clone.wrapper.value).toBeInstanceOf(Date)
      expect(clone.wrapper.value.getTime()).toBe(wrapper.value.getTime())
      expect(clone.wrapper.map).toBeInstanceOf(Map)
      expect(clone.wrapper.map).not.toBe(wrapper.map)
      expect(clone.wrapper.map.get('a')).toBe(1)
      expect(clone.wrapper.circular.self).toBe(clone.wrapper.circular)
      expect(clone.plain).not.toBe(obj.plain)

      // The clone keeps the nonReactive mark
      expect(isValidReactiveObject(clone.wrapper)).toBe(false)

      // Mutating the clone does not touch the original
      clone.wrapper.map.set('b', 2)
      expect(wrapper.map.has('b')).toBe(false)
    })

    it('keeps functions and React elements by reference inside nonReactive clones', () => {
      const el = mockReactElement('div', { children: 'test' })
      const fn = (): number => 42
      const wrapper = nonReactive({ el, fn, nested: { deep: 1 } })

      const clone = deepClone({ wrapper })

      expect(clone.wrapper.el).toBe(el)
      expect(clone.wrapper.fn).toBe(fn)
      expect(clone.wrapper.nested).not.toBe(wrapper.nested)
      expect(clone.wrapper.nested.deep).toBe(1)
    })

    it('clones shared (aliased) references as independent copies, not as circular', () => {
      const shared = { value: 42 }
      const obj = { a: shared, b: shared, list: [shared] }

      const clone = deepClone(obj)

      expect(clone.a).toEqual({ value: 42 })
      expect(clone.b).toEqual({ value: 42 })
      expect(clone.list[0]).toEqual({ value: 42 })
      expect(clone.a).not.toBe(shared)
    })

    it('preserves functions as-is when they are properties inside an object', () => {
      const fn = (): number => 42
      const obj = { fn, name: 'test' }
      const clone = deepClone(obj)

      expect(clone.fn).toBe(fn)
      expect(typeof clone.fn).toBe('function')
      expect(clone.fn()).toBe(42)
      expect(clone.name).toBe('test')
    })
  })
})


describe('[isObject]', () => {
  it('returns true for plain objects', () => {
    expect(isObject({})).toBe(true)
    expect(isObject({ a: 1 })).toBe(true)
  })

  it('returns false for null', () => {
    expect(isObject(null)).toBe(false)
  })

  it('returns false for arrays', () => {
    expect(isObject([])).toBe(false)
  })

  it('returns false for non-objects', () => {
    expect(isObject(42)).toBe(false)
    expect(isObject('string')).toBe(false)
    expect(isObject(true)).toBe(false)
    expect(isObject(undefined)).toBe(false)
    expect(isObject(Symbol('test'))).toBe(false)
  })
})


describe('[isReactElement]', () => {
  it('detects mock React elements', () => {
    expect(isReactElement(mockReactElement('div'))).toBe(true)
    expect(isReactElement(mockReactElement('span', { className: 'test' }))).toBe(true)
  })

  it('returns false for non-react elements', () => {
    expect(isReactElement(null)).toBe(false)
    expect(isReactElement(undefined)).toBe(false)
    expect(isReactElement({ noSymbol: 'here' })).toBe(false)
    // Note: isReactElement checks !!(obj.$$typeof) — any truthy $$typeof marks it as react element
    expect(isReactElement({ $$typeof: null })).toBe(false)
    expect(isReactElement({ $$typeof: 0 })).toBe(false)
    expect(isReactElement(42)).toBe(false)
  })

  it('does not throw on primitives', () => {
    expect(() => isReactElement(42)).not.toThrow()
    expect(() => isReactElement(true)).not.toThrow()
    expect(() => isReactElement('string')).not.toThrow()
  })
})


describe('[isValidReactiveObject]', () => {
  it('returns true for plain objects', () => {
    expect(isValidReactiveObject({})).toBe(true)
    expect(isValidReactiveObject({ test: 1 })).toBe(true)
  })

  it('returns false for null', () => {
    expect(isValidReactiveObject(null)).toBe(false)
  })

  it('returns false for arrays', () => {
    expect(isValidReactiveObject([])).toBe(false)
  })

  it('returns false for React elements', () => {
    expect(isValidReactiveObject(mockReactElement('div'))).toBe(false)
  })

  it('returns false for non-reactive marked objects', () => {
    const obj = { test: 123 }

    Object.defineProperty(obj, nonReactiveObjectSymbol, {
      value: true,
      enumerable: false,
      writable: false,
      configurable: false,
    })
    expect(isValidReactiveObject(obj)).toBe(false)
  })

  it('returns false for non-objects', () => {
    expect(isValidReactiveObject(undefined)).toBe(false)
    expect(isValidReactiveObject(42)).toBe(false)
    expect(isValidReactiveObject(() => {}) as any).toBe(false)
  })
})


describe('[contentComparer]', () => {
  it('returns true for identical objects', () => {
    const a = { name: 'test', count: 5 }

    expect(contentComparer(a, { name: 'test', count: 5 })).toBe(true)
  })

  it('returns true for deeply equal objects', () => {
    const a = { user: { name: 'test', nested: { value: 42 } } }
    const b = { user: { name: 'test', nested: { value: 42 } } }

    expect(contentComparer(a, b)).toBe(true)
  })

  it('returns false for different objects', () => {
    expect(contentComparer({ name: 'test' }, { name: 'other' })).toBe(false)
  })

  it('returns false for different depths', () => {
    expect(contentComparer({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })

  it('handles nested arrays', () => {
    const a = { items: [1, 2, { nested: true }] }
    const b = { items: [1, 2, { nested: true }] }

    expect(contentComparer(a, b)).toBe(true)

    const c = { items: [1, 2, { nested: false }] }

    expect(contentComparer(a, c)).toBe(false)
  })

  it('handles empty objects', () => {
    expect(contentComparer({}, {})).toBe(true)
  })

  it('ignores key insertion order', () => {
    expect(contentComparer({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    expect(contentComparer(
      { user: { name: 'test', age: 5 } },
      { user: { age: 5, name: 'test' } },
    )).toBe(true)
  })

  it('treats NaN as equal to NaN and different from null', () => {
    expect(contentComparer({ value: NaN }, { value: NaN })).toBe(true)
    expect(contentComparer({ value: NaN }, { value: null })).toBe(false)
    expect(contentComparer({ value: NaN }, { value: 5 })).toBe(false)
  })

  it('skips undefined-valued keys like JSON does', () => {
    expect(contentComparer({ a: 1, b: undefined }, { a: 1 })).toBe(true)
    expect(contentComparer({ a: 1 }, { a: 1, b: undefined })).toBe(true)
    // An explicit null IS serialized, so it differs from a missing key
    expect(contentComparer({ a: 1, b: null }, { a: 1 })).toBe(false)
  })

  it('skips function-valued keys like JSON does', () => {
    const a = { name: 'test', getName () { return 'a' } }
    const b = { name: 'test', getName () { return 'b' } }

    expect(contentComparer(a, b)).toBe(true)
    expect(contentComparer(a, { name: 'test' })).toBe(true)
  })

  it('treats undefined and function array elements as null', () => {
    expect(contentComparer([undefined], [null])).toBe(true)
    expect(contentComparer([() => 1], [null])).toBe(true)
    expect(contentComparer([1, undefined], [1, null])).toBe(true)
    expect(contentComparer([1], [1, undefined])).toBe(false)
  })

  it('compares complex leaves (Date, Map, Set) as opaque values', () => {
    // Complex objects are not supported as reactive values, so they compare
    // exactly like their JSON projection: an empty object
    expect(contentComparer({ d: new Date(0) }, { d: new Date(999) })).toBe(true)
    expect(contentComparer({ m: new Map([ ['a', 1] ]) }, { m: new Map() })).toBe(true)
    expect(contentComparer({ s: new Set([1]) }, { s: new Set() })).toBe(true)
  })

  it('compares React elements through their safeToJson projection', () => {
    const a = { el: mockReactElement('div', { className: 'x' }) }
    const b = { el: mockReactElement('div', { className: 'x' }) }
    const c = { el: mockReactElement('span', { className: 'x' }) }

    expect(contentComparer(a, b)).toBe(true)
    expect(contentComparer(a, c)).toBe(false)
  })

  it('handles circular references without overflowing', () => {
    const a: Record<string, any> = { name: 'test' }

    a.self = a
    const b: Record<string, any> = { name: 'test' }

    b.self = b

    // Both sides cycle at the same position: equal
    expect(contentComparer(a, b)).toBe(true)

    const c: Record<string, any> = { name: 'other' }

    c.self = c

    expect(contentComparer(a, c)).toBe(false)
  })

  it('does not confuse repeated references (aliases) with differences', () => {
    const shared = { value: 1 }
    const a = { left: shared, right: shared }
    const b = { left: { value: 1 }, right: { value: 1 } }

    expect(contentComparer(a, b)).toBe(true)
  })
})


describe('[safeToJson]', () => {
  it('converts plain objects to plain records', () => {
    const obj = { name: 'test', count: 42 }
    const result = safeToJson(obj)

    expect(result).toEqual({ name: 'test', count: 42 })
    expect(JSON.stringify(result)).toBe('{"name":"test","count":42}')
  })

  it('handles nested objects', () => {
    const obj = { user: { name: 'test', nested: { value: true } } }
    const result = safeToJson(obj)

    expect(result).toEqual({ user: { name: 'test', nested: { value: true } } })
  })

  it('handles arrays', () => {
    const obj = { items: [1, 'two', { three: 3 }] }
    const result = safeToJson(obj)

    expect(result).toEqual({ items: [1, 'two', { three: 3 }] })
  })

  it('handles React elements', () => {
    const reactElement = mockReactElement('div', { className: 'test', children: 'hello' })
    const obj = { el: reactElement }
    const result = safeToJson(obj)

    expect(result.el.type).toBe('div')
    expect(result.el.props).toBeDefined()
  })

  it('handles nested React elements', () => {
    const reactElement = mockReactElement('span', { text: 'nested' })
    const obj = { parent: { child: reactElement } }
    const result = safeToJson(obj)

    expect(result.parent.child.type).toBe('span')
    expect(result.parent.child.props.text).toBe('nested')
  })

  it('converts null to null', () => {
    expect(safeToJson(null)).toBe(null)
  })

  it('returns primitives as-is', () => {
    expect(safeToJson(42)).toBe(42)
    expect(safeToJson('string')).toBe('string')
    expect(safeToJson(true)).toBe(true)
    expect(safeToJson(undefined)).toBe(undefined)
  })

  it('handles empty objects and arrays', () => {
    expect(safeToJson({})).toEqual({})
    expect(safeToJson([])).toEqual([])
    expect(safeToJson({ arr: [] })).toEqual({ arr: [] })
  })

  it('cuts circular references to null instead of overflowing the call stack', () => {
    const obj: any = { name: 'test' }

    obj.self = obj

    const result = safeToJson(obj)

    expect(result.name).toBe('test')
    expect(result.self).toBe(null)
    expect(() => JSON.stringify(result)).not.toThrow()
  })

  it('serializes shared (aliased) references normally, not as circular', () => {
    const shared = { value: 42 }
    const obj = { a: shared, b: shared }

    const result = safeToJson(obj)

    expect(result.a).toEqual({ value: 42 })
    expect(result.b).toEqual({ value: 42 })
  })

  it('does not traverse React fiber-like nodes (they contain circular internals)', () => {
    // Fibers link parent/child circularly: child.return === parent
    const fiberParent: any = { tag: 5, stateNode: {}, child: null, sibling: null }
    const fiberChild: any = { tag: 5, stateNode: {}, child: null, return: fiberParent }

    fiberParent.child = fiberChild

    const result = safeToJson({ fiber: fiberChild })

    expect(result.fiber).toEqual({ type: '[ReactNode]' })
    expect(() => JSON.stringify(result)).not.toThrow()
  })

  it('handles a DOM-element-like object holding a circular fiber (dom refs stored in objects)', () => {
    // React stamps `__reactFiber$xyz` as an own enumerable prop on DOM nodes
    const fiberParent: any = { tag: 5, stateNode: {}, child: null }
    const fiberChild: any = { tag: 5, stateNode: {}, return: fiberParent }

    fiberParent.child = fiberChild

    const domElementLike = { __reactFiber$abc123: fiberChild, __reactProps$abc123: { onClick: () => {} } }

    expect(() => JSON.stringify(safeToJson({ el: domElementLike }))).not.toThrow()
  })

  it('handles deeply nested structures with mixed types', () => {
    const obj = {
      a: 1,
      b: 'two',
      c: [3, { d: false }],
      e: {
        f: { g: [4, 5, { h: 'deep' }] },
      },
    }
    const result = safeToJson(obj)

    expect(result).toEqual({
      a: 1,
      b: 'two',
      c: [3, { d: false }],
      e: {
        f: { g: [4, 5, { h: 'deep' }] },
      },
    })
    expect(JSON.stringify(result)).toBeDefined()
  })
})


describe('[getPartialObjectFromProperties]', () => {
  it('returns only the specified properties', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 }
    const result = getPartialObjectFromProperties(['a', 'c'], obj)

    expect(result).toEqual({ a: 1, c: 3 })
  })

  it('returns empty object when properties array is empty', () => {
    const obj = { a: 1, b: 2 }
    const result = getPartialObjectFromProperties([], obj)

    expect(result).toEqual({})
  })

  it('handles single property', () => {
    const obj = { name: 'test', age: 25 }
    const result = getPartialObjectFromProperties(['name'], obj)

    expect(result).toEqual({ name: 'test' })
  })

  it('handles nested objects in properties', () => {
    const obj = { a: 1, nested: { b: 2 } }
    const result = getPartialObjectFromProperties(['a', 'nested'], obj)

    expect(result).toEqual({ a: 1, nested: { b: 2 } })
  })
})


describe('[okTarget]', () => {
  it('returns target when INTERNAL_VALUE_PROP does not exist', () => {
    const target = { name: 'test' }

    // @ts-expect-error - testing internal function
    expect(okTarget(target)).toBe(target)
  })

  it('returns INTERNAL_VALUE_PROP when it exists', () => {
    const obj = { name: 'test' }
    const target = { $$value$$: obj } as any

    // @ts-expect-error - testing internal function
    expect(okTarget(target)).toBe(obj)
  })

  it('falls back to target when INTERNAL_VALUE_PROP is undefined', () => {
    const target = { $$value$$: undefined } as any

    // @ts-expect-error - testing internal function
    expect(okTarget(target)).toBe(target)
  })
})


describe('[nonReactiveObjectSymbol]', () => {
  it('symbol is defined', () => {
    expect(nonReactiveObjectSymbol).toBeDefined()
    expect(typeof nonReactiveObjectSymbol).toBe('symbol')
  })

  it('symbol can mark an object as non-reactive', () => {
    const obj = { test: 1 }

    Object.defineProperty(obj, nonReactiveObjectSymbol, {
      value: true,
      enumerable: false,
      writable: false,
      configurable: false,
    })

    expect(isValidReactiveObject(obj)).toBe(false)
  })
})
