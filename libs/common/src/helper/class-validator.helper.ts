import { type ValidatorOptions, validate } from 'class-validator'
import { InvalidParameterException } from '../exception'

export class ClassValidatorHelper {

    private constructor() { }

    public static async validate(name: string, value: object, options?: ValidatorOptions) {
        const errors = await validate(value, options)
        if (errors.length > 0) {
            throw new InvalidParameterException(name, value, undefined, errors)
        }
    }

}
