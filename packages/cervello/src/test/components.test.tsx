
import React, { } from 'react'
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from 'vitest'
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from 'vitest-react'

import {
  App,
  AppCheckReference,
  AppWithClick,
  INITIAL_VALUE,
  renderedResultToObject,
  renderedResultToString,
  reset,
  store,
  useLogRenders,
} from './utils'
import { cervello, nonReactive } from '../lib/store/new-index'


function sleep (ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}


/** --------------- ASSERT HELPERS ---------------------- */
const reRenderNum = (num: number) => num === 0
  ? 'First render'
  : `re-render: ${num}`

const assertNumOfRenders = (num: number) => {
  const renders = screen.getByTestId('renders')
  // console.log({ renders: renders.textContent })

  expect(renders.textContent).toEqual(reRenderNum(num))
}
/** --------------- [end] ASSERT HELPERS ---------------- */



beforeEach(() => {
  reset()
})

// afterEach(() => {
//   vi.useRealTimers()
// })


describe('[_CERVELLO_]', () => {
  describe('- [__store__]', async () => {
    it('  (Get) full store value from exported store', async () => {
      expect(store.$value).toStrictEqual(INITIAL_VALUE)
    })

    it('  (Set) full store value from exported store', async () => {
      const currentStore = store.$value
      const newStore = {
        test: 'test',
        complete: 'change',
      }

      // @ts-expect-error - We are changing the store value
      store.$value = newStore
      // Check if the store value has changed
      expect(store.$value).not.toEqual(currentStore)
      expect(store.$value).toHaveProperty('test', 'test')
      expect(store.$value).toHaveProperty('complete', 'change')

      const newStore2 = { ...INITIAL_VALUE, name: 'new name' }

      store.$value = newStore2

      expect(store.$value).not.toEqual(newStore)
      expect(store.$value).toStrictEqual(newStore2)
    })

    it('  Change using `store` a different field from selected fields', async () => {
      render(
        <AppWithClick
          options={{
            select: ['surname'],
          }}
          onClick={(_) => { store.name = 'chempo!' }}
        />,
      )

      assertNumOfRenders(0)


      const button = screen.getByText('Change')

      await act(async () => {
        await userEvent.click(button)
      })

      assertNumOfRenders(0)
    })

    it(' nonReactive field', async () => {
      const { store, useStore } = cervello({
        nestedReactive: {
          test: 1,
        },
        nestedNonReactive: nonReactive({
          test: 2,
        }),
      })

      const R = () => {
        const [numOfRenders] = useLogRenders('App')

        const s = useStore()

        const handleOnClick = (reactive = true): void => {
          if (reactive) {
            store.nestedReactive.test = 1000
          } else {
            store.nestedNonReactive.test = 1000
          }
        }

        return (
          <div className='App'>
            {numOfRenders}
            <pre data-testid='content'>{JSON.stringify(s, null, 2)}</pre>

            <button onClick={() => handleOnClick()}>reactive</button>
            <button onClick={() => handleOnClick(false)}>non-reactive</button>
          </div>
        )
      }

      render(<R />)

      const content = screen.getByTestId('content')

      const reactiveButton = screen.getByText('reactive')
      const buttonNonReactive = screen.getByText('non-reactive')

      assertNumOfRenders(0)
      await act(async () => {
        await userEvent.click(reactiveButton)
      })

      assertNumOfRenders(1)
      expect(renderedResultToObject(content).nestedReactive.test).toEqual(1000)


      await act(async () => {
        await userEvent.click(buttonNonReactive)
      })

      assertNumOfRenders(1)
      expect(renderedResultToObject(content).nestedNonReactive.test).toEqual(2)
      expect(store.nestedNonReactive.test).toEqual(1000)

    })
  })

  describe('- [__useStore__]', async () => {
    it('  First render with basic cervello init', async () => {
      render(<App />)

      const content = screen.getByTestId('content')

      assertNumOfRenders(0)
      expect(renderedResultToString(content)).toEqual(JSON.stringify(INITIAL_VALUE))
    })
    describe('  (initialValue)', async () => {
      it('  First render with initial value from hook function', async () => {
        // act(() => {
        render(<App options={{ initialValue: () => ({ custom: true }) as any }} />)
        // })
        const content = screen.getByTestId('content')


        assertNumOfRenders(0)
        expect(renderedResultToString(content)).toEqual(JSON.stringify({ custom: true }))

        await sleep(100)
        // Wait for the next render to be sure that the initial value is set and it wasn't re-rendered
        assertNumOfRenders(0)
      })
    })

    describe('  (select)', async () => {
      it('  Change other value different from selected fields', async () => {
        render(
          <AppWithClick
            options={{
              select: ['surname'],
            }}
            onClick={(s) => { s.name = 'chempo!' }}
          />,
        )

        assertNumOfRenders(0)


        const button = screen.getByText('Change')

        await act(async () => {
          await userEvent.click(button)
        })

        assertNumOfRenders(0)
      })

      it('  onChange - Change other value different from selected fields and check `onChange`', async () => {
        const onChangeMockFunction = vi.fn()

        render(
          <AppWithClick
            options={{
              select: ['surname'],
              onChange: onChangeMockFunction,
            }}
            onClick={(s) => { s.name = 'chempo!' }}
          />,
        )

        assertNumOfRenders(0)

        expect(onChangeMockFunction).toHaveBeenCalledTimes(0)


        const button = screen.getByText('Change')

        await act(async () => {
          await userEvent.click(button)
        })

        assertNumOfRenders(0)
      })

      it('  onChange - Change SAME value from selected fields and check `afterChange`', async () => {
        const onChangeMockFunction = vi.fn()

        render(
          <AppWithClick
            options={{
              select: ['surname', 'name'],
              onChange: onChangeMockFunction,
            }}
            onClick={(s) => { s.name = 'chempo!' }}
          />,
        )

        assertNumOfRenders(0)
        expect(onChangeMockFunction).toHaveBeenCalledTimes(0)


        const button = screen.getByText('Change')

        await act(async () => {
          await userEvent.click(button)
        })

        assertNumOfRenders(1)
        expect(onChangeMockFunction).toHaveBeenCalledTimes(1)
      })
    })

    describe('  (setValueOnMount)', async () => {
      it('  Change value on mount with `setValueOnMount`', async () => {
        const setValueOnMount = vi.fn().mockImplementation(async () => {
          await sleep(200)
          return ({ name: 'changed on mount' })
        })

        await act(() => {
          render(
            <AppWithClick
              options={{setValueOnMount,}}
              onClick={(s) => { s.name = 'chempo!' }}
            />,
          )
        })
        expect(setValueOnMount).toHaveBeenCalledTimes(1)
        expect(setValueOnMount).toHaveBeenCalledWith(INITIAL_VALUE)

        assertNumOfRenders(0)
        expect(store.$value).toStrictEqual(INITIAL_VALUE)

        await waitFor(() => {
          assertNumOfRenders(1)
          expect(store.$value).toHaveProperty('name', 'changed on mount')
        }, {timeout: 200})
      })
    })
  })


  describe('  - [store < useStore] changes', async () => {

        vi.useRealTimers()
    it('   Change first level string attribute multiple times', async () => {
      render(<AppWithClick onClick={(s) => { s.name = 'chempo!' }} />)
      const content = screen.getByTestId('content')

      assertNumOfRenders(0)


      const button = screen.getByText('Change')

      await act(async () => {
        await userEvent.click(button)
      })

      assertNumOfRenders(1)
      await act(async () => {
        await userEvent.click(button)
      })


      assertNumOfRenders(1)

      await act(async () => {
        await userEvent.click(button)
      })

      assertNumOfRenders(1)


      const renderedResultObj = renderedResultToObject(content)

      expect(renderedResultObj.name).toEqual('chempo!')
    })

    it('   Change first level array attribute multiple times', async () => {
      render(<AppWithClick onClick={(s) => { s.languages = [...s.languages, 'brazilian'] }} />)
      const content = screen.getByTestId('content')

      assertNumOfRenders(0)


      const button = screen.getByText('Change')

      await act(async () => {
        await userEvent.click(button)
      })

      assertNumOfRenders(1)


      const renderedResultObj = renderedResultToObject(content)

      expect(renderedResultObj.languages).toEqual([...INITIAL_VALUE.languages, 'brazilian'])

      await act(async () => {
        await userEvent.click(button)
      })

      // New re-render due to new array reference passed each user's click
      assertNumOfRenders(2)
    })


    it('   (Re-render performance) Change first level attribute through store functions MULTIPLE times', async () => {
      render(
        <AppWithClick
          onClick={(s: typeof store) => {
            s.addSecondSurname('!')
          }}
        />,
      )
      const content = screen.getByTestId('content')


      assertNumOfRenders(0)


      const button = screen.getByText('Change')

      await act(async () => {
        await userEvent.click(button)
      })

      const renderedResultObj = renderedResultToObject(content)

      // console.log({ ddddd: store.getDisplayName() })

      expect(store.getDisplayName()).toEqual('Gonzalez !')
      await userEvent.click(button)
      expect(renderedResultObj.surname2).toEqual('!')

      assertNumOfRenders(1)

      await act(async () => {
        await userEvent.click(button)
      })

      assertNumOfRenders(1)
    })

    describe('  * [Nested Object] proxied', async () => {
      it('   Change nested property', async () => {
        render(<AppWithClick
          onClick={(s: typeof store) => {
            s.links.nested.test = 1000
          }}
               />)
        const content = screen.getByTestId('content')


        assertNumOfRenders(0)


        const button = screen.getByText('Change')

        await act(async () => {
          await userEvent.click(button)
        })

        assertNumOfRenders(1)


        const renderedResultObj = renderedResultToObject(content)

        expect(renderedResultObj.links.nested.test).toEqual(1000)
      })

      it('   Change nested object props after reassigning new object', async () => {
        render(
          <AppWithClick
            onClick={(s: typeof store) => {
              s.links.nested.test = 1000
            }}
          />
        )
        const content = screen.getByTestId('content')


        assertNumOfRenders(0)


        const button = screen.getByText('Change')

        await act(async () => {
          await userEvent.click(button)
        })

        assertNumOfRenders(1)


        const renderedResultObj = renderedResultToObject(content)

        expect(renderedResultObj.links.nested.test).toEqual(1000)

        store.links = { nested: { test: 1000 } } as any

        await waitFor(() => {
          assertNumOfRenders(2)
        }, {timeout: 3})

        store.links.nested.test = 4_000
        // @ts-expect-error - We are changing the store value
        store.links.nested.newProp = 'new prop'


        await waitFor(() => {
          assertNumOfRenders(3)
          expect(renderedResultToObject(content).links.nested.test).toEqual(4_000)
          expect(renderedResultToObject(content).links.nested.newProp).toEqual('new prop')
        }, {timeout: 3})
      })

      it('   Check object property (nested proxy) keeps the same object reference', async () => {
        render(<AppCheckReference />)

        const content = screen.getByTestId('content')

        // Just 1 re-render due to change of the other state the first time is rendered
        assertNumOfRenders(1)
        expect(renderedResultToString(content)).toEqual(JSON.stringify(INITIAL_VALUE.links))
      })
    })
  })

  describe('- [__reset__]', async () => {
    it('  Reset to initial-state', async () => {
      render(<AppWithClick onClick={(s: typeof store) => { s.name = 'changed name!' }} />)
      const content = screen.getByTestId('content')


      assertNumOfRenders(0)


      const button = screen.getByText('Change')

      await act(async () => {
        await userEvent.click(button)
      })

      assertNumOfRenders(1)



      reset()

      await waitFor(() => {
        assertNumOfRenders(2)
        expect(renderedResultToString(content)).toEqual(JSON.stringify(INITIAL_VALUE))
      })
    })
  })
})
