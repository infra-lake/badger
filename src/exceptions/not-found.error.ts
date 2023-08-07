import { StringHelper } from "../helpers/string.helper";

export class NotFoundError extends Error {
    constructor(public readonly name: string, message?: string, cause?: any) {
        super(`not found "${name}"${StringHelper.empty(message) ? '' : `: "${message}"`}`, { cause })
    }
}