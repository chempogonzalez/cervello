import type { BehaviorSubject } from 'rxjs';
export declare function createUseStore<T>(store$$: BehaviorSubject<T>): () => T;
