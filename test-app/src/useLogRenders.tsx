/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { useEffect, useRef } from 'react'

export const useLogRenders = (component: string): void => {
  /** Nº of renders tracking --------------- */
  const renders = useRef(-1)
  useEffect(() => {
    renders.current = renders.current + 1
    console.log(`[${component}] - ${renders.current === 0 ? 'First render' : 're-render: ' + renders.current}`)
  })
  /** ------------------------------------- */
}
