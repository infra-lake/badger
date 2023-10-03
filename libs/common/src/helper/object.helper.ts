export class ObjectHelper {

    private constructor() { }

    public static isNullOrUndefined(value?: any): boolean {
        return value === null || value === undefined
    }

    public static isEmpty(object: any): boolean {
        if (ObjectHelper.isNullOrUndefined(object)) return true
        return Object.keys(object).length === 0
    }

}
