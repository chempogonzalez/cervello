import './App.scss'
// import { ArrayState } from './states-examples/array/ArrayState'
// import { NumberStringState } from './states-examples/number-string/NumberStringState'
// import { ObjectState } from './states-examples/object/ObjectState'
import { cervello } from '@cervello/react'

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


const { store, useSelector, useStore } = cervello({
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

  const store = useStore()
  // const x = useSelector(['links', 'name'])
  console.log({ store })

  // const store = useStore()


  const handleOnClick = () => {
    // store.addLink('test', Math.random())
    store.languages = [...store.languages, ({ test: Math.random() })] as any
  }

  return (
    <div className='App'>
      <h1>Cervello examples</h1>

      <pre>{JSON.stringify(store, null, 2)}</pre>
      <hr />
      {/* <pre>{JSON.stringify(s, null, 2)}</pre> */}

      <button onClick={handleOnClick}>Change</button>
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
