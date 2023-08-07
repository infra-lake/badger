import { StringHelper } from "../helpers/string.helper";

export class UnsupportedOperationError extends Error {
    constructor(operation: string, message?: string, cause?: any) {
        super(`the operation "${operation}" is unsupported${StringHelper.empty(message) ? '' : `: "${message}"`}`, { cause })
    }
}