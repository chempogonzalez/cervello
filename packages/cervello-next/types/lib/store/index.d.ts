import type { WithoutType } from '../../types/shared';
import type { UseSelector } from '../helpers';
interface CervelloStoreUseParam<StoreType> {
    onChange: (cb: (store: StoreType) => void) => void;
    onPartialChange: <Attributes extends Array<keyof WithoutType<StoreType, Function>>>(selectors: Attributes, cb: (store: StoreType) => void) => void;
}
/**
 * Use function which allows you to listen for changes in the store.
 */
export declare type CervelloUseFunction<StoreType> = (param: CervelloStoreUseParam<StoreType>) => void;
interface CervelloStore<StoreType> {
    /** Reactive store */
    store: StoreType;
    /** Hook to react to all changes done to 'store' */
    useStore: () => StoreType;
    /** Hook to react to changes done to 'store' in all the attributes provided */
    useSelector: UseSelector<StoreType>;
    /** Functions to be attached to changes in a general way (tracking, loggers, ... etc) */
    use: (...functions: Array<(useObj: CervelloStoreUseParam<StoreType>) => void>) => CervelloStore<StoreType>;
}
/**
 * @note Currently not working
 */
export interface CervelloOptions {
    persist?: boolean;
}
/**
 * Creates a store that is reactive and can be used inside and outside of React components.
 * @param initialValue Object with the default values for the store
 *
 * @returns - { store, useStore, useSelector }
 */
export declare function cervello<T extends Record<any, unknown>>(initialValue: T, options?: CervelloOptions): CervelloStore<T>;
/**
 * Creates a store that is reactive and can be used inside and outside of React components.
 * @param initialValue Function which returns the default values for the store
 *
 * @returns - { store, useStore, useSelector }
 */
export declare function cervello<T>(initialValue: () => T, options?: CervelloOptions): CervelloStore<T>;
export {};
