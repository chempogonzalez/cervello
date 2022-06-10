import type { UnaryFunction } from './types'



export function pipeFromArray<T, R> (
  fns: Array<UnaryFunction<T, R>>,
): UnaryFunction<T, R> {
  if (fns.length === 0) {
    return (x) => x as any as R
  }

  if (fns.length === 1) {
    return fns[0]
  }

  return function piped (input: T): R {
    return fns.reduce<any>(
      (prev: any, fn: UnaryFunction<T, R>) => fn(prev),
      input,
    )
  }
}
