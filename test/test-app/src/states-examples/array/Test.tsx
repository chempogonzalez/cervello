
import { useLogRenders } from '../../useLogRenders'

export const Test = (): JSX.Element => {
  useLogRenders('Test')

  return (
    <div>Test list</div>
  )
}
