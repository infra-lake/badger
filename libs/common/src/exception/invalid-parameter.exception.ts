import { type ValidationError } from '@nestjs/common'
import { Exception } from '../exception'
import { ObjectHelper } from '../helper'

export class InvalidParameterException extends Exception {

    public constructor(
        public readonly name: string,
        public readonly value?: any,
        public readonly detail?: string,
        public readonly errors?: ValidationError[]
    ) {
        super(`parameter "${name}" with value "${ObjectHelper.isNullOrUndefined(value) ? '' : JSON.stringify(value)}" is invalid.`.replace(/""/g, '"').concat(detail ?? ''), errors)
    }

}
