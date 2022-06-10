import { pipeFromArray } from './observable.helpers'
import { Subscriber } from './subscriber'

import type { Subscription } from './subscription'
import type { Observer, OperatorFunction, TeardownLogic } from './types'



export class Observable<T> {
  constructor (private readonly constructorSubscribe: (observer: Observer<T>) => TeardownLogic) {}

  subscribe (observer: Partial<Observer<T>>): Subscription {
    const subscriber = new Subscriber(observer)
    subscriber.add(this.constructorSubscribe(subscriber))
    return subscriber
  }

  pipe (...operations: Array<OperatorFunction<any, any>>): Observable<any> {
    return pipeFromArray(operations)(this)
  }
}
