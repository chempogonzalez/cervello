import { Observable } from './observable'



export function map<T, R> (project: (value: T, index: number) => R) {
  return (observable: Observable<T>) =>
    new Observable<R>((subscriber) => {
      let i = 0
      observable.subscribe({
        next (value) {
          return subscriber.next(project(value, i++))
        },
        error (err) {
          subscriber.error(err)
        },
        complete () {
          subscriber.complete()
        },
      })
    })
}
