import './App.scss'
import { ArrayState } from './states-examples/array/ArrayState'
import { NumberStringState } from './states-examples/number-string/NumberStringState'
import { ObjectState } from './states-examples/object/ObjectState'
import { useLogRenders } from './useLogRenders'



function App (): JSX.Element {
  useLogRenders('App')

  return (
    <div className='App'>
      <h1>Cervello examples</h1>

      <div className='grid'>
        <section className='number-string-state'>
          <NumberStringState />
        </section>

        <section className='array-state'>
          <ArrayState />
        </section>

        <section className='object-state'>
          <ObjectState />
        </section>
      </div>

    </div>
  )
}

export default App
