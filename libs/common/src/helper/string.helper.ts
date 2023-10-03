export interface StringHelperIsValidConstraints {
    defined?: boolean
    empty?: boolean
    minLenth?: number
}

export class StringHelper {

    private constructor() { }

    public static isEmpty(value?: string): boolean {
        return (value ?? '').trim().length <= 0
    }

    public static isString(value?: any): boolean {
        return typeof value === 'string'
    }

}
