import './App.scss'
// import { ArrayState } from './states-examples/array/ArrayState'
// import { NumberStringState } from './states-examples/number-string/NumberStringState'
// import { ObjectState } from './states-examples/object/ObjectState'
import { cervello } from '@cervello/react'
import { useEffect, useState } from 'react'

import { useLogRenders } from './useLogRenders'

import type { UseFunction } from '@cervello/react'



const log: UseFunction<typeof store> = ({ onChange }): void => {
  onChange((store) => {
    console.log('[log] - store changed', store)
  })
}


const middlewares: UseFunction<typeof store> = ({ onPartialChange }): void => {
  onPartialChange(['surname'], (s) => {
    console.log('[middleware-partial] - sliced store changed', s)
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
  addLink (key: 'test', value: number): void {
    type LinkKeys = keyof typeof this.links['nested']

    this.links.nested[key as LinkKeys] = value
  },
  addSecondSurname (surname: string): void {
    this.surname = `${this.surname} ${surname}`
  },
})


  .use(middlewares, log)



function App (): JSX.Element {
  useLogRenders('App')
  // const [t, setT] = useState(Math.random())


  const i = useStore()
  const x = useSelector(['links', 'name'])

  console.log('..............', i.$value)
  // // const store = useStore()
  // useEffect(() => {
  //   console.log('changing reference!')
  //   setT(Math.random())
  //   // store.name = `${Math.random()}`
  // }, [x])


  const handleOnClick = () => {
    // store.addLink('test', 2)
    // store.name = `${Math.random()}`
    store.$value = { jeje: 1 } as any
    // store.languages = [...store.languages, ({ test: Math.random() })] as any
  }

  return (
    <div className='App'>
      <h1>Cervello examples</h1>

      {/* <h3>t: {JSON.stringify(i, null, 2)}</h3> */}

      <pre>{JSON.stringify(i, null, 2)}</pre>
      <hr />
      {/* <pre>{JSON.stringify(s, null, 2)}</pre> */}

      <button onClick={handleOnClick}>Change</button>
      <button onClick={() => reset()}>Reset</button>

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
