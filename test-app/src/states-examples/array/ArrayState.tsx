import { cervello } from 'cervello'
import { useLogRenders } from '../../useLogRenders';
import { ArrayButtons } from './ArrayButtons';

export const [cityList, useCityList] = cervello(['Seville', 'Huelva', 'Cadiz'])


export const ArrayState = () => {
  useLogRenders('ArrayState')

  const cityList = useCityList()

  return (
    <>
      <h2>Array state</h2>
      <ArrayButtons />

      <p>List: </p>
      <ul>
        {cityList.map((city) => (
          <li key={city}>{city}</li>
        ))}
      </ul>
    </>
  )
}