import React, { useEffect, useRef, useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, userEvent, waitFor } from 'vitest-react'
import { App, AppCheckReference, AppWithClick, INITIAL_VALUE, renderedResultToObject, renderedResultToString, reset, store, useLogRenders, useSelector, useStore } from './utils'




/** --------------- ASSERT HELPERS ---------------------- */
const reRenderNum = (num: number) => num === 0
  ? 'First render' 
  : `re-render: ${num}`

const assertNumOfRenders = (num: number) => {
  const renders = screen.getByTestId('renders')

  expect(renders.textContent).toEqual(reRenderNum(num))
}
/** --------------- [end] ASSERT HELPERS ---------------- */






describe('[_CERVELLO_]', () => {
    it('First render with initial value', async () => {
      render(<App />)
      
      const content = screen.getByTestId('content')

      assertNumOfRenders(0)
      expect(renderedResultToString(content)).toEqual(JSON.stringify(INITIAL_VALUE))
    })
  
  
    it('Change first level string attribute multiple times', async () => {
      render(<AppWithClick onClick={(s) => {s.name = 'chempo!'}} />)
      const content = screen.getByTestId('content')

      assertNumOfRenders(0)

  
      const button = screen.getByText('Change')
      await userEvent.click(button)
  
      assertNumOfRenders(1)

      await userEvent.click(button)
  
      assertNumOfRenders(1)

      await userEvent.click(button)
  
      assertNumOfRenders(1)


      const renderedResultObj = renderedResultToObject(content)
      expect(renderedResultObj.name).toEqual('chempo!')
    })
  
  
    it('Change first level array attribute multiple times', async () => {
      render(<AppWithClick onClick={(s) => { s.languages = [...s.languages, 'brazilian']}} />)
      const content = screen.getByTestId('content')

      assertNumOfRenders(0)

  
      const button = screen.getByText('Change')
      await userEvent.click(button)

      assertNumOfRenders(1)

  
      const renderedResultObj = renderedResultToObject(content)
      expect(renderedResultObj.languages).toEqual([...INITIAL_VALUE.languages, 'brazilian'])

      await userEvent.click(button)

      // New re-render due to new array reference passed each user's click
      assertNumOfRenders(2)
    })
  
  
    it('Change first level attribute through store functions multiple times', async () => {
      render(<AppWithClick onClick={(s: typeof store) => { s.addSecondSurname('!') }} />)
      const content = screen.getByTestId('content')

        
      assertNumOfRenders(0)

  
      const button = screen.getByText('Change')
      await userEvent.click(button)

      const renderedResultObj = renderedResultToObject(content)

      expect(store.getDisplayName()).toEqual('Gonzalez !')
      await userEvent.click(button)
      expect(renderedResultObj.surname2).toEqual('!')
      
      assertNumOfRenders(1)

      await userEvent.click(button)

      assertNumOfRenders(1)
    })



    it('Change nested property', async () => {
      render(<AppWithClick onClick={(s: typeof store) => { s.links.nested.test = 1000 }} />)
      const content = screen.getByTestId('content')

        
      assertNumOfRenders(0)

  
      const button = screen.getByText('Change')
      await userEvent.click(button)

      assertNumOfRenders(1)


      const renderedResultObj = renderedResultToObject(content)

      expect(renderedResultObj.links.nested.test).toEqual(1000)
    })



    it('Check object property (nested proxy) keeps the same object reference', async () => {
      render(<AppCheckReference />)

      // Just 1 re-render due to change of the other state the first time is rendered
      assertNumOfRenders(1)
    })




    it('Reset to initial-state', async () => {
      render(<AppWithClick onClick={(s: typeof store) => { s.name = 'changed name!' }} />)
      const content = screen.getByTestId('content')

        
      assertNumOfRenders(0)

  
      const button = screen.getByText('Change')
      await userEvent.click(button)

      assertNumOfRenders(1)



      reset()
      
      await waitFor(() => {
        assertNumOfRenders(2)
        expect(renderedResultToString(content)).toEqual(JSON.stringify(INITIAL_VALUE))
      })


    })



})
