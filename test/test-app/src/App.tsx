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
}, { reactiveNestedObjects: true })
  .use(middlewares, log)


const uuuu = {
  testAttr: {
    nestedTestAttr: 'nested',
  },

}

function App (): JSX.Element {
  useLogRenders('App')
  // const [t, setT] = useState(Math.random())

  const sel = useSelector(['newTest'])

  // const sel = useStore()

  // const st = useStore()

  console.log('selector >>>> ', sel.newTest)
  // console.log('store >>>> ', st.newTest)


  // useEffect(() => {
  //   console.log('useEffect');
  //   (store.newTest as any) = {
  //     test: [
  //       {
  //         test: 'test',
  //         rooms: [
  //           {
  //             name: 'room1',
  //             test: 'test',
  //             rates: [
  //               {
  //                 name: 'rate1',
  //                 price: 2222200,
  //               },
  //             ],
  //           },
  //         ],
  //       },
  //     ],
  //   }
  // }, [])

  return (
    <div className='App'>
      <h1>Cervello examples</h1>

      {/* <h3>t: {JSON.stringify(i.surname, null, 2)}</h3> */}

      <pre>{JSON.stringify(sel.newTest, null, 2)}</pre>
      <hr />
      <pre>{JSON.stringify(sel, null, 2)}</pre>
      {/* <pre>
        LINKS::


        {JSON.stringify(i.links, null, 2)}
        </pre> */}

      <hr />
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
          store.links = ['test.com', 'test2.com']
        }}>Change nestedTestAttr!</button>

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
