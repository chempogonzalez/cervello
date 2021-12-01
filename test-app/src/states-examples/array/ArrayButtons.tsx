import { cityList } from './ArrayState'

const addNewCity = () => {
  cityList.push('RandomCity_' + +Date.now())
}

const replaceSeville = () => {
  const sevilleIdx = cityList.findIndex(city => city === 'Seville')
  cityList[sevilleIdx] = 'replaced_Seville'
}


export const ArrayButtons = () => {
  return (
    <div>
      <button onClick={addNewCity}>Add new city</button>
      <button onClick={replaceSeville}>Replace Seville</button>
    </div>
  )
}
