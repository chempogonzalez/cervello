import type { TeardownLogic, UnSubscribable } from './types'



export class Subscription implements UnSubscribable {
  readonly #teardowns: Array<Exclude<TeardownLogic, void>> = []

  unsubscribe (): void {
    this.#teardowns.forEach((teardown) => {
      if (typeof teardown === 'function') {
        teardown()
      } else {
        teardown.unsubscribe()
      }
    })
  }

  add (teardown: TeardownLogic): void {
    if (teardown) {
      this.#teardowns.push(teardown)
    }
  }
}
