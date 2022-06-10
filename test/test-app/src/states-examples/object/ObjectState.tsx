import { cervello } from 'cervello'
import { useMemo } from 'react'

export const [store, useStore] = cervello({
  numbers: [1, 2, 4, 5, 6, 9, 15, 16, 24],
  onlyEven: false,
})

export const ObjectState = (): JSX.Element => {
  const objectStore = useStore()

  const finalNumbers = useMemo(() => objectStore.onlyEven ? objectStore.numbers.filter(n => n % 2 === 0) : objectStore.numbers, [objectStore.onlyEven])

  return (
    <>
      <h2>Object - state</h2>
      <p className='mb'>
        {finalNumbers.join(',')}
      </p>
      <button onClick={e => { objectStore.onlyEven = !objectStore.onlyEven }}>Toggle Only Even Numbers</button>
    </>
  )
}
