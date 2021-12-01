/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  BehaviorSubject,
  Subject,
} from 'rxjs'
import { proxifyStore } from './utils'
import { createReactHook } from './utils/hook'


type Store<T> = T extends (string | number) ? { value: T } : T


// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function cervello <T> (initialValue: T): [Store<T>, () => Store<T>] {
  const initialStore = (
    typeof initialValue === 'string' || typeof initialValue === 'number'
      ? { value: initialValue }
      : initialValue
  ) as Store<T>

  type StoreType = Store<T>

  const store$$ = new BehaviorSubject<StoreType>(initialStore)
  const attributeModified$$ = new Subject<string | null>()

  return [
    proxifyStore<StoreType>({ initialStore, store$$, attributeModified$$ }),
    createReactHook<StoreType>({ initialStore, store$$, attributeModified$$ }),
  ]
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
// export function cervello<T> (initialValue: T) {
//   return createCervello(initialValue)
// }
