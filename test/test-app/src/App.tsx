import './App.scss'
// import { ArrayState } from './states-examples/array/ArrayState'
// import { NumberStringState } from './states-examples/number-string/NumberStringState'
// import { ObjectState } from './states-examples/object/ObjectState'
import { c } from 'cervello'

import { useLogRenders } from './useLogRenders'



const { testStore, useSelect, useStore } = c('testStore', {
  test: 'test',
  arr: [1, 2, 3],
  tii: {
    test2: '123',
  },
  tee: function () {
    this.test = this.test + '__1111'
  },
  setTee: function () {
    // this.arr = [4, 4, 4, 4, 4]
    this.arr.push(19)

    // this.test = 'tssstteeee'
  },
})

// setTimeout(() => {
//   testStore.test = '1333333'
//   console.log('-*********', testStore.tee());
//   // testStore.setTee()
//   testStore.arr = [12,4]
// }, 3000);


function App (): JSX.Element {
  useLogRenders('App')

  const store = useSelect('tee', 'tii')

  const s = useStore()
  // const xx = s.useSelect('test', 'tee')

  console.log('ssssssssss', store)

  const handleOnClick = () => {
    store.tee()
    store.tii = { test2: '55555' }
  }

  return (
    <div className='App'>
      <h1>Cervello examples</h1>

      <pre>{JSON.stringify(store, null, 2)}</pre>
      <hr />
      <pre>{JSON.stringify(s, null, 2)}</pre>

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
