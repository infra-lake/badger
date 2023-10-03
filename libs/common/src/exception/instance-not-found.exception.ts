import { Exception } from './exception'

export class InstanceNotFoundException extends Exception {
    public constructor(public readonly type: string) {
        super(`does not found instance for type "${type}"`)
    }
}
