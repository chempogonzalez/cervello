import type { ObjectFromAttributes, WithoutType } from '../../types/shared';
import type { BehaviorSubject } from 'rxjs';
export declare function getPartialObjectFromAttributes<T>(attributes: Array<keyof T>, store: T): any;
export declare type UseSelector<T> = <Attributes extends Array<keyof WithoutType<T, Function>>>(selectors: Attributes, isEqualFunction?: (previousState: ObjectFromAttributes<T, Attributes>, currentState: ObjectFromAttributes<T, Attributes>) => boolean) => ObjectFromAttributes<T, Attributes>;
export declare function createUseSelector<T>(store$$: BehaviorSubject<T>): UseSelector<T>;
