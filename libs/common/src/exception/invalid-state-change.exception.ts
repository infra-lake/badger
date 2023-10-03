import { BadRequestException, type HttpExceptionOptions } from '@nestjs/common'

export class InvalidStateChangeException extends BadRequestException {

    public constructor(objectOrError?: string | object | any, descriptionOrOptions?: string | HttpExceptionOptions) {
        super(objectOrError, descriptionOrOptions)
    }

}
