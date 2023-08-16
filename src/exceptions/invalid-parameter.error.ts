import { StringHelper } from "../helpers/string.helper"
import { BadRequestError } from "./bad-request.error"

export class InvalidParameterError extends BadRequestError {
    constructor(public readonly name: string, message?: string, cause?: any) {
        super(`parameter "${name}" is invalid${StringHelper.empty(message) ? '' : `: "${message}"`}`, { cause })
    }
}