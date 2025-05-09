import React, { useEffect, useRef, useState } from 'react'

import { cervello } from '../index'

import type { CervelloUseStoreOptions } from '../index'



export const useLogRenders = (component: string): [JSX.Element | null, number] => {
  const renders = useRef(-1)

  renders.current = renders.current + 1

  const renderMountedString = renders.current === 0 ? 'First render' : `re-render: ${renders.current}`

  // console.log(`[${component}] - ${renderMountedString}`)
  const testIdSuffix = component === 'App' ? '' : `-${component}`

  return [
    (
      <p
        key={renderMountedString}
        data-testid={`renders${testIdSuffix}`}
      >
        {renderMountedString}
      </p>
    ),
    renders.current,
  ]
}





export const renderedResultToString = (content) => {
  const contentText = content.textContent

  return JSON.stringify(JSON.parse(contentText as string))
}

export const renderedResultToObject = (content) => {
  const contentText = content.textContent

  return JSON.parse(contentText as string)
}





export const INITIAL_VALUE = {
  name: 'Chempo',
  surname: 'Gonzalez',
  surname2: '',
  languages: ['spanish', 'english'],
  links: {
    github: '@chempogonzalez',
    twitter: '@_chempo',
    nested: {
      test: 1,
    },
  },
  getDisplayName () {
    return `${this.surname} ${this.surname2}`
  },
  addLink (key: 'test', value: number): void {
    type LinkKeys = keyof typeof this.links['nested']

    this.links.nested[key as LinkKeys] = value
  },
  addSecondSurname (surname2: string): void {
    this.surname2 = surname2
  },
}

type InitialValue = typeof INITIAL_VALUE

type InitialValuePlusAnything = InitialValue & Record<string, any>

export const { store, useStore, reset } = cervello<InitialValuePlusAnything>(INITIAL_VALUE)
// export const { store, useStore, reset } = cervello<InitialValuePlusAnything>({ here: true })


export function App (props: { options?: CervelloUseStoreOptions<typeof INITIAL_VALUE> }): JSX.Element {
  const [numOfRenders] = useLogRenders('App')

  const s = useStore(props.options)

  return (
    <div className='App'>
      {numOfRenders}
      <pre data-testid='content'>{JSON.stringify(s, null, 2)}</pre>
    </div>
  )
}


export function AppWithClick ({
  onClick, options,
}: { options?: CervelloUseStoreOptions<typeof INITIAL_VALUE>, onClick: (s: typeof store) => void }): JSX.Element {
  const [numOfRenders] = useLogRenders('App')

  const s = useStore(options)

  const handleOnClick = (): void => {
    onClick(s)
  }

  return (
    <div className='App'>
      {numOfRenders}
      <pre data-testid='content'>{JSON.stringify(s, null, 2)}</pre>

      <button onClick={handleOnClick}>Change</button>
    </div>
  )
}


export function AppCheckReference (): JSX.Element {
  const [numOfRenders, renders] = useLogRenders('App')

  // Select a possible nested property which is an object
  const { links } = useStore({
    select: ['links.*'],
  })
  const [anotherState, setAnotherState] = useState(0)

  useEffect(() => {
    // Prevent infinite loop if reference is not cached
    if (renders < 3)
      setAnotherState(Math.random())
  }, [links])

  return (
    <div className='App'>
      {numOfRenders}
      <pre data-testid='content'>{JSON.stringify(links, null, 2)}</pre>

      <p>{anotherState}</p>
    </div>
  )
}
