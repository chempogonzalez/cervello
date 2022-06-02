import { cervello } from 'cervello'
import { useLogRenders } from '../../useLogRenders'
import { ArrayButtons } from './ArrayButtons'


export const [cityList, useCityList] = cervello<Array<string>>([])


export const ArrayState = ({
  cities = ['Seville', 'Huelva', 'Cadiz'],
}): JSX.Element => {
  useLogRenders('ArrayState')

  /** Pushing cityList when component is mounted */
  const cityList = useCityList(cities, 'ArrayState')

  return (
    <>
      <h2>Array - state</h2>
      <ArrayButtons />

      <div className='list-wrapper'>
        <p>Cities</p>
        <ul>
          {cityList.map((city) => (
            <li key={city}>{city}</li>
          ))}
        </ul>
      </div>
    </>
  )
}
