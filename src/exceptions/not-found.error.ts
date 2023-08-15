import { StringHelper } from "../helpers/string.helper";
import { BadRequestError } from "./bad-request.error";

export class NotFoundError extends BadRequestError {
    constructor(public readonly name: string, message?: string, cause?: any) {
        super(`not found "${name}"${StringHelper.empty(message) ? '' : `: "${message}"`}`, { cause })
    }
}