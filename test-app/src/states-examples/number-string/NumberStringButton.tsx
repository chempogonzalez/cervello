import { memo } from 'react'
import { counter, dots } from './NumberStringState'
import { useLogRenders } from '../../useLogRenders'


export const NumberStringButton = memo(({ children }) => {
  useLogRenders('Button')

  const clickHandler = () => {
    counter.value += 1
    dots.value += '.'
  }

  return (
    <button onClick={clickHandler}>{children}</button>
  )
})