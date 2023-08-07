import { Export } from '../services/export.service'
import { BadRequestError } from './bad-request.error'

export type InvalidStateChangeErrorInputStatus = {
    old: Export['status']
    new: Export['status']
    valids: Array<Export['status']>
}

export type InvalidStateChangeErrorInput = {
    type: string
    on: string
    status: InvalidStateChangeErrorInputStatus
}

export class InvalidStateChangeError extends BadRequestError {
    constructor({ type, on, status }: InvalidStateChangeErrorInput) {
        super(`cannot process request "${on}" because type "${type}" has state "${status.old}", only "${type}" types with status ${format(status)} can have status "${status.new}"`)
    }
}

function format({ valids }: Pick<InvalidStateChangeErrorInputStatus, 'valids'>): string {
    return valids.map(status => status.toString()).reduce((result, status) => result ? `"${result}", "${status}"` : `"${status}"`)
}