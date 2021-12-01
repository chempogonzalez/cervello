import { useEffect, useRef } from "react"

export const useLogRenders = (component: string) => {
  /** Nº of renders tracking ---------------*/
  const renders = useRef(-1)
  useEffect(() => {
    renders.current = renders.current + 1
    console.log(`[${component}] - ${renders.current === 0 ? 'First render' : 're-render: ' + renders.current}`)
  })
  /** ------------------------------------- */
}
