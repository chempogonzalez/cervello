import './App.scss'
// import { ArrayState } from './states-examples/array/ArrayState'
// import { NumberStringState } from './states-examples/number-string/NumberStringState'
// import { ObjectState } from './states-examples/object/ObjectState'
import { cervello } from '@cervello/react'

import { useLogRenders } from './useLogRenders'

import type { UseFunction } from '@cervello/react'



let i = 0

const log: UseFunction<'testStore', typeof testStore> = ({ $onChange }): void => {
  $onChange((s) => {
    console.log('store changed', s)
  })
}


const middlewares: UseFunction<'testStore', typeof testStore> = ({ $onPartialChange }): void => {
  $onPartialChange(['test', 'arr'], (s) => {
    console.log('sliced store changed', s)
    s.tii = { test2: (++i).toString() }
  })
}


const { testStore, useSelect, useStore } = cervello('testStore', {
  test: 'test',
  arr: [1, 2, 3],
  tii: {
    test2: '123',
  },
  tee () {
    this.test = `${this.test}__1111`
  },
  setTee () {
    // this.arr = [4, 4, 4, 4, 4]
    this.arr.push(19)

    // this.test = 'tssstteeee'
  },
}).use(middlewares, log)

// setTimeout(() => {
//   testStore.test = '1333333'
//   console.log('-*********', testStore.tee());
//   // testStore.setTee()
//   testStore.arr = [12,4]
// }, 3000);


function App (): JSX.Element {
  useLogRenders('App')

  // const store = useSelect('tee', 'tii')

  const store = useStore()
  // const xx = s.useSelect('test', 'tee')

  console.log('ssssssssss', store)

  const handleOnClick = () => {
    store.tee()
    // store.tii = { test2: Math.random().toString() }
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
