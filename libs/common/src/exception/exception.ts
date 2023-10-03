import { type ValidationError } from '@nestjs/common'

export class Exception extends Error {

    public readonly name: string

    public constructor(
        public readonly message: string,
        public readonly details?: Exception[] | ValidationError[]
    ) {
        super(message)
        this.name = this.constructor.name
    }

}
