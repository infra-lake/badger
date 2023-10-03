export class DateHelper {

    private constructor() { }

    public static parse(value: string): Date {

        const model = '0000-01-01T00:00:00.000000Z'

        if (value.length > model.length) {
            throw new Error(`invalid date: "${value}"`)
        }

        try {
            const result = new Date(`${value}${model.substring(value.length)}`)
            return result as any
        } catch (error) {
            throw new Error(`invalid date: "${value}"`)
        }

    }

}
