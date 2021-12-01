import { cityList } from './ArrayState'

const addNewCity = (): void => {
  cityList.push(`RandomCity_${+Date.now()}`)
}

const replaceSeville = (): void => {
  const sevilleIdx = cityList.findIndex(city => city === 'Seville')
  cityList[sevilleIdx] = 'replaced_Seville'
}


export const ArrayButtons = (): JSX.Element => {
  return (
    <div>
      <button onClick={addNewCity}>Add new city</button>
      <button onClick={replaceSeville}>Replace Seville</button>
    </div>
  )
}
