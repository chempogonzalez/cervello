
import React, { useEffect, useState } from 'react'
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



async function sleep (ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}


/** --------------- ASSERT HELPERS ---------------------- */
const reRenderNum = (num: number) => num === 0
  ? 'First render'
  : `re-render: ${num}`

const assertNumOfRenders = (num: number, id = '') => {
  const renders = screen.getByTestId(id ? `renders-${id}` : 'renders')
  // console.log({ renders: renders.textContent })

  expect(renders.textContent).toEqual(reRenderNum(num))
}
/** --------------- [end] ASSERT HELPERS ---------------- */


beforeEach(() => {
  reset()
})


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

    it('  Add a new field to the store', async () => {
      store.newNumberField = 4
      store.newStringField = 'new field'
      store.newObjectField = { test: 1 }
      store.newArrayField = ['test', 1, 2, 3]
      store.newFunctionField = () => { return 1 }
      store.newAsyncFunctionField = async () => { return { asyncReturn: 1 } }

      expect(store.newNumberField).toEqual(4)
      expect(store.newStringField).toEqual('new field')
      expect(store.newObjectField).toEqual({ test: 1 })
      expect(store.newArrayField).toEqual(['test', 1, 2, 3])
      expect(store.newFunctionField).toBeInstanceOf(Function)
      expect((store.newFunctionField)()).toEqual(1)
      expect(store.newAsyncFunctionField).toBeInstanceOf(Function)
      await expect((store.newAsyncFunctionField)()).resolves.toEqual({ asyncReturn: 1 })
    })


    it('  Change a property which contains a self-reference', async () => {
      const selfReference = {
        test: 1,
        selfi: null,
        content: <div>React Element test</div>,
        // self: selfReference,
        // globalThis,
      } as any

      // selfReference.selfi = nonReactive(selfReference)

      store.selfReferenceObject = selfReference
      store.newArrayWithSelfReference = [selfReference]

      render(
        <AppWithClick
          onClick={(_) => {
            store.selfReferenceObject = { test: 2, contet3: (<span className='test'>TTTT</span>) }
            store.newArrayWithSelfReference = [{ test: 2, content2: (<span className='test'>TTTT</span>) }]
          }}
        />,
      )

      const button = screen.getByText('Change')

      await act(async () => {
        await userEvent.click(button)
      })

      assertNumOfRenders(1)
    })


    it('  Change a property with react element', async () => {
      const valueWithReactElement = {
        test: 1,
        content: <div>React Element test</div>,
      }

      store.valueWithReactElement = (valueWithReactElement)

      render(
        <AppWithClick
          onClick={(_) => {
          }}
        />,
      )
      assertNumOfRenders(0)

      store.valueWithReactElement = { test: 2, content: (<span className='test'>TTTT</span>) }

      await waitFor(() => {
        assertNumOfRenders(1)
      }, { timeout: 30 })

      store.valueWithReactElement.test = 3

      await waitFor(() => {
        assertNumOfRenders(2)
      }, { timeout: 30 })

      store.valueWithReactElement.content = (<span className='test2'>TTTT</span>)

      await waitFor(() => {
        assertNumOfRenders(3)
      }, { timeout: 30 })


      // assertNumOfRenders(1)

      const content = screen.getByTestId('content')

      //
      expect(renderedResultToString(content)).toEqual(JSON.stringify(store))
    })



    it('  nonReactive field', async () => {
      const { store, useStore } = cervello({
        nestedReactive: {
          test: 1,
        },
        nestedNonReactive: nonReactive({
          test: 2,
          customComponent: <div>custom</div>,
        }),
      })

      const NonReactiveTestComponent = () => {
        const [numOfRenders] = useLogRenders('App')

        const s = useStore()

        const handleOnClick = (reactive = true): void => {
          if (reactive)
            store.nestedReactive.test = 1000
          else
            store.nestedNonReactive.test = 1000
        }

        return (
          <div className='App'>
            {numOfRenders}
            <pre data-testid='content'>{JSON.stringify(s, null, 2)}</pre>

            <button onClick={() => { handleOnClick() }}>reactive</button>
            <button onClick={() => { handleOnClick(false) }}>non-reactive</button>
          </div>
        )
      }

      render(<NonReactiveTestComponent />)

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
      it('  First render with initial value from hook function (with react elements)', async () => {
        const storeInitial = {
          test: 1,
          content: (<div>React Element test</div>),
        } as any

        const { useStore } = cervello<any>({
          schemaTest: [{ storeInitial }],
          storeInitial,
        })


        const RenderSchemaTest = () => {
          const [numOfRenders] = useLogRenders('App')

          const dynamicSchemaTest = 'schemaTest'
          const s = useStore({
            initialValue: s => ({ ...s, [dynamicSchemaTest]: [{ content: (<span>TT</span>), storeInitial }] }),
          })

          // TEST:  to avoid infinite loop due to the use of `useStore` inside the component
          useEffect(() => {
            console.log('initialValue change')
          }, [s])


          return (
            <div className='App'>
              {numOfRenders}
              <pre data-testid='content'>{JSON.stringify(s)}</pre>
              <pre data-testid='schema'>{s.schemaTest?.map((s, idx) => (<span key={idx}>{s.content}</span>))}</pre>
            </div>
          )
        }

        const OtherComponent = () => {
          const [numOfRenders] = useLogRenders('other')
          const s = useStore()

          return (
            <section className='Other'>
              {numOfRenders}
              <pre data-testid='content-2'>{JSON.stringify(s)}</pre>
              <pre data-testid='schema-2'>{s.schemaTest?.map(s => (s.content))}</pre>
            </section>
          )
        }

        render(
          <>
            <RenderSchemaTest />
            <OtherComponent />
          </>,
        )

        const content = screen.getByTestId('content')
        const otherContent = screen.getByTestId('content-2')

        assertNumOfRenders(0)
        assertNumOfRenders(0, 'other')
        expect(renderedResultToString(content)).toContain('"type":"span"')
        console.log({ otherContent: renderedResultToString(otherContent) })
        expect(renderedResultToString(otherContent)).toContain('"type":"span"')

        await sleep(100)
        // Wait for the next render to be sure that the initial value is set and it wasn't re-rendered
        assertNumOfRenders(0)
      })







      it('  Use initialValue (with react elements) in parent and child. Check sync and not over-rendering', async () => {
        const Container = (props) => {
          return (<div>{props.children}</div>)
        }

        const storeInitial = {
          test: 1,
          content: render(<Container><div>React Element test</div></Container>).container,
        } as any

        const { store: s, useStore } = cervello<any>({
          schemaTest: [{ storeInitial }],
          storeInitial,
        })


        // INFO: ===========================================
        const RenderSchemaTest = () => {
          const [numOfRenders] = useLogRenders('App')
          const [forceReRender, setForceReRender] = useState(0)

          const dynamicSchemaTest = 'schemaTest'
          const s = useStore({
            initialValue: (s) => {
              // console.log('** Executing initialValue "REnder" (Function)\n\n')

              return { ...s, [dynamicSchemaTest]: [{ content: (<Container><section>Render content</section></Container>), storeInitial }] }
            },
          })

          // TEST:  to avoid infinite loop due to the use of `useStore` inside the component
          useEffect(() => {
            // console.log('__Render Component useEffect__')
            if (forceReRender < 10)
              setForceReRender(x => x + 1)
          }, [forceReRender, s])


          return (
            <div className='App'>
              {numOfRenders}
              <pre data-testid='content'>{JSON.stringify(s)}</pre>
              <pre data-testid='schema'>{s.schemaTest?.map((s, idx) => (<span key={idx}>{s.content}</span>))}</pre>
            </div>
          )
        }
        // INFO: ===========================================



        // INFO: ===========================================
        const OtherComponent = () => {
          const [numOfRenders] = useLogRenders('other')
          const [shouldRender, setShouldRender] = React.useState(false)
          const [forceReRender, setForceReRender] = useState(0)

          const dynamicSchemaTest = 'schemaTest'
          const s = useStore({
            initialValue: (s) => {
              // console.log('** Executing initialValue "Other" (Function)\n\n')

              return { ...s, [dynamicSchemaTest]: [{ content: (<span>Other content</span>), storeInitial }] }
            },

          })

          useEffect(() => {
            // console.log('other component useEffect')
            if (forceReRender < 10) {
              setTimeout(() => {
                setForceReRender(x => x + 1)
              }, 20)
            }
          }, [s, forceReRender])

          return (
            <section className='Other'>
              {numOfRenders}
              <pre data-testid='content-2'>{JSON.stringify(s)}</pre>
              <pre data-testid='schema-2'>{React.Children.toArray(s.schemaTest?.map(s => (s.content)))}</pre>
              <button onClick={() => { setShouldRender(!shouldRender) }}>Change</button>
              { !!shouldRender && <RenderSchemaTest />}
            </section>
          )
        }
        // INFO: ===========================================



        await act(async () => {
          render(
            <Container>
              <OtherComponent />
            </Container>,
          )
        })

        console.log(s.$value)
        const otherContent = screen.getByTestId('content-2')

        await waitFor(() => {
          assertNumOfRenders(10, 'other')
        }, { timeout: 250 })

        expect(renderedResultToString(otherContent)).toContain('Other content')
        expect(renderedResultToString(otherContent)).toContain('React Element test')

        await sleep(100)

        // Wait for the next render to be sure that the initial value is set and it wasn't re-rendered
        assertNumOfRenders(10, 'other')


        const button = screen.getByText('Change')

        // await sleep(1_000)
        await act(async () => {
          await userEvent.click(button)
        })

        await waitFor(() => {
          assertNumOfRenders(12, 'other')
        }, { timeout: 10 })

        expect(renderedResultToString(otherContent)).toContain('Render content')
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
              options={{ setValueOnMount }}
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
        }, { timeout: 200 })
      })
    })
  })


  describe('  - {store} = useStore()', async () => {
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
        render(
          <AppWithClick
            onClick={(s: typeof store) => {
              s.links.nested.test = 1000
            }}
          />,
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
      })

      it('   Change nested object props after reassigning new object', async () => {
        render(
          <AppWithClick
            onClick={(s: typeof store) => {
              s.links.nested.test = 1000
            }}
          />,
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

        store.links = { newProp: 'prop', nested: { test: 1000, otherProp: 'other' } } as any

        await waitFor(() => {
          assertNumOfRenders(2)
        }, { timeout: 30 })

        store.links.nested.test = 4_000
        // @ts-expect-error - We are changing the store value
        store.links.nested.newProp = 'new prop'


        await waitFor(() => {
          assertNumOfRenders(3)
          expect(renderedResultToObject(content).links.nested.test).toEqual(4_000)
          expect(renderedResultToObject(content).links.nested.newProp).toEqual('new prop')
        }, { timeout: 3 })
      })

      it('   Check object property (nested proxy) not produce re-render (not-changed ref)', async () => {
        render(<AppCheckReference />)

        const content = screen.getByTestId('content')

        // Just 1 re-render due to change of the other state the first time is rendered
        assertNumOfRenders(1)
        expect(renderedResultToString(content)).toEqual(JSON.stringify(INITIAL_VALUE.links))
      })

      it('   Check object property (nested proxy) keeps the same object reference', async () => {
        const links = store.links


        store.links.nested = { test: 1000 }

        expect(links === store.links).toBeTruthy()
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


    it('  Reset to initial-state for nested objects', async () => {
      render(<AppWithClick onClick={(s: typeof store) => { s.links.nested.test = 1_000 }} />)
      const content = screen.getByTestId('content')
      const button = screen.getByText('Change')


      assertNumOfRenders(0)

      await act(async () => {
        await userEvent.click(button)
      })

      assertNumOfRenders(1)

      const renderedResultObj = renderedResultToObject(content)

      const changedValue = renderedResultObj.links.nested.test

      expect(changedValue).toEqual(1_000)

      reset()

      await waitFor(() => {
        assertNumOfRenders(2)
        const renderedResultObjAfterReset = renderedResultToObject(content)

        const valueAfterReset = renderedResultObjAfterReset.links.nested.test

        expect(valueAfterReset).toEqual(INITIAL_VALUE.links.nested.test)
      })
    })
  })
})
