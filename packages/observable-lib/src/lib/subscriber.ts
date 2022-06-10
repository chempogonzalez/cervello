import { Subscription } from './subscription'

import type { Observer } from './types'



export class Subscriber<T> extends Subscription implements Observer<T> {
  #isStopped = false

  constructor (private readonly observer: Partial<Observer<T>>) {
    super()
  }

  next (value: T): void {
    if (this.observer.next && !this.#isStopped) {
      this.observer.next(value)
    }
  }

  error (value: unknown): void {
    this.#isStopped = true
    if (this.observer.error) {
      this.observer.error(value)
    }
  }

  complete (): void {
    this.#isStopped = true
    if (this.observer.complete) {
      this.observer.complete()
    }
    if (this.unsubscribe) {
      this.unsubscribe()
    }
  }
}
