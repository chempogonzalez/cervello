import type { BehaviorSubject } from 'rxjs';
export declare function proxifyStore<T extends Record<string | symbol, any>>(store$$: BehaviorSubject<T>, storeObject: T): T;
