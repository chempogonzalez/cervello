import { cityList } from './ArrayState'
import { useLogRenders } from '../../useLogRenders'

const addNewCity = (): void => {
  cityList.push(`RandomCity_${+Date.now()}`)
}

const replaceSeville = (): void => {
  const sevilleIdx = cityList.findIndex(city => city === 'Seville')
  cityList[sevilleIdx] = 'replaced_Seville'
}


// const getAsync = async (): Promise<string> => {
//   return new Promise<string>((resolve) => {
//     setTimeout(() => {
//       resolve('Async')
//     }, 1000)
//   })
// }

export const ArrayButtons = (): JSX.Element => {
  useLogRenders('ArrayButtons')

  return (
    <div className='mb'>
      <div className='buttons'>
        <button onClick={addNewCity}>Add new city</button>
        <button onClick={replaceSeville}>Replace Seville</button>
      </div>
    </div>
  )
}
