// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IEntity<T extends IEntity<T, K>, K extends keyof T> { }
