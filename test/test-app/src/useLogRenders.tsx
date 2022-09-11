/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { useEffect, useRef, useState } from 'react'

export const useLogRenders = (component: string): string => {
  /** Nº of renders tracking --------------- */
  const renders = useRef(-1)
  const [renderString, setRenderString] = useState('First render')

  useEffect(() => {
    renders.current = renders.current + 1
    const renderMountedString = renders.current === 0 ? 'First render' : 're-render: ' + renders.current
    console.log(`[${component}] - ${renderMountedString}`)
    setRenderString(renderMountedString)
  })
  /** ------------------------------------- */
  return renderString
}
