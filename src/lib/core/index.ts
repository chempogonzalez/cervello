/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  BehaviorSubject,
  Subject,
} from 'rxjs'
import { proxifyStore } from '../utils'
import { createReactHook } from '../utils/hook'


type Store<T> = T extends (string | number) ? { value: T } : T

// TODO: Move types to shared folder
type InitialValueOrCb<T> = T | ((reactiveData: T) => void)


// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function cervello <T> (initialValue: T): [
  Store<T>,
  (initialValueOrCallback?: InitialValueOrCb<Store<T>>, str?: string) => Store<T>
] {
  const initialStore = (
    typeof initialValue === 'string' || typeof initialValue === 'number'
      ? { value: initialValue }
      : initialValue
  ) as Store<T>

  type StoreType = Store<T>

  const store$$ = new BehaviorSubject<StoreType>(initialStore)
  // const attributeModified$$ = new BehaviorSubject<string | null>(null)
  const attributeModified$$ = new Subject<string | null>()

  return [
    proxifyStore<StoreType>({ initialStore, store$$, attributeModified$$ }),
    createReactHook<StoreType>({ initialStore, store$$, attributeModified$$ }),
  ]
}
