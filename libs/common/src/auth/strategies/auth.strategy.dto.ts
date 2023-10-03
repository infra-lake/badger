export enum AuthStrategyType {
    NO = 'no',
    BASIC = 'basic'
}

export abstract class AuthStrategy<T extends AuthStrategyType> {
    abstract get type(): T
}
