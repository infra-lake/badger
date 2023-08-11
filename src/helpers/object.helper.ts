export class ObjectHelper {

    public static has(value: any) : boolean {
        return value !== null && value !== undefined
    }

    public static empty(value: any) : boolean {
        return !ObjectHelper.has(value) || (value.constructor.name === 'Object' && Object.keys(value).length <= 0)
    }

}