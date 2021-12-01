import './App.css'
import { NumberStringState } from './states-examples/number-string/NumberStringState'
import { ArrayState } from './states-examples/array/ArrayState'
import { useLogRenders } from './useLogRenders'


function App (): JSX.Element {
  useLogRenders('App')

  return (
    <div className='App'>
      <section>
        <NumberStringState />
      </section>

      <section>
        <ArrayState />
      </section>
    </div>
  )
}

export default App
