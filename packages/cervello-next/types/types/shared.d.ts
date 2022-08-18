export declare type WithoutType<T, V, WithNever = {
    [K in keyof T]: Exclude<T[K], undefined> extends V ? never : (T[K] extends Record<string, unknown> ? WithoutType<T[K], V> : T[K]);
}> = Pick<WithNever, {
    [K in keyof WithNever]: WithNever[K] extends never ? never : K;
}[keyof WithNever]>;
export declare type ObjectFromAttributes<T, Attributes extends Array<keyof WithoutType<T, Function>>> = {
    [k in Attributes[number]]: T[k];
};
