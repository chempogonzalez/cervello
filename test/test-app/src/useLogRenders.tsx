/* eslint-disable no-console */

import { useRef } from 'react'



export const useLogRenders = (component: string): string => {
  /** Nº of renders tracking --------------- */
  const renders = useRef(-1)

  renders.current = renders.current + 1
  const renderMountedString = renders.current === 0 ? 'First render' : `re-render: ${renders.current}`
  console.log(`[${component}] - ${renderMountedString}`)


  /** ------------------------------------- */
  return renderMountedString
}
