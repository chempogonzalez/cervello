import './App.scss'
// import { ArrayState } from './states-examples/array/ArrayState'
// import { NumberStringState } from './states-examples/number-string/NumberStringState'
// import { ObjectState } from './states-examples/object/ObjectState'
import { cervello } from '@cervello/react'
import { useEffect, useRef } from 'react'

import { useLogRenders } from './useLogRenders'

import type { UseFunction } from '@cervello/react'



const log: UseFunction<typeof store> = ({ onChange }): void => {
  onChange((store) => {
    console.log('[log] - store changed', store)
  })
}


const middlewares: UseFunction<typeof store> = ({ onPartialChange }): void => {
  onPartialChange(['name', 'surname'], (s) => {
    console.log('[[[[[ middleware-partial]]]]]]] - sliced store changed', s.surname)
  })
}


const { store, useSelector, useStore, reset } = cervello({
  name: 'Chempo',
  surname: 'Gonzalez',
  languages: ['spanish', 'english'],
  links: {
    github: '@chempogonzalez',
    twitter: '@_chempo',
    nested: {
      test: 1,
    },
  },
  newTest: null,
  addLink (key: 'test', value: number): void {
    type LinkKeys = keyof typeof this.links['nested']

    this.links.nested[key as LinkKeys] = value
  },
  addSecondSurname (surname: string): void {
    this.surname = `${this.surname} ${surname}`
  },
})
  .use(middlewares, log)


const uuuu = {
  testAttr: {
    nestedTestAttr: 'nested',
  },

}


function StoreHookComponent (): JSX.Element {
  useLogRenders('StoreHookComponent')
  const store = useStore()

  return (
    <div>
      <h2>Store hook</h2>
      <pre>{JSON.stringify(store, null, 2)}</pre>
    </div>
  )
}


function SelectorHookComponent (): JSX.Element {
  useLogRenders('Selector__HookComponent')
  const { newTest } = useSelector(['newTest'])

  return (
    <div>
      <h2>Selector hook - newTest</h2>
      <pre>{JSON.stringify(newTest, null, 2)}</pre>
    </div>
  )
}



function App (): JSX.Element {
  useLogRenders('App')

  return (
    <div className='App'>
      <h1>Cervello examples</h1>

      <section style={{ display: 'flex', flexDirection: 'row', marginTop: '130px' }}>
        <StoreHookComponent />

        <br />

        <hr />
        <hr />

        <br />

        <SelectorHookComponent />
        <br />
      </section>


      {/* <pre>{JSON.stringify(s, null, 2)}</pre> */}

      <div className="btn-wrapper">
        {/* <button onClick={handleOnClick}>Change</button> */}
        <button onClick={() => {
          (store.newTest as any) = {
            test: [
              {
                test: 'test',
                rooms: [
                  {
                    name: 'room1',
                    test: 'test',
                    rates: [
                      {
                        name: 'rate1',
                        price: 100,
                      },
                    ],
                  },
                ],
              },
            ],
          }
        }}>Change newTest</button>
        <button onClick={() => {
          (store.newTest as any) = {
            test: [
              {
                test: 'test',
                rooms: [
                  {
                    name: 'room1',
                    test: 'test',
                    rates: [
                      {
                        name: 'rate1',
                        price: 2222200,
                      },
                    ],
                  },
                ],
              },
            ],
          }
        }}>Change nestedTestAttr!</button>

        <button onClick={() => {
          (store.links as any) = ['test.com', 'test2.com']
        }}>Change nestedTestAttr!</button>


        <button onClick={() => {
          (store.newTest as any).tiiiii = ['__test', '__test2']
        }}>Change newTest nested .test prop!!</button>

        <button onClick={() => reset()}>Reset</button>
      </div>

      {/* <div className='grid'>
        <section className='number-string-state'>
          <NumberStringState />
        </section>

        <section className='array-state'>
          <ArrayState />
        </section>

        <section className='object-state'>
          <ObjectState />
        </section>
      </div> */}

    </div>
  )
}

export default App
