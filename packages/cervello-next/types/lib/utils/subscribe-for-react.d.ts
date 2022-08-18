import type { BehaviorSubject } from 'rxjs';
export declare const subscribeForReactHook: <T>(store$$: BehaviorSubject<T>) => (onStoreChange: () => void) => () => void;
