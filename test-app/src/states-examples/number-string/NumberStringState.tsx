import { cervello } from 'cervello'
import { NumberStringButton } from './NumberStringButton';
import { useLogRenders } from '../../useLogRenders';

export const [counter, useCount] = cervello(0)
export const [dots, useDots] = cervello('')


export const NumberStringState = () => {
  useLogRenders('NumberStringState')

  const { value: counter } = useCount()
  const { value: dots } = useDots()

  return (
    <>
      <h2>Number & String - state</h2>
      <p>Counter: {counter}{dots}</p>
      <NumberStringButton>Increment Counter</NumberStringButton>
    </>
  )
}