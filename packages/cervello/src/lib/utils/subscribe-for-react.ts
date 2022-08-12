import type { BehaviorSubject } from 'rxjs'



export const subscribeForReactHook = <T>(store$$: BehaviorSubject<T>): typeof subscribe => {
  const subscribe = (onStoreChange: () => void): () => void => {
    const subscription = store$$.subscribe(onStoreChange)
    return () => {
      subscription.unsubscribe()
    }
  }
  return subscribe
}
